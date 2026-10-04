/**
 * Ticket 185 — przypisanie kategorii i zastosowania z CSV. NOWA logika biznesowa, nie port.
 * Prawdziwy SQLite (z triggerami z 011/021), bez mocków.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { products } from "../src/db/schema.js";
import {
  PRZENIESIENIA,
  paraDocelowa,
  parsujCsv,
  raportPrzypisaniaCsv,
  wierszePliku,
  zaplanujNazwy,
  zaplanujPrzypisanie,
  zastosujPrzypisanie,
} from "../src/import/migracje/przypisz-kategorie-zastosowanie.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

type NowyProdukt = typeof products.$inferInsert;
const produkt = (p: Partial<NowyProdukt> & { kod: string; nazwa: string }): NowyProdukt => ({
  marka: "BKT",
  kategoria: "Rolnicze",
  dostawca: "MO1",
  magazyn: "0",
  stan: 0,
  cenaZakupu: 1,
  cenaSprzedazy: 1,
  marzaPct: 0,
  dataAktualizacji: "2026-10-01",
  ...p,
});

describe("parsujCsv / wierszePliku", () => {
  it("obsługuje BOM, cudzysłowy z przecinkiem i CRLF", () => {
    const csv = '﻿Nazwa-produktu,Producent-opony,Rozmiar,Kategoria,Zastosowanie\r\n"A, B ""x""",BKT,1,Rolnicze,Ciągnik\r\nC,BKT,2,Leśne,Skidder\r\n';
    expect(wierszePliku(csv)).toEqual([
      { nazwa: 'A, B "x"', kategoria: "Rolnicze", zastosowanie: "Ciągnik" },
      { nazwa: "C", kategoria: "Leśne", zastosowanie: "Skidder" },
    ]);
    expect(parsujCsv("a,b\n").length).toBe(1);
  });

  it("zgłasza brak wymaganej kolumny", () => {
    expect(() => wierszePliku("Nazwa-produktu,Kategoria\nx,y\n")).toThrow(/Zastosowanie/);
  });
});

describe("paraDocelowa — tabela przeniesień (decyzje użytkownika)", () => {
  it.each([
    ["Rolnicze", "Wózek widłowy", "Przemysłowe", "Wózek widłowy"],
    ["Rolnicze", "Ładowarka", "Przemysłowe", "Ładowarka"],
    ["Rolnicze", "Oś kierowana", "Ciężarowe", "Oś kierowana"],
    ["Rolnicze", "Forwarder/Harwester", "Leśne", "Forwarder/Harwester"],
    ["Przemysłowe", "Kosiarka/ogród", "Rolnicze", "Kosiarka/ogród"],
    ["Przemysłowe", "Oś napędowa", "Ciężarowe", "Oś napędowa"],
    ["Ciężarowe", "Przyczepa", "Ciężarowe", "Naczepa/przyczepa"],
    ["Ciężarowe", "Ciągnik", "Ciężarowe", "Oś kierowana"],
    ["Leśne", "Ciągnik", "Leśne", "Ciągnik leśny"],
    ["Leśne", "Przyczepa", "Leśne", "Uniwersalne/pozostałe"],
    ["Rolnicze", "Ciągnik", "Rolnicze", "Ciągnik"],
  ])("%s / %s → %s / %s", (k, z, k2, z2) => {
    expect(paraDocelowa(k, z)).toEqual({ kategoria: k2, zastosowanie: z2 });
  });
});

describe("zaplanujNazwy — niejednoznaczność", () => {
  it("Rolnicze Ciągnik vs Uniwersalne/pozostałe → Rolnicze / Ciągnik", () => {
    const [n] = zaplanujNazwy([
      { nazwa: "X", kategoria: "Rolnicze", zastosowanie: "Ciągnik" },
      { nazwa: "X", kategoria: "Rolnicze", zastosowanie: "Uniwersalne/pozostałe" },
    ]);
    expect(n).toEqual({ nazwa: "X", status: "ok", para: { kategoria: "Rolnicze", zastosowanie: "Ciągnik" } });
  });

  it("dwie pary, które po przeniesieniu się zrównują, są jednoznaczne (Rolnicze/Przyczepa i Przemysłowe/Przyczepa)", () => {
    const [n] = zaplanujNazwy([
      { nazwa: "Y", kategoria: "Rolnicze", zastosowanie: "Przyczepa" },
      { nazwa: "Y", kategoria: "Przemysłowe", zastosowanie: "Przyczepa" },
    ]);
    expect(n?.status).toBe("ok");
  });

  it("każda inna sprzeczność jest pomijana jako niejednoznaczna", () => {
    const [n] = zaplanujNazwy([
      { nazwa: "Z", kategoria: "Rolnicze", zastosowanie: "Kombajn" },
      { nazwa: "Z", kategoria: "Rolnicze", zastosowanie: "Opryskiwacz" },
    ]);
    expect(n?.status).toBe("niejednoznaczna");
  });
});

describe("zaplanujPrzypisanie / zastosujPrzypisanie na bazie", () => {
  let baza: TestowaBaza;
  beforeEach(() => {
    baza = stworzTestowaBaze();
  });
  afterEach(() => baza.posprzataj());

  const wiersze = [
    { nazwa: "ŁAD", kategoria: "Rolnicze", zastosowanie: "Ładowarka" },
    { nazwa: "WOZ", kategoria: "Rolnicze", zastosowanie: "Wózek widłowy" },
    { nazwa: "OK", kategoria: "Rolnicze", zastosowanie: "Ciągnik" },
    { nazwa: "RECZNY", kategoria: "Rolnicze", zastosowanie: "Ładowarka" },
    { nazwa: "SPRZ", kategoria: "Rolnicze", zastosowanie: "Kombajn" },
    { nazwa: "SPRZ", kategoria: "Rolnicze", zastosowanie: "Opryskiwacz" },
    { nazwa: "NIEMA", kategoria: "Leśne", zastosowanie: "Skidder" },
  ];

  it("przenosi pary, pomija poprawki Marty i niejednoznaczne, nie rusza zgodnych; triggery niczego nie korygują", () => {
    baza.db
      .insert(products)
      .values([
        produkt({ kod: "1", nazwa: "ŁAD" }),
        produkt({ kod: "2", nazwa: "WOZ", zastosowanie: "Uniwersalne/pozostałe" }),
        produkt({ kod: "3", nazwa: "OK", zastosowanie: "Ciągnik" }),
        produkt({ kod: "4", nazwa: "RECZNY" }),
        produkt({ kod: "5", nazwa: "SPRZ" }),
        produkt({ kod: "6", nazwa: "ŁAD", dostawca: "MO2" }),
      ])
      .run();
    baza.sqlite
      .prepare(
        "INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at) VALUES ('MO1','4','zastosowanie','Kombajn','2026-10-01')",
      )
      .run();

    const plan = zaplanujPrzypisanie(baza.sqlite, wiersze);
    expect(plan.juzZgodnych).toBe(1);
    expect(plan.niejednoznaczne.map((n) => n.nazwa)).toEqual(["SPRZ"]);
    expect(plan.nazwyBezProduktu).toEqual(["NIEMA"]);
    expect(plan.zmiany.filter((z) => z.status === "pominieta_poprawka_reczna").map((z) => z.kod)).toEqual(["4"]);

    const wynik = zastosujPrzypisanie(baza.sqlite, plan);
    expect(wynik.zapisano).toBe(3);
    expect(wynik.poprawioneTriggerem).toEqual([]);

    const stan = (kod: string) =>
      baza.sqlite.prepare("SELECT kategoria, zastosowanie FROM products WHERE kod = ?").get(kod);
    expect(stan("1")).toEqual({ kategoria: "Przemysłowe", zastosowanie: "Ładowarka" });
    expect(stan("2")).toEqual({ kategoria: "Przemysłowe", zastosowanie: "Wózek widłowy" });
    expect(stan("3")).toEqual({ kategoria: "Rolnicze", zastosowanie: "Ciągnik" });
    expect(stan("4")).toEqual({ kategoria: "Rolnicze", zastosowanie: null });
    expect(stan("5")).toEqual({ kategoria: "Rolnicze", zastosowanie: null });
    expect(stan("6")).toEqual({ kategoria: "Przemysłowe", zastosowanie: "Ładowarka" });

    const hist = baza.sqlite
      .prepare("SELECT kod_produktu, pole, stara_wartosc, nowa_wartosc, zrodlo FROM history WHERE kod_produktu = '1' ORDER BY pole")
      .all();
    expect(hist).toEqual([
      { kod_produktu: "1", pole: "kategoria", stara_wartosc: "Rolnicze", nowa_wartosc: "Przemysłowe", zrodlo: "przypisanie-kat-zast" },
      { kod_produktu: "1", pole: "zastosowanie", stara_wartosc: "", nowa_wartosc: "Ładowarka", zrodlo: "przypisanie-kat-zast" },
    ]);
    const raport = raportPrzypisaniaCsv(plan);
    expect(raport).toContain("niejednoznaczna_pominieta");
    expect(raport).toContain("brak_produktu_w_bazie");
  });

  it("drugie uruchomienie nic nie zmienia (idempotencja)", () => {
    baza.db.insert(products).values([produkt({ kod: "1", nazwa: "ŁAD" })]).run();
    zastosujPrzypisanie(baza.sqlite, zaplanujPrzypisanie(baza.sqlite, wiersze));
    const drugi = zaplanujPrzypisanie(baza.sqlite, wiersze);
    expect(drugi.zmiany).toEqual([]);
    expect(drugi.juzZgodnych).toBe(1);
  });

  it("KAŻDA para docelowa z tabeli przeniesień przechodzi przez triggery bez zmian", () => {
    const cele = new Set([...PRZENIESIENIA.values()].map((p) => `${p.kategoria}|${p.zastosowanie}`));
    let n = 0;
    for (const cel of cele) {
      const [kategoria = "", zastosowanie = ""] = cel.split("|");
      baza.sqlite
        .prepare(
          `INSERT INTO products (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy, marza_pct, data_aktualizacji, zastosowanie)
           VALUES (?, ?, 'M', ?, 'MO1', '0', 0, 1, 1, 0, '2026-10-01', ?)`,
        )
        .run(`K${n++}`, `N${n}`, kategoria, zastosowanie);
      const po = baza.sqlite.prepare("SELECT kategoria, zastosowanie FROM products WHERE kod = ?").get(`K${n - 1}`);
      expect(po, cel).toEqual({ kategoria, zastosowanie });
    }
  });
});
