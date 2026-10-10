// Selekcja pozycji do pliku partnera i wycena (karta PARTNERZY, ticket 214 / PRT-3.1).
//
// Zasady z karty: jedna pozycja katalogu = jeden wiersz, BEZ agregacji magazynów (ten sam `kod_importu` w różnych magazynach to osobne wiersze);
// partner dostaje pozycje z wybranych magazynów, bez wykluczonych produktów i tylko od stanu minimalnego (domyślnie 2). Do pliku idą wyłącznie
// produkty `status = 'aktywny'` z dodatnią ceną zakupu. Tekst jest czyszczony (spacje na brzegach i podwójne — defekt plików wzorcowych).
// Odczyt ma JAWNĄ projekcję pól (nie `select()` całości) — nie polegamy na nazwach pól modelu ani na mapperze flag `boolean`.
//
// Wycena woła kalkulator (PRT-2.4) dla każdego kraju partnera. Pozycja, której nie da się wycenić dla kraju, dostaje `null` w tym kraju i trafia na listę
// błędów kalkulacji — o tym, czy taki wiersz wypada z pliku, decyduje szablon (jeden plik z kolumnami krajów vs plik na kraj).

import { and, asc, eq, inArray } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKraje, partnerMagazyny, partnerWykluczenia, partnerzy, products } from "../db/schema.js";
import type { Wyrazenie } from "./formula.js";
import { BladKalkulacji, obliczCene } from "./kalkulator.js";

export type PozycjaEksportu = {
  id: number;
  kod: string;
  kodImportu: string | null;
  ean: string | null;
  nazwa: string;
  marka: string;
  model: string | null;
  rozmiar: string | null;
  kategoria: string;
  dostawca: string;
  magazyn: string;
  stan: number;
  dot: string | null;
  cenaZakupu: number;
  waga: number | null;
  dlugosc: number | null;
  szerokoscPaczki: number | null;
  wysokosc: number | null;
  wagaAutoUzupelniona: boolean | null;
  wagaSzacowana: boolean | null;
};

export type WynikSelekcji = {
  pozycje: PozycjaEksportu[];
  /** Ile pozycji z wybranych magazynów odpadło i dlaczego (do logu operacji). */
  pominiete: { stanPonizejMinimum: number; wykluczone: number; bezCenyZakupu: number };
  ostrzezenia: string[];
};

