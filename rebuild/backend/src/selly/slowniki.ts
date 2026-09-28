/**
 * Cache słowników Selly w tabeli `selly_dict` — port `refreshDict`/`loadMaps`/`ensureDict`
 * (`mirror/backend/selly/routes.cjs:26-79`).
 *
 * Po co cache: mapowanie produktu na payload potrzebuje id-ków producenta, kategorii, stawki
 * VAT i magazynu, a Selly oddaje je wyłącznie po nazwie i maksymalnie 50 na zapytanie.
 * Bez cache każda synchronizacja dostawcy (1600 produktów) odpytywałaby cztery słowniki
 * w kółko.
 *
 * ⚠ ODŚWIEŻENIE JEST DESTRUKCYJNE I NIEATOMOWE — tak jak w oryginale. `refreshDict` kasuje
 * słownik (`DELETE`) i wstawia go od nowa, po jednym `INSERT ... ON CONFLICT` na wpis,
 * przeplatając to z czterema wywołaniami HTTP. Padnięcie sieci w połowie zostawia bazę
 * z częścią słowników odświeżoną, a częścią starą. Zostaje 1:1: to jedyna operacja, która
 * potrafi pobrać komplet, a jej wynik i tak jest nadpisywany przy następnym `force=1`.
 *
 * ⚠ KLUCZ TO NAZWA PO `toLowerCase()`, a `PRIMARY KEY (slownik, klucz)` jest wrażliwy na
 * kolizje: dwie kategorie różniące się w Selly tylko wielkością liter zapiszą się jako jeden
 * wiersz i wygra ta późniejsza. Zachowanie zastane — `mapper.ts` szuka tak samo, po nazwie
 * małymi literami.
 */

import { eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { sellyDict } from "../db/schema.js";
import type { KlientSelly } from "./klient.js";
import type { MapySelly } from "./mapper.js";

/** Limit narzucony przez Selly na zapytania listujące (`routes.cjs:37`). */
const LIMIT_STRONY = 50;

/**
 * Port `refreshDict` (`routes.cjs:26-61`). Cztery słowniki, każdy: pobierz → wyczyść → wstaw.
 *
 * VAT jest jedynym, którego klucz nie jest nazwą, tylko stawką jako napis (`String(v.rate)`),
 * a `wartosc_id` bierze `v.vat_id || 0` — bo Selly potrafi oddać stawkę bez własnego id.
 */
export async function odswiezSlowniki(db: Baza, klient: KlientSelly): Promise<void> {
  const teraz = new Date().toISOString();

  const wstaw = (
    slownik: string,
    klucz: string,
    wartoscId: number,
    surowy: unknown,
  ): void => {
    db.insert(sellyDict)
      .values({
        slownik,
        klucz,
        wartoscId,
        rawJson: JSON.stringify(surowy),
        odswiezono: teraz,
      })
      .onConflictDoUpdate({
        target: [sellyDict.slownik, sellyDict.klucz],
        set: {
          wartoscId: sql`excluded.wartosc_id`,
          rawJson: sql`excluded.raw_json`,
          odswiezono: sql`excluded.odswiezono`,
        },
      })
      .run();
  };

  const wyczysc = (slownik: string): void => {
    db.delete(sellyDict).where(eq(sellyDict.slownik, slownik)).run();
  };

  const producenci = await klient.listProducers({ limit: LIMIT_STRONY });
  wyczysc("producers");
  for (const p of producenci?.data ?? []) {
    wstaw("producers", (p.name ?? "").trim().toLowerCase(), p.producer_id, p);
  }

  const kategorie = await klient.listCategories({ limit: LIMIT_STRONY });
  wyczysc("categories");
  for (const c of kategorie?.data ?? []) {
    wstaw("categories", (c.name ?? "").trim().toLowerCase(), c.category_id, c);
  }

  const stawki = await klient.listVatRates();
  wyczysc("vat_rates");
  for (const v of stawki?.data ?? []) {
    wstaw("vat_rates", String(v.rate), v.vat_id || 0, v);
  }

  const magazyny = await klient.listWarehouses();
  wyczysc("warehouses");
  for (const w of magazyny?.data ?? []) {
    wstaw("warehouses", (w.name ?? "").trim().toLowerCase(), w.warehouse_id, w);
  }
}

/** Port `loadMaps` (`routes.cjs:63-73`) — cztery mapy `nazwa → id` z jednego SELECT-a. */
export function wczytajMapy(db: Baza): MapySelly {
  const wiersze = db
    .select({
      slownik: sellyDict.slownik,
      klucz: sellyDict.klucz,
      wartoscId: sellyDict.wartoscId,
    })
    .from(sellyDict)
    .all();

  const mapy: MapySelly = { producerMap: {}, catMap: {}, vatMap: {}, whMap: {} };
  for (const r of wiersze) {
    if (r.slownik === "producers") mapy.producerMap[r.klucz] = r.wartoscId;
    if (r.slownik === "categories") mapy.catMap[r.klucz] = r.wartoscId;
    if (r.slownik === "vat_rates") mapy.vatMap[r.klucz] = r.wartoscId;
    if (r.slownik === "warehouses") mapy.whMap[r.klucz] = r.wartoscId;
  }
  return mapy;
}

/**
 * Port `ensureDict` (`routes.cjs:75-79`): odśwież, gdy wymuszono ALBO gdy cache jest pusty;
 * w pozostałych przypadkach czytaj lokalnie. Nie ma tu żadnego wygasania po czasie —
 * raz zapełniony cache żyje aż do `?force=1`. Zastane zachowanie.
 */
export async function zapewnijSlowniki(
  db: Baza,
  klient: KlientSelly,
  wymus = false,
): Promise<MapySelly> {
  const licznik = db.select({ n: sql<number>`count(*)` }).from(sellyDict).get();
  if (wymus || (licznik?.n ?? 0) === 0) await odswiezSlowniki(db, klient);
  return wczytajMapy(db);
}
