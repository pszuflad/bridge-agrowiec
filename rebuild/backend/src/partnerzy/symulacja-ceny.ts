// Symulacja ceny partnera na prawdziwych produktach (ticket 273): dla kraju partnera pokazuje rozbicie ceny krok po kroku — zakup, narzut kraju/reguły (cała marża, od ceny zakupu),
// przesyłka z tabel GEIS (waga, próg, stawka, paliwo, pakowanie, myto), koszty dodatkowe, kurs i cenę końcową. TYLKO ODCZYT: niczego nie zapisuje ani nie wysyła.
// Cena końcowa pochodzi z `wycenPozycje` — tego samego kodu, którego używa generator cenników — więc symulacja i plik dla partnera nie mogą się rozjechać.

import { and, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKraje, partnerNarzuty } from "../db/schema.js";
import { FORMULA_DOMYSLNA } from "./kalkulator.js";
import { BrakKursuError, kursEur, type KlientNbp, type UzytyKurs } from "./kurs-nbp.js";
import { przygotujReguly, wybierzZPrzygotowanych } from "./reguly-narzutow.js";
import { wybierzPozycje, wycenPozycje, type PozycjaEksportu } from "./selekcja.js";
import { BladTransportu, kosztPrzesylki } from "./transport.js";

export const DOMYSLNA_LICZBA_POZYCJI = 10;
export const MAKS_POZYCJI_SYMULACJI = 50;

export type WierszSymulacji = {
  kod: string;
  numerPartnera: string | null;
  nazwa: string;
  dostawca: string;
  stan: number;
  zakupPln: number;
  /** `kraj` (narzut ustawiony dla kraju) albo nazwa pasującej reguły narzutu. */
  zrodloNarzutu: string;
  /** Narzut (cała marża partnera, liczona od ceny zakupu) — z reguły albo z kraju. */
  narzutProc: number;
  waga: number | null;
  wymiary: string | null;
  przesylka: {
    wagaRozliczeniowa: number;
    /** Wymiary użyte do wagi gabarytowej po regule palety (szerokość 60/80, wysokość +10 cm). */
    wymiaryZPaleta: string;
    progKg: number;
    stawkaEur: number;
    paliwoProc: number;
    paliwoEur: number;
    pakowanieGeisEur: number;
    mytoEur: number;
    pakowanieKrajuEur: number;
    razemEur: number;
  } | null;
  kosztyDodatkoweEur: number;
  cenaEur: number | null;
  /** Powód, dla którego pozycji nie wyceniono (brak wagi/wymiarów/tabeli GEIS, cena ≤ 0 …). */
  blad: string | null;
};

export type WynikSymulacji = {
  kraj: string;
  formula: string;
  zaokraglanie: string;
  kurs: UzytyKurs | null;
  pozycjeWybrane: number;
  wiersze: WierszSymulacji[];
  ostrzezenia: string[];
};

/** Wybiera próbkę: podane kody (kod, numer partnera albo EAN), a bez nich — równomiernie rozłożone pozycje z całej oferty (nie tylko początek listy). */
function wybierzProbke(pozycje: PozycjaEksportu[], kody: string[] | undefined, limit: number): PozycjaEksportu[] {
  if (kody && kody.length) {
    const szukane = new Set(kody.map((k) => k.trim().toLowerCase()).filter(Boolean));
    return pozycje.filter((p) => [p.kod, p.numerPartnera, p.ean].some((v) => v && szukane.has(v.toLowerCase()))).slice(0, MAKS_POZYCJI_SYMULACJI);
  }
  if (pozycje.length <= limit) return pozycje;
  const krok = pozycje.length / limit;
  return Array.from({ length: limit }, (_, i) => pozycje[Math.floor(i * krok)]!);
}

