import { eq } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { config } from "../db/schema.js";
import { KONFIGURACJA_POCZATKOWA } from "../db/seed-poczatkowy.js";

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
