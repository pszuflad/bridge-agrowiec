// Deklaracja typów dla scenariusze.mjs — wejścia celowane w gałęzie `acceptStaging`.

export interface ScenariuszAkceptacji {
  nazwa: string;
  opis: string;
  katalog: Record<string, unknown>[];
  pozycja: Record<string, unknown>;
  overrides?: Record<string, unknown>[];
  nazwaPamiec?: Record<string, unknown>[];
  wagaPamiec?: Record<string, unknown>[];
  linkPamiecKod?: Record<string, unknown>[];
}

export declare function produkt(pola: Record<string, unknown>): Record<string, unknown>;
export declare function pozycja(pola: Record<string, unknown>): Record<string, unknown>;
export declare const SCENARIUSZE: ScenariuszAkceptacji[];
