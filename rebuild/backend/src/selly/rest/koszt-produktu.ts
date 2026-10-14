import type { Baza } from "../../db/index.js";
import type { ProduktSzczegolySelly, WariantSelly } from "../klient.js";
import type { Discovery, WierszBridge } from "./discovery.js";

/** Wspólny koszt nie ma jednoznacznego źródła, jeśli grupa ma kilka aktywnych ofert. */
export function kosztNettoJedynejOferty(db: Baza, kodImportu: string | null, id?: number): number | undefined {
  const oferty = db.$client.prepare(
    "SELECT id, cena_zakupu FROM products WHERE kod_importu = ? AND status = 'aktywny'",
  ).all(kodImportu) as { id: number; cena_zakupu: number | null }[];
  if (oferty.length !== 1 || (id !== undefined && oferty[0]?.id !== id)) return undefined;
  const netto = oferty[0]?.cena_zakupu;
  return typeof netto === "number" && Number.isFinite(netto) && netto > 0 ? netto : undefined;
}

export async function potwierdzZapisKosztu(discovery: Discovery, productId: number, netto: number): Promise<void> {
  const odczyt = await discovery.apiWithRetry(`GET /api/products/${productId} koszt`, () =>
    discovery.klient.getProduct(productId));
  const produkt = odczyt?.data ?? odczyt;
  if (produkt?.product_id !== productId || typeof produkt.price_purchase !== "number" ||
      Math.abs(produkt.price_purchase - netto) > 0.005) {
    throw new Error("Selly: koszt produktu niepotwierdzony po zapisie");
  }
}

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
  const netto = kosztNettoJedynejOferty(db, row.kod_importu ?? null, row.id);
  if (target.variants.length !== 1 || netto === undefined) return false;
  if (target.product.price_purchase !== netto) {
    await discovery.apiWithRetry(`PUT /api/products/${productId} price_purchase`, () =>
      discovery.klient.updateProduct(productId, { price_purchase: netto }));
    await potwierdzZapisKosztu(discovery, productId, netto);
  }
  db.$client.prepare(
    "UPDATE selly_products SET cena_zakupu_wyslana = ? WHERE kod_importu = ? AND dostawca = ?",
  ).run(netto, row.kod_importu, row.dostawca);
  return true;
}
