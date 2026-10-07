/**
 * Ticket 195 — zbiorcza historia pozycji usuniętych z Selly (tabela `selly_usuniecia`, trasy `/api/selly/usuniete[/csv]`).
 *
 * Tor 3 chodzi po atrapie klienta Selly (`test/gate/selly-atrapa.ts`) i prawdziwym SQLite w katalogu tymczasowym.
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BladSelly } from "../src/selly/klient.js";
import { zresetujStanTor3 } from "../src/selly/rest/stan-tor3.js";
import { usunSierotyZSelly, zresetujProbeUprawnien } from "../src/selly/rest/sync-usuwanie.js";
import {
  stworzAtrapeSelly,
  stworzDiscoveryTestowe,
  stworzSrodowiskoTestowe,
  stworzTestowaBaze,
  zasiejMapowanie,
  type OpcjeAtrapy,
  type SrodowiskoTestowe,
  type TestowaBaza,
} from "./gate/index.js";

const magazyn = (dostawca: string) => ({ feature_id: 1, name: "Magazyny", value: dostawca });
const eanDla = (productId: number) => `590${productId}00000000`.slice(0, 13);

type WierszTabeli = {
  usunieto_at: string;
  przebieg_id: number | null;
  kod: string;
  nazwa: string | null;
  ean: string | null;
  dostawca: string;
  kod_importu: string;
  selly_product_id: number;
  selly_variant_id: number | null;
  akcja: string;
};

describe("Tor 3 zapisuje zbiorczą historię usunięć", () => {
  let baza: TestowaBaza;
  beforeEach(() => {
    baza = stworzTestowaBaze();
    zresetujProbeUprawnien();
    zresetujStanTor3();
  });
  afterEach(() => baza.posprzataj());

  const produkt = (kod: string, kodImportu: string) =>
    baza.sqlite
      .prepare(
        `INSERT INTO products (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy, marza_pct, data_aktualizacji, kod_importu)
         VALUES (?, ?, 'BKT', 'Rolnicze', 'MO1', '0', 1, 1, 1, 0, '2026-10-01', ?)`,
      )
      .run(kod, `Opona ${kod}`, kodImportu);

  /** Żywe produkty — tło, żeby sierot nie było „podejrzanie dużo” (próg 30%). */
  const tlo = (n = 60) => {
    for (let i = 0; i < n; i++) {
      produkt(`ZYWY_${i}`, `Z${i}`);
      zasiejMapowanie(baza.sqlite, { kodImportu: `Z${i}`, dostawca: "MO1", bridgeKod: `ZYWY_${i}`, productId: 100 + i, variantId: 200 + i });
    }
  };

  const sierota = (kodImportu: string, kod: string, productId: number, variantId: number | null, ean = eanDla(productId)) => {
    zasiejMapowanie(baza.sqlite, { kodImportu, dostawca: "MO1", bridgeKod: kod, productId, variantId: variantId ?? undefined });
    baza.sqlite.prepare("INSERT INTO historia_cen (kod, ean, dostawca, zarejestrowano_at) VALUES (?,?,?,'2026-09-01')").run(kod, ean, "MO1");
  };

  const przygotuj = (sklep: OpcjeAtrapy["sklep"], opcje: OpcjeAtrapy = {}) => {
    const atrapa = stworzAtrapeSelly({ sklep, ...opcje });
    return { atrapa, ...stworzDiscoveryTestowe(atrapa.klient) };
  };
  const wiersze = () => baza.sqlite.prepare("SELECT * FROM selly_usuniecia ORDER BY id").all() as WierszTabeli[];

  it("jeden wiersz na każdą usuniętą pozycję: produkt, wariant i „już nie istniał”; pominięte nie wchodzą", async () => {
    tlo();
    sierota("S1", "MO1_PRODUKT", 900, 901);
    // wspólny produkt z żywym wariantem innego dostawcy → usunięty zostaje tylko wariant
    produkt("MO2_ZYWY", "WSPOLNY");
    baza.sqlite.prepare("UPDATE products SET dostawca = 'MO2' WHERE kod = 'MO2_ZYWY'").run();
    zasiejMapowanie(baza.sqlite, { kodImportu: "WSPOLNY", dostawca: "MO2", bridgeKod: "MO2_ZYWY", productId: 910, variantId: 912 });
    sierota("WSPOLNY", "MO1_WARIANT", 910, 911);
    sierota("S3", "MO1_NIE_MA", 920, 921); // nie ma go w sklepie (404) → „już nie istniał”
    sierota("S4", "MO1_INNY_MAGAZYN", 940, 941); // pominięty — inny magazyn
    const { discovery } = przygotuj(
      [
        { product_id: 900, name: "Opona STARA 1", ean: eanDla(900), warianty: [{ variant_id: 901, features: [magazyn("MO1")] }] },
        { product_id: 910, name: "Wspólny", ean: eanDla(910), warianty: [{ variant_id: 911, features: [magazyn("MO1")] }, { variant_id: 912, features: [magazyn("MO2")] }] },
        { product_id: 940, name: "Inny magazyn", ean: eanDla(940), warianty: [{ variant_id: 941, features: [magazyn("MO5")] }] },
      ],
      { bledy: {} },
    );

    const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wynik).toMatchObject({ usuniete_produkty: 1, usuniete_warianty: 1, juz_nie_istnialo: 1, pominiete: 1 });
    const zapisane = wiersze();
    expect(zapisane.map((w) => `${w.kod}:${w.akcja}`).sort()).toEqual(
      ["MO1_NIE_MA:juz_nie_istnial", "MO1_PRODUKT:usunieto_produkt", "MO1_WARIANT:usunieto_wariant"].sort(),
    );
    const pelny = zapisane.find((w) => w.kod === "MO1_PRODUKT");
    expect(pelny).toMatchObject({
      nazwa: "Opona STARA 1",
      ean: eanDla(900),
      dostawca: "MO1",
      kod_importu: "S1",
      selly_product_id: 900,
      selly_variant_id: 901,
      akcja: "usunieto_produkt",
    });
    expect(pelny?.usunieto_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    // numer przebiegu = id wpisu w selly_sync_log tego przebiegu (grupowanie zbiorcze)
    const log = baza.sqlite.prepare("SELECT id FROM selly_sync_log WHERE operacja = 'sync_delete'").get() as { id: number };
    expect(new Set(zapisane.map((w) => w.przebieg_id))).toEqual(new Set([log.id]));
    // audit_log zostaje bez zmian: nadal jeden wpis na usuniętą pozycję
    expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM audit_log WHERE akcja = 'selly_usuniecie'").get()).toEqual({ c: 3 });
  });

  it("nie przycina historii, gdy lista w selly_sync_log.szczegoly_json przekracza 8000 znaków", async () => {
    tlo(200);
    const dlugaNazwa = "N".repeat(700);
    const sklep: NonNullable<OpcjeAtrapy["sklep"]> = [];
    for (let i = 0; i < 15; i++) {
      const id = 1000 + i;
      sierota(`D${i}`, `MO1_DLUGI_${i}`, id, id + 5000);
      sklep.push({ product_id: id, name: dlugaNazwa, ean: eanDla(id), warianty: [{ variant_id: id + 5000, features: [magazyn("MO1")] }] });
    }
    const { discovery } = przygotuj(sklep);

    const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wynik?.usuniete_produkty).toBe(15);
    const log = baza.sqlite.prepare("SELECT szczegoly_json FROM selly_sync_log WHERE operacja = 'sync_delete'").get() as { szczegoly_json: string };
    const wLogu = JSON.parse(log.szczegoly_json) as { wpisy: unknown[]; ucieto_wpisow?: number };
    expect(wLogu.ucieto_wpisow).toBeGreaterThan(0); // lista w dzienniku jest przycięta…
    expect(wLogu.wpisy.length).toBeLessThan(15);
    expect(wiersze()).toHaveLength(15); // …a historia zbiorcza ma wszystkie 15 pozycji
    expect(new Set(wiersze().map((w) => w.nazwa?.length))).toEqual(new Set([700]));
  });

  it("awaria zapisu do selly_usuniecia nie przerywa przebiegu ani nie gubi audit_log i dziennika", async () => {
    tlo();
    sierota("S1", "MO1_STARY", 900, 901);
    baza.sqlite.exec("DROP TABLE selly_usuniecia");
    const { atrapa, discovery } = przygotuj([{ product_id: 900, name: "Opona", ean: eanDla(900), warianty: [{ variant_id: 901, features: [magazyn("MO1")] }] }]);

    const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wynik?.usuniete_produkty).toBe(1);
    expect(atrapa.liczba("deleteProduct")).toBe(1);
    expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM audit_log WHERE akcja = 'selly_usuniecie'").get()).toEqual({ c: 1 });
    expect(baza.sqlite.prepare("SELECT status FROM selly_sync_log WHERE operacja = 'sync_delete'").get()).toEqual({ status: "zakonczono" });
  });

  it("błąd w Selly (nic nie usunięte) nie zostawia wierszy w historii", async () => {
    tlo();
    sierota("S1", "MO1_STARY", 900, 901);
    const { discovery } = przygotuj([], { bledy: { getProduct: new BladSelly("[Selly] HTTP 500", 500, {}) } });

    await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wiersze()).toHaveLength(0);
  });
});

