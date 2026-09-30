// Reguła uzupełniania pustych EAN-ów + tabela par `kod` ↔ EAN — ticket 168.
//
// ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT. Zasady (decyzje użytkownika z 2026-09-30):
//  • dotyczy WYŁĄCZNIE pustych `products.ean`;
//  • klucz pary to `products.kod`; EAN = 999 + licznik + cyfra kontrolna (`generator.ts`);
//  • prawdziwy EAN z cennika nadpisuje wygenerowany — para dostaje status `zastapiony`, a numer
//    zostaje zarezerwowany na zawsze;
//  • wygenerowany EAN nigdy nie trafia do drugiego produktu: UNIQUE(ean/numer/kod) w bazie
//    + pomijanie numerów, których EAN jest już w `products.ean`.

import { and, eq, isNotNull, ne, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { eanPary, products } from "../db/schema.js";
import { MAKS_NUMER, eanZNumeru, pustyEan } from "./generator.js";

export type ParaEan = typeof eanPary.$inferSelect;

export function znajdzParePoKodzie(db: Baza, kod: string): ParaEan | null {
  return db.select().from(eanPary).where(eq(eanPary.kod, kod)).get() ?? null;
}

export function znajdzParePoEanie(db: Baza, ean: string): ParaEan | null {
  return db.select().from(eanPary).where(eq(eanPary.ean, ean)).get() ?? null;
}

/** Czy EAN nosi już JAKIŚ produkt inny niż `poza` (kod). */
function eanZajetyWKatalogu(db: Baza, ean: string, poza: string): boolean {
  return (
    db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.ean, ean), ne(products.kod, poza)))
      .get() !== undefined
  );
}

function nastepnyNumer(db: Baza): number {
  const wiersz = db
    .select({ maks: sql<number | null>`max(${eanPary.numer})` })
    .from(eanPary)
    .get();
  return (wiersz?.maks ?? 0) + 1;
}

/** Kolejny numer, którego EAN nie istnieje w katalogu (np. prawdziwy kod zaczynający się od 999). */
function wolnyNumer(db: Baza, kod: string): number {
  let numer = nastepnyNumer(db);
  while (numer <= MAKS_NUMER) {
    if (!eanZajetyWKatalogu(db, eanZNumeru(numer), kod)) return numer;
    numer += 1;
  }
  throw new Error("Wyczerpano pulę EAN-ów z prefiksem 999.");
}

export type WynikPrzydzialu = { ean: string; utworzono: boolean };

/**
 * Zwraca EAN pary dla `kod`, tworząc ją, gdy jej nie ma. Idempotentne: ten sam `kod` dostaje
 * zawsze ten sam EAN (także po wyczyszczeniu katalogu i ponownym imporcie). Para o statusie
 * `zastapiony` wraca do `aktywny` (produkt znów nie ma EAN-u), o ile jej EAN nie zajął w
 * międzyczasie inny produkt — wtedy dostaje nowy numer.
 */
export function przydzielEan(
  db: Baza,
  o: { kod: string; dostawca?: string | null; kodDostawcy?: string | null },
): WynikPrzydzialu {
  return db.transaction((tx) => {
    const t = tx as unknown as Baza;
    const istniejaca = znajdzParePoKodzie(t, o.kod);
    if (istniejaca && !eanZajetyWKatalogu(t, istniejaca.ean, o.kod)) {
      if (istniejaca.status !== "aktywny") {
        t.update(eanPary)
          .set({ status: "aktywny", zastapiono: null, zastapionyPrzez: null })
          .where(eq(eanPary.id, istniejaca.id))
          .run();
      }
      return { ean: istniejaca.ean, utworzono: false };
    }

    const numer = wolnyNumer(t, o.kod);
    const ean = eanZNumeru(numer);
    const teraz = new Date().toISOString();
    if (istniejaca) {
      // EAN tej pary nosi teraz inny produkt — para dostaje nowy numer. Stary numer pozostaje
      // wykluczony z puli tak długo, jak ten produkt go nosi (`wolnyNumer` sprawdza `products.ean`).
      t.update(eanPary)
        .set({ ean, numer, status: "aktywny", zastapiono: null, zastapionyPrzez: null })
        .where(eq(eanPary.id, istniejaca.id))
        .run();
    } else {
      t.insert(eanPary)
        .values({
          kod: o.kod,
          ean,
          numer,
          dostawca: o.dostawca ?? null,
          kodDostawcy: o.kodDostawcy ?? null,
          status: "aktywny",
          utworzono: teraz,
        })
        .run();
    }
    return { ean, utworzono: true };
  });
}

