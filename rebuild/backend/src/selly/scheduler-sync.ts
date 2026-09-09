/**
 * Scheduler synchronizacji Bridge → Selly — port
 * `mirror/backend/selly/scheduler_selly.cjs` (Iteracja 13d-1, ticket 45).
 *
 * TOR 1 (delta stan/cena) — AKTYWNY:
 *   - HH:55 „event-driven" — tuż po auto-pullu dostawców o HH:54;
 *   - HH:10 / HH:25 / HH:40 „fallback" — dla zmian wprowadzonych ręcznie.
 *
 * TOR 2 (pełny mirror + auto-create) — WYŁĄCZONY, tak jak u Ani: `sync_full` czeka na
 * refaktor pod model wariantowy. W oryginale `require` Toru 2 jest zakomentowany
 * (`scheduler_selly.cjs:19`), a w `tick()` nie ma po nim śladu. Domknięcie: karta 13d-2.
 *
 * ⚠ ODSTĘPSTWO — PRZEŁĄCZNIK `SELLY_SCHEDULER`, DOMYŚLNIE WYŁĄCZONY (ticket 45, decyzja D4).
 * Oryginał instaluje scheduler BEZWARUNKOWO przy starcie (`extensions.cjs:466`). U nas ten
 * moduł niczego nie uruchamia, dopóki `server.ts` nie zawoła `uruchom()` — dokładnie ten sam
 * wzorzec i to samo uzasadnienie co `IMPORT_SCHEDULER` z I3 (`import/scheduler.ts:13-30`):
 * staging stoi na TYM SAMYM VPS co produkcja i patrzy na TEN SAM, żywy sklep Selly, więc
 * bezwarunkowy automat robiłby tam realne `PUT`-y na cudzych produktach co 15 minut,
 * a jedynym zabezpieczeniem byłby `SELLY_TRYB`. Dodatkowo `stworzApp` nie ma gdzie sprzątać
 * timerów, a testy budują aplikację dla każdego scenariusza z osobna.
 */

import type { OpcjeSyncDelta, WynikSyncDelta } from "./sync-delta.js";

/** `ACTIVE_SUPPLIERS` (`scheduler_selly.cjs:22`) — wszystkich dziesięciu dostawców. */
export const DOSTAWCY_AKTYWNI = [
  "MO1",
  "MO2",
  "MO3",
  "MO4",
  "MO5",
  "MO6",
  "MO7",
  "MO8",
  "MO9",
  "MO10",
] as const;

/**
 * Rotacja Toru 2 na dni tygodnia (`FULL_ROTATION`, `:25-33`). Klucz to `Date.getDay()`
 * (0 = niedziela).
 *
 * ⚠ Tor 2 jest wyłączony, więc ta mapa NICZEGO NIE URUCHAMIA — ale `GET /api/selly/sync-status`
 * zwraca `todayRotation` policzone z niej (`routes_sync.cjs:35`), więc musi tu być, żeby
 * odpowiedź trasy zgadzała się z produkcją.
 */
export const ROTACJA_PELNA: Readonly<Record<number, readonly string[]>> = {
  1: ["MO1", "MO2"],
  2: ["MO3", "MO4"],
  3: ["MO5", "MO6"],
  4: ["MO9"],
  5: ["MO10"],
  6: ["MO7"],
  0: ["MO8"],
};

/** Port `isFirstOfMonthDay()` (`:35-38`): ten dzień tygodnia, ale tylko pierwszy w miesiącu. */
function pierwszyTakiDzienMiesiaca(data: Date, dzienTygodnia: number): boolean {
  if (data.getDay() !== dzienTygodnia) return false;
  return data.getDate() <= 7;
}

/**
 * Port `suppliersForFullToday()` (`:40-48`). MO7 (sobota) i MO8 (niedziela) idą raz
 * w miesiącu, reszta zgodnie z rotacją tygodniową.
 */
export function dostawcyPelnegoNaDzis(data: Date = new Date()): string[] {
  const dzien = data.getDay();
  const zaplanowani = ROTACJA_PELNA[dzien] ?? [];
  return zaplanowani.filter((s) => {
    if (s === "MO7") return pierwszyTakiDzienMiesiaca(data, 6);
    if (s === "MO8") return pierwszyTakiDzienMiesiaca(data, 0);
    return true;
  });
}

/** Podpis `syncDelta(...)` związany już z zależnościami — jeden na proces. */
export type FunkcjaSyncDelta = (
  dostawca: string | null,
  opcje?: OpcjeSyncDelta,
) => Promise<WynikSyncDelta>;

export type WynikDostawcy =
  | ({ dostawca: string } & WynikSyncDelta["stats"])
  | { ok: false; dostawca: string; error: string };

