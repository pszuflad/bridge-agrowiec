import type { Baza } from "../../db/index.js";
import type { ProduktSzczegolySelly, WariantSelly } from "../klient.js";
import type { Discovery, WierszBridge } from "./discovery.js";

/**
 * REST Selly nie reklamuje kosztu WARIANTU. Nie wysyłamy nieudokumentowanego pola.
 * Koszt produktu wolno wyrównać tylko dla jednej aktywnej oferty i jednego wariantu.
 * Kontrakt `price_purchase` pozostaje netto, jak w dotychczasowym mapperze Toru 2.
 */
export async function synchronizujKosztProduktuJednegoWariantu(
  db: Baza,
  discovery: Discovery,
  row: WierszBridge & { id: number },
  productId: number,
  target: { product: ProduktSzczegolySelly; variants: WariantSelly[] },
): Promise<boolean> {
  const oferty = db.$client.prepare(
    "SELECT id, cena_zakupu FROM products WHERE kod_importu = ? AND status = 'aktywny'",
  ).all(row.kod_importu) as { id: number; cena_zakupu: number | null }[];
  if (target.variants.length !== 1 || oferty.length !== 1 || oferty[0]?.id !== row.id) return false;
  const netto = oferty[0].cena_zakupu;
  if (typeof netto !== "number" || !Number.isFinite(netto) || netto <= 0) return false;
  if (target.product.price_purchase !== netto) {
    await discovery.apiWithRetry(`PUT /api/products/${productId} price_purchase`, () =>
      discovery.klient.updateProduct(productId, { price_purchase: netto }));
    const odczyt = await discovery.apiWithRetry(`GET /api/products/${productId} koszt`, () =>
      discovery.klient.getProduct(productId));
    const produkt = odczyt?.data ?? odczyt;
    if (produkt?.product_id !== productId || typeof produkt.price_purchase !== "number" ||
        Math.abs(produkt.price_purchase - netto) > 0.005) {
      throw new Error("Selly: koszt produktu niepotwierdzony po zapisie");
    }
  }
  db.$client.prepare(
    "UPDATE selly_products SET cena_zakupu_wyslana = ? WHERE kod_importu = ? AND dostawca = ?",
  ).run(netto, row.kod_importu, row.dostawca);
  return true;
}
