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
  /** Reguły narzutu w tabeli `markups` — od 4a gałąź cenowa importu realnie na nich liczy. */
  narzuty?: Record<string, unknown>[];
  /** Promocje w tabeli `promotions` — jw. */
  promocje?: Record<string, unknown>[];
}

export declare function produkt(pola: Record<string, unknown>): Record<string, unknown>;
export declare function pozycja(pola: Record<string, unknown>): Record<string, unknown>;
export declare function narzut(pola: Record<string, unknown>): Record<string, unknown>;
export declare function promocja(pola: Record<string, unknown>): Record<string, unknown>;
export declare const SCENARIUSZE: ScenariuszAkceptacji[];
