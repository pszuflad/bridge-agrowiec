// Konfiguracja startowa partnerów B2B (karta PARTNERZY, ticket 237) — decyzje użytkowniczki z 2026-10-12
// (docs/karty/PARTNERZY/wejscie-odpowiedzi-2026-10-12.md). Uruchamiana RAZ jako krok wdrożenia.
//
// Zasada: UZUPEŁNIA tylko to, czego partner jeszcze nie ma (magazyny, kraje, kolumny, nazwa pliku); niczego nie nadpisuje, bo użytkowniczka
// mogła już coś ustawić w panelu. Kraje powstają z NARZUTEM 0 % — dopóki nie ustawi narzutu w panelu, generator ich nie publikuje (blokada ticketu 235),
// więc aktywacja partnerów nie wypuszcza cen zakupu. Przesyłka: stały koszt 15 EUR za przesyłkę (przyjęty do poprawienia w panelu).

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKolumny, partnerKraje, partnerMagazyny, partnerzy } from "../db/schema.js";
import { dodajPartnera, dostepneMagazyny, edytujPartnera, ustawAktywnosc, ustawKraj, ustawMagazyny } from "../repos/partnerzy.js";
import { zapiszKolumny, type KolumnaWejscie } from "../repos/partnerzy-kolumny.js";

export const WYKLUCZONE_MAGAZYNY = ["MO6", "MO7", "MO8"] as const;
export const PRZESYLKA_STALA_EUR = 15;

const kat = (nazwaWPliku: string, zrodlo: string): KolumnaWejscie => ({ nazwaWPliku, zrodloTyp: "katalog", zrodlo });
const cena = (nazwaWPliku: string, kraj: string): KolumnaWejscie => ({ nazwaWPliku, zrodloTyp: "cena", zrodlo: kraj });

type Szablon = { nazwa: string; nazwaPliku: string; kraje: string[]; kolumny: KolumnaWejscie[] };

const KRAJE_ADTYRES = ["AT", "BE", "CZ", "DE", "FR", "HU", "IT", "LT", "LU", "LV", "NL", "RO", "SK"];
const KRAJE_TYREWORLD = ["FR", "DE", "NL", "BE", "AT", "IT"];

// Układ kolumn jak w dotychczasowych plikach (bez końcowych spacji w nagłówkach — niewymagane). `MfrCode` z pliku TyreWorld pominięta: źródło w katalogu nieznane.
export const SZABLONY: Szablon[] = [
  {
    nazwa: "Adtyres",
    nazwaPliku: "adtyres_agrowiec",
    kraje: KRAJE_ADTYRES,
    kolumny: [
      kat("CatNumber", "numerPartnera"), kat("EAN", "ean"), kat("ProductName", "nazwa"), kat("ProductBrand", "marka"), kat("ProductModel", "model"),
      kat("ProductSize", "rozmiar"), cena("PriceEurNet", KRAJE_ADTYRES[0]!), kat("StockQty", "stan"), kat("DOT", "dot"), kat("Warehouse", "magazyn"),
    ],
  },
  {
    nazwa: "TyreWorld",
    nazwaPliku: "tyreworld_agrowiec",
    kraje: KRAJE_TYREWORLD,
    kolumny: [
      kat("CatNumber", "numerPartnera"), kat("EAN", "ean"), kat("ProductName", "nazwa"), kat("ProductBrand", "marka"), kat("ProductModel", "model"),
      kat("ProductSize", "rozmiar"), kat("StockQty", "stan"), kat("DOT", "dot"), ...KRAJE_TYREWORLD.map((k) => cena(`${k} euro nett`, k)),
    ],
  },
];

/**
 * Uzupełnia konfigurację obu partnerów i ich aktywuje. Zwraca opis do `kroki_wdrozenia.wynik` albo `{ odloz }`, gdy katalog jest pusty
 * (brak magazynów do wskazania — krok wykona się przy następnym wdrożeniu). Aktywacja tylko wtedy, gdy żaden kraj partnera nie ma jeszcze
 * narzutu > 0 (użytkowniczka nie zaczęła konfiguracji — jeśli już ustawiła narzuty i zostawiła partnera nieaktywnym, to jej decyzja).
 */
