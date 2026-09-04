/**
 * Klient `/api/atrybuty*` — backend gotowy od sesji 7a (ticket `29-FEATURE-atrybuty-backend`).
 *
 * ⚠ NAZWY PÓL SĄ `snake_case` I TAKIE MAJĄ ZOSTAĆ. Trasy atrybutów jadą surowym SQL-em
 * z jawnie wypisanymi kolumnami, więc oddają nazwy KOLUMN — `ile_wystapien`,
 * `sugerowane_aliasy`, `pierwszy_import`. Potwierdzone w `contract/fixtures/GET_atrybuty*.json`;
 * przemianowanie ich na camelCase rozjechałoby typy z kontraktem.
 *
 * ⚠ MARTWE ŚCIEŻKI: produkcyjny front woła `/api/attributes` (8×) i `/api/attribute-kinds` (6×),
 * których backend NIE MA — w produkcji wypełnia te klucze mostek wbudowany w bundle
 * (`deminified/frontend-index.js:9960-10268`). Odbudowa woła wyłącznie natywne
 * `/api/atrybuty(/rodzaje)` (`docs/rebuild-roadmap.md` §3, wiersz „Martwe ścieżki FE”).
 */
import { BAZA_API, naglowki, rzucGdyBlad, zadanie } from "@/lib/api";

/**
 * Rodzaj atrybutu. `core` to LICZBA 0/1, nie boolean (`GET_atrybuty.json`).
 *
 * ⚠ `utworzony` jest OPCJONALNE, i to nie z ostrożności: `GET /api/atrybuty` je zwraca,
 * a `GET /api/atrybuty/rodzaje` NIE (SELECT w `atrybuty_module.cjs:116` go nie pobiera).
 * Różnica jest w obu fixture'ach i została odtworzona celowo — widok nie może na nim polegać.
 */
export type Rodzaj = {
  value: string;
  label: string;
  opis: string | null;
  core: number;
  utworzony?: string;
};

/** Wartość słownika. Kolumna `origin` istnieje w bazie, ale ŻADNA trasa jej nie zwraca. */
export type Wartosc = {
  id: number;
  rodzaj: string;
  wartosc: string;
};

/** Sugestia aliasu — max 5 pozycji, malejąco po `podobienstwo` (próg 0,9). */
export type SugerowanyAlias = {
  wartosc: string;
  podobienstwo: number;
};

/** Pozycja kolejki. Kształt z `contract/fixtures/GET_atrybuty_pending.json`. */
export type PozycjaPending = {
  id: number;
  rodzaj: string;
  wartosc: string;
  ile_wystapien: number;
  pierwszy_import: string | null;
  ostatni_import: string | null;
  dostawcy: string | null;
  sugerowane_aliasy: SugerowanyAlias[];
};

/** Produkt w modalu podglądu — sześć kolumn z `uzycieAtrybutu` (`repos/atrybuty.ts:306`). */
export type ProduktUzycia = {
  dostawca: string | null;
  kod: string | null;
  nazwa: string | null;
  marka: string | null;
  rozmiar: string | null;
  stan: number | null;
};

export type OdpowiedzSlownika = {
  ok: boolean;
  rodzaje: Rodzaj[];
  wartosci: Wartosc[];
};

/**
 * `count` liczy się osobnym `COUNT(*)` BEZ limitu, a `products` jest ucięte do 200
 * (`repos/atrybuty.ts:302-311`). Widok musi umieć powiedzieć „pokazano 200 z N”.
 */
export type OdpowiedzUzycia = {
  ok: boolean;
  count: number;
  products: ProduktUzycia[];
};

export type OdpowiedzPending = {
  ok: boolean;
  count: number;
  items: PozycjaPending[];
};

/** Wynik akcji kolejki. `produktow_zaktualizowano` przychodzi tylko z akcji masowych. */
export type WynikAkcjiPending = {
  ok: boolean;
  akcja: string;
  rodzaj?: string;
  wartosc?: string;
  z?: string;
  na?: string;
  produktow_zaktualizowano?: number;
};

