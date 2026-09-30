// Ticket 164-BUG-poprawione-nazwy-sklejonych-opon — naprawa nazw dla produktów, które dzielą
// `kod_importu` z innym produktem tego samego dostawcy (kolizja opisana w
// `docs/rebuild-backlog.md` #108, ticket 119 / karta I15.10).
//
// ⚠ NOWY PROCES, NIE PORT — w oryginale nie istnieje żaden odpowiednik masowego importu
// poprawek. Zapis idzie przez `zapiszPoprawke()` (`manual_overrides`, "Poprawki Marty"), czyli
// dokładnie tę samą drogę, którą Ania poprawia pola ręcznie w panelu — override jest kluczowany
// po (dostawca, kod, pole), więc dwa produkty o wspólnym `kod_importu` dostają swoje własne,
// niezależne poprawki `nazwa`.

import { eq } from "drizzle-orm";
import { parse } from "csv-parse/sync";

import { products } from "../db/schema.js";
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

export type WynikAktualizacjiKatalogu = {
  zaktualizowano: number;
  nieZnaleziono: number;
  bezZmian: number;
};

/**
 * Nadpisuje `products.nazwa` bezpośrednio w katalogu — TAKI SAM efekt jak ręczna edycja
 * pola w panelu (`PUT /api/products/:id`), tylko bez zapisu do `manual_overrides` (bo ten
 * zapis już wykonał `naprawNazwySklejone()`) i bez wpisu w dzienniku zmian (to nie jest
 * akcja jednego użytkownika, tylko wsadowa naprawa danych z tego ticketu).
 *
 * ⚠ PO CO TO ISTNIEJE: `manual_overrides` samo z siebie NIE zmienia tego, co widać w
 * `GET /api/products` — ten mechanizm jest odczytywany dopiero przy kolejnym imporcie/
 * akceptacji stagingu (`fabryka.ts`, `akceptacja.ts`), nie przy zwykłym odczycie. Bez tej
 * funkcji katalog pokazywałby starą, sklejoną nazwę aż do najbliższego cyklu importu — a
 * nawet wtedy akceptacja stagingu może ją cofnąć przez bezwarunkowe `applyNazwaPamiec()`
 * (`akceptacja.ts:204`, port oryginału — luka opisana w `docs/tickets/164-BUG-…/raport.md`).
 * Ta funkcja daje natychmiastowy, pewny efekt: dokładnie taki, jakby Ania wpisała te nazwy
 * ręcznie w panelu, jedna po drugiej.
 */
export function zastosujNazwyWKatalogu(
  db: Baza,
  wiersze: WierszNaprawyNazwy[],
): WynikAktualizacjiKatalogu {
  let zaktualizowano = 0;
  let nieZnaleziono = 0;
  let bezZmian = 0;

  for (const wiersz of wiersze) {
    const nazwa = wiersz.nazwa.trim();
    if (!nazwa) continue;

    const istniejacy = db
      .select({ id: products.id, nazwa: products.nazwa })
      .from(products)
      .where(eq(products.kod, wiersz.kod))
      .get();

    if (!istniejacy) {
      nieZnaleziono++;
      continue;
    }
    if (istniejacy.nazwa === nazwa) {
      bezZmian++;
      continue;
    }

    db.update(products).set({ nazwa }).where(eq(products.id, istniejacy.id)).run();
    zaktualizowano++;
  }

  return { zaktualizowano, nieZnaleziono, bezZmian };
}
