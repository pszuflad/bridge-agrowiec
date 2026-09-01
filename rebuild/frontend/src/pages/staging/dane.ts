/**
 * Warstwa danych widoku `/staging` — typy i mutacje.
 *
 * ⚠ DWA RÓŻNE KSZTAŁTY POZYCJI, i to nie jest niedoróbka backendu tylko fakt z produkcji
 * (ustalenie z 3b, `rebuild/backend/src/repos/staging.ts`):
 *   • `GET /api/staging/paged` oddaje **20 pól** i NIE MA wśród nich `snapshotJson`,
 *   • `GET /api/staging/{id}` oddaje **24 pola**, ze `snapshotJson` włącznie.
 * Dlatego podgląd różnic MUSI dociągnąć pozycję po id — lista mu nie wystarczy.
 */
import { zadanie } from "@/lib/api";

/** Pozycja z `/paged` — 20 pól, kształt z `contract/fixtures/GET_staging_paged.json`. */
export type PozycjaStagingu = {
  id: number;
  typZmiany: string;
  kod: string;
  nazwa: string;
  dostawca: string;
  magazyn: string | null;
  stanStary: number | null;
  stanNowy: number | null;
  cenaZakupuStara: number | null;
  cenaZakupuNowa: number | null;
  cenaSprzedazyNowa: number | null;
  zmianaPct: number | null;
  ostrzezenie: string | null;
  powod: string | null;
  eanRaw: string | null;
  eanIsValid: number | null;
  eanSourceStatus: string | null;
  edytowanePola: string | null;
  utworzono: string;
  zatwierdzono: string | null;
};

/**
 * Pozycja z `GET /api/staging/{id}` — dokłada `snapshotJson`, `eanCandidates`, `magazynRaw`
 * i parę `zatwierdzilUzytkownikId`/`zatwierdzonoData`.
 *
 * ⚠ `zatwierdzilUzytkownikId` i `zatwierdzonoData` są w produkcji MARTWE — nic ich nigdy
 * nie ustawia (ustalenie z 3b). Nie budować na nich UI.
 */
export type PozycjaStaginguSzczegol = Omit<PozycjaStagingu, "zatwierdzono"> & {
  snapshotJson: string | null;
  eanCandidates: string | null;
  magazynRaw: string | null;
  zatwierdzilUzytkownikId: number | null;
  zatwierdzonoData: string | null;
};

