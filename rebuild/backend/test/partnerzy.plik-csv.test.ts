/** Szablon CSV cennika partnera (ticket 215, PRT-3.2). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { BladFormuly, parsujFormule } from "../src/partnerzy/formula.js";
import { wczytajKolumny, zbudujCsv, type KolumnaPliku } from "../src/partnerzy/plik-csv.js";
import type { PozycjaEksportu, WierszWyceniony } from "../src/partnerzy/selekcja.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const pozycja = (kod: string, nad: Partial<PozycjaEksportu> = {}): PozycjaEksportu => ({
  id: 1, kod, kodImportu: `IMP_${kod}`, ean: "5901234123457", nazwa: "Mitas AC85", marka: "MITAS", model: null, rozmiar: "600/65R38",
  kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, dot: null, cenaZakupu: 1000, waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85,
  wagaAutoUzupelniona: false, wagaSzacowana: false, ...nad,
});
const wiersz = (kod: string, ceny: Record<string, number | null>, nad: Partial<PozycjaEksportu> = {}): WierszWyceniony => ({ pozycja: pozycja(kod, nad), ceny });
const KOLUMNY: KolumnaPliku[] = [
  { nazwa: "CatNumber", typ: "katalog", pole: "kod" },
  { nazwa: "EAN", typ: "katalog", pole: "ean" },
  { nazwa: "ProductName", typ: "katalog", pole: "nazwa" },
  { nazwa: "StockQty", typ: "katalog", pole: "stan" },
  { nazwa: "FR euro nett", typ: "cena", kraj: "FR" },
  { nazwa: "DE euro nett", typ: "cena", kraj: "DE" },
];

describe("zbudujCsv", () => {
  it("jeden plik z kolumnami krajów: nagłówek, LF, bez BOM, ceny z 2 miejscami, pusta komórka dla braku ceny", () => {
    const w = zbudujCsv({ kolumny: KOLUMNY, separator: ";", uklad: "kolumny-krajow", wiersze: [wiersz("A", { FR: 123.4, DE: null }), wiersz("B", { FR: 99, DE: 88.5 })] });
    expect(w.tekst).toBe(
      "CatNumber;EAN;ProductName;StockQty;FR euro nett;DE euro nett\n" +
        "A;5901234123457;Mitas AC85;5;123.40;\n" +
        "B;5901234123457;Mitas AC85;5;99.00;88.50\n",
    );
    expect(w.tekst.charCodeAt(0)).not.toBe(0xfeff);
    expect(w.tekst).not.toContain("\r");
    expect(w).toMatchObject({ liczbaWierszy: 2, pominiete: 0 });
  });

  it("kolumny krajów: wiersz bez ceny w żadnym kraju wypada", () => {
    const w = zbudujCsv({ kolumny: KOLUMNY, separator: ";", uklad: "kolumny-krajow", wiersze: [wiersz("A", { FR: null, DE: null }), wiersz("B", { FR: 1, DE: null })] });
    expect(w).toMatchObject({ liczbaWierszy: 1, pominiete: 1 });
  });

  it("plik na kraj: wiersz bez ceny w TYM kraju wypada, reszta zostaje", () => {
    const wiersze = [wiersz("A", { FR: 10, DE: null }), wiersz("B", { FR: null, DE: 20 })];
    const de = zbudujCsv({ kolumny: [KOLUMNY[0]!, KOLUMNY[5]!], separator: ",", uklad: "plik-na-kraj", kraj: "DE", wiersze });
    expect(de.tekst).toBe("CatNumber,DE euro nett\nB,20.00\n");
    expect(de.pominiete).toBe(1);
    expect(() => zbudujCsv({ kolumny: KOLUMNY, separator: ";", uklad: "plik-na-kraj", wiersze })).toThrow(/wymaga kraju/);
  });

  it("cytuje komórki z separatorem, cudzysłowem i nową linią; chroni przed wstrzyknięciem formuły", () => {
    const w = zbudujCsv({
      kolumny: [KOLUMNY[2]!],
      separator: ";",
      uklad: "kolumny-krajow",
      wiersze: [
        wiersz("A", { FR: 1 }, { nazwa: 'Opona "XL"; 16.9' }),
        wiersz("B", { FR: 1 }, { nazwa: "=HYPERLINK(\"x\")" }),
        wiersz("C", { FR: 1 }, { nazwa: "linia1\nlinia2" }),
        wiersz("D", { FR: 1 }, { nazwa: "-20 stopni" }),
      ],
    });
    expect(w.tekst.split("\n")).toEqual([
      "ProductName",
      '"Opona ""XL""; 16.9"',
      `"'=HYPERLINK(""x"")"`,
      "linia1 linia2",
      "-20 stopni",
      "",
    ]);
  });

  it("pole obliczeniowe: formuła z danych katalogu i cen krajów; błąd formuły = pusta komórka + wpis w błędach", () => {
    const kolumny: KolumnaPliku[] = [
      { nazwa: "kod", typ: "katalog", pole: "kod" },
      { nazwa: "CenaDAP", typ: "pole", pole: "dap", formula: parsujFormule("cena_FR + 10") },
      { nazwa: "Za100", typ: "pole", pole: "x", formula: parsujFormule("cena_FR / (stan - 5)") },
    ];
    const w = zbudujCsv({ kolumny, separator: ";", uklad: "kolumny-krajow", wiersze: [wiersz("A", { FR: 90.5 })] });
    expect(w.tekst).toBe("kod;CenaDAP;Za100\nA;100.5;\n");
    expect(w.bledy).toEqual([{ kod: "A", kolumna: "Za100", powod: "Dzielenie przez zero." }]);
  });

  it("brakujące pola katalogu (null) to puste komórki, a liczby nie mają zbędnych zer", () => {
    const w = zbudujCsv({ kolumny: [{ nazwa: "dot", typ: "katalog", pole: "dot" }, { nazwa: "waga", typ: "katalog", pole: "waga" }], separator: ";", uklad: "kolumny-krajow", wiersze: [wiersz("A", { FR: 1 }, { waga: 56.5 })] });
    expect(w.tekst).toBe("dot;waga\n;56.5\n");
  });
});

describe("wczytajKolumny", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  let id: number;
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-csv-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    id = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES ('P', 'x', 'x')").run().lastInsertRowid);
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });
  const kol = (poz: number, nazwa: string, typ: string, zrodlo: string) =>
    sqlite.prepare("INSERT INTO partner_kolumny (partner_id, pozycja, nazwa_w_pliku, zrodlo_typ, zrodlo) VALUES (?, ?, ?, ?, ?)").run(id, poz, nazwa, typ, zrodlo);

  it("zwraca kolumny w kolejności pozycji, z nazwami przyciętymi (bez spacji na końcu)", () => {
    kol(2, "FR euro nett ", "cena", "FR");
    kol(1, "CatNumber", "katalog", "kod");
    sqlite.prepare("INSERT INTO partner_pola_obliczeniowe (partner_id, nazwa, formula) VALUES (?, 'dap', 'cena_FR * 1.1')").run(id);
    kol(3, "DAP", "pole", "dap");
    const k = wczytajKolumny(db, id, ["FR"]);
    expect(k.map((x) => [x.nazwa, x.typ])).toEqual([["CatNumber", "katalog"], ["FR euro nett", "cena"], ["DAP", "pole"]]);
  });

  it("odrzuca błędną konfigurację: nieznane pole, kraj spoza partnera, brak/zła formuła, zły typ", () => {
    kol(1, "X", "katalog", "haslo_hash");
    expect(() => wczytajKolumny(db, id, ["FR"])).toThrow(/nieznane pole/);
    sqlite.prepare("DELETE FROM partner_kolumny").run();
    kol(1, "X", "cena", "DE");
    expect(() => wczytajKolumny(db, id, ["FR"])).toThrow(/nie ma kraju/);
    sqlite.prepare("DELETE FROM partner_kolumny").run();
    kol(1, "X", "pole", "brak");
    expect(() => wczytajKolumny(db, id, ["FR"])).toThrow(/brak pola/);
    sqlite.prepare("INSERT INTO partner_pola_obliczeniowe (partner_id, nazwa, formula) VALUES (?, 'brak', 'kurs_EUR * 2')").run(id);
    expect(() => wczytajKolumny(db, id, ["FR"])).toThrow(/Nieznana zmienna/);
    sqlite.prepare("DELETE FROM partner_kolumny").run();
    kol(1, "X", "inny", "kod");
    expect(() => wczytajKolumny(db, id, ["FR"])).toThrow(BladFormuly);
  });
});
