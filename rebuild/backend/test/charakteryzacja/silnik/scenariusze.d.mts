// Deklaracja typów dla scenariusze.mjs — wejścia celowane w gałęzie silnika.

export interface Scenariusz {
  nazwa: string;
  opis: string;
  dostawca: string;
  katalog: Record<string, unknown>[];
  rekordy: Record<string, unknown>[];
  /** Wiersze `manual_overrides` widziane przez `protect()`; brak = pusta lista. */
  overrides?: Record<string, unknown>[];
  /**
   * `_bridgeFeedMeta` dla tego scenariusza (#103). Pominięte = domyślna KOMPLETNA oferta;
   * jawne `null` = oferta bez metadanych, czyli niepotwierdzona kompletność.
   */
  meta?: Record<string, unknown> | null;
  /** Dodatkowe opcje przebiegu (`reconcileOnly`, `verifyAbsence`, `feedComplete`). */
  opcje?: Record<string, unknown>;
}

export declare const SCENARIUSZE: Scenariusz[];
