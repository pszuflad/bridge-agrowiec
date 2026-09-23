// Prymitywy polityki stagingu — most do `legacy/staging_policy.cjs` (@ `88fa31c`) plus
// port tych funkcji modułowych, których oryginał NIE eksportuje.
//
// Podział jest wymuszony przez oryginał. `module.exports` (`staging_policy.cjs:665`) oddaje
// tylko siedem nazw:
//
//   validateEan, rawEan, syntheticCode, compatibility, identity, norm, version
//
// Reszta — `hash`, `separateDotBatch`, `sourceKey`, `codeKey`, `KEYS`, `LABEL`, `OPTIONAL` —
// jest modułowo prywatna, a `legacy/**` należy do karty I15.2 i stoi pod gate'em sha256
// (`test/charakteryzacja.test.ts:134`), więc NIE wolno dopisać jej do eksportów. Dlatego
// prywatne prymitywy są tu odtworzone znak w znak, a publiczne wyłącznie przemostowane —
// żeby nie powstały dwie rozjeżdżające się definicje `norm()` czy `identity()`.
//
// ⚠ `norm()` używa JS-owego `.toUpperCase()`, czyli jest Unicode-aware: `norm('prowadząca')`
// daje `'PROWADZĄCA'`. To INNY mechanizm niż SQLite `UPPER()` z migracji `006`, które jest
// ASCII-only i zostawia `'PROWADZąCA'` (CLAUDE.md). Nie mylić tych dwóch „UPPER" ze sobą:
// reguła „nie poprawiaj na wariant Unicode-aware" dotyczy SQL-a, nie tego pliku.

import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const wymagaj = createRequire(import.meta.url);

/** Wynik `validateEan()` — `staging_policy.cjs:9-23`. */
export type WynikWalidacjiEan = {
  raw: string;
  value: string | null;
  /** `null` = pole puste (brak EAN-u to nie błąd), `false` = odrzucony, `true` = poprawny. */
  valid: boolean | null;
  error: string | null;
  status: "empty" | "invalid" | "ok";
};

/** Wynik `compatibility()` — `staging_policy.cjs:44-60`. */
export type WynikZgodnosci = {
  ok: boolean;
  missing: string[];
  different: string[];
};

interface ModulPolitykiStagingu {
  validateEan(wartosc: unknown, lossy?: boolean): WynikWalidacjiEan;
  rawEan(rekord: Record<string, unknown>): unknown;
  syntheticCode(dostawca: string, rekord: Record<string, unknown>): string;
  compatibility(a: Record<string, unknown>, b: Record<string, unknown>): WynikZgodnosci;
  identity(rekord: Record<string, unknown>): string[];
  norm(wartosc: unknown): string;
  version(produkt: Record<string, unknown> | null): string | null;
}

const modul = wymagaj("./../legacy/staging_policy.cjs") as ModulPolitykiStagingu;

// ——— Most do prymitywów eksportowanych przez oryginał ———
// Celowo przez funkcje opakowujące, nie przez destructuring: `bridge-ext.ts` pokazał, że
// destructuring zamraża referencję w chwili importu, a to w połączeniu z nadpisaniami
// z `install()` daje trudny do wyśledzenia stary kod pod nową nazwą.

/** NFKC + trim + zwinięcie spacji + `toUpperCase()` — `staging_policy.cjs:4`. */
export const norm = (wartosc: unknown): string => modul.norm(wartosc);

/** Ścisła walidacja EAN-u (D4) — `staging_policy.cjs:9`. */
export const validateEan = (wartosc: unknown, lossy = false): WynikWalidacjiEan =>
  modul.validateEan(wartosc, lossy);

/** Surowy EAN sprzed normalizacji, z zejściem do `surowe_pola` — `staging_policy.cjs:24`. */
export const rawEan = (rekord: Record<string, unknown>): unknown => modul.rawEan(rekord);

/** Tożsamość opony: marka, model, rozmiar, pola opcjonalne i wariant — `staging_policy.cjs:33`. */
export const identity = (rekord: Record<string, unknown>): string[] => modul.identity(rekord);

/** `MOx_AUTO_<18 znaków sha256>` — `staging_policy.cjs:42`. */
export const syntheticCode = (dostawca: string, rekord: Record<string, unknown>): string =>
  modul.syntheticCode(dostawca, rekord);

/** Zgodność cech dwóch opon, z wariantem DEMO włącznie — `staging_policy.cjs:44`. */
export const compatibility = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): WynikZgodnosci => modul.compatibility(a, b);

/** Odcisk wersji karty katalogowej — `staging_policy.cjs:70`. */
export const version = (produkt: Record<string, unknown> | null): string | null =>
  modul.version(produkt);

// ——— Port prymitywów, których oryginał nie eksportuje ———

/**
 * `sha256(JSON.stringify(v))` — `staging_policy.cjs:5`.
 *
 * ⚠ Musi dawać wynik IDENTYCZNY z oryginałem: odciski oferty trafiają do
 * `supplier_feed_versions` i decydują o tym, czy dana oferta już się liczyła. Każda zmiana
 * serializacji unieważniłaby historię wycofań zebraną na produkcji.
 */
export const hash = (wartosc: unknown): string =>
  createHash("sha256").update(JSON.stringify(wartosc)).digest("hex");

/** Pola porównywane przy wykrywaniu zmian — `staging_policy.cjs:6`. */
export const KEYS = [
  "rozmiar",
  "indeksNosnosci",
  "indeksPredkosci",
  "model",
  "marka",
  "nazwa",
  "kodDostawcy",
] as const;

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

/** Pola opcjonalne, które i tak muszą się zgadzać, jeśli obie strony je mają — `:8`. */
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
