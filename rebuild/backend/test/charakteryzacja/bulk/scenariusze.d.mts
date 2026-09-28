// Deklaracja typów dla bulk/scenariusze.mjs.

export interface ScenariuszBulku {
  nazwa: string;
  opis: string;
  katalog: Record<string, unknown>[];
  partia: Record<string, unknown>[];
  narzuty?: Record<string, unknown>[];
  promocje?: Record<string, unknown>[];
  nazwaPamiec?: Record<string, unknown>[];
  wagaPamiec?: Record<string, unknown>[];
  linkPamiecKod?: Record<string, unknown>[];
}

export declare function produkt(pola: Record<string, unknown>): Record<string, unknown>;
export declare function pozycja(pola: Record<string, unknown>): Record<string, unknown>;
export declare function narzut(pola: Record<string, unknown>): Record<string, unknown>;
export declare function promocja(pola: Record<string, unknown>): Record<string, unknown>;
export declare const SCENARIUSZE: ScenariuszBulku[];
