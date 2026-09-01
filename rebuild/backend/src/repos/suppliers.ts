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

/**
 * Pola dostawcy, które `PATCH /api/dostawcy/{id}` wolno zapisać.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (decyzja użytkownika 2026-09-01, blok 3f-2). Oryginał listy NIE MA:
 * `updateSupplier(t, e) { X.update(Ot).set(e) … }` (backend-index.cjs:45043) wrzuca do
 * `SET` całe ciało żądania, więc każdy zalogowany użytkownik ustawia dowolną kolumnę.
 * U nas to znaczy więcej niż w produkcji, bo mamy kolumnę, której produkcja nie ma:
 * `importWylaczony` (migracja 002) wyłącza MO6 z importu i jest BRAMKĄ — a bramka,
 * którą zdejmuje się jednym PATCH-em, nie jest bramką.
 *
 * Odcięte świadomie:
 *  - `importWylaczony` — powód wyżej,
 *  - `liczbaProduktow`, `ostatniPlik`, `ostatniaSync` — własność importu; `ostatniPlik`
 *    steruje `przeliczStatus`, więc dało się nim podrobić „aktywny" bez jednego importu,
 *  - `id`, `kod` — tożsamość wiersza.
 *
 * ⚠ Lista jest ŚWIADOMIE SZERSZA niż czwórka audytowana. Niespójność oryginału — zapis
 * całym ciałem, audyt tylko z czterech pól — zostaje odtworzona 1:1 (roadmapa: decyzja
 * zaklepana): `uwagi`, `parser`, `kodowanie`, `nazwa`, `email`, `formatPliku` dalej
 * zmieniają się bez śladu w audycie. Zawężenie listy DO czwórki skasowałoby tę
 * niespójność po cichu, a przy okazji uczyniłoby gate 3f-2 („pole spoza czwórki NIE
 * trafia do audytu") niemożliwym do napisania.
 */
export const POLA_EDYTOWALNE_DOSTAWCY = [
  "status",
  "url",
  "czestotliwoscMinuty",
  "sposobDostarczania",
  "nazwa",
  "email",
  "formatPliku",
  "parser",
  "kodowanie",
  "uwagi",
] as const satisfies readonly (keyof Dostawca)[];

export type PoleEdytowalne = (typeof POLA_EDYTOWALNE_DOSTAWCY)[number];

/**
 * Cztery pola trafiające do audytu — 1:1 z oryginałem (backend-index.cjs:48234).
 * Kolejność ma znaczenie: oryginał iteruje właśnie tak i tak układa klucze `szczegoly`.
 */
export const POLA_AUDYTOWANE_DOSTAWCY = [
  "status",
  "url",
  "czestotliwoscMinuty",
  "sposobDostarczania",
] as const satisfies readonly PoleEdytowalne[];

/** Pełny wiersz po `id` — odpowiednik `U.getSupplier` (backend-index.cjs:45037). */
export function dostawcaPoId(db: Baza, id: number) {
  return db.select().from(suppliers).where(eq(suppliers.id, id)).get();
}

/** Wiersz po `id` w projekcji kontraktowej — bez kolumn wewnętrznych. Do odpowiedzi HTTP. */
export function dostawcaPoIdDoApi(db: Baza, id: number): Dostawca | undefined {
  return db.select(KOLUMNY_API).from(suppliers).where(eq(suppliers.id, id)).get();
}

/**
 * Przepuszcza ciało żądania przez listę pól edytowalnych. Zwraca WYŁĄCZNIE klucze, które
 * w ciele faktycznie były — brak klucza to „nie ruszaj", a nie „ustaw na null".
 */
export function odsiejPolaEdytowalne(cialo: unknown): Partial<Pick<Dostawca, PoleEdytowalne>> {
  if (typeof cialo !== "object" || cialo === null) return {};
  const zrodlo = cialo as Record<string, unknown>;
  const wynik: Record<string, unknown> = {};
  for (const pole of POLA_EDYTOWALNE_DOSTAWCY) {
    if (Object.hasOwn(zrodlo, pole)) wynik[pole] = zrodlo[pole];
  }
  return wynik as Partial<Pick<Dostawca, PoleEdytowalne>>;
}

/**
 * Zapis odsianych pól — odpowiednik `U.updateSupplier` po nałożeniu listy z góry.
 *
 * Pusty patch NIE wywołuje `UPDATE` (drizzle rzuca na `set({})`), ale dalej zwraca wiersz:
 * oryginał przy pustym ciele też odpowiada 200 z aktualnym dostawcą.
 */
export function aktualizujDostawce(
  db: Baza,
  id: number,
  patch: Partial<Pick<Dostawca, PoleEdytowalne>>,
): Dostawca | undefined {
  if (Object.keys(patch).length > 0) {
    db.update(suppliers).set(patch).where(eq(suppliers.id, id)).run();
  }
  return dostawcaPoIdDoApi(db, id);
}

/**
 * Oznaczenie nieudanego pobrania — `U.updateSupplier(n.id, {status:"blad", ostatniaSync})`
 * z obu gałęzi błędu `L4()` (backend-index.cjs:48065-48068, :48108-48111).
 *
 * ⚠ `ostatniaSync` jest ustawiana TAKŻE przy porażce. To nie pomyłka oryginału, tylko
 * znaczenie tego pola: „kiedy ostatnio PRÓBOWALIŚMY", nie „kiedy ostatnio się udało".
 * Ta druga informacja siedzi w `ostatniPlik`, którego gałąź błędu nie rusza.
 */
export function oznaczBladDostawcy(db: Baza, id: number, kiedy: string): void {
  db.update(suppliers)
    .set({ status: "blad", ostatniaSync: kiedy })
    .where(eq(suppliers.id, id))
    .run();
}
