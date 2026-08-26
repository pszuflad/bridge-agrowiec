import { and, desc, eq, getTableColumns, like, or, sql, type SQL } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { stagingItems } from "../db/schema.js";

const K = getTableColumns(stagingItems);

/**
 * Staging ma TRZY różne kształty odpowiedzi i to nie jest niedopatrzenie — w produkcji
 * obsługują go dwa niezależne moduły, które powstały w różnym czasie:
 *
 *   • `GET /api/staging`       — rdzeń (backend-index.cjs:48488), pełny wiersz, 24 pola
 *   • `GET /api/staging/paged` — pagination_module.cjs:16, 20 pól
 *   • `GET /api/staging/{id}`  — pagination_module.cjs:91, 21 pól
 *
 * Różnice są konkretne: `paged` i `{id}` nie zwracają `eanCandidates`, `magazynRaw`
 * ani pary `zatwierdzilUzytkownikId`/`zatwierdzonoData` — zamiast tej pary mają JEDNO
 * pole `zatwierdzono` (alias `zatwierdzono_data`). `snapshotJson` jest w `/staging`
 * i w `{id}`, ale NIE w `paged`. Każdy z tych kształtów ma tu własną projekcję.
 */

/** `GET /api/staging` — cała tabela; jej 24 kolumny to dokładnie kształt z fixture'a. */
const KOLUMNY_PELNE = K;

/** `GET /api/staging/paged` — 20 pól, kolejność jak w SELECT z pagination_module.cjs:52-75. */
const KOLUMNY_STRONICOWANE = {
  id: K.id,
  typZmiany: K.typZmiany,
  kod: K.kod,
  nazwa: K.nazwa,
  dostawca: K.dostawca,
  magazyn: K.magazyn,
  stanStary: K.stanStary,
  stanNowy: K.stanNowy,
  cenaZakupuStara: K.cenaZakupuStara,
  cenaZakupuNowa: K.cenaZakupuNowa,
  cenaSprzedazyNowa: K.cenaSprzedazyNowa,
  zmianaPct: K.zmianaPct,
  ostrzezenie: K.ostrzezenie,
  powod: K.powod,
  eanRaw: K.eanRaw,
  eanIsValid: K.eanIsValid,
  eanSourceStatus: K.eanSourceStatus,
  edytowanePola: K.edytowanePola,
  utworzono: K.utworzono,
  zatwierdzono: K.zatwierdzonoData,
};

/** `GET /api/staging/{id}` — jak `paged`, ale z `snapshotJson` (pagination_module.cjs:105-124). */
const KOLUMNY_SZCZEGOLU = {
  ...KOLUMNY_STRONICOWANE,
  snapshotJson: K.snapshotJson,
};

export type PozycjaStagingu = typeof stagingItems.$inferSelect;
export type NowaPozycjaStagingu = typeof stagingItems.$inferInsert;

/**
 * Odpowiednik `U.listStaging` (backend-index.cjs:44808-44810) — CAŁA tabela, bez limitu
 * i **bez `ORDER BY`**. Brak sortowania jest wierny: kolejność wierszy to kolejność
 * `rowid`, czyli kolejność wstawiania. Sortowanie malejąco ma dopiero `/paged`.
 */
export function listaStagingu(db: Baza): PozycjaStagingu[] {
  return db.select(KOLUMNY_PELNE).from(stagingItems).all();
}

export type StronaStagingu = {
  items: PozycjaStagingu[];
  total: number;
};

/** Odpowiednik `U.listStagingPaged` (backend-index.cjs:44811-44820) — też bez `ORDER BY`. */
export function listaStaginguStronicowana(db: Baza, limit = 200, offset = 0): StronaStagingu {
  const items = db.select(KOLUMNY_PELNE).from(stagingItems).limit(limit).offset(offset).all();
  const licznik = db.select({ c: sql<number>`count(*)` }).from(stagingItems).get();
  return { items, total: licznik?.c ?? 0 };
}

export type FiltryStagingu = {
  page: number;
  pageSize: number;
  typZmiany?: string;
  dostawca?: string;
  search?: string;
};

/** Maksymalna liczba tokenów wyszukiwania (pagination_module.cjs:37: `.slice(0, 8)`). */
export const MAX_TOKENOW_SZUKANIA = 8;

/**
 * Warunki `WHERE` dla `/paged` — 1:1 z pagination_module.cjs:24-45.
 *
 * `search` jest rozbijany na tokeny po białych znakach (max 8) i KAŻDY token musi
 * wystąpić w którejś z czterech kolumn — AND między tokenami, OR wewnątrz tokenu.
 * Dzięki temu „ceat 24" znajduje „460/70R24 CEAT Loadpro" niezależnie od kolejności słów.
 *
 * Świadomie NIE escape'ujemy `%` ani `_` w tokenie — oryginał tego nie robi, więc
 * użytkownik wpisujący `%` dostaje tam wieloznacznik. Odtwarzamy zachowanie, nie naprawiamy.
 */
