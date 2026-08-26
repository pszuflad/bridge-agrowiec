// Pozycja importu po normalizacji + narzędzia porównywania — port `Hq()`, `Kq()`, `Vq` i `Xq()`
// (`deminified/backend-index.cjs:47352`, `:47255`, `:47264`, `:47308`).

import type { RekordSurowy } from "../typy.js";
import { normalizujEan, type InfoEan } from "./ean.js";
import { parametryZRozmiaru, wymiaryZRozmiaru, wytnijRozmiarZNazwy } from "./rozmiar.js";

/**
 * Rekord po `znormalizujPozycje()` — to on ląduje w `staging_items.snapshot_json`
 * (`tk()`, `:47730`) i to z niego 3d odtworzy produkt przy zatwierdzaniu.
 *
 * Różnice wobec `RekordSurowy` biorą się z tego, że normalizacja realnie wypełnia pola,
 * które adapter zostawia puste: `magazyn` dostaje wartość, `indeks1`/`indeks2` się domykają,
 * a rodzina `ean*` powstaje w całości tutaj.
 */
export type PozycjaZnormalizowana = Omit<
  RekordSurowy,
  "magazyn" | "cenaSprzedazy" | "indeks1" | "indeks2"
> & {
  magazyn: string | null;
  cenaSprzedazy: number | null;
  indeks1: string | null;
  indeks2: string | null;
  eanRaw?: string | null;
  eanIsValid?: number | null;
  eanSourceStatus?: string | null;
  eanCandidates?: string | null;
  /**
   * Marża z cennika. Adapter (port 3a) jej NIE produkuje, więc w praktyce zawsze `undefined`
   * i auto-patch nigdy nie ustawia `marzaPct` — odtwarzamy to zachowanie, nie naprawiamy.
   */
  marzaPct?: number | null;
  /** Wartości z pliku dostawcy przy konflikcie z poprawką Marty. Wypełnia dopiero 3d. */
  _srcConflict?: Record<string, string>;
};

export interface WynikNormalizacji {
  poz: PozycjaZnormalizowana;
  eanInfo: InfoEan | null;
  rozmiarWykryty: boolean;
}

/**
 * Normalizacja pozycji przed klasyfikacją — port `Hq()` (`:47352`).
 *
 * Trzy rzeczy naraz:
 *   1. EAN → `ean`, `eanRaw`, `eanIsValid`, `eanSourceStatus`, `eanCandidates`
 *   2. magazyn → `magazynRaw` zachowuje zapis z pliku, `magazyn` dostaje „—" gdy pusty
 *   3. rozmiar → gdy brak pola `rozmiar`, próba wycięcia go z nazwy; potem uzupełnienie
 *      parametrów technicznych i domknięcie indeksów
 *
 * ⚠ Uzupełnianie parametrów NIE NADPISUJE tego, co rekord już ma. Pola liczbowe sprawdzane są
 * przez `=== null || === undefined` (więc `0` zostaje), a tekstowe zwykłą falsy-nością
 * (więc `""` zostanie nadpisany). Ta niesymetria jest w oryginale i ma znaczenie dla `szerokosc`,
 * którą parsery oddają jako STRING („10.00" ≠ 10, poprawka `szertxt`).
 *
 * ⚠ `eanIsValid` jest zapisywane jako 1/0, NIGDY jako boolean. To ważne dla klasyfikatora
 * w `tk()`, który testuje `d.eanIsValid === false` — warunek nigdy nie jest prawdziwy,
 * bo po tej funkcji w polu siedzi liczba. Odtwarzamy to wiernie.
 */
