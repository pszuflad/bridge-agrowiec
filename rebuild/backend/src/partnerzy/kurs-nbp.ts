// Kurs EUR dla partnerów B2B — NBP tabela A i ręczny RÓWNOLEGLE, obowiązuje niższy (karta PARTNERZY, ticket 210 / PRT-2.1; ticket 262).
//
// Zasady z karty: kurs NBP = ostatnio OPUBLIKOWANY (w weekend i święta API oddaje ostatnią tabelę); gdy NBP nie
// odpowiada — ostatni zapisany kurs + ostrzeżenie; każdy plik zapisuje użyty kurs (`partner_kursy`).
// Klient HTTP stoi za interfejsem i jest wstrzykiwany — testy NIGDY nie wołają prawdziwego NBP.

import { and, desc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { kursyNbp, partnerKursy } from "../db/schema.js";

export type KursNbp = { kurs: number; data: string };
export interface KlientNbp {
  /** Ostatni opublikowany kurs średni EUR z tabeli A. Rzuca przy braku odpowiedzi lub niepoprawnej odpowiedzi. */
  pobierzKursEur(): Promise<KursNbp>;
}

export type UzytyKurs = {
  kurs: number;
  /** `reczny` – wpisany przez użytkownika (był niższy od NBP albo NBP niedostępny); `nbp` – świeżo pobrany; `nbp-zapisany` – rezerwa po awarii NBP. */
  zrodlo: "reczny" | "nbp" | "nbp-zapisany";
  /** Data tabeli NBP, z którą porównano kurs (brak, gdy NBP nie odpowiadał, a kurs ręczny wystarczył). */
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
 * Kurs EUR wg ustawień kraju partnera (od ticketu 262: NBP i ręczny działają RÓWNOLEGLE).
 * Bez kursu ręcznego: NBP (pobiera i zapisuje; przy awarii ostatni zapisany + ostrzeżenie; bez żadnego kursu `BrakKursuError` — nigdy nie zgaduje).
 * Z kursem ręcznym: obowiązuje NIŻSZY z dwóch (decyzja użytkowniczki 2026-10-14: niższy kurs = wyższa cena w EUR = ochrona przed stratą przy przeliczeniu).
 * Gdy NBP nie odpowiada i nie ma zapisanego kursu, wystarczy ręczny (z ostrzeżeniem). Pole `kursZrodlo` nie decyduje już o wyborze — liczy się to, czy kurs ręczny jest ustawiony.
 */
export async function kursEur(
  db: Baza,
  klient: KlientNbp,
  ustawienia: { kursZrodlo: string; kursReczny: number | null },
  teraz: () => Date = () => new Date(),
): Promise<UzytyKurs> {
  const reczny = typeof ustawienia.kursReczny === "number" && Number.isFinite(ustawienia.kursReczny) && ustawienia.kursReczny > 0 ? ustawienia.kursReczny : null;
  let nbp: { kurs: number; data: string; zapisany: boolean } | null = null;
  let powodBledu: string | null = null;
  try {
    const swiezy = await klient.pobierzKursEur();
    db.insert(kursyNbp)
      .values({ data: swiezy.data, kurs: swiezy.kurs, pobrano: teraz().toISOString() })
      .onConflictDoUpdate({ target: kursyNbp.data, set: { kurs: swiezy.kurs, pobrano: teraz().toISOString() } })
      .run();
    nbp = { ...swiezy, zapisany: false };
  } catch (e) {
    powodBledu = e instanceof Error ? e.message : String(e);
    const zapisany = ostatniZapisany(db);
    if (zapisany) nbp = { ...zapisany, zapisany: true };
  }
  const ostrzezenieNbp = nbp?.zapisany ? `NBP nie odpowiada (${powodBledu}) — użyto ostatniego zapisanego kursu ${nbp.kurs} z tabeli ${nbp.data}.` : null;
  if (reczny !== null) {
    if (nbp === null)
      return { kurs: reczny, zrodlo: "reczny", dataTabeli: null, ostrzezenie: `NBP nie odpowiada (${powodBledu}) i nie ma zapisanego kursu — użyto samego kursu ręcznego ${reczny}.` };
    if (reczny <= nbp.kurs) return { kurs: reczny, zrodlo: "reczny", dataTabeli: nbp.data, ostrzezenie: ostrzezenieNbp };
    return { kurs: nbp.kurs, zrodlo: nbp.zapisany ? "nbp-zapisany" : "nbp", dataTabeli: nbp.data, ostrzezenie: ostrzezenieNbp };
  }
  if (nbp === null) throw new BrakKursuError(`NBP nie odpowiada (${powodBledu}) i nie ma żadnego zapisanego kursu.`);
  return { kurs: nbp.kurs, zrodlo: nbp.zapisany ? "nbp-zapisany" : "nbp", dataTabeli: nbp.data, ostrzezenie: ostrzezenieNbp };
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
      .where(and(eq(partnerKursy.partnerId, partnerId), eq(partnerKursy.kraj, kraj)))
      .orderBy(desc(partnerKursy.id))
      .limit(1)
      .get() ?? null
  );
}

