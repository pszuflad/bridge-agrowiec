// Kolumny pliku i pola obliczeniowe partnera — walidacja i zapis (karta PARTNERZY, ticket 223 / PRT-5.3a).
//
// Kolejność zapisu w panelu: najpierw pola obliczeniowe (formuły), potem kolumny, które się do nich odwołują. Oba zestawy są ZASTĘPOWANE w całości
// (jedna transakcja). Pole obliczeniowe nie może zniknąć, dopóki wskazuje je jakaś kolumna; kolumna `cena` musi wskazywać kraj partnera;
// kolumna `katalog` — pole z białej listy `POLA_KATALOGU`.

import { asc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKolumny, partnerKraje, partnerPolaObliczeniowe, partnerzy } from "../db/schema.js";
import { sprawdzFormule } from "../partnerzy/formula.js";
import { POLA_KATALOGU } from "../partnerzy/plik-csv.js";

export type KolumnaWejscie = { nazwaWPliku: string; zrodloTyp: "katalog" | "cena" | "pole"; zrodlo: string };
export type PoleWejscie = { nazwa: string; formula: string };
export type BladPola = { indeks: number; nazwa: string; komunikat: string; pozycja: number | null };

/** Zmienne dozwolone w formułach pól partnera (zgodne z `wczytajKolumny`). */
export const ZMIENNE_POL = ["zakup", "stan", "waga", "dlugosc", "szerokosc_paczki", "wysokosc"] as const;
const NAZWA_POLA = /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż_][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9_ -]{0,39}$/;

const kraje = (db: Baza, partnerId: number): string[] =>
  db.select({ k: partnerKraje.kraj }).from(partnerKraje).where(eq(partnerKraje.partnerId, partnerId)).all().map((w) => w.k);

export function dozwoloneZmienne(db: Baza, partnerId: number): Set<string> {
  return new Set<string>([...ZMIENNE_POL, ...kraje(db, partnerId).map((k) => `cena_${k}`)]);
}

const jestObiektem = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export type WynikWalidacjiPol = { pola: PoleWejscie[] } | { blad: string; bledy?: BladPola[] };

/** Waliduje listę pól obliczeniowych (nazwy, unikalność, składnia i znane zmienne formuł). */
export function walidujPola(db: Baza, partnerId: number, wejscie: unknown): WynikWalidacjiPol {
  if (!Array.isArray(wejscie)) return { blad: "Pole `pola` musi być tablicą." };
  if (wejscie.length > 100) return { blad: "Za dużo pól obliczeniowych (limit 100)." };
  const dozwolone = dozwoloneZmienne(db, partnerId);
  const bledy: BladPola[] = [];
  const pola: PoleWejscie[] = [];
  const widziane = new Set<string>();
  wejscie.forEach((w, indeks) => {
    if (!jestObiektem(w) || typeof w.nazwa !== "string" || typeof w.formula !== "string") {
      bledy.push({ indeks, nazwa: "", komunikat: "Każde pole wymaga `nazwa` i `formula` (tekst).", pozycja: null });
      return;
    }
    const nazwa = w.nazwa.trim();
    if (!NAZWA_POLA.test(nazwa)) bledy.push({ indeks, nazwa, komunikat: "Nazwa pola: 1–40 znaków (litery, cyfry, spacja, _ i -), zaczyna się od litery.", pozycja: null });
    else if (widziane.has(nazwa.toLowerCase())) bledy.push({ indeks, nazwa, komunikat: "Nazwa pola jest użyta więcej niż raz.", pozycja: null });
    else {
      widziane.add(nazwa.toLowerCase());
      for (const b of sprawdzFormule(w.formula, dozwolone)) bledy.push({ indeks, nazwa, komunikat: b.message, pozycja: b.pozycja });
    }
    pola.push({ nazwa, formula: w.formula });
  });
  return bledy.length ? { blad: "Formuły zawierają błędy.", bledy } : { pola };
}