export function znormalizujPozycje(wejscie: PozycjaZnormalizowana): WynikNormalizacji {
  const poz: PozycjaZnormalizowana = { ...wejscie };
  let eanInfo: InfoEan | null = null;

  if (wejscie.ean !== undefined && wejscie.ean !== null && String(wejscie.ean) !== "") {
    eanInfo = normalizujEan(wejscie.ean);
    poz.ean = eanInfo.ean;
    poz.eanRaw = eanInfo.eanRaw;
    poz.eanIsValid = eanInfo.eanIsValid ? 1 : 0;
    poz.eanSourceStatus = eanInfo.eanSourceStatus;
    poz.eanCandidates = eanInfo.eanCandidates.length
      ? JSON.stringify(eanInfo.eanCandidates)
      : null;
  }

  const zrodloMagazynu = wejscie.magazynRaw ?? wejscie.magazyn;
  poz.magazynRaw = zrodloMagazynu != null ? String(zrodloMagazynu) : null;
  if (poz.magazyn === undefined || poz.magazyn === null || poz.magazyn === "") {
    poz.magazyn = poz.magazynRaw ?? "—";
  }

  let rozmiarWykryty = Boolean(poz.rozmiar);

  if (!poz.rozmiar && poz.nazwa) {
    const zNazwy = wytnijRozmiarZNazwy(poz.nazwa);
    if (zNazwy.rozmiar) {
      poz.rozmiar = zNazwy.rozmiar;
      poz.nazwa = zNazwy.nazwaBezRozmiaru || poz.nazwa;
      rozmiarWykryty = true;
    }
  } else if (poz.rozmiar) {
    rozmiarWykryty = true;
  }

  if (poz.rozmiar) {
    const parametry = parametryZRozmiaru(poz.rozmiar);
    if (poz.szerokosc === null || poz.szerokosc === undefined) poz.szerokosc = parametry.szerokosc;
    if (poz.profil === null || poz.profil === undefined) poz.profil = parametry.profil;
    if (poz.srednica === null || poz.srednica === undefined) poz.srednica = parametry.srednica;
    if (!poz.konstrukcja) poz.konstrukcja = parametry.konstrukcja;
    if (!poz.indeksNosnosci) poz.indeksNosnosci = parametry.indeksNosnosci;
    if (!poz.indeksPredkosci) poz.indeksPredkosci = parametry.indeksPredkosci;
    if (!poz.tlTt) poz.tlTt = parametry.tlTt;
    if (!poz.vfIf) poz.vfIf = parametry.vfIf;
    if (!poz.pr) poz.pr = parametry.pr;

    const wymiary = wymiaryZRozmiaru(poz.rozmiar);
    if ((poz.szerokosc === null || poz.szerokosc === undefined) && wymiary.szerokosc !== null) {
      poz.szerokosc = wymiary.szerokosc;
    }
    if ((poz.wysokosc === null || poz.wysokosc === undefined) && wymiary.wysokoscBoku !== null) {
      poz.wysokosc = wymiary.wysokoscBoku;
    }
  }

  if (!poz.indeks1 && poz.indeksNosnosci) poz.indeks1 = poz.indeksNosnosci;
  if (!poz.indeks2 && poz.indeksPredkosci) poz.indeks2 = poz.indeksPredkosci;
  if (!poz.indeksy && (poz.indeks1 || poz.indeks2)) {
    poz.indeksy = `${poz.indeks1 ?? ""}${poz.indeks2 ?? ""}`.trim() || null;
  }

  return { poz, eanInfo, rozmiarWykryty };
}

/**
 * Wykrywanie błędnego zapisu nazwy — port `Kq()` (`:47255`).
 *
 * Dwa realne defekty plików dostawców: brak spacji po słowie „Opona" i rozmiar sklejony
 * z producentem. Trafienie wymusza `typZmiany: "blad"` — pozycja wymaga oka człowieka.
 *
 * @returns opis defektu albo `null`, gdy nazwa jest w porządku
 */
export function bladZapisuNazwy(nazwa: string | null | undefined): string | null {
  if (!nazwa) return null;
  const zapis = String(nazwa).trim();
  if (!zapis) return null;

  if (/\bOpona(?=(?:VF|IF)?\d)/i.test(zapis)) return "nazwa bez spacji po słowie Opona";

  if (
    /(?:VF|IF)?\d{2,4}\s*\/\s*\d{2,3}\s*[RB-]\s*\d{1,2}(?:[.,]\d)?(?=[A-ZĄĆĘŁŃÓŚŹŻ])/i.test(zapis)
  ) {
    return "rozmiar sklejony z producentem lub modelem";
  }

  return null;
}

/**
 * Pola pokazywane w `powod` przy zmianie istniejącej pozycji — port `Vq` (`:47264`).
 *
 * Kolejność jest kolejnością składników komunikatu, który zobaczy użytkownik w `/staging` (3e),
 * a etykiety są dosłownie tymi z produkcji („LI", „SI", „VF/IF") — nie tłumaczymy ich.
 */
export const POLA_ROZNIC: ReadonlyArray<{ key: string; label: string }> = [
  { key: "nazwa", label: "nazwa" },
  { key: "marka", label: "marka" },
  { key: "model", label: "model" },
  { key: "kodDostawcy", label: "kod dostawcy" },
  { key: "ean", label: "EAN" },
  { key: "rozmiar", label: "rozmiar" },
  { key: "szerokosc", label: "szerokość" },
  { key: "profil", label: "profil" },
  { key: "srednica", label: "średnica" },
  { key: "konstrukcja", label: "konstrukcja" },
  { key: "indeksNosnosci", label: "LI" },
  { key: "indeksPredkosci", label: "SI" },
  { key: "vfIf", label: "VF/IF" },
  { key: "pr", label: "PR" },
];

/**
 * Porównanie dwóch wartości pola — port `Xq()` (`:47308`).
 *
 * ⚠ NIESYMETRYCZNE, i to celowo: gdy stara wartość jest pusta, a nowa nie — zwraca `false`
 * (są różne). Gdy nowa jest pusta, a stara nie — też `false`. Ale dwie puste są sobie równe,
 * niezależnie od tego, czy to `null`, `undefined` czy `""`. Poza pustymi porównuje przez
 * `String()`, więc `6.5` i `"6.5"` są równe, a `6.5` i `"6.50"` już nie.
 */
export function wartosciRowne(stara: unknown, nowa: unknown): boolean {
  if (stara == null || stara === "") return nowa == null || nowa === "";
  if (nowa == null || nowa === "") return false;
  return String(stara) === String(nowa);
}
