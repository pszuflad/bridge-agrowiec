// Kurs EUR dla partnerów B2B — NBP tabela A albo ręczny (karta PARTNERZY, ticket 210 / PRT-2.1).
//
// Zasady z karty: kurs NBP = ostatnio OPUBLIKOWANY (w weekend i święta API oddaje ostatnią tabelę); gdy NBP nie
// odpowiada — ostatni zapisany kurs + ostrzeżenie; każdy plik zapisuje użyty kurs (`partner_kursy`).
// Klient HTTP stoi za interfejsem i jest wstrzykiwany — testy NIGDY nie wołają prawdziwego NBP.

import { desc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { kursyNbp, partnerKursy } from "../db/schema.js";

export type KursNbp = { kurs: number; data: string };
export interface KlientNbp {
  /** Ostatni opublikowany kurs średni EUR z tabeli A. Rzuca przy braku odpowiedzi lub niepoprawnej odpowiedzi. */
  pobierzKursEur(): Promise<KursNbp>;
}

export type UzytyKurs = {
  kurs: number;
  /** `reczny` – wpisany przez użytkownika; `nbp` – świeżo pobrany; `nbp-zapisany` – rezerwa po awarii NBP. */
  zrodlo: "reczny" | "nbp" | "nbp-zapisany";
  /** Data tabeli NBP (brak dla kursu ręcznego). */
  dataTabeli: string | null;
  ostrzezenie: string | null;
};

export class BrakKursuError extends Error {
  constructor(komunikat: string) {
    super(komunikat);
    this.name = "BrakKursuError";
  }
}

const ADRES_NBP = "https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json";

/** Prawdziwy klient NBP (`fetch`, limit czasu 10 s). Poprawność odpowiedzi sprawdza `czytajOdpowiedzNbp`. */
export function klientNbpHttp(adres = ADRES_NBP, fetchFn: typeof fetch = fetch): KlientNbp {
  return {
    async pobierzKursEur() {
      const odp = await fetchFn(adres, { signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
      if (!odp.ok) throw new Error(`NBP odpowiedział HTTP ${odp.status}`);
      return czytajOdpowiedzNbp(await odp.json());
    },
  };
}

/** Wyciąga kurs i datę z odpowiedzi `/api/exchangerates/rates/a/eur/`; rzuca przy innym kształcie. */
export function czytajOdpowiedzNbp(json: unknown): KursNbp {
  const stawka = (json as { rates?: { mid?: unknown; effectiveDate?: unknown }[] } | null)?.rates?.[0];
  const kurs = stawka?.mid;
  const data = stawka?.effectiveDate;
  if (typeof kurs !== "number" || !Number.isFinite(kurs) || kurs <= 0 || typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data))
    throw new Error("Nieoczekiwany kształt odpowiedzi NBP.");
  return { kurs, data };
}

function ostatniZapisany(db: Baza): KursNbp | null {
  const w = db.select().from(kursyNbp).orderBy(desc(kursyNbp.data)).limit(1).get();
  return w ? { kurs: w.kurs, data: w.data } : null;
}

/**
 * Kurs EUR wg ustawień kraju partnera. Ręczny: bez sięgania do sieci. NBP: pobiera i zapisuje; przy awarii bierze
 * ostatni zapisany i zwraca ostrzeżenie (do logu operacji); bez żadnego kursu rzuca `BrakKursuError` — nigdy nie zgaduje.
 */
export async function kursEur(
  db: Baza,
  klient: KlientNbp,
  ustawienia: { kursZrodlo: string; kursReczny: number | null },
  teraz: () => Date = () => new Date(),
): Promise<UzytyKurs> {
  if (ustawienia.kursZrodlo === "reczny") {
    if (!(typeof ustawienia.kursReczny === "number" && ustawienia.kursReczny > 0))
      throw new BrakKursuError("Kurs ręczny jest włączony, ale nie ma wartości kursu.");
    return { kurs: ustawienia.kursReczny, zrodlo: "reczny", dataTabeli: null, ostrzezenie: null };
  }
  try {
    const nbp = await klient.pobierzKursEur();
    db.insert(kursyNbp)
      .values({ data: nbp.data, kurs: nbp.kurs, pobrano: teraz().toISOString() })
      .onConflictDoUpdate({ target: kursyNbp.data, set: { kurs: nbp.kurs, pobrano: teraz().toISOString() } })
      .run();
    return { kurs: nbp.kurs, zrodlo: "nbp", dataTabeli: nbp.data, ostrzezenie: null };
  } catch (e) {
    const powod = e instanceof Error ? e.message : String(e);
    const zapisany = ostatniZapisany(db);
    if (!zapisany) throw new BrakKursuError(`NBP nie odpowiada (${powod}) i nie ma żadnego zapisanego kursu.`);
    return {
      kurs: zapisany.kurs,
      zrodlo: "nbp-zapisany",
      dataTabeli: zapisany.data,
      ostrzezenie: `NBP nie odpowiada (${powod}) — użyto ostatniego zapisanego kursu ${zapisany.kurs} z tabeli ${zapisany.data}.`,
    };
  }
}

/** Zapisuje kurs użyty przy wygenerowaniu pliku (`partner_kursy`). */
export function zapiszUzytyKurs(
  db: Baza,
  wpis: { partnerId: number; kraj: string; kurs: UzytyKurs; plik?: string | null },
  teraz: () => Date = () => new Date(),
): void {
  db.insert(partnerKursy)
    .values({
      partnerId: wpis.partnerId,
      kraj: wpis.kraj,
      kurs: wpis.kurs.kurs,
      zrodlo: wpis.kurs.zrodlo,
      plik: wpis.plik ?? null,
      zapisano: teraz().toISOString(),
    })
    .run();
}

/** Kurs użyty ostatnio dla partnera i kraju (np. do wyświetlenia w panelu) albo `null`. */
export function ostatniUzytyKurs(db: Baza, partnerId: number, kraj: string) {
  return (
    db
      .select()
      .from(partnerKursy)
      .where(eq(partnerKursy.partnerId, partnerId))
      .orderBy(desc(partnerKursy.id))
      .all()
      .find((w) => w.kraj === kraj) ?? null
  );
}

