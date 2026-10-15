// Reguły narzutów partnera — walidacja i CRUD (ticket 247). Mutacja NIE przelicza katalogu (ceny powstają przy generowaniu pliku).
import { and, asc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerNarzuty } from "../db/schema.js";
import { TYPY_WARUNKOW, warunkiReguly, type WarunekReguly } from "../partnerzy/reguly-narzutow.js";
import { normalizujKraj } from "./partnerzy.js";

export const STATUSY_REGUL = ["aktywny", "nieaktywny"] as const;

export type DaneReguly = { nazwa: string; wartosc: number; kraj: string | null; priorytet: number; status: (typeof STATUSY_REGUL)[number]; warunki: WarunekReguly[] };
type Blad = { blad: string };

const jestObiektem = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `czesciowe = true` (PATCH): tylko podane pola; `false` (POST): `nazwa` i `wartosc` wymagane, reszta domyślna. */
export function walidujRegule(cialo: unknown, czesciowe: boolean): Partial<DaneReguly> | Blad {
  if (!jestObiektem(cialo)) return { blad: "Ciało żądania musi być obiektem JSON." };
  const w: Partial<DaneReguly> = {};
  if ("nazwa" in cialo || !czesciowe) {
    const n = typeof cialo.nazwa === "string" ? cialo.nazwa.trim() : "";
    if (n === "" || n.length > 80) return { blad: "Pole `nazwa` jest wymagane (1–80 znaków)." };
    w.nazwa = n;
  }
  if ("wartosc" in cialo || !czesciowe) {
    const v = cialo.wartosc;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= -100 || v > 1000) return { blad: "Pole `wartosc` (narzut w % od ceny zakupu; 0 i wartości ujemne dozwolone) musi być liczbą > -100 i ≤ 1000." };
    w.wartosc = v;
  }
  if ("kraj" in cialo) {
    const k = cialo.kraj === null ? null : normalizujKraj(cialo.kraj);
    if (cialo.kraj !== null && k === null) return { blad: "Pole `kraj` musi być dwuliterowym kodem kraju albo null (wszystkie kraje)." };
    w.kraj = k;
  } else if (!czesciowe) w.kraj = null;
  if ("priorytet" in cialo) {
    if (!Number.isInteger(cialo.priorytet) || (cialo.priorytet as number) < 0 || (cialo.priorytet as number) > 1000) return { blad: "Pole `priorytet` musi być liczbą całkowitą 0–1000." };
    w.priorytet = cialo.priorytet as number;
  } else if (!czesciowe) w.priorytet = 50;
  if ("status" in cialo) {
    if (!(STATUSY_REGUL as readonly unknown[]).includes(cialo.status)) return { blad: "Pole `status` musi być `aktywny` albo `nieaktywny`." };
    w.status = cialo.status as DaneReguly["status"];
  } else if (!czesciowe) w.status = "aktywny";
  if ("warunki" in cialo) {
    if (!Array.isArray(cialo.warunki) || cialo.warunki.length > 10) return { blad: "Pole `warunki` musi być tablicą (do 10 warunków)." };
    const lista: WarunekReguly[] = [];
    for (const x of cialo.warunki) {
      if (!jestObiektem(x) || !(TYPY_WARUNKOW as readonly unknown[]).includes(x.typ) || typeof x.wartosc !== "string" || x.wartosc.trim() === "" || x.wartosc.length > 80)
        return { blad: `Każdy warunek to {typ: ${TYPY_WARUNKOW.join("|")}, wartosc: niepusty tekst do 80 znaków}.` };
      lista.push({ typ: x.typ as string, wartosc: x.wartosc.trim() });
    }
    w.warunki = lista;
  } else if (!czesciowe) w.warunki = [];
  return w;
}

const teraz = (): string => new Date().toISOString();
const wyjscie = (r: typeof partnerNarzuty.$inferSelect) => ({ ...r, warunki: warunkiReguly(r.warunki) });

export function listaRegul(db: Baza, partnerId: number) {
  return db.select().from(partnerNarzuty).where(eq(partnerNarzuty.partnerId, partnerId)).orderBy(asc(partnerNarzuty.id)).all().map(wyjscie);
}

export function dodajRegule(db: Baza, partnerId: number, d: DaneReguly) {
  const r = db.insert(partnerNarzuty).values({ partnerId, ...d, warunki: JSON.stringify(d.warunki), zmieniono: teraz() }).returning().get();
  return wyjscie(r);
}

export function edytujRegule(db: Baza, partnerId: number, id: number, zmiany: Partial<DaneReguly>) {
  const { warunki, ...reszta } = zmiany;
  const r = db
    .update(partnerNarzuty)
    .set({ ...reszta, ...(warunki ? { warunki: JSON.stringify(warunki) } : {}), zmieniono: teraz() })
    .where(and(eq(partnerNarzuty.partnerId, partnerId), eq(partnerNarzuty.id, id)))
    .returning()
    .get();
  return r ? wyjscie(r) : null;
}

export function usunRegule(db: Baza, partnerId: number, id: number): boolean {
  return db.delete(partnerNarzuty).where(and(eq(partnerNarzuty.partnerId, partnerId), eq(partnerNarzuty.id, id))).run().changes > 0;
}