/**
 * Liczniki użycia: GOŁA MAPA `"<rodzaj>::<wartosc>": liczba`, BEZ klucza `ok` —
 * jedyna taka trasa w module (`routes/atrybuty.ts:281`). Uniwersalny odczyt sprawdzający
 * `.ok` złamałby się właśnie tutaj, dlatego ma osobną ścieżkę parsowania.
 */
export type Liczniki = Record<string, number>;

/** Klucz mapy liczników — separatorem są DWA dwukropki. */
export function kluczLicznika(rodzaj: string, wartosc: string): string {
  return `${rodzaj}::${wartosc}`;
}

async function pobierz<T>(sciezka: string): Promise<T> {
  const odpowiedz = await fetch(`${BAZA_API}${sciezka}`, {
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return (await odpowiedz.json()) as T;
}

/**
 * Słownik w jednym strzale — rodzaje ORAZ wartości.
 *
 * Nie używamy domyślnego `queryFn` z `queryClient.ts` (`on401: returnNull`), bo widok CRUD
 * ma odróżniać pusty słownik od braku sesji; tamten oddałby `null` i ekran pokazałby
 * „brak rodzajów” przy wygasłym tokenie. Ten sam powód co w `pages/narzuty/api.ts`.
 */
export function pobierzSlownik(): Promise<OdpowiedzSlownika> {
  return pobierz<OdpowiedzSlownika>("/api/atrybuty");
}

export function pobierzLiczniki(): Promise<Liczniki> {
  return pobierz<Liczniki>("/api/atrybuty/liczniki");
}

/** Oba parametry są WYMAGANE — bez nich backend oddaje 400 (stąd fixture nagrany jako błąd). */
export function pobierzUzycie(rodzaj: string, wartosc: string): Promise<OdpowiedzUzycia> {
  const zapytanie = new URLSearchParams({ rodzaj, wartosc });
  return pobierz<OdpowiedzUzycia>(`/api/atrybuty/uzycie?${zapytanie.toString()}`);
}

/** Kolejka BEZ paginacji i limitu — nagranie produkcji ma 498 pozycji (plan.md D6). */
export function pobierzPending(): Promise<OdpowiedzPending> {
  return pobierz<OdpowiedzPending>("/api/atrybuty/pending");
}

/**
 * Nowy rodzaj. `value` (slug) jest opcjonalne — bez niego backend policzy je z `label`
 * tą samą regułą co oryginał (`slugRodzaju`).
 *
 * ⚠ DEFEKT ORYGINAŁU, KTÓREGO NIE ODTWARZAMY: produkcyjny przycisk „Nowy rodzaj” woła `Lb()`
 * (`deminified/frontend-index.js:9965-9977`), które dopisuje rodzaj WYŁĄCZNIE do lokalnej
 * tablicy `dt` i cache’u Query — mostek patchuje `Hb`/`Qb`/`Gb` (wartości) oraz definiuje
 * `__atrybutyAddRodzaj`, ale `Lb` zostawia niepatchowane. Efekt: rodzaj utworzony tym
 * przyciskiem znika po odświeżeniu strony, a ten sam rodzaj wpisany w „Dodaj wartość”
 * (`:27006` → `__atrybutyAddRodzaj`) zapisuje się normalnie. To skutek rozjazdu bazowego
 * bundla z mostkiem, nie zamierzone zachowanie — odbudowa zapisuje w obu ścieżkach.
 * Opisane w `docs/rebuild-backlog.md`.
 */
export async function dodajRodzaj(dane: {
  label: string;
  opis?: string;
  value?: string;
}): Promise<void> {
  await zadanie("POST", "/api/atrybuty/rodzaje", {
    label: dane.label,
    ...(dane.value ? { value: dane.value } : {}),
    ...(dane.opis ? { opis: dane.opis } : {}),
  });
}

/**
 * Slug rodzaju liczony po stronie klienta — 1:1 z oryginałem (`:27002`): NFD, bez znaków
 * diakrytycznych, małe litery, wszystko spoza `[a-z0-9]` na `_`, obcięte podkreślenia z brzegów.
 * Potrzebny w „Dodaj wartość”, gdzie oryginał sam wylicza `value` przed wysłaniem.
 */
export function slugRodzaju(nazwa: string): string {
  return String(nazwa)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function dodajWartosc(rodzaj: string, wartosc: string): Promise<void> {
  await zadanie("POST", "/api/atrybuty/wartosci", { rodzaj, wartosc });
}

export async function zapiszWartosc(id: number, wartosc: string): Promise<void> {
  await zadanie("PUT", `/api/atrybuty/wartosci/${id}`, { wartosc });
}

export async function usunWartosc(id: number): Promise<void> {
  await zadanie("DELETE", `/api/atrybuty/wartosci/${id}`);
}

async function akcjaPending(
  id: number,
  akcja: string,
  cialo?: unknown,
): Promise<WynikAkcjiPending> {
  const odpowiedz = await zadanie("POST", `/api/atrybuty/pending/${id}/${akcja}`, cialo);
  return (await odpowiedz.json()) as WynikAkcjiPending;
}

/** Wartość ląduje w słowniku, `products` NIETKNIĘTE. */
export function akceptuj(id: number): Promise<WynikAkcjiPending> {
  return akcjaPending(id, "akceptuj");
}

/** `UPDATE products` + wartość do słownika. Masowa zmiana — backend jej NIE audytuje (backlog #39). */
export function akceptujZEdycja(id: number, nowa_wartosc: string): Promise<WynikAkcjiPending> {
  return akcjaPending(id, "akceptuj-z-edycja", { nowa_wartosc });
}

/**
 * `UPDATE products` na wartość kanoniczną; do słownika NIE wchodzi NIC.
 *
 * ⚠ Nie ma tabeli aliasów — mapowanie nigdzie nie zostaje, a kanoniczna MUSI już być
 * w słowniku tego rodzaju (inaczej 400). Też bez audytu (backlog #39).
 */
export function akceptujJakoAlias(
  id: number,
  kanoniczna_wartosc: string,
): Promise<WynikAkcjiPending> {
  return akcjaPending(id, "akceptuj-jako-alias", { kanoniczna_wartosc });
}

/** Wpis do `atrybuty_wartosci_odrzucone` — kolejne skany pomijają tę wartość. */
export function odrzuc(id: number, powod: string): Promise<WynikAkcjiPending> {
  return akcjaPending(id, "odrzuc", { powod });
}

/**
 * „Schowaj”, NIE „odrzuć”: pozycje wracają przy kolejnym skanie kolejki.
 * `rodzaj` zawęża zakres czyszczenia.
 */
export async function wyczyscPending(rodzaj?: string): Promise<{ usunieto: number }> {
  const sciezka = rodzaj
    ? `/api/atrybuty/pending?rodzaj=${encodeURIComponent(rodzaj)}`
    : "/api/atrybuty/pending";
  const odpowiedz = await zadanie("DELETE", sciezka);
  return (await odpowiedz.json()) as { usunieto: number };
}

/**
 * Komunikat błędu dla użytkowniczki.
 *
 * `rzucGdyBlad` sklaja `"<status>: <treść>"`, gdzie treść to surowe ciało `{ok:false,error}`.
 * Rozpakowujemy `error`, bo inaczej Ania zobaczyłaby JSON-a. Kody 403 (rodzaj wbudowany),
 * 404 i 409 (duplikat) NIE SĄ zadeklarowane w `contract/openapi.yaml` — to luka kontraktu,
 * nie kodu (`docs/rebuild-backlog.md` #43); oryginał je zwraca i UI musi je obsłużyć.
 */
export function komunikatBledu(blad: unknown): string {
  const tresc = blad instanceof Error ? blad.message : String(blad);
  const dopasowanie = /^\d{3}: (.*)$/s.exec(tresc);
  const cialo = dopasowanie?.[1] ?? tresc;
  try {
    const rozpakowane = JSON.parse(cialo) as { error?: unknown };
    if (typeof rozpakowane.error === "string" && rozpakowane.error) return rozpakowane.error;
  } catch {
    /* nie-JSON (np. HTML z proxy albo pusta odpowiedź) — pokazujemy jak przyszło */
  }
  return cialo || tresc;
}
