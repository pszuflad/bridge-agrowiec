// Szablon CSV cennika partnera (karta PARTNERZY, ticket 215 / PRT-3.2).
//
// Struktura pliku jest ustawiana przez zarządcę Bridge w `partner_kolumny` (kolejność, nazwa w pliku, źródło), nie przez partnera.
// Źródło kolumny (`zrodlo_typ`): `katalog` – pole pozycji (np. `ean`, `stan`), `cena` – cena EUR dla kraju (np. `FR`),
// `pole` – własne pole obliczeniowe z `partner_pola_obliczeniowe` (formuła; zmienne: zakup, stan, waga, dlugosc, szerokosc_paczki,
// wysokosc oraz `cena_<KRAJ>` dla krajów partnera). Format: UTF-8, LF, bez BOM, separator z ustawień partnera, nagłówek w pierwszym wierszu.
//
// Dwa układy (z plików wzorcowych): `kolumny-krajow` – jeden plik, kolumna ceny na kraj (TyreWorld); wiersz wypada tylko, gdy NIE MA ceny w żadnym
// kraju, brakująca cena to pusta komórka. `plik-na-kraj` – osobny plik na kraj (Adtyres); wiersz bez ceny w tym kraju wypada.

import { asc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKolumny, partnerPolaObliczeniowe } from "../db/schema.js";
import { BladFormuly, obliczFormule, parsujFormule, sprawdzFormule, type Wyrazenie } from "./formula.js";
import type { PozycjaEksportu, WierszWyceniony } from "./selekcja.js";

/** Pola pozycji, które wolno wskazać jako źródło kolumny `katalog`. */
export const POLA_KATALOGU = [
  "kod", "kodImportu", "ean", "nazwa", "marka", "model", "rozmiar", "kategoria", "dostawca", "magazyn", "stan", "dot",
  "waga", "dlugosc", "szerokoscPaczki", "wysokosc",
] as const satisfies readonly (keyof PozycjaEksportu)[];
export type PoleKatalogu = (typeof POLA_KATALOGU)[number];

const ZMIENNE_POLA = ["zakup", "stan", "waga", "dlugosc", "szerokosc_paczki", "wysokosc"] as const;

export type KolumnaPliku =
  | { nazwa: string; typ: "katalog"; pole: PoleKatalogu }
  | { nazwa: string; typ: "cena"; kraj: string }
  | { nazwa: string; typ: "pole"; pole: string; formula: Wyrazenie };

export type UkladCsv = "kolumny-krajow" | "plik-na-kraj";
export type WynikCsv = {
  tekst: string;
  liczbaWierszy: number;
  /** Wiersze, które wypadły z pliku, bo nie miały ceny. */
  pominiete: number;
  /** Błędy liczenia pól obliczeniowych (komórka zostaje pusta). */
  bledy: { kod: string; kolumna: string; powod: string }[];
};

