/**
 * HARMONOGRAM synchronizacji Bridge → Selly — port
 * `origin/main:mirror/backend/selly/scheduler_selly.cjs` (karta I15.8, ticket 121;
 * produkcja zamrożona na `88fa31c`).
 *
 * Tor 1 (DELTA — stan/cena): HH:55 dla dostawców z auto-pull o HH:54 + fallback
 * HH:10/HH:25/HH:40 dla ręcznych aktualizacji. Każde uruchomienie to `syncDelta` po kolei
 * dla wszystkich dostawców z `ACTIVE_SUPPLIERS`.
 * Tor 3 (ticket 186, NOWA funkcja): po każdym Torze 1 usuwa z Selly produkty, których nie ma już w Bridge
 * (`sync-usuwanie.ts`), z historią w `selly_sync_log` i `history`.
 * Tor 2 (PEŁNY MIRROR + auto-create): codziennie 04:30, po auto-pull dostawców o 04:00.
 * Rotacja per dzień tygodnia (`FULL_ROTATION`), cache kodów Selly budowany RAZ na partię.
 *
 * Montaż w oryginale: `extensions.cjs:486-487` woła `installScheduler(_bridgeDb)` — bez opcji
 * i BEZ żadnej flagi, czyli na produkcji harmonogram chodzi zawsze, z `autoCreate=true`.
 *
 * ── ODSTĘPSTWA ŚWIADOME (karta I15.8, decyzje użytkownika 2026-09-23) ───────────────────
 * 1. Harmonogram stoi za `SELLY_SCHEDULER`, domyślnie wyłączoną (`config/env.ts`) — patrz
 *    nota tam. Produkcja włącza jawnie przy cutoverze.
 * 2. `uruchom()` NIE stawia timera przy `SELLY_TRYB=wylaczony`. Oryginał trybu nie sprawdza,
 *    ale przy `wylaczony` discovery myli blokadę odczytu z „produkt nie istnieje" i zaczyna
 *    zakładać DUPLIKATY w sklepie (`docs/karty/I15.8/wejscie-108.md`). Zawór wyłącznie
 *    obronny: przy `pelny` i `tylko-odczyt` nie zmienia niczego.
 * 3. Przy starcie zamykamy osierocone wpisy `selly_sync_log` ze statusem `w_trakcie`,
 *    zostawione przez ubity proces (u Ani wpis MO2 wisi od 10.09) — `wejscie-117.md`.
 *    Czysta diagnostyka: nic nie zmienia w sklepie ani w danych katalogu.
 * Odstępstwa tras `sync-*` (naprawione literówki importów) opisuje `routes/selly-sync.ts`.
 */

import type { Baza } from "../../db/index.js";
import type { Discovery } from "./discovery.js";
import type { TrybSelly } from "../tryb.js";
import { syncDelta } from "./sync-delta.js";
import { syncFullForDostawca } from "./sync-full.js";
import { sprawdzUprawnienieUsuwania, usunSierotyZSelly, wynikProbyUprawnien } from "./sync-usuwanie.js";
import { zapiszStanTor3 } from "./stan-tor3.js";
import { zamknijOsieroconeWpisySync } from "../../repos/selly.js";