/** Zastępuje pola obliczeniowe partnera. Odmawia, gdy usuwane/przemianowane pole jest używane przez kolumnę. */
export function zapiszPola(db: Baza, partnerId: number, pola: PoleWejscie[]): { blad: string } | null {
  const nazwy = new Set(pola.map((p) => p.nazwa));
  const uzywane = db.select().from(partnerKolumny).where(eq(partnerKolumny.partnerId, partnerId)).all().filter((k) => k.zrodloTyp === "pole" && !nazwy.has(k.zrodlo));
  if (uzywane.length) return { blad: `Pole „${uzywane[0]!.zrodlo}” jest używane przez kolumnę „${uzywane[0]!.nazwaWPliku}” — najpierw zmień kolumny.` };
  db.$client.transaction(() => {
    db.delete(partnerPolaObliczeniowe).where(eq(partnerPolaObliczeniowe.partnerId, partnerId)).run();
    if (pola.length) db.insert(partnerPolaObliczeniowe).values(pola.map((p) => ({ partnerId, ...p }))).run();
    db.update(partnerzy).set({ zmieniono: new Date().toISOString() }).where(eq(partnerzy.id, partnerId)).run();
  })();
  return null;
}

export type WynikWalidacjiKolumn = { kolumny: KolumnaWejscie[] } | { blad: string };

export function walidujKolumny(db: Baza, partnerId: number, wejscie: unknown): WynikWalidacjiKolumn {
  if (!Array.isArray(wejscie)) return { blad: "Pole `kolumny` musi być tablicą." };
  if (wejscie.length > 200) return { blad: "Za dużo kolumn (limit 200)." };
  const krajePartnera = new Set(kraje(db, partnerId));
  const pola = new Set(db.select({ n: partnerPolaObliczeniowe.nazwa }).from(partnerPolaObliczeniowe).where(eq(partnerPolaObliczeniowe.partnerId, partnerId)).all().map((p) => p.n));
  const wynik: KolumnaWejscie[] = [];
  const nazwy = new Set<string>();
  for (const [i, k] of wejscie.entries()) {
    const nr = `Kolumna ${i + 1}`;
    if (!jestObiektem(k)) return { blad: `${nr}: oczekiwano obiektu.` };
    const nazwa = typeof k.nazwaWPliku === "string" ? k.nazwaWPliku.trim() : "";
    if (nazwa === "" || nazwa.length > 80) return { blad: `${nr}: nazwa w pliku jest wymagana (1–80 znaków).` };
    if (nazwy.has(nazwa.toLowerCase())) return { blad: `${nr}: nazwa „${nazwa}” powtarza się w pliku.` };
    nazwy.add(nazwa.toLowerCase());
    const zrodlo = typeof k.zrodlo === "string" ? k.zrodlo : "";
    if (k.zrodloTyp === "katalog") {
      if (!(POLA_KATALOGU as readonly string[]).includes(zrodlo)) return { blad: `${nr} („${nazwa}”): nieznane pole katalogu „${zrodlo}”.` };
    } else if (k.zrodloTyp === "cena") {
      if (!krajePartnera.has(zrodlo)) return { blad: `${nr} („${nazwa}”): partner nie ma kraju „${zrodlo}”.` };
    } else if (k.zrodloTyp === "pole") {
      if (!pola.has(zrodlo)) return { blad: `${nr} („${nazwa}”): brak pola obliczeniowego „${zrodlo}” — dodaj je najpierw.` };
    } else return { blad: `${nr} („${nazwa}”): typ źródła musi być jednym z: katalog, cena, pole.` };
    wynik.push({ nazwaWPliku: nazwa, zrodloTyp: k.zrodloTyp, zrodlo });
  }
  return { kolumny: wynik };
}

/** Zastępuje kolumny pliku partnera; kolejność tablicy = kolejność kolumn (pozycje 1…n). */
export function zapiszKolumny(db: Baza, partnerId: number, kolumny: KolumnaWejscie[]): void {
  db.$client.transaction(() => {
    db.delete(partnerKolumny).where(eq(partnerKolumny.partnerId, partnerId)).run();
    if (kolumny.length) db.insert(partnerKolumny).values(kolumny.map((k, i) => ({ partnerId, pozycja: i + 1, nazwaWPliku: k.nazwaWPliku, zrodloTyp: k.zrodloTyp, zrodlo: k.zrodlo }))).run();
    db.update(partnerzy).set({ zmieniono: new Date().toISOString() }).where(eq(partnerzy.id, partnerId)).run();
  })();
}

export const kolumnyPartnera = (db: Baza, partnerId: number) =>
  db.select().from(partnerKolumny).where(eq(partnerKolumny.partnerId, partnerId)).orderBy(asc(partnerKolumny.pozycja)).all();
