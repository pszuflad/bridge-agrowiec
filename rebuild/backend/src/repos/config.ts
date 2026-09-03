import { eq } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { config } from "../db/schema.js";
import { KONFIGURACJA_POCZATKOWA } from "../db/seed-poczatkowy.js";
import type { UstawieniaWagiGabarytowej } from "../waga-gabarytowa/formula.js";

/**
 * Pojedynczy klucz konfiguracji — wycinek `U.getConfig()` (`backend-index.cjs:45087-45089`).
 * Używa go `POST /api/ai-fallback/parse`, któremu potrzebny jest wyłącznie
 * `ai_fallback.klucz_api`.
 */
export function odczytajKonfiguracje(db: Baza, klucz: string): string | null {
  return db.select().from(config).where(eq(config.klucz, klucz)).get()?.wartosc ?? null;
}

/**
 * Port `U.allConfig()` (`:45090-45095`): cała tabela spłaszczona do `{klucz: wartosc}`.
 *
 * Odpowiedź `GET /api/config` to DOKŁADNIE ten obiekt — bez koperty i bez maskowania.
 * Puste `ai_fallback.klucz_api` w `contract/fixtures/GET_config.json` to realna wartość
 * seeda, nie zamazany sekret; oryginał maskuje tylko przy ZAPISIE, w dzienniku audytu.
 */
export function odczytajCalaKonfiguracje(db: Baza): Record<string, string> {
  const wynik: Record<string, string> = {};
  for (const wiersz of db.select().from(config).all()) {
    wynik[wiersz.klucz] = wiersz.wartosc;
  }
  return wynik;
}

/**
 * Klucze, które `POST /api/config` wolno zapisać.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D4). Oryginał zapisuje DOWOLNY klucz — `U.setConfig(l, p)`
 * (`:48745`) nie ma żadnej walidacji, więc literówka w nazwie („shoper.separaator") wpada
 * do bazy jako nowy wiersz i cicho przestaje działać. To ta sama klasa problemu, co brak
 * listy pól przy `PATCH` (`docs/rebuild-backlog.md` #14), i domykamy ją tym samym ruchem,
 * co przy dostawcach (3f-2) oraz narzutach i promocjach (I4a).
 *
 * Lista to 11 kluczy seeda produkcji (`KONFIGURACJA_POCZATKOWA`) plus dwa, które zapisuje
 * zakładka Shoper (`GK`, `frontend-index.js:26251-26256`). Tych dwóch nie ma w fixture,
 * bo w chwili nagrywania nikt ich jeszcze w produkcji nie zapisał — i właśnie dlatego
 * nie wolno ich wyprowadzać z samego fixture'a.
 */
export const KLUCZE_KONFIGURACJI: readonly string[] = [
  ...Object.keys(KONFIGURACJA_POCZATKOWA),
  "shoper.kolumny",
  "shoper.separator",
];

export function czyKluczDozwolony(klucz: unknown): klucz is string {
  return typeof klucz === "string" && KLUCZE_KONFIGURACJI.includes(klucz);
}

/**
 * Port `U.setConfig()` (`:45096-45097`) — UPSERT po kluczu głównym `klucz`.
 *
 * Oryginał robi to `INSERT … ON CONFLICT(klucz) DO UPDATE SET wartosc = …`; klucz jest
 * PRIMARY KEY (`001_schema.sql:212-215`), więc konflikt zawsze trafia w istniejący wiersz.
 */
export function zapiszKonfiguracje(db: Baza, klucz: string, wartosc: string): void {
  db.insert(config)
    .values({ klucz, wartosc })
    .onConflictDoUpdate({ target: config.klucz, set: { wartosc } })
    .run();
}

/**
 * Domyślne wartości `waga_gab.*` zasiewane przez oryginał przy starcie
 * (`deminified/backend-index.cjs:45633-45637`, obiekt `vR`). Trzymamy je jako STRINGI —
 * w produkcji siedzą w tabeli `config` jako tekst i handler robi na nich `parseFloat`,
 * więc konwersja musi przebiegać tą samą drogą także wtedy, gdy klucza w bazie nie ma.
 *
 * ⚠ DWA PORTY TEGO SAMEGO `vR`. Te cztery wartości powtarzają się w
 * `db/seed-poczatkowy.ts` (`KONFIGURACJA_POCZATKOWA`, 11 kluczy — I11), które zasiewa bazę
 * i karmi GATE. Tu potrzebny jest osobny obiekt, bo `keyof typeof` daje literalne nazwy
 * czterech kluczy formuły, a `noUncheckedIndexedAccess` nie pozwala indeksować
 * `Record<string, string>` bez asercji. Rozjazd między nimi byłby cichy — gdyby któraś
 * wartość się zmieniła, trzeba ruszyć OBA miejsca.
 */
export const DOMYSLNE_WAGA_GAB = {
  "waga_gab.szer_polpaleta": "55",
  "waga_gab.szer_paleta": "80",
  "waga_gab.wys_palety": "10",
  "waga_gab.wspolczynnik": "0.000167",
} as const;

/**
 * Ustawienia formuły wagi gabarytowej — odpowiednik czterech odczytów z `U.allConfig()`
 * w handlerze (`:48750-48754`).
 *
 * ⚠ `||` z oryginału, nie `??`. Klucz obecny w bazie, ale PUSTY (`""`) cofa się do wartości
 * domyślnej — tak samo jak brak klucza. To ma znaczenie, bo `GET/POST /api/config` (Iteracja 11)
 * pozwoli Ani wyczyścić pole, a wtedy formuła ma wrócić do domyślnej, nie policzyć NaN.
 */
export function odczytajUstawieniaWagiGabarytowej(db: Baza): UstawieniaWagiGabarytowej {
  const liczba = (klucz: keyof typeof DOMYSLNE_WAGA_GAB): number =>
    Number.parseFloat(odczytajKonfiguracje(db, klucz) || DOMYSLNE_WAGA_GAB[klucz]);

  return {
    szerPolpaleta: liczba("waga_gab.szer_polpaleta"),
    szerPaleta: liczba("waga_gab.szer_paleta"),
    wysPalety: liczba("waga_gab.wys_palety"),
    wspolczynnik: liczba("waga_gab.wspolczynnik"),
  };
}