function warunkiFiltrow(filtry: FiltryStagingu): SQL | undefined {
  const warunki: SQL[] = [];

  // `typZmiany=all` znaczy „bez filtra", nie „szukaj wartości 'all'".
  if (filtry.typZmiany && filtry.typZmiany !== "all") {
    warunki.push(eq(stagingItems.typZmiany, filtry.typZmiany));
  }
  if (filtry.dostawca) {
    warunki.push(eq(stagingItems.dostawca, filtry.dostawca));
  }
  if (filtry.search && filtry.search.trim()) {
    const tokeny = filtry.search.trim().split(/\s+/).filter(Boolean).slice(0, MAX_TOKENOW_SZUKANIA);
    for (const token of tokeny) {
      const wzorzec = `%${token}%`;
      const alternatywa = or(
        like(stagingItems.nazwa, wzorzec),
        like(stagingItems.kod, wzorzec),
        like(stagingItems.dostawca, wzorzec),
        like(stagingItems.eanRaw, wzorzec),
      );
      if (alternatywa) warunki.push(alternatywa);
    }
  }

  if (warunki.length === 0) return undefined;
  return and(...warunki);
}

/**
 * `GET /api/staging/paged` (pagination_module.cjs:16-88).
 *
 * `total` liczony PO tym samym filtrze co `items`. `ORDER BY id DESC` — najnowsze pozycje
 * na górze, odwrotnie niż w `/api/staging`.
 */
export function stronaStaginguZFiltrami(db: Baza, filtry: FiltryStagingu) {
  const where = warunkiFiltrow(filtry);
  const offset = (filtry.page - 1) * filtry.pageSize;

  const items = db
    .select(KOLUMNY_STRONICOWANE)
    .from(stagingItems)
    .where(where)
    .orderBy(desc(stagingItems.id))
    .limit(filtry.pageSize)
    .offset(offset)
    .all();

  const licznik = db
    .select({ c: sql<number>`count(*)` })
    .from(stagingItems)
    .where(where)
    .get();
  const total = licznik?.c ?? 0;

  return {
    items,
    total,
    page: filtry.page,
    pageSize: filtry.pageSize,
    pages: Math.ceil(total / filtry.pageSize),
  };
}

/** Kształty odpowiedzi wyprowadzone z projekcji — bez powielania listy pól w typach. */
export type StronaStaginguZFiltrami = ReturnType<typeof stronaStaginguZFiltrami>;
export type PozycjaStaginguStronicowana = StronaStaginguZFiltrami["items"][number];

/** `GET /api/staging/{id}` (pagination_module.cjs:91-127) — `undefined`, gdy nie ma wiersza. */
export function pozycjaStaginguPoId(db: Baza, id: number) {
  return db.select(KOLUMNY_SZCZEGOLU).from(stagingItems).where(eq(stagingItems.id, id)).get();
}

/**
 * Zapis wsadowy — odpowiednik `tk()` z backend-index.cjs:47848-47850:
 *
 *     ww.transaction(() => { for (let u of c) U.addStaging(u) })()
 *
 * Transakcja jest istotna: import albo ląduje w stagingu w całości, albo wcale.
 * Przerwanie w połowie zostawiłoby Anię z częściowym cennikiem, którego nie da się
 * odróżnić od kompletnego.
 */
export function zapiszPozycjeStagingu(db: Baza, pozycje: NowaPozycjaStagingu[]): number {
  if (pozycje.length === 0) return 0;
  db.transaction((tx) => {
    for (const pozycja of pozycje) {
      // Deduplikacja z `U.addStaging` (backend-index.cjs:44923-44927): pozycja o tym samym
      // kodzie, typie zmiany i powodzie NIE jest wstawiana drugi raz. 3b tego nie miała, bo
      // `powod` był wtedy stały, a pola treści puste — dopiero od 3c wiersze mają realny
      // `powod` i powtórny import tego samego cennika zaczyna się o to opierać.
      const istniejaca = tx
        .select({ id: stagingItems.id })
        .from(stagingItems)
        .where(
          and(
            eq(stagingItems.kod, pozycja.kod),
            eq(stagingItems.typZmiany, pozycja.typZmiany),
            sql`COALESCE(${stagingItems.powod}, '') = COALESCE(${pozycja.powod ?? null}, '')`,
          ),
        )
        .get();
      if (istniejaca) continue;
      tx.insert(stagingItems).values(pozycja).run();
    }
  });
  // Oryginał zwraca `c.length` (`:47850`) — długość BUFORA, nie liczbę wstawionych wierszy.
  // Przy zdeduplikowanym powtórzeniu te dwie liczby się rozjeżdżają; kontrakt HTTP niesie tę.
  return pozycje.length;
}

/** Czyści staging — potrzebne testom i `POST /api/staging/clear` (3d). */
export function usunWszystkiePozycjeStagingu(db: Baza): void {
  db.delete(stagingItems).run();
}

export type PozycjaStaginguSzczegol = NonNullable<ReturnType<typeof pozycjaStaginguPoId>>;
