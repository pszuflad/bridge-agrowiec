// Koszt przesyłki GEIS dla partnerów (karta PARTNERZY, ticket 212 / PRT-2.2).
//
// V1: stawka CAŁEGO KRAJU (kolumna 1 tabel GEIS), koszt dla JEDNEJ sztuki (przesyłka pojedyncza), w całości wchodzi do ceny opony.
// Waga rozliczeniowa = większa z rzeczywistej i gabarytowej (objętość w m³ × współczynnik kraju). Stawka = pierwszy próg ≥ waga
// rozliczeniowa. Opłata paliwowa to ręcznie wpisywany PROCENT z historią okresów (`paliwo_historia`) — zmiana nie przelicza wstecz.
// Brak wagi/wymiarów, wymiary ponad limit kraju albo waga ponad najwyższy próg = `BladTransportu` (pozycja pomijana i logowana,
// NIGDY koszt 0).

import { and, asc, desc, eq, lte } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { geisKraje, geisStawki, paliwoHistoria } from "../db/schema.js";

export class BladTransportu extends Error {
  constructor(komunikat: string) {
    super(komunikat);
    this.name = "BladTransportu";
  }
}

/** Wymiary w cm, waga w kg. */
export type Paczka = { waga: number | null; dlugosc: number | null; szerokosc: number | null; wysokosc: number | null };

export type KosztPrzesylki = {
  wagaRozliczeniowa: number;
  wagaRzeczywista: number;
  wagaGabarytowa: number;
  progKg: number;
  stawka: number;
  paliwoProc: number;
  kosztPakowania: number;
  /** stawka × (1 + paliwo%) + pakowanie, w walucie tabeli GEIS (EUR). */
  koszt: number;
};

const dodatnia = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** max(rzeczywista, gabarytowa); gabarytowa = dł × szer × wys [m³] × współczynnik (kg/m³). */
export function wagaRozliczeniowa(p: Paczka, wspGabarytowy: number): { rozliczeniowa: number; rzeczywista: number; gabarytowa: number } {
  if (!dodatnia(p.waga)) throw new BladTransportu("Brak wagi pozycji.");
  if (!dodatnia(p.dlugosc) || !dodatnia(p.szerokosc) || !dodatnia(p.wysokosc)) throw new BladTransportu("Brak wymiarów pozycji.");
  const gabarytowa = ((p.dlugosc * p.szerokosc * p.wysokosc) / 1_000_000) * wspGabarytowy;
  return { rozliczeniowa: Math.max(p.waga, gabarytowa), rzeczywista: p.waga, gabarytowa };
}

/** Opłata paliwowa [%] obowiązująca w dniu `data` (`YYYY-MM-DD`); brak wpisu = 0 %. */
export function paliwoNaDzien(db: Baza, kraj: string, data: string): number {
  const w = db
    .select({ procent: paliwoHistoria.procent })
    .from(paliwoHistoria)
    .where(and(eq(paliwoHistoria.kraj, kraj), lte(paliwoHistoria.obowiazujeOd, data)))
    .orderBy(desc(paliwoHistoria.obowiazujeOd))
    .limit(1)
    .get();
  return w?.procent ?? 0;
}

/** Ustawia opłatę paliwową od danego dnia (nowy okres; nie rusza wcześniejszych). */
export function ustawPaliwo(db: Baza, kraj: string, procent: number, obowiazujeOd: string): void {
  if (!Number.isFinite(procent) || procent < 0) throw new BladTransportu("Opłata paliwowa musi być liczbą ≥ 0.");
  db.insert(paliwoHistoria)
    .values({ kraj, procent, obowiazujeOd })
    .onConflictDoUpdate({ target: [paliwoHistoria.kraj, paliwoHistoria.obowiazujeOd], set: { procent } })
    .run();
}

