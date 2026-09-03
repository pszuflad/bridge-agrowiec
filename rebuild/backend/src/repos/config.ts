import { eq } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { config } from "../db/schema.js";
import type { UstawieniaWagiGabarytowej } from "../waga-gabarytowa/formula.js";

/**
 * Pojedynczy klucz konfiguracji — wycinek `U.allConfig()` (backend-index.cjs).
 *
 * Pełne `GET/PUT /api/config` należy do Iteracji 11; tutaj potrzebny jest wyłącznie
 * odczyt `ai_fallback.klucz_api` przez `POST /api/ai-fallback/parse`.
 */
export function odczytajKonfiguracje(db: Baza, klucz: string): string | null {
  return db.select().from(config).where(eq(config.klucz, klucz)).get()?.wartosc ?? null;
}

/**
 * Domyślne wartości `waga_gab.*` zasiewane przez oryginał przy starcie
 * (`deminified/backend-index.cjs:45633-45637`, obiekt `vR`). Trzymamy je jako STRINGI —
 * w produkcji siedzą w tabeli `config` jako tekst i handler robi na nich `parseFloat`,
 * więc konwersja musi przebiegać tą samą drogą także wtedy, gdy klucza w bazie nie ma.
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
 * domyślnej — tak samo jak brak klucza. To ma znaczenie, bo `GET/PUT /api/config` (Iteracja 11)
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
