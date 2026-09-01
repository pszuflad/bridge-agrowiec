import { asc, eq, sql } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { products, suppliers } from "../db/schema.js";
import { KOLUMNY_POZA_KONTRAKTEM, projekcjaKontraktowa } from "./kolumny.js";

/**
 * Kolumny wychodzące do API — wszystkie z tabeli MINUS wewnętrzne (plan.md D6).
 * Bez tej projekcji `import_wylaczony` z migracji 002 dołożyłaby 19. klucz do odpowiedzi
 * i złamała zamrożone `GET_suppliers.json` / `GET_dostawcy.json` (18 kluczy).
 */
const KOLUMNY_API = projekcjaKontraktowa(suppliers, KOLUMNY_POZA_KONTRAKTEM.suppliers);

export type Dostawca = Omit<typeof suppliers.$inferSelect, "importWylaczony">;

/** Kształt z contract/fixtures/GET_suppliers.json — 15 kolumn tabeli + 3 pola liczone w locie. */
export type DostawcaZeStatystykami = Omit<Dostawca, "liczbaProduktow" | "status"> & {
  liczbaProduktow: number;
  status: string;
  ostatniaAktualizacjaCeny: string | null;
  ostatniaAktualizacjaStanu: string | null;
};

/** Próg „plik starszy niż 30 dni" z oryginału (backend-index.cjs:45028). */
export const PROG_NIEAKTUALNOSCI_DNI = 30;

const MS_NA_DOBE = 86_400_000;

type WierszZmian = {
  dostawca: string;
  ostatnia_zmiana_ceny: string | null;
  ostatnia_zmiana_stanu: string | null;
};

/**
 * Ostatnia zmiana ceny i stanu per dostawca — 1:1 zapytanie okienkowe z oryginału
 * (backend-index.cjs:45014-45021). `LAG` porównuje każdy wpis `historia_cen` z poprzednim
 * dla tego samego `kod`, a `IS NOT` (nie `<>`) sprawia, że przejście z/na NULL też liczy
 * się jako zmiana.
 *
 * Oryginał opakowuje to w `try/catch` zwracający `[]` — zachowujemy, bo dzięki temu awaria
 * tej statystyki nie wywraca całej listy dostawców.
 */
function ostatnieZmiany(db: Baza): Map<string, WierszZmian> {
  let wiersze: WierszZmian[] = [];
  try {
    wiersze = db.all<WierszZmian>(sql`
      WITH z AS (
        SELECT dostawca, kod, cena_zakupu, cena_sprzedazy, stan, zarejestrowano_at,
               LAG(cena_zakupu)     OVER (PARTITION BY kod ORDER BY zarejestrowano_at) AS prev_cz,
               LAG(cena_sprzedazy)  OVER (PARTITION BY kod ORDER BY zarejestrowano_at) AS prev_cs,
               LAG(stan)            OVER (PARTITION BY kod ORDER BY zarejestrowano_at) AS prev_stan,
               LAG(zarejestrowano_at) OVER (PARTITION BY kod ORDER BY zarejestrowano_at) AS prev_data
        FROM historia_cen
      )
      SELECT dostawca,
             MAX(CASE WHEN prev_data IS NOT NULL
                       AND (cena_zakupu IS NOT prev_cz OR cena_sprzedazy IS NOT prev_cs)
                      THEN zarejestrowano_at END) AS ostatnia_zmiana_ceny,
             MAX(CASE WHEN prev_data IS NOT NULL AND stan IS NOT prev_stan
                      THEN zarejestrowano_at END) AS ostatnia_zmiana_stanu
      FROM z
      GROUP BY dostawca
    `);
  } catch {
    wiersze = [];
  }
  return new Map(wiersze.map((w) => [w.dostawca, w]));
}

/**
 * Przeliczenie statusu dostawcy — dosłownie warunek z oryginału (backend-index.cjs:45028),
 * rozpisany na czytelne gałęzie:
 *
 *  - jest `ostatniPlik` i jest starszy niż 30 dni  → "wstrzymany"
 *  - jest `ostatniPlik`, świeży, ale 0 produktów   → "blad"
 *  - jest `ostatniPlik`, świeży, są produkty       → "aktywny"
 *  - brak `ostatniPlik` i 0 produktów              → "wstrzymany"
 *  - brak `ostatniPlik`, ale są produkty           → status z kolumny (bez zmian)
 */
