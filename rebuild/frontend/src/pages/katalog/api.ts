/**
 * Klient mutacji katalogu — port `Og`, `jb` i obsługi override'ów z oryginału.
 *
 * Backend tych tras dowiozła sesja 12a (`35-FEATURE-mutacje-produktow-backend`);
 * `GET`/`DELETE /api/overrides` stoi od 3d-2. Do tej sesji nie miały z czego być wołane.
 *
 * ⚠ INVALIDACJE ROBI WOŁAJĄCY, nie ten moduł. Oryginał zaszywa je w `Og`/`jb`
 * (`Uo("/api/products")`, `frontend-index.js:9149,9152`), ale u nas mutacje idą przez
 * `useMutation`, więc unieważnianie siedzi w `onSettled` w `Katalog.tsx` — jedno miejsce
 * zamiast dwóch. Zestaw kluczy jest ten sam co w oryginale plus `["/api/history"]` (D2).
 */
import { zadanie } from "@/lib/api";
import type { Produkt } from "./filtrowanie";

/**
 * Ręczna poprawka pola produktu — kształt z `contract/fixtures/GET_overrides.json`.
 *
 * ⚠ KLUCZE SĄ camelCase (`fieldName`, nie `field_name`). To nie jest oczywiste: trasa
 * czyta bazę przez Drizzle, a kolumny w SQLite nazywają się `field_name`. Fixture jest tu
 * wyrocznią — pułapka „projekcja Drizzle vs `SELECT *`" z `CLAUDE.md` §5 w tę stronę
 * NIE występuje, bo `repos/overrides.ts` wypisuje projekcję jawnie.
 */
export type Override = {
  id: number;
  supplierKod: string;
  supplierProductId: string;
  fieldName: string;
  overrideValue: string | null;
  reason: string | null;
  createdBy: number | null;
  createdAt: string | null;
  acknowledgedSourceValue: string | null;
};

/**
 * Override'y jednego produktu — port `:23918-23926`.
 *
 * Oba parametry idą przez `encodeURIComponent` (1:1 z oryginałem): `kod` bywa postaci
 * `MO2_1147700`, ale nic nie gwarantuje, że dostawca nie wniesie kiedyś znaku wymagającego
 * kodowania.
 */
export async function pobierzOverrides(dostawca: string, kod: string): Promise<Override[]> {
  const zapytanie = new URLSearchParams({ dostawca, kod });
  const odpowiedz = await zadanie("GET", `/api/overrides?${zapytanie.toString()}`);
  return (await odpowiedz.json()) as Override[];
}

/** Zdjęcie override'u z pola — port `:23955`. Po nim import znów nadpisze wartość. */
export async function usunOverride(id: number): Promise<void> {
  await zadanie("DELETE", `/api/overrides/${id}`);
}

/**
 * Zapis edycji produktu — port `Og` (`:9147-9150`).
 *
 * `zmiany` to WYŁĄCZNIE pola dotknięte przez użytkownika, nie cały produkt. Tak robi
 * oryginał (stan dialogu startuje pustym obiektem) i tak musi zostać: trasa zapisuje
 * `manual_overrides` dla KAŻDEGO zmienionego pola, więc wysłanie niezmienionej wartości
 * zamroziłoby ją przed importem.
 *
 * Odpowiedź to pełny produkt w projekcji kontraktowej, nie `{ok:true}`
 * (`backend/src/routes/products.ts`, `wKontrakcie`).
 */
export async function zapiszProdukt(
  id: number,
  zmiany: Record<string, unknown>,
): Promise<Produkt> {
  const odpowiedz = await zadanie("PATCH", `/api/products/${id}`, zmiany);
  return (await odpowiedz.json()) as Produkt;
}

/**
 * Usunięcie produktu — port `jb` (`:9151-9153`).
 *
 * Bez kaskad: osierocone `manual_overrides` i wpisy `history` to zastane zachowanie
 * oryginału, świadomie odtworzone w 12a.
 */
export async function usunProdukt(id: number): Promise<void> {
  await zadanie("DELETE", `/api/products/${id}`);
}
