/**
 * Warstwa danych widoku `/historia` — typy, opcje filtrów i budowa adresu.
 *
 * ⚠ CO TEN WIDOK NAPRAWDĘ POKAZUJE. Mimo nazwy nie jest to lista zmian cen per produkt,
 * tylko LOG ZDARZEŃ: jeden wiersz = jeden import, eksport albo ręczna edycja produktu.
 * Podtytuł ekranu w oryginale mówi to wprost. Wartości „przed → po" żyją w tabeli
 * `history` i wychodzą wyłącznie przez gołą `GET /api/history`, której ten widok NIE woła
 * (robi to Pulpit, Iteracja 10). Zmiany cen z auto-zatwierdzenia importu są w `historia_cen`
 * i należą do Iteracji 10 — nie do tego ekranu (plan.md 15-FEATURE-historia-zmian, D2).
 *
 * ⚠ CZĘŚĆ ZDARZEŃ TU NIE DOTRZE. Backend rozpoznaje pięć akcji audytu (`upload_pliku`,
 * `import_cennika`, `eksport_csv`, `eksport_shoper`, `edycja_produktu`) i odrzuca resztę —
 * `import_z_url`, `import_pliku` i `synchronizacja_reczna` są dla tego widoku niewidoczne.
 * To port 1:1 zachowania produkcji, nie usterka UI. Szczegóły:
 * `rebuild/backend/src/historia/mapowanie.ts`.
 */

/** Wpis z `/api/history/paged` — 11 pól, kształt z `contract/fixtures/GET_history_paged.json`. */
export type WpisHistorii = {
  id: number;
  typ: string;
  kiedy: string;
  dostawca: string | null;
  uzytkownik: string | null;
  liczbaPozycji: number | null;
  nazwaPliku: string | null;
  format: string | null;
  kodProduktu: string | null;
  zmienionePola: string[];
  uwagi: string | null;
};

/** Koperta `/paged` — `{items,total,pages,page,limit}`. */
export type StronaHistorii = {
  items: WpisHistorii[];
  total: number;
  pages: number;
  page: number;
  limit: number;
};

/** Odpowiedź `/api/history/meta` — lista dostawców do filtra. */
export type MetaHistorii = {
  dostawcy: string[];
};

/** Opcje filtra typu — etykiety 1:1 z oryginałem (`frontend-index.js:25430-25444`). */
export const OPCJE_FILTRA_TYPU = [
  { wartosc: "all", etykieta: "Wszystkie typy" },
  { wartosc: "import", etykieta: "Importy" },
  { wartosc: "eksport", etykieta: "Eksporty" },
  { wartosc: "edycja", etykieta: "Edycje" },
];

/** Rozmiary strony z oryginału — „Na stronie: 25/50/100" (`:25573-25600`). */
export const ROZMIARY_STRONY = [25, 50, 100] as const;

/**
 * Ile nazw zmienionych pól pokazujemy, zanim zwiniemy resztę w „… i N więcej" —
 * `e.zmienionePola.slice(0, 6)` (`:25549`).
 */
export const MAKS_WIDOCZNYCH_POL = 6;

/**
 * Adres strony wyników. Wszystkie pięć parametrów idzie zawsze, także puste — tak samo
 * jak w oryginale (`:25382`), gdzie `search=&typ=all&dostawca=all` trafia do URL-a
 * niezależnie od stanu filtrów. Dzięki temu klucz cache jest jednoznaczny.
 */
export function adresStrony(opcje: {
  page: number;
  limit: number;
  search: string;
  typ: string;
  dostawca: string;
}): string {
  const { page, limit, search, typ, dostawca } = opcje;
  return (
    `/api/history/paged?page=${page}&limit=${limit}` +
    `&search=${encodeURIComponent(search)}` +
    `&typ=${encodeURIComponent(typ)}&dostawca=${encodeURIComponent(dostawca)}`
  );
}

/**
 * Data w formacie z oryginału (`:25502`):
 * `new Date(kiedy).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })`.
 *
 * `kiedy` jest kolumną tekstową bez walidacji, więc nieparsowalna wartość dałaby
 * „Invalid Date". Pokazujemy wtedy surowy tekst — mniej mylące niż komunikat przeglądarki.
 */
export function sformatujDate(kiedy: string): string {
  const data = new Date(kiedy);
  if (Number.isNaN(data.getTime())) return kiedy;
  return data.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}
