/**
 * Lokalne odczyty i zapisy integracji Selly — port części `mirror/backend/selly/routes.cjs`,
 * która NIE wychodzi po HTTP: status mapowania, dziennik operacji, tabela `selly_products`.
 *
 * Wyjątkiem jest `synchronizujJedenProdukt`, które orkiestruje wywołania klienta i zapis
 * lokalny naraz — tak jak `syncOneProduct` w oryginale (`routes.cjs:394-425`).
 */

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { products, sellyProducts, sellySyncLog } from "../db/schema.js";
import type { KlientSelly } from "../selly/klient.js";
import type { PayloadSelly } from "../selly/mapper.js";
import type { ProduktWewnetrzny } from "./products.js";

/** Wiersz `GET /api/selly/status` — kształt z `contract/fixtures/GET_selly_status.json`. */
export type StatusDostawcy = {
  dostawca: string;
  w_bridge: number;
  w_selly: number;
  z_bledami: number;
};

/**
 * Port zapytania ze `status` (`routes.cjs:255-276`). Liczy TYLKO produkty aktywne,
 * `LEFT JOIN` po `kod` (nie po id), grupowanie per dostawca.
 *
 * ⚠ Klucze wyniku są `snake_case` — `w_bridge`, `w_selly`, `z_bledami` — bo tak wychodzą
 * z SQL-a prosto do JSON-a i tak są zamrożone w fixture. To NIE jest miejsce na camelCase.
 *
 * Wariant bez filtra ma `ORDER BY p.dostawca`, wariant z filtrem go nie ma (jedna grupa),
 * i tak zostaje.
 */
export function statusSelly(db: Baza, dostawca?: string): StatusDostawcy[] {
  const kolumny = {
    dostawca: products.dostawca,
    w_bridge: sql<number>`count(*)`,
    w_selly: sql<number>`sum(case when ${sellyProducts.id} is not null then 1 else 0 end)`,
    z_bledami: sql<number>`sum(case when ${sellyProducts.ostatniStatus} = 'error' then 1 else 0 end)`,
  };

  const zapytanie = db
    .select(kolumny)
    .from(products)
    .leftJoin(sellyProducts, eq(sellyProducts.bridgeKod, products.kod));

  if (dostawca !== undefined) {
    return zapytanie
      .where(and(eq(products.dostawca, dostawca), eq(products.status, "aktywny")))
      .groupBy(products.dostawca)
      .all();
  }

  return zapytanie
    .where(eq(products.status, "aktywny"))
    .groupBy(products.dostawca)
    .orderBy(products.dostawca)
    .all();
}

/**
 * Wiersz dziennika w kształcie, w jakim oddaje go API.
 *
 * ⚠ KLUCZE SĄ `snake_case`, i to jest wymóg kontraktu, nie stylistyka. Oryginał robi
 * `SELECT * FROM selly_sync_log` przez better-sqlite3, więc do JSON-a idą nazwy KOLUMN
 * (`dostawca_kod`, `liczba_ok`, `szczegoly_json`, `uzytkownik_id`, `uzytkownik_imie`) —
 * dokładnie tak są zamrożone w `contract/fixtures/GET_selly_log.json`. Drizzle `select()`
 * bez jawnej projekcji oddałby nazwy PÓL modelu (`dostawcaKod`, `liczbaOk`…) i rozjechałby
 * fixture na siedmiu kluczach naraz. Stąd projekcja niżej — nie skracać jej do `select()`.
 */
export type WpisLoguSelly = {
  id: number;
  operacja: string;
  dostawca_kod: string | null;
  liczba_ok: number;
  liczba_blad: number;
  liczba_skip: number;
  szczegoly_json: string | null;
  uzytkownik_id: number | null;
  uzytkownik_imie: string | null;
  rozpoczeto: string;
  zakonczono: string | null;
  status: string;
};

/** Projekcja `snake_case` — patrz nota przy `WpisLoguSelly`. */
const KOLUMNY_LOGU = {
  id: sellySyncLog.id,
  operacja: sellySyncLog.operacja,
  dostawca_kod: sellySyncLog.dostawcaKod,
  liczba_ok: sellySyncLog.liczbaOk,
  liczba_blad: sellySyncLog.liczbaBlad,
  liczba_skip: sellySyncLog.liczbaSkip,
  szczegoly_json: sellySyncLog.szczegolyJson,
  uzytkownik_id: sellySyncLog.uzytkownikId,
  uzytkownik_imie: sellySyncLog.uzytkownikImie,
  rozpoczeto: sellySyncLog.rozpoczeto,
  zakonczono: sellySyncLog.zakonczono,
  status: sellySyncLog.status,
};