export async function symulujCeny(
  db: Baza,
  klientNbp: KlientNbp,
  partnerId: number,
  opcje: { kraj: string; kody?: string[]; limit?: number; teraz?: () => Date },
): Promise<WynikSymulacji> {
  const kraj = opcje.kraj.trim().toUpperCase();
  const k = db.select().from(partnerKraje).where(and(eq(partnerKraje.partnerId, partnerId), eq(partnerKraje.kraj, kraj))).get();
  if (!k) throw new Error(`Partner nie ma kraju ${kraj}.`);
  const teraz = (opcje.teraz ?? (() => new Date()))();
  const data = teraz.toISOString().slice(0, 10);
  const limit = Math.min(Math.max(Math.trunc(opcje.limit ?? DOMYSLNA_LICZBA_POZYCJI), 1), MAKS_POZYCJI_SYMULACJI);

  const selekcja = wybierzPozycje(db, partnerId);
  const probka = wybierzProbke(selekcja.pozycje, opcje.kody, limit);
  const wynik: WynikSymulacji = { kraj, formula: FORMULA_DOMYSLNA, zaokraglanie: "", kurs: null, pozycjeWybrane: selekcja.pozycje.length, wiersze: [], ostrzezenia: [...selekcja.ostrzezenia] };

  const kursy: Record<string, number> = {};
  try {
    const u = await kursEur(db, klientNbp, { kursZrodlo: k.kursZrodlo, kursReczny: k.kursReczny }, () => teraz);
    kursy[kraj] = u.kurs;
    wynik.kurs = u;
    if (u.ostrzezenie) wynik.ostrzezenia.push(u.ostrzezenie);
  } catch (e) {
    if (!(e instanceof BrakKursuError)) throw e;
    wynik.ostrzezenia.push(e.message);
  }

  // Cena końcowa = ten sam kod co generator. `wycenPozycje` liczy wszystkie kraje partnera, więc bierzemy z niego tylko wybrany.
  const wycena = wycenPozycje(db, partnerId, probka, kursy, data);
  const bledyPoKodzie = new Map<string, string>();
  for (const b of wycena.bledy) if (b.kraj === kraj) bledyPoKodzie.set(b.kod, b.powod);
  const reguly = przygotujReguly(db.select().from(partnerNarzuty).where(eq(partnerNarzuty.partnerId, partnerId)).all());

  wynik.ostrzezenia.push(...wycena.ostrzezenia);
  for (const w of wycena.wiersze) {
    const p = w.pozycja;
    const regula = reguly.length ? wybierzZPrzygotowanych(reguly, kraj, p as unknown as Record<string, unknown>) : null;
    const narzut = regula ? regula.wartosc : k.narzutProc;
    let przesylka: WierszSymulacji["przesylka"] = null;
    let bladPrzesylki: string | null = null;
    try {
      const g = kosztPrzesylki(db, kraj, { waga: p.waga, dlugosc: p.dlugosc, szerokosc: p.szerokoscPaczki, wysokosc: p.wysokosc }, data);
      przesylka = {
        wagaRozliczeniowa: g.wagaRozliczeniowa,
        wymiaryZPaleta: `${p.dlugosc} × ${g.szerokoscZPaleta} × ${g.wysokoscZPaleta} cm`,
        progKg: g.progKg,
        stawkaEur: g.stawka,
        paliwoProc: g.paliwoProc,
        paliwoEur: (g.stawka * g.paliwoProc) / 100,
        pakowanieGeisEur: g.kosztPakowania,
        mytoEur: k.mytoEur,
        pakowanieKrajuEur: k.pakowanieEur,
        razemEur: g.koszt + k.mytoEur + k.pakowanieEur,
      };
    } catch (e) {
      if (!(e instanceof BladTransportu)) throw e;
      bladPrzesylki = e.message;
    }
    const blad = bledyPoKodzie.get(p.kod) ?? bledyPoKodzie.get("*") ?? bladPrzesylki;
    wynik.wiersze.push({
      kod: p.kod,
      numerPartnera: p.numerPartnera,
      nazwa: p.nazwa,
      dostawca: p.dostawca,
      stan: p.stan,
      zakupPln: p.cenaZakupu,
      zrodloNarzutu: regula ? `reguła „${regula.nazwa}”` : "kraj",
      narzutProc: narzut,
      waga: p.waga,
      wymiary: p.dlugosc && p.szerokoscPaczki && p.wysokosc ? `${p.dlugosc}×${p.szerokoscPaczki}×${p.wysokosc} cm` : null,
      przesylka,
      kosztyDodatkoweEur: k.kosztyDodatkowe,
      cenaEur: w.ceny[kraj] ?? null,
      blad: w.ceny[kraj] === null || w.ceny[kraj] === undefined ? blad : null,
    });
  }
  return wynik;
}
