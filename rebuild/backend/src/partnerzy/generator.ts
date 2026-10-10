// Generator cennika partnera (karta PARTNERZY, ticket 217 / PRT-3.4) — orkiestracja:
// wybór pozycji (214) → kurs (210, raz na kraj) → wycena (213) → CSV (215) / XML (216) → zapis atomowy + archiwum + zapis użytego kursu.
//
// Układ plików: jeśli kolumny zawierają ceny co najmniej DWÓCH krajów → jeden plik z kolumnami krajów (TyreWorld); w przeciwnym razie osobny plik
// na każdy kraj partnera (Adtyres) — wtedy kolumna `cena` w pliku kraju X pokazuje cenę kraju X. XML zawsze w układzie plik-na-kraj.
// Nazwy plików są ROBOCZE (schematy ustali użytkownik): `<partner>.csv` / `<partner>_<KRAJ>.csv|xml`.
// Zapis: `<katalog>/pricelist/<plik>` przez plik tymczasowy + rename (partner nigdy nie widzi pliku w połowie), kopia do `<katalog>/archive/<data_godz>_<plik>`;
// archiwum starsze niż 30 dni jest czyszczone. PUSTY wynik (0 wierszy) NIE nadpisuje poprzedniego cennika — to błąd operacji, nie nowy cennik.
// Bez FTP i bez harmonogramu (poziomy 4 i 6).

import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

import { asc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKraje, partnerzy } from "../db/schema.js";
import { BrakKursuError, kursEur, zapiszUzytyKurs, type KlientNbp, type UzytyKurs } from "./kurs-nbp.js";
import { BladFormuly } from "./formula.js";
import { wczytajKolumny, zbudujCsv, type KolumnaPliku } from "./plik-csv.js";
import { zbudujXml } from "./plik-xml.js";
import { wybierzPozycje, wycenPozycje, type WierszWyceniony } from "./selekcja.js";

export const RETENCJA_ARCHIWUM_DNI = 30;

export type PlikWynik = { nazwa: string; kraj: string | null; liczbaWierszy: number; pominiete: number; zapisany: boolean };
export type WynikGenerowania = {
  pliki: PlikWynik[];
  /** Błędy kalkulacji i pól obliczeniowych oraz operacyjne (np. pusty plik) — do `error_log` (PRT-4.2). */
  bledy: string[];
  /** Ostrzeżenia (waga szacowana, kurs z rezerwy, brak magazynów…) — do logu operacji. */
  ostrzezenia: string[];
  kursy: Record<string, UzytyKurs>;
  pozycjeWybrane: number;
  usunieteZArchiwum: number;
};

const slug = (nazwa: string): string =>
  nazwa.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "partner";

const znacznik = (d: Date): string => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "").replace("T", "_");

/** Usuwa z archiwum pliki starsze niż retencja (wiek z prefiksu `YYYYMMDD_HHMMSS_` w nazwie). Zwraca liczbę usuniętych. */
export function wyczyscArchiwum(katalogArchiwum: string, teraz: Date, dni = RETENCJA_ARCHIWUM_DNI): number {
  let usuniete = 0;
  let nazwy: string[];
  try {
    nazwy = readdirSync(katalogArchiwum);
  } catch {
    return 0;
  }
  const granica = teraz.getTime() - dni * 86_400_000;
  for (const n of nazwy) {
    const m = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/.exec(n);
    if (!m) continue;
    if (Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!) < granica) {
      rmSync(join(katalogArchiwum, n), { force: true });
      usuniete++;
    }
  }
  return usuniete;
}

function zapiszAtomowo(katalogPricelist: string, katalogArchiwum: string, nazwa: string, tresc: string, teraz: Date): void {
  const docelowy = join(katalogPricelist, nazwa);
  const tymczasowy = `${docelowy}.tmp-${process.pid}`;
  try {
    writeFileSync(tymczasowy, tresc, "utf8");
    renameSync(tymczasowy, docelowy);
  } finally {
    rmSync(tymczasowy, { force: true });
  }
  copyFileSync(docelowy, join(katalogArchiwum, `${znacznik(teraz)}_${nazwa}`));
}

