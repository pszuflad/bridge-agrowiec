/**
 * Klient `/api/partnerzy` — moduł partnerów B2B (karta PARTNERZY, ticket 221 / PRT-5.1).
 *
 * ⚠ NOWA funkcjonalność, trasy backendu poza `contract/openapi.yaml` (jak `/api/ean-pary`): kształty poniżej pochodzą z kodu
 * `rebuild/backend/src/repos/partnerzy.ts` i `partnerzy/logi.ts`, nie z nagrań fixtures.
 */
import { zadanie } from "@/lib/api";

export type PartnerNaLiscie = {
  id: number;
  nazwa: string;
  aktywny: boolean;
  stanMin: number;
  zaokraglanie: string;
  harmonogramMinuty: number | null;
  formatPliku: string;
  liczbaMagazynow: number;
  liczbaWykluczen: number;
  liczbaKrajow: number;
};

export type ListaPartnerow = { partnerzy: PartnerNaLiscie[] };
export type WpisLogu = { id: number; partnerId: number; kiedy: string; operacja: string; opis: string; liczbaPozycji: number | null };
export type ListaLogow = { logi: WpisLogu[] };

export const KLUCZ_PARTNERZY = "/api/partnerzy";

export async function dodajPartnera(nazwa: string): Promise<void> {
  await zadanie("POST", KLUCZ_PARTNERZY, { nazwa });
}

