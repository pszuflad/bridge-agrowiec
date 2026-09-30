/**
 * Ticket 168-FEATURE-uzupelnianie-ean-999 — reguła uzupełniania pustych EAN-ów (prefiks 999)
 * i tabela par kod↔EAN. Prawdziwy SQLite w katalogu tymczasowym, bez mocków.
 */
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { eanPary, products } from "../src/db/schema.js";
import { cyfraKontrolnaEan13, eanZNumeru, pustyEan } from "../src/ean-pary/generator.js";
import {
  przydzielEan,
  uzupelnijEanRekordu,
  uzupelnijKatalog,
  znajdzParePoKodzie,
} from "../src/ean-pary/uzupelnianie.js";
import { dodajProduktyBulk } from "../src/import/bulk.js";
import { poprawnaSumaKontrolnaEan13 } from "../src/import/silnik/ean.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

type NowyProdukt = typeof products.$inferInsert;

function produkt(nadpisania: Partial<NowyProdukt> & { kod: string }): NowyProdukt {
  return {
    nazwa: "OPONA TESTOWA",
    marka: "MITAS",
    kategoria: "Rolnicze",
    dostawca: "MO1",
    magazyn: "0",
    stan: 1,
    cenaZakupu: 100,
    cenaSprzedazy: 150,
    marzaPct: 50,
    dataAktualizacji: "2026-09-30T00:00:00.000Z",
    ...nadpisania,
  };
}

describe("generator EAN 999", () => {
  it("daje poprawny EAN-13 z prefiksem 999 i cyfrą kontrolną", () => {
    for (const n of [1, 2, 99, 123456789, 999999999]) {
      const ean = eanZNumeru(n);
      expect(ean).toMatch(/^999\d{10}$/);
      expect(poprawnaSumaKontrolnaEan13(ean)).toBe(true);
    }
    expect(eanZNumeru(1)).toBe("999000000001" + cyfraKontrolnaEan13("999000000001"));
  });

  it("odrzuca numer spoza zakresu", () => {
    expect(() => eanZNumeru(0)).toThrow();
    expect(() => eanZNumeru(1_000_000_000)).toThrow();
  });

  it("pustyEan: NULL, pusty tekst i białe znaki", () => {
    expect(pustyEan(null)).toBe(true);
    expect(pustyEan("  ")).toBe(true);
    expect(pustyEan("5901234123457")).toBe(false);
  });
});