/** Koszt przesyłki jednej sztuki do `kraj` według tabel GEIS i paliwa z dnia `data`. */
export function kosztPrzesylki(db: Baza, kraj: string, paczka: Paczka, data: string): KosztPrzesylki {
  const k = db.select().from(geisKraje).where(eq(geisKraje.kraj, kraj)).get();
  if (!k) throw new BladTransportu(`Brak tabeli transportowej GEIS dla kraju ${kraj}.`);
  const w = wagaRozliczeniowa(paczka, k.wspGabarytowy);
  const wymiary = [
    [paczka.dlugosc, k.maksDlugosc],
    [paczka.szerokosc, k.maksSzerokosc],
    [paczka.wysokosc, k.maksWysokosc],
  ] as const;
  if (wymiary.some(([wartosc, maks]) => maks !== null && wartosc! > maks))
    throw new BladTransportu(`Wymiary ponad limit przesyłki GEIS dla ${kraj} (${k.maksDlugosc}×${k.maksSzerokosc}×${k.maksWysokosc} cm).`);
  const stawka = db
    .select()
    .from(geisStawki)
    .where(eq(geisStawki.kraj, kraj))
    .orderBy(asc(geisStawki.progKg))
    .all()
    .find((s) => s.progKg >= w.rozliczeniowa);
  if (!stawka) throw new BladTransportu(`Waga rozliczeniowa ${w.rozliczeniowa.toFixed(1)} kg przekracza najwyższy próg tabeli GEIS dla ${kraj}.`);
  const paliwoProc = paliwoNaDzien(db, kraj, data);
  return {
    wagaRozliczeniowa: w.rozliczeniowa,
    wagaRzeczywista: w.rzeczywista,
    wagaGabarytowa: w.gabarytowa,
    progKg: stawka.progKg,
    stawka: stawka.stawka,
    paliwoProc,
    kosztPakowania: k.kosztPakowania,
    koszt: stawka.stawka * (1 + paliwoProc / 100) + k.kosztPakowania,
  };
}

/** Format pliku JSON do wgrania tabel GEIS (jeden obiekt na kraj; `stawki` = pary [próg kg, stawka] strefy 1). */
export type TabeleGeisJson = Record<
  string,
  { wspGabarytowy: number; kosztPakowania?: number; maks?: [number, number, number] | null; stawki: [number, number][] }
>;

/** Wgrywa (nadpisuje) tabele GEIS z JSON-a, w jednej transakcji. Zwraca liczbę krajów. */
export function importujTabeleGeis(db: Baza, dane: TabeleGeisJson): number {
  const kraje = Object.entries(dane);
  for (const [kraj, d] of kraje) {
    if (!/^[A-Z]{2}$/.test(kraj)) throw new BladTransportu(`Niepoprawny kod kraju „${kraj}”.`);
    if (!dodatnia(d.wspGabarytowy)) throw new BladTransportu(`${kraj}: współczynnik gabarytowy musi być > 0.`);
    if (!Array.isArray(d.stawki) || d.stawki.length === 0) throw new BladTransportu(`${kraj}: brak stawek.`);
    if (d.stawki.some(([prog, stawka]) => !dodatnia(prog) || !dodatnia(stawka)))
      throw new BladTransportu(`${kraj}: próg i stawka muszą być liczbami > 0.`);
    if (new Set(d.stawki.map(([prog]) => prog)).size !== d.stawki.length) throw new BladTransportu(`${kraj}: powtórzony próg wagowy.`);
  }
  db.transaction((tx) => {
    for (const [kraj, d] of kraje) {
      tx.delete(geisKraje).where(eq(geisKraje.kraj, kraj)).run();
      tx.insert(geisKraje)
        .values({
          kraj,
          wspGabarytowy: d.wspGabarytowy,
          kosztPakowania: d.kosztPakowania ?? 0,
          maksDlugosc: d.maks?.[0] ?? null,
          maksSzerokosc: d.maks?.[1] ?? null,
          maksWysokosc: d.maks?.[2] ?? null,
        })
        .run();
      tx.insert(geisStawki).values(d.stawki.map(([progKg, stawka]) => ({ kraj, progKg, stawka }))).run();
    }
  });
  return kraje.length;
}
