/**
 * Klient `/api/config` — wspólny dla zakładek „Shoper" i „AI Fallback".
 *
 * ⚠ Zapis idzie POJEDYNCZYMI KLUCZAMI, nie całym obiektem. Oryginał wysyła osobne żądanie
 * na każdy klucz: zakładka AI trzy (`frontend-index.js:25995-26003`), Shoper dwa
 * (`:26251-26256`). `docs/incoming/frontend-perplexity/dokumentacja/02_WIDOKI.md:144`
 * twierdzi co innego („POST body to obiekt konfiguracji") — to błąd dokumentacji,
 * sprawdzony w bundlu produkcji. Roadmapa mówiła o `PUT /api/config`; takiej metody nie ma
 * ani oryginał, ani `contract/openapi.yaml:550`.
 */
import { zadanie } from "@/lib/api";

/** Odpowiedź `GET /api/config` — płaski obiekt, same stringi (`GET_config.json`). */
export type Konfiguracja = Record<string, string>;

/** Klucz zapytania = ścieżka (konwencja `lib/queryClient.ts`). */
export const KLUCZ_KONFIGURACJI = ["/api/config"] as const;

/** Jedno żądanie = jeden klucz. */
export async function zapiszKlucz(klucz: string, wartosc: string): Promise<void> {
  await zadanie("POST", "/api/config", { klucz, wartosc });
}

/**
 * Zapis kilku kluczy naraz — PO KOLEI, nie równolegle.
 *
 * Oryginał czeka na każdy `await $t("POST", …)` osobno, więc przy błędzie w środku część
 * kluczy jest już zapisana, a reszta nie. Odtwarzamy to zachowanie: `Promise.all` wyglądałby
 * lepiej, ale zmieniałby kolejność zapisów w audycie i moment, w którym seria się przerywa.
 */
export async function zapiszKlucze(wpisy: [klucz: string, wartosc: string][]): Promise<void> {
  for (const [klucz, wartosc] of wpisy) {
    await zapiszKlucz(klucz, wartosc);
  }
}
