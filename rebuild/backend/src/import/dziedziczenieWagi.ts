// Dziedziczenie wagi po marce+rozmiarze+bieżniku — ticket 155-FEATURE-dziedziczenie-wagi-po-rozmiarze.
//
// ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT. W przeciwieństwie do reszty `src/import/`, ten plik nie
// odtwarza zachowania produkcji — produkcja (`deminified/`, `mirror/backend/`) nie ma żadnego
// mechanizmu dziedziczenia wagi po podobieństwie produktów. Jedyny pokrewny mechanizm to
// `waga_pamiec` (`silnik/bridge-ext.ts`, port `applyWagaPamiec`), który pamięta wagę PO TYM
// SAMYM `kod` przy ponownym imporcie — inny klucz, inny cel. Decyzja użytkownika, 2026-09-25.
//
// Dlatego ta logika NIE wchodzi do `bridge-ext.ts` (most do portu pilnowanego testem
// charakteryzacyjnym sha256) — żyje osobno i jest wołana z `akceptacja.ts`/`bulk.ts` TUŻ PO
// `applyWagaPamiec`, żeby priorytet „ręczna waga / pamięć wygrywa" wynikał z samej kolejności
// wywołań: ta funkcja działa TYLKO, gdy `rekord.waga` jest nadal puste/zerowe.

import { and, eq, isNull, or, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { products } from "../db/schema.js";

/**
 * Waga `0` jest zawsze traktowana jak pusta — nigdy nie ma zostać zapisana (decyzja 4/5 z Q&A).
 * Próg identyczny jak `isEmptyWaga` w porcie `waga_pamiec` (`legacy/bridge_ext.cjs:218`), dla
 * spójności między obydwoma mechanizmami wagi.
 */
export function jestPustaWaga(w: unknown): boolean {
  if (w === null || w === undefined || w === "") return true;
  const n = Number(w);
  return Number.isNaN(n) || n === 0;
}

/** Klucz dopasowania — decyzja 1: marka + rozmiar (znormalizowany) + bieżnik. */
export type KluczRozmiaru = {
  marka: string;
  szerokosc: string;
  profil: number | null;
  srednica: number | null;
  konstrukcja: string | null;
  bieznik: string | null;
};

/**
 * Buduje klucz dopasowania z rekordu produktu (świeżo zapisywanego albo już w bazie).
 * `null`, gdy brak marki albo rozmiaru — bez znormalizowanego rozmiaru dopasowanie nie jest
 * wiarygodne (ostrzeżenie CLAUDE.md o niejednoznacznej notacji `AxB`; dlatego klucz idzie po
 * już-znormalizowanych kolumnach `szerokosc/profil/srednica/konstrukcja`, nie po `rozmiar`).
 */
export function kluczZRekordu(rekord: Record<string, unknown>): KluczRozmiaru | null {
  const marka = rekord.marka;
  const szerokosc = rekord.szerokosc;
  if (typeof marka !== "string" || marka === "") return null;
  if (szerokosc === null || szerokosc === undefined || szerokosc === "") return null;

  const liczbaLubNull = (v: unknown): number | null =>
    v === null || v === undefined || v === "" ? null : Number(v);
  const tekstLubNull = (v: unknown): string | null =>
    v === null || v === undefined || v === "" ? null : String(v);

  return {
    marka,
    szerokosc: String(szerokosc),
    profil: liczbaLubNull(rekord.profil),
    srednica: liczbaLubNull(rekord.srednica),
    konstrukcja: tekstLubNull(rekord.konstrukcja),
    bieznik: tekstLubNull(rekord.bieznik),
  };
}

/**
 * Szuka NAJWYŻSZEJ wagi wśród produktów pasujących kluczem (decyzja 2: przy rozjeździe danych
 * bierzemy maksimum). Bieżnik jest tolerancyjny, gdy brak danych po którejkolwiek stronie
 * (decyzja 4): różny WYPEŁNIONY bieżnik wyklucza dopasowanie, pusty bieżnik (u nowego produktu
 * albo u kandydata) — nie. Rozmiar (szerokość/profil/średnica/konstrukcja) dopasowuje się
 * ściśle po znormalizowanych kolumnach.
 *
 * Kandydat z pustą/zerową wagą nigdy nie wygrywa (`jestPustaWaga` — ten sam próg co przy
 * zapisie), więc produkt aktualizowany w miejscu (ten sam `id`, jeszcze bez nowej wagi) sam
 * siebie nie dopasowuje — nie trzeba go jawnie wykluczać z zapytania.
 */
export function znajdzWageDoDziedziczenia(db: Baza, klucz: KluczRozmiaru): number | null {
  const warunki = [
    eq(products.marka, klucz.marka),
    eq(products.szerokosc, klucz.szerokosc),
    klucz.profil === null ? isNull(products.profil) : eq(products.profil, klucz.profil),
    klucz.srednica === null ? isNull(products.srednica) : eq(products.srednica, klucz.srednica),
    klucz.konstrukcja === null
      ? isNull(products.konstrukcja)
      : eq(products.konstrukcja, klucz.konstrukcja),
    sql`${products.waga} IS NOT NULL AND ${products.waga} <> 0`,
  ];
  if (klucz.bieznik !== null) {
    warunki.push(
      or(
        eq(products.bieznik, klucz.bieznik),
        isNull(products.bieznik),
        eq(products.bieznik, ""),
      )!,
    );
  }

  const kandydaci = db
    .select({ waga: products.waga })
    .from(products)
    .where(and(...warunki))
    .all();

  let najwyzsza: number | null = null;
  for (const kandydat of kandydaci) {
    if (kandydat.waga !== null && (najwyzsza === null || kandydat.waga > najwyzsza)) {
      najwyzsza = kandydat.waga;
    }
  }
  return najwyzsza;
}

/**
 * Wpięcie w ścieżkę zapisu (`akceptacja.ts`, `bulk.ts`) — TUŻ PO `applyWagaPamiec`. MUTUJE
 * `rekord`, jak reszta rozszerzeń importu (`applyDims`, `applyNazwaPamiec`, `applyWagaPamiec`).
 * Ustawia `wagaAutoUzupelniona = true` tylko, gdy faktycznie dziedziczy; w przeciwnym razie
 * zostawia flagę nietkniętą (import nie ma czyścić flagi ustawionej wcześniej przez inną
 * ścieżkę zapisu tego samego wiersza — reset przy ręcznej edycji robi `routes/products.ts`).
 */
export function applyWagaDziedziczona(db: Baza, rekord: Record<string, unknown>): void {
  if (!jestPustaWaga(rekord.waga)) return;
  const klucz = kluczZRekordu(rekord);
  if (!klucz) return;
  const waga = znajdzWageDoDziedziczenia(db, klucz);
  if (waga !== null) {
    rekord.waga = waga;
    rekord.wagaAutoUzupelniona = true;
  }
}