/**
 * Port `runDeltaAll()` (`:53-72`).
 *
 * Dostawcy idą SEKWENCYJNIE, nie równolegle — przy jednym kluczu API i limicie 250/60 s
 * równoległość tylko wypełniłaby okno limitera. Błąd jednego dostawcy nie przerywa reszty.
 */
export async function uruchomDeltaDlaWszystkich(
  syncDelta: FunkcjaSyncDelta,
  opcje: { suppliers?: readonly string[]; dryRun?: boolean; maxProducts?: number } = {},
): Promise<WynikDostawcy[]> {
  const dostawcy = opcje.suppliers ?? DOSTAWCY_AKTYWNI;
  const wyniki: WynikDostawcy[] = [];

  for (const s of dostawcy) {
    try {
      const r = await syncDelta(s, {
        dryRun: opcje.dryRun || false,
        maxProducts: opcje.maxProducts || 5000,
      });
      wyniki.push({ dostawca: s, ...r.stats });
      if (r.stats.total > 0) {
        console.log(
          `[Selly Tor1] ${s}: total=${r.stats.total}, ok=${r.stats.ok}, err=${r.stats.err},` +
            ` discovered=${r.stats.discovered}`,
        );
      }
    } catch (e) {
      const komunikat = e instanceof Error ? e.message : String(e);
      wyniki.push({ ok: false, dostawca: s, error: komunikat });
      console.error(`[Selly Tor1] ${s} FATAL:`, komunikat);
    }
  }

  return wyniki;
}

/** Minuty, o których rusza Tor 1 (`:83`). 55 = event-driven, reszta = fallback. */
export const MINUTY_TORU_1 = [55, 10, 25, 40] as const;

const ODSTEP_SPRAWDZENIA_MS = 60_000;

export type SchedulerSelly = {
  uruchom(): void;
  zatrzymaj(): void;
  /** Jeden przebieg sprawdzenia — wystawiony, żeby test nie musiał czekać na `setInterval`. */
  tik(teraz?: Date): void;
};

export type ZaleznosciSchedulerSelly = {
  syncDelta: FunkcjaSyncDelta;
  opcje?: { dryRun?: boolean; maxProducts?: number };
};

/**
 * Port `installScheduler()` (`:77-101`) — `setInterval` co minutę, NIE cron.
 *
 * `ostatniKlucz` (`"YYYY-MM-DD HH:MM"`) pilnuje, żeby przebieg nie odpalił się dwa razy
 * w tej samej minucie, gdy tik trafi ją dwukrotnie.
 */
export function stworzSchedulerSelly({
  syncDelta,
  opcje = {},
}: ZaleznosciSchedulerSelly): SchedulerSelly {
  let timer: NodeJS.Timeout | null = null;
  let ostatniKlucz: string | null = null;

  function tik(teraz: Date = new Date()): void {
    const hh = teraz.getHours();
    const mm = teraz.getMinutes();
    const klucz = `${teraz.toISOString().substring(0, 10)} ${String(hh).padStart(2, "0")}:${String(
      mm,
    ).padStart(2, "0")}`;

    if ((MINUTY_TORU_1 as readonly number[]).includes(mm) && ostatniKlucz !== klucz) {
      ostatniKlucz = klucz;
      const etykieta = mm === 55 ? "event-driven" : "fallback";
      console.log(
        `[Selly Scheduler] Tor1 ${etykieta} ${hh}:${String(mm).padStart(2, "0")}`,
      );
      void uruchomDeltaDlaWszystkich(syncDelta, opcje).catch((e: unknown) =>
        console.error(
          "[Selly Scheduler] Tor1 err:",
          e instanceof Error ? e.message : String(e),
        ),
      );
    }

    // Tor 2 — wyłączony do czasu refaktoru `sync_full` (13d-2), jak w oryginale.
  }

  return {
    uruchom() {
      if (timer) return;
      timer = setInterval(() => tik(), ODSTEP_SPRAWDZENIA_MS);
      // ⚠ DROBNE ODSTĘPSTWO, ŚWIADOME: oryginał `unref()` nie woła (`scheduler_selly.cjs:99`).
      // Ten sam wzorzec i to samo uzasadnienie co w `import/scheduler.ts:185` („KONIECZNE,
      // nie kosmetyczne"): wiszący interwał trzyma proces przy życiu i wywraca sprzątanie.
      // Dla produkcji bez znaczenia — proces i tak żyje, dopóki nasłuchuje HTTP.
      timer.unref?.();
      console.log(
        "[Selly Scheduler] Zainstalowany. Tor1: HH:55 + HH:10/25/40." +
          " Tor2: WYLACZONY (do refactoru sync_full).",
      );
    },
    zatrzymaj() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    tik,
  };
}
