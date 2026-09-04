// Kolejka „pending" atrybutów — tabele `atrybuty_wartosci_pending` i `atrybuty_wartosci_odrzucone`.
//
// Port `mirror/backend/pending_module.cjs` (393 linie, „Faza B Bridge"). Nowe wartości atrybutów
// pojawiające się w `products` po akceptacji stagingu trafiają do kolejki, a Ania je akceptuje,
// edytuje, aliasuje albo odrzuca.
//
// ⚠ ŻADNA z tych operacji NIE PISZE DO AUDYTU — moduł oryginału dostaje z ctx wyłącznie `we`
// (middleware auth), nigdy `be` (`pending_module.cjs:199`). Dotyczy to także akceptacji z edycją
// i aliasu, które robią masowy `UPDATE products`. Odtwarzamy 1:1 (plan.md D4); luka jest opisana
// w raporcie ticketa jako follow-up, nie zasypana po cichu.

import { and, eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { atrybutyWartosciPending } from "../db/schema.js";

/**
 * Mapa rodzaj → kolumna `products` dla kolejki (port `:22-36`, **13 pozycji**).
 *
 * ⚠ RÓŻNI SIĘ od 15-pozycyjnej `RODZAJ_KOLUMNA` w `repos/atrybuty.ts`: ta mapa jest jej
 * dokładnym PODZBIOREM — brakuje dokładnie dwóch pozycji, `model` i `zastosowanie`
 * (`wentyl` i wszystkie pozostałe są w obu). Rozbieżność jest w oryginale
 * — dwa moduły pisano osobno — i decyduje o dwóch rzeczach naraz: co skan w ogóle wykrywa
 * i dla jakich rodzajów zadziała akceptacja przepisująca produkty. Nie unifikujemy (plan.md D6).
 */
export const RODZAJE_KOLUMNY = {
  marka: "marka",
  kategoria: "kategoria",
  konstrukcja: "konstrukcja",
  vfIf: "vf_if",
  rodzaj: "rodzaj",
  sezon: "sezon",
  tl_tt: "tl_tt",
  oznaczenie_bieznika: "oznaczenie_bieznika",
  bieznik: "bieznik",
  wentyl: "wentyl",
  rozmiar: "rozmiar",
  indeks_nosnosci: "indeks_nosnosci",
  indeks_predkosci: "indeks_predkosci",
} as const satisfies Record<string, string>;

export type RodzajPending = keyof typeof RODZAJE_KOLUMNY;

/** Czy rodzaj pozycji pending ma odpowiednik w `products` (`:283-284`, `:326-327`). */
export function kolumnaRodzaju(rodzaj: string): string | undefined {
  return Object.hasOwn(RODZAJE_KOLUMNY, rodzaj)
    ? RODZAJE_KOLUMNY[rodzaj as RodzajPending]
    : undefined;
}

/**
 * Odległość Levenshteina, pełna macierz DP (port `:41-55`).
 *
 * Bez optymalizacji na dwa wiersze i bez wczesnego wyjścia — tak jak w oryginale. Liczy się
 * to dla KAŻDEJ pary (pozycja pending × wartość katalogu tego rodzaju) przy każdym `GET
 * /api/atrybuty/pending`, więc koszt jest kwadratowy względem rozmiaru słownika. Zastane.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const koszt = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + koszt);
    }
  }
  return dp[m]![n]!;
}

/**
 * Podobieństwo 0..1 (port `similarity`, `:57-62`).
 *
 * ⚠ BEZ normalizacji wielkości liter i białych znaków — „BKT" i „bkt" mają podobieństwo 0,
 * bo każda litera się różni. Oryginał porównuje surowe napisy i tak zostaje.
 */
export function podobienstwo(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxDlugosc = Math.max(a.length, b.length);
  if (!maxDlugosc) return 1;
  return 1 - levenshtein(a, b) / maxDlugosc;
}

/**
 * Reguła sugerowania aliasu (port `shouldSuggestAlias`, `:65-72`): podobieństwo ≥ 0,9
 * ORAZ różnica NIE polega wyłącznie na plusach.
 *
 * Wyjątek na `+` jest merytoryczny: w oponach „150A8+" to inny produkt niż „150A8", więc
 * podpowiadanie tu aliasu prowadziłoby do sklejenia dwóch różnych rzeczy. Napis identyczny
 * z kanoniczną przechodzi (warunek `nowa !== kanoniczna` w `:70`) — stąd w nagraniu produkcji
 * sugestie o `podobienstwo: 100` dla wartości, która jest już w katalogu.
 */
export function czySugerowacAlias(nowa: string, kanoniczna: string): boolean {
  const sim = podobienstwo(nowa, kanoniczna);
  if (sim < 0.9) return false;
  const bezPlusowNowa = nowa.replace(/\+/g, "");
  const bezPlusowKanoniczna = kanoniczna.replace(/\+/g, "");
  if (bezPlusowNowa === bezPlusowKanoniczna && nowa !== kanoniczna) return false;
  return true;
}

/** Sugestia aliasu w odpowiedzi (`:239`). `podobienstwo` to procent, nie ułamek. */
export type SugestiaAliasu = {
  wartosc: string;
  podobienstwo: number;
};

/** Pozycja kolejki bez sugestii — surowy wiersz tabeli (`:221-222`). */
export type PozycjaPending = {
  id: number;
  rodzaj: string;
  wartosc: string;
  ile_wystapien: number;
  pierwszy_import: string;
  ostatni_import: string;
  dostawcy: string | null;
};

/** Pozycja kolejki w odpowiedzi API (`:243`). */
export type PozycjaPendingZAliasami = PozycjaPending & {
  sugerowane_aliasy: SugestiaAliasu[];
};

/** Ile sugestii wraca na pozycję (`slice(0, 5)`, `:243`). */
const MAKS_SUGESTII = 5;

/**
 * Lista kolejki z podpowiedziami aliasów (`:218-250`).
 *
 * ⚠ BEZ LIMITU I PAGINACJI, a `count` to po prostu długość zwróconej listy (`:246`) —
 * w nagraniu produkcji to 498 pozycji. Front 7b nie ma tu mechanizmu stronicowania.
 */
export function listaPending(db: Baza, rodzajFiltr?: string): PozycjaPendingZAliasami[] {
  const pozycje = rodzajFiltr
    ? db.all<PozycjaPending>(sql`
        SELECT id, rodzaj, wartosc, ile_wystapien, pierwszy_import, ostatni_import, dostawcy
        FROM atrybuty_wartosci_pending
        WHERE rodzaj = ${rodzajFiltr}
        ORDER BY rodzaj, ile_wystapien DESC, wartosc
      `)
    : db.all<PozycjaPending>(sql`
        SELECT id, rodzaj, wartosc, ile_wystapien, pierwszy_import, ostatni_import, dostawcy
        FROM atrybuty_wartosci_pending
        ORDER BY rodzaj, ile_wystapien DESC, wartosc
      `);

  return pozycje.map((pozycja) => {
    const kandydaci = db.all<{ wartosc: string }>(sql`
      SELECT wartosc FROM atrybuty_wartosci WHERE rodzaj = ${pozycja.rodzaj}
    `);
    const aliasy: SugestiaAliasu[] = [];
    for (const kandydat of kandydaci) {
      if (czySugerowacAlias(pozycja.wartosc, kandydat.wartosc)) {
        aliasy.push({
          wartosc: kandydat.wartosc,
          podobienstwo: Math.round(podobienstwo(pozycja.wartosc, kandydat.wartosc) * 100),
        });
      }
    }
    aliasy.sort((a, b) => b.podobienstwo - a.podobienstwo);
    return { ...pozycja, sugerowane_aliasy: aliasy.slice(0, MAKS_SUGESTII) };
  });
}

/** Pozycja kolejki po `id` — wszystkie cztery akcje zaczynają od tego sprawdzenia. */
export function pozycjaPendingPoId(
  db: Baza,
  id: number,
): { rodzaj: string; wartosc: string } | undefined {
  return db
    .select({ rodzaj: atrybutyWartosciPending.rodzaj, wartosc: atrybutyWartosciPending.wartosc })
    .from(atrybutyWartosciPending)
    .where(eq(atrybutyWartosciPending.id, id))
    .get();
}

/** Statystyki skanu (`:78`) — wracają wprost w ciele `POST /api/atrybuty/scan-pending`. */
export type StatystykiSkanu = {
  skanowano_rodzajow: number;
  nowych_wartosci: number;
  zaktualizowano: number;
};

/**
 * Skan `products` w poszukiwaniu wartości spoza słownika (port `scanForNewValues`, `:77-138`).
 *
 * Źródłem jest tabela `products`, NIE staging — skan patrzy na stan po akceptacji, nie na to,
 * co dopiero czeka. Dla każdego z 13 rodzajów: grupowanie po kolumnie, pominięcie wartości
 * obecnych w słowniku i w odrzuconych, wstawienie nowej pozycji albo aktualizacja istniejącej.
 *
 * ⚠ Filtr `dostawca != 'MO6'` jest w oryginale (`:91`) — MO6 jest w Bridge celowo pomijany.
 * Warunek `dostawca IS NULL OR …` przepuszcza wiersze bez dostawcy, choć kolumna jest NOT NULL;
 * to defensywa oryginału, zostaje.
 *
 * ⚠ Skan NIE CZYŚCI kolejki i nie usuwa pozycji, które zdążyły trafić do słownika inną drogą
 * (np. przez seed). Stąd w nagraniu produkcji pozycje pending sugerujące same siebie ze
 * `podobienstwo: 100` — patrz `zasiejSlownikAtrybutow` w `repos/atrybuty.ts`.
 *
 * ⚠ `pierwszy_import` przy aktualizacji ZOSTAJE nietknięty (`:122-124`) — to znacznik pierwszego
 * zauważenia wartości, nie ostatniego.
 *
 * ⚠ Błąd pojedynczego rodzaju jest logowany i pomijany (`continue`, `:94-97`), więc skan zwraca
 * 200 nawet gdy któraś kolumna zniknie ze schematu.
 */
export function skanujNoweWartosci(db: Baza): StatystykiSkanu {
  const staty: StatystykiSkanu = {
    skanowano_rodzajow: 0,
    nowych_wartosci: 0,
    zaktualizowano: 0,
  };

  for (const [rodzaj, kolumna] of Object.entries(RODZAJE_KOLUMNY)) {
    staty.skanowano_rodzajow++;
    const kol = sql.raw(kolumna);
    let wiersze: { wartosc: string; ile: number; dostawcy: string | null }[];
    try {
      wiersze = db.all<{ wartosc: string; ile: number; dostawcy: string | null }>(sql`
        SELECT ${kol} AS wartosc,
               COUNT(*) AS ile,
               GROUP_CONCAT(DISTINCT dostawca) AS dostawcy
        FROM products
        WHERE ${kol} IS NOT NULL
          AND TRIM(${kol}) != ''
          AND (dostawca IS NULL OR dostawca != 'MO6')
        GROUP BY ${kol}
      `);
    } catch (blad) {
      console.error(
        `[pending] skan rodzaj=${rodzaj} kolumna=${kolumna} błąd:`,
        blad instanceof Error ? blad.message : blad,
      );
      continue;
    }

    for (const wiersz of wiersze) {
      const wartosc = String(wiersz.wartosc).trim();
      if (!wartosc) continue;

      const wKatalogu = db.get<{ jeden: number }>(sql`
        SELECT 1 AS jeden FROM atrybuty_wartosci
        WHERE rodzaj = ${rodzaj} AND wartosc = ${wartosc} LIMIT 1
      `);
      if (wKatalogu) continue;

      const wOdrzuconych = db.get<{ jeden: number }>(sql`
        SELECT 1 AS jeden FROM atrybuty_wartosci_odrzucone
        WHERE rodzaj = ${rodzaj} AND wartosc = ${wartosc} LIMIT 1
      `);
      if (wOdrzuconych) continue;

      const wKolejce = db
        .select({ id: atrybutyWartosciPending.id })
        .from(atrybutyWartosciPending)
        .where(
          and(
            eq(atrybutyWartosciPending.rodzaj, rodzaj),
            eq(atrybutyWartosciPending.wartosc, wartosc),
          ),
        )
        .get();

      if (wKolejce) {
        db.run(sql`
          UPDATE atrybuty_wartosci_pending
          SET ile_wystapien = ${wiersz.ile},
              ostatni_import = datetime('now'),
              dostawcy = ${wiersz.dostawcy ?? ""}
          WHERE id = ${wKolejce.id}
        `);
        staty.zaktualizowano++;
      } else {
        db.run(sql`
          INSERT INTO atrybuty_wartosci_pending (rodzaj, wartosc, ile_wystapien, dostawcy)
          VALUES (${rodzaj}, ${wartosc}, ${wiersz.ile}, ${wiersz.dostawcy ?? ""})
        `);
        staty.nowych_wartosci++;
      }
    }
  }

  return staty;
}

/**
 * Akceptacja zwykła (`:253-270`): wartość ląduje w słowniku z `origin = 'user'`, pozycja znika
 * z kolejki. `INSERT OR IGNORE`, bo wartość mogła w międzyczasie trafić do słownika inną drogą.
 *
 * ⚠ NIE RUSZA `products` — to jedyny z trzech wariantów akceptacji, który nie przepisuje danych.
 */
export function akceptujPending(db: Baza, id: number, rodzaj: string, wartosc: string): void {
  db.transaction((tx) => {
    tx.run(sql`
      INSERT OR IGNORE INTO atrybuty_wartosci (rodzaj, wartosc, origin)
      VALUES (${rodzaj}, ${wartosc}, 'user')
    `);
    tx.run(sql`DELETE FROM atrybuty_wartosci_pending WHERE id = ${id}`);
  });
}

/**
 * Akceptacja z edycją (`:274-307`): poprawiona wartość zastępuje starą w `products`, wchodzi
 * do słownika i pozycja znika z kolejki. Zwraca liczbę przepisanych produktów.
 *
 * Kolejność kroków jest z oryginału (UPDATE → INSERT → DELETE); całość w jednej transakcji,
 * więc nieudany krok nie zostawia słownika bez produktów ani odwrotnie.
 */
export function akceptujZEdycja(
  db: Baza,
  arg: { id: number; rodzaj: string; kolumna: string; stara: string; nowa: string },
): number {
  const kol = sql.raw(arg.kolumna);
  return db.transaction((tx) => {
    const wynik = tx.run(sql`UPDATE products SET ${kol} = ${arg.nowa} WHERE ${kol} = ${arg.stara}`);
    tx.run(sql`
      INSERT OR IGNORE INTO atrybuty_wartosci (rodzaj, wartosc, origin)
      VALUES (${arg.rodzaj}, ${arg.nowa}, 'user')
    `);
    tx.run(sql`DELETE FROM atrybuty_wartosci_pending WHERE id = ${arg.id}`);
    return wynik.changes;
  });
}

/**
 * Akceptacja jako alias (`:311-342`): produkty dostają wartość kanoniczną, pozycja znika
 * z kolejki. Zwraca liczbę przepisanych produktów.
 *
 * ⚠ NIE MA ŻADNEJ TABELI ALIASÓW. „Alias" to jednorazowe przepisanie `products` — mapowanie
 * nigdzie nie zostaje, więc jeśli ta sama błędna wartość przyjdzie kolejnym importem, wróci
 * do kolejki i Ania musi ją zaaliasować ponownie. Wartość aliasowana NIE trafia do słownika
 * (to jedyna różnica wobec akceptacji z edycją, która ją tam wstawia).
 */
export function akceptujJakoAlias(
  db: Baza,
  arg: { id: number; kolumna: string; stara: string; kanoniczna: string },
): number {
  const kol = sql.raw(arg.kolumna);
  return db.transaction((tx) => {
    const wynik = tx.run(
      sql`UPDATE products SET ${kol} = ${arg.kanoniczna} WHERE ${kol} = ${arg.stara}`,
    );
    tx.run(sql`DELETE FROM atrybuty_wartosci_pending WHERE id = ${arg.id}`);
    return wynik.changes;
  });
}

/**
 * Odrzucenie (`:345-362`): wartość ląduje w `atrybuty_wartosci_odrzucone` i znika z kolejki.
 * Kolejne skany będą ją pomijać (`skanujNoweWartosci`), więc odrzucenie jest trwałe —
 * cofa je dopiero ręczne usunięcie wiersza z tabeli odrzuconych.
 */
export function odrzucPending(db: Baza, id: number, rodzaj: string, wartosc: string): void {
  db.transaction((tx) => {
    tx.run(sql`
      INSERT OR IGNORE INTO atrybuty_wartosci_odrzucone (rodzaj, wartosc)
      VALUES (${rodzaj}, ${wartosc})
    `);
    tx.run(sql`DELETE FROM atrybuty_wartosci_pending WHERE id = ${id}`);
  });
}

/**
 * Wyczyszczenie kolejki (`:377-390`), opcjonalnie jednego rodzaju. Zwraca liczbę usuniętych.
 *
 * ⚠ BEZ wpisu do odrzuconych — to znaczy, że wyczyszczone wartości WRÓCĄ do kolejki przy
 * kolejnym skanie, jeśli produkty wciąż je zawierają. To „schowaj na razie", nie „odrzuć".
 */
export function wyczyscPending(db: Baza, rodzaj?: string): number {
  const wynik = rodzaj
    ? db.run(sql`DELETE FROM atrybuty_wartosci_pending WHERE rodzaj = ${rodzaj}`)
    : db.run(sql`DELETE FROM atrybuty_wartosci_pending`);
  return wynik.changes;
}