/** Wczytuje i kompiluje kolumny partnera. Rzuca `BladFormuly` przy niepoprawnym źródle lub formule (błąd konfiguracji). */
export function wczytajKolumny(db: Baza, partnerId: number, krajePartnera: readonly string[]): KolumnaPliku[] {
  const pola = new Map(db.select().from(partnerPolaObliczeniowe).where(eq(partnerPolaObliczeniowe.partnerId, partnerId)).all().map((p) => [p.nazwa, p.formula]));
  const dozwolone = new Set<string>([...ZMIENNE_POLA, ...krajePartnera.map((k) => `cena_${k}`)]);
  return db
    .select()
    .from(partnerKolumny)
    .where(eq(partnerKolumny.partnerId, partnerId))
    .orderBy(asc(partnerKolumny.pozycja))
    .all()
    .map((k): KolumnaPliku => {
      const nazwa = k.nazwaWPliku.trim();
      if (nazwa === "") throw new BladFormuly(`Kolumna ${k.pozycja}: pusta nazwa w pliku.`);
      if (k.zrodloTyp === "katalog") {
        if (!(POLA_KATALOGU as readonly string[]).includes(k.zrodlo)) throw new BladFormuly(`Kolumna „${nazwa}”: nieznane pole katalogu „${k.zrodlo}”.`);
        return { nazwa, typ: "katalog", pole: k.zrodlo as PoleKatalogu };
      }
      if (k.zrodloTyp === "cena") {
        if (!krajePartnera.includes(k.zrodlo)) throw new BladFormuly(`Kolumna „${nazwa}”: partner nie ma kraju „${k.zrodlo}”.`);
        return { nazwa, typ: "cena", kraj: k.zrodlo };
      }
      if (k.zrodloTyp === "pole") {
        const tekst = pola.get(k.zrodlo);
        if (tekst === undefined) throw new BladFormuly(`Kolumna „${nazwa}”: brak pola obliczeniowego „${k.zrodlo}”.`);
        const bledy = sprawdzFormule(tekst, dozwolone);
        if (bledy.length) throw new BladFormuly(`Pole „${k.zrodlo}”: ${bledy[0]!.message}`);
        return { nazwa, typ: "pole", pole: k.zrodlo, formula: parsujFormule(tekst) };
      }
      throw new BladFormuly(`Kolumna „${nazwa}”: nieznany typ źródła „${k.zrodloTyp}”.`);
    });
}

/** Komórka tekstowa: cudzysłowy gdy trzeba + ochrona przed wstrzyknięciem formuły (`= + @` na początku → apostrof). */
function komorka(wartosc: string, separator: string): string {
  let t = wartosc.replace(/[\r\n]+/g, " ");
  if (/^[=+@\t]/.test(t)) t = `'${t}`;
  return t.includes(separator) || t.includes('"') ? `"${t.replace(/"/g, '""')}"` : t;
}

const liczbaNaTekst = (v: number): string => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6))));

/** Buduje tekst CSV. `kraj` jest wymagany w układzie `plik-na-kraj` (cena tego kraju decyduje o wypadnięciu wiersza). */
export function zbudujCsv(opcje: {
  kolumny: readonly KolumnaPliku[];
  separator: string;
  wiersze: readonly WierszWyceniony[];
  uklad: UkladCsv;
  kraj?: string;
}): WynikCsv {
  const { kolumny, separator, uklad } = opcje;
  if (uklad === "plik-na-kraj" && !opcje.kraj) throw new Error("Układ „plik-na-kraj” wymaga kraju.");
  const linie = [kolumny.map((k) => komorka(k.nazwa, separator)).join(separator)];
  const wynik: WynikCsv = { tekst: "", liczbaWierszy: 0, pominiete: 0, bledy: [] };

  for (const { pozycja: p, ceny } of opcje.wiersze) {
    const maCene = uklad === "plik-na-kraj" ? ceny[opcje.kraj!] != null : Object.values(ceny).some((c) => c != null);
    if (!maCene) {
      wynik.pominiete++;
      continue;
    }
    const zmienne: Record<string, number | null> = {
      zakup: p.cenaZakupu,
      stan: p.stan,
      waga: p.waga,
      dlugosc: p.dlugosc,
      szerokosc_paczki: p.szerokoscPaczki,
      wysokosc: p.wysokosc,
      ...Object.fromEntries(Object.entries(ceny).map(([k, c]) => [`cena_${k}`, c])),
    };
    const komorki = kolumny.map((k) => {
      if (k.typ === "katalog") {
        const v = p[k.pole];
        return typeof v === "number" ? liczbaNaTekst(v) : komorka(v ?? "", separator);
      }
      if (k.typ === "cena") {
        const c = ceny[k.kraj];
        return c == null ? "" : c.toFixed(2);
      }
      try {
        return liczbaNaTekst(obliczFormule(k.formula, zmienne));
      } catch (e) {
        if (!(e instanceof BladFormuly)) throw e;
        wynik.bledy.push({ kod: p.kod, kolumna: k.nazwa, powod: e.message });
        return "";
      }
    });
    linie.push(komorki.join(separator));
    wynik.liczbaWierszy++;
  }
  wynik.tekst = `${linie.join("\n")}\n`;
  return wynik;
}
