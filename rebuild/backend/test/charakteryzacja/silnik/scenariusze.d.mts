// Deklaracja typów dla scenariusze.mjs — wejścia celowane w gałęzie silnika.

export interface Scenariusz {
  nazwa: string;
  opis: string;
  dostawca: string;
  katalog: Record<string, unknown>[];
  rekordy: Record<string, unknown>[];
  /** Wiersze `manual_overrides` widziane przez `Gq()`; brak = pusta lista (zakres 3d-1). */
  overrides?: Record<string, unknown>[];
}

export declare const SCENARIUSZE: Scenariusz[];
