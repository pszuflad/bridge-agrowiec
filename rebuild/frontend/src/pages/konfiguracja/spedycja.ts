/**
 * Klient `/api/spedycja` — zakładka „Spedycja".
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D2, decyzja użytkownika). W produkcji ta zakładka NIE ŁĄCZY
 * SIĘ Z BACKENDEM: `setQueryDefaults(["/api/spedycja"], {queryFn: async () => [...an]})`
 * (`frontend-index.js:10381`) podstawia tablicę z pamięci modułu, a zapis idzie do IndexedDB
 * (`:10365-10371`). Limity żyją więc wyłącznie w przeglądarce jednej osoby — inny komputer
 * albo wyczyszczone dane witryny i nie ma ich.
 *
 * Backend produkcji ma sprawne `GET/POST /api/spedycja` (`backend-index.cjs:48735-48738`),
 * tylko nikt ich stąd nie woła. Odbudowa podpina widok pod te trasy: to jedyna zmiana
 * zachowania w tej zakładce, cała reszta (układ tabeli, `data-testid`, konwersje pól,
 * pojawianie się przycisku „Zapisz") jest portem 1:1.
 */
import { zadanie } from "@/lib/api";

/** Wiersz z `contract/fixtures/GET_spedycja.json`. */
export type LimitSpedycji = {
  id: number;
  dostawcaKod: string;
  progNetto: number | null;
  kosztPonizej: number | null;
  kosztPowyzej: number | null;
  dodatkoweReguly: string | null;
};

/** Pola, które zakładka pozwala edytować — bez `id`, bo to tożsamość wiersza. */
export type PatchLimitu = {
  dostawcaKod: string;
  progNetto?: number | null;
  kosztPonizej?: number | null;
  kosztPowyzej?: number | null;
  dodatkoweReguly?: string | null;
};

/** Klucz zapytania = ścieżka (konwencja `lib/queryClient.ts`). */
export const KLUCZ_SPEDYCJI = ["/api/spedycja"] as const;

/** UPSERT po `dostawcaKod` — backend nie potrzebuje `id` i nie przyjmuje go. */
export async function zapiszLimit(patch: PatchLimitu): Promise<void> {
  await zadanie("POST", "/api/spedycja", patch);
}
