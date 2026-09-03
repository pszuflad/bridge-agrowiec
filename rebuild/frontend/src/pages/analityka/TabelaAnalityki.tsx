/**
 * Tabela analityki — port pomocnika `I(dane, kolumny, tekstPusty)` z widoku `/analityka`
 * (`deminified/frontend-index.js:27942-27966`, funkcja `zM`).
 *
 * W oryginale jest to funkcja zadeklarowana WEWNĄTRZ komponentu widoku i wołana przez
 * wszystkie zakładki — kilkanaście razy. Wyciągamy ją do osobnego komponentu, bo bloki
 * 10b–10e mają jej używać tak samo; kształt kolumn, klasy i teksty zostają 1:1.
 *
 * ⚠ LIMIT 300 WIERSZY JEST Z ORYGINAŁU (`e.slice(0, 300)`, `:27953`) i zostaje. To nie jest
 * paginacja — reszta wierszy po prostu nie jest rysowana i użytkownik nie dostaje o tym
 * żadnego sygnału. Dokładamy jedyne odstępstwo, jakie ma tu sens: stopkę mówiącą, ile
 * wierszy ucięto. Bez niej filtr wyglądałby na zepsuty przy zbiorach powyżej 300 pozycji.
 */
import type { ReactNode } from "react";

import { formatuj } from "./formatowanie";

/** Ile wierszy trafia do DOM-u — `:27953`. */
export const LIMIT_WIERSZY = 300;

export type KolumnaTabeli<T> = {
  /** Klucz pola w wierszu; służy też jako `key` Reacta. */
  key: string;
  label: string;
  /** Wyrównanie do prawej — kolumny liczbowe (`right: 1` w oryginale). */
  right?: boolean;
  /** Krój monospace — kody, znaczniki czasu (`mono: 1` w oryginale). */
  mono?: boolean;
  /** Własny render; bez niego wartość idzie przez `formatuj()`, jak w oryginale. */
  render?: (wiersz: T) => ReactNode;
};

export type TabelaAnalitykiProps<T> = {
  dane: T[];
  kolumny: KolumnaTabeli<T>[];
  /** Komunikat pustej tabeli — domyślny tekst 1:1 z oryginału. */
  tekstPusty?: string;
  testId?: string;
};

export function TabelaAnalityki<T extends Record<string, unknown>>({
  dane,
  kolumny,
  tekstPusty = "Brak danych",
  testId,
}: TabelaAnalitykiProps<T>) {
  const widoczne = dane.slice(0, LIMIT_WIERSZY);
  const uciete = dane.length - widoczne.length;

  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {kolumny.map((k) => (
              <th
                key={k.key}
                scope="col"
                className={`${k.right ? "text-right" : "text-left"} px-3 py-2 text-xs font-medium uppercase text-muted-foreground`}
              >
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {widoczne.length === 0 ? (
            <tr>
              <td colSpan={kolumny.length} className="px-3 py-8 text-center text-muted-foreground">
                {tekstPusty}
              </td>
            </tr>
          ) : (
            widoczne.map((wiersz, i) => (
              <tr key={i} className="border-t border-border">
                {kolumny.map((k) => (
                  <td
                    key={k.key}
                    className={`${k.right ? "text-right" : "text-left"} px-3 py-2 align-top ${k.mono ? "font-mono text-xs" : ""}`}
                  >
                    {k.render ? k.render(wiersz) : formatuj(wiersz[k.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {uciete > 0 && (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Pokazano {LIMIT_WIERSZY} z {formatuj(dane.length)} wierszy — zawęź filtry, żeby zobaczyć
          pozostałe {formatuj(uciete)}.
        </div>
      )}
    </div>
  );
}
