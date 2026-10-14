import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { zbudujCsvSelly } from "../src/selly/generator-csv.js";
import { kosztZakupuBrutto } from "../src/selly/koszt-zakupu.js";
import { wczytajEnv } from "../src/config/env.js";
import { findDeltaProducts, syncDelta } from "../src/selly/rest/sync-delta.js";
import { syncFullForDostawca } from "../src/selly/rest/sync-full.js";
import { budujPayloadProduktuV2 } from "../src/selly/rest/mapper-v2.js";
import { zasiejMapySelly } from "./gate/dane.js";
import {
  stworzTestowaBaze, zasiejProdukty, zasiejMapowanie, stworzAtrapeSelly,
  stworzDiscoveryTestowe, mapowanie, type TestowaBaza,
} from "./gate/index.js";

/** Jedna rzeczywista pozycja, ale WYŁĄCZNIE lokalny SQLite i atrapa Selly. */
describe("MO1_15231071 — kandydat poprawki kosztów CSV i REST", () => {
  let baza: TestowaBaza;
  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejProdukty(baza.db);
    baza.sqlite.prepare(`UPDATE products SET
      kod='MO1_15231071', dostawca='MO1', kod_importu='560115',
      nazwa='12.5-18 ALLIANCE 317 131G 12PR TL', marka='ALLIANCE',
      ean='8903635013211', cena_zakupu=830.93, cena_sprzedazy=1083, stan=8, vat=23
      WHERE kod='MO9_336320'`).run();
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "560115", dostawca: "MO1", bridgeKod: "MO1_15231071",
      productId: 5088, variantId: 5865, featureId: 8, stanWyslany: 8, cenaWyslana: 1083,
    });
  });
  afterEach(() => baza.posprzataj());

  function przygotuj(wieleWariantow = false) {
    const atrapa = stworzAtrapeSelly({ sklep: [{
      product_id: 5088, ean: "8903635013211",
      name: "12.5-18 ALLIANCE 317 131G 12PR TL", price: 1083,
      warianty: [
        { variant_id: 5865, product_id: 5088, quantity: 8, price: 1083,
          features: [{ feature_id: 8, name: "Magazyny", value: "MO1" }] },
        ...(wieleWariantow ? [{
          variant_id: 9000, product_id: 5088, price: 1200, quantity: 2,
          features: [{ name: "Magazyny", value: "MO3" }],
        }] : []),
      ],
    }] });
    let koszt = 919.94;
    let potwierdzaj = true;
    const get = atrapa.klient.getProduct.bind(atrapa.klient);
    const put = atrapa.klient.updateProduct.bind(atrapa.klient);
    atrapa.klient.getProduct = async id => {
      const r = await get(id);
      return { data: { ...(r?.data ?? r), price_purchase: koszt } };
    };
    atrapa.klient.updateProduct = async (id, payload) => {
      const result = await put(id, payload);
      const p = payload as { price_purchase?: number };
      if (potwierdzaj && p.price_purchase !== undefined) koszt = p.price_purchase;
      return result;
    };
    return {
      atrapa, ...stworzDiscoveryTestowe(atrapa.klient), koszt: () => koszt,
      niePotwierdzaj: () => { potwierdzaj = false; },
    };
  }
  const opcje = { kosztProduktuJednegoWariantu: true, kodProduktu: "MO1_15231071" };
  const receipt = () => mapowanie(baza.db, "560115", "MO1")?.cena_zakupu_wyslana;
  const csv = (poprawka: boolean) => zbudujCsvSelly(baza.db, {
    kodProduktu: "MO1_15231071", kosztZakupuBrutto: poprawka,
  });

  it("CSV jednego produktu: tylko kolumna zakupu zmienia 830.93 na 1022.04", () => {
    const stare = csv(false);
    const nowe = csv(true);
    expect(nowe.wiersze).toBe(1);
    const oldRows = stare.tresc.split("\r\n");
    const newRows = nowe.tresc.split("\r\n");
    expect(newRows[0]).toBe(oldRows[0]);
    const oldCells = oldRows[1]!.split(";");
    const newCells = newRows[1]!.split(";");
    expect(oldCells[4]).toBe("830.93");
    expect(newCells[4]).toBe("1022.04");
    expect(newCells.map((v, i) => v === oldCells[i] ? null : i).filter(v => v !== null)).toEqual([4]);
    expect(newCells[6]).toBe("1083,-");
    expect(newCells[8]).toBe("8");
    expect(nowe.tresc).toContain("8903635013211");
    expect(kosztZakupuBrutto(830.93, 23)).toBe(1022.04);
    expect(Math.round(1022.04 / 1.23 * 100) / 100).toBe(830.93);
  });

  it("REST obejmuje zmianę samego kosztu i potwierdza koszt produktu odczytem", async () => {
    expect(findDeltaProducts(baza.db, "MO1")).toHaveLength(0);
    expect(findDeltaProducts(baza.db, "MO1", 10, true)).toHaveLength(1);
    const t = przygotuj();
    const r = await syncDelta(baza.db, t.discovery, "MO1", opcje);
    expect(r.stats.ok).toBe(1);
    expect(r.stats.err).toBe(0);
    expect(t.koszt()).toBe(830.93);
    expect(receipt()).toBe(830.93);
    expect(t.atrapa.wywolania.filter(w => w.metoda === "updateProduct").map(w => w.argumenty))
      .toEqual([[5088, { price_purchase: 830.93 }]]);
    expect(t.atrapa.wywolania.find(w => w.metoda === "updateVariant")?.argumenty)
      .toEqual([5088, 5865, { quantity: 8, price: 1083 }]);
    expect(findDeltaProducts(baza.db, "MO1", 10, true)).toHaveLength(0);
    baza.sqlite.prepare("UPDATE products SET cena_zakupu=840 WHERE kod='MO1_15231071'").run();
    expect(findDeltaProducts(baza.db, "MO1", 10, true)).toHaveLength(1);
  });

  it("REST nie próbuje zapisu kosztu wariantu ani ceny zakupu wielowariantowej karty", async () => {
    const t = przygotuj(true);
    await syncDelta(baza.db, t.discovery, "MO1", opcje);
    expect(t.atrapa.liczba("updateProduct")).toBe(0);
    expect(receipt()).toBeNull();
    expect(t.koszt()).toBe(919.94);
  });

  it("wiele aktywnych ofert Bridge chroni wspólny koszt nawet przy jednym wariancie Selly", async () => {
    baza.sqlite.prepare("UPDATE products SET kod_importu='560115' WHERE kod='MO9_336319'").run();
    expect(findDeltaProducts(baza.db, "MO1", 10, true)).toHaveLength(0);
    baza.sqlite.prepare("UPDATE products SET stan=9 WHERE kod='MO1_15231071'").run();
    const t = przygotuj();
    await syncDelta(baza.db, t.discovery, "MO1", opcje);
    expect(t.atrapa.liczba("updateProduct")).toBe(0);
    expect(receipt()).toBeNull();
  });

  it("HTTP sukces bez zgodnego odczytu nie zapisuje potwierdzenia kosztu", async () => {
    const t = przygotuj();
    t.niePotwierdzaj();
    const r = await syncDelta(baza.db, t.discovery, "MO1", opcje);
    expect(r.stats.err).toBe(1);
    expect(receipt()).toBeNull();
    expect(r.errors[0]?.error).toContain("niepotwierdzony");
  });

  it("błąd PUT produktu pozostawia koszt do ponowienia", async () => {
    const t = przygotuj();
    t.atrapa.klient.updateProduct = async () => { throw new Error("symulowane HTTP 500"); };
    const r = await syncDelta(baza.db, t.discovery, "MO1", opcje);
    expect(r.stats.err).toBe(1);
    expect(receipt()).toBeNull();
  });

  it("przełącznik REST wyłączony: nie wysyła ani nie potwierdza zakupu", async () => {
    baza.sqlite.prepare("UPDATE products SET stan=9 WHERE kod='MO1_15231071'").run();
    const t = przygotuj();
    await syncDelta(baza.db, t.discovery, "MO1");
    expect(t.atrapa.liczba("updateProduct")).toBe(0);
    expect(receipt()).toBeNull();
  });

  it("dryRun na istniejącym mapowaniu nie wykonuje żadnego wywołania API", async () => {
    const t = przygotuj();
    await syncDelta(baza.db, t.discovery, "MO1", { ...opcje, dryRun: true });
    expect(t.atrapa.wywolania).toEqual([]);
    expect(receipt()).toBeNull();
  });

  it("CSV odrzuca nieznany VAT zamiast wysłać zgadywany koszt", () => {
    baza.sqlite.prepare("UPDATE products SET vat=-1 WHERE kod='MO1_15231071'").run();
    expect(() => csv(true)).toThrow("VAT");
    expect(() => csv(false)).not.toThrow();
  });

  it("przeliczenie poprawnie obsługuje VAT 0%, koszt 0, NULL i odrzuca ujemne wartości", () => {
    expect(kosztZakupuBrutto(830.93, 0)).toBe(830.93);
    expect(kosztZakupuBrutto(0, 23)).toBe(0);
    expect(kosztZakupuBrutto(null, null)).toBeNull();
    expect(() => kosztZakupuBrutto(-1, 23)).toThrow();
    expect(() => kosztZakupuBrutto(830.93, Number.NaN)).toThrow();
  });

  it("stary pozorny snapshot wymaga kontrolowanego wyczyszczenia przed naprawą historycznej ceny", async () => {
    baza.sqlite.prepare("UPDATE selly_products SET cena_zakupu_wyslana=830.93 WHERE kod_importu='560115'").run();
    expect(findDeltaProducts(baza.db, "MO1", 10, true)).toHaveLength(0);
    // TYLKO baza testowa: w produkcji ten krok wymaga raportu, zgody i ograniczenia zakresu.
    baza.sqlite.prepare("UPDATE selly_products SET cena_zakupu_wyslana=NULL WHERE kod_importu='560115' AND dostawca='MO1'").run();
    const t = przygotuj();
    const r = await syncDelta(baza.db, t.discovery, "MO1", opcje);
    expect(r.stats.ok).toBe(1);
    expect(t.koszt()).toBe(830.93);
    expect(receipt()).toBe(830.93);
  });

  it("obie poprawki są domyślnie wyłączone i wymagają jawnej aktywacji", () => {
    const minimalne = { DB_PATH: "/tmp/test-koszt.db", JWT_SECRET: "tylko-test" };
    const domyslne = wczytajEnv(minimalne);
    expect(domyslne.SELLY_CSV_KOSZT_BRUTTO).toBe(false);
    expect(domyslne.SELLY_KOSZT_PRODUKTU_JEDNEGO_WARIANTU).toBe(false);
    const wlaczone = wczytajEnv({
      ...minimalne, SELLY_CSV_KOSZT_BRUTTO: "true",
      SELLY_KOSZT_PRODUKTU_JEDNEGO_WARIANTU: "true",
    });
    expect(wlaczone.SELLY_CSV_KOSZT_BRUTTO).toBe(true);
    expect(wlaczone.SELLY_KOSZT_PRODUKTU_JEDNEGO_WARIANTU).toBe(true);
  });

  it("próba po kodzie nie dotyka innych ofert wymagających synchronizacji", async () => {
    const t = przygotuj();
    expect(findDeltaProducts(baza.db, null, 100, true).length).toBeGreaterThan(1);
    const r = await syncDelta(baza.db, t.discovery, null, opcje);
    expect(r.stats.total).toBe(1);
    expect(r.stats.ok).toBe(1);
    expect(t.atrapa.wywolania.filter(w => w.metoda === "updateVariant").map(w => w.argumenty[1]))
      .toEqual([5865]);
  });

  function drugiMagazyn() {
    baza.sqlite.prepare(`UPDATE products SET kod='MO3_TEST', dostawca='MO3',
      kod_importu='560115', ean='8903635013211', marka='ALLIANCE',
      nazwa='12.5-18 ALLIANCE 317 131G 12PR TL', cena_zakupu=700,
      cena_sprzedazy=950, stan=2, vat=23 WHERE kod='MO9_336319'`).run();
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "560115", dostawca: "MO3", bridgeKod: "MO3_TEST",
      productId: 5088, variantId: 9000, featureId: 4, stanWyslany: 2, cenaWyslana: 950,
    });
  }

  function slowniki() {
    zasiejMapySelly(baza.db);
    baza.sqlite.prepare("INSERT INTO selly_dict (slownik,klucz,wartosc_id) VALUES ('producers','alliance',3)").run();
    baza.sqlite.prepare("INSERT INTO selly_dict (slownik,klucz,wartosc_id) VALUES ('warehouses','mo1',8)").run();
    baza.sqlite.prepare("INSERT INTO selly_dict (slownik,klucz,wartosc_id) VALUES ('warehouses','mo3',4)").run();
  }

  it("CSV wielomagazynowy zachowuje wspólny kod i dwa niezależne koszty", () => {
    drugiMagazyn();
    const rows = zbudujCsvSelly(baza.db, { kosztZakupuBrutto: true }).tresc.split("\r\n")
      .slice(1).filter(Boolean).map(r => r.split(";")).filter(r => r[1] === "560115");
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r[2] === "MO1")).toMatchObject({ 4: "1022.04", 6: "1083,-", 8: "8" });
    expect(rows.find(r => r[2] === "MO3")).toMatchObject({ 4: "861.00", 6: "950,-", 8: "2" });
  });

  it("Tor 2 nie nadpisuje wspólnego kosztu przy dwóch magazynach, w obu kolejnościach", async () => {
    drugiMagazyn();
    slowniki();
    for (const kolejnosc of [["MO1", "MO3"], ["MO3", "MO1"]]) {
      const t = przygotuj(true);
      const { discovery } = stworzDiscoveryTestowe(t.atrapa.klient, budujPayloadProduktuV2);
      for (const dostawca of kolejnosc) {
        const r = await syncFullForDostawca(baza.db, discovery, dostawca!, { autoCreate: false, buildCache: false });
        expect(r.stats.err).toBe(0);
        expect(r.stats.updated_A).toBe(1);
      }
      const puts = t.atrapa.wywolania.filter(w => w.metoda === "updateProduct");
      expect(puts).toHaveLength(2);
      for (const p of puts) {
        expect(p.argumenty[1]).not.toHaveProperty("price_purchase");
        expect(p.argumenty[1]).not.toHaveProperty("price");
      }
      expect(t.koszt()).toBe(919.94);
      expect(t.atrapa.liczba("updateVariant")).toBe(0);
      expect(receipt()).toBeNull();
      expect(mapowanie(baza.db, "560115", "MO3")?.cena_zakupu_wyslana).toBeNull();
    }
  });

  it("Tor 2 chroni wspólny koszt także po odnalezieniu brakującego mapowania MO3", async () => {
    drugiMagazyn();
    slowniki();
    baza.sqlite.prepare("DELETE FROM selly_products WHERE dostawca='MO3'").run();
    const t = przygotuj(true);
    const { discovery } = stworzDiscoveryTestowe(t.atrapa.klient, budujPayloadProduktuV2);
    const r = await syncFullForDostawca(baza.db, discovery, "MO3", { buildCache: false });
    expect(r.stats.err).toBe(0);
    const payload = t.atrapa.wywolania.find(w => w.metoda === "updateProduct")?.argumenty[1];
    expect(payload).not.toHaveProperty("price_purchase");
    expect(t.koszt()).toBe(919.94);
  });

  it("nowa wspólna karta z dwóch ofert nie otrzymuje arbitralnego kosztu pierwszego dostawcy", async () => {
    drugiMagazyn();
    slowniki();
    baza.sqlite.prepare("DELETE FROM selly_products WHERE kod_importu='560115'").run();
    const atrapa = stworzAtrapeSelly();
    const { discovery } = stworzDiscoveryTestowe(atrapa.klient, budujPayloadProduktuV2);
    // MO1 nie ma statycznego ID: na produkcji discovery poznało już cechę magazynu 8.
    discovery.learnFeatureId("MO1", 8);
    const r = await syncFullForDostawca(baza.db, discovery, "MO1", { buildCache: false });
    expect(r.stats.err, JSON.stringify(r.errors)).toBe(0);
    const payload = atrapa.wywolania.find(w => w.metoda === "createProduct")?.argumenty[0];
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty("price_purchase");
  });

  it("Tor 2 jednoznacznej karty potwierdza koszt, nie zmienia sprzedaży i stanu", async () => {
    slowniki();
    const t = przygotuj();
    const { discovery } = stworzDiscoveryTestowe(t.atrapa.klient, budujPayloadProduktuV2);
    const r = await syncFullForDostawca(baza.db, discovery, "MO1", { autoCreate: false, buildCache: false });
    expect(r.stats.err).toBe(0);
    expect(t.koszt()).toBe(830.93);
    expect(receipt()).toBe(830.93);
    expect(t.atrapa.liczba("updateVariant")).toBe(0);
  });

  it("Tor 2 nie potwierdza kosztu, gdy GET po PUT nie potwierdza zapisu", async () => {
    slowniki();
    const t = przygotuj();
    t.niePotwierdzaj();
    const { discovery } = stworzDiscoveryTestowe(t.atrapa.klient, budujPayloadProduktuV2);
    const r = await syncFullForDostawca(baza.db, discovery, "MO1", { autoCreate: false, buildCache: false });
    expect(r.stats.err).toBe(1);
    expect(receipt()).toBeNull();
  });
});
