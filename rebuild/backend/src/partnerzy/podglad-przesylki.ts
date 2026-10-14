// Podgląd kosztu przesyłki dla wybranej paczki (ticket 246): to samo liczenie co w kalkulatorze ceny, ale z rozbiciem na składniki.
// Baza: stawka z tabeli GEIS dla wagi rozliczeniowej = max(waga, gabaryt) (stałej „przesyłki bazowej” kraju już nie ma — ticket 259).

import { and, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKraje } from "../db/schema.js";
import { BladTransportu, kosztPrzesylki, type Paczka } from "./transport.js";

export type PodgladPrzesylki = {
  zrodlo: "geis";
  /** Waga rozliczeniowa, próg tabeli i jego stawka. */
  wagaRozliczeniowa: number;
  wagaRzeczywista: number;
  wagaGabarytowa: number;
  progKg: number;
  /** Baza przed paliwem: stawka GEIS. */
  baza: number;
  paliwoProc: number;
  paliwoEur: number;
  /** Pakowanie z tabeli GEIS. */
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
  const g = kosztPrzesylki(db, kraj, paczka, data);
  const paliwo = (g.stawka * g.paliwoProc) / 100;
  return {
    zrodlo: "geis", wagaRozliczeniowa: g.wagaRozliczeniowa, wagaRzeczywista: g.wagaRzeczywista, wagaGabarytowa: g.wagaGabarytowa, progKg: g.progKg,
    baza: g.stawka, paliwoProc: g.paliwoProc, paliwoEur: paliwo, pakowanieGeisEur: g.kosztPakowania, ...dodatki,
    razemEur: g.koszt + dodatki.mytoEur + dodatki.pakowanieKrajuEur,
  };
}

export { BladTransportu };
