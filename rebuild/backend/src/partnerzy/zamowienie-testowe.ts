// Zamówienie TESTOWE do sprawdzenia „Utwórz w Selly” (ticket 267) — krok wdrożenia `2026-10-14-partnerzy-zamowienie-testowe-selly`.
//
// Zakłada w panelu partnera jedno zamówienie z numerem `TEST-SELLY-…`: 1 sztuka aktywnego produktu z jednoznacznym powiązaniem Selly (produkt + wariant),
// w EUR, z kodem kraju DE. Zamówienie przechodzi tę samą ścieżkę co prawdziwe (`zapiszZamowienie` → `zwaliduj`), więc podgląd i przycisk działają jak zwykle.
// Po sprawdzeniu zamówienie usuwa się w Selly ręcznie; w Bridge zostaje jako ślad testu. Idempotentne (po numerze zamówienia).

import { and, eq, gte } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerzy, products, sellyProducts } from "../db/schema.js";
import { zapiszZamowienie } from "../repos/partnerzy-zamowienia.js";
import { zwaliduj } from "./walidacja-zamowienia.js";

export const NUMER_ZAMOWIENIA_TESTOWEGO = "TEST-SELLY-20261014";

const esc = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function zalozZamowienieTestowe(db: Baza, nazwaPartnera: string, teraz: Date = new Date()): string | { odloz: string } {
  const partner = db.select({ id: partnerzy.id }).from(partnerzy).where(eq(partnerzy.nazwa, nazwaPartnera)).get();
  if (!partner) return { odloz: `brak partnera ${nazwaPartnera}` };

  const kandydaci = db
    .select({ kod: products.kod, nazwa: products.nazwa })
    .from(products)
    .where(and(eq(products.status, "aktywny"), gte(products.stan, 1)))
    .all();
  const powiazania = db.select({ kod: sellyProducts.bridgeKod, pid: sellyProducts.sellyProductId, vid: sellyProducts.sellyVariantId }).from(sellyProducts).all();
  const wg = new Map<string, Set<string>>();
  for (const p of powiazania) if (p.vid !== null) wg.set(p.kod, (wg.get(p.kod) ?? new Set()).add(`${p.pid}/${p.vid}`));
  const produkt = kandydaci.find((k) => wg.get(k.kod)?.size === 1);
  if (!produkt) return { odloz: "brak aktywnego produktu na stanie z jednoznacznym powiązaniem Selly — ponowię przy następnym wdrożeniu" };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DOCUMENTORDER>
  <DATE>${teraz.toISOString().slice(0, 19).replace("T", " ")}</DATE>
  <ORDERCURRENCY>EUR</ORDERCURRENCY><NUMBER>${NUMER_ZAMOWIENIA_TESTOWEGO}</NUMBER>
  <PRODUCTS>
    <PRODUCT><CODE>${esc(produkt.kod)}</CODE><NAME>${esc(produkt.nazwa)}</NAME><ORDERQUANTITY>1</ORDERQUANTITY><SELL_PRICE>10.00</SELL_PRICE></PRODUCT>
  </PRODUCTS>
  <DELIVERY><MODEOFTRANSPORT>1</MODEOFTRANSPORT><CODCOST>0</CODCOST><DELIVERY_COST>0.00</DELIVERY_COST>
    <CUSTOMERNAME>TEST - do usuniecia</CUSTOMERNAME><COUNTRY>DE</COUNTRY></DELIVERY>
</DOCUMENTORDER>`;
  const z = zapiszZamowienie(db, partner.id, xml, teraz);
  const w = zwaliduj(db, z.id, { zachowajPrzyjete: true });
  return z.nowe ? `założono zamówienie testowe ${NUMER_ZAMOWIENIA_TESTOWEGO} (status: ${w?.status ?? "?"})` : `zamówienie testowe ${NUMER_ZAMOWIENIA_TESTOWEGO} już istnieje`;
}
