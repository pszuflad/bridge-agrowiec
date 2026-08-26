import { eq, sql } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { products } from "../db/schema.js";
import { KOLUMNY_POZA_KONTRAKTEM, projekcjaKontraktowa } from "./kolumny.js";

/**
 * Kolumny wychodzące do API — wszystkie z tabeli MINUS wewnętrzne (plan.md D6).
 * Bez tej projekcji `uwaga_cena` z migracji 002 dołożyłaby 73. klucz do odpowiedzi
 * i złamała zamrożony `contract/fixtures/GET_products.json` (72 klucze).
 */
const KOLUMNY_API = projekcjaKontraktowa(products, KOLUMNY_POZA_KONTRAKTEM.products);

export type Produkt = Omit<typeof products.$inferSelect, "uwagaCena">;

/**
 * Odpowiednik `U.listProducts` (backend-index.cjs:44699-44701) — CAŁA tabela, bez
 * limitu i bez sortowania. To nie przeoczenie: frontend katalogu woła `/api/products`
 * bez parametrów właśnie po to, żeby dostać komplet i filtrować go u siebie
 * (frontend-index.js:23261). Kolejność wierszy = kolejność `rowid`, jak w oryginale.
 */
export function listaProduktow(db: Baza): Produkt[] {
  return db.select(KOLUMNY_API).from(products).all();
}

export type StronaProduktow = {
  items: Produkt[];
  total: number;
};

/**
 * Odpowiednik `U.listProductsPaged` (backend-index.cjs:44702-44721).
 *
 * `total` to `count(*)` liczony PO tym samym filtrze co `items` — przy `dostawca`
 * jest to liczba produktów tego dostawcy, nie całej bazy.
 */
export function listaProduktowStronicowana(
  db: Baza,
  limit = 200,
  offset = 0,
  dostawca?: string,
): StronaProduktow {
  if (dostawca !== undefined) {
    const items = db
      .select(KOLUMNY_API)
      .from(products)
      .where(eq(products.dostawca, dostawca))
      .limit(limit)
      .offset(offset)
      .all();
    const licznik = db
      .select({ c: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.dostawca, dostawca))
      .get();
    return { items, total: licznik?.c ?? 0 };
  }

  const items = db.select(KOLUMNY_API).from(products).limit(limit).offset(offset).all();
  const licznik = db.select({ c: sql<number>`count(*)` }).from(products).get();
  return { items, total: licznik?.c ?? 0 };
}
