// Kategoria i zastosowanie przy imporcie — ticket 185-FEATURE-przypisanie-kategorii-zastosowania.
//
// ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT (decyzje użytkownika, 2026-10-04). Pliki dostawców nie niosą ani
// kategorii, ani zastosowania — parsery wpisują domyślne „Rolnicze”, a zastosowanie zostaje puste. Te dwa pola
// nadaje się w Bridge i mają zostać takie, jak nadano:
//
//  1. {@link zachowajKategorieZastosowanie} — akceptacja stagingu ISTNIEJĄCEGO produktu zapisuje cały rekord
//     (`db.update(products).set(...)`), więc domyślne „Rolnicze”/puste zastosowanie z pliku nadpisałoby
//     przypisaną wartość. Dla istniejącego produktu zostają wartości z bazy.
//  2. {@link applyKategoriaDziedziczona} — NOWY produkt dziedziczy parę po wzorze dziedziczenia wagi
//     (`dziedziczenieWagi.ts`): klucz = marka + model + rozmiar (znormalizowane kolumny), a para musi być
//     JEDNOZNACZNA — jeśli odpowiedniki mają różne pary albo nie ma żadnego, produkt dostaje to, co dziś
//     (domyślne „Rolnicze”, puste zastosowanie).
//
// W obu przypadkach poprawka Marty (`manual_overrides` na `kategoria`/`zastosowanie`) wygrywa — jej wartość
// jest nakładana na rekord (także, gdy dodano ją po imporcie i snapshot jej nie niesie).
// Dziedziczenie pomija bieżnik (klucz: marka + model + rozmiar); odpowiednik bez zastosowania nie jest
// sprzecznością, tylko brakiem danych.

import { and, eq, isNull, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { products } from "../db/schema.js";
import { poprawkiDla } from "../repos/overrides.js";
import { kluczZRekordu } from "./dziedziczenieWagi.js";

type Rekord = Record<string, unknown>;

const pusty = (v: unknown): boolean => v === null || v === undefined || String(v).trim() === "";

type PoleKategorii = "kategoria" | "zastosowanie";

function poprawkaPola(db: Baza, rekord: Rekord, pole: PoleKategorii) {
  return poprawkiDla(db, String(rekord.dostawca ?? ""), String(rekord.kod ?? "")).find(
    (p) => p.fieldName === pole,
  );
}

/**
 * Nakłada WARTOŚĆ poprawki Marty na rekord. Silnik importu robi to już na snapshocie, ale poprawka dodana
 * PO imporcie (`PUT /api/staging/{id}`) w snapshocie jej nie ma — bez tego akceptacja zapisałaby domyślne
 * „Rolnicze”. Zwraca `true`, gdy pole ma poprawkę (wtedy nic innego go nie rusza).
 */
function naloz(db: Baza, rekord: Rekord, pole: PoleKategorii): boolean {
  const poprawka = poprawkaPola(db, rekord, pole);
  if (!poprawka) return false;
  rekord[pole] = poprawka.overrideValue;
  return true;
}

/** Istniejący produkt: kategoria i zastosowanie zostają z bazy; poprawka Marty wygrywa nad bazą. */
export function zachowajKategorieZastosowanie(
  db: Baza,
  rekord: Rekord,
  istniejacy: { kategoria: string; zastosowanie: string | null },
): void {
  if (!naloz(db, rekord, "kategoria")) rekord.kategoria = istniejacy.kategoria;
  if (!naloz(db, rekord, "zastosowanie")) rekord.zastosowanie = istniejacy.zastosowanie;
}

export type OpcjeDziedziczeniaKategorii = {
  /** `true`, gdy kategorię podał użytkownik (np. ręczne dodanie) — wtedy nic nie dziedziczymy. */
  kategoriaPodana: boolean;
};

/**
 * Nowy produkt: para kategoria/zastosowanie po odpowiednikach tej samej marki, modelu i rozmiaru.
 * Zwraca `true`, gdy dziedziczenie zaszło.
 */
export function applyKategoriaDziedziczona(
  db: Baza,
  rekord: Rekord,
  opcje: OpcjeDziedziczeniaKategorii,
): boolean {
  if (opcje.kategoriaPodana || !pusty(rekord.zastosowanie)) return false;
  const maKategorie = naloz(db, rekord, "kategoria");
  const maZastosowanie = naloz(db, rekord, "zastosowanie");
  if (maKategorie || maZastosowanie) return false;
  const klucz = kluczZRekordu(rekord);
  if (!klucz || pusty(rekord.model)) return false;
  const model = String(rekord.model).trim();

  const warunki = [
    eq(products.marka, klucz.marka),
    eq(products.model, model),
    eq(products.szerokosc, klucz.szerokosc),
    klucz.profil === null ? isNull(products.profil) : eq(products.profil, klucz.profil),
    klucz.srednica === null ? isNull(products.srednica) : eq(products.srednica, klucz.srednica),
    klucz.konstrukcja === null
      ? isNull(products.konstrukcja)
      : eq(products.konstrukcja, klucz.konstrukcja),
    sql`${products.zastosowanie} IS NOT NULL AND TRIM(${products.zastosowanie}) <> ''`,
  ];
  const pary = db
    .selectDistinct({ kategoria: products.kategoria, zastosowanie: products.zastosowanie })
    .from(products)
    .where(and(...warunki))
    .all();
  const [para] = pary;
  if (pary.length !== 1 || !para || para.zastosowanie === null) return false;

  rekord.kategoria = para.kategoria;
  rekord.zastosowanie = para.zastosowanie;
  return true;
}
