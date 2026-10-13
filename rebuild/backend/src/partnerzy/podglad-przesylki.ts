// Podgląd kosztu przesyłki dla wybranej paczki (ticket 246): to samo liczenie co w kalkulatorze ceny, ale z rozbiciem na składniki.
// Źródło bazy: stała „Przesyłka bazowa” kraju partnera (nadpisuje tabele) albo stawka z tabeli GEIS dla wagi rozliczeniowej = max(waga, gabaryt).

import { and, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKraje } from "../db/schema.js";
import { BladTransportu, kosztPrzesylki, paliwoNaDzien, type Paczka } from "./transport.js";

export type PodgladPrzesylki = {
  zrodlo: "stala-baza" | "geis";
  /** Tylko GEIS: waga rozliczeniowa, próg tabeli i jego stawka. */
  wagaRozliczeniowa: number | null;
  wagaRzeczywista: number | null;
  wagaGabarytowa: number | null;
  progKg: number | null;
  /** Baza przed paliwem: stała baza kraju albo stawka GEIS. */
  baza: number;
  paliwoProc: number;
  paliwoEur: number;
  /** Pakowanie z tabeli GEIS (0 dla stałej bazy). */
  pakowanieGeisEur: number;
  /** Myto i pakowanie kraju partnera z panelu. */
  mytoEur: number;
  pakowanieKrajuEur: number;
  razemEur: number;
};

/** Rzuca `BladTransportu` (np. brak wagi/wymiarów, brak tabeli kraju) albo `Error` dla nieznanego kraju partnera. */
export function podgladKosztuPrzesylki(db: Baza, partnerId: number, kraj: string, paczka: Paczka, data: string): PodgladPrzesylki {
  const k = db.select().from(partnerKraje).where(and(eq(partnerKraje.partnerId, partnerId), eq(partnerKraje.kraj, kraj))).get();
  if (!k) throw new Error(`Partner nie ma kraju ${kraj}.`);
  const dodatki = { mytoEur: k.mytoEur, pakowanieKrajuEur: k.pakowanieEur };
  if (k.przesylkaStalaEur !== null) {
    const proc = paliwoNaDzien(db, kraj, data);
    const paliwo = (k.przesylkaStalaEur * proc) / 100;
    return {
      zrodlo: "stala-baza", wagaRozliczeniowa: null, wagaRzeczywista: null, wagaGabarytowa: null, progKg: null,
      baza: k.przesylkaStalaEur, paliwoProc: proc, paliwoEur: paliwo, pakowanieGeisEur: 0, ...dodatki,
      razemEur: k.przesylkaStalaEur + paliwo + dodatki.mytoEur + dodatki.pakowanieKrajuEur,
    };
  }
  const g = kosztPrzesylki(db, kraj, paczka, data);
  const paliwo = (g.stawka * g.paliwoProc) / 100;
  return {
    zrodlo: "geis", wagaRozliczeniowa: g.wagaRozliczeniowa, wagaRzeczywista: g.wagaRzeczywista, wagaGabarytowa: g.wagaGabarytowa, progKg: g.progKg,
    baza: g.stawka, paliwoProc: g.paliwoProc, paliwoEur: paliwo, pakowanieGeisEur: g.kosztPakowania, ...dodatki,
    razemEur: g.koszt + dodatki.mytoEur + dodatki.pakowanieKrajuEur,
  };
}

export { BladTransportu };