describe("tabela par i uzupełnianie", () => {
  let baza: TestowaBaza;
  let db: Baza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    db = baza.db;
  });
  afterEach(() => baza.posprzataj());

  it("1000 produktów bez EAN dostaje 1000 różnych poprawnych EAN-ów 999…", () => {
    db.insert(products)
      .values(Array.from({ length: 1000 }, (_, i) => produkt({ kod: `MO1_${i}` })))
      .run();
    const wynik = uzupelnijKatalog(db);
    expect(wynik.uzupelniono).toBe(1000);
    const eany = db.select({ ean: products.ean }).from(products).all().map((p) => p.ean!);
    expect(new Set(eany).size).toBe(1000);
    expect(eany.every((e) => e.startsWith("999") && poprawnaSumaKontrolnaEan13(e))).toBe(true);
    expect(db.select().from(eanPary).all()).toHaveLength(1000);
  });

  it("nie rusza produktów z EAN-em, dotyczy tylko pustych (NULL, '' i spacje)", () => {
    db.insert(products)
      .values([
        produkt({ kod: "A", ean: "5901234123457" }),
        produkt({ kod: "B", ean: null }),
        produkt({ kod: "C", ean: "" }),
        produkt({ kod: "D", ean: "   " }),
      ])
      .run();
    const wynik = uzupelnijKatalog(db);
    expect(wynik.uzupelniono).toBe(3);
    const a = db.select().from(products).where(eq(products.kod, "A")).get()!;
    expect(a.ean).toBe("5901234123457");
    expect(znajdzParePoKodzie(db, "A")).toBeNull();
  });

  it("dry_run nic nie zapisuje", () => {
    db.insert(products).values(produkt({ kod: "B" })).run();
    const wynik = uzupelnijKatalog(db, { dryRun: true });
    expect(wynik).toMatchObject({ dryRun: true, uzupelniono: 1 });
    expect(db.select().from(eanPary).all()).toHaveLength(0);
    expect(db.select().from(products).get()!.ean).toBeNull();
  });

  it("jest idempotentne: ten sam kod dostaje ten sam EAN", () => {
    const a = przydzielEan(db, { kod: "X" });
    const b = przydzielEan(db, { kod: "X" });
    expect(b.ean).toBe(a.ean);
    expect(a.utworzono).toBe(true);
    expect(b.utworzono).toBe(false);
  });

  it("pomija numer, którego EAN już nosi inny produkt w katalogu", () => {
    db.insert(products).values(produkt({ kod: "REAL", ean: eanZNumeru(1) })).run();
    const { ean } = przydzielEan(db, { kod: "NOWY" });
    expect(ean).toBe(eanZNumeru(2));
  });

  it("prawdziwy EAN z importu zastępuje wygenerowany; numer nie wraca do obiegu", () => {
    db.insert(products).values(produkt({ kod: "P" })).run();
    uzupelnijKatalog(db);
    const wygenerowany = db.select().from(products).get()!.ean!;

    db.update(products).set({ ean: "5901234123457" }).where(eq(products.kod, "P")).run();
    const wynik = uzupelnijKatalog(db);
    expect(wynik.zastapiono).toBe(1);
    const para = znajdzParePoKodzie(db, "P")!;
    expect(para).toMatchObject({ status: "zastapiony", zastapionyPrzez: "5901234123457" });

    // Kolejny produkt nie dostaje numeru zastąpionej pary.
    expect(przydzielEan(db, { kod: "Q" }).ean).not.toBe(wygenerowany);
  });

  it("uzupelnijEanRekordu: pusty dostaje EAN z pary (także po wyczyszczeniu katalogu)", () => {
    const pierwszy: Record<string, unknown> = { kod: "Z", ean: null };
    uzupelnijEanRekordu(db, pierwszy);
    expect(String(pierwszy.ean)).toMatch(/^999/);

    // „clear": produktu nie ma, para zostaje — ponowny import daje ten sam EAN.
    const drugi: Record<string, unknown> = { kod: "Z", ean: "" };
    uzupelnijEanRekordu(db, drugi);
    expect(drugi.ean).toBe(pierwszy.ean);
    expect(drugi).toMatchObject({ eanIsValid: 1, eanSourceStatus: "ok" });
  });

  it("dodajProduktyBulk (import bulk / POST /api/products) uzupełnia pusty EAN", () => {
    dodajProduktyBulk(
      db,
      [
        { ...produkt({ kod: "B1" }), ean: null },
        { ...produkt({ kod: "B2" }), ean: "5901234123457" },
      ],
      { uzupelnijEan: true },
    );
    const b1 = db.select().from(products).where(eq(products.kod, "B1")).get()!;
    const b2 = db.select().from(products).where(eq(products.kod, "B2")).get()!;
    expect(b1.ean).toMatch(/^999\d{10}$/);
    expect(b2.ean).toBe("5901234123457");
  });

  it("bulk bez klucza `ean` NIE nadpisuje prawdziwego EAN-u istniejącego produktu", () => {
    db.insert(products).values(produkt({ kod: "IST", ean: "5901234123457" })).run();
    dodajProduktyBulk(db, [{ ...produkt({ kod: "IST" }) }, { ...produkt({ kod: "IST" }), ean: null }], {
      uzupelnijEan: true,
    });
    expect(db.select().from(products).where(eq(products.kod, "IST")).get()!.ean).toBe(
      "5901234123457",
    );
    expect(znajdzParePoKodzie(db, "IST")).toBeNull();
  });

  it("baza nie pozwala na duplikat EAN ani kodu w tabeli par", () => {
    przydzielEan(db, { kod: "K1" });
    const p = znajdzParePoKodzie(db, "K1")!;
    expect(() =>
      db
        .insert(eanPary)
        .values({ kod: "K2", ean: p.ean, numer: 999, utworzono: "x" })
        .run(),
    ).toThrow();
  });
});

