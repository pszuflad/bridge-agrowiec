/**
 * Mapowanie `audit_log` → wpisy widoku „Historia zmian".
 *
 * Port `GET /api/history/meta` i `GET /api/history/paged` z rdzenia produkcji
 * (`deminified/backend-index.cjs:48335-48391`). Oba handlery mają w oryginale ten sam,
 * skopiowany kod mapujący; tutaj jest raz i obsługuje obie trasy.
 *
 * ⚠ ŹRÓDŁEM JEST `audit_log`, NIE `history` I NIE `historia_cen`. Obie trasy wołają
 * `U.listAudit(5e3)` (`:48336`, `:48358`). Tabelę `history` czyta wyłącznie goła
 * `GET /api/history` (`repos/dziennik-zmian.ts`).
 */

import type { WierszAudytu } from "../repos/audit.js";

export type TypWpisu = "import" | "eksport" | "edycja";

/** Wpis widoku — 12 pól, dokładnie tyle ma `contract/fixtures/GET_history_paged.json`. */
export type WpisHistorii = {
  id: number;
  typ: TypWpisu;
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

export type FiltryHistorii = {
  page: number;
  limit: number;
  search: string;
  typ: string;
  dostawca: string;
};

export type StronaHistorii = {
  items: WpisHistorii[];
  total: number;
  pages: number;
  page: number;
  limit: number;
};

/** Domyślne i skrajne wartości paginacji — `:48353-48354`. */
export const DOMYSLNA_STRONA = 1;
export const DOMYSLNY_LIMIT = 50;
export const MAX_LIMIT = 200;

/** Ile wierszy audytu w ogóle wchodzi do mapowania — `U.listAudit(5e3)` (`:48336`, `:48358`). */
export const LIMIT_AUDYTU = 5000;

/**
 * Słownik pięciu rozpoznawanych akcji (`:48341`, `:48363`).
 *
 * ⚠ WSZYSTKO SPOZA TEJ PIĄTKI DAJE `null` I WYPADA Z WYNIKU (`filter(Boolean)`). To NIE jest
 * usterka do naprawienia — tak działa produkcja. Skutek dla nas: z dwunastu akcji, które
 * rebuild zapisuje dziś do `audit_log`, przez ten odsiew przechodzą dwie — `upload_pliku`
 * (`routes/suppliers.ts`) i `import_cennika` (`routes/staging-mutacje.ts`). Pozostałe
 * (`import_z_url`, `import_pliku`, `synchronizacja_reczna`, `edycja_dostawcy`,
 * `edycja_stagingu`, `akceptacja_stagingu`, `odrzucenie_stagingu`, `override`,
 * `usuniecie_override`, `czyszczenie_stagingu`) są dla tego widoku niewidoczne — w produkcji
 * również. Rozszerzenie słownika byłoby odstępstwem; odrzucone świadomie (plan.md D2).
 */
export function typWpisu(akcja: string): TypWpisu | null {
  if (akcja === "upload_pliku" || akcja === "import_cennika") return "import";
  if (akcja === "eksport_csv" || akcja === "eksport_shoper") return "eksport";
  if (akcja === "edycja_produktu") return "edycja";
  return null;
}

/**
 * `szczegoly_json` → obiekt. Port `try { JSON.parse } catch {}` z `:48338-48342`.
 *
 * ⚠ DWA WEJŚCIA, KTÓRE NAPRAWDĘ WYSTĘPUJĄ W BAZIE, i oba muszą dać `{}`, a nie wyjątek:
 *  1. `NULL` — pisze go m.in. `POST /api/dostawcy/{kod}/synchronizuj-teraz`, które woła audyt
 *     bez czwartego argumentu (`:48240`);
 *  2. tekst, który nie jest poprawnym JSON-em — `JSON.parse` rzuca, oryginał to łyka.
 *
 * Odsiew akcji następuje DOPIERO PO parsowaniu, więc ten kod dotyka także wierszy, które
 * nigdy nie trafią do widoku (np. `synchronizacja_reczna`). Ten sam parser obsłuży
 * `/api/audit-log` w I12.
 */
export function parsujSzczegoly(szczegolyJson: string | null): Record<string, unknown> {
  if (!szczegolyJson) return {};
  try {
    const wynik: unknown = JSON.parse(szczegolyJson);
    // `JSON.parse("5")` albo `JSON.parse("null")` daje wartość, która nie jest obiektem —
    // oryginał przypisałby ją do `m`, a późniejsze `m.dostawca` dałoby `undefined`.
    // `{}` zachowuje się tak samo, a chroni przed odczytem pól z tablicy albo stringa.
    if (typeof wynik !== "object" || wynik === null || Array.isArray(wynik)) return {};
    return wynik as Record<string, unknown>;
  } catch {
    return {};
  }
}

/*
 * ZAWĘŻENIE TYPU wobec oryginału — świadome i nieszkodliwe.
 *
 * Oryginał robi `m.dostawca ?? null` i `w.liczbaProduktow ?? w.wczytanych ?? …`, więc
 * przepuszcza z `szczegoly_json` DOWOLNY typ — także string tam, gdzie kontrakt obiecuje
 * liczbę. My bierzemy wartość tylko wtedy, gdy ma właściwy typ, i w przeciwnym razie
 * schodzimy do kolejnego fallbacku. Dla wszystkich pisarzy `audit_log` w rebuildzie
 * (`liczbaProduktow`, `wczytanych`, `doStagingu` są liczbami; `nazwaPliku` stringiem)
 * zachowanie jest identyczne — różnica ujawniłaby się dopiero przy ręcznie zepsutym
 * wierszu, gdzie oryginał złamałby kształt odpowiedzi wobec kontraktu, a my nie.
 */
function tekstAlboNull(wartosc: unknown): string | null {
  return typeof wartosc === "string" ? wartosc : null;
}

function liczbaAlboNull(wartosc: unknown): number | null {
  return typeof wartosc === "number" ? wartosc : null;
}

/** Pierwsza wartość liczbowa z listy — odpowiednik łańcucha `??` z `:48371`. */
function pierwszaLiczba(szczegoly: Record<string, unknown>, klucze: string[]): number | null {
  for (const klucz of klucze) {
    const wartosc = liczbaAlboNull(szczegoly[klucz]);
    if (wartosc !== null) return wartosc;
  }
  return null;
}

/**
 * Jeden wiersz `audit_log` → wpis widoku, albo `null`, gdy akcja jest spoza słownika.
 * Port `:48360-48381` — kolejność fallbacków jest wierna i istotna.
 *
 * ⚠ `dostawca` bierze się z `encja_id`, gdy `encja_typ === "dostawca"`. Oryginał NIE złącza
 * tego z tabelą `suppliers` i my też nie — audyt zapisuje ZAMIAR przed operacją, więc
 * `encja_id` bywa kodem dostawcy, którego w `suppliers` nie ma (np. nieudana
 * `synchronizacja_reczna`). Złączenie gubiłoby takie wpisy albo wywracało odczyt.
 */
export function naWpisHistorii(wiersz: WierszAudytu): WpisHistorii | null {
  const szczegoly = parsujSzczegoly(wiersz.szczegolyJson);
  const typ = typWpisu(wiersz.akcja);
  if (!typ) return null;

  const dostawca =
    wiersz.encjaTyp === "dostawca" ? wiersz.encjaId : tekstAlboNull(szczegoly["dostawca"]);

  const liczbaPozycji =
    typ === "import"
      ? pierwszaLiczba(szczegoly, ["liczbaProduktow", "wczytanych", "doStagingu"])
      : typ === "eksport"
        ? pierwszaLiczba(szczegoly, ["liczbaProduktow", "liczbaDostawcow"])
        : 1;

  const nazwaPliku = tekstAlboNull(szczegoly["nazwaPliku"]);
  const format = typ === "eksport" ? (wiersz.akcja === "eksport_shoper" ? "shoper" : "csv") : null;

  // Oryginał składa tu string i dopiero potem robi `z ?? null`, więc dla `typ === "edycja"`
  // `uwagi` zawsze wychodzi `null` — a przy imporcie bez nazwy pliku wychodzi „Plik: ?".
  const uwagi =
    typ === "import"
      ? `Plik: ${nazwaPliku ?? "?"}`
      : typ === "eksport"
        ? `Format: ${format}`
        : null;

  const zmiany = szczegoly["zmiany"];

  return {
    id: wiersz.id,
    typ,
    kiedy: wiersz.kiedy,
    dostawca: dostawca ?? null,
    uzytkownik: wiersz.uzytkownikImie ?? null,
    liczbaPozycji,
    nazwaPliku,
    format,
    kodProduktu: typ === "edycja" ? wiersz.encjaId : null,
    zmienionePola: typ === "edycja" && Array.isArray(zmiany) ? (zmiany as string[]) : [],
    uwagi,
  };
}

/** Wiersze audytu → wpisy widoku, z odsianiem akcji spoza słownika (`:48382`). */
export function wpisyHistorii(wiersze: WierszAudytu[]): WpisHistorii[] {
  const wpisy: WpisHistorii[] = [];
  for (const wiersz of wiersze) {
    const wpis = naWpisHistorii(wiersz);
    if (wpis) wpisy.push(wpis);
  }
  return wpisy;
}

/**
 * Lista dostawców do filtra — port `:48348`.
 * `Array.from(new Set(…)).sort()` bez komparatora, czyli porządek leksykograficzny
 * (stąd „MO1", „MO10", „MO2" w `contract/fixtures/GET_history_meta.json` — tak ma być).
 */
export function dostawcyHistorii(wpisy: WpisHistorii[]): string[] {
  const zbior = new Set<string>();
  for (const wpis of wpisy) if (wpis.dostawca) zbior.add(wpis.dostawca);
  return Array.from(zbior).sort();
}

/**
 * Clamp `page` — port `:48353`: `Math.max(parseInt(String(q.page ?? "1")) || 1, 1)`.
 *
 * ⚠ Fallback `|| 1` stoi PO `parseInt`, inaczej niż w `pagination_module.cjs`, z którego
 * korzysta `GET /api/staging/paged` (tam `||` działa na STRINGU przed parsowaniem i potrafi
 * przepuścić `NaN`). Tutaj `page=0` i `page=abc` dają obie `1` i `NaN` nigdzie nie wycieka.
 * Dwie trasy tej samej aplikacji parsują paginację inaczej — to zastane, nie do ujednolicenia.
 */
export function stronaZQuery(surowa: unknown): number {
  return Math.max(parseInt(String(surowa ?? String(DOMYSLNA_STRONA))) || DOMYSLNA_STRONA, 1);
}

/** Clamp `limit` — port `:48354`: `Math.min(Math.max(parseInt(…) || 50, 1), 200)`. */
export function limitZQuery(surowy: unknown): number {
  return Math.min(
    Math.max(parseInt(String(surowy ?? String(DOMYSLNY_LIMIT))) || DOMYSLNY_LIMIT, 1),
    MAX_LIMIT,
  );
}

/**
 * Filtrowanie, sortowanie i wycięcie strony — port `:48383-48390`.
 *
 * ⚠ `search` przeszukuje `JSON.stringify` CAŁEGO zmapowanego wpisu, a nie wybranych pól —
 * więc trafia też w `typ`, `format`, „Plik: …" i nazwy zmienionych pól. Placeholder w UI
 * („Szukaj po kodzie produktu, dostawcy lub treści zmiany...") opisuje to węziej, niż jest.
 */
export function stronaHistorii(wpisy: WpisHistorii[], filtry: FiltryHistorii): StronaHistorii {
  const { page, limit, typ, dostawca } = filtry;
  const fraza = filtry.search.toLowerCase();

  const dopasowane = wpisy
    .filter(
      (wpis) =>
        (typ === "all" || wpis.typ === typ) &&
        (dostawca === "all" || wpis.dostawca === dostawca) &&
        (!fraza || JSON.stringify(wpis).toLowerCase().includes(fraza)),
    )
    .sort((a, b) => new Date(b.kiedy).getTime() - new Date(a.kiedy).getTime());

  const total = dopasowane.length;

  return {
    items: dopasowane.slice((page - 1) * limit, (page - 1) * limit + limit),
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    page,
    limit,
  };
}
