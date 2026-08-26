// Deklaracja typów dla wzorzec.mjs. Sam moduł musi zostać plikiem .mjs, bo importuje go
// zarówno test (vitest/TS), jak i scripts/charakteryzacja-silnik-nagraj.mjs uruchamiany
// gołym node — a normalizacja MUSI być w obu miejscach identyczna.

export declare const KODY_DOSTAWCOW: string[];
export declare const UTWORZONO_WZORCOWE: string;
export declare const POLA_WIERSZA: string[];

export interface WierszWzorca {
  [pole: string]: unknown;
}

/** Zmiana stanu jednego produktu: nazwa pola → wartość przed i po. */
export interface ZmianaProduktu {
  id: number;
  zmiany: Record<string, { przed: unknown; po: unknown }>;
}

export interface PrzebiegWzorca {
  dostawca: string;
  wejscie: { rekordow: number; zrodlo: string };
  katalog: { produktow: number; zrodlo: string };
  overridy: { wierszy: number };
  statystyki: Record<string, unknown>;
  wierszyPoDeduplikacji: number;
  staging: WierszWzorca[];
  skasowane: number[];
  historiaCen: Record<string, unknown>[];
  zmianyProduktow: ZmianaProduktu[];
  zapytanDoPamieciLinkow: number;
}

export declare function normalizujPrzebieg(przebieg: unknown): PrzebiegWzorca;