/** `scheduler_selly.cjs:22` — dostawcy objęci oboma torami. */
export const ACTIVE_SUPPLIERS = [
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
 * Rotacja Toru 2 per dzień tygodnia (0=nd, 1=pn, …, 6=so) — `scheduler_selly.cjs:26-34`.
 * Duzi dostawcy w tygodniu, mali w weekend (MO7, MO8 raz w miesiącu).
 *
 * ⚠ Specyfikacja Ani podaje dla środy samo „MO5"; kod ma „MO5 + MO6" i to kod wygrywa
 * (`docs/karty/I15.8/wejscie-114.md`).
 */
export const FULL_ROTATION: Readonly<Record<number, readonly string[]>> = {
  1: ["MO1", "MO2"],
  2: ["MO3", "MO4"],
  3: ["MO5", "MO6"],
  4: ["MO9"],
  5: ["MO10"],
  6: ["MO7"], // tylko pierwsza sobota miesiąca
  0: ["MO8"], // tylko pierwsza niedziela miesiąca
};

/** `scheduler_selly.cjs:36-37` — Tor 2 o 04:30 czasu lokalnego procesu. */
export const TOR2_HOUR = 4;
export const TOR2_MINUTE = 30;

/** Minuty, o których rusza Tor 1 — `scheduler_selly.cjs:125`. 55 = event-driven, reszta = fallback. */
const MINUTY_TORU_1 = [55, 10, 25, 40];

const CHECK_INTERVAL_MS = 60_000;

const komunikat = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** `isFirstOfMonthDay()` (`:39-42`) — ten dzień tygodnia w pierwszym tygodniu miesiąca. */
export function isFirstOfMonthDay(date: Date, targetDow: number): boolean {
  if (date.getDay() !== targetDow) return false;
  return date.getDate() <= 7;
}

/** `suppliersForFullToday()` (`:44-52`) — rotacja na dany dzień; MO7/MO8 tylko w pierwszym tygodniu. */
export function suppliersForFullToday(date: Date = new Date()): string[] {
  const dow = date.getDay();
  const scheduled = FULL_ROTATION[dow] ?? [];
  return scheduled.filter((s) => {
    if (s === "MO7") return isFirstOfMonthDay(date, 6);
    if (s === "MO8") return isFirstOfMonthDay(date, 0);
    return true;
  });
}

export type WynikDostawcy = Record<string, unknown> & { dostawca: string };

export type OpcjeBiegu = {
  suppliers?: readonly string[];
  dryRun?: boolean;
  maxProducts?: number;
  autoCreate?: boolean;
};

/**
 * `runDeltaAll()` (`:57-76`) — Tor 1 po kolei dla wszystkich (lub podanych) dostawców.
 * Błąd jednego dostawcy nie przerywa pętli; ląduje w wyniku jako `{ok:false, …}`.
 */
export async function runDeltaAll(
  db: Baza,
  discovery: Discovery,
  opts: OpcjeBiegu = {},
): Promise<WynikDostawcy[]> {
  const suppliers = opts.suppliers ?? ACTIVE_SUPPLIERS;
  const results: WynikDostawcy[] = [];
  for (const s of suppliers) {
    try {
      const r = await syncDelta(db, discovery, s, {
        dryRun: opts.dryRun || false,
        maxProducts: opts.maxProducts || 5000,
      });
      results.push({ dostawca: s, ...r.stats });
      // Oryginał loguje TYLKO dostawców z realną robotą — przebieg bez zmian ma być cichy.
      if (r.stats.total > 0) {
        console.log(
          `[Selly Tor1] ${s}: total=${r.stats.total}, ok=${r.stats.ok}, err=${r.stats.err}, discovered=${r.stats.discovered}`,
        );
      }
    } catch (e) {
      results.push({ ok: false, dostawca: s, error: komunikat(e) });
      console.error(`[Selly Tor1] ${s} FATAL:`, komunikat(e));
    }
  }
  return results;
}

/**
 * `runFullBatch()` (`:82-107`) — Tor 2 dla podanych dostawców (domyślnie rotacja na dziś).
 *
 * ⚠ Cache kodów Selly (`buildProductCodeCache`, ~75 s) budowany JEDEN raz na całą partię:
 * `buildCache: i === 0`. To jest w harmonogramie, nie w `sync-full.ts`
 * (`docs/karty/I15.8/wejscie-109.md`).
 */
export async function runFullBatch(
  db: Baza,
  discovery: Discovery,
  opts: OpcjeBiegu = {},
): Promise<WynikDostawcy[]> {
  const suppliers = opts.suppliers ?? suppliersForFullToday(new Date());
  if (!suppliers.length) {
    console.log("[Selly Tor2] Brak dostawcow w rotacji na dzis.");
    return [];
  }
  console.log(`[Selly Tor2] Start batch dla: ${suppliers.join(", ")} (dryRun=${!!opts.dryRun})`);
  const results: WynikDostawcy[] = [];
  for (let i = 0; i < suppliers.length; i++) {
    const s = suppliers[i]!;
    try {
      const r = await syncFullForDostawca(db, discovery, s, {
        dryRun: opts.dryRun || false,
        maxProducts: opts.maxProducts || 5000,
        autoCreate: opts.autoCreate !== false,
        buildCache: i === 0, // cache tylko raz na batch
      });
      results.push({ dostawca: s, ...r.stats, duration_ms: r.durationMs });
      console.log(
        `[Selly Tor2] ${s}: A=${r.stats.updated_A}, B=${r.stats.created_variant_B}, C=${r.stats.created_C}, err=${r.stats.err}, time=${(r.durationMs / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      results.push({ ok: false, dostawca: s, error: komunikat(e) });
      console.error(`[Selly Tor2] ${s} FATAL:`, komunikat(e));
    }
  }
  return results;
}

/**
 * Strażnik przebiegu Toru 1 (ticket 194). Oryginał pilnował tylko, żeby TA SAMA minuta nie odpaliła przebiegu
 * dwa razy (`lastRunKey`), ale nie sprawdzał, czy POPRZEDNI przebieg się skończył. Gdy Tor 1 trwa dłużej niż 15 minut
 * (dużo pozycji do wysłania, Selly zwalnia), kolejny tick (:10/:25/:40/:55) startował równolegle i te same pozycje
 * szły do sklepu dwa razy, a w dzienniku pojawiały się podwójne wpisy.
 *
 * Gdy poprzedni przebieg trwa krócej niż `limitMs`, nowy jest pomijany. Po `limitMs` strażnik puszcza następny mimo
 * wszystko — zawieszony przebieg (obietnica, która nigdy się nie kończy) nie może zablokować synchronizacji na stałe.
 */
export function stworzStraznikaPrzebiegu(limitMs: number, zegar: () => number = Date.now) {
  let start: number | null = null;
  return {
    /** `true` = wolno uruchomić (i przebieg zaczyna się liczyć), `false` = poprzedni jeszcze trwa. */
    sprobuj(): boolean {
      const teraz = zegar();
      if (start !== null && teraz - start < limitMs) return false;
      start = teraz;
      return true;
    },
    zakoncz(): void {
      start = null;
    },
  };
}

/** Ile najdłużej uznajemy przebieg Toru 1 za „trwający”, zanim pozwolimy ruszyć następnemu. */
export const MAKS_CZAS_PRZEBIEGU_TORU_1_MS = 30 * 60 * 1000;

export type Harmonogram = {
  uruchom(): void;
  zatrzymaj(): void;
  czyDziala(): boolean;
};

export type ZaleznosciHarmonogramu = {
  db: Baza;
  discovery: Discovery;
  /** Tryb integracji — przy `wylaczony` harmonogram nie startuje (odstępstwo 2 w nagłówku). */
  tryb: TrybSelly;
  /** Tor 3 (ticket 186): usuwanie z Selly produktów, których nie ma już w Bridge. Domyślnie włączone. */
  usuwanie?: boolean;
  /** Próg bezpiecznika Toru 3 (ułamek sierot wśród mapowań); domyślnie `MAKS_UDZIAL_SIEROT`. */
  usuwanieMaksUdzial?: number;
  /**
   * Tor 2 (pełny mirror + auto-create o 04:30). Domyślnie włączony. Ticket 190: przełącznik
   * `SELLY_TOR2=false` pozwala uruchomić sam Tor 1 (ceny i stany), bez zakładania produktów
   * i bez nadpisywania nazw/kategorii/cech w sklepie — decyzja Ani 2026-10-05.
   */
  tor2?: boolean;
  /**
   * Zegar — WYŁĄCZNIE dla testów, produkcyjnie `new Date()`. Wzorzec jak `ZegarLimitera`
   * w `limiter.ts`: bez tego testu „Tor 2 o 04:30" nie da się napisać inaczej niż czekaniem.
   */
  teraz?: () => Date;
  /** Okres ticka — WYŁĄCZNIE dla testów; produkcyjnie 60 s jak w oryginale. */
  interwalMs?: number;
  /** Przebieg Toru 1 — WYŁĄCZNIE dla testów (długi przebieg); produkcyjnie `runDeltaAll`. */
  biegDelta?: () => Promise<unknown>;
};

/**
 * Port `installScheduler()` (`:112-146`) jako obiekt, który sam niczego nie uruchamia —
 * timer stawia dopiero `uruchom()`. Wzorzec 1:1 jak `import/scheduler.ts`: dzięki temu
 * cała suita budująca aplikację przez `stworzApp` nie widzi żadnego timera.
 *
 * `lastRunKey` / `lastFullKey` pilnują, żeby tick trafiający dwa razy w tę samą minutę
 * (albo dobę, dla Toru 2) nie odpalił biegu dwukrotnie — tak jak w oryginale.
 */
export function stworzHarmonogramSelly({
  db,
  discovery,
  tryb,
  usuwanie = true,
  usuwanieMaksUdzial,
  tor2 = true,
  teraz = () => new Date(),
  interwalMs = CHECK_INTERVAL_MS,
  biegDelta,
}: ZaleznosciHarmonogramu): Harmonogram {
  const straznikToru1 = stworzStraznikaPrzebiegu(MAKS_CZAS_PRZEBIEGU_TORU_1_MS, () => teraz().getTime());
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastRunKey: string | null = null;
  let lastFullKey: string | null = null; // "YYYY-MM-DD" — Tor 2 raz dziennie

  const dwaZnaki = (n: number): string => String(n).padStart(2, "0");

  const tick = (): void => {
    const now = teraz();
    const hh = now.getHours();
    const mm = now.getMinutes();
    // Oryginał bierze `toISOString()`, czyli UTC, przy godzinach czytanych LOKALNIE
    // (`:121-122`). Zachowujemy to 1:1 — klucz ma tylko odróżniać kolejne przebiegi.
    const dateKey = now.toISOString().substring(0, 10);
    const key = `${dateKey} ${dwaZnaki(hh)}:${dwaZnaki(mm)}`;

    // Tor 1: event-driven (HH:55) + fallback (HH:10, HH:25, HH:40)
    if (MINUTY_TORU_1.includes(mm) && lastRunKey !== key) {
      lastRunKey = key;
      const tag = mm === 55 ? "event-driven" : "fallback";
      if (!straznikToru1.sprobuj()) {
        console.warn(
          `[Selly Scheduler] Tor1 ${tag} ${hh}:${dwaZnaki(mm)} POMINIĘTY — poprzedni przebieg jeszcze trwa ` +
            `(nakładanie dałoby podwójną wysyłkę tych samych pozycji)`,
        );
      } else {
        console.log(`[Selly Scheduler] Tor1 ${tag} ${hh}:${dwaZnaki(mm)}`);
        (biegDelta ?? (() => runDeltaAll(db, discovery)))()
        .catch((e: unknown) => console.error("[Selly Scheduler] Tor1 err:", komunikat(e)))
        .finally(() => straznikToru1.zakoncz())
        .then(async () => {
          if (!usuwanie) {
            zapiszStanTor3({ wynik: "wylaczone", opis: "Usuwanie z Selly wyłączone (SELLY_USUWANIE=false)" });
            return null;
          }
          // Najpierw próba uprawnień (DELETE na nieistniejący produkt) — bez prawa usuwania Tor 3 nic nie robi.
          const { wolno } = await sprawdzUprawnienieUsuwania(db, discovery, tryb);
          if (!wolno) {
            const proba = wynikProbyUprawnien();
            if (tryb !== "pelny") {
              zapiszStanTor3({ wynik: "wylaczone", opis: `Tryb Selly „${tryb}” — usuwanie działa tylko w trybie pełnym` });
            } else if (proba === "brak") {
              zapiszStanTor3({ wynik: "brak_uprawnien", opis: "API Selly nie ma prawa usuwania (DELETE → 401/403) — nic nie usuwam" });
            } else {
              zapiszStanTor3({ wynik: "proba_nieokreslona", opis: "Próba uprawnień do usuwania nie dała jednoznacznej odpowiedzi — ponowię za godzinę" });
            }
            return null;
          }
          return usunSierotyZSelly(db, discovery, { tryb, maksUdzial: usuwanieMaksUdzial });
        })
        .catch((e: unknown) => console.error("[Selly Scheduler] Tor3 err:", komunikat(e)));
      }
    }

    // Tor 2: raz dziennie o 04:30 — po nocnym auto-pull dostawców o 04:00
    if (hh === TOR2_HOUR && mm === TOR2_MINUTE && lastFullKey !== dateKey) {
      lastFullKey = dateKey;
      if (!tor2) {
        console.log("[Selly Scheduler] Tor2 pominięty — SELLY_TOR2=false");
        return;
      }
      const suppliers = suppliersForFullToday(now);
      if (suppliers.length) {
        console.log(
          `[Selly Scheduler] Tor2 start ${hh}:${dwaZnaki(mm)} suppliers=${suppliers.join(",")}`,
        );
        runFullBatch(db, discovery, { suppliers }).catch((e: unknown) =>
          console.error("[Selly Scheduler] Tor2 err:", komunikat(e)),
        );
      }
    }
  };

  return {
    uruchom(): void {
      if (timer) return;

      // ODSTĘPSTWO 2 (patrz nagłówek): przy `wylaczony` discovery zakłada duplikaty.
      if (tryb === "wylaczony") {
        console.log(
          "[Selly Scheduler] NIE uruchomiony — SELLY_TRYB=wylaczony (discovery myliłoby " +
            "blokadę odczytu z brakiem produktu i zakładało duplikaty w sklepie).",
        );
        return;
      }

      // ODSTĘPSTWO 3 (patrz nagłówek): domykamy cykle przerwane ubiciem procesu.
      const osierocone = zamknijOsieroconeWpisySync(db);
      if (osierocone > 0) {
        console.log(
          `[Selly Scheduler] Zamknieto ${osierocone} osieroconych wpisow selly_sync_log (status 'w_trakcie' po restarcie).`,
        );
      }

      timer = setInterval(tick, interwalMs);
      // Timer nie może trzymać procesu przy życiu — tak samo jak w `import/scheduler.ts`.
      timer.unref?.();
      console.log(
        `[Selly Scheduler] Zainstalowany. Tor1: HH:55 + HH:10/25/40. Tor2: codziennie ${TOR2_HOUR}:${dwaZnaki(TOR2_MINUTE)} (rotacja per dzien).`,
      );
    },

    zatrzymaj(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },

    czyDziala(): boolean {
      return timer !== null;
    },
  };
}