export async function ustawAktywnosc(id: number, aktywny: boolean): Promise<void> {
  await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/aktywny`, { aktywny });
}

/** Komunikat z odpowiedzi błędu (`"409: {\"error\":\"…\"}"` → treść pola `error`). */
export function komunikatBledu(e: unknown): string {
  const tekst = e instanceof Error ? e.message : String(e);
  const m = /^\d{3}: (.*)$/s.exec(tekst);
  if (!m) return tekst;
  try {
    const json = JSON.parse(m[1]!) as { error?: unknown };
    return typeof json.error === "string" ? json.error : m[1]!;
  } catch {
    return m[1]!;
  }
}

/** „co 30 min", „co 2 h", „co 1 dzień" albo „—" (bez harmonogramu). */
export function opisHarmonogramu(minuty: number | null): string {
  if (minuty === null) return "—";
  if (minuty % 1440 === 0) return minuty === 1440 ? "co 1 dzień" : `co ${minuty / 1440} dni`;
  if (minuty % 60 === 0) return `co ${minuty / 60} h`;
  return `co ${minuty} min`;
}

export type KrajPartnera = {
  id: number;
  partnerId: number;
  kraj: string;
  /** PROCENT (12 = 12 %). */
  narzutProc: number;
  kursZrodlo: "nbp" | "reczny";
  kursReczny: number | null;
  /** PLN. */
  kosztyDodatkowe: number;
};

export type KolumnaPartnera = { id: number; partnerId: number; pozycja: number; nazwaWPliku: string; zrodloTyp: "katalog" | "cena" | "pole"; zrodlo: string };
export type PoleObliczeniowe = { id: number; partnerId: number; nazwa: string; formula: string };
export type KolumnaDoZapisu = Pick<KolumnaPartnera, "nazwaWPliku" | "zrodloTyp" | "zrodlo">;
export type PoleDoZapisu = Pick<PoleObliczeniowe, "nazwa" | "formula">;
export type BladPola = { indeks: number; nazwa: string; komunikat: string; pozycja: number | null };
export type WynikPodgladu = {
  pliki: { nazwa: string; kraj: string | null; tekst: string; liczbaWierszy: number }[];
  bledy: string[];
  ostrzezenia: string[];
  pozycjeWybrane: number;
};

/** Pola katalogu dostępne jako źródło kolumny — zgodne z białą listą `POLA_KATALOGU` backendu. */
export const POLA_KATALOGU: { pole: string; etykieta: string }[] = [
  { pole: "kod", etykieta: "kod (numer katalogowy)" },
  { pole: "kodImportu", etykieta: "kod importu" },
  { pole: "ean", etykieta: "EAN" },
  { pole: "nazwa", etykieta: "nazwa" },
  { pole: "marka", etykieta: "marka" },
  { pole: "model", etykieta: "model" },
  { pole: "rozmiar", etykieta: "rozmiar" },
  { pole: "kategoria", etykieta: "kategoria" },
  { pole: "dostawca", etykieta: "dostawca" },
  { pole: "magazyn", etykieta: "magazyn" },
  { pole: "stan", etykieta: "stan" },
  { pole: "dot", etykieta: "DOT" },
  { pole: "waga", etykieta: "waga [kg]" },
  { pole: "dlugosc", etykieta: "długość [cm]" },
  { pole: "szerokoscPaczki", etykieta: "szerokość paczki [cm]" },
  { pole: "wysokosc", etykieta: "wysokość [cm]" },
];
export const ZMIENNE_POL = ["zakup", "stan", "waga", "dlugosc", "szerokosc_paczki", "wysokosc"];

export const zapiszPola = async (id: number, pola: PoleDoZapisu[]): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/pola-obliczeniowe`, { pola }));
export const zapiszKolumny = async (id: number, kolumny: KolumnaDoZapisu[]): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/kolumny`, { kolumny }));
export async function pobierzPodglad(id: number): Promise<WynikPodgladu> {
  return (await (await zadanie("POST", `${KLUCZ_PARTNERZY}/${id}/podglad`, {})).json()) as WynikPodgladu;
}

/** Błędy formuł z odpowiedzi 400 (`bledy[]`), albo pusta lista, gdy to inny błąd. */
export function bledyPol(e: unknown): BladPola[] {
  const m = /^\d{3}: (.*)$/s.exec(e instanceof Error ? e.message : String(e));
  if (!m) return [];
  try {
    const json = JSON.parse(m[1]!) as { bledy?: unknown };
    return Array.isArray(json.bledy) ? (json.bledy as BladPola[]) : [];
  } catch {
    return [];
  }
}

export type SzczegolyPartnera = {
  id: number;
  nazwa: string;
  aktywny: boolean;
  stanMin: number;
  zaokraglanie: string;
  harmonogramMinuty: number | null;
  tolerancjaCenyProc: number | null;
  formatPliku: string;
  csvSeparator: string;
  kanalFtp: boolean;
  kanalEmail: boolean;
  emailSkrzynka: string | null;
  zmieniono: string;
  magazyny: string[];
  wykluczenia: string[];
  kraje: KrajPartnera[];
  kolumny: KolumnaPartnera[];
  polaObliczeniowe: PoleObliczeniowe[];
};

export type UstawieniaDoZapisu = Pick<
  SzczegolyPartnera,
  "nazwa" | "stanMin" | "zaokraglanie" | "harmonogramMinuty" | "tolerancjaCenyProc" | "formatPliku" | "csvSeparator" | "kanalFtp" | "kanalEmail" | "emailSkrzynka"
>;
export type UstawieniaKraju = Pick<KrajPartnera, "narzutProc" | "kursZrodlo" | "kursReczny" | "kosztyDodatkowe">;
export type MagazynKatalogu = { magazyn: string; liczbaPozycji: number };

export const ZAOKRAGLANIA: { wartosc: string; etykieta: string }[] = [
  { wartosc: "grosz", etykieta: "do 2 miejsc po przecinku" },
  { wartosc: "euro", etykieta: "do pełnego EUR" },
  { wartosc: "gora5", etykieta: "w górę do 5 EUR" },
  { wartosc: "gora10", etykieta: "w górę do 10 EUR" },
];

export const zapiszUstawienia = async (id: number, c: UstawieniaDoZapisu): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}`, c));
export const zapiszMagazyny = async (id: number, magazyny: string[]): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/magazyny`, { magazyny }));
export const zapiszWykluczenia = async (id: number, kody: string[]): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/wykluczenia`, { kody }));
export const zapiszKraj = async (id: number, kraj: string, u: UstawieniaKraju): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/kraje/${kraj}`, u));
export const usunKraj = async (id: number, kraj: string): Promise<void> => void (await zadanie("DELETE", `${KLUCZ_PARTNERZY}/${id}/kraje/${kraj}`));

/** Zamienia tekst z pola liczbowego na liczbę (przecinek lub kropka); pusty → `null`; nieliczbowy → `NaN`. */
export function liczbaZPola(tekst: string): number | null {
  const t = tekst.trim().replace(",", ".");
  return t === "" ? null : Number(t);
}

export type WpisBledu = { id: number; partnerId: number; kiedy: string; operacja: string; poziom: "blad" | "ostrzezenie"; komunikat: string };
export type ListaBledow = { bledy: WpisBledu[] };
export type WynikGenerowania = {
  pliki: { nazwa: string; kraj: string | null; liczbaWierszy: number; pominiete: number; zapisany: boolean }[];
  bledy: string[];
  ostrzezenia: string[];
  pozycjeWybrane: number;
};
export type FiltrPoziomu = "wszystkie" | "blad" | "ostrzezenie";

export async function generujTeraz(id: number): Promise<WynikGenerowania> {
  return (await (await zadanie("POST", `${KLUCZ_PARTNERZY}/${id}/generuj`, {})).json()) as WynikGenerowania;
}

export const LIMIT_LOGOW = 50;
export const LIMIT_BLEDOW = 100;
/** Klucze zapytań logów — ścieżka sklejana z `queryKey` (konwencja aplikacji). */
export const kluczLogow = (id: number): string[] => [KLUCZ_PARTNERZY, String(id), `logi?limit=${LIMIT_LOGOW}`];
export const kluczBledow = (id: number, poziom: FiltrPoziomu): string[] => [
  KLUCZ_PARTNERZY, String(id), `error-log?limit=${LIMIT_BLEDOW}${poziom === "wszystkie" ? "" : `&poziom=${poziom}`}`,
];

/** Zamówienia odebrane od partnera (ticket 230, PRT-7.6a; tylko odczyt). Kształty z `repos/partnerzy-zamowienia.ts`. */
export type ZamowienieNaLiscie = {
  id: number;
  numerPartnera: string;
  numerWlasny: string | null;
  status: string;
  dataZamowienia: string | null;
  waluta: string | null;
  krajDostawy: string | null;
  pobrano: string;
  liczbaPozycji: number;
};
export type ListaZamowien = { zamowienia: ZamowienieNaLiscie[] };
export type PozycjaZamowienia = { id: number; lp: number; kod: string; nazwa: string | null; ilosc: number; cenaSprzedazy: number | null };
export type SzczegolyZamowienia = Omit<ZamowienieNaLiscie, "liczbaPozycji"> & {
  partnerId: number;
  dataDostawy: string | null;
  kosztDostawy: number | null;
  faktura: Record<string, string>;
  dostawa: Record<string, string>;
  pozycje: PozycjaZamowienia[];
};
export const LIMIT_ZAMOWIEN = 50;
export const kluczZamowien = (id: number): string[] => [KLUCZ_PARTNERZY, String(id), `zamowienia?limit=${LIMIT_ZAMOWIEN}`];
export const kluczZamowienia = (id: number, zamowienieId: number): string[] => [KLUCZ_PARTNERZY, String(id), "zamowienia", String(zamowienieId)];

/** Wynik ręcznego odbioru zamówień z e-maila (ticket 231). `powod` ≠ null, gdy nic nie odebrano (brak zmiennej w `.env`, awaria połączenia). */
export type WynikOdbioru = { polaczono: boolean; powod: string | null; wiadomosci: number; nowe: number; duplikaty: number; bledy: number };

export async function odbierzZamowienia(id: number): Promise<WynikOdbioru> {
  return (await (await zadanie("POST", `${KLUCZ_PARTNERZY}/${id}/zamowienia/odbierz`, {})).json()) as WynikOdbioru;
}
