// Scenariusz z diagnozy „DA”: zgłoszenie już leży w stagingu → zapis poprawki Marty → kolejny import.
// Sprawdza mechanizm na sztucznej bazie; nie ustala przyczyny dla konkretnych kart produkcyjnych.
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { podpiszToken } from "../src/auth/jwt.js";
import { manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { silnikStagingu } from "../src/import/tk.js";
import { parsujBufor } from "../src/import/parsuj.js";
import { SEKRET_TESTOWY, stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const CENNIK = Buffer.from(
  "DA-1;5901234123457;BKT;Opona 480 / 70 R 28, Agrimax RT 765 DA;150 D, TL;BKT;1;1000,00;0,00;\n",
  "utf-8",
);

describe("poprawka Marty zapisana PO zgłoszeniu w stagingu", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  let kod: string;
  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    token = podpiszToken(srodowisko.uzytkownik, SEKRET_TESTOWY);
    await zaimportuj();
    kod = String(JSON.parse(String(wiersze()[0]!.snapshotJson)).kod);
    srodowisko.db.delete(stagingItems).run();
    srodowisko.db
      .insert(products)
      .values({
        kod, dostawca: "MO1", nazwa: "STARA NAZWA", marka: "BKT", model: "AGRIMAX RT 765",
        rozmiar: "480/70R28", ean: "5901234123457", eanIsValid: 1, indeksNosnosci: "150",
        indeksPredkosci: "D", kategoria: "Rolnicze", magazyn: "PL", magazynRaw: "PL", stan: 4,
        cenaZakupu: 500, cenaSprzedazy: 650, marzaPct: 30, vat: 23, status: "aktywny",
        dataAktualizacji: "2026-01-01T00:00:00.000Z", nieobecnoscPodRzad: 0,
        dot: "nie starsza niz 3 lata", konstrukcja: "Radialna", tlTt: "TL",
      } as typeof products.$inferInsert)
      .run();
    await zaimportuj(); // import 1: BEZ poprawki → zgłoszenie z „… DA”
  });
  afterEach(() => srodowisko.posprzataj());

  const zaimportuj = () =>
    request(srodowisko.app)
      .post("/api/import/parse-file?dostawcaKod=MO1&nazwa=da.csv")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(CENNIK);
  const wiersze = () => srodowisko.db.select().from(stagingItems).all() as unknown as Record<string, unknown>[];
  const poprawka = (supplierProductId: string, wartosc: string) =>
    srodowisko.db
      .insert(manualOverrides)
      .values({
        supplierKod: "MO1", supplierProductId, fieldName: "nazwa", overrideValue: wartosc,
        createdAt: new Date().toISOString(),
      } as never)
      .run();

  it("punkt wyjścia: zgłoszenie ma nazwę z DA na końcu, typ zmiana_kluczowa", () => {
    const w = wiersze();
    expect(w).toHaveLength(1);
    expect(w[0]!.typZmiany).toBe("zmiana_kluczowa");
    expect(String(w[0]!.nazwa)).toMatch(/ DA$/);
  });

  it("poprawka pod WŁAŚCIWYM kluczem + kolejny import → zgłoszenie odświeżone, jedno, z nazwą Marty", async () => {
    poprawka(kod, "NAZWA MARTY");
    await zaimportuj();
    const w = wiersze();
    expect(w).toHaveLength(1);
    expect(w[0]!.nazwa).toBe("NAZWA MARTY");
    expect(JSON.parse(String(w[0]!.snapshotJson)).nazwa).toBe("NAZWA MARTY");
  });

  it("poprawka pod INNYM kluczem (inna wielkość liter) → zgłoszenie dalej z DA", async () => {
    poprawka(kod.toLowerCase(), "NAZWA MARTY");
    await zaimportuj();
    expect(String(wiersze()[0]!.nazwa)).toMatch(/ DA$/);
  });

  const INNY = Buffer.from(
    "DA-2;5901234123464;BKT;Opona 600 / 65 R 38, Agrimax RT 600;160 D, TL;BKT;1;2000,00;0,00;\n",
    "utf-8",
  );

  it("import KOMPLETNY (parse-file) bez tej pozycji w pliku → stare zgłoszenie jest sprzątane", async () => {
    poprawka(kod, "NAZWA MARTY");
    const r = await request(srodowisko.app)
      .post("/api/import/parse-file?dostawcaKod=MO1&nazwa=inny.csv")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(INNY);
    expect(r.status).toBe(200);
    expect(wiersze().find((w) => w.kod === kod)).toBeUndefined();
  });

  it("import NIEKOMPLETNY (silnik bez meta) bez tej pozycji → stare zgłoszenie zostaje mimo poprawki", () => {
    poprawka(kod, "NAZWA MARTY");
    const { rekordy } = parsujBufor("MO1", INNY, "inny.csv");
    silnikStagingu(srodowisko.db)("MO1", rekordy, {});
    const stare = wiersze().find((w) => w.kod === kod);
    expect(stare, "stare zgłoszenie powinno zostać").toBeDefined();
    expect(String(stare!.nazwa)).toMatch(/ DA$/);
  });

  it("brak kolejnego importu → zgłoszenie bez zmian mimo poprawki", () => {
    poprawka(kod, "NAZWA MARTY");
    expect(String(wiersze()[0]!.nazwa)).toMatch(/ DA$/);
  });
});
