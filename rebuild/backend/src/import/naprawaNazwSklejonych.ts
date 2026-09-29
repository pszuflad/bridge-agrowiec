// Ticket 164-BUG-poprawione-nazwy-sklejonych-opon — naprawa nazw dla produktów, które dzielą
// `kod_importu` z innym produktem tego samego dostawcy (kolizja opisana w
// `docs/rebuild-backlog.md` #108, ticket 119 / karta I15.10).
//
// ⚠ NOWY PROCES, NIE PORT — w oryginale nie istnieje żaden odpowiednik masowego importu
// poprawek. Zapis idzie przez `zapiszPoprawke()` (`manual_overrides`, "Poprawki Marty"), czyli
// dokładnie tę samą drogę, którą Ania poprawia pola ręcznie w panelu — override jest kluczowany
// po (dostawca, kod, pole), więc dwa produkty o wspólnym `kod_importu` dostają swoje własne,
// niezależne poprawki `nazwa`.

import { parse } from "csv-parse/sync";

import { zapiszPoprawke } from "../repos/overrides.js";
import type { Baza } from "../db/index.js";

export type WierszNaprawyNazwy = {
  dostawca: string;
  kod: string;
  nazwa: string;
};

/** Parsuje CSV z kolumnami `dostawca,kod,nazwa,...` — pozostałe kolumny są ignorowane. */
export function sparsujWierszeNaprawy(csvText: string): WierszNaprawyNazwy[] {
  const rekordy = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return rekordy
    .filter((r) => r.dostawca && r.kod && r.nazwa)
    .map((r) => ({ dostawca: r.dostawca!, kod: r.kod!, nazwa: r.nazwa! }));
}

export type WynikNaprawyNazwy = {
  przetworzono: number;
  pominietoPusteNazwy: number;
};

/**
 * Zapisuje poprawki `nazwa` dla wierszy z pliku jako `manual_overrides`
 * (dostawca, kod, fieldName="nazwa"). Upsert — powtórne uruchomienie z tym samym plikiem
 * jest bezpieczne (nadpisze te same wartości).
 */
export function naprawNazwySklejone(
  db: Baza,
  wiersze: WierszNaprawyNazwy[],
  opts: { reason: string; createdAt?: string },
): WynikNaprawyNazwy {
  let przetworzono = 0;
  let pominietoPusteNazwy = 0;
  // Jeden wspólny znacznik czasu dla całego przebiegu (nie per wiersz) — pozwala potem
  // odróżnić "ten sam import" po `createdAt`, gdyby ktoś tego szukał w manual_overrides.
  const createdAt = opts.createdAt ?? new Date().toISOString();

  for (const wiersz of wiersze) {
    const nazwa = wiersz.nazwa.trim();
    if (!nazwa) {
      pominietoPusteNazwy++;
      continue;
    }

    zapiszPoprawke(db, {
      supplierKod: wiersz.dostawca,
      supplierProductId: wiersz.kod,
      fieldName: "nazwa",
      overrideValue: nazwa,
      reason: opts.reason,
      createdBy: null,
      createdAt,
    });
    przetworzono++;
  }

  return { przetworzono, pominietoPusteNazwy };
}