/** Koperta `/paged` — `{items,total,page,pageSize,pages}`. */
export type StronaStagingu = {
  items: PozycjaStagingu[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

/**
 * Opcje filtra typu — `YP` z oryginału (`frontend-index.js:597086`).
 *
 * ⚠ `nowy` i `zmiana` to POZOSTAŁOŚCI po starszym schemacie. Nasz silnik (3c/3d-1) produkuje
 * wyłącznie `nowa`, `blad`, `zmiana_kluczowa` i `wycofana`, więc opcja „Nowe produkty (stare)"
 * nic dziś nie znajdzie. Zostaje, bo jest w oryginale i może trafić na stare dane stagingu.
 */
export const OPCJE_FILTRA_TYPU = [
  { wartosc: "all", etykieta: "Wszystkie" },
  { wartosc: "nowa", etykieta: "Nowe produkty" },
  { wartosc: "nowy", etykieta: "Nowe produkty (stare)" },
  { wartosc: "wycofana", etykieta: "Wycofane" },
  { wartosc: "zmiana_kluczowa", etykieta: "Zmiany kluczowe" },
  { wartosc: "blad", etykieta: "Błędy importu" },
] as const;

/** Wygląd odznaki typu — `XP` z oryginału (`frontend-index.js:597593`). */
export const WYGLAD_TYPU: Record<string, { etykieta: string; klasa: string }> = {
  nowy: { etykieta: "Nowa", klasa: "bg-emerald-600 hover:bg-emerald-600 text-white" },
  nowa: { etykieta: "Nowa", klasa: "bg-emerald-600 hover:bg-emerald-600 text-white" },
  zmiana: { etykieta: "Zmiana", klasa: "bg-blue-600 hover:bg-blue-600 text-white" },
  zmiana_kluczowa: {
    etykieta: "Zmiana kluczowa",
    klasa: "bg-blue-600 hover:bg-blue-600 text-white",
  },
  blad: { etykieta: "Błąd", klasa: "bg-red-700 hover:bg-red-700 text-white" },
  wycofana: { etykieta: "Wycofana", klasa: "bg-red-600 hover:bg-red-600 text-white" },
};

/** Rozmiary strony z oryginału — „Na stronie: 25/50/100". */
export const ROZMIARY_STRONY = [25, 50, 100] as const;

/** Pola, które `PUT /api/staging/{id}` przyjmuje (backend: `POLA_EDYTOWALNE`). */
export const POLA_EDYTOWALNE = [
  { klucz: "nazwa", etykieta: "Nazwa" },
  { klucz: "marka", etykieta: "Marka" },
  { klucz: "model", etykieta: "Model" },
  { klucz: "kategoria", etykieta: "Kategoria" },
  { klucz: "rozmiar", etykieta: "Rozmiar" },
  { klucz: "ean", etykieta: "EAN" },
  { klucz: "cenaZakupuNowa", etykieta: "Cena zakupu" },
  { klucz: "magazyn", etykieta: "Magazyn" },
] as const;

/** Adres `/paged` z parametrami — te same nazwy, których używa oryginał (`fe.js:20621`). */
export function adresStrony(opcje: {
  page: number;
  limit: number;
  typZmiany: string;
  search: string;
}): string {
  const { page, limit, typZmiany, search } = opcje;
  return (
    `/api/staging/paged?page=${page}&limit=${limit}` +
    `&typZmiany=${encodeURIComponent(typZmiany)}&search=${encodeURIComponent(search)}`
  );
}

/**
 * Zatwierdzenie WSKAZANYCH pozycji — port `kb()` (`fe.js:9128`).
 *
 * Pusta lista nie idzie do sieci (oryginał: `if (!e.length) return 0`), a gdy backend nie
 * odda `accepted`, przyjmujemy długość listy — też jak oryginał.
 */
export async function zatwierdzPozycje(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const odpowiedz = await zadanie("POST", "/api/staging/accept", { ids });
  const wynik = (await odpowiedz.json()) as { accepted?: number };
  return wynik.accepted ?? ids.length;
}

/** Zatwierdzenie WSZYSTKICH pasujących do filtru — port `kbAll()` (`fe.js:9134`). */
export async function zatwierdzWszystkie(typZmiany: string): Promise<number> {
  const odpowiedz = await zadanie("POST", "/api/staging/accept", {
    allFiltered: true,
    typZmiany: typZmiany || "all",
  });
  const wynik = (await odpowiedz.json()) as { accepted?: number };
  return wynik.accepted ?? 0;
}

/** Odrzucenie wskazanych pozycji — `POST /api/staging/reject` z listą id. */
export async function odrzucPozycje(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const odpowiedz = await zadanie("POST", "/api/staging/reject", { ids });
  const wynik = (await odpowiedz.json()) as { rejected?: number };
  return wynik.rejected ?? ids.length;
}

/** Odrzucenie wszystkich pasujących do filtru — port `vbAll()` (`fe.js:9141`). */
export async function odrzucWszystkie(typZmiany: string): Promise<number> {
  const odpowiedz = await zadanie("POST", "/api/staging/reject", {
    allFiltered: true,
    typZmiany: typZmiany || "all",
  });
  const wynik = (await odpowiedz.json()) as { rejected?: number };
  return wynik.rejected ?? 0;
}

/**
 * Zapis edycji pozycji — port `wb()` (`fe.js:9123`).
 *
 * ⭐ To JEDYNA ścieżka w całej aplikacji, która tworzy poprawki Marty. Backend zapisuje przy
 * okazji `manual_overrides`, więc następny import nie przywróci wartości z pliku dostawcy.
 * `_reason` trafia do `manual_overrides.reason` — to uzasadnienie zmiany, nie pole pozycji.
 */
export async function zapiszPozycje(
  id: number,
  zmiany: Record<string, unknown>,
): Promise<PozycjaStaginguSzczegol> {
  const odpowiedz = await zadanie("PUT", `/api/staging/${id}`, zmiany);
  return (await odpowiedz.json()) as PozycjaStaginguSzczegol;
}

/**
 * Usunięcie pozycji — port `vb()` (`fe.js:9118`).
 *
 * Oryginał kasuje SEKWENCYJNIE, po jednym żądaniu na pozycję (`for … await`), mimo że
 * `POST /api/staging/reject` przyjmuje listę. Odtwarzamy wiernie: `DELETE` daje 404 dla
 * pozycji, której już nie ma, i to jest zachowanie, na którym stoi obsługa błędów w UI.
 */
export async function usunPozycje(ids: number[]): Promise<void> {
  for (const id of ids) await zadanie("DELETE", `/api/staging/${id}`);
}
