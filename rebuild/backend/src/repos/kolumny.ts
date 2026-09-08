import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/**
 * Jawna projekcja kolumn na granicy API (plan.md D6).
 *
 * Po co: `db.select().from(tabela)` zwraca KAŻDĄ kolumnę zadeklarowaną w schemacie Drizzle,
 * więc dołożenie kolumny wewnętrznej natychmiast dokłada klucz do odpowiedzi HTTP — a ta
 * jest zamrożona przez `contract/fixtures/`. Granicą, której pilnuje kontrakt, jest
 * ODPOWIEDŹ, nie układ tabeli; ten helper rozdziela jedno od drugiego.
 *
 * Świadomie NIE wypisujemy list kolumn wprost (72 pola produktu): projekcja powstaje jako
 * „wszystkie kolumny tabeli MINUS jawnie zadeklarowane wewnętrzne". Dzięki temu każda nowa
 * kolumna domyślnie trafia do API i łamie GATE — czyli wymusza świadomą decyzję, zamiast
 * przechodzić niezauważona. Ukrycie kolumny wymaga dopisania jej do `KOLUMNY_POZA_KONTRAKTEM`
 * z uzasadnieniem.
 */
export function projekcjaKontraktowa<T extends SQLiteTable, K extends keyof T["_"]["columns"]>(
  tabela: T,
  wykluczone: readonly K[],
): Omit<T["_"]["columns"], K> {
  const kolumny = getTableColumns(tabela) as Record<string, unknown>;

  // Najpierw walidacja, potem budowa — literówka na liście wykluczeń ma zatrzymać start,
  // a nie po cichu zbudować projekcję, która niczego nie ukrywa.
  for (const nazwa of wykluczone) {
    if (!(nazwa in kolumny)) {
      throw new Error(
        `projekcjaKontraktowa: kolumna "${String(nazwa)}" nie istnieje w tabeli — ` +
          `lista wykluczeń rozjechała się ze schematem.`,
      );
    }
  }

  const wynik: Record<string, unknown> = {};
  for (const [nazwa, kolumna] of Object.entries(kolumny)) {
    if ((wykluczone as readonly PropertyKey[]).includes(nazwa)) continue;
    wynik[nazwa] = kolumna;
  }
  return wynik as Omit<T["_"]["columns"], K>;
}

/**
 * Kolumny obecne w bazie, ale ŚWIADOMIE nieujawniane w API.
 *
 * ⚠ TO NIE JEST STAN PRZEJŚCIOWY. Wcześniejsza wersja tego komentarza zapowiadała, że
 * przenagranie fixtures w I12 ujawni te kolumny. Sesja 12d (ticket 38) przenagrała fixtures
 * i ustaliła, że dla `uwagaCena` byłoby to ODSTĘPSTWEM od produkcji, nie domknięciem długu.
 */
export const KOLUMNY_POZA_KONTRAKTEM = {
  /**
   * D5 / backlog #7 — wycofanie dostawcy z importu (migracja 002).
   * Kolumna WŁASNA odbudowy: produkcja jej w ogóle nie ma, więc nie ma czego ujawniać.
   */
  suppliers: ["importWylaczony"],
  /**
   * D9 / backlog #4 — cena „na zapytanie" (migracja 002).
   *
   * ⭐ PRODUKCJA TEŻ TEJ KOLUMNY NIE ODDAJE przez `GET /api/products` — ukrycie jej jest
   * ODTWORZENIEM zachowania, nie długiem. Dowód (ticket 38, sesja 12d):
   *  • oryginał czyta produkty przez `X.select().from(he)` (`deminified/backend-index.cjs:44699`),
   *    czyli Drizzle bez jawnej listy kolumn — oddaje pola MODELU, nie kolumny tabeli;
   *  • model `he` o `uwagaCena` nie wie: `grep -c "uwagaCena" mirror/backend/index.cjs` = 0,
   *    mimo że `uwaga_cena_patch.cjs` dokłada kolumnę `ALTER TABLE` przy każdym starcie;
   *  • patch monkey-patchuje `acceptStaging` i `addProductsBulk`, ale NIE `listProducts`;
   *  • zmierzone: oryginał na kopii bazy, z kolumną już dodaną, oddaje 72 klucze bez `uwagaCena`
   *    — zarówno w `GET /api/products`, jak i w odpowiedzi `PUT`/`PATCH /api/products/{id}`.
   *
   * Kolumnę czytają wyłącznie dwie trasy surowym SQL-em: `GET /api/products/uwagi-cena`
   * i `/hold-reasons` (klucz `uwaga_cena` w snake_case). Strażnik: test „GET /api/products
   * NIE oddaje uwagaCena" w `test/katalog.gate.test.ts`.
   */
  products: ["uwagaCena"],
} as const;
