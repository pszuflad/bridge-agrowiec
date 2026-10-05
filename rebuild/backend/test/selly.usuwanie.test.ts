/**
 * TOR 3 — usuwanie z Selly produktów, których nie ma już w Bridge (ticket 186, NOWA funkcja).
 *
 * ⚠ To JEST operacja kasująca w cudzym sklepie (`DELETE /api/products/...`). Testy chodzą wyłącznie po atrapie
 * klienta (`test/gate/selly-atrapa.ts`); baza — prawdziwy SQLite w katalogu tymczasowym.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { akcjeHistorii, wpisyHistorii } from "../src/historia/mapowanie.js";
import { audytDlaHistorii } from "../src/repos/audit-historia.js";
import { BladSelly } from "../src/selly/klient.js";
import { stworzHarmonogramSelly } from "../src/selly/rest/scheduler.js";
import { znajdzSieroty, usunSierotyZSelly } from "../src/selly/rest/sync-usuwanie.js";
import { stworzAtrapeSelly, stworzDiscoveryTestowe, stworzTestowaBaze, zasiejMapowanie, type OpcjeAtrapy, type TestowaBaza } from "./gate/index.js";

const magazyn = (dostawca: string) => ({ feature_id: 1, name: "Magazyny", value: dostawca });

describe("Tor 3 — usuwanie sierot z Selly", () => {
  let baza: TestowaBaza;
  beforeEach(() => {
    baza = stworzTestowaBaze();
  });
  afterEach(() => baza.posprzataj());

  const produkt = (kod: string, kodImportu: string, dostawca = "MO1", ean: string | null = null) =>
    baza.sqlite
      .prepare(
        `INSERT INTO products (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy, marza_pct, data_aktualizacji, kod_importu, ean)
         VALUES (?, ?, 'BKT', 'Rolnicze', ?, '0', 1, 1, 1, 0, '2026-10-01', ?, ?)`,
      )
      .run(kod, `Opona ${kod}`, dostawca, kodImportu, ean);

  /** Żywe produkty + mapowania — tło, żeby sierot nie było „podejrzanie dużo” (próg 30%). */
  const tlo = (n = 10) => {
    for (let i = 0; i < n; i++) {
      produkt(`ZYWY_${i}`, `Z${i}`);
      zasiejMapowanie(baza.sqlite, { kodImportu: `Z${i}`, dostawca: "MO1", bridgeKod: `ZYWY_${i}`, productId: 100 + i, variantId: 200 + i });
    }
  };

  const sierota = (kodImportu: string, kod: string, productId: number, variantId: number, dostawca = "MO1") =>
    zasiejMapowanie(baza.sqlite, { kodImportu, dostawca, bridgeKod: kod, productId, variantId });

  const przygotuj = (sklep: OpcjeAtrapy["sklep"], opcje: OpcjeAtrapy = {}) => {
    const atrapa = stworzAtrapeSelly({ sklep, ...opcje });
    return { atrapa, ...stworzDiscoveryTestowe(atrapa.klient) };
  };
  const mapowania = () => baza.sqlite.prepare("SELECT bridge_kod FROM selly_products ORDER BY id").all().map((r) => (r as { bridge_kod: string }).bridge_kod);

  it("usuwa produkt (jedyny wariant), zapisuje w Historii kod, nazwę, EAN, id w Selly i godzinę, czyści mapowanie", async () => {
    tlo();
    sierota("S1", "MO1_STARY", 900, 901);
    baza.sqlite.prepare("INSERT INTO historia_cen (kod, ean, dostawca, zarejestrowano_at) VALUES ('MO1_STARY','5901111111111','MO1','2026-09-01')").run();
    const { atrapa, discovery } = przygotuj([{ product_id: 900, name: "Opona STARA 1", ean: "5901111111111", warianty: [{ variant_id: 901, features: [magazyn("MO1")] }] }]);

    const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wynik?.usuniete_produkty).toBe(1);
    expect(atrapa.liczba("deleteProduct")).toBe(1);
    expect(atrapa.liczba("deleteVariant")).toBe(0);
    expect(mapowania()).not.toContain("MO1_STARY");

    // Widok „Historia” (audit_log): kod produktu, nazwa, EAN, identyfikatory Selly i godzina usunięcia.
    const audyt = baza.sqlite.prepare("SELECT * FROM audit_log WHERE akcja = 'selly_usuniecie'").all() as Record<string, string>[];
    expect(audyt).toHaveLength(1);
    expect(audyt[0]).toMatchObject({ encja_typ: "produkt", encja_id: "MO1_STARY", uzytkownik_imie: "System (Selly)" });
    expect(audyt[0]!.kiedy).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/);
    const szczegolyAudytu = JSON.parse(String(audyt[0]!.szczegoly_json)) as { zmiany: string[]; dostawca: string };
    expect(szczegolyAudytu.dostawca).toBe("MO1");
    expect(szczegolyAudytu.zmiany[0]).toContain("usunięto produkt");
    expect(szczegolyAudytu.zmiany[0]).toContain("Opona STARA 1 [MO1_STARY]");
    expect(szczegolyAudytu.zmiany[0]).toContain("produkt 900, wariant 901");
    expect(szczegolyAudytu.zmiany[0]).toContain("EAN 5901111111111");
    const wWidoku = wpisyHistorii(audytDlaHistorii(baza.db, akcjeHistorii("all")));
    expect(wWidoku).toHaveLength(1);
    expect(wWidoku[0]).toMatchObject({ typ: "edycja", kodProduktu: "MO1_STARY", dostawca: "MO1", liczbaPozycji: 1 });
    expect(wWidoku[0]!.zmienionePola[0]).toContain("Opona STARA 1");
    // tabeli `history` (Pulpit, cache edycji) nie ruszamy
    expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM history").get()).toEqual({ c: 0 });

    const log = baza.sqlite.prepare("SELECT * FROM selly_sync_log WHERE operacja = 'sync_delete'").get() as Record<string, string | number>;
    expect(log).toMatchObject({ status: "zakonczono", liczba_ok: 1, liczba_blad: 0 });
    const szczegoly = JSON.parse(String(log.szczegoly_json)) as { wpisy: Record<string, unknown>[] };
    expect(szczegoly.wpisy[0]).toMatchObject({ kod: "MO1_STARY", nazwa: "Opona STARA 1", ean: "5901111111111", akcja: "usunieto_produkt", selly_product_id: 900, selly_variant_id: 901 });
    expect(String(szczegoly.wpisy[0]!.czas)).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
  });

  it("produkt wspólny z żywym wariantem innego dostawcy: usuwa TYLKO wariant", async () => {
    tlo();
    produkt("MO2_ZYWY", "WSPOLNY", "MO2");
    zasiejMapowanie(baza.sqlite, { kodImportu: "WSPOLNY", dostawca: "MO2", bridgeKod: "MO2_ZYWY", productId: 910, variantId: 912 });
    sierota("WSPOLNY", "MO1_STARY", 910, 911);
    const { atrapa, discovery } = przygotuj([
      { product_id: 910, name: "Wspólny", warianty: [{ variant_id: 911, features: [magazyn("MO1")] }, { variant_id: 912, features: [magazyn("MO2")] }] },
    ]);

    const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wynik?.usuniete_warianty).toBe(1);
    expect(atrapa.liczba("deleteProduct")).toBe(0);
    expect(atrapa.sklep.get(910)?.warianty.map((w) => w.variant_id)).toEqual([912]);
    expect(mapowania()).toContain("MO2_ZYWY");
    expect(mapowania()).not.toContain("MO1_STARY");
  });

  it("NIE uznaje za sierotę: ten sam kod_importu, ten sam kod Bridge pod nowym kod_importu, ten sam EAN u dostawcy", () => {
    tlo();
    produkt("MO1_A", "KI_A");
    sierota("KI_A", "MO1_A", 930, 931); // produkt jest pod tym samym kod_importu
    produkt("MO1_B", "KI_B_NOWY");
    sierota("KI_B_STARY", "MO1_B", 932, 933); // kod Bridge żyje pod zmienionym kod_importu
    produkt("MO1_C", "KI_C", "MO1", "5902222222222");
    baza.sqlite.prepare("INSERT INTO historia_cen (kod, ean, dostawca, zarejestrowano_at) VALUES ('MO1_C_STARY','5902222222222','MO1','2026-09-01')").run();
    sierota("KI_C_STARY", "MO1_C_STARY", 934, 935); // ten sam EAN ma żywy produkt u tego dostawcy
    sierota("KI_X", "MO1_PRAWDZIWA", 936, 937); // prawdziwa sierota

    expect(znajdzSieroty(baza.db).sieroty.map((s) => s.bridge_kod)).toEqual(["MO1_PRAWDZIWA"]);
  });

  it("niezgodny magazyn albo EAN w Selly → nic nie usuwa, mapowanie zostaje, wpis jako pominięty (bez historii produktu)", async () => {
    tlo();
    sierota("S1", "MO1_STARY", 940, 941);
    sierota("S2", "MO1_STARY2", 942, 943);
    baza.sqlite.prepare("INSERT INTO historia_cen (kod, ean, dostawca, zarejestrowano_at) VALUES ('MO1_STARY2','5903333333333','MO1','2026-09-01')").run();
    const { atrapa, discovery } = przygotuj([
      { product_id: 940, name: "Inny magazyn", warianty: [{ variant_id: 941, features: [magazyn("MO5")] }] },
      { product_id: 942, name: "Inny EAN", ean: "5909999999999", warianty: [{ variant_id: 943, features: [magazyn("MO1")] }] },
    ]);

    const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wynik).toMatchObject({ pominiete: 2, usuniete_produkty: 0, usuniete_warianty: 0 });
    expect(atrapa.liczba("deleteProduct") + atrapa.liczba("deleteVariant")).toBe(0);
    expect(mapowania()).toEqual(expect.arrayContaining(["MO1_STARY", "MO1_STARY2"]));
    expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM audit_log WHERE akcja = 'selly_usuniecie'").get()).toEqual({ c: 0 });
    expect(wynik?.wpisy.map((w) => w.powod)).toEqual([expect.stringContaining("inny magazyn"), expect.stringContaining("EAN w Selly")]);
  });

  it("404 w Selly = już usunięty: sprząta mapowanie i zapisuje w historii", async () => {
    tlo();
    sierota("S1", "MO1_STARY", 950, 951);
    const { discovery } = przygotuj([], { bledy: { getProduct: new BladSelly("[Selly] HTTP 404", 404, {}) } });

    const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wynik?.juz_nie_istnialo).toBe(1);
    expect(mapowania()).not.toContain("MO1_STARY");
    const audyt = baza.sqlite.prepare("SELECT szczegoly_json FROM audit_log WHERE encja_id = 'MO1_STARY'").get() as { szczegoly_json: string };
    expect((JSON.parse(audyt.szczegoly_json) as { zmiany: string[] }).zmiany[0]).toContain("już nie istniał, usunięto mapowanie");
  });

  it("błąd HTTP innego typu: wpis „błąd”, mapowanie zostaje (kolejny przebieg ponowi)", async () => {
    tlo();
    sierota("S1", "MO1_STARY", 960, 961);
    const { discovery } = przygotuj([], { bledy: { getProduct: new BladSelly("[Selly] HTTP 500", 500, {}) } });

    const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

    expect(wynik).toMatchObject({ bledy: 1 });
    expect(mapowania()).toContain("MO1_STARY");
    expect(baza.sqlite.prepare("SELECT status FROM selly_sync_log WHERE operacja='sync_delete'").get()).toEqual({ status: "blad" });
  });

  it("limit na przebieg: kolejny przebieg domyka resztę", async () => {
    tlo(20);
    for (let i = 0; i < 4; i++) sierota(`S${i}`, `MO1_STARY${i}`, 970 + i, 980 + i);
    const { atrapa, discovery } = przygotuj(
      [0, 1, 2, 3].map((i) => ({ product_id: 970 + i, name: `S${i}`, warianty: [{ variant_id: 980 + i, features: [magazyn("MO1")] }] })),
    );

    const pierwszy = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny", limit: 3 });
    expect(pierwszy?.usuniete_produkty).toBe(3);
    const drugi = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny", limit: 3 });
    expect(drugi?.usuniete_produkty).toBe(1);
    expect(atrapa.liczba("deleteProduct")).toBe(4);
    expect(await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" })).toBeNull(); // nic do zrobienia — cichy przebieg
  });

  describe("bezpieczniki zbiorcze", () => {
    it("pusty katalog Bridge: wstrzymuje, nic nie usuwa, wpis w dzienniku najwyżej raz na kilka godzin", async () => {
      sierota("S1", "MO1_STARY", 990, 991);
      const { atrapa, discovery } = przygotuj([{ product_id: 990, warianty: [{ variant_id: 991, features: [magazyn("MO1")] }] }]);

      const a = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });
      const b = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

      expect(a?.wstrzymano).toContain("katalog Bridge jest pusty");
      expect(b).toBeNull();
      expect(atrapa.wywolania).toEqual([]);
      expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM selly_sync_log WHERE operacja='sync_delete' AND status='wstrzymano'").get()).toEqual({ c: 1 });
      expect(mapowania()).toContain("MO1_STARY");
    });

    it("zbyt duży udział sierot (>30% mapowań): wstrzymuje", async () => {
      tlo(2);
      for (let i = 0; i < 3; i++) sierota(`S${i}`, `MO1_STARY${i}`, 1000 + i, 1010 + i);
      const { atrapa, discovery } = przygotuj([]);

      const wynik = await usunSierotyZSelly(baza.db, discovery, { tryb: "pelny" });

      expect(wynik?.wstrzymano).toContain("sierot jest 3 z 5 mapowań");
      expect(atrapa.wywolania).toEqual([]);
    });

    it("tryb inny niż „pelny”: nic nie robi i nic nie zapisuje", async () => {
      tlo();
      sierota("S1", "MO1_STARY", 1020, 1021);
      const { atrapa, discovery } = przygotuj([]);
      for (const tryb of ["wylaczony", "tylko-odczyt"] as const) {
        expect(await usunSierotyZSelly(baza.db, discovery, { tryb })).toBeNull();
      }
      expect(atrapa.wywolania).toEqual([]);
      expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM selly_sync_log WHERE operacja='sync_delete'").get()).toEqual({ c: 0 });
    });
  });

  describe("harmonogram", () => {
    const uruchomTick = async (usuwanie: boolean) => {
      tlo();
      sierota("S1", "MO1_STARY", 1030, 1031);
      const { atrapa, discovery } = przygotuj([{ product_id: 1030, name: "S", warianty: [{ variant_id: 1031, features: [magazyn("MO1")] }] }]);
      const h = stworzHarmonogramSelly({ db: baza.db, discovery, tryb: "pelny", usuwanie, teraz: () => new Date(2026, 9, 5, 9, 55), interwalMs: 20 });
      h.uruchom();
      await new Promise((r) => setTimeout(r, 400));
      h.zatrzymaj();
      return atrapa;
    };

    it("po Torze 1 uruchamia usuwanie sierot", async () => {
      expect((await uruchomTick(true)).liczba("deleteProduct")).toBe(1);
    });

    it("`usuwanie: false` (SELLY_USUWANIE=false) wyłącza Tor 3, reszta synchronizacji działa", async () => {
      expect((await uruchomTick(false)).liczba("deleteProduct")).toBe(0);
    });
  });
});
