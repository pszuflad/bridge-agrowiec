/**
 * Sesja użytkownika — wierne odtworzenie `deminified/frontend-index.js:9080-9110`.
 *
 * Stan użytkownika jest MODUŁOWY i hydratowany dokładnie raz, przy starcie aplikacji,
 * z `bridge_user`. Oryginał NIGDY nie woła `GET /api/me` (grep po bundlu: zero trafień) —
 * frontend ufa temu, co zapisał przy logowaniu, a wygasłą sesję wykrywa dopiero po 401
 * z konkretnego żądania. Odtwarzamy to 1:1; zmiana wymagałaby świadomej decyzji.
 */
import {
  KLUCZE_STORAGE,
  pobierzStore,
  ustawZapamietaj,
  zadanie,
  zapiszToken,
  type Uzytkownik,
} from "./api";

// Oryginał: `Io`.
let uzytkownikWPamieci: Uzytkownik | null = odczytajZapisanego();

function odczytajZapisanego(): Uzytkownik | null {
  try {
    const zapisany = pobierzStore().getItem(KLUCZE_STORAGE.uzytkownik);
    return zapisany ? (JSON.parse(zapisany) as Uzytkownik) : null;
  } catch {
    return null;
  }
}

/** fe.js:9108-9110 */
export function pobierzUzytkownika(): Uzytkownik | null {
  return uzytkownikWPamieci;
}

/**
 * fe.js:9085-9097.
 *
 * Kolejność ma znaczenie: `ustawZapamietaj` MUSI wykonać się przed żądaniem, bo to ono
 * decyduje, do którego magazynu trafi token i użytkownik zapisywani niżej.
 *
 * `email.trim()` jest częścią kontraktu żądania — backend porównuje e-mail dosłownie.
 */
export async function zaloguj(
  email: string,
  haslo: string,
  zapamietaj: boolean,
): Promise<Uzytkownik> {
  ustawZapamietaj(!!zapamietaj);

  const odpowiedz = await zadanie("POST", "/api/login", {
    email: email.trim(),
    password: haslo,
  });
  const dane = (await odpowiedz.json()) as {
    ok?: boolean;
    user?: Uzytkownik;
    token?: string;
    error?: string;
  };

  if (!dane?.ok || !dane?.user) {
    throw new Error(dane?.error || "Nieprawidłowy email lub hasło");
  }

  // Token jest opcjonalny — sesja działa też na samym cookie `bridge_session`.
  if (dane.token) zapiszToken(dane.token);
  uzytkownikWPamieci = dane.user;
  try {
    pobierzStore().setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(uzytkownikWPamieci));
  } catch {
    /* storage niedostępny — sesja przeżyje w pamięci do przeładowania strony */
  }

  return uzytkownikWPamieci;
}

/**
 * fe.js:9098-9107. Błąd żądania jest połykany celowo: skoro użytkownik chce wyjść,
 * czyścimy stan lokalny niezależnie od tego, czy backend odpowiedział.
 */
export async function wyloguj(): Promise<void> {
  try {
    await zadanie("POST", "/api/logout");
  } catch {
    /* jw. */
  }
  uzytkownikWPamieci = null;
  zapiszToken(null);
  try {
    // Z OBU magazynów — nie wiadomo, który był aktywny w momencie logowania.
    localStorage.removeItem(KLUCZE_STORAGE.uzytkownik);
    sessionStorage.removeItem(KLUCZE_STORAGE.uzytkownik);
  } catch {
    /* jw. */
  }
  ustawZapamietaj(false);
}

/** Tylko dla testów — pozwala odtworzyć hydratację ze startu aplikacji. */
export function _zresetujStanSesji(): void {
  uzytkownikWPamieci = odczytajZapisanego();
}
