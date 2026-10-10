/** Kurs EUR partnerów (ticket 210, PRT-2.1) — klient NBP zawsze atrapą, nigdy prawdziwa sieć. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import {
  BrakKursuError,
  czytajOdpowiedzNbp,
  klientNbpHttp,
  kursEur,
  ostatniUzytyKurs,
  zapiszUzytyKurs,
  type KlientNbp,
} from "../src/partnerzy/kurs-nbp.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const dzialajacy = (kurs: number, data: string): KlientNbp => ({ pobierzKursEur: async () => ({ kurs, data }) });
const zepsuty: KlientNbp = {
  pobierzKursEur: async () => {
    throw new Error("timeout");
  },
};
const nbp = { kursZrodlo: "nbp", kursReczny: null };

describe("kurs EUR partnerów", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-kurs-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("kurs ręczny nie dotyka sieci", async () => {
    const wynik = await kursEur(db, zepsuty, { kursZrodlo: "reczny", kursReczny: 4.25 });
    expect(wynik).toEqual({ kurs: 4.25, zrodlo: "reczny", dataTabeli: null, ostrzezenie: null });
  });

  it("kurs ręczny bez wartości jest błędem, nie zerem", async () => {
    await expect(kursEur(db, zepsuty, { kursZrodlo: "reczny", kursReczny: null })).rejects.toBeInstanceOf(BrakKursuError);
  });

  it("NBP: zwraca świeży kurs i zapisuje go jako rezerwę", async () => {
    const wynik = await kursEur(db, dzialajacy(4.31, "2026-10-09"), nbp);
    expect(wynik).toEqual({ kurs: 4.31, zrodlo: "nbp", dataTabeli: "2026-10-09", ostrzezenie: null });
    expect(sqlite.prepare("SELECT data, kurs FROM kursy_nbp").all()).toEqual([{ data: "2026-10-09", kurs: 4.31 }]);
  });

  it("ta sama tabela NBP pobrana drugi raz nadpisuje wiersz, nie dubluje", async () => {
    await kursEur(db, dzialajacy(4.31, "2026-10-09"), nbp);
    await kursEur(db, dzialajacy(4.32, "2026-10-09"), nbp);
    expect(sqlite.prepare("SELECT kurs FROM kursy_nbp").all()).toEqual([{ kurs: 4.32 }]);
  });

  it("awaria NBP: ostatni zapisany kurs i ostrzeżenie", async () => {
    await kursEur(db, dzialajacy(4.3, "2026-10-08"), nbp);
    await kursEur(db, dzialajacy(4.31, "2026-10-09"), nbp);
    const wynik = await kursEur(db, zepsuty, nbp);
    expect(wynik).toMatchObject({ kurs: 4.31, zrodlo: "nbp-zapisany", dataTabeli: "2026-10-09" });
    expect(wynik.ostrzezenie).toMatch(/timeout.*4\.31.*2026-10-09/);
  });

  it("awaria NBP bez żadnego zapisanego kursu rzuca błąd zamiast zgadywać", async () => {
    await expect(kursEur(db, zepsuty, nbp)).rejects.toBeInstanceOf(BrakKursuError);
  });

  it("zapisuje kurs użyty przy pliku i oddaje ostatni dla partnera i kraju", async () => {
    sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES ('P', 'x', 'x')").run();
    const kurs = await kursEur(db, dzialajacy(4.31, "2026-10-09"), nbp);
    zapiszUzytyKurs(db, { partnerId: 1, kraj: "FR", kurs, plik: "fr.csv" });
    zapiszUzytyKurs(db, { partnerId: 1, kraj: "DE", kurs: { ...kurs, kurs: 4.4 } });
    expect(ostatniUzytyKurs(db, 1, "FR")).toMatchObject({ kurs: 4.31, zrodlo: "nbp", plik: "fr.csv" });
    expect(ostatniUzytyKurs(db, 1, "IT")).toBeNull();
  });
});

describe("klient NBP (HTTP)", () => {
  const odpowiedz = { table: "A", currency: "euro", code: "EUR", rates: [{ no: "195/A/NBP/2026", effectiveDate: "2026-10-09", mid: 4.3123 }] };

  it("czyta kurs i datę z odpowiedzi API", () => {
    expect(czytajOdpowiedzNbp(odpowiedz)).toEqual({ kurs: 4.3123, data: "2026-10-09" });
  });

  it("odrzuca odpowiedź o innym kształcie lub z kursem ≤ 0", () => {
    expect(() => czytajOdpowiedzNbp({})).toThrow();
    expect(() => czytajOdpowiedzNbp({ rates: [{ mid: 0, effectiveDate: "2026-10-09" }] })).toThrow();
    expect(() => czytajOdpowiedzNbp({ rates: [{ mid: 4.3, effectiveDate: "wczoraj" }] })).toThrow();
  });

  it("używa wstrzykniętego fetch i zgłasza błąd HTTP", async () => {
    const ok = klientNbpHttp("http://nbp.test", (async () => new Response(JSON.stringify(odpowiedz))) as typeof fetch);
    expect(await ok.pobierzKursEur()).toEqual({ kurs: 4.3123, data: "2026-10-09" });
    const zly = klientNbpHttp("http://nbp.test", (async () => new Response("", { status: 503 })) as typeof fetch);
    await expect(zly.pobierzKursEur()).rejects.toThrow(/503/);
  });
});
