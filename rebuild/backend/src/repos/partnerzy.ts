// Partnerzy B2B — odczyt i zapis ustawień (karta PARTNERZY, ticket 209 / PRT-1.3). Tylko dane i walidacja;
// kalkulator ceny, kurs NBP i generator plików to osobne tickety. Model: migracja 024, `db/schema.ts`.
import { and, asc, eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import {
  partnerKolumny,
  partnerKraje,
  partnerMagazyny,
  partnerPolaObliczeniowe,
  partnerWykluczenia,
  partnerzy,
  products,
} from "../db/schema.js";

export const ZAOKRAGLANIA = ["grosz", "euro", "gora5", "gora10"] as const;
export const FORMATY_PLIKU = ["csv", "xml"] as const;
export const SEPARATORY_CSV = [";", ",", "\t", "|"] as const;
export const ZRODLA_KURSU = ["nbp", "reczny"] as const;

export type BladWalidacji = { blad: string };
export type UstawieniaPartnera = {
  nazwa: string;
  stanMin: number;
  zaokraglanie: (typeof ZAOKRAGLANIA)[number];
  harmonogramMinuty: number | null;
  tolerancjaCenyProc: number | null;
  formatPliku: (typeof FORMATY_PLIKU)[number];
  csvSeparator: (typeof SEPARATORY_CSV)[number];
  kanalFtp: boolean;
  kanalEmail: boolean;
  emailSkrzynka: string | null;
};
export type UstawieniaKraju = {
  narzutProc: number;
  kursZrodlo: (typeof ZRODLA_KURSU)[number];
  kursReczny: number | null;
  kosztyDodatkowe: number;
};

const jestObiektem = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const liczbaSkonczona = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const wSpisie = <T extends readonly string[]>(spis: T, v: unknown): v is T[number] =>
  typeof v === "string" && (spis as readonly string[]).includes(v);

/** Znormalizowany kod kraju (ISO-3166 alfa-2, wielkie litery) albo `null`. */
export function normalizujKraj(v: unknown): string | null {
  const k = typeof v === "string" ? v.trim().toUpperCase() : "";
  return /^[A-Z]{2}$/.test(k) ? k : null;
}

/**
 * Waliduje ustawienia partnera. `czesciowe = true` (edycja): pola nieobecne w ciele zostają bez zmian i nie trafiają
 * do wyniku; `false` (dodanie): wymagana jest `nazwa`, reszta może zostać domyślna (wartości z migracji 024).
 */
export function walidujUstawieniaPartnera(
  cialo: unknown,
  czesciowe: boolean,
): Partial<UstawieniaPartnera> | BladWalidacji {
  if (!jestObiektem(cialo)) return { blad: "Ciało żądania musi być obiektem JSON." };
  const w: Partial<UstawieniaPartnera> = {};
  if ("nazwa" in cialo || !czesciowe) {
    const nazwa = typeof cialo.nazwa === "string" ? cialo.nazwa.trim() : "";
    if (nazwa === "" || nazwa.length > 80) return { blad: "Pole `nazwa` jest wymagane (1–80 znaków)." };
    w.nazwa = nazwa;
  }
  if ("stanMin" in cialo) {
    if (!Number.isInteger(cialo.stanMin) || (cialo.stanMin as number) < 0)
      return { blad: "Pole `stanMin` musi być liczbą całkowitą ≥ 0." };
    w.stanMin = cialo.stanMin as number;
  }
  if ("zaokraglanie" in cialo) {
    if (!wSpisie(ZAOKRAGLANIA, cialo.zaokraglanie))
      return { blad: `Pole \`zaokraglanie\` musi być jednym z: ${ZAOKRAGLANIA.join(", ")}.` };
    w.zaokraglanie = cialo.zaokraglanie;
  }
  if ("harmonogramMinuty" in cialo) {
    const h = cialo.harmonogramMinuty;
    if (h !== null && (!Number.isInteger(h) || (h as number) < 1))
      return { blad: "Pole `harmonogramMinuty` musi być liczbą całkowitą ≥ 1 albo null." };
    w.harmonogramMinuty = h as number | null;
  }
  if ("tolerancjaCenyProc" in cialo) {
    const t = cialo.tolerancjaCenyProc;
    if (t !== null && (!liczbaSkonczona(t) || t < 0)) return { blad: "Pole `tolerancjaCenyProc` musi być liczbą ≥ 0 albo null." };
    w.tolerancjaCenyProc = t as number | null;
  }
  if ("formatPliku" in cialo) {
    if (!wSpisie(FORMATY_PLIKU, cialo.formatPliku))
      return { blad: `Pole \`formatPliku\` musi być jednym z: ${FORMATY_PLIKU.join(", ")}.` };
    w.formatPliku = cialo.formatPliku;
  }
  if ("csvSeparator" in cialo) {
    if (!wSpisie(SEPARATORY_CSV, cialo.csvSeparator)) return { blad: "Pole `csvSeparator` musi być jednym ze znaków: ; , tabulator |." };
    w.csvSeparator = cialo.csvSeparator;
  }
  for (const pole of ["kanalFtp", "kanalEmail"] as const) {
    if (pole in cialo) {
      if (typeof cialo[pole] !== "boolean") return { blad: `Pole \`${pole}\` musi być wartością logiczną.` };
      w[pole] = cialo[pole] as boolean;
    }
  }
  if ("emailSkrzynka" in cialo) {
    const e = cialo.emailSkrzynka;
    if (e !== null && (typeof e !== "string" || e.trim() === "" || e.length > 200))
      return { blad: "Pole `emailSkrzynka` musi być niepustym tekstem albo null." };
    w.emailSkrzynka = e === null ? null : (e as string).trim();
  }
  return w;
}

/** Waliduje ustawienia kraju partnera (pełny komplet pól; brakujące dostają wartości domyślne). */
export function walidujUstawieniaKraju(cialo: unknown): UstawieniaKraju | BladWalidacji {
  if (!jestObiektem(cialo)) return { blad: "Ciało żądania musi być obiektem JSON." };
  const narzutProc = cialo.narzutProc ?? 0;
  if (!liczbaSkonczona(narzutProc) || narzutProc < 0) return { blad: "Pole `narzutProc` musi być liczbą ≥ 0." };
  const kursZrodlo = cialo.kursZrodlo ?? "nbp";
  if (!wSpisie(ZRODLA_KURSU, kursZrodlo)) return { blad: "Pole `kursZrodlo` musi mieć wartość `nbp` albo `reczny`." };
  const kursReczny = cialo.kursReczny ?? null;
  if (kursZrodlo === "reczny" && !(liczbaSkonczona(kursReczny) && kursReczny > 0))
    return { blad: "Kurs ręczny wymaga `kursReczny` > 0." };
  if (kursReczny !== null && !liczbaSkonczona(kursReczny)) return { blad: "Pole `kursReczny` musi być liczbą albo null." };
  const kosztyDodatkowe = cialo.kosztyDodatkowe ?? 0;
  if (!liczbaSkonczona(kosztyDodatkowe) || kosztyDodatkowe < 0) return { blad: "Pole `kosztyDodatkowe` musi być liczbą ≥ 0." };
  return {
    narzutProc,
    kursZrodlo,
    kursReczny: kursZrodlo === "reczny" ? (kursReczny as number) : null,
    kosztyDodatkowe,
  };
}

/** Lista niepustych, unikalnych tekstów (magazyny, kody produktów) albo błąd. */
export function walidujListeTekstow(v: unknown, pole: string): string[] | BladWalidacji {
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || x.trim() === ""))
    return { blad: `Pole \`${pole}\` musi być tablicą niepustych tekstów.` };
  return [...new Set((v as string[]).map((x) => x.trim()))];
}

