// Promocje — tabela `promotions` (`hn` w zmangowanym oryginale).
//
// Port `U.listPromotions`/`addPromotion`/`updatePromotion`/`deletePromotion`
// (`deminified/backend-index.cjs:44988-45007`). Struktura bliźniacza do `markups.ts`;
// różnice są trzy i wszystkie są w oryginale, nie w naszym porcie:
//   • aktywny status to `"aktywna"` (rodzaj żeński), nie `"aktywny"`;
//   • zamiast `typ`/`zakres` promocja ma `zasieg` i dopasowuje się ODWROTNIE (patrz `ceny.ts`);
//   • trasa `PATCH` NIE MA sprawdzenia 404 (plan.md D5).

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { promotions } from "../db/schema.js";
import { przeliczCenyZRegul } from "./ceny.js";
import { statusZDat } from "../promocje/wygaszacz.js";
import { odsiejPola } from "./pola-edytowalne.js";
import type { PodpisZmiany } from "./markups.js";

export type Promocja = typeof promotions.$inferSelect;

/**
 * Pola edytowalne przez użytkownika — decyzja plan.md D3, zamknięcie backlogu #14
 * dla promocji. Uzasadnienie jak w `markups.ts`; poza listą zostają `id`,
 * `zmienilUzytkownikId` i `zmienionoData`.
 *
 * `start` i `koniec` są edytowalne i od 14f wreszcie coś robią: wygaszacz
 * (`promocje/wygaszacz.ts`) liczy z nich `status`.
 *
 * ⚠ `status` JEST ODCIĘTY OD TEJ LISTY (karta 14f, odstępstwo zatwierdzone przez Anię
 * 2026-09-18). Stał się polem WYLICZANYM z dat, więc ręczny zapis przez API i tak zostałby
 * nadpisany przy najbliższym przebiegu wygaszacza — przyjmowanie go udawałoby, że da się go
 * ustawić. Skutek uboczny: rada z instrukcji I4 („żeby wyłączyć promocję, zmień status")
 * przestaje obowiązywać; prostuje to karta 14m.
 */
export const POLA_EDYTOWALNE_PROMOCJI = [
  "nazwa",
  "rabatPct",
  "zasieg",
  "warunki",
  "priorytet",
  "start",
  "koniec",
] as const satisfies readonly (keyof Promocja)[];

export type PolePromocji = (typeof POLA_EDYTOWALNE_PROMOCJI)[number];

/** Ciało żądania po odsianiu — bez pól serwerowych, które trasa dokłada osobno. */
export type PatchPromocji = Partial<Record<PolePromocji, unknown>>;

/** Odsiew ciała żądania przez listę pól edytowalnych. */
export function odsiejPolaPromocji(cialo: unknown): PatchPromocji {
  return odsiejPola(cialo, POLA_EDYTOWALNE_PROMOCJI);
}

/** Pełna lista promocji — port `U.listPromotions` (`:44988`). Bez `ORDER BY`, jak oryginał. */
export function listaPromocji(db: Baza): Promocja[] {
  return db.select().from(promotions).all();
}

/** Jedna promocja po `id`. */
export function promocjaPoId(db: Baza, id: number): Promocja | undefined {
  return db.select().from(promotions).where(eq(promotions.id, id)).get();
}

/**
 * Dodanie promocji — port `U.addPromotion` (`:44991`).
 *
 * ⚠ `status` LICZY SERWER, z dat (karta 14f). To NIE jest kosmetyka, tylko domknięcie pułapki:
 * po odcięciu `status` od `POLA_EDYTOWALNE_PROMOCJI` ciało żądania go nie niesie, a kolumna ma
 * `DEFAULT 'aktywna'` (`db/schema.ts`). Bez tej linii promocja założona z datą startu
 * w PRZYSZŁOŚCI dostałaby `aktywna` i NATYCHMIAST zaczęłaby obniżać ceny — naprawiając jeden
 * defekt, wprowadzilibyśmy gorszy. Wartość z ciała żądania jest tu bez znaczenia (i tak
 * została odsiana); jedynym źródłem prawdy są daty.
 *
 * Zbieżne z oryginałem w wyniku, choć nie w miejscu: tam status z dat liczy FRONT przy
 * tworzeniu (`Cb()`), tu robi to serwer — i dzięki temu liczy go tak samo dla każdego klienta.
 */
export function dodajPromocje(db: Baza, dane: PatchPromocji & PodpisZmiany): Promocja {
  const wiersz = db
    .insert(promotions)
    .values({
      ...dane,
      status: statusZDat(String(dane.start ?? ""), String(dane.koniec ?? "")),
    } as typeof promotions.$inferInsert)
    .returning()
    .get();
  przeliczPoCichu(db);
  return wiersz;
}

/**
 * Zmiana promocji — port `U.updatePromotion` (`:44998`). Jak przy narzucie: `UPDATE`
 * bez sprawdzania istnienia, przeliczenie, dopiero potem odczyt wiersza.
 *
 * ⚠ `status` po zmianie dat prostuje się SAM i nie trzeba go tu liczyć: `przeliczPoCichu`
 * woła `przeliczCenyZRegul`, a ta zamiata statusy na wejściu (karta 14f). Kolejność
 * `UPDATE → przeliczenie → odczyt` jest portem oryginału, ale ma teraz drugi skutek —
 * zwracany wiersz jest już po zamieceniu, więc odpowiedź niesie status zgodny z datami.
 */
export function aktualizujPromocje(
  db: Baza,
  id: number,
  patch: PatchPromocji & PodpisZmiany,
): Promocja | undefined {
  db.update(promotions)
    .set(patch as Partial<typeof promotions.$inferInsert>)
    .where(eq(promotions.id, id))
    .run();
  przeliczPoCichu(db);
  return promocjaPoId(db, id);
}

/** Kasowanie promocji — port `U.deletePromotion` (`:45003`). */
export function usunPromocje(db: Baza, id: number): void {
  db.delete(promotions).where(eq(promotions.id, id)).run();
  przeliczPoCichu(db);
}

/** `try { recalcPricesFromRules() } catch {}` — jak w oryginale. */
function przeliczPoCichu(db: Baza): void {
  try {
    przeliczCenyZRegul(db);
  } catch {
    /* jak `catch {}` w oryginale */
  }
}
