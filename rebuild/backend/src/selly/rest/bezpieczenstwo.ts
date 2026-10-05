import type { ProduktSzczegolySelly, WariantSelly } from "../klient.js";
import type { Discovery, WierszBridge } from "./discovery.js";

const nazwa = (s: string | null | undefined) =>
  String(s ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();

/** Ticket 184: cache ID jest wskazówką, nie dowodem tożsamości produktu. Fail closed. */
export async function sprawdzCelSelly(
  discovery: Discovery,
  row: WierszBridge,
  productId: number,
  variantId: number,
): Promise<{ product: ProduktSzczegolySelly; variants: WariantSelly[]; variant: WariantSelly }> {
  const response = await discovery.apiWithRetry(`GET /api/products/${productId}`, () =>
    discovery.klient.getProduct(productId),
  );
  const product = response?.data || response;
  if (!product || product.product_id !== productId)
    throw new Error("Selly: niepełny odczyt produktu — zapis zablokowany");
  const zgodnyEan = !!row.ean && !!product.ean && row.ean === product.ean;
  const zgodnaNazwa = !!row.nazwa && !!product.name && nazwa(row.nazwa) === nazwa(product.name);
  const demo = (s: string | null | undefined) => /\bDEMO\b/i.test(s || "");
  if ((!zgodnyEan && !zgodnaNazwa) || (row.nazwa && product.name && demo(row.nazwa) !== demo(product.name)))
    throw new Error("Selly: produkt docelowy nie odpowiada ofercie Bridge — zapis zablokowany");
  // GET szczegółów realnego Selly zawiera pełną tablicę variants. Starsze odpowiedzi: osobny GET.
  const variants = product.variants ??
    (await discovery.apiWithRetry(`GET /api/products/${productId}/variants`, () =>
      discovery.klient.listVariants(productId)))?.data;
  if (!Array.isArray(variants)) throw new Error("Selly: brak odczytu wariantów — zapis zablokowany");
  const variant = variants.find(v => v.variant_id === variantId);
  if (!variant || (variant.product_id != null && variant.product_id !== productId))
    throw new Error("Selly: wariant nie należy do produktu — zapis zablokowany");
  const warehouse = variant.features?.find(f => f.name === "Magazyny")?.value;
  if (warehouse !== row.dostawca)
    throw new Error("Selly: wariant ma inny magazyn niż oferta Bridge — zapis zablokowany");
  return { product, variants, variant };
}

/** Bez arbitralnej polityki ceny wielomagazynowej. Cena zera nie jest wiarygodnym cennikiem. */
export function cenaBazowaJednegoWariantu(variants: WariantSelly[]): number | undefined {
  if (variants.length !== 1) return undefined;
  const price = variants[0]?.price;
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : undefined;
}