/** Zaznacza parę jako zastąpioną prawdziwym EAN-em z importu. Zwraca, czy coś zmieniono. */
export function oznaczJakoZastapiona(db: Baza, kod: string, nowyEan: string): boolean {
  const para = znajdzParePoKodzie(db, kod);
  if (!para || para.status === "zastapiony" || para.ean === nowyEan) return false;
  db.update(eanPary)
    .set({ status: "zastapiony", zastapiono: new Date().toISOString(), zastapionyPrzez: nowyEan })
    .where(eq(eanPary.id, para.id))
    .run();
  return true;
}

/**
 * Wpięcie w zapis rekordu produktu (akceptacja stagingu, import bulk, `POST /api/products`) —
 * wołane tuż PRZED zapisem, w osobnym `try/catch` po stronie wołającego (błąd reguły nie
 * może zablokować zapisu). Pusty EAN dostaje wartość z pary; niepusty zostaje nietknięty,
 * a ewentualna para o innym EAN-ie dostaje status `zastapiony`.
 */
export function uzupelnijEanRekordu(
  db: Baza,
  rekord: Record<string, unknown>,
  istniejacy?: { ean?: unknown } | null,
): void {
  const kod = typeof rekord.kod === "string" ? rekord.kod : "";
  if (kod === "") return;

  // Produkt, który ma już EAN w katalogu, nigdy nie traci go na rzecz wygenerowanego — nawet gdy
  // zapis (np. `POST /api/products` bez klucza `ean`) go nie niesie. Reguła dotyczy pustych pól.
  if (pustyEan(rekord.ean) && !pustyEan(istniejacy?.ean)) {
    rekord.ean = String(istniejacy!.ean).trim();
    return;
  }

  if (pustyEan(rekord.ean)) {
    const { ean } = przydzielEan(db, {
      kod,
      dostawca: typeof rekord.dostawca === "string" ? rekord.dostawca : null,
      kodDostawcy: typeof rekord.kodDostawcy === "string" ? rekord.kodDostawcy : null,
    });
    rekord.ean = ean;
    rekord.eanRaw = ean;
    rekord.eanIsValid = 1;
    rekord.eanSourceStatus = "ok";
    rekord.eanCandidates = null;
  } else {
    oznaczJakoZastapiona(db, kod, String(rekord.ean).trim());
  }
}

export type WynikUzupelnienia = {
  dryRun: boolean;
  /** Produkty z pustym EAN, którym nadano (lub przywrócono) EAN. */
  uzupelniono: number;
  /** Pary, których EAN został zastąpiony prawdziwym z importu. */
  zastapiono: number;
};

/**
 * Uzupełnia puste EAN-y w CAŁYM katalogu i uzgadnia pary z `products.ean`. `dryRun` nic nie
 * zapisuje — liczy tylko, ile by się zmieniło (numery z próby nie są rezerwowane).
 */
export function uzupelnijKatalog(db: Baza, opcje: { dryRun?: boolean } = {}): WynikUzupelnienia {
  const dryRun = opcje.dryRun === true;

  const puste = db
    .select({ kod: products.kod, dostawca: products.dostawca, kodDostawcy: products.kodDostawcy })
    .from(products)
    .where(sql`${products.ean} IS NULL OR trim(${products.ean}) = ''`)
    .all();

  const doZastapienia = db
    .select({ kod: products.kod, ean: products.ean, status: eanPary.status, paraEan: eanPary.ean })
    .from(products)
    .innerJoin(eanPary, eq(eanPary.kod, products.kod))
    .where(and(isNotNull(products.ean), eq(eanPary.status, "aktywny")))
    .all()
    .filter((w) => !pustyEan(w.ean) && String(w.ean).trim() !== w.paraEan);

  if (dryRun) {
    return { dryRun, uzupelniono: puste.length, zastapiono: doZastapienia.length };
  }

  let zastapiono = 0;
  let uzupelniono = 0;
  db.transaction((tx) => {
    const t = tx as unknown as Baza;
    for (const w of doZastapienia) {
      if (oznaczJakoZastapiona(t, w.kod, String(w.ean).trim())) zastapiono += 1;
    }
    for (const p of puste) {
      const { ean } = przydzielEan(t, p);
      t.update(products)
        .set({ ean, eanRaw: ean, eanIsValid: 1, eanSourceStatus: "ok", eanCandidates: null })
        .where(eq(products.kod, p.kod))
        .run();
      uzupelniono += 1;
    }
  });
  return { dryRun, uzupelniono, zastapiono };
}
