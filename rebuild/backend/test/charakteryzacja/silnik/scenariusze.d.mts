// Deklaracja typów dla scenariusze.mjs — wejścia celowane w gałęzie silnika.

export interface Scenariusz {
  nazwa: string;
  opis: string;
  dostawca: string;
  katalog: Record<string, unknown>[];
  rekordy: Record<string, unknown>[];
}

export declare const SCENARIUSZE: Scenariusz[];