describe("GET /api/selly/usuniete i /api/selly/usuniete/csv", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });
  afterEach(() => srodowisko.posprzataj());

  const wstaw = (i: number, nad: Partial<{ usunieto_at: string; nazwa: string | null; ean: string | null }> = {}) =>
    srodowisko.db.$client
      .prepare(
        `INSERT INTO selly_usuniecia (usunieto_at, przebieg_id, kod, nazwa, ean, dostawca, kod_importu, selly_product_id, selly_variant_id, akcja)
         VALUES (?, ?, ?, ?, ?, 'MO1', ?, ?, ?, 'usunieto_produkt')`,
      )
      .run(
        nad.usunieto_at ?? `2026-10-07 10:${String(i).padStart(2, "0")}:00`,
        7,
        `MO1_${i}`,
        "nazwa" in nad ? nad.nazwa : `Opona ${i}`,
        "ean" in nad ? nad.ean : `590000000${String(i).padStart(4, "0")}`,
        `KI${i}`,
        500 + i,
        600 + i,
      );
  const get = (sciezka: string) => request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("wymaga logowania (obie trasy)", async () => {
    expect((await request(srodowisko.app).get("/api/selly/usuniete")).status).toBe(401);
    expect((await request(srodowisko.app).get("/api/selly/usuniete/csv")).status).toBe(401);
  });

  it("pusta historia: items [] i total 0", async () => {
    const odp = await get("/api/selly/usuniete");
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ items: [], total: 0 });
  });

  it("najnowsze pierwsze, paginacja limit/offset, total = wszystkie", async () => {
    for (let i = 1; i <= 25; i++) wstaw(i);

    const strona1 = (await get("/api/selly/usuniete")).body as { items: { kod: string }[]; total: number };
    expect(strona1.total).toBe(25);
    expect(strona1.items).toHaveLength(20); // domyślny limit
    expect(strona1.items[0]?.kod).toBe("MO1_25");
    expect(strona1.items[19]?.kod).toBe("MO1_6");

    const strona2 = (await get("/api/selly/usuniete?limit=20&offset=20")).body as { items: { kod: string }[] };
    expect(strona2.items.map((w) => w.kod)).toEqual(["MO1_5", "MO1_4", "MO1_3", "MO1_2", "MO1_1"]);

    const krotka = (await get("/api/selly/usuniete?limit=3")).body as { items: unknown[] };
    expect(krotka.items).toHaveLength(3);
    // limit ponad maksimum jest obcięty do 200, a śmieci w parametrach wracają do domyślnych
    expect(((await get("/api/selly/usuniete?limit=99999")).body as { items: unknown[] }).items).toHaveLength(25);
    expect(((await get("/api/selly/usuniete?limit=abc&offset=-5")).body as { items: unknown[] }).items).toHaveLength(20);
  });

  it("wiersz ma pełny, jawny zestaw pól (kontrakt)", async () => {
    wstaw(1);
    const { items } = (await get("/api/selly/usuniete")).body as { items: Record<string, unknown>[] };
    expect(Object.keys(items[0] as object)).toEqual([
      "id", "usunieto_at", "przebieg_id", "kod", "nazwa", "ean", "dostawca", "kod_importu", "selly_product_id", "selly_variant_id", "akcja",
    ]);
  });

  it("CSV: nagłówki odpowiedzi, BOM, średnik, cudzysłowy, pola puste i cała historia (bez limitu strony)", async () => {
    for (let i = 1; i <= 25; i++) wstaw(i);
    wstaw(26, { nazwa: 'Opona "5;5" XL', ean: null });

    const odp = await get("/api/selly/usuniete/csv").buffer(true).parse((res, cb) => {
      const kawalki: Buffer[] = [];
      res.on("data", (k: Buffer) => kawalki.push(k));
      res.on("end", () => cb(null, Buffer.concat(kawalki).toString("utf8")));
    });
    expect(odp.status).toBe(200);
    expect(odp.headers["content-type"]).toContain("text/csv");
    expect(odp.headers["content-disposition"]).toMatch(/^attachment; filename=selly-usuniete-\d{4}-\d\d-\d\d\.csv$/);

    const tekst = odp.body as string;
    expect(tekst.charCodeAt(0)).toBe(0xfeff);
    const linie = tekst.slice(1).split("\n");
    expect(linie[0]).toBe("id;usunieto_at;przebieg_id;kod;nazwa;ean;dostawca;kod_importu;selly_product_id;selly_variant_id;akcja");
    expect(linie).toHaveLength(1 + 26); // nagłówek + wszystkie 26 wierszy
    expect(linie[1]).toContain(";MO1_26;"); // najnowszy pierwszy
    expect(linie[1]).toContain('"Opona ""5;5"" XL"');
    expect(linie[1]).toMatch(/;"Opona ""5;5"" XL";;MO1;/); // ean null → puste pole
  });

  it("CSV przy pustej historii zawiera BOM i wiersz nagłówka (nie sam znacznik)", async () => {
    const odp = await get("/api/selly/usuniete/csv").buffer(true).parse((res, cb) => {
      const kawalki: Buffer[] = [];
      res.on("data", (k: Buffer) => kawalki.push(k));
      res.on("end", () => cb(null, Buffer.concat(kawalki).toString("utf8")));
    });
    expect(odp.body).toBe("\uFEFFid;usunieto_at;przebieg_id;kod;nazwa;ean;dostawca;kod_importu;selly_product_id;selly_variant_id;akcja");
  });
});
