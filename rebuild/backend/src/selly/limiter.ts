/**
 * Token bucket dla API Selly — port `mirror/backend/selly/rate_limiter.cjs`
 * (Iteracja 13d-1, ticket 45).
 *
 * Selly deklaruje w dokumentacji 300 żądań / 60 s na klucz API. Ania trzyma 250/60 s
 * (~4,2/s, bufor 17% na narzut autoryzacji i słowników) — pierwotnie było 400 i to właśnie
 * ono dawało HTTP 429.
 *
 * ⭐ TO JEST MECHANIZM, KTÓRY REALNIE UGASIŁ BURZĘ 429 — nie retry.
 * `CHANGELOG.md` 2026-09-07 20:35: cykl 20:10 dał ~730 błędów 429 (18–28% na dostawcę), bo
 * `discovery.cjs` deklarowało w komentarzu użycie limitera, a w kodzie wołało `client.api()`
 * bez throttle'a — przy MO2 (1600 produktów) burst ~3200 req/min przy limicie 300/60 s.
 * Poprawka miała dwie części: throttle przed każdym żądaniem (ta, która działa) i retry na
 * 429 (martwa — patrz nota przy `wykonajZPonowieniem` w `discovery.ts`).
 */

/** `MAX_REQUESTS` z oryginału (`rate_limiter.cjs:10`). */
export const MAKS_ZAPYTAN = 250;
/** `WINDOW_MS` (`:11`). */
export const OKNO_MS = 60_000;
/** `MIN_INTERVAL_MS` (`:12`) — `Math.ceil(60000 / 250)` = 240 ms. */
export const MIN_ODSTEP_MS = Math.ceil(OKNO_MS / MAKS_ZAPYTAN);

/** Statystyki wystawiane przez `GET /api/selly/sync-status` (`routes_sync.cjs:25`). */
export type StatystykiLimitera = {
  requestsInWindow: number;
  capacity: number;
  utilizationPct: number;
};

export type Limiter = {
  acquire(): Promise<void>;
  getStats(): StatystykiLimitera;
};

/**
 * Zegar i uśpienie wstrzykiwane, żeby testy nie czekały realnych sekund.
 *
 * ⚠ To JEDYNE odstępstwo od oryginału w tym pliku i jest wyłącznie testowe: produkcyjne
 * wywołanie `stworzLimiter()` bez argumentów daje `Date.now` i `setTimeout`, czyli
 * zachowanie 1:1. Bez tego test throttle'a musiałby realnie odczekać 240 ms na żądanie,
 * a test pełnego okna — pełną minutę.
 */
export type ZegarLimitera = {
  teraz(): number;
  spij(ms: number): Promise<void>;
};

const ZEGAR_SYSTEMOWY: ZegarLimitera = {
  teraz: () => Date.now(),
  spij: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/**
 * Port klasy `RateLimiter` (`rate_limiter.cjs:14-52`) jako domknięcie.
 *
 * Okno przesuwne: trzymamy znaczniki czasu wydanych zgód, odsiewamy starsze niż `oknoMs`.
 * Gdy okno pełne — czekamy do wygaśnięcia najstarszego (+10 ms) i **próbujemy od nowa**
 * (oryginał robi tu rekurencję `return this.acquire()`). Poza tym wymuszamy minimalny
 * odstęp `MIN_ODSTEP_MS` od ostatnio wydanej zgody.
 */
export function stworzLimiter(
  maksZapytan: number = MAKS_ZAPYTAN,
  oknoMs: number = OKNO_MS,
  zegar: ZegarLimitera = ZEGAR_SYSTEMOWY,
): Limiter {
  let znaczniki: number[] = [];

  async function acquire(): Promise<void> {
    const teraz = zegar.teraz();
    znaczniki = znaczniki.filter((t) => teraz - t < oknoMs);

    if (znaczniki.length >= maksZapytan) {
      const najstarszy = znaczniki[0] as number;
      const czekajMs = najstarszy + oknoMs - teraz + 10;
      if (czekajMs > 0) {
        await zegar.spij(czekajMs);
        return acquire();
      }
    }

    if (znaczniki.length > 0) {
      const ostatni = znaczniki[znaczniki.length - 1] as number;
      const odOstatniego = teraz - ostatni;
      if (odOstatniego < MIN_ODSTEP_MS) {
        await zegar.spij(MIN_ODSTEP_MS - odOstatniego);
      }
    }

    znaczniki.push(zegar.teraz());
  }

  function getStats(): StatystykiLimitera {
    const teraz = zegar.teraz();
    const swieze = znaczniki.filter((t) => teraz - t < oknoMs);
    return {
      requestsInWindow: swieze.length,
      capacity: maksZapytan,
      utilizationPct: Math.round((100 * swieze.length) / maksZapytan),
    };
  }

  return { acquire, getStats };
}

/**
 * Singleton dzielony przez discovery i sync-delta — jak `globalLimiter` w oryginale
 * (`rate_limiter.cjs:54`). Jeden proces = jeden klucz API Selly = jedno okno limitu,
 * więc dzielenie instancji jest tu istotą rzeczy, nie wygodą.
 */
export const globalnyLimiter = stworzLimiter();
