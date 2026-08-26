// Deklaracja typów dla wzorzec.mjs. Sam moduł musi zostać plikiem .mjs, bo importuje go
// zarówno test (vitest/TS), jak i scripts/charakteryzacja-silnik-nagraj.mjs uruchamiany
// gołym node — a normalizacja MUSI być w obu miejscach identyczna.

export declare const KODY_DOSTAWCOW: string[];
export declare const UTWORZONO_WZORCOWE: string;
export declare const POLA_WIERSZA: string[];
export declare const TYP_POZA_ZAKRESEM_3C: string;

export interface WierszWzorca {
  [pole: string]: unknown;
}

export interface PrzebiegWzorca {
  dostawca: string;
  wejscie: { rekordow: number; zrodlo: string };
  katalog: { produktow: number; zrodlo: string };
  statystyki: Record<string, unknown>;
  pozaZakresem3c: Record<string, unknown>;
  staging: WierszWzorca[];
  skasowane: number[];
  resetyNieobecnosci: { id: number; patch: Record<string, unknown> }[];
}

export declare function normalizujPrzebieg(przebieg: unknown): PrzebiegWzorca;
