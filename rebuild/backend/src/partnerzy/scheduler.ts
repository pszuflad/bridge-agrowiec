// Harmonogram generowania cenników partnerów (karta PARTNERZY, ticket 220 / PRT-4.1).
//
// Tick co minutę: dla każdego AKTYWNEGO partnera z `harmonogram_minuty` generuje pliki, gdy od ostatniej próby (ostatni wpis operacji `generowanie`
// w `partner_logi`, także nieudanej — żeby awaria nie była powtarzana co minutę) minęło co najmniej tyle minut. Osobny harmonogram na partnera.
// Ochrona przed nakładaniem: jedno generowanie partnera naraz (zamek w pamięci procesu). Wyjątek nie wywraca procesu — trafia do logów.
// Ręczne „generuj teraz” (`generujTeraz`) używa tego samego zamka i tego samego zapisu logów.
//
// Domyślnie WYŁĄCZONY (`PARTNERZY_SCHEDULER`, wzorem schedulerów importu i Selly): na środowisku testowym nie ma generować plików „dla partnerów”.
// Katalog wyjściowy partnera: `<katalogBazowy>/<id partnera>/` (z podkatalogami `pricelist/` i `archive/`); mapowanie na serwer plików to poziom 6.

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { join } from "node:path";

import type { Baza } from "../db/index.js";
import { partnerLogi, partnerzy } from "../db/schema.js";
import { publikujPliki, type KatalogiPublikacji } from "./publikacja.js";
import { generujPlikiPartnera, pelnyPlikPartnera, podgladPartnera, type WynikGenerowania, type WynikPodgladu } from "./generator.js";
import type { KlientNbp } from "./kurs-nbp.js";
import { zapiszBlad, zapiszOperacje, zapiszWynikGenerowania } from "./logi.js";

export const INTERWAL_TICKU_MS = 60_000;

export class GenerowanieTrwaError extends Error {
  constructor(partnerId: number) {
    super(`Generowanie dla partnera ${partnerId} już trwa.`);
    this.name = "GenerowanieTrwaError";
  }
}

export interface SerwisPartnerow {
  /** Generuje pliki partnera teraz (też dla nieaktywnego). Rzuca `GenerowanieTrwaError`, gdy poprzednie jeszcze trwa. */
  generujTeraz(partnerId: number): Promise<WynikGenerowania>;
  /** Podgląd bez zapisu (pierwsze pozycje, tekst plików) — nie dotyka dysku, logów ani `partner_kursy`. */
  podglad(partnerId: number): Promise<WynikPodgladu>;
  /** Pełny plik partnera do pobrania (wszystkie pozycje, bez zapisu na dysk); `null` = brak pliku o tej nazwie. */
  pelnyPlik(partnerId: number, nazwa: string): Promise<{ nazwa: string; tekst: string } | null>;
  /** Jeden tick harmonogramu (wołany timerem; wystawiony dla testów). Zwraca ids partnerów, dla których uruchomiono generowanie. */
  tick(): Promise<number[]>;
  uruchom(): void;
  zatrzymaj(): void;
}

export function stworzSerwisPartnerow(opcje: {
  db: Baza;
  klientNbp: KlientNbp;
  katalogBazowy: string;
  /** Partner (nazwa małymi literami) → katalog na serwerze plików, do którego kopiujemy wygenerowane pliki. Brak = nie publikujemy. */
  katalogiPublikacji?: KatalogiPublikacji;
  teraz?: () => Date;
  interwalMs?: number;
}): SerwisPartnerow {
  const { db, klientNbp, katalogBazowy } = opcje;
  const teraz = opcje.teraz ?? (() => new Date());
  const trwa = new Set<number>();
  let timer: NodeJS.Timeout | null = null;

  async function generujTeraz(partnerId: number): Promise<WynikGenerowania> {
    if (trwa.has(partnerId)) throw new GenerowanieTrwaError(partnerId);
    trwa.add(partnerId);
    try {
      const katalog = join(katalogBazowy, String(partnerId));
      const wynik = await generujPlikiPartnera(db, klientNbp, partnerId, { katalog, teraz });
      const docelowy = opcje.katalogiPublikacji?.get(
        (db.select({ nazwa: partnerzy.nazwa }).from(partnerzy).where(eq(partnerzy.id, partnerId)).get()?.nazwa ?? "").toLowerCase(),
      );
      const zapisane = wynik.pliki.filter((p) => p.zapisany).map((p) => p.nazwa);
      if (docelowy && zapisane.length > 0) {
        const pub = publikujPliki(join(katalog, "pricelist"), docelowy, zapisane);
        wynik.bledy.push(...pub.bledy);
        if (pub.opublikowane.length > 0) wynik.ostrzezenia.push(`Opublikowano ${pub.opublikowane.length} plików w katalogu partnera.`);
      }
      zapiszWynikGenerowania(db, partnerId, wynik, teraz());
      return wynik;
    } catch (e) {
      const komunikat = e instanceof Error ? e.message : String(e);
      try {
        zapiszOperacje(db, partnerId, "generowanie", `Generowanie przerwane wyjątkiem: ${komunikat}`, 0, teraz());
        zapiszBlad(db, partnerId, "generowanie", komunikat, "blad", teraz());
      } catch (blad) {
        console.error("[partnerzy] nie udało się zapisać błędu generowania:", blad instanceof Error ? blad.message : blad);
      }
      throw e;
    } finally {
      trwa.delete(partnerId);
    }
  }

  const ostatniaProba = (partnerId: number): number | null => {
    const w = db
      .select({ kiedy: partnerLogi.kiedy })
      .from(partnerLogi)
      .where(and(eq(partnerLogi.partnerId, partnerId), eq(partnerLogi.operacja, "generowanie")))
      .orderBy(desc(partnerLogi.id))
      .limit(1)
      .get();
    return w ? Date.parse(w.kiedy) : null;
  };

  async function tick(): Promise<number[]> {
    const aktywni = db
      .select({ id: partnerzy.id, minuty: partnerzy.harmonogramMinuty })
      .from(partnerzy)
      .where(and(eq(partnerzy.aktywny, true), isNotNull(partnerzy.harmonogramMinuty)))
      .all();
    const uruchomieni: number[] = [];
    const teraz_ms = teraz().getTime();
    await Promise.all(
      aktywni.map(async ({ id, minuty }) => {
        if (trwa.has(id)) return;
        const ostatnia = ostatniaProba(id);
        if (ostatnia !== null && teraz_ms - ostatnia < minuty! * 60_000) return;
        uruchomieni.push(id);
        try {
          await generujTeraz(id);
        } catch (e) {
          console.error(`[partnerzy] generowanie partnera ${id} nie powiodło się:`, e instanceof Error ? e.message : e);
        }
      }),
    );
    return uruchomieni.sort((a, b) => a - b);
  }

  return {
    generujTeraz,
    podglad: (partnerId) => podgladPartnera(db, klientNbp, partnerId, { teraz }),
    pelnyPlik: (partnerId, nazwa) => pelnyPlikPartnera(db, klientNbp, partnerId, nazwa, { teraz }),
    tick,
    uruchom() {
      if (timer) return;
      timer = setInterval(() => void tick(), opcje.interwalMs ?? INTERWAL_TICKU_MS);
      timer.unref();
      console.log("[partnerzy-scheduler] uruchomiony (tick co minutę)");
    },
    zatrzymaj() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
