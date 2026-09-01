/**
 * Klient zakładki „Dostawcy" — `POST /api/dostawcy/{kod}/synchronizuj-teraz`
 * i `PATCH /api/dostawcy/{id}`.
 *
 * Tu wchłaniamy `mirror/frontend/assets/freq-injection.js` (302 linie). Ten skrypt
 * powstał, bo produkcyjna karta dostawcy (`ZT()`, frontend-index.js:25661-25806)
 * częstotliwość tylko WYŚWIETLA — React nie miał żadnej ścieżki zapisu, więc Ania
 * dogrywała DOM obok bundla i wołała PATCH sama. Presety, format etykiety i `data-testid`
 * karty przenosimy 1:1; znika wyłącznie warstwa dogrywania DOM-u, bo w Reakcie nie ma
 * czego dogrywać.
 */
import { zadanie } from "@/lib/api";

/** Kształt z `contract/fixtures/GET_dostawcy.json` — tyle, ile używa ta zakładka. */
export type DostawcaKonfiguracji = {
  id: number;
  kod: string;
  nazwa: string;
  email: string | null;
  formatPliku: string;
  sposobDostarczania: string;
  url: string | null;
  czestotliwoscMinuty: number | null;
  status: string;
  ostatniPlik: string | null;
  ostatniaSync: string | null;
  liczbaProduktow: number;
};

/** Presety 1:1 z `OPTIONS_MIN` (freq-injection.js:21). */
export const PRESETY_CZESTOTLIWOSCI = [
  5, 15, 30, 60, 120, 240, 360, 720, 1440, 2880, 10080,
] as const;

/** Port `fmt()` (freq-injection.js:23-27) — „45 min", „2 godz.", „7 dni". */
export function formatujCzestotliwosc(minuty: number): string {
  if (minuty < 60) return `${minuty} min`;
  if (minuty < 1440) return `${Math.round(minuty / 60)} godz.`;
  return `${Math.round(minuty / 1440)} dni`;
}

/**
 * Znacznik ostatniej próby w formacie lokalnym. `ostatniaSync` jest ustawiana TAKŻE po
 * nieudanym pobraniu (backend: `oznaczBladDostawcy`), więc etykieta w widoku mówi
 * „ostatnia próba", a nie „ostatni sukces" — ten drugi to `ostatniPlik`.
 */
export function formatujZnacznik(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type WynikSynchronizacji =
  | { ok: true; liczbaProduktow: number; doStagingu?: number; autoZatwierdzone?: number }
  | { ok: false; error: string };

/**
 * ⚠ Ta trasa odpowiada 200 TAKŻE przy niepowodzeniu — powód siedzi w polu `ok` ciała,
 * nie w kodzie HTTP (port `:48238-48242`). Dlatego czytamy ciało zamiast polegać na
 * `rzucGdyBlad`; oryginalna karta robi dokładnie to samo (`:25727`).
 */
export async function synchronizujTeraz(kod: string): Promise<WynikSynchronizacji> {
  const odpowiedz = await zadanie("POST", `/api/dostawcy/${encodeURIComponent(kod)}/synchronizuj-teraz`, {});
  return (await odpowiedz.json()) as WynikSynchronizacji;
}

/** Pola, które zakładka pozwala edytować — te same, które backend przyjmuje w PATCH-u. */
export type PatchDostawcy = {
  url?: string | null;
  czestotliwoscMinuty?: number | null;
  sposobDostarczania?: string;
  status?: string;
};

/**
 * `PATCH /api/dostawcy/{id}` — po NUMERYCZNYM `id`, nie po kodzie.
 *
 * `freq-injection.js` musiał trzymać własną mapę `kod → id` odświeżaną z `GET /api/dostawcy`
 * (`:78-104`), bo pracował na DOM-ie, w którym był tylko kod. W Reakcie mamy cały rekord
 * dostawcy pod ręką i mapa jest zbędna — to jedyne uproszczenie względem skryptu.
 */
export async function zapiszDostawce(
  id: number,
  patch: PatchDostawcy,
): Promise<DostawcaKonfiguracji> {
  const odpowiedz = await zadanie("PATCH", `/api/dostawcy/${id}`, patch);
  return (await odpowiedz.json()) as DostawcaKonfiguracji;
}