/** Przycina i zwija białe znaki; pusty tekst → `null`. */
export function czysc(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

export function wybierzPozycje(db: Baza, partnerId: number): WynikSelekcji {
  const partner = db.select().from(partnerzy).where(eq(partnerzy.id, partnerId)).get();
  if (!partner) throw new Error(`Nie ma partnera o id ${partnerId}.`);
  const magazyny = db.select({ m: partnerMagazyny.magazyn }).from(partnerMagazyny).where(eq(partnerMagazyny.partnerId, partnerId)).all().map((w) => w.m);
  const wykluczone = db.select({ k: partnerWykluczenia.produktKod }).from(partnerWykluczenia).where(eq(partnerWykluczenia.partnerId, partnerId)).all().map((w) => w.k);
  const wynik: WynikSelekcji = { pozycje: [], pominiete: { stanPonizejMinimum: 0, wykluczone: 0, bezCenyZakupu: 0 }, ostrzezenia: [] };
  if (magazyny.length === 0) {
    wynik.ostrzezenia.push("Partner nie ma wybranych magazynów — plik będzie pusty.");
    return wynik;
  }

  const wiersze = db
    .select({
      id: products.id,
      kod: products.kod,
      kodImportu: products.kodImportu,
      ean: products.ean,
      nazwa: products.nazwa,
      marka: products.marka,
      model: products.model,
      rozmiar: products.rozmiar,
      kategoria: products.kategoria,
      dostawca: products.dostawca,
      magazyn: products.magazyn,
      stan: products.stan,
      dot: products.dot,
      cenaZakupu: products.cenaZakupu,
      waga: products.waga,
      dlugosc: products.dlugosc,
      szerokoscPaczki: products.szerokoscPaczki,
      wysokosc: products.wysokosc,
      wagaAutoUzupelniona: products.wagaAutoUzupelniona,
      wagaSzacowana: products.wagaSzacowana,
    })
    .from(products)
    .where(and(eq(products.status, "aktywny"), inArray(products.magazyn, magazyny)))
    .orderBy(asc(products.id))
    .all();

  const wykl = new Set(wykluczone);
  for (const w of wiersze) {
    if (wykl.has(w.kod)) wynik.pominiete.wykluczone++;
    else if (w.stan < partner.stanMin) wynik.pominiete.stanPonizejMinimum++;
    else if (!(w.cenaZakupu > 0)) wynik.pominiete.bezCenyZakupu++;
    else
      wynik.pozycje.push({
        ...w,
        kod: w.kod.trim(),
        kodImportu: czysc(w.kodImportu),
        ean: czysc(w.ean),
        nazwa: czysc(w.nazwa) ?? "",
        marka: czysc(w.marka) ?? "",
        model: czysc(w.model),
        rozmiar: czysc(w.rozmiar),
        dot: czysc(w.dot),
      });
  }
  return wynik;
}

export type WierszWyceniony = { pozycja: PozycjaEksportu; ceny: Record<string, number | null> };
export type WynikWyceny = {
  wiersze: WierszWyceniony[];
  bledy: { kod: string; kraj: string; powod: string }[];
  ostrzezenia: string[];
};

/**
 * Wycenia pozycje dla każdego kraju partnera. `kursy`: kurs PLN/EUR na kraj (z `kursEur`, raz na plik).
 * `formuly`: opcjonalne skompilowane formuły ceny per kraj (domyślnie formuła kalkulatora).
 */
export function wycenPozycje(
  db: Baza,
  partnerId: number,
  pozycje: PozycjaEksportu[],
  kursy: Readonly<Record<string, number>>,
  data: string,
  formuly: Readonly<Record<string, Wyrazenie>> = {},
): WynikWyceny {
  const partner = db.select().from(partnerzy).where(eq(partnerzy.id, partnerId)).get();
  if (!partner) throw new Error(`Nie ma partnera o id ${partnerId}.`);
  const kraje = db.select().from(partnerKraje).where(eq(partnerKraje.partnerId, partnerId)).orderBy(asc(partnerKraje.kraj)).all();
  const wynik: WynikWyceny = { wiersze: [], bledy: [], ostrzezenia: [] };
  const ostrzezeniaWidziane = new Set<string>();
  for (const pozycja of pozycje) {
    const ceny: Record<string, number | null> = {};
    for (const k of kraje) {
      try {
        const kurs = kursy[k.kraj];
        if (kurs === undefined) throw new BladKalkulacji(pozycja.kod, `Brak kursu EUR dla kraju ${k.kraj}.`);
        const w = obliczCene(db, {
          pozycja,
          kraj: { kraj: k.kraj, narzutProc: k.narzutProc, kosztyDodatkowe: k.kosztyDodatkowe },
          zaokraglanie: partner.zaokraglanie,
          kurs,
          data,
          formula: formuly[k.kraj],
        });
        ceny[k.kraj] = w.cenaEur;
        for (const o of w.ostrzezenia) {
          if (ostrzezeniaWidziane.has(o)) continue;
          ostrzezeniaWidziane.add(o);
          wynik.ostrzezenia.push(o);
        }
      } catch (e) {
        if (!(e instanceof BladKalkulacji)) throw e;
        ceny[k.kraj] = null;
        wynik.bledy.push({ kod: pozycja.kod, kraj: k.kraj, powod: e.powod });
      }
    }
    wynik.wiersze.push({ pozycja, ceny });
  }
  return wynik;
}

