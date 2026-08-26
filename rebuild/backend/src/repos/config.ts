import { eq } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { config } from "../db/schema.js";

/**
 * Pojedynczy klucz konfiguracji — wycinek `U.allConfig()` (backend-index.cjs).
 *
 * Pełne `GET/PUT /api/config` należy do Iteracji 11; tutaj potrzebny jest wyłącznie
 * odczyt `ai_fallback.klucz_api` przez `POST /api/ai-fallback/parse`.
 */
export function odczytajKonfiguracje(db: Baza, klucz: string): string | null {
  return db.select().from(config).where(eq(config.klucz, klucz)).get()?.wartosc ?? null;
}