export const czyBlad = (v: unknown): v is BladWalidacji => jestObiektem(v) && "blad" in v && typeof v.blad === "string";

const teraz = (): string => new Date().toISOString();

/** Magazyny widoczne w katalogu (`products.magazyn`) z liczbą aktywnych pozycji — do wyboru w panelu partnera. */
export function dostepneMagazyny(db: Baza): { magazyn: string; liczbaPozycji: number }[] {
  return db
    .select({ magazyn: products.magazyn, liczbaPozycji: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.status, "aktywny"))
    .groupBy(products.magazyn)
    .orderBy(asc(products.magazyn))
    .all()
    .map((w) => ({ magazyn: w.magazyn, liczbaPozycji: Number(w.liczbaPozycji) }));
}

export function listaPartnerow(db: Baza) {
  const wiersze = db.select().from(partnerzy).orderBy(asc(partnerzy.nazwa)).all();
  const policz = (tabela: typeof partnerMagazyny | typeof partnerWykluczenia | typeof partnerKraje, id: number): number =>
    Number(
      db
        .select({ n: sql<number>`count(*)` })
        .from(tabela)
        .where(eq(tabela.partnerId, id))
        .get()?.n ?? 0,
    );
  return wiersze.map((p) => ({
    ...p,
    liczbaMagazynow: policz(partnerMagazyny, p.id),
    liczbaWykluczen: policz(partnerWykluczenia, p.id),
    liczbaKrajow: policz(partnerKraje, p.id),
  }));
}