export function ustawKonfiguracjeStartowa(db: Baza): string | { odloz: string } {
  const magazyny = dostepneMagazyny(db).map((m) => m.magazyn).filter((m) => !(WYKLUCZONE_MAGAZYNY as readonly string[]).includes(m));
  if (magazyny.length === 0) return { odloz: "katalog nie ma jeszcze aktywnych pozycji w magazynach spoza MO6/MO7/MO8 — brak magazynów do przypisania" };
  const wyniki: string[] = [];
  for (const s of SZABLONY) {
    let p = db.select().from(partnerzy).where(eq(partnerzy.nazwa, s.nazwa)).get();
    if (!p) {
      const id = dodajPartnera(db, { nazwa: s.nazwa });
      p = db.select().from(partnerzy).where(eq(partnerzy.id, id!)).get()!;
    }
    const opis: string[] = [];
    if (p.nazwaPliku === null) {
      edytujPartnera(db, p.id, { nazwaPliku: s.nazwaPliku });
      opis.push("nazwa pliku");
    }
    if (db.select().from(partnerMagazyny).where(eq(partnerMagazyny.partnerId, p.id)).all().length === 0 && magazyny.length > 0) {
      ustawMagazyny(db, p.id, magazyny);
      opis.push(`${magazyny.length} magazynów`);
    }
    const istniejace = new Set(db.select().from(partnerKraje).where(eq(partnerKraje.partnerId, p.id)).all().map((k) => k.kraj));
    const nowe = s.kraje.filter((k) => !istniejace.has(k));
    for (const k of nowe) ustawKraj(db, p.id, k, { narzutProc: 0, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 0, przesylkaStalaEur: PRZESYLKA_STALA_EUR, mytoEur: 0, pakowanieEur: 0 });
    if (nowe.length) opis.push(`${nowe.length} krajów (narzut 0 % do ustawienia)`);
    if (db.select().from(partnerKolumny).where(eq(partnerKolumny.partnerId, p.id)).all().length === 0) {
      zapiszKolumny(db, p.id, s.kolumny);
      opis.push("kolumny");
    }
    const skonfigurowana = db.select().from(partnerKraje).where(eq(partnerKraje.partnerId, p.id)).all().some((k) => k.narzutProc > 0);
    if (!p.aktywny && !skonfigurowana) {
      ustawAktywnosc(db, p.id, true);
      opis.push("aktywowany");
    }
    wyniki.push(`${s.nazwa}: ${opis.length ? opis.join(", ") : "bez zmian"}`);
  }
  return wyniki.join("; ");
}

/**
 * Naprawa wyboru „magazynów” partnerów po błędzie z 2026-10-12 (krok 237 wziął nazwy FIZYCZNYCH magazynów z `products.magazyn`, a trzeba kodów dostawców MO1, MO2…
 * z `products.dostawca`). Partner, którego zapisane magazyny zawierają cokolwiek spoza kodów dostawców katalogu, dostaje komplet dostawców bez MO6/MO7/MO8;
 * partner z poprawnym wyborem (choćby zmienionym w panelu) zostaje nietknięty. Idempotentne.
 */
export function naprawMagazynyDostawcow(db: Baza): string | { odloz: string } {
  const dostawcy = dostepneMagazyny(db).map((m) => m.magazyn);
  const docelowe = dostawcy.filter((m) => !(WYKLUCZONE_MAGAZYNY as readonly string[]).includes(m));
  if (docelowe.length === 0) return { odloz: "katalog nie ma jeszcze aktywnych pozycji z dostawcami — brak czego przypisać" };
  const wyniki: string[] = [];
  for (const nazwa of ["Adtyres", "TyreWorld"]) {
    const p = db.select().from(partnerzy).where(eq(partnerzy.nazwa, nazwa)).get();
    if (!p) continue;
    const obecne = db.select().from(partnerMagazyny).where(eq(partnerMagazyny.partnerId, p.id)).all().map((m) => m.magazyn);
    if (obecne.length > 0 && obecne.every((m) => dostawcy.includes(m))) {
      wyniki.push(`${nazwa}: wybór poprawny, bez zmian`);
      continue;
    }
    ustawMagazyny(db, p.id, docelowe);
    wyniki.push(`${nazwa}: ${docelowe.length} dostawców (${docelowe.join(", ")})`);
  }
  return wyniki.join("; ");
}
