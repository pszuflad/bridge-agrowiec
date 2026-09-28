/**
 * Pomocnicze do testów Selly REST (karta I15.6): discovery i Tor 1 na atrapie sklepu.
 *
 * Limiter jest atrapą liczącą — dławienie ma własny test (`selly.limiter.test.ts`), tu
 * sprawdzamy tylko, że KAŻDE wywołanie Selly przeszło przez `acquire()`.
 */
import type { Baza, BazaSqlite } from "../../src/db/index.js";
import type { KlientSelly } from "../../src/selly/klient.js";
import {
  stworzDiscovery,
  type BudujPayloadProduktu,
  type Discovery,
} from "../../src/selly/rest/discovery.js";
import type { Limiter } from "../../src/selly/rest/limiter.js";

export type LimiterLiczacy = Limiter & { zgody: () => number };

export function stworzLimiterLiczacy(): LimiterLiczacy {
  let zgody = 0;
  return {
    acquire: () => {
      zgody++;
      return Promise.resolve();
    },
    getStats: () => ({ requestsInWindow: zgody, capacity: 250, utilizationPct: 0 }),
    zgody: () => zgody,
  };
}

/**
 * Atrapa `mapper_v2.buildProductPayload` (`mapper_v2.cjs:159-187`) — ta sama logika decyzji
 * (brak kategorii/producenta w słowniku → `_error`) i te same pola, które czyta discovery:
 * `product_code` = kod bez podkreślników, `provider_code` = `kod_importu`. Prawdziwy mapper
 * wpina karta I15.7.
 */
export const budujPayloadTestowy: BudujPayloadProduktu = (wiersz, slowniki) => {
  const catId = slowniki.catMap?.get(String(wiersz.kategoria || "").toLowerCase());
  const prodId = slowniki.prodMap?.get(String(wiersz.marka || "").toLowerCase());
  if (!catId) return { _error: `Brak kategorii w slowniku: "${wiersz.kategoria}"` };
  if (!prodId) return { _error: `Brak producenta w slowniku: "${wiersz.marka}"` };
  return {
    name: wiersz.kod,
    ean: wiersz.ean,
    category_id: catId,
    producer_id: prodId,
    product_code: String(wiersz.kod || "").replace(/_/g, ""),
    provider_code: wiersz.kod_importu ?? undefined,
    price: Number(wiersz.cena_sprzedazy) || 0,
  };
};

export function stworzDiscoveryTestowe(
  klient: KlientSelly,
  budujPayloadProduktu: BudujPayloadProduktu = budujPayloadTestowy,
): { discovery: Discovery; limiter: LimiterLiczacy } {
  const limiter = stworzLimiterLiczacy();
  return { discovery: stworzDiscovery({ klient, budujPayloadProduktu, limiter }), limiter };
}

/** Wiersz `selly_products` w nowym (wariantowym) kształcie. */
export type NoweMapowanie = {
  kodImportu: string;
  dostawca: string;
  bridgeKod: string;
  productId: number;
  variantId?: number | null;
  featureId?: number | null;
  stanWyslany?: number | null;
  cenaWyslana?: number | null;
  status?: string;
};

export function zasiejMapowanie(sqlite: BazaSqlite, m: NoweMapowanie): void {
  sqlite
    .prepare(
      `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id,
         feature_id_magazyn, stan_wyslany, cena_sprzedazy_wyslana, ostatni_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      m.kodImportu,
      m.dostawca,
      m.bridgeKod,
      m.productId,
      m.variantId ?? null,
      m.featureId ?? null,
      m.stanWyslany ?? null,
      m.cenaWyslana ?? null,
      m.status ?? "ok",
    );
}

export type WierszMapowania = {
  kod_importu: string;
  dostawca: string;
  bridge_kod: string;
  selly_product_id: number;
  selly_variant_id: number | null;
  selly_category_id: number | null;
  selly_producer_id: number | null;
  feature_id_magazyn: number | null;
  ostatni_status: string;
  ostatni_blad: string | null;
  stan_wyslany: number | null;
  cena_sprzedazy_wyslana: number | null;
  cena_zakupu_wyslana: number | null;
};

export function mapowanie(db: Baza, kodImportu: string, dostawca: string): WierszMapowania | undefined {
  return db.$client
    .prepare("SELECT * FROM selly_products WHERE kod_importu = ? AND dostawca = ?")
    .get(kodImportu, dostawca) as WierszMapowania | undefined;
}
