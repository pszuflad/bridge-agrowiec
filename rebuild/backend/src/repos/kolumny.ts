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
  products: [
    "uwagaCena",
    /**
     * Migracja 011 / karta I15.1 / backlog #73 — blokowane formy płatności per magazyn.
     *
     * ⭐ TO NIE JEST STAN PRZEJŚCIOWY — wcześniejsza wersja tego komentarza tak twierdziła
     * („o kształcie odpowiedzi decyduje karta I15.3") i była BŁĘDNA. Karta I15.3 (ticket 122)
     * sprawdziła to pomiarem i ukrycie ZOSTAJE: to dokładnie ten sam przypadek co `uwagaCena`
     * wyżej, a nie dług do domknięcia.
     *
     * Dowód (ticket 122, 2026-09-23):
     *  • `payment_blocks.cjs` dokłada kolumnę runtime'owym `ALTER TABLE` przy każdym starcie
     *    (`extensions.cjs` → `ensurePaymentBlocks()`), więc jest ona w bazie produkcji;
     *  • ale bundle backendu jej NIE ZNA: `grep -c blokowane_formy_platnosci
     *    mirror/backend/index.cjs` = 0 (stan `origin/main` @ `88fa31c`), a produkty czyta
     *    Drizzle bez jawnej listy pól — oddaje więc pola MODELU, nie kolumny tabeli;
     *  • ZMIERZONE NA ORYGINALE: `mirror/backend` z `88fa31c` postawiony na kopii bazy
     *    Z KOLUMNĄ WYPEŁNIONĄ dla wszystkich 7405 produktów i obydwoma triggerami oddaje na
     *    `GET /api/products` **72 klucze bez tego pola**.
     *
     * Kolumnę „Blokowane formy płatności" w `/katalog` produkcja liczy W PRZEGLĄDARCE z kodu
     * dostawcy (`mirror/frontend/assets/payment-blocks-injection.js`) — właśnie dlatego, że API
     * jej nie oddaje. Odbudowa robi tak samo: `rebuild/frontend/src/pages/katalog/formatowanie.tsx`.
     * Eksport CSV Selly bierze wartość wprost z bazy (`src/selly/generator-csv.ts`), bez udziału API.
     *
     * Strażnicy: `test/katalog.gate.test.ts` (GET) i `test/produkty.mutacje.test.ts` (PATCH).
     */
    "blokowaneFormyPlatnosci",
  ],
} as const;
