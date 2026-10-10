// Logi operacji modułu partnerów (karta PARTNERZY, ticket 219 / PRT-4.2).
//
// `partner_logi` – jedna linia na operację (np. „Wygenerowano 1 plik: tyreworld.csv (3000 pozycji)”); `partner_error_log` – szczegóły błędów
// i ostrzeżeń osobno. Retencja 30 dni (`wyczyscLogi`, wołane przy zapisie wyniku generowania).

import { and, desc, eq, lt } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerErrorLog, partnerLogi } from "../db/schema.js";
import type { WynikGenerowania } from "./generator.js";

export const RETENCJA_LOGOW_DNI = 30;
/** Ile pojedynczych błędów jednego przebiegu trafia do error_log; reszta jest podsumowana jedną linią (żeby tysiąc braków wag nie zalał logu). */
export const MAKS_BLEDOW_NA_PRZEBIEG = 200;

export function zapiszOperacje(db: Baza, partnerId: number, operacja: string, opis: string, liczbaPozycji: number | null, teraz: Date = new Date()): void {
  db.insert(partnerLogi).values({ partnerId, kiedy: teraz.toISOString(), operacja, opis, liczbaPozycji }).run();
}

export function zapiszBlad(db: Baza, partnerId: number, operacja: string, komunikat: string, poziom: "blad" | "ostrzezenie" = "blad", teraz: Date = new Date()): void {
  db.insert(partnerErrorLog).values({ partnerId, kiedy: teraz.toISOString(), operacja, poziom, komunikat }).run();
}

/** Usuwa wpisy starsze niż retencja. Zwraca łączną liczbę usuniętych. */
export function wyczyscLogi(db: Baza, teraz: Date = new Date(), dni = RETENCJA_LOGOW_DNI): number {
  const granica = new Date(teraz.getTime() - dni * 86_400_000).toISOString();
  const a = db.delete(partnerLogi).where(lt(partnerLogi.kiedy, granica)).run().changes;
  const b = db.delete(partnerErrorLog).where(lt(partnerErrorLog.kiedy, granica)).run().changes;
  return a + b;
}

const odmianaPlik = (n: number): string => (n === 1 ? "plik" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "pliki" : "plików");

/** Zapisuje wynik generowania: jedna linia operacji + błędy i ostrzeżenia w error_log; czyści stare wpisy. */
export function zapiszWynikGenerowania(db: Baza, partnerId: number, wynik: WynikGenerowania, teraz: Date = new Date()): void {
  const zapisane = wynik.pliki.filter((p) => p.zapisany);
  const opis =
    zapisane.length > 0
      ? `Wygenerowano ${zapisane.length} ${odmianaPlik(zapisane.length)}: ${zapisane.map((p) => `${p.nazwa} (${p.liczbaWierszy} pozycji)`).join(", ")}` +
        `${wynik.bledy.length ? `; błędów: ${wynik.bledy.length}` : ""}${wynik.ostrzezenia.length ? `; ostrzeżeń: ${wynik.ostrzezenia.length}` : ""}`
      : `Generowanie nie zapisało żadnego pliku (błędów: ${wynik.bledy.length})`;
  // jedna transakcja na jednym połączeniu SQLite — wszystkie wpisy albo żadne
  db.$client.transaction(() => {
    zapiszOperacje(db, partnerId, "generowanie", opis, zapisane.reduce((s, p) => s + p.liczbaWierszy, 0), teraz);
    for (const b of wynik.bledy.slice(0, MAKS_BLEDOW_NA_PRZEBIEG)) zapiszBlad(db, partnerId, "generowanie", b, "blad", teraz);
    if (wynik.bledy.length > MAKS_BLEDOW_NA_PRZEBIEG)
      zapiszBlad(db, partnerId, "generowanie", `… i ${wynik.bledy.length - MAKS_BLEDOW_NA_PRZEBIEG} kolejnych błędów (pominięto w logu).`, "blad", teraz);
    for (const o of wynik.ostrzezenia.slice(0, MAKS_BLEDOW_NA_PRZEBIEG)) zapiszBlad(db, partnerId, "generowanie", o, "ostrzezenie", teraz);
    wyczyscLogi(db, teraz);
  })();
}

export function pobierzLogi(db: Baza, partnerId: number, limit = 100, offset = 0) {
  return db.select().from(partnerLogi).where(eq(partnerLogi.partnerId, partnerId)).orderBy(desc(partnerLogi.id)).limit(limit).offset(offset).all();
}

export function pobierzBledy(db: Baza, partnerId: number, limit = 100, offset = 0, poziom?: "blad" | "ostrzezenie") {
  const warunek = poziom ? and(eq(partnerErrorLog.partnerId, partnerId), eq(partnerErrorLog.poziom, poziom)) : eq(partnerErrorLog.partnerId, partnerId);
  return db.select().from(partnerErrorLog).where(warunek).orderBy(desc(partnerErrorLog.id)).limit(limit).offset(offset).all();
}
