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

export const NUMER_SYMULACJI_ADTYRES = "TEST-SYM-ADTYRES-20261014";
export const NUMER_SYMULACJI_TYREWORLD = "TEST-SYM-TYREWORLD-20261014";

type ProduktSymulacji = { kod: string; nazwa: string };

/** Aktywne produkty na stanie z jednoznacznym powiązaniem Selly (jak w zamówieniu testowym), w stałej kolejności. */
function produktyDoSymulacji(db: Baza, ile: number): ProduktSymulacji[] {
  const kandydaci = db
    .select({ kod: products.kod, nazwa: products.nazwa })
    .from(products)
    .where(and(eq(products.status, "aktywny"), gte(products.stan, 2)))
    .orderBy(products.kod)
    .all();
  const powiazania = db.select({ kod: sellyProducts.bridgeKod, pid: sellyProducts.sellyProductId, vid: sellyProducts.sellyVariantId }).from(sellyProducts).all();
  const wg = new Map<string, Set<string>>();
  for (const p of powiazania) if (p.vid !== null) wg.set(p.kod, (wg.get(p.kod) ?? new Set()).add(`${p.pid}/${p.vid}`));
  return kandydaci.filter((k) => wg.get(k.kod)?.size === 1).slice(0, ile);
}

/**
 * Ticket 272: dwa zamówienia SYMULACYJNE w panelu — Adtyres (format DOCUMENTORDER, dostawa do FR) i TyreWorld (format `bestellung`, dostawa do DE) — z pełnym
 * adresem dostawy (Selly wymaga `ship_postcode`). Dane odbiorców zmyślone i oznaczone TEST; produkty z jednoznacznym powiązaniem Selly; nic nie idzie do Selly
 * ani do partnera, dopóki ktoś nie kliknie „Utwórz w Selly” (a tracking nie wychodzi bez wpisania numeru listu). Idempotentne po numerze zamówienia.
 */
export function zalozZamowieniaSymulacyjne(db: Baza, teraz: Date = new Date()): string | { odloz: string } {
  const adtyres = db.select({ id: partnerzy.id }).from(partnerzy).where(eq(partnerzy.nazwa, "Adtyres")).get();
  const tyreworld = db.select({ id: partnerzy.id }).from(partnerzy).where(eq(partnerzy.nazwa, "TyreWorld")).get();
  if (!adtyres || !tyreworld) return { odloz: "brak partnera Adtyres albo TyreWorld" };
  const produkty = produktyDoSymulacji(db, 4);
  if (produkty.length < 4) return { odloz: "za mało aktywnych produktów na stanie z jednoznacznym powiązaniem Selly (potrzeba 4)" };
  const [a1, a2, t1, t2] = produkty as [ProduktSymulacji, ProduktSymulacji, ProduktSymulacji, ProduktSymulacji];
  const data = teraz.toISOString().slice(0, 19).replace("T", " ");

  const xmlAdtyres = `<?xml version="1.0" encoding="UTF-8"?>
<DOCUMENTORDER>
  <DATE>${data}</DATE>
  <ORDERCURRENCY>EUR</ORDERCURRENCY><NUMBER>${NUMER_SYMULACJI_ADTYRES}</NUMBER>
  <PRODUCTS>
    <PRODUCT><CODE>${esc(a1.kod)}</CODE><NAME>${esc(a1.nazwa)}</NAME><ORDERQUANTITY>2</ORDERQUANTITY><SELL_PRICE>180.00</SELL_PRICE></PRODUCT>
    <PRODUCT><CODE>${esc(a2.kod)}</CODE><NAME>${esc(a2.nazwa)}</NAME><ORDERQUANTITY>1</ORDERQUANTITY><SELL_PRICE>240.00</SELL_PRICE></PRODUCT>
  </PRODUCTS>
  <DELIVERY><MODEOFTRANSPORT>1</MODEOFTRANSPORT><CODCOST>0</CODCOST><DELIVERY_COST>0.00</DELIVERY_COST>
    <CUSTOMERNAME>TEST Jean Exemple (symulacja)</CUSTOMERNAME><STREET>1 rue de l'Exemple</STREET><ZIP>75001</ZIP><CITY>Paris</CITY><COUNTRY>FR</COUNTRY><PHONE>+33 1 00 00 00 00</PHONE></DELIVERY>
</DOCUMENTORDER>`;

  const xmlTyreworld = `<?xml version="1.0" encoding="UTF-8"?>
<bestellung>
  <bestellnummer>${NUMER_SYMULACJI_TYREWORLD}</bestellnummer>
  <bestelldatum>${data}</bestelldatum>
  <lieferadresse>
    <name><![CDATA[TEST Max Mustermann (Simulation)]]></name>
    <strasse><![CDATA[Musterweg 1]]></strasse>
    <plz>12345</plz>
    <ort>Musterstadt</ort>
    <lkz>DE</lkz>
    <telefon>+49 000 000000</telefon>
  </lieferadresse>
  <positionen>
    <pos><artnr>${esc(t1.kod)}</artnr><menge>1</menge><preis>200.0000</preis><bezeichnung><![CDATA[${t1.nazwa}]]></bezeichnung></pos>
    <pos><artnr>${esc(t2.kod)}</artnr><menge>2</menge><preis>150.0000</preis><bezeichnung><![CDATA[${t2.nazwa}]]></bezeichnung></pos>
  </positionen>
</bestellung>`;

  const wyniki: string[] = [];
  for (const [nazwa, id, xml, numer] of [
    ["Adtyres", adtyres.id, xmlAdtyres, NUMER_SYMULACJI_ADTYRES],
    ["TyreWorld", tyreworld.id, xmlTyreworld, NUMER_SYMULACJI_TYREWORLD],
  ] as const) {
    const z = zapiszZamowienie(db, id, xml, teraz);
    const w = zwaliduj(db, z.id, { zachowajPrzyjete: true });
    wyniki.push(`${nazwa}: ${z.nowe ? "założono" : "już istnieje"} ${numer} (status: ${w?.status ?? "?"})`);
  }
  return wyniki.join("; ");
}
