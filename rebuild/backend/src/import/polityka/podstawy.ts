// Prymitywy polityki stagingu używane WYŁĄCZNIE przez importer (karta I15.4b).
//
// ⭐ PODZIAŁ Z `helpery.ts` (karta I15.4c, ticket 129). Most ESM→CJS do
// `legacy/staging_policy.cjs` i prymitywy wspólne dla obu kart — `validateEan`, `rawEan`,
// `syntheticCode`, `compatibility`, `identity`, `norm`, `version`, `hash`, `KEYS` — są
// w `helpery.ts` i stamtąd je bierzemy. Tutaj zostaje tylko to, czego akceptacja nie wołała,
// a oryginał nie eksportuje, więc musi być odtworzone: `LABEL`, `OPTIONAL`,
// `separateDotBatch`, `sourceKey`, `codeKey`.
//
// Ten plik NIE powiela niczego z `helpery.ts` — jedna definicja `norm()` i `hash()` w repo.
//
// ⚠ `norm()` używa JS-owego `.toUpperCase()`, czyli jest Unicode-aware: `norm('prowadząca')`
// daje `'PROWADZĄCA'`. To INNY mechanizm niż SQLite `UPPER()` z migracji `006`, które jest
// ASCII-only i zostawia `'PROWADZąCA'` (CLAUDE.md). Nie mylić tych dwóch „UPPER" ze sobą:
// reguła „nie poprawiaj na wariant Unicode-aware" dotyczy SQL-a, nie tego pliku.

import { hash, identity, norm, rawEan } from "./helpery.js";

/** Etykiety pól w opisie zmiany pokazywanym w stagingu — `staging_policy.cjs:7`. */
export const LABEL: Record<string, string> = {
  rozmiar: "rozmiar",
  indeksNosnosci: "nośność",
  indeksPredkosci: "prędkość",
  model: "model",
  marka: "marka",
  nazwa: "nazwa",
  kodDostawcy: "kod dostawcy",
};

/**
 * Pola opcjonalne, które i tak muszą się zgadzać, jeśli obie strony je mają — `:8`.
 *
 * Wchodzą do `compatibility()` i do `identity()`, więc puste pole po JEDNEJ stronie liczy się
 * jako NIEZGODNOŚĆ (`missing`), a nie jako „brak informacji".
 */
export const OPTIONAL = [
  "indeksNosnosci",
  "indeksPredkosci",
  "pr",
  "tlTt",
  "vfIf",
  "konstrukcja",
  "dot",
] as const;

/**
 * Czy różnica sprowadza się do innej partii DOT — `staging_policy.cjs:62-69`.
 *
 * Inny DOT (także „partia bez daty") ODRÓŻNIA poza tym zgodne opony, więc nie jest to
 * duplikat do zgłoszenia, tylko osobna pozycja. Pozostałe sprzeczne cechy zostają
 * przypadkiem do ręcznego sprawdzenia, nie automatycznym nowym produktem.
 */
export function separateDotBatch(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (norm(a.dot) === norm(b.dot)) return false;
  for (const k of ["marka", "model", "rozmiar"]) {
    if (!norm(a[k]) || norm(a[k]) !== norm(b[k])) return false;
  }
  return OPTIONAL.filter((k) => k !== "dot").every(
    (k) => !norm(a[k]) || !norm(b[k]) || norm(a[k]) === norm(b[k]),
  );
}

/**
 * Klucz źródłowy pozycji cennika — `staging_policy.cjs:74-76`.
 *
 * Kod syntetyczny jest z niego CELOWO wypuszczony (`r._kodSynthetic ? '' : r.kod`): pozycja
 * bez własnego oznaczenia ma być rozpoznawana po cechach, nie po kodzie, który sami jej
 * nadaliśmy i który zmieni się przy najbliższej zmianie cech.
 */
export function sourceKey(dostawca: string, rekord: Record<string, unknown>): string {
  return hash([
    dostawca,
    rekord._kodSynthetic ? "" : rekord.kod,
    identity(rekord),
    String(rawEan(rekord) ?? ""),
  ]);
}

/**
 * Kod bez prefiksu dostawcy, znormalizowany — `staging_policy.cjs:77-79`.
 *
 * Dzięki temu `MO9_12345` i `12345` trafiają w ten sam klucz. Prefiks jest zdejmowany przez
 * `RegExp` budowany z nazwy dostawcy, więc znaki specjalne w kodzie dostawcy są escapowane.
 */
export function codeKey(dostawca: string, wartosc: unknown): string {
  const escapowany = String(dostawca).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return norm(wartosc).replace(new RegExp(`^${escapowany}_`), "");
}