export function szczegolyPartnera(db: Baza, id: number) {
  const partner = db.select().from(partnerzy).where(eq(partnerzy.id, id)).get();
  if (!partner) return null;
  return {
    ...partner,
    magazyny: db.select().from(partnerMagazyny).where(eq(partnerMagazyny.partnerId, id)).orderBy(asc(partnerMagazyny.magazyn)).all().map((m) => m.magazyn),
    wykluczenia: db.select().from(partnerWykluczenia).where(eq(partnerWykluczenia.partnerId, id)).orderBy(asc(partnerWykluczenia.produktKod)).all().map((w) => w.produktKod),
    kraje: db.select().from(partnerKraje).where(eq(partnerKraje.partnerId, id)).orderBy(asc(partnerKraje.kraj)).all(),
    kolumny: db.select().from(partnerKolumny).where(eq(partnerKolumny.partnerId, id)).orderBy(asc(partnerKolumny.pozycja)).all(),
    polaObliczeniowe: db.select().from(partnerPolaObliczeniowe).where(eq(partnerPolaObliczeniowe.partnerId, id)).orderBy(asc(partnerPolaObliczeniowe.nazwa)).all(),
  };
}

/** Dodaje partnera (nieaktywnego). Zwraca `null`, gdy nazwa jest już zajęta. */
export function dodajPartnera(db: Baza, ustawienia: Partial<UstawieniaPartnera> & { nazwa: string }): number | null {
  if (db.select({ id: partnerzy.id }).from(partnerzy).where(eq(partnerzy.nazwa, ustawienia.nazwa)).get()) return null;
  const t = teraz();
  return db.insert(partnerzy).values({ ...ustawienia, utworzono: t, zmieniono: t }).returning({ id: partnerzy.id }).get().id;
}

/** Edytuje ustawienia partnera. `"brak"` – nie ma takiego id, `"nazwa-zajeta"` – nazwa należy do innego partnera. */
export function edytujPartnera(db: Baza, id: number, zmiany: Partial<UstawieniaPartnera>): "ok" | "brak" | "nazwa-zajeta" {
  if (!db.select({ id: partnerzy.id }).from(partnerzy).where(eq(partnerzy.id, id)).get()) return "brak";
  if (zmiany.nazwa !== undefined) {
    const inny = db.select({ id: partnerzy.id }).from(partnerzy).where(eq(partnerzy.nazwa, zmiany.nazwa)).get();
    if (inny && inny.id !== id) return "nazwa-zajeta";
  }
  db.update(partnerzy).set({ ...zmiany, zmieniono: teraz() }).where(eq(partnerzy.id, id)).run();
  return "ok";
}

export function ustawAktywnosc(db: Baza, id: number, aktywny: boolean): boolean {
  const r = db.update(partnerzy).set({ aktywny, zmieniono: teraz() }).where(eq(partnerzy.id, id)).run();
  return r.changes > 0;
}

/** Zastępuje cały zestaw magazynów partnera (w jednej transakcji). */
export function ustawMagazyny(db: Baza, id: number, magazyny: string[]): void {
  db.transaction((tx) => {
    tx.delete(partnerMagazyny).where(eq(partnerMagazyny.partnerId, id)).run();
    if (magazyny.length) tx.insert(partnerMagazyny).values(magazyny.map((magazyn) => ({ partnerId: id, magazyn }))).run();
    tx.update(partnerzy).set({ zmieniono: teraz() }).where(eq(partnerzy.id, id)).run();
  });
}

/** Zastępuje cały zestaw wykluczonych produktów (po `products.kod`). */
export function ustawWykluczenia(db: Baza, id: number, kody: string[]): void {
  db.transaction((tx) => {
    tx.delete(partnerWykluczenia).where(eq(partnerWykluczenia.partnerId, id)).run();
    if (kody.length) tx.insert(partnerWykluczenia).values(kody.map((produktKod) => ({ partnerId: id, produktKod }))).run();
    tx.update(partnerzy).set({ zmieniono: teraz() }).where(eq(partnerzy.id, id)).run();
  });
}

/** Dodaje albo nadpisuje ustawienia kraju partnera. */
export function ustawKraj(db: Baza, id: number, kraj: string, u: UstawieniaKraju): void {
  db.transaction((tx) => {
    tx.insert(partnerKraje)
      .values({ partnerId: id, kraj, ...u })
      .onConflictDoUpdate({ target: [partnerKraje.partnerId, partnerKraje.kraj], set: u })
      .run();
    tx.update(partnerzy).set({ zmieniono: teraz() }).where(eq(partnerzy.id, id)).run();
  });
}

export function usunKraj(db: Baza, id: number, kraj: string): boolean {
  const r = db.delete(partnerKraje).where(and(eq(partnerKraje.partnerId, id), eq(partnerKraje.kraj, kraj))).run();
  if (r.changes > 0) db.update(partnerzy).set({ zmieniono: teraz() }).where(eq(partnerzy.id, id)).run();
  return r.changes > 0;
}
