// Most ESM→CJS do `src/import/legacy/staging_policy.cjs` + te helpery oryginału, których
// moduł NIE eksportuje.
//
// Ten plik NIE zawiera logiki decyzyjnej — ta siedzi w `blokady.ts`, `akceptacja.ts`,
// `zgloszenia.ts` i `nieobecne.ts`. Tutaj jest wyłącznie dostęp do funkcji czystych.
//
// ⭐ DLACZEGO MOST, A NIE PRZEPISANIE: `staging_policy.cjs` leży w repo bajt w bajt
// z `88fa31c` (skopiowany ticketem 120, pilnowany sha256 w `test/charakteryzacja.test.ts`)
// i eksportuje `{validateEan,rawEan,syntheticCode,compatibility,identity,norm,version}`.
// Przepisanie ich do TS byłoby drugą kopią tej samej logiki — dokładnie tym, czego
// zabrania DRY, i miejscem, w którym port cicho rozjechałby się z oryginałem.
// Ten sam wzorzec co `silnik/bridge-ext.ts`.

import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const wymagaj = createRequire(import.meta.url);

/** Wynik `validateEan()` — `staging_policy.cjs:9-23`. */
export type WynikEan = {
  raw: string;
  value: string | null;
  valid: boolean | null;
  error: string | null;
  status: "empty" | "ok" | "invalid";
};

/** Wynik `compatibility()` — `staging_policy.cjs:45-60`. */
export type Zgodnosc = { ok: boolean; missing: string[]; different: string[] };

interface PolitykaStagingu {
  /**
   * Walidacja EAN-u: zapis naukowy, znaki inne niż cyfry, długość, same zera, suma
   * kontrolna. NIGDY nie obcina, nie zaokrągla ani nie zmyśla numeru (`:9`).
   */
  validateEan(value: unknown, lossy?: boolean): WynikEan;
  /** Surowy EAN z rekordu, zanim adapter cokolwiek z nim zrobił (`:24`). */
  rawEan(record: Record<string, unknown>): unknown;
  /** Kod zastępczy `<DOSTAWCA>_AUTO_<18 znaków hash>` dla pozycji bez własnego kodu (`:42`). */
  syntheticCode(supplier: string, r: Record<string, unknown>): string;
  /** Czy dwie opony to ta sama pozycja — marka/model/rozmiar + pola opcjonalne (`:45`). */
  compatibility(a: Record<string, unknown>, b: Record<string, unknown>): Zgodnosc;
  /** Tożsamość opony jako tablica znormalizowanych pól (`:33`). */
  identity(r: Record<string, unknown>): string[];
  /** Normalizacja porównawcza: NFKC, trim, zwinięcie spacji, wielkie litery (`:4`). */
  norm(v: unknown): string;
  /**
   * Odcisk stanu produktu w katalogu (`:71`). Zmiana któregokolwiek z pól
   * `[id, ...KEYS, ean, cenaZakupu, cenaSprzedazy, stan, status, dataAktualizacji]`
   * unieważnia zgłoszenie oparte na poprzednim odczycie.
   */
  version(p: Record<string, unknown> | null | undefined): string | null;
}

const modul = wymagaj("../legacy/staging_policy.cjs") as PolitykaStagingu;

export const { validateEan, rawEan, syntheticCode, compatibility, identity, norm, version } = modul;

/**
 * `hash()` z `staging_policy.cjs:5` — NIE jest eksportowany, więc odtworzony tu dosłownie.
 *
 * Używamy go wyłącznie do `candidates_hash` (#106). Kolejność i kształt wejścia muszą się
 * zgadzać co do znaku, bo od tego zależy, czy zamknięta sprawa nieobecnej karty wróci
 * przy następnym imporcie, czy nie.
 */
export const hash = (v: unknown): string =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");

/**
 * `KEYS` z `staging_policy.cjs:6` — też nieeksportowane. Zestaw pól tożsamości opony,
 * używany przez `version()` oraz przez kontrolę „to wciąż ta sama opona" w `chooseAbsenceCard`.
 */
export const KEYS = [
  "rozmiar",
  "indeksNosnosci",
  "indeksPredkosci",
  "model",
  "marka",
  "nazwa",
  "kodDostawcy",
] as const;

/**
 * Odpowiednik `fail()` (`staging_policy.cjs:81`): `const e=new Error(message);e.status=409;throw e;`
 *
 * Każda blokada polityki jest konfliktem stanu (409), nie błędem żądania (400) — użytkownik
 * ma odświeżyć staging albo poprawić dane, a nie poprawić zapytanie.
 */
export class BladPolityki extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "BladPolityki";
  }
}

/** Rzuca blokadę polityki — dosłowny odpowiednik `fail(message)`. */
export function odmow(message: string): never {
  throw new BladPolityki(message);
}
