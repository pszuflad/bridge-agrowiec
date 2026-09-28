/**
 * `wartosciKafli()` — puste stany czterech kafli nagłówka `/analityka` (ticket 97, karta PR.2).
 *
 * Oryginał (`deminified/frontend-index.js:27980-28030`) NIE jest tu symetryczny: domyślne
 * `data: f = {}`, `v = { rows: [] }`, `b = { rows: [] }`, `p = {}` dają w trakcie ładowania
 * „—" tylko dla dostawców, a „0" dla pozostałych trzech. `null` (wygasła sesja) oryginał
 * wysypuje; tu daje „—" dla trzech pierwszych i „0" dla snapshotów (decyzja D4).
 */
import { describe, expect, it } from "vitest";

import { wartosciKafli } from "@/pages/analityka/NaglowekKpi";

describe("wartosciKafli", () => {
  it('dane jeszcze niewczytane (`undefined`) — „—" / „0" / „0" / „0", jak oryginał', () => {
    expect(
      wartosciKafli({
        filtry: undefined,
        status: undefined,
        porownanieEan: undefined,
        unikalneEan: undefined,
      }),
    ).toEqual({
      dostawcy: "—",
      eanWspolne: "0",
      pozycjeUnikalne: "0",
      snapshoty: "0",
    });
  });

  it('wygasła sesja (`null`) — „—" / „—" / „—" / „0", bez wysypania widoku', () => {
    expect(
      wartosciKafli({
        filtry: null,
        status: null,
        porownanieEan: null,
        unikalneEan: null,
      }),
    ).toEqual({
      dostawcy: "—",
      eanWspolne: "—",
      pozycjeUnikalne: "—",
      snapshoty: "0",
    });
  });

  it('odpowiedź bez `rows` — „—", jak `v.rows ? … : "—"` w oryginale', () => {
    const wynik = wartosciKafli({
      filtry: undefined,
      status: undefined,
      porownanieEan: {},
      unikalneEan: {},
    });
    expect(wynik.eanWspolne).toBe("—");
    expect(wynik.pozycjeUnikalne).toBe("—");
  });

  it("liczby surowe, bez separatora tysięcy", () => {
    const wynik = wartosciKafli({
      filtry: undefined,
      status: { hasHistory: true, snapshots: 15597, od: null, do: null },
      porownanieEan: {
        rows: Array.from({ length: 1000 }, () => ({}) as never),
      },
      unikalneEan: undefined,
    });
    expect(wynik.snapshoty).toBe("15597");
    expect(wynik.eanWspolne).toBe("1000");
  });
});
