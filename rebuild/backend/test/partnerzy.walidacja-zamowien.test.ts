/** Walidacja zamówień partnera względem katalogu (ticket 232, PRT-7.4a). */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { partnerErrorLog, partnerZamowienia, partnerzy, products } from "../src/db/schema.js";
import { odbierzZamowieniaEmail } from "../src/partnerzy/odbior-email.js";
import type { OtworzSkrzynke } from "../src/partnerzy/poczta.js";
import { powodBleduPozycji, STATUS_BLAD_IMPORTU, STATUS_PRZYJETE, zwaliduj } from "../src/partnerzy/walidacja-zamowienia.js";
import { szczegolyZamowienia, zapiszZamowienie } from "../src/repos/partnerzy-zamowienia.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

type Nowy = typeof products.$inferInsert;
// XML_PRZYKLAD zamawia: 011200284 × 2 oraz „0102 00001” × 1.
const produkt = (kod: string, nadpisania: Partial<Nowy> = {}): Nowy => ({
  kod, nazwa: "OPONA", marka: "CEAT", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 10, cenaZakupu: 100, cenaSprzedazy: 150, marzaPct: 50,
  dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`, ...nadpisania,
});

describe("walidacja zamówień partnera", () => {
  let s: SrodowiskoTestowe;
  let partnerId: number;
  const wstaw = (...p: Nowy[]) => s.db.insert(products).values(p).run();

  beforeEach(async () => {
    s = await stworzSrodowiskoTestowe();
    partnerId = Number(s.db.insert(partnerzy).values({ nazwa: "TyreWorld", aktywny: true, kanalEmail: true, emailSkrzynka: "z@example.test", utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
  });
  afterEach(() => s.posprzataj());

  const zamowienie = () => zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id;

  it("powodBleduPozycji: kolejność i treść powodów", () => {
    expect(powodBleduPozycji(null, 1)).toBe("nieznany kod");
    expect(powodBleduPozycji({ kod: "A", stan: 5, status: "wycofany" }, 1)).toMatch(/nieaktywny.*wycofany/);
    expect(powodBleduPozycji({ kod: "A", stan: 1, status: "aktywny" }, 2)).toBe("brak stanu (jest 1, zamówiono 2)");
    expect(powodBleduPozycji({ kod: "A", stan: 2, status: "aktywny" }, 2)).toBeNull();
  });

  it("wszystko w katalogu i na stanie → przyjęte, bez błędów", () => {
    wstaw(produkt("011200284"), produkt("0102 00001"));
    const id = zamowienie();
    expect(zwaliduj(s.db, id)).toEqual({ status: STATUS_PRZYJETE, bledy: 0, zmieniony: true });
    const z = szczegolyZamowienia(s.db, id)!;
    expect(z).toMatchObject({ status: "przyjete", bladImportu: null });
    expect(z.pozycje.every((p) => p.blad === null)).toBe(true);
  });

  it("nieznany kod, produkt nieaktywny i brak stanu naraz → błąd importu z opisem per pozycja; zamówienie zostaje zapisane", () => {
    wstaw(produkt("011200284", { stan: 1 })); // zamówiono 2
    const id = zamowienie();
    const w = zwaliduj(s.db, id)!;
    expect(w).toMatchObject({ status: STATUS_BLAD_IMPORTU, bledy: 2 });
    const z = szczegolyZamowienia(s.db, id)!;
    expect(z.status).toBe("blad_importu");
    expect(z.pozycje.map((p) => p.blad)).toEqual(["brak stanu (jest 1, zamówiono 2)", "nieznany kod"]);
    expect(z.bladImportu).toContain("poz. 1 (011200284): brak stanu");
    expect(z.bladImportu).toContain("poz. 2 (0102 00001): nieznany kod");
  });

  it("produkt nieaktywny (status ≠ aktywny) jest błędem, nawet gdy ma stan", () => {
    wstaw(produkt("011200284", { status: "wycofany" }), produkt("0102 00001"));
    const id = zamowienie();
    zwaliduj(s.db, id);
    expect(szczegolyZamowienia(s.db, id)!.pozycje[0]!.blad).toMatch(/nieaktywny/);
  });

  it("ponowna walidacja po poprawie katalogu przywraca zamówienie (blad_importu → przyjete) i jest idempotentna", () => {
    wstaw(produkt("011200284", { stan: 0 }), produkt("0102 00001"));
    const id = zamowienie();
    expect(zwaliduj(s.db, id)!.status).toBe("blad_importu");
    expect(zwaliduj(s.db, id)).toMatchObject({ status: "blad_importu", zmieniony: false }); // bez zmian
    s.db.update(products).set({ stan: 50 }).where(eq(products.kod, "011200284")).run();
    expect(zwaliduj(s.db, id)).toEqual({ status: "przyjete", bledy: 0, zmieniony: true });
    const z = szczegolyZamowienia(s.db, id)!;
    expect(z.bladImportu).toBeNull();
    expect(z.pozycje.every((p) => p.blad === null)).toBe(true);
  });

  it("późniejsze statusy (np. wysłane do sklepu) są nietykalne", () => {
    wstaw(produkt("011200284", { stan: 0 }));
    const id = zamowienie();
    s.db.update(partnerZamowienia).set({ status: "wyslane" }).where(eq(partnerZamowienia.id, id)).run();
    expect(zwaliduj(s.db, id)).toEqual({ status: "wyslane", bledy: 0, zmieniony: false });
    expect(szczegolyZamowienia(s.db, id)!.pozycje.every((p) => p.blad === null)).toBe(true);
  });

  it("stan sprawdzany dla łącznej ilości kodu: dwie linie tego samego kodu nie mogą razem przekroczyć stanu", () => {
    wstaw(produkt("011200284", { stan: 3 }), produkt("0102 00001"));
    // 2 + 2 sztuki tego samego kodu przy stanie 3 (każda linia osobno by przeszła)
    const xml = XML_PRZYKLAD.replace("</PRODUCTS>", "<PRODUCT><CODE>011200284</CODE><NAME>drugi raz</NAME><ORDERQUANTITY>2</ORDERQUANTITY><SELL_PRICE>202.00</SELL_PRICE></PRODUCT></PRODUCTS>");
    const id = zapiszZamowienie(s.db, partnerId, xml).id;
    expect(zwaliduj(s.db, id)).toMatchObject({ status: "blad_importu", bledy: 2 });
    expect(szczegolyZamowienia(s.db, id)!.pozycje.map((p) => p.blad)).toEqual(["brak stanu (jest 3, zamówiono 4)", null, "brak stanu (jest 3, zamówiono 4)"]);
  });

  it("zachowajPrzyjete: automatyczna walidacja nie degraduje przyjętego zamówienia po zmianie stanu, ręczna może", () => {
    wstaw(produkt("011200284"), produkt("0102 00001"));
    const id = zamowienie();
    expect(zwaliduj(s.db, id)!.status).toBe("przyjete");
    s.db.update(products).set({ stan: 0 }).where(eq(products.kod, "011200284")).run();
    expect(zwaliduj(s.db, id, { zachowajPrzyjete: true })).toEqual({ status: "przyjete", bledy: 0, zmieniony: false });
    expect(szczegolyZamowienia(s.db, id)!.status).toBe("przyjete");
    expect(zwaliduj(s.db, id)).toMatchObject({ status: "blad_importu", zmieniony: true });
  });

  it("nieistniejące zamówienie → null", () => {
    expect(zwaliduj(s.db, 9999)).toBeNull();
  });

  it("kod z białymi znakami na brzegach jest dopasowany po przycięciu (zera wiodące zostają)", () => {
    wstaw(produkt("011200284"), produkt("0102 00001"));
    const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD.replace("<CODE>011200284</CODE>", "<CODE>  011200284 </CODE>")).id;
    expect(zwaliduj(s.db, id)!.status).toBe("przyjete");
  });

  describe("w odbiorze z e-maila", () => {
    it("po awarii walidacji zamówienie zostaje `nowe`, wiadomość nieprzeczytana; ponowny odbiór dokańcza walidację", async () => {
      wstaw(produkt("011200284"), produkt("0102 00001"));
      let przetworzone = 0;
      const skrzynka: OtworzSkrzynke = async () => ({
        pobierzNieprzeczytane: async () => [{
          id: "1",
          wczytaj: async () => ({ temat: "Zam", od: "p@example.test", zalaczniki: [{ nazwa: "z.xml", typ: "application/xml", tresc: Buffer.from(XML_PRZYKLAD) }] }),
          oznaczPrzetworzona: async () => void przetworzone++,
        }],
        zamknij: async () => undefined,
      });
      // awaria infrastruktury w walidacji: brakuje tabeli katalogu
      s.sqlite.exec("ALTER TABLE products RENAME TO products_tmp");
      await odbierzZamowieniaEmail(s.db, skrzynka, partnerId, { host: "imap.example.test", port: 993, haslo: () => "tajne" });
      expect(przetworzone).toBe(0);
      expect(s.db.select().from(partnerZamowienia).get()!.status).toBe("nowe");
      s.sqlite.exec("ALTER TABLE products_tmp RENAME TO products");
      await odbierzZamowieniaEmail(s.db, skrzynka, partnerId, { host: "imap.example.test", port: 993, haslo: () => "tajne" });
      expect(przetworzone).toBe(1);
      expect(s.db.select().from(partnerZamowienia).get()!.status).toBe("przyjete");
    });

    const otworz = (): OtworzSkrzynke => async () => ({
      pobierzNieprzeczytane: async () => [{
        id: "1",
        wczytaj: async () => ({ temat: "Zam", od: "p@example.test", zalaczniki: [{ nazwa: "z.xml", typ: "application/xml", tresc: Buffer.from(XML_PRZYKLAD) }] }),
        oznaczPrzetworzona: async () => undefined,
      }],
      zamknij: async () => undefined,
    });
    const USTAWIENIA = { host: "imap.example.test", port: 993, haslo: () => "tajne" };

    it("odebrane zamówienie z błędem kodu ma status blad_importu, jest zapisane, a w error_log jest ostrzeżenie (bez powiadomienia na zewnątrz)", async () => {
      const w = await odbierzZamowieniaEmail(s.db, otworz(), partnerId, USTAWIENIA);
      expect(w).toMatchObject({ nowe: 1, bledy: 0 });
      const z = s.db.select().from(partnerZamowienia).get()!;
      expect(z.status).toBe("blad_importu");
      expect(s.db.select().from(partnerErrorLog).all().map((b) => [b.poziom, b.komunikat])).toEqual([
        ["ostrzezenie", expect.stringContaining("błąd importu")],
      ]);
    });

    it("odebrane zamówienie z kompletem w katalogu ma status przyjete i nie zostawia ostrzeżenia", async () => {
      wstaw(produkt("011200284"), produkt("0102 00001"));
      await odbierzZamowieniaEmail(s.db, otworz(), partnerId, USTAWIENIA);
      expect(s.db.select().from(partnerZamowienia).get()!.status).toBe("przyjete");
      expect(s.db.select().from(partnerErrorLog).all()).toHaveLength(0);
    });
  });
});