describe("trasy /api/ean-pary", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
    srodowisko.db.insert(products).values(produkt({ kod: "T1" })).run();
    srodowisko.db.insert(products).values(produkt({ kod: "T2", ean: "5901234123457" })).run();
  });
  afterEach(() => srodowisko.posprzataj());

  const get = (u: string) =>
    request(srodowisko.app).get(u).set("Authorization", `Bearer ${token}`);
  const post = (u: string, cialo: object) =>
    request(srodowisko.app).post(u).set("Authorization", `Bearer ${token}`).send(cialo);

  it("wymaga logowania", async () => {
    expect((await request(srodowisko.app).get("/api/ean-pary")).status).toBe(401);
  });

  it("generuj → po-kodzie → po-ean działa w obie strony", async () => {
    expect((await get("/api/ean-pary/po-kodzie/T1")).body).toMatchObject({ maEan: false, ean: null });

    const gen = await post("/api/ean-pary/generuj", { kod: "T1" });
    expect(gen.status).toBe(200);
    const ean = gen.body.ean as string;
    expect(ean).toMatch(/^999\d{10}$/);
    expect(gen.body).toMatchObject({ utworzono: true, zrodlo: "wygenerowany" });

    const poKodzie = await get("/api/ean-pary/po-kodzie/T1");
    expect(poKodzie.body).toMatchObject({ maEan: true, ean, zrodlo: "wygenerowany" });
    const poEanie = await get(`/api/ean-pary/po-ean/${ean}`);
    expect(poEanie.body).toMatchObject({ ean, kod: "T1" });

    const ponownie = await post("/api/ean-pary/generuj", { kod: "T1" });
    expect(ponownie.body).toMatchObject({ ean, utworzono: false });
  });

  it("generuj nie zmienia produktu z istniejącym EAN; 400 i 404", async () => {
    const odp = await post("/api/ean-pary/generuj", { kod: "T2" });
    expect(odp.body).toMatchObject({ ean: "5901234123457", utworzono: false, zrodlo: "katalog" });
    expect((await get("/api/ean-pary/po-ean/5901234123457")).body.kod).toBe("T2");
    expect((await post("/api/ean-pary/generuj", {})).status).toBe(400);
    expect((await post("/api/ean-pary/generuj", { kod: "NIE-MA" })).status).toBe(404);
  });

  it("uzupelnij: dry_run nie-logiczny daje 400 i niczego nie zapisuje", async () => {
    expect((await post("/api/ean-pary/uzupelnij", { dry_run: "true" })).status).toBe(400);
    expect((await post("/api/ean-pary/uzupelnij", { dry_run: 1 })).status).toBe(400);
    expect((await get("/api/ean-pary")).body.lacznie).toBe(0);
  });

  it("uzupelnij: dry_run liczy, zwykłe wywołanie zapisuje, lista zwraca pary", async () => {
    const proba = await post("/api/ean-pary/uzupelnij", { dry_run: true });
    expect(proba.body).toMatchObject({ dry_run: true, uzupelniono: 1 });
    expect((await get("/api/ean-pary")).body.lacznie).toBe(0);

    const wlasciwe = await post("/api/ean-pary/uzupelnij", {});
    expect(wlasciwe.body).toMatchObject({ dry_run: false, uzupelniono: 1 });
    const lista = await get("/api/ean-pary");
    expect(lista.body.lacznie).toBe(1);
    expect(lista.body.pary[0]).toMatchObject({ kod: "T1", status: "aktywny" });
  });
});