export function przeliczStatus(
  statusZBazy: string,
  ostatniPlik: string | null,
  liczbaProduktow: number,
  teraz: number,
): string {
  if (ostatniPlik) {
    const wiekDni = (teraz - new Date(ostatniPlik).getTime()) / MS_NA_DOBE;
    if (wiekDni > PROG_NIEAKTUALNOSCI_DNI) return "wstrzymany";
    return liczbaProduktow === 0 ? "blad" : "aktywny";
  }
  return liczbaProduktow === 0 ? "wstrzymany" : statusZBazy;
}

/**
 * Odpowiednik `U.listSuppliers` (backend-index.cjs:45011-45036).
 *
 * Dwa pola z tabeli są ŚWIADOMIE nadpisywane wartościami liczonymi w locie:
 * `liczbaProduktow` (realny `count(*)` z `products`) i `status`. Kolumna
 * `suppliers.liczba_produktow` bywa nieaktualna — oryginał jej nie ufa i my też nie.
 */
export function listaDostawcow(db: Baza, teraz = Date.now()): DostawcaZeStatystykami[] {
  const wiersze = db.select(KOLUMNY_API).from(suppliers).orderBy(asc(suppliers.kod)).all();
  const zmiany = ostatnieZmiany(db);

  return wiersze.map((dostawca) => {
    const liczbaProduktow =
      db
        .select({ c: sql<number>`count(*)` })
        .from(products)
        .where(eq(products.dostawca, dostawca.kod))
        .get()?.c ?? 0;
    const zmiana = zmiany.get(dostawca.kod);

    return {
      ...dostawca,
      liczbaProduktow,
      status: przeliczStatus(dostawca.status, dostawca.ostatniPlik, liczbaProduktow, teraz),
      ostatniaAktualizacjaCeny: zmiana?.ostatnia_zmiana_ceny ?? null,
      ostatniaAktualizacjaStanu: zmiana?.ostatnia_zmiana_stanu ?? null,
    };
  });
}

/**
 * Pełny wiersz dostawcy — Z kolumnami wewnętrznymi (`importWylaczony`).
 *
 * Świadomie NIE używa projekcji kontraktowej: to odczyt na potrzeby logiki importu,
 * nie na potrzeby odpowiedzi HTTP. Wynik nigdy nie trafia wprost do `res.json()`.
 */
export function dostawcaPoKodzie(db: Baza, kod: string) {
  return db.select().from(suppliers).where(eq(suppliers.kod, kod)).get();
}

/**
 * Zapis wyniku udanego importu — odpowiednik bloku z `extensions.cjs:155-160` i `:247-252`.
 *
 * ⚠ Oryginał ustawia tu `status: 'aktywny'` na sztywno. Odtwarzamy to, ale warto wiedzieć,
 * że ta kolumna i tak jest przeliczana w locie przy odczycie (`przeliczStatus`), więc jej
 * zapis ma znaczenie tylko dla dostawców bez `ostatniPlik` i bez produktów. To także powód,
 * dla którego wyłączenie dostawcy z importu (plan.md D5) mieszka w osobnej kolumnie:
 * `status` jest tu bezwarunkowo nadpisywany.
 */
export function zapiszWynikImportu(
  db: Baza,
  id: number,
  dane: { ostatniPlik: string; liczbaProduktow: number; ostatniaSync?: string },
): void {
  db.update(suppliers)
    .set({
      ostatniPlik: dane.ostatniPlik,
      liczbaProduktow: dane.liczbaProduktow,
      status: "aktywny",
      // `ostatniaSync` ustawia WYŁĄCZNIE ten, kto ją poda. Rdzeniowy upload
      // (backend-index.cjs:48260-48265) zapisuje oba znaczniki, a trasy z extensions.cjs
      // (3b) tylko `ostatniPlik` — i ta różnica jest w oryginale, nie u nas.
      ...(dane.ostatniaSync !== undefined ? { ostatniaSync: dane.ostatniaSync } : {}),
    })
    .where(eq(suppliers.id, id))
    .run();
}