/** Górna granica `?limit` (`routes.cjs:285`) — większa wartość jest ścinana, nie odrzucana. */
export const MAKS_LIMIT_LOGU = 200;
/** Domyślny `?limit`, gdy parametru nie ma albo nie jest liczbą (`routes.cjs:285`). */
export const DOMYSLNY_LIMIT_LOGU = 20;

/**
 * Port `log` (`routes.cjs:283-293`): `SELECT * FROM selly_sync_log ORDER BY rozpoczeto DESC`.
 *
 * ⚠ Sortowanie po `rozpoczeto`, nie po `id`. Kolumna jest tekstem w formacie
 * `datetime('now')` (`2026-07-06 07:43:36`), więc porządek leksykograficzny pokrywa się
 * z chronologicznym — ale przy dwóch wpisach z tej samej sekundy kolejność jest
 * nieokreślona. Tak jest w produkcji i tak zostaje.
 */
export function logSelly(db: Baza, limit: number = DOMYSLNY_LIMIT_LOGU): WpisLoguSelly[] {
  return db
    .select(KOLUMNY_LOGU)
    .from(sellySyncLog)
    .orderBy(desc(sellySyncLog.rozpoczeto))
    .limit(limit)
    .all();
}

/** Wynik pojedynczej synchronizacji — kształt odpowiedzi `POST /api/selly/sync-product`. */
export type WynikSynchronizacjiProduktu = {
  action: "created" | "updated";
  kod: string;
  selly_product_id: number;
};

/**
 * Port `syncOneProduct` (`routes.cjs:394-425`). Dwie ścieżki: produkt znany w
 * `selly_products` → UPDATE w Selly, nieznany → CREATE i zapis mapowania.
 *
 * ⚠ Błąd `setProductMultiCat` jest POŁYKANY (`.catch` z samym `console.warn`) — w obu
 * ścieżkach. To znaczy, że produkt uchodzi za zsynchronizowany nawet wtedy, gdy kategorie
 * dodatkowe nie doszły. Zachowanie zastane, odtworzone celowo: inaczej nieudany `multi_cat`
 * wywracałby całą synchronizację dostawcy.
 *
 * ⚠ Brak `product_id` w odpowiedzi Selly przy tworzeniu rzuca — i to jest właściwe, bo bez
 * niego nie da się zapisać mapowania, a produkt w Selly już istnieje.
 */
export async function synchronizujJedenProdukt(
  db: Baza,
  klient: KlientSelly,
  produkt: ProduktWewnetrzny,
  payload: PayloadSelly,
): Promise<WynikSynchronizacjiProduktu> {
  const istniejacy = db
    .select()
    .from(sellyProducts)
    .where(eq(sellyProducts.bridgeKod, produkt.kod))
    .get();

  const stan = Number(produkt.stan) || 0;

  if (istniejacy) {
    await klient.updateProduct(istniejacy.sellyProductId, payload);
    await klient.upsertProductWarehouse(istniejacy.sellyProductId, {
      warehouse_id: payload.warehouse_id,
      quantity: stan,
    });
    if (payload._extra_cat_ids.length > 0) {
      await klient
        .setProductMultiCat(istniejacy.sellyProductId, payload._extra_cat_ids)
        .catch((e: unknown) =>
          console.warn(
            `[Selly] multi_cat update ${produkt.kod}:`,
            e instanceof Error ? e.message : e,
          ),
        );
    }

    db.update(sellyProducts)
      .set({
        ostatniaSync: sql`datetime('now')`,
        ostatniStatus: "ok",
        ostatniBlad: null,
        sellyCategoryId: payload.category_id,
        sellyProducerId: payload.producer_id ?? null,
        cenaSprzedazyWyslana: payload.price,
        cenaZakupuWyslana: payload.price_purchase,
        stanWyslany: produkt.stan,
      })
      .where(eq(sellyProducts.id, istniejacy.id))
      .run();

    return { action: "updated", kod: produkt.kod, selly_product_id: istniejacy.sellyProductId };
  }

  const utworzony = await klient.createProduct(payload);
  const productId = utworzony?.data?.product_id;
  if (!productId) {
    throw new Error(
      "Brak product_id w odpowiedzi Selly: " + JSON.stringify(utworzony).slice(0, 200),
    );
  }

  await klient.upsertProductWarehouse(productId, {
    warehouse_id: payload.warehouse_id,
    quantity: stan,
  });
  if (payload._extra_cat_ids.length > 0) {
    await klient
      .setProductMultiCat(productId, payload._extra_cat_ids)
      .catch((e: unknown) =>
        console.warn(
          `[Selly] multi_cat create ${produkt.kod}:`,
          e instanceof Error ? e.message : e,
        ),
      );
  }

  db.insert(sellyProducts)
    .values({
      bridgeKod: produkt.kod,
      sellyProductId: productId,
      sellyCategoryId: payload.category_id,
      sellyProducerId: payload.producer_id ?? null,
      cenaSprzedazyWyslana: payload.price,
      cenaZakupuWyslana: payload.price_purchase,
      stanWyslany: produkt.stan,
      ostatniaSync: sql`datetime('now')` as unknown as string,
      ostatniStatus: "ok",
    })
    .run();

  return { action: "created", kod: produkt.kod, selly_product_id: productId };
}