export async function generujPlikiPartnera(
  db: Baza,
  klientNbp: KlientNbp,
  partnerId: number,
  opcje: { katalog: string; teraz?: () => Date },
): Promise<WynikGenerowania> {
  const teraz = (opcje.teraz ?? (() => new Date()))();
  const data = teraz.toISOString().slice(0, 10);
  const partner = db.select().from(partnerzy).where(eq(partnerzy.id, partnerId)).get();
  if (!partner) throw new Error(`Nie ma partnera o id ${partnerId}.`);
  const kraje = db.select().from(partnerKraje).where(eq(partnerKraje.partnerId, partnerId)).orderBy(asc(partnerKraje.kraj)).all();
  const wynik: WynikGenerowania = { pliki: [], bledy: [], ostrzezenia: [], kursy: {}, pozycjeWybrane: 0, usunieteZArchiwum: 0 };
  if (kraje.length === 0) {
    wynik.bledy.push("Partner nie ma żadnego kraju — nie ma czego generować.");
    return wynik;
  }

  let kolumny: KolumnaPliku[];
  try {
    kolumny = wczytajKolumny(db, partnerId, kraje.map((k) => k.kraj));
  } catch (e) {
    if (!(e instanceof BladFormuly)) throw e;
    wynik.bledy.push(`Błąd konfiguracji kolumn: ${e.message}`);
    return wynik;
  }
  if (kolumny.length === 0) {
    wynik.bledy.push("Partner nie ma skonfigurowanych kolumn pliku.");
    return wynik;
  }

  const selekcja = wybierzPozycje(db, partnerId);
  wynik.pozycjeWybrane = selekcja.pozycje.length;
  wynik.ostrzezenia.push(...selekcja.ostrzezenia);

  // Kurs raz na kraj; kraj bez kursu zostaje bez cen (błąd, nie zgadywanie).
  const kursy: Record<string, number> = {};
  for (const k of kraje) {
    try {
      const u = await kursEur(db, klientNbp, { kursZrodlo: k.kursZrodlo, kursReczny: k.kursReczny }, () => teraz);
      kursy[k.kraj] = u.kurs;
      wynik.kursy[k.kraj] = u;
      if (u.ostrzezenie) wynik.ostrzezenia.push(`${k.kraj}: ${u.ostrzezenie}`);
    } catch (e) {
      if (!(e instanceof BrakKursuError)) throw e;
      wynik.bledy.push(`${k.kraj}: ${e.message}`);
    }
  }

  const wycena = wycenPozycje(db, partnerId, selekcja.pozycje, kursy, data);
  wynik.ostrzezenia.push(...wycena.ostrzezenia);
  wynik.bledy.push(...wycena.bledy.map((b) => `Błąd kalkulacji ${b.kod} (${b.kraj}): ${b.powod}`));

  const katalogPricelist = join(opcje.katalog, "pricelist");
  const katalogArchiwum = join(opcje.katalog, "archive");
  mkdirSync(katalogPricelist, { recursive: true });
  mkdirSync(katalogArchiwum, { recursive: true });

  const ext = partner.formatPliku === "xml" ? "xml" : "csv";
  const cenyKolumnKrajow = new Set(kolumny.filter((k) => k.typ === "cena").map((k) => (k as { kraj: string }).kraj));
  const jedenPlik = ext === "csv" && cenyKolumnKrajow.size >= 2;
  const baza = slug(partner.nazwa);

  type Zadanie = { nazwa: string; kraj: string | null; wiersze: WierszWyceniony[]; kolumny: KolumnaPliku[] };
  const zadania: Zadanie[] = jedenPlik
    ? [{ nazwa: `${baza}.${ext}`, kraj: null, wiersze: wycena.wiersze, kolumny }]
    : kraje.map((k) => ({
        nazwa: `${baza}_${k.kraj}.${ext}`,
        kraj: k.kraj,
        wiersze: wycena.wiersze,
        // w pliku kraju kolumna ceny pokazuje cenę TEGO kraju
        kolumny: kolumny.map((c): KolumnaPliku => (c.typ === "cena" ? { ...c, kraj: k.kraj } : c)),
      }));

  for (const z of zadania) {
    const w =
      ext === "xml"
        ? zbudujXml({ kolumny: z.kolumny, wiersze: z.wiersze, kraj: z.kraj! })
        : zbudujCsv({
            kolumny: z.kolumny,
            separator: partner.csvSeparator,
            wiersze: z.wiersze,
            uklad: z.kraj === null ? "kolumny-krajow" : "plik-na-kraj",
            kraj: z.kraj ?? undefined,
          });
    wynik.bledy.push(...w.bledy.map((b) => `Błąd pola „${b.kolumna}” (${b.kod}): ${b.powod}`));
    const plik: PlikWynik = { nazwa: z.nazwa, kraj: z.kraj, liczbaWierszy: w.liczbaWierszy, pominiete: w.pominiete, zapisany: false };
    if (w.liczbaWierszy === 0) {
      wynik.bledy.push(`${z.nazwa}: brak wierszy do zapisania — poprzedni cennik zostaje bez zmian.`);
    } else {
      zapiszAtomowo(katalogPricelist, katalogArchiwum, z.nazwa, w.tekst, teraz);
      plik.zapisany = true;
      for (const [kraj, u] of Object.entries(wynik.kursy)) {
        if (z.kraj === null || z.kraj === kraj) zapiszUzytyKurs(db, { partnerId, kraj, kurs: u, plik: z.nazwa }, () => teraz);
      }
    }
    wynik.pliki.push(plik);
  }
  wynik.usunieteZArchiwum = wyczyscArchiwum(katalogArchiwum, teraz);
  return wynik;
}
