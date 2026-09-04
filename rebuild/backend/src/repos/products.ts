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

/**
 * Produkt w pełnym kształcie tabeli — do użytku WEWNĘTRZNEGO (silnik importu), nie do API.
 *
 * Świadomie omija `KOLUMNY_API`: silnik porównuje pozycje z cennika z katalogiem i musi
 * widzieć wszystko, także kolumny ukryte przed kontraktem (`uwaga_cena`).
 */
export type ProduktWewnetrzny = typeof products.$inferSelect;

/**
 * Katalog jednego dostawcy dla silnika importu — odpowiednik
 * `U.listProducts().filter(u => u.dostawca === t)` z `tk()` (backend-index.cjs:47598).
 *
 * Oryginał pobiera CAŁĄ tabelę i filtruje w JS; my filtrujemy w SQL. To ta sama treść
 * wyniku i ta sama kolejność (`rowid`), a różnica dotyczy wyłącznie tego, gdzie wykonuje się
 * warunek — na zachowanie silnika nie ma wpływu.
 */
export function katalogDoImportu(db: Baza, dostawca: string): ProduktWewnetrzny[] {
  return db.select().from(products).where(eq(products.dostawca, dostawca)).all();
}

/**
 * Aktualizacja produktu — port `U.updateProduct` (backend-index.cjs:44728-44739).
 *
 * ⚠ Nie jest to zwykły UPDATE: jeżeli patch rusza którąkolwiek cenę i NIE ustawia jawnie
 * `status`, a wynikowa cena zakupu lub sprzedaży wynosi 0, produkt dostaje
 * `status: "wstrzymany"`. W zakresie 3c silnik woła tę funkcję wyłącznie z
 * `{ nieobecnoscPodRzad: 0 }`, więc bezpiecznik się nie uruchamia — ale wchodzi do portu
 * teraz, bo 3d przepuści tędy zapisy auto-zatwierdzania z cenami.
 */
export function aktualizujProdukt(
  db: Baza,
  id: number,
  patch: Partial<ProduktWewnetrzny>,
): ProduktWewnetrzny | null {
  let doZapisu = patch;

  if (("cenaSprzedazy" in patch || "cenaZakupu" in patch) && !("status" in patch)) {
    const biezacy = db.select().from(products).where(eq(products.id, id)).get();
    const cenaSprzedazy =
      "cenaSprzedazy" in patch ? Number(patch.cenaSprzedazy) : Number(biezacy?.cenaSprzedazy);
    const cenaZakupu =
      "cenaZakupu" in patch ? Number(patch.cenaZakupu) : Number(biezacy?.cenaZakupu);
    if (cenaSprzedazy === 0 || cenaZakupu === 0) doZapisu = { ...patch, status: "wstrzymany" };
  }

  db.update(products).set(doZapisu).where(eq(products.id, id)).run();
  return db.select().from(products).where(eq(products.id, id)).get() ?? null;
}

/**
 * Usunięcie produktu — port `U.deleteProduct` (backend-index.cjs:44740-44742).
 *
 * Woła to wyłącznie silnik importu, gdy pozycja z cennika przestała być oponą (`:47689`).
 *
 * @returns `false`, gdy produktu o tym id nie było
 */
export function usunProdukt(db: Baza, id: number): boolean {
  const istnieje = db.select().from(products).where(eq(products.id, id)).get();
  if (!istnieje) return false;
  db.delete(products).where(eq(products.id, id)).run();
  return true;
}

/**
 * Czyszczenie CAŁEGO katalogu — port `U.clearProducts()` (`backend-index.cjs:44744`,
 * wołane wyłącznie przez `POST /api/products/clear`, `:48332`).
 *
 * `DELETE FROM products` BEZ `WHERE` — operacja nieodwracalna, dotykająca wszystkich
 * dostawców naraz. Ochronę stanowi wyłącznie `{potwierdzenie: "WYCZYSC"}` sprawdzane
 * w trasie oraz kopia pliku bazy robiona tuż przed (`routes/maintenance.ts`).
 *
 * @returns liczba usuniętych wierszy — oryginał jej nie zwraca (`u.json({ok:true})`),
 *   ale jest potrzebna testom i logowi; kształt odpowiedzi HTTP pozostaje bez zmian.
 */
export function wyczyscProdukty(db: Baza): number {
  return db.delete(products).run().changes;
}
