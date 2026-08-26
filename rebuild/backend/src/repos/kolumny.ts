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
  const wynik: Record<string, unknown> = {};
  for (const [nazwa, kolumna] of Object.entries(kolumny)) {
    if ((wykluczone as readonly PropertyKey[]).includes(nazwa)) continue;
    wynik[nazwa] = kolumna;
  }
  for (const nazwa of wykluczone) {
    if (!(nazwa in kolumny)) {
      throw new Error(
        `projekcjaKontraktowa: kolumna "${String(nazwa)}" nie istnieje w tabeli — ` +
          `lista wykluczeń rozjechała się ze schematem.`,
      );
    }
  }
  return wynik as Omit<T["_"]["columns"], K>;
}

/**
 * Kolumny obecne w bazie, ale ŚWIADOMIE nieujawniane w API.
 *
 * Każdy wpis to zatwierdzone odstępstwo od kanonu produkcji — kolumna, której zamrożony
 * kontrakt nie zna, bo produkcja jej nie ma. Przenagranie fixtures należy do I12; do tego
 * czasu odpowiedzi muszą wyglądać dokładnie tak, jak przed dołożeniem kolumny.
 */
export const KOLUMNY_POZA_KONTRAKTEM = {
  /** D5 / backlog #7 — wycofanie dostawcy z importu (migracja 002). */
  suppliers: ["importWylaczony"],
  /** D9 / backlog #4 — cena „na zapytanie"; pisarz i endpoint dochodzą w 3d (migracja 002). */
  products: ["uwagaCena"],
} as const;
