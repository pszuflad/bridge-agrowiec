// „DA” (wada kosmetyczna) przez cały łańcuch importu: parser MO1 → silnik → staging.
// DA ma być na końcu nazwy, nie w modelu/bieżniku; poprawka Marty (`manual_overrides`) wygrywa.
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { podpiszToken } from "../src/auth/jwt.js";
import { manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { SEKRET_TESTOWY, stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const CENNIK = Buffer.from(
  "DA-1;5901234123457;BKT;Opona 480 / 70 R 28, Agrimax RT 765 DA;150 D, TL;BKT;1;1000,00;0,00;\n",
  "utf-8",
);

describe("oznaczenie DA — import do stagingu", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    token = podpiszToken(srodowisko.uzytkownik, SEKRET_TESTOWY);
  });
  afterEach(() => srodowisko.posprzataj());

  const zaimportuj = () =>
    request(srodowisko.app)
      .post("/api/import/parse-file?dostawcaKod=MO1&nazwa=da.csv")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(CENNIK);
  const wiersz = () => srodowisko.db.select().from(stagingItems).all()[0] as unknown as Record<string, unknown>;

  it("DA zostaje na końcu nazwy, model i bieżnik są bez DA", async () => {
    expect((await zaimportuj()).status).toBe(200);
    const w = wiersz();
    const snap = JSON.parse(String(w.snapshotJson));
    expect(String(w.nazwa)).toMatch(/ DA$/);
    expect(String(w.nazwa).match(/\bDA\b/g)).toHaveLength(1);
    expect(snap.model).not.toMatch(/\bDA\b/);
    expect(snap.bieznik ?? "").not.toMatch(/\bDA\b/);
  });

  it("poprawka Marty `nazwa` wygrywa z regułą DA (karta już w katalogu)", async () => {
    await zaimportuj();
    const snap = JSON.parse(String(wiersz().snapshotJson));
    // Karta w katalogu pod tym samym kodem, żeby import szedł ścieżką dopasowania i nakładał poprawki.
    srodowisko.db.delete(stagingItems).run();
    srodowisko.db
      .insert(products)
      .values({
        kod: String(snap.kod),
        dostawca: "MO1",
        nazwa: "STARA NAZWA",
        marka: "BKT",
        model: "AGRIMAX RT 765",
        rozmiar: "480/70R28",
        ean: "5901234123457",
        eanIsValid: 1,
        indeksNosnosci: "150",
        indeksPredkosci: "D",
        kategoria: "Rolnicze",
        magazyn: "PL",
        magazynRaw: "PL",
        stan: 4,
        cenaZakupu: 500,
        cenaSprzedazy: 650,
        marzaPct: 30,
        vat: 23,
        status: "aktywny",
        dataAktualizacji: "2026-01-01T00:00:00.000Z",
        nieobecnoscPodRzad: 0,
        dot: "nie starsza niz 3 lata",
        konstrukcja: "Radialna",
        tlTt: "TL",
      } as typeof products.$inferInsert)
      .run();
    srodowisko.db
      .insert(manualOverrides)
      .values({
        supplierKod: "MO1",
        supplierProductId: String(snap.kod),
        fieldName: "nazwa",
        overrideValue: "NAZWA MARTY",
        createdAt: "2026-10-06T00:00:00.000Z",
      } as never)
      .run();

    await zaimportuj();

    const w = wiersz();
    expect(w, "import powinien dać pozycję do stagingu").toBeDefined();
    expect(w.nazwa).toBe("NAZWA MARTY");
  });
});
