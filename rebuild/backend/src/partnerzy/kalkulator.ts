// Kalkulator ceny partnera B2B (karta PARTNERZY, ticket 213 / PRT-2.4) — scala kurs (210), transport (212) i formuły (211).
//
// Domyślna formuła (EUR): zakup × (1 + narzut) / kurs  +  przesyłka GEIS (już w EUR, z paliwem)  +  koszty dodatkowe / kurs.
// To odpowiednik wzoru z karty `(zakup + zakup×narzut + przesyłka + koszty) / kurs` przy założeniu, że przesyłka z tabel GEIS jest
// ZAPISANA W EUR (tak ją czytamy z arkusza), a koszty dodatkowe partnera w PLN. Inną formułę ustawia partner (pole obliczeniowe).
//
// Zmienne formuły: zakup [PLN], narzut [ułamek: 12 % = 0.12], przesylka_eur, przesylka_pln (= przesylka_eur × kurs_EUR),
// koszty_dodatkowe [PLN], kurs_EUR, waga [kg]. Obliczenia pośrednie w pełnej precyzji; zaokrąglamy dopiero wynik wg reguły partnera.
// Pozycja, której nie da się policzyć (brak ceny zakupu/wagi/wymiarów/tabeli, błąd formuły), to `BladKalkulacji` — wywołujący POMIJA ją
// i loguje; nigdy cena 0. Waga uzupełniona automatycznie lub szacowana jest użyta, ale zwraca ostrzeżenie (mniej pewna).

import type { Baza } from "../db/index.js";
import { BladFormuly, obliczFormule, parsujFormule, zaokraglij, type Wyrazenie } from "./formula.js";
import { BladTransportu, kosztPrzesylki } from "./transport.js";

export const FORMULA_DOMYSLNA = "zakup * (1 + narzut) / kurs_EUR + przesylka_eur + koszty_dodatkowe / kurs_EUR";
export const ZMIENNE_FORMULY = ["zakup", "narzut", "przesylka_eur", "przesylka_pln", "koszty_dodatkowe", "kurs_EUR", "waga"] as const;
export const FORMULA_DOMYSLNA_SKOMPILOWANA: Wyrazenie = parsujFormule(FORMULA_DOMYSLNA);

export class BladKalkulacji extends Error {
  constructor(
    readonly kod: string,
    readonly powod: string,
  ) {
    super(`${kod}: ${powod}`);
    this.name = "BladKalkulacji";
  }
}

export type PozycjaDoCeny = {
  kod: string;
  cenaZakupu: number | null;
  waga: number | null;
  dlugosc: number | null;
  szerokoscPaczki: number | null;
  wysokosc: number | null;
  wagaAutoUzupelniona?: boolean | null;
  wagaSzacowana?: boolean | null;
};

export type WejscieKalkulatora = {
  pozycja: PozycjaDoCeny;
  /** Ustawienia kraju partnera (`partner_kraje`): narzut w PROCENTACH (12 = 12 %), koszty dodatkowe w PLN. */
  kraj: { kraj: string; narzutProc: number; kosztyDodatkowe: number };
  /** Reguła zaokrąglania partnera (`partnerzy.zaokraglanie`): grosz | euro | gora5 | gora10. */
  zaokraglanie: string;
  /** Kurs PLN za 1 EUR użyty w tym pliku (z `kursEur`). */
  kurs: number;
  /** Dzień wyceny `YYYY-MM-DD` (wybiera okres opłaty paliwowej). */
  data: string;
  /** Skompilowana formuła; domyślnie `FORMULA_DOMYSLNA_SKOMPILOWANA`. */
  formula?: Wyrazenie;
};

export type WynikKalkulatora = {
  /** Cena w EUR po zaokrągleniu wg reguły partnera. */
  cenaEur: number;
  /** Cena przed zaokrągleniem (pełna precyzja) — do logu i podglądu. */
  cenaPrzedZaokragleniem: number;
  skladniki: { zakup: number; narzut: number; przesylkaEur: number; kosztyDodatkoweEur: number; kurs: number };
  ostrzezenia: string[];
};

/** Zaokrągla cenę EUR wg reguły partnera. */
export function zaokragliWgReguly(cena: number, regula: string): number {
  switch (regula) {
    case "grosz":
      return zaokraglij(cena, 2);
    case "euro":
      return zaokraglij(cena, 0);
    case "gora5":
      return Math.ceil(zaokraglij(cena, 6) / 5) * 5;
    case "gora10":
      return Math.ceil(zaokraglij(cena, 6) / 10) * 10;
    default:
      throw new BladFormuly(`Nieznana reguła zaokrąglania „${regula}”.`);
  }
}

export function obliczCene(db: Baza, w: WejscieKalkulatora): WynikKalkulatora {
  const { pozycja: p, kraj, kurs } = w;
  const blad = (powod: string): never => {
    throw new BladKalkulacji(p.kod, powod);
  };
  if (!(typeof kurs === "number" && Number.isFinite(kurs) && kurs > 0)) blad("Niepoprawny kurs EUR.");
  if (!(typeof p.cenaZakupu === "number" && Number.isFinite(p.cenaZakupu) && p.cenaZakupu > 0)) blad("Brak ceny zakupu.");

  const ostrzezenia: string[] = [];
  let przesylkaEur: number;
  try {
    przesylkaEur = kosztPrzesylki(
      db,
      kraj.kraj,
      { waga: p.waga, dlugosc: p.dlugosc, szerokosc: p.szerokoscPaczki, wysokosc: p.wysokosc },
      w.data,
    ).koszt;
  } catch (e) {
    if (e instanceof BladTransportu) return blad(`Błąd kalkulacji transportu (${kraj.kraj}): ${e.message}`);
    throw e;
  }
  if (p.wagaAutoUzupelniona) ostrzezenia.push(`${p.kod}: waga uzupełniona automatycznie (mniej pewna).`);
  if (p.wagaSzacowana) ostrzezenia.push(`${p.kod}: waga szacowana (mniej pewna).`);

  const zakup = p.cenaZakupu as number; // zwalidowane wyżej (dodatnia liczba skończona)
  const narzut = kraj.narzutProc / 100;
  let cena: number;
  try {
    cena = obliczFormule(w.formula ?? FORMULA_DOMYSLNA_SKOMPILOWANA, {
      zakup,
      narzut,
      przesylka_eur: przesylkaEur,
      przesylka_pln: przesylkaEur * kurs,
      koszty_dodatkowe: kraj.kosztyDodatkowe,
      kurs_EUR: kurs,
      waga: p.waga,
    });
  } catch (e) {
    if (e instanceof BladFormuly) return blad(`Błąd formuły: ${e.message}`);
    throw e;
  }
  if (!(cena > 0)) blad("Wynik formuły nie jest dodatni.");
  return {
    cenaEur: zaokragliWgReguly(cena, w.zaokraglanie),
    cenaPrzedZaokragleniem: cena,
    skladniki: { zakup, narzut, przesylkaEur, kosztyDodatkoweEur: kraj.kosztyDodatkowe / kurs, kurs },
    ostrzezenia,
  };
}
