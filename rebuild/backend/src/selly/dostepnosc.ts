/**
 * Odświeżanie dostępności — port `origin/main:mirror/backend/availability_sync.cjs`
 * (karta I15.10, ticket 119; produkcja zamrożona na `88fa31c`).
 *
 * Zmiana dostępności u dostawcy (auto-wstrzymanie pozycji, której nie ma w pełnej wiarygodnej
 * ofercie, albo jej powrót) musi dojść do sklepu dwiema drogami naraz: plik CSV trzeba
 * wygenerować od nowa, a warianty w Selly zaktualizować Torem 1. Ten moduł kolejkuje jedno
 * i drugie, żeby seria zgłoszeń z jednego importu nie odpaliła generatora kilkanaście razy.
 *
 * Semantyka kolejki 1:1 z oryginałem:
 * - zgłoszenie ZAWSZE dopisuje dostawcę do zbioru oczekujących;
 * - jeśli bieg już trwa, `zadajOdswiezenie()` wraca natychmiast — zgłoszenie NIE GINIE,
 *   tylko czeka na kolejny obrót pętli;
 * - pętla DRENUJE kolejkę: bierze całą bieżącą partię, czyści zbiór, generuje CSV RAZ na
 *   partię, potem `syncDelta` SEKWENCYJNIE dla każdego dostawcy z partii;
 * - błąd jest wyłącznie logowany — mechanizmem ponawiania zostaje okresowa synchronizacja
 *   (moduł nie ma własnego timera i celowo go nie dostaje).
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO (decyzja użytkownika, `docs/karty/I15.10/wejscie-117.md` p.3):
 * oryginał uruchamia generator jako OSOBNY PROCES
 * (`execFileSync(process.execPath, ['generate_selly_export.cjs'], {timeout: 60000})`), bo tam
 * jest to samodzielny skrypt. U nas generator to moduł, więc wołamy go W TYM SAMYM PROCESIE.
 * Tracimy przez to izolację błędu i twardy limit 60 s; ryzyko przyjęte świadomie, bo generator
 * czyta lokalny SQLite i zapisuje plik — nie ma wywołań sieciowych, które mogłyby wisieć.
 *
 * ⚠ Moduł jest CELOWO niewpięty. Punkt wpięcia (`staging_policy.cjs:131-134` w oryginale)
 * należy do karty I15.4 — patrz `docs/karty/I15.4/wejscie-119.md`.
 */

import type { Baza } from "../db/index.js";
import { wygenerujCsvSelly, type SciezkiCsvSelly } from "./generator-csv.js";
import type { Discovery } from "./rest/discovery.js";
import { syncDelta } from "./rest/sync-delta.js";

const komunikat = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export type ZaleznosciDostepnosci = {
  db: Baza;
  discovery: Discovery;
  sciezkiCsv: SciezkiCsvSelly;
  /** Podmieniane w testach, żeby nie pisać pliku CSV. Domyślnie `wygenerujCsvSelly`. */
  generujCsv?: (db: Baza, sciezki: SciezkiCsvSelly) => unknown;
  /** Podmieniane w testach. Domyślnie `syncDelta` — BEZ opcji, jak w oryginale. */
  synchronizujDelte?: (db: Baza, discovery: Discovery, dostawca: string) => Promise<unknown>;
};

export type SynchronizacjaDostepnosci = {
  /** Zgłasza, że dostępność u dostawcy się zmieniła. Nie czeka na wynik — jak oryginał. */
  zadajOdswiezenie(dostawca: string): void;
  /**
   * Czeka, aż kolejka się opróżni. **Afordancja testowa** — oryginał jest fire-and-forget
   * i nie ma odpowiednika. Produkcyjny kod tego nie woła.
   */
  poczekajNaKoniec(): Promise<void>;
};

export function stworzSynchronizacjeDostepnosci(zaleznosci: ZaleznosciDostepnosci): SynchronizacjaDostepnosci {
  const generuj = zaleznosci.generujCsv ?? wygenerujCsvSelly;
  const delta =
    zaleznosci.synchronizujDelte ??
    ((db: Baza, discovery: Discovery, dostawca: string) => syncDelta(db, discovery, dostawca));

  const oczekujace = new Set<string>();
  let wTrakcie = false;
  let biezacy: Promise<void> = Promise.resolve();

  function zadajOdswiezenie(dostawca: string): void {
    oczekujace.add(dostawca);
    if (wTrakcie) return;
    wTrakcie = true;
    biezacy = przetwarzaj();
  }

  async function przetwarzaj(): Promise<void> {
    // Oryginał planuje pracę przez `setImmediate`, więc `request()` zawsze wraca synchronicznie,
    // a wszystkie zgłoszenia z tego samego tiku trafiają do jednej partii.
    await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      while (oczekujace.size) {
        const partia = [...oczekujace];
        oczekujace.clear();
        generuj(zaleznosci.db, zaleznosci.sciezkiCsv);
        for (const dostawca of partia) {
          await delta(zaleznosci.db, zaleznosci.discovery, dostawca);
        }
      }
    } catch (e) {
      // Wyjątek NIE wycieka: okresowa synchronizacja jest mechanizmem ponawiania.
      console.error(`[dostepnosc] Odświeżenie nieudane; ponowi okresowa synchronizacja: ${komunikat(e)}`);
    } finally {
      wTrakcie = false;
      // Błąd mógł przerwać pętlę z niepustą kolejką — wtedy oryginał startuje bieg od nowa.
      const zostalo = [...oczekujace];
      if (zostalo.length > 0) zadajOdswiezenie(zostalo[0] as string);
    }
  }

  return {
    zadajOdswiezenie,
    async poczekajNaKoniec(): Promise<void> {
      // `biezacy` może zostać podmieniony przez restart w `finally`, dlatego pętla.
      while (wTrakcie) await biezacy;
    },
  };
}

let domyslna: SynchronizacjaDostepnosci | null = null;

/**
 * Montaż instancji używanej przez `zadajOdswiezenie()`. Woła to karta I15.4 albo I15.8 przy
 * starcie aplikacji — ta karta CELOWO nie rusza `app.ts`.
 */
export function ustawDomyslnaSynchronizacjeDostepnosci(instancja: SynchronizacjaDostepnosci | null): void {
  domyslna = instancja;
}

/**
 * ⭐ Punkt wejścia dla karty I15.4 — odpowiednik `require('./availability_sync.cjs').request(db, supplier)`.
 *
 * Bez skonfigurowanej instancji nie robi NIC. To celowy odpowiednik produkcyjnej bramki
 * z `staging_policy.cjs:131-134`, która wychodzi, gdy baza nie jest produkcyjna — kopia testowa
 * nigdy nie wysyła do sklepu ani nie publikuje produkcyjnego CSV.
 */
export function zadajOdswiezenie(dostawca: string): void {
  if (!domyslna) return;
  domyslna.zadajOdswiezenie(dostawca);
}
