import { and, eq, isNotNull, ne, notInArray } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { alertyKataloguStatusy, products } from "../db/schema.js";

/**
 * Statusy obsługi PSEUDO-ALERTÓW KATALOGOWYCH — karta P6.2 (ticket
 * `77-FEATURE-pseudo-alerty-katalogowe`), tabela z migracji `007_alerty_katalogu_statusy.sql`.
 *
 * Same alerty liczy przeglądarka z `GET /api/products` (`pages/alerty/silnik-katalogu.ts`,
 * port `pv()` z żywego bundla na `origin/main`). Serwer zna wyłącznie ich IDENTYFIKATORY
 * i to, co Ania z nimi zrobiła. Oryginał trzymał to w IndexedDB (klucz `alerty-statusy`) —
 * przeniesienie na serwer to świadome odstępstwo (decyzja 2 z 2026-09-21, backlog #26).
 */

/**
 * Status, który da się ZAPISAĆ. `nowy` nie ma wiersza — brak wpisu = „nowy", tak jak
 * `t[o] || "nowy"` w `pv()` — więc ustawienie `nowy` kasuje wpis.
 */
export type StatusZapisywany = "przejrzany" | "rozwiazany";
export type StatusAlertuKatalogu = "nowy" | StatusZapisywany;

export const STATUSY_ALERTU_KATALOGU: readonly StatusAlertuKatalogu[] = [
  "nowy",
  "przejrzany",
  "rozwiazany",
];

/**
 * Identyfikator alertu rozłożony na część STAŁĄ (`klucz`: produkt/dostawca + reguła)
 * i to, do którego produktu należy. Odcisk wartości (marża, `nazwa|kategoria`, dni) zostaje
 * poza kluczem — właśnie po to, żeby nowy odcisk tej samej pary mógł wyprzeć stary.
 */
export type RozbiorIdAlertu = {
  klucz: string;
  produktId: number | null;
};

/**
 * Cztery formy `id`, które produkuje silnik (łatka `ackalerts` pkt 1 z 04.09 — odcisk
 * wartości na końcu):
 *   `${produkt}-marza-ujemna-${Math.round(marzaPct*10)/10}`   np. `12-marza-ujemna--2.5`
 *   `${produkt}-marza-niska-${…}`                              np. `12-marza-niska-3.2`
 *   `${produkt}-nie-opona-${nazwa}|${kategoria}`               nazwa może mieć WSZYSTKO
 *   `dostawca-${kod}-brak-importu-${dni}`
 * `[\s\S]` zamiast `.`, bo nazwa produktu może nieść znak nowej linii z pliku dostawcy.
 */
const ID_PRODUKTOWY = /^(\d+)-(marza-ujemna|marza-niska|nie-opona)-[\s\S]*$/;
const ID_DOSTAWCY = /^(dostawca-[\s\S]+-brak-importu)-\d+$/;

/** `null` = forma, której silnik nie produkuje — trasa odpowiada wtedy 400. */
export function rozbierzIdAlertu(id: string): RozbiorIdAlertu | null {
  const produktowy = ID_PRODUKTOWY.exec(id);
  if (produktowy) {
    const [, produkt = "", regula = ""] = produktowy;
    const produktId = Number(produkt);
    if (!Number.isSafeInteger(produktId)) return null;
    return { klucz: `${produkt}-${regula}`, produktId };
  }
  const klucz = ID_DOSTAWCY.exec(id)?.[1];
  if (klucz) return { klucz, produktId: null };
  return null;
}

/** Wiersz wychodzący przez `GET /api/alerty-katalogu/statusy`. */
export type WpisStatusuKatalogu = {
  id: string;
  status: string;
  kto: string | null;
  kiedy: string;
};

/**
 * Wszystkie zapisane statusy. Projekcja wypisana jawnie (CLAUDE.md, pułapka Drizzle):
 * wychodzą tylko cztery pola, `klucz`/`produkt_id` to wewnętrzna księgowość sprzątania.
 */
export function listStatusyKatalogu(db: Baza): WpisStatusuKatalogu[] {
  return db
    .select({
      id: alertyKataloguStatusy.id,
      status: alertyKataloguStatusy.status,
      kto: alertyKataloguStatusy.uzytkownikImie,
      kiedy: alertyKataloguStatusy.kiedy,
    })
    .from(alertyKataloguStatusy)
    .all();
}

export type Uzytkownik = { id: number | null; imie: string | null };

/**
 * Ustawia jeden status wielu alertom naraz — jedno żądanie obsługuje zarówno przycisk przy
 * alercie, jak i „Zaakceptuj wszystko". Wszystko w JEDNEJ transakcji.
 *
 * SPRZĄTANIE (decyzja Q2 karty, „wypieranie + sierotki"). Odciski wartości sprawiają, że
 * każda zmiana marży daje nowy `id`; bez sprzątania tabela rosłaby bez końca. Dlatego:
 *  1. zapis statusu dla `id` kasuje wpisy o tym samym `klucz` i INNYM `id` — stary odcisk
 *     tej samej pary (produkt/dostawca, reguła) i tak nie ma już żadnego alertu;
 *  2. na końcu kasowane są wpisy produktów, których nie ma już w `products`.
 * Tabela ma więc najwyżej ~jeden wiersz na parę. Świadoma różnica wobec IndexedDB oryginału:
 * gdy marża wróci do DOKŁADNIE starej wartości, alert przyjdzie jako „nowy", a nie ze starym
 * statusem — stary wpis został wyparty.
 *
 * Ustawienie `nowy` kasuje wpis (i też sprząta sierotki). Zwraca liczbę przetworzonych `id`.
 */
export function ustawStatusyKatalogu(
  db: Baza,
  wpisy: ReadonlyArray<{ id: string } & RozbiorIdAlertu>,
  status: StatusAlertuKatalogu,
  uzytkownik: Uzytkownik,
  kiedy: string = new Date().toISOString(),
): number {
  db.transaction((tx) => {
    for (const wpis of wpisy) {
      if (status === "nowy") {
        tx.delete(alertyKataloguStatusy).where(eq(alertyKataloguStatusy.id, wpis.id)).run();
        continue;
      }
      tx.delete(alertyKataloguStatusy)
        .where(
          and(eq(alertyKataloguStatusy.klucz, wpis.klucz), ne(alertyKataloguStatusy.id, wpis.id)),
        )
        .run();
      const wartosci = {
        klucz: wpis.klucz,
        produktId: wpis.produktId,
        status,
        uzytkownikId: uzytkownik.id,
        uzytkownikImie: uzytkownik.imie,
        kiedy,
      };
      tx.insert(alertyKataloguStatusy)
        .values({ id: wpis.id, ...wartosci })
        .onConflictDoUpdate({ target: alertyKataloguStatusy.id, set: wartosci })
        .run();
    }

    tx.delete(alertyKataloguStatusy)
      .where(
        and(
          isNotNull(alertyKataloguStatusy.produktId),
          notInArray(alertyKataloguStatusy.produktId, tx.select({ id: products.id }).from(products)),
        ),
      )
      .run();
  });
  return wpisy.length;
}
