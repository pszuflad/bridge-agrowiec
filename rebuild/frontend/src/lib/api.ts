/**
 * Warstwa HTTP frontendu — wierne odtworzenie `deminified/frontend-index.js:8996-9053`.
 *
 * Dwie rzeczy, które wyglądają na nadmiarowe, a są celowe i muszą zostać:
 *  - `Authorization: Bearer` leci TYLKO gdy token istnieje, a `credentials:"include"`
 *    (cookie `bridge_session`) ZAWSZE — oba mechanizmy działają RÓWNOLEGLE, bo backend
 *    czyta token z nagłówka albo z cookie (backend-index.cjs:47880).
 *  - `Content-Type: application/json` jest dodawany tylko przy żądaniu z body.
 */

/**
 * ODSTĘPSTWO ŚWIADOME (plan.md D5): oryginał miał `Vd = "/panel"`, bo panel był
 * montowany pod tym prefiksem. Nowy build stoi w korzeniu domeny, więc prefiks jest pusty,
 * a każda ścieżka i tak zaczyna się od `/api` — to jest wymagane „API base /api”.
 *
 * Stała zostaje, bo `queryFn` skleja ją z `queryKey.join("/")` (queryClient.ts) — gdyby
 * aplikacja kiedyś wróciła pod prefiks, jest to jedno miejsce do zmiany.
 */
export const BAZA_API = "";

const KLUCZ_TOKENU = "bridge_auth_token";
const KLUCZ_UZYTKOWNIKA = "bridge_user";
const KLUCZ_ZAPAMIETAJ = "bridge_remember";

/** Kształt z `contract/fixtures/GET_me.json` (pola `iat`/`exp` dokłada tylko `GET /api/me`). */
export type Uzytkownik = {
  id: number;
  email: string;
  imieNazwisko: string;
};

/**
 * „Zapamiętaj mnie” w oryginale nie zapisuje osobnej flagi przy tokenie — przełącza
 * CAŁY magazyn, w którym siedzi token ORAZ `bridge_user` (fe.js:9000-9006).
 * Zaznaczone → `localStorage` (przeżywa zamknięcie przeglądarki), inaczej `sessionStorage`.
 * Gdy dostęp do storage rzuca (tryb prywatny, zablokowane ciasteczka) — `sessionStorage`.
 */
export function pobierzStore(): Storage {
  try {
    return localStorage.getItem(KLUCZ_ZAPAMIETAJ) === "1" ? localStorage : sessionStorage;
  } catch {
    return sessionStorage;
  }
}

/** fe.js:9008-9013 */
export function ustawZapamietaj(zapamietaj: boolean): void {
  try {
    if (zapamietaj) localStorage.setItem(KLUCZ_ZAPAMIETAJ, "1");
    else localStorage.removeItem(KLUCZ_ZAPAMIETAJ);
  } catch {
    /* storage niedostępny — logowanie ma działać mimo to */
  }
}

// Cache modułowy tokenu (oryginał: `Oo`) — oszczędza odczyt storage przy każdym żądaniu.
let tokenWPamieci: string | null = null;

/** fe.js:9015-9021. Przy `null` czyści token z OBU magazynów — nie wiadomo, w którym leżał. */
export function zapiszToken(token: string | null): void {
  tokenWPamieci = token;
  try {
    if (token) pobierzStore().setItem(KLUCZ_TOKENU, token);
    else {
      localStorage.removeItem(KLUCZ_TOKENU);
      sessionStorage.removeItem(KLUCZ_TOKENU);
    }
  } catch {
    /* jw. */
  }
}

/** fe.js:9023-9031 — leniwy odczyt, raz na cykl życia zakładki. */
export function pobierzToken(): string | null {
  if (tokenWPamieci) return tokenWPamieci;
  try {
    const token = pobierzStore().getItem(KLUCZ_TOKENU);
    if (token) tokenWPamieci = token;
    return tokenWPamieci;
  } catch {
    return tokenWPamieci;
  }
}

/** fe.js:9039-9044 */
export function naglowki(maBody: boolean): Record<string, string> {
  const wynik: Record<string, string> = {};
  if (maBody) wynik["Content-Type"] = "application/json";
  const token = pobierzToken();
  if (token) wynik.Authorization = `Bearer ${token}`;
  return wynik;
}

/** fe.js:9031-9038 — komunikat błędu w formacie `"<status>: <treść>"`. */
export async function rzucGdyBlad(odpowiedz: Response): Promise<void> {
  if (!odpowiedz.ok) {
    const tresc = (await odpowiedz.text()) || odpowiedz.statusText;
    throw new Error(`${odpowiedz.status}: ${tresc}`);
  }
}

/** fe.js:9045-9053 — jedyna droga wyjścia dla mutacji. */
export async function zadanie(
  metoda: string,
  sciezka: string,
  body?: unknown,
): Promise<Response> {
  // Oryginał testuje PRAWDZIWOŚĆ, nie „różne od undefined" (`_g(!!n)`, `n ? ... : void 0`,
  // frontend-index.js:9045-9052). Różnica ujawnia się dla `null`/`0`/`""`/`false` jako body.
  const maBody = Boolean(body);
  const odpowiedz = await fetch(`${BAZA_API}${sciezka}`, {
    method: metoda,
    headers: naglowki(maBody),
    // `exactOptionalPropertyTypes` nie pozwala podać `body: undefined` wprost.
    ...(maBody ? { body: JSON.stringify(body) } : {}),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return odpowiedz;
}

// Klucze storage wyeksportowane, żeby testy i warstwa auth nie powtarzały literałów.
export const KLUCZE_STORAGE = {
  token: KLUCZ_TOKENU,
  uzytkownik: KLUCZ_UZYTKOWNIKA,
  zapamietaj: KLUCZ_ZAPAMIETAJ,
} as const;
