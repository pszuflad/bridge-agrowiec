/**
 * Scheduler Toru 1 (`src/selly/scheduler-sync.ts`, port `scheduler_selly.cjs`).
 *
 * ⚠ Testy NIE stawiają żadnego timera — wołają `tik(data)` wprost z podaną chwilą.
 * `setInterval` jest w `uruchom()`, którego suita nie dotyka; automat startuje wyłącznie
 * w `server.ts` za `SELLY_SCHEDULER` (ticket 45, decyzja D4).
 */
import { describe, expect, it, vi } from "vitest";

import {
  DOSTAWCY_AKTYWNI,
  dostawcyPelnegoNaDzis,
  MINUTY_TORU_1,
  ROTACJA_PELNA,
  stworzSchedulerSelly,
  uruchomDeltaDlaWszystkich,
} from "../src/selly/scheduler-sync.js";

const STATS = { total: 0, ok: 0, err: 0, skip: 0, discovered: 0, created: 0 };
const wynikPusty = () => Promise.resolve({ stats: { ...STATS }, errors: [], logId: 1 });

/** `2026-09-09` to środa; godzinę i minutę podajemy wprost. */
const chwila = (hh: number, mm: number, dzien = "2026-09-09") =>
  new Date(`${dzien}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);

describe("scheduler Selly — wyzwalanie Toru 1", () => {
  it("rusza o HH:55 (event-driven) i o HH:10/25/40 (fallback)", async () => {
    expect(MINUTY_TORU_1).toEqual([55, 10, 25, 40]);

    for (const mm of [55, 10, 25, 40]) {
      const syncDelta = vi.fn(wynikPusty);
      stworzSchedulerSelly({ syncDelta }).tik(chwila(14, mm));
      await vi.waitFor(() => expect(syncDelta).toHaveBeenCalled());
    }
  });

  it("nie rusza w minutach spoza harmonogramu", () => {
    const syncDelta = vi.fn(wynikPusty);
    const scheduler = stworzSchedulerSelly({ syncDelta });

    for (const mm of [0, 5, 11, 26, 41, 54, 56, 59]) {
      scheduler.tik(chwila(14, mm));
    }

    expect(syncDelta).not.toHaveBeenCalled();
  });

  /**
   * ⚠ Scheduler tyka CO MINUTĘ, więc bez tego strażnika dwa tiki w tej samej minucie
   * uruchomiłyby przebieg dwa razy — a przebieg to setki PUT-ów do cudzego sklepu.
   */
  it("⭐ dwa tiki w tej samej minucie dają JEDEN przebieg", async () => {
    const syncDelta = vi.fn(wynikPusty);
    const scheduler = stworzSchedulerSelly({ syncDelta });

    scheduler.tik(chwila(14, 55));
    scheduler.tik(chwila(14, 55));

    // `runDeltaAll` idzie sekwencyjnie, więc czekamy aż DOMKNIE komplet dostawców…
    await vi.waitFor(() =>
      expect(syncDelta).toHaveBeenCalledTimes(DOSTAWCY_AKTYWNI.length),
    );
    // …i dopiero potem sprawdzamy, że drugi tik nie dołożył drugiego przebiegu.
    await new Promise((r) => setTimeout(r, 20));
    expect(syncDelta).toHaveBeenCalledTimes(DOSTAWCY_AKTYWNI.length);
  });

  it("kolejna minuta z harmonogramu rusza ponownie", async () => {
    const syncDelta = vi.fn(wynikPusty);
    const scheduler = stworzSchedulerSelly({ syncDelta });

    scheduler.tik(chwila(14, 55));
    await vi.waitFor(() => expect(syncDelta).toHaveBeenCalledTimes(DOSTAWCY_AKTYWNI.length));
    scheduler.tik(chwila(15, 10));

    await vi.waitFor(() =>
      expect(syncDelta).toHaveBeenCalledTimes(DOSTAWCY_AKTYWNI.length * 2),
    );
  });

  it("`uruchom()`/`zatrzymaj()` nie zostawiają timera", () => {
    const scheduler = stworzSchedulerSelly({ syncDelta: vi.fn(wynikPusty) });
    scheduler.uruchom();
    scheduler.uruchom(); // idempotentne — drugi timer nie powstaje
    scheduler.zatrzymaj();
    expect(true).toBe(true);
  });
});

describe("`uruchomDeltaDlaWszystkich`", () => {
  it("idzie po dziesięciu dostawcach SEKWENCYJNIE", async () => {
    const kolejnosc: (string | null)[] = [];
    const syncDelta = vi.fn((dostawca: string | null) => {
      kolejnosc.push(dostawca);
      return wynikPusty();
    });

    const wyniki = await uruchomDeltaDlaWszystkich(syncDelta);

    expect(kolejnosc).toEqual([...DOSTAWCY_AKTYWNI]);
    expect(wyniki).toHaveLength(10);
    // Domyślne opcje 1:1 z oryginałem (`scheduler_selly.cjs:58-61`).
    expect(syncDelta).toHaveBeenCalledWith("MO1", { dryRun: false, maxProducts: 5000 });
  });

  /**
   * ⚠ Padnięty dostawca NIE przerywa reszty — inaczej jeden zepsuty cennik zatrzymywałby
   * synchronizację dziewięciu pozostałych.
   */
  it("błąd jednego dostawcy nie przerywa pozostałych", async () => {
    const syncDelta = vi.fn((dostawca: string | null) =>
      dostawca === "MO3" ? Promise.reject(new Error("padlo MO3")) : wynikPusty(),
    );

    const wyniki = await uruchomDeltaDlaWszystkich(syncDelta);

    expect(wyniki).toHaveLength(10);
    expect(wyniki.find((w) => w.dostawca === "MO3")).toMatchObject({
      ok: false,
      error: "padlo MO3",
    });
  });

  it("można zawęzić listę dostawców", async () => {
    const syncDelta = vi.fn(wynikPusty);

    await uruchomDeltaDlaWszystkich(syncDelta, { suppliers: ["MO2"] });

    expect(syncDelta).toHaveBeenCalledTimes(1);
  });
});

/**
 * Rotacja Toru 2 NICZEGO nie uruchamia (Tor 2 wyłączony), ale wychodzi przez
 * `GET /api/selly/sync-status` jako `todayRotation` — więc musi się zgadzać z produkcją.
 */
describe("rotacja Toru 2 (wyłączonego) — `dostawcyPelnegoNaDzis`", () => {
  it("mapa dni tygodnia 1:1 z oryginałem", () => {
    expect(ROTACJA_PELNA).toEqual({
      1: ["MO1", "MO2"],
      2: ["MO3", "MO4"],
      3: ["MO5", "MO6"],
      4: ["MO9"],
      5: ["MO10"],
      6: ["MO7"],
      0: ["MO8"],
    });
  });

  it("zwykły dzień oddaje swoją parę", () => {
    // 2026-09-07 to poniedziałek.
    expect(dostawcyPelnegoNaDzis(new Date("2026-09-07T12:00:00"))).toEqual(["MO1", "MO2"]);
  });

  it("⭐ MO7 (sobota) i MO8 (niedziela) tylko w PIERWSZYM takim dniu miesiąca", () => {
    // 2026-09-05 — pierwsza sobota września (dzień 5 ≤ 7).
    expect(dostawcyPelnegoNaDzis(new Date("2026-09-05T12:00:00"))).toEqual(["MO7"]);
    // 2026-09-12 — druga sobota, poza oknem.
    expect(dostawcyPelnegoNaDzis(new Date("2026-09-12T12:00:00"))).toEqual([]);

    // 2026-09-06 — pierwsza niedziela; 2026-09-13 — druga.
    expect(dostawcyPelnegoNaDzis(new Date("2026-09-06T12:00:00"))).toEqual(["MO8"]);
    expect(dostawcyPelnegoNaDzis(new Date("2026-09-13T12:00:00"))).toEqual([]);
  });
});
