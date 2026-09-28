/**
 * Klient `POST /api/dostawcy/{kod}/upload` — port `sP()`
 * (`deminified/frontend-index.js:18821-18845`).
 */
import { BAZA_API, naglowki } from "@/lib/api";
import type { RekordPodgladu } from "./typy";

export type WynikUploadu = {
  ok: boolean;
  nazwaPliku: string;
  liczbaProduktow: number;
  doStagingu: number;
  nowe: number;
  zmienione: number;
  wycofane: number;
  bezZmian: number;
  autoZatwierdzone: number;
  odrzuconeNieOpony: number;
  odrzuconeBrakDanych: number;
  odrzuconeSmieciMO2: number;
  /** Pierwsze 5 rekordów PO adapterze — jedyne źródło podglądu (decyzja sesji 3f-1). */
  podglad: RekordPodgladu[];
};

/**
 * Wysyła ORYGINALNY plik przez `FormData`, dokładnie jak oryginał: przeglądarka niczego
 * nie przetwarza ani nie przepisuje, backend parsuje od zera. `Content-Type` ustawia
 * przeglądarka (z `boundary`), więc `naglowki(false)` — dodanie `application/json`
 * zepsułoby multipart.
 */
export async function wgrajPlik(kodDostawcy: string, plik: File): Promise<WynikUploadu> {
  const dane = new FormData();
  dane.append("plik", plik);

  const odpowiedz = await fetch(`${BAZA_API}/api/dostawcy/${kodDostawcy}/upload`, {
    method: "POST",
    body: dane,
    headers: naglowki(false),
    credentials: "include",
  });

  const cialo = (await odpowiedz.json().catch(() => ({}))) as Partial<WynikUploadu> & {
    error?: string;
  };

  // Oryginał bierze komunikat z ciała, a dopiero w ostateczności składa własny
  // (`:18836`). Bez tego Ania zobaczyłaby „500" zamiast powodu, dla którego parser padł —
  // a widoczność nieudanego parsowania jest gate'em tej sesji.
  if (!odpowiedz.ok) {
    throw new Error(cialo?.error || `Upload ${kodDostawcy} nie powiódł się`);
  }
  return cialo as WynikUploadu;
}
