/**
 * Token bucket API Selly (`src/selly/limiter.ts`, port `rate_limiter.cjs`).
 *
 * ⭐ To jest mechanizm, który realnie ugasił burzę HTTP 429 z 2026-09-07 — nie retry
 * (patrz `selly.discovery.test.ts`, sekcja o 429). Dlatego jest testowany osobno i dokładnie.
 *
 * Zegar i uśpienie są wstrzykiwane, więc test mierzy DECYZJE limitera (ile razy i na jak
 * długo kazał czekać), a nie upływ realnego czasu — inaczej sprawdzenie pełnego okna
 * trwałoby minutę.
 */
import { describe, expect, it } from "vitest";

import {
  MAKS_ZAPYTAN,
  MIN_ODSTEP_MS,
  OKNO_MS,
  stworzLimiter,
  type ZegarLimitera,
} from "../src/selly/limiter.js";

/** Zegar sterowany: `spij()` nie śpi, tylko przesuwa czas i zapisuje, o ile go proszono. */
function zegarTestowy(start = 1_000_000): ZegarLimitera & { drzemki: number[]; teraz(): number } {
  let czas = start;
  const drzemki: number[] = [];
  return {
    teraz: () => czas,
    spij: (ms: number) => {
      drzemki.push(ms);
      czas += ms;
      return Promise.resolve();
    },
    drzemki,
  };
}

describe("limiter zapytań do Selly", () => {
  it("stałe zgadzają się z oryginałem: 250 / 60 s, min. odstęp 240 ms", () => {
    expect(MAKS_ZAPYTAN).toBe(250);
    expect(OKNO_MS).toBe(60_000);
    // `Math.ceil(60000 / 250)` — oryginał liczy to tak samo (`rate_limiter.cjs:12`).
    expect(MIN_ODSTEP_MS).toBe(240);
  });

  it("pierwsza zgoda idzie od ręki — nic nie czeka na pusty bucket", async () => {
    const zegar = zegarTestowy();
    const limiter = stworzLimiter(MAKS_ZAPYTAN, OKNO_MS, zegar);

    await limiter.acquire();

    expect(zegar.drzemki).toEqual([]);
    expect(limiter.getStats()).toEqual({
      requestsInWindow: 1,
      capacity: 250,
      utilizationPct: 0,
    });
  });

  it("⭐ druga zgoda w tej samej chwili czeka DOKŁADNIE 240 ms", async () => {
    const zegar = zegarTestowy();
    const limiter = stworzLimiter(MAKS_ZAPYTAN, OKNO_MS, zegar);

    await limiter.acquire();
    await limiter.acquire();

    // To jest dławik, który zamienił burst ~3200 req/min (MO2) w ~250.
    expect(zegar.drzemki).toEqual([MIN_ODSTEP_MS]);
  });

  it("gdy od ostatniej zgody minęło już dość czasu, nie czeka wcale", async () => {
    const zegar = zegarTestowy();
    const limiter = stworzLimiter(MAKS_ZAPYTAN, OKNO_MS, zegar);

    await limiter.acquire();
    zegar.spij(MIN_ODSTEP_MS + 5);
    zegar.drzemki.length = 0;

    await limiter.acquire();

    expect(zegar.drzemki).toEqual([]);
  });

  it("⭐ pełne okno wstrzymuje do wygaśnięcia NAJSTARSZEGO wpisu (+10 ms)", async () => {
    // Bucket na 2 zgody w oknie 1000 ms — ta sama logika, krótszy rachunek.
    const zegar = zegarTestowy();
    const limiter = stworzLimiter(2, 1000, zegar);

    await limiter.acquire(); // t = 1 000 000
    await limiter.acquire(); // t = 1 000 240 (po odstępie 240 ms)
    zegar.drzemki.length = 0;

    await limiter.acquire();

    // Najstarszy wpis ma t=1 000 000, okno mija o 1 001 000; teraz jest 1 000 240,
    // więc czekamy 760 + 10 ms. Potem bucket ma miejsce i zgoda przechodzi.
    expect(zegar.drzemki[0]).toBe(1000 - 240 + 10);
    expect(limiter.getStats().requestsInWindow).toBeLessThanOrEqual(2);
  });

  it("`getStats` odsiewa wpisy spoza okna i liczy wykorzystanie w procentach", async () => {
    const zegar = zegarTestowy();
    const limiter = stworzLimiter(4, 1000, zegar);

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.getStats()).toEqual({
      requestsInWindow: 2,
      capacity: 4,
      utilizationPct: 50,
    });

    zegar.spij(1500); // całe okno przeminęło
    expect(limiter.getStats()).toEqual({
      requestsInWindow: 0,
      capacity: 4,
      utilizationPct: 0,
    });
  });
});
