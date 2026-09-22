/**
 * Dziesięć zapytań `GET /api/analytics/export/{view}` — port `analytics_module.cjs:311-320`
 * (blok 10f, ostatnia z 27 tras modułu analityki).
 *
 * ⚠ TO NIE SĄ TE SAME DANE, CO NA DASHBOARDZIE. Każdy widok eksportu ma WŁASNY SQL, inny niż
 * trasa dashboardu o tej samej nazwie — eksport nie jest „tą samą odpowiedzią w innym
 * formacie". Dwa dowody, oba dosłowne:
 *
 *   • `GET /api/analytics/margins` (`:98`) grupuje po trzech wymiarach i oddaje
 *     `dostawca, kategoria, marka, produkty, avgMarza, minMarza, maxMarza` (LIMIT 1000).
 *     `export/margins` (`:319`) oddaje wiersze PER PRODUKT — `kod, nazwa, dostawca,
 *     kategoria, marka, marza_pct` — bez grupowania, LIMIT 5000.
 *   • `GET /api/analytics/suppliers/stability` (`:110`) ma gałąź zapasową na `products`,
 *     gdy historii nie ma. `export/suppliers-stability` (`:311`) liczy ZAWSZE z `historia_cen`
 *     i oddaje inne kolumny (`produkty, punkty, sredniaCena, sredniStan`).
 *
 * Dlatego każdy widok jest tu portowany osobno, ze swojego zapytania. Budowanie CSV z danych,
 * które sekcja frontu ma już w pamięci, dałoby inne liczby niż produkcja.
 *
 * ⚠ LIMIT 5000 MA TYLKO SZEŚĆ Z DZIESIĘCIU WIDOKÓW. `suppliers-stability`, `suppliers-stock`,
 * `ean-comparison` i `unique` nie mają w oryginale ŻADNEGO limitu (`:311`, `:313-315`).
 * Opis bloku w roadmapie uogólniał to niedokładnie; wzorcem jest SQL, nie opis. Dokładanie
 * limitu, którego oryginał nie ma, ucięłoby eksport dostawców i EAN-ów bez uprzedzenia.
 *
 * ⚠ DWA WIDOKI SĄ W PRODUKCJI TRWALE PUSTE, A TU — OD P10.1 — JUŻ NIE. `availability-products`
 * (`:316`) i `sell-through` (`:317`) pytają w oryginale `historia_cen` o kolumnę `nazwa`,
 * której ta tabela NIE MA (schemat: `rebuild/schema/001_schema.sql`, `db/schema.sql`,
 * `analytics_module.cjs:24-49`). SQLite odpowiada `no such column: nazwa`, `safeAll` połyka
 * wyjątek i produkcja oddaje plik CSV złożony z samego BOM-u — ta sama usterka co w kartach
 * „4.1"/„4.2" dashboardu (`docs/rebuild-backlog.md` #32). Odbudowa oba widoki NAPRAWIA
 * (decyzja Ani 2026-09-21, ticket 90): nazwa z katalogu po `dostawca` + `kod`, a `sell-through`
 * dodatkowo liczy spadki na historii ze zwiniętymi duplikatami klucza (#33).
 */
import { sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { bezpiecznieWiersze, HISTORIA_BEZ_DUPLIKATOW_KLUCZA } from "./analityka.js";

/** Limit sześciu z dziesięciu zapytań (`:312`, `:316-320`). Pozostałe cztery nie mają żadnego. */
const LIMIT_EKSPORTU = 5000;

/** Wiersz `export/suppliers-stability` (`:311`) — INNE kolumny niż dashboard `suppliers/stability`. */
export type WierszEksportuStabilnosci = {
  dostawca: string;
  produkty: number;
  punkty: number;
  sredniaCena: number | null;
  sredniStan: number | null;
};

/** Wiersz `export/suppliers-lifecycle` (`:312`). */
export type WierszEksportuCykluZycia = {
  typ: string;
  dostawca: string;
  kod: string;
  nazwa: string;
  powod: string | null;
  kiedy: string;
};

/** Wiersz `export/suppliers-stock` (`:313`). */
export type WierszEksportuStanu = {
  dostawca: string;
  produkty: number;
  sredniStan: number | null;
  dostepne: number;
  dostepnoscPct: number | null;
};

/** Wiersz `export/ean-comparison` (`:314`). */
export type WierszEksportuPorownaniaEan = {
  ean: string;
  nazwa: string | null;
  dostawcy: number;
  cenaMin: number | null;
  cenaMax: number | null;
  spreadZl: number | null;
  spreadPct: number | null;
};

/** Wiersz `export/unique` (`:315`). */
export type WierszEksportuUnikalnych = {
  ean: string;
  nazwa: string | null;
  dostawca: string | null;
  cenaZakupu: number | null;
  stan: number | null;
};

/** Wiersz `export/prices-last` (`:316`). */
export type WierszEksportuOstatnichCen = {
  utworzono: string;
  dostawca: string;
  kod: string;
  nazwa: string;
  cenaStara: number | null;
  cenaNowa: number | null;
  zmianaPct: number | null;
};

/** Wiersz `export/availability-products` (`:316`) — w produkcji nigdy nie powstaje (#32). */
export type WierszEksportuDostepnosci = {
  dostawca: string;
  kod: string;
  ean: string | null;
  /** Z katalogu po `dostawca` + `kod`; `null` (pusta komórka CSV), gdy pozycji już nie ma. */
  nazwa: string | null;
  dostepnoscPct: number | null;
};

/** Wiersz `export/sell-through` (`:317`) — w produkcji nigdy nie powstaje (#32). */
export type WierszEksportuTempaSchodzenia = {
  dostawca: string;
  kod: string;
  /** Z katalogu po `dostawca` + `kod`; `null` (pusta komórka CSV), gdy pozycji już nie ma. */
  nazwa: string | null;
  zeszloSztuk: number | null;
};

/** Wiersz `export/margins` (`:319`) — PER PRODUKT, inaczej niż zgrupowany dashboard. */
export type WierszEksportuMarz = {
  kod: string;
  nazwa: string;
  dostawca: string;
  kategoria: string | null;
  marka: string | null;
  marza_pct: number | null;
};

/** Wiersz `export/rotation-inactive` (`:320`) — BEZ filtra `?days`, inaczej niż dashboard. */
export type WierszEksportuRotacji = {
  kod: string;
  nazwa: string;
  dostawca: string;
  marka: string | null;
  model: string | null;
  rozmiar: string | null;
  stan: number | null;
  ostatniaAktualizacja: string | null;
};

/**
 * `export/suppliers-stability` (`:311`) — bez LIMIT-u i bez gałęzi zapasowej.
 *
 * `COUNT(DISTINCT produkt_id)` liczy produkty po kolumnie, która w `historia_cen` bywa `NULL`
 * (jest nullowalna w schemacie) — `COUNT(DISTINCT …)` pomija wtedy wiersz. Port dosłowny.
 */
export function eksportStabilnosciDostawcow(db: Baza): WierszEksportuStabilnosci[] {
  return bezpiecznieWiersze<WierszEksportuStabilnosci>(
    db,
    sql`
      SELECT dostawca,
             COUNT(DISTINCT produkt_id) AS produkty,
             COUNT(*) AS punkty,
             ROUND(AVG(cena_zakupu), 2) AS sredniaCena,
             ROUND(AVG(stan), 2) AS sredniStan
      FROM historia_cen
      GROUP BY dostawca
      ORDER BY dostawca
    `,
  );
}

/**
 * `export/suppliers-lifecycle` (`:312`).
 *
 * Czterowartościowe `IN ('nowa','nowy','wycofana','zniknal')` jest portem dosłownym —
 * oryginał wypisuje obie formy rodzajowe, bo import zapisywał je niejednolicie.
 */
export function eksportCykluZyciaDostawcow(db: Baza): WierszEksportuCykluZycia[] {
  return bezpiecznieWiersze<WierszEksportuCykluZycia>(
    db,
    sql`
      SELECT typ_zmiany AS typ, dostawca, kod, nazwa, powod, utworzono AS kiedy
      FROM staging_items
      WHERE typ_zmiany IN ('nowa', 'nowy', 'wycofana', 'zniknal')
      ORDER BY utworzono DESC
      LIMIT ${LIMIT_EKSPORTU}
    `,
  );
}

/** `export/suppliers-stock` (`:313`) — bez LIMIT-u. */
export function eksportStanuDostawcow(db: Baza): WierszEksportuStanu[] {
  return bezpiecznieWiersze<WierszEksportuStanu>(
    db,
    sql`
      SELECT dostawca,
             COUNT(*) AS produkty,
             ROUND(AVG(stan), 2) AS sredniStan,
             SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) AS dostepne,
             ROUND(100.0 * SUM(CASE WHEN stan > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS dostepnoscPct
      FROM products
      WHERE status = 'aktywny'
      GROUP BY dostawca
      ORDER BY dostawca
    `,
  );
}

/**
 * `export/ean-comparison` (`:314`) — bez LIMIT-u i BEZ `ORDER BY`.
 *
 * Dashboard `ean/comparison` sortuje po spreadzie i tnie do 200; eksport nie robi ani jednego,
 * ani drugiego. Kolejność wierszy jest więc taka, jaką da SQLite dla `GROUP BY ean` — port 1:1.
 */
export function eksportPorownaniaEan(db: Baza): WierszEksportuPorownaniaEan[] {
  return bezpiecznieWiersze<WierszEksportuPorownaniaEan>(
    db,
    sql`
      SELECT ean,
             MAX(nazwa) AS nazwa,
             COUNT(DISTINCT dostawca) AS dostawcy,
             MIN(cena_zakupu) AS cenaMin,
             MAX(cena_zakupu) AS cenaMax,
             ROUND(MAX(cena_zakupu) - MIN(cena_zakupu), 2) AS spreadZl,
             ROUND((MAX(cena_zakupu) - MIN(cena_zakupu)) * 100.0 / NULLIF(MIN(cena_zakupu), 0), 2) AS spreadPct
      FROM products
      WHERE status = 'aktywny' AND ean IS NOT NULL AND ean != ''
      GROUP BY ean
      HAVING COUNT(DISTINCT dostawca) >= 2
    `,
  );
}

/** `export/unique` (`:315`) — pozycje z EAN-em u dokładnie jednego dostawcy, bez LIMIT-u. */
export function eksportUnikalnychEan(db: Baza): WierszEksportuUnikalnych[] {
  return bezpiecznieWiersze<WierszEksportuUnikalnych>(
    db,
    sql`
      SELECT ean,
             MAX(nazwa) AS nazwa,
             MAX(dostawca) AS dostawca,
             MAX(cena_zakupu) AS cenaZakupu,
             MAX(stan) AS stan
      FROM products
      WHERE status = 'aktywny' AND ean IS NOT NULL AND ean != ''
      GROUP BY ean
      HAVING COUNT(DISTINCT dostawca) = 1
    `,
  );
}

/** `export/prices-last` (`:316`) — zmiany cen ze stagingu, karta „3.1". */
export function eksportOstatnichCen(db: Baza): WierszEksportuOstatnichCen[] {
  return bezpiecznieWiersze<WierszEksportuOstatnichCen>(
    db,
    sql`
      SELECT utworzono, dostawca, kod, nazwa,
             cena_zakupu_stara AS cenaStara,
             cena_zakupu_nowa AS cenaNowa,
             zmiana_pct AS zmianaPct
      FROM staging_items
      WHERE cena_zakupu_stara IS NOT NULL
      ORDER BY utworzono DESC
      LIMIT ${LIMIT_EKSPORTU}
    `,
  );
}

/**
 * `export/availability-products` (`:316`) — w produkcji ZAWSZE PUSTE, tu naprawione.
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO (backlog #32, decyzja Ani 2026-09-21, ticket 90). W oryginale `nazwa`
 * nie istnieje w `historia_cen`, zapytanie się wywraca i plik CSV to sam BOM. Tu nazwa idzie
 * z `LEFT JOIN products` po `dostawca` + `kod`. Grupowanie oryginału zostaje — łącznie z `ean`
 * (para `dostawca` + `kod` z dwoma różnymi EAN-ami w historii daje dwa wiersze; na snapshocie
 * produkcji: 5193 wiersze na 5184 pary); `p.nazwa` w `GROUP BY` jest funkcją pary, więc
 * niczego nie rozbija.
 */
export function eksportDostepnosciProduktow(db: Baza): WierszEksportuDostepnosci[] {
  return bezpiecznieWiersze<WierszEksportuDostepnosci>(
    db,
    sql`
      SELECT h.dostawca, h.kod, h.ean, p.nazwa,
             ROUND(100.0 * SUM(CASE WHEN h.stan > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS dostepnoscPct
      FROM historia_cen h
      LEFT JOIN products p ON p.dostawca = h.dostawca AND p.kod = h.kod
      GROUP BY h.dostawca, h.kod, h.ean, p.nazwa
      ORDER BY dostepnoscPct ASC
      LIMIT ${LIMIT_EKSPORTU}
    `,
  );
}

/**
 * `export/sell-through` (`:317`) — w produkcji ZAWSZE PUSTE, tu naprawione w dwóch miejscach.
 *
 * ⚠ DWA ŚWIADOME ODSTĘPSTWA (decyzje 2026-09-21, ticket 90), te same co w karcie „4.2":
 * 1. `MAX(nazwa)` oryginału odwołuje się do kolumny, której `historia_cen` nie ma, i wywraca
 *    zapytanie (#32) — tu nazwa idzie z `LEFT JOIN products` po `dostawca` + `kod`.
 * 2. `LAG(stan) OVER (…)` liczy się w oryginale na surowym `SELECT h.*`, gdzie duplikat klucza
 *    `(dostawca, kod, zarejestrowano_at)` daje kolejność zależną od implementacji (#33) —
 *    tu na `HISTORIA_BEZ_DUPLIKATOW_KLUCZA` (z duplikatów wiersz o `MAX(id)`).
 *
 * `MAX(0, …)` to dwuargumentowy `max` skalarny SQLite, nie agregat — zeruje wzrosty stanu,
 * żeby liczyć wyłącznie spadki. Ta formuła i reszta zapytania — bez zmian wobec oryginału.
 */
export function eksportTempaSchodzenia(db: Baza): WierszEksportuTempaSchodzenia[] {
  return bezpiecznieWiersze<WierszEksportuTempaSchodzenia>(
    db,
    sql`
      WITH zwiniete AS (${HISTORIA_BEZ_DUPLIKATOW_KLUCZA})
      SELECT t.dostawca, t.kod, MAX(p.nazwa) AS nazwa, SUM(t.spadek) AS zeszloSztuk
      FROM (
        SELECT z.dostawca, z.kod,
               MAX(0, LAG(z.stan) OVER (PARTITION BY z.dostawca, z.kod ORDER BY z.zarejestrowano_at) - z.stan) AS spadek
        FROM zwiniete z
      ) t
      LEFT JOIN products p ON p.dostawca = t.dostawca AND p.kod = t.kod
      GROUP BY t.dostawca, t.kod
      ORDER BY zeszloSztuk DESC
      LIMIT ${LIMIT_EKSPORTU}
    `,
  );
}

/**
 * `export/margins` (`:319`) — wiersze PER PRODUKT, nie zgrupowane jak dashboard `/margins`.
 *
 * Kolumna wychodzi jako `marza_pct` (bez aliasu), więc nagłówek CSV brzmi `marza_pct`,
 * a nie `marzaPct` — jedyny widok eksportu z nazwą kolumny w snake_case. Port dosłowny:
 * to ta nazwa trafia do pliku, który Ania otwiera w Excelu.
 */
export function eksportMarz(db: Baza): WierszEksportuMarz[] {
  return bezpiecznieWiersze<WierszEksportuMarz>(
    db,
    sql`
      SELECT kod, nazwa, dostawca, kategoria, marka, marza_pct
      FROM products
      WHERE status = 'aktywny'
      ORDER BY marza_pct ASC
      LIMIT ${LIMIT_EKSPORTU}
    `,
  );
}

/**
 * `export/rotation-inactive` (`:320`) — CAŁY aktywny katalog, bez progu dni.
 *
 * Dashboard `rotation/inactive` przyjmuje `?days` i zwraca tylko pozycje starsze niż próg;
 * eksport parametru nie czyta w ogóle (`M()` nie dokleja query stringu) i oddaje wszystko,
 * posortowane od najdawniej aktualizowanych. To nie jest ten sam zbiór wierszy.
 */
export function eksportRotacji(db: Baza): WierszEksportuRotacji[] {
  return bezpiecznieWiersze<WierszEksportuRotacji>(
    db,
    sql`
      SELECT kod, nazwa, dostawca, marka, model, rozmiar, stan,
             data_aktualizacji AS ostatniaAktualizacja
      FROM products
      WHERE status = 'aktywny'
      ORDER BY data_aktualizacji ASC
      LIMIT ${LIMIT_EKSPORTU}
    `,
  );
}

/**
 * Nazwy `{view}`, które obsługuje oryginał (`:311-320`) — dokładnie te dziesięć, które woła
 * `M()` z frontu (`frontend-index.js:28065`…`:28573`).
 *
 * Mapa jest JEDYNĄ listą dozwolonych wartości — czyta ją `widokEksportu()` niżej, a przez nią
 * trasa. Nie dopisuj drugiej listy w trasie ani w testach.
 */
export const WIDOKI_EKSPORTU: Record<string, (db: Baza) => Record<string, unknown>[]> = {
  "suppliers-stability": eksportStabilnosciDostawcow,
  "suppliers-lifecycle": eksportCykluZyciaDostawcow,
  "suppliers-stock": eksportStanuDostawcow,
  "ean-comparison": eksportPorownaniaEan,
  unique: eksportUnikalnychEan,
  "prices-last": eksportOstatnichCen,
  "availability-products": eksportDostepnosciProduktow,
  "sell-through": eksportTempaSchodzenia,
  margins: eksportMarz,
  "rotation-inactive": eksportRotacji,
};

/** Nazwy widoków w kolejności z oryginału — używane przez testy i front. */
export const NAZWY_WIDOKOW_EKSPORTU = Object.keys(WIDOKI_EKSPORTU);

/**
 * Zapytanie widoku o danej nazwie albo `undefined`, gdy takiego widoku nie ma.
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO (backlog #35, decyzja użytkownika 2026-09-21, ticket 90): nieznany
 * widok to w trasie 404, nie `return sendRows([])` oryginału (`:321`, 200 z samym BOM-em).
 *
 * `Object.hasOwn`, nie `WIDOKI_EKSPORTU[nazwa]`: mapa jest zwykłym literałem obiektu, więc
 * odczyt przez nawias „znalazłby" też `toString` czy `constructor` z prototypu i trasa
 * wywołałaby je jak zapytanie.
 */
export function widokEksportu(
  nazwa: string,
): ((db: Baza) => Record<string, unknown>[]) | undefined {
  return Object.hasOwn(WIDOKI_EKSPORTU, nazwa) ? WIDOKI_EKSPORTU[nazwa] : undefined;
}