/** Produkt po kodzie — pełny wiersz tabeli (payload potrzebuje wszystkich kolumn). */
export function produktPoKodzie(db: Baza, kod: string): ProduktWewnetrzny | undefined {
  return db.select().from(products).where(eq(products.kod, kod)).get();
}

/**
 * Produkty dostawcy do synchronizacji — port `sqlSelect` z `sync-supplier`
 * (`routes.cjs:187-199`).
 *
 * `onlyUpdated` zawęża do tych, których w Selly jeszcze nie ma ALBO które zmieniły się po
 * ostatniej synchronizacji. Porównanie `data_aktualizacji > ostatnia_sync` zestawia dwa
 * napisy w RÓŻNYCH formatach (ISO 8601 z `T` kontra `datetime('now')` ze spacją) — dla dat
 * z tego samego stulecia porządek leksykograficzny i tak wychodzi poprawny, bo `T` (0x54)
 * jest większe od spacji. Zastane, nie ruszamy.
 */
export function produktyDoSynchronizacji(
  db: Baza,
  dostawca: string,
  opcje: { onlyUpdated?: boolean; limit?: number } = {},
): ProduktWewnetrzny[] {
  const warunki = [eq(products.dostawca, dostawca), eq(products.status, "aktywny")];
  if (opcje.onlyUpdated) {
    warunki.push(
      sql`(${sellyProducts.bridgeKod} is null or ${products.dataAktualizacji} > ${sellyProducts.ostatniaSync})`,
    );
  }

  const zapytanie = db
    .select({ p: products })
    .from(products)
    .leftJoin(sellyProducts, eq(sellyProducts.bridgeKod, products.kod))
    .where(and(...warunki));

  const wiersze =
    opcje.limit && opcje.limit > 0 ? zapytanie.limit(opcje.limit).all() : zapytanie.all();

  return wiersze.map((w) => w.p);
}

/** Otwarcie wpisu w dzienniku (`routes.cjs:174-178`) — status `w_trakcie`, zwraca `id`. */
export function otworzWpisLogu(
  db: Baza,
  dane: { dostawca: string; uzytkownikId: number | null; uzytkownikImie: string | null },
): number {
  const wynik = db
    .insert(sellySyncLog)
    .values({
      operacja: "sync_supplier",
      dostawcaKod: dane.dostawca,
      uzytkownikId: dane.uzytkownikId,
      uzytkownikImie: dane.uzytkownikImie,
      status: "w_trakcie",
      rozpoczeto: sql`datetime('now')` as unknown as string,
    })
    .returning({ id: sellySyncLog.id })
    .get();
  return wynik.id;
}

/** Domknięcie wpisu po udanej synchronizacji (`routes.cjs:233-239`). */
export function zamknijWpisLogu(
  db: Baza,
  id: number,
  dane: { liczbaOk: number; liczbaBlad: number; liczbaSkip: number; szczegoly: unknown },
): void {
  db.update(sellySyncLog)
    .set({
      liczbaOk: dane.liczbaOk,
      liczbaBlad: dane.liczbaBlad,
      liczbaSkip: dane.liczbaSkip,
      szczegolyJson: JSON.stringify(dane.szczegoly),
      zakonczono: sql`datetime('now')` as unknown as string,
      status: "zakonczono",
    })
    .where(eq(sellySyncLog.id, id))
    .run();
}

/** Domknięcie wpisu po błędzie globalnym (`routes.cjs:245-246`). Liczniki zostają zerowe. */
export function oznaczWpisLoguBledem(db: Baza, id: number, komunikat: string): void {
  db.update(sellySyncLog)
    .set({
      status: "blad",
      zakonczono: sql`datetime('now')` as unknown as string,
      szczegolyJson: JSON.stringify({ error: komunikat }),
    })
    .where(eq(sellySyncLog.id, id))
    .run();
}

/** Pomocnicze dla testów i diagnostyki — ile produktów ma już mapowanie w Selly. */
export function liczbaZmapowanych(db: Baza): number {
  const wynik = db
    .select({ n: sql<number>`count(*)` })
    .from(sellyProducts)
    .where(isNotNull(sellyProducts.sellyProductId))
    .get();
  return wynik?.n ?? 0;
}
