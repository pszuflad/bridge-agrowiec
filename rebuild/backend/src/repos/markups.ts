// Narzuty — tabela `markups` (`Bt` w zmangowanym oryginale).
//
// Port `U.listMarkups`/`addMarkup`/`updateMarkup`/`deleteMarkup`
// (`deminified/backend-index.cjs:44965-44987`).
//
// ⚠ KAŻDA MUTACJA PRZELICZA CENY CAŁEGO KATALOGU. To nie efekt uboczny, tylko sedno tej
// tabeli: reguła bez przeliczenia nic by nie zmieniła, dopóki nie przyszedłby import.
// Przeliczenie jest opakowane w `try/catch` — dokładnie jak `try { recalcPricesFromRules() }
// catch {}` w oryginale: nieudane przeliczenie NIE może wycofać zapisanej reguły.

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { markups } from "../db/schema.js";
import { przeliczCenyZRegul } from "./ceny.js";
import { odsiejPola } from "./pola-edytowalne.js";

export type Narzut = typeof markups.$inferSelect;

/**
 * Pola, które użytkownik może ustawić przez `POST` i `PATCH` — decyzja plan.md D3,
 * zamknięcie `docs/rebuild-backlog.md` #14 dla narzutów.
 *
 * Oryginał listy nie ma: `updateMarkup` robi `X.update(Bt).set(e)` z ciałem żądania
 * podanym wprost (`:48701`), więc dowolna kolumna była zapisywalna. Stawka jest tu WYŻSZA
 * niż przy dostawcach — po zapisie leci `recalcPricesFromRules()`, czyli pole wpuszczone
 * przez pomyłkę przelicza ceny całego katalogu.
 *
 * Lista pokrywa KOMPLET kolumn biznesowych tabeli, żeby widok `/narzuty` (sesja 4b) mógł
 * edytować regułę w całości. Poza nią zostają tylko trzy kolumny i wszystkie z powodu
 * tożsamości albo autorstwa:
 *  - `id` — tożsamość wiersza,
 *  - `zmienilUzytkownikId`, `zmienionoData` — ustawia SERWER z sesji i zegara; wpuszczenie
 *    ich pozwoliłoby podpisać cudzą zmianę.
 */
export const POLA_EDYTOWALNE_NARZUTU = [
  "typ",
  "zakres",
  "warunki",
  "nazwa",
  "wartosc",
  "jednostka",
  "priorytet",
  "status",
] as const satisfies readonly (keyof Narzut)[];

export type PoleNarzutu = (typeof POLA_EDYTOWALNE_NARZUTU)[number];

/** Ciało żądania po odsianiu — bez pól serwerowych, które trasa dokłada osobno. */
export type PatchNarzutu = Partial<Record<PoleNarzutu, unknown>>;

/** Pola ustawiane przez serwer, nie przez użytkownika. */
export type PodpisZmiany = { zmienilUzytkownikId: number | null; zmienionoData: string };

/** Odsiew ciała żądania przez listę pól edytowalnych. */
export function odsiejPolaNarzutu(cialo: unknown): PatchNarzutu {
  return odsiejPola(cialo, POLA_EDYTOWALNE_NARZUTU);
}

/** Pełna lista reguł — port `U.listMarkups` (`:44965`). Bez `ORDER BY`, jak oryginał. */
export function listaNarzutow(db: Baza): Narzut[] {
  return db.select().from(markups).all();
}

/** Jedna reguła po `id` — potrzebna trasie do rozstrzygnięcia 404. */
export function narzutPoId(db: Baza, id: number): Narzut | undefined {
  return db.select().from(markups).where(eq(markups.id, id)).get();
}

/** Dodanie reguły — port `U.addMarkup` (`:44968`). Zwraca wstawiony wiersz. */
export function dodajNarzut(db: Baza, dane: PatchNarzutu & PodpisZmiany): Narzut {
  const wiersz = db
    .insert(markups)
    .values(dane as typeof markups.$inferInsert)
    .returning()
    .get();
  przeliczPoCichu(db);
  return wiersz;
}

/**
 * Zmiana reguły — port `U.updateMarkup` (`:44975`).
 *
 * ⚠ Oryginał NIE sprawdza, czy wiersz istnieje: robi `UPDATE` w próżnię, przelicza ceny
 * i dopiero potem wybiera wiersz, żeby go zwrócić. Trasa rozpoznaje brak po `undefined`
 * i oddaje 404 — odtworzone dosłownie, razem z przeliczeniem, które leci także wtedy,
 * gdy nic się nie zmieniło.
 */
export function aktualizujNarzut(
  db: Baza,
  id: number,
  patch: PatchNarzutu & PodpisZmiany,
): Narzut | undefined {
  // Drizzle rzuca na `set({})`, a pusty patch po odsianiu jest realny (PATCH z samymi
  // polami spoza listy). Podpis zmiany jest zawsze obecny, więc `set` nigdy nie jest pusty.
  db.update(markups)
    .set(patch as Partial<typeof markups.$inferInsert>)
    .where(eq(markups.id, id))
    .run();
  przeliczPoCichu(db);
  return narzutPoId(db, id);
}

/** Kasowanie reguły — port `U.deleteMarkup` (`:44982`). Oryginał nie zgłasza braku wiersza. */
export function usunNarzut(db: Baza, id: number): void {
  db.delete(markups).where(eq(markups.id, id)).run();
  przeliczPoCichu(db);
}

/** `try { recalcPricesFromRules() } catch {}` — jedno miejsce zamiast czterech powtórzeń. */
function przeliczPoCichu(db: Baza): void {
  try {
    przeliczCenyZRegul(db);
  } catch {
    /* jak `catch {}` w oryginale — błąd przeliczenia nie cofa zapisanej reguły */
  }
}
