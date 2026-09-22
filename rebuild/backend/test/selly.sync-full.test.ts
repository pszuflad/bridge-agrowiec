/**
 * TOR 2 — pełna synchronizacja (`src/selly/rest/sync-full.ts`, port
 * `origin/main:mirror/backend/selly/sync_full.cjs`; karta I15.7, ticket 109).
 *
 * ⚠ To JEST operacja zmieniająca cudzy sklep (`PUT /api/products/{pid}`, auto-create produktów).
 * Testy chodzą wyłącznie po atrapie; baza — prawdziwy SQLite w katalogu tymczasowym.
 *
 * Produkty z `PRODUKTY_TESTOWE`: `MO9_336320` (aktywny, `kategoria` Rolnicze, komplet metadanych),
 * `MO9_336319` (aktywny, Rolnicze, uboższy), `MO2_200002` (aktywny, „Przyczepy” — kategoria POZA
 * `selly_kategoria_norm_map`), `MO1_100001` (wstrzymany, bez EAN).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sellyDict } from "../src/db/schema.js";
import { budujPayloadProduktuV2 } from "../src/selly/rest/mapper-v2.js";
import { collectFullSyncItems, loadDictMaps, syncFullForDostawca } from "../src/selly/rest/sync-full.js";
import { opakujKlientaTrybem } from "../src/selly/tryb.js";
import {
  mapowanie,
  stworzAtrapeSelly,
  stworzDiscoveryTestowe,
  stworzTestowaBaze,
  zasiejMapowanie,
  zasiejMapySelly,
  zasiejProdukty,
  type OpcjeAtrapy,
  type TestowaBaza,
} from "./gate/index.js";

const magazyn = (dostawca: string, featureId: number) => ({ feature_id: featureId, name: "Magazyny", value: dostawca });

/** Wywołania atrapy danej metody — do sprawdzania ciał PUT-ów. */
const argumenty = (atrapa: ReturnType<typeof stworzAtrapeSelly>, metoda: string): unknown[][] =>
  atrapa.wywolania.filter((w) => w.metoda === metoda).map((w) => w.argumenty);

type Cecha = { name: string; values: unknown };
type PayloadPut = { features?: Cecha[]; category_id?: number; name?: string; provider_code?: string };

describe("Tor 2 — sync_full", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejProdukty(baza.db);
    // `catMap` (Rolnicze → 1, Leśne → 2, Przemysłowe → 3; „Przyczepy" świadomie poza mapą)
    zasiejMapySelly(baza.db);
    baza.db
      .insert(sellyDict)
      .values([
        { slownik: "producers", klucz: "bkt", wartoscId: 6 },
        { slownik: "producers", klucz: "alliance", wartoscId: 3 },
        { slownik: "warehouses", klucz: "mo9", wartoscId: 1 },
      ])
      .run();
  });
  afterEach(() => baza.posprzataj());

  /** Discovery z PRAWDZIWYM mapperem v2 — ścieżka C ma iść przez port, nie przez atrapę payloadu. */
  const przygotuj = (opcje: OpcjeAtrapy = {}) => {
    const atrapa = stworzAtrapeSelly(opcje);
    return { atrapa, ...stworzDiscoveryTestowe(atrapa.klient, budujPayloadProduktuV2) };
  };

  const wpisLogu = (id: number) =>
    baza.sqlite.prepare("SELECT * FROM selly_sync_log WHERE id = ?").get(id) as Record<string, unknown>;

  /** `MO9_336320` (`kod_importu` 798368) zmapowany na produkt 812, wariant 4242. */
  const zmapuj336320 = (productId = 812, variantId = 4242) =>
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "798368",
      dostawca: "MO9",
      bridgeKod: "MO9_336320",
      productId,
      variantId,
      featureId: 1,
    });

  const zmapuj336319 = (productId = 812, variantId = 4243) =>
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "798369",
      dostawca: "MO9",
      bridgeKod: "MO9_336319",
      productId,
      variantId,
      featureId: 1,
    });

  describe("zbieranie pozycji i słowniki", () => {
    it("bierze aktywne z `kod_importu` po `kod` rosnąco — bez EAN-u też (inaczej niż Tor 1)", () => {
      expect(collectFullSyncItems(baza.db, "MO9").map((w) => w.kod)).toEqual(["MO9_336319", "MO9_336320"]);
      // `MO1_100001` jest `wstrzymany` — Tor 2 go nie rusza, mimo że ma `kod_importu`.
      expect(collectFullSyncItems(baza.db, "MO1")).toEqual([]);
    });

    it("`loadDictMaps` czyta kategorie z `selly_kategoria_norm_map` (klucz małymi literami) i `selly_dict`", () => {
      const mapy = loadDictMaps(baza.db);
      // Backlog #74: ID kategorii są DANYMI — 1/2/3, nic zahardkodowanego w kodzie.
      expect(mapy.catMap.get("rolnicze")).toBe(1);
      expect(mapy.catMap.get("leśne")).toBe(2);
      expect(mapy.catMap.get("przyczepy")).toBeUndefined();
      expect(mapy.prodMap.get("bkt")).toBe(6);
      expect(mapy.whMap.get("mo9")).toBe(1);
    });
  });

  describe("ścieżka A — wariant w cache", () => {
    it("właściciel metadanych: GET, potem PUT z lustrem cech i `category_id`", async () => {
      zmapuj336320();
      const { atrapa, discovery } = przygotuj({
        sklep: [
          {
            product_id: 812,
            ean: null,
            features: [
              { name: "Kolor", values: ["czarny"] },
              { name: "Marka", values: ["STARA MARKA"] },
            ],
            warianty: [{ variant_id: 4242, features: [magazyn("MO9", 1)] }],
          },
        ],
      });

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO9", { autoCreate: false });

      expect(wynik.stats).toMatchObject({ total: 2, updated_A: 1, skip: 1, err: 0 });
      expect(atrapa.liczba("getProduct")).toBe(1);

      const payload = argumenty(atrapa, "updateProduct")[0]?.[1] as PayloadPut;
      expect(payload.category_id).toBe(1);
      expect(payload.features).toContainEqual({ name: "Kolor", values: ["czarny"] });
      expect(payload.features).toContainEqual({ name: "Marka", values: ["BKT"] });
      // Stan sklepu po PUT — cechy faktycznie podmienione.
      expect(atrapa.sklep.get(812)?.features).toContainEqual({ name: "Marka", values: ["BKT"] });

      const wiersz = mapowanie(baza.db, "798368", "MO9");
      expect(wiersz).toMatchObject({ ostatni_status: "ok", ostatni_blad: null, cena_zakupu_wyslana: 5562.4 });
    });

    it("kanoniczny jest rekord z najbogatszymi metadanymi — drugi dostaje PUT bez cech", async () => {
      zmapuj336320();
      zmapuj336319();
      const { atrapa, discovery } = przygotuj({
        sklep: [
          {
            product_id: 812,
            ean: null,
            features: [],
            warianty: [
              { variant_id: 4242, features: [magazyn("MO9", 1)] },
              { variant_id: 4243, features: [magazyn("MO9", 1)] },
            ],
          },
        ],
      });

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO9");

      expect(wynik.stats).toMatchObject({ total: 2, updated_A: 2, err: 0 });
      // GET tylko raz — dla właściciela, czyli `MO9_336320` (więcej wypełnionych pól metadanych).
      expect(atrapa.liczba("getProduct")).toBe(1);
      expect(argumenty(atrapa, "getProduct")).toEqual([[812]]);

      const payloady = argumenty(atrapa, "updateProduct").map((a) => a[1] as PayloadPut);
      const zCechami = payloady.filter((p) => p.features !== undefined);
      expect(zCechami).toHaveLength(1);
      expect(zCechami[0]?.provider_code).toBe("798368");
    });

    it("grupa o różnych kategoriach jest pomijana — nikt nie pisze cech ani kategorii", async () => {
      zmapuj336320();
      // `MO2_200002` ma kategorię „Przyczepy" — inną niż „Rolnicze" rekordu MO9 na tym samym produkcie.
      zasiejMapowanie(baza.sqlite, {
        kodImportu: "235633",
        dostawca: "MO2",
        bridgeKod: "MO2_200002",
        productId: 812,
        variantId: 4244,
        featureId: 5,
      });
      const { atrapa, discovery } = przygotuj({
        sklep: [{ product_id: 812, ean: null, features: [], warianty: [{ variant_id: 4242, features: [] }] }],
      });

      await syncFullForDostawca(baza.db, discovery, "MO9", { autoCreate: false });

      expect(atrapa.liczba("getProduct")).toBe(0);
      const payload = argumenty(atrapa, "updateProduct")[0]?.[1] as PayloadPut;
      expect(payload.features).toBeUndefined();
      expect(payload.category_id).toBeUndefined();
    });
  });

  describe("ścieżki B i C — brak wariantu", () => {
    it("B: produkt w Selly znaleziony po EAN — nowy wariant dostawcy, potem PUT bez cech", async () => {
      const { atrapa, discovery } = przygotuj({
        sklep: [
          {
            product_id: 900,
            ean: "8903094073627",
            features: [],
            warianty: [{ variant_id: 7001, default: 1, features: [magazyn("MO2", 5)] }],
          },
        ],
        rozmiarStrony: 50,
      });

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO9", { maxProducts: 1 });

      expect(wynik.stats).toMatchObject({ total: 1, created_variant_B: 0, created_C: 1 });
      // `maxProducts: 1` bierze pierwszy po `kod` — `MO9_336319`, którego EAN-u sklep nie zna → ścieżka C.
      expect(atrapa.liczba("createProduct")).toBe(1);

      const wynik2 = await syncFullForDostawca(baza.db, discovery, "MO9", { buildCache: false });
      expect(wynik2.stats.created_variant_B).toBe(1);
      const wiersz = mapowanie(baza.db, "798368", "MO9");
      expect(wiersz).toMatchObject({ selly_product_id: 900, ostatni_status: "ok" });
      const payloadPut = argumenty(atrapa, "updateProduct").at(-1)?.[1] as PayloadPut;
      expect(payloadPut.features).toBeUndefined();
    });

    it("C: auto-create przez prawdziwy mapper — `category_id` ze słownika, cechy w POST", async () => {
      const { atrapa, discovery } = przygotuj();

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO9");

      expect(wynik.stats).toMatchObject({ total: 2, created_C: 2, err: 0 });
      const payloadPost = argumenty(atrapa, "createProduct")[0]?.[0] as PayloadPut & {
        product_code?: string;
        producer_id?: number;
        price?: number;
      };
      expect(payloadPost).toMatchObject({ category_id: 1, producer_id: 6, product_code: "MO9336319", price: 730 });
      expect(payloadPost.features).toContainEqual({ name: "Marka", values: ["BKT"] });

      const wiersz = mapowanie(baza.db, "798369", "MO9");
      expect(wiersz).toMatchObject({ selly_category_id: 1, selly_producer_id: 6, ostatni_status: "ok" });
    });

    it("`autoCreate: false` pomija wszystko bez wariantu i nie buduje cache kodów", async () => {
      const { atrapa, discovery } = przygotuj();

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO9", { autoCreate: false });

      expect(wynik.stats).toMatchObject({ total: 2, skip: 2, updated_A: 0 });
      expect(atrapa.wywolania).toEqual([]);
      expect(wpisLogu(wynik.logId)).toMatchObject({ liczba_skip: 2, status: "zakonczono" });
    });

    it("kategoria spoza słownika → `missing_dict` w `selly_products` i status logu `blad`", async () => {
      zasiejMapowanie(baza.sqlite, {
        kodImportu: "235633",
        dostawca: "MO2",
        bridgeKod: "MO2_200002",
        productId: 0,
        variantId: null,
      });
      const { discovery } = przygotuj();

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO2");

      expect(wynik.stats).toMatchObject({ total: 1, err: 1, created_C: 0 });
      expect(wynik.errors[0]?.error).toContain("Brak kategorii w slowniku");
      expect(mapowanie(baza.db, "235633", "MO2")?.ostatni_status).toBe("missing_dict");
      expect(wpisLogu(wynik.logId)).toMatchObject({ status: "blad", liczba_blad: 1, liczba_ok: 0 });
    });
  });

  describe("dry-run i blokada środowiskowa", () => {
    it("`dryRun` nie woła Selly poza cache kodów i nie dotyka `selly_products`", async () => {
      zmapuj336320();
      const { atrapa, discovery } = przygotuj({
        sklep: [{ product_id: 812, ean: null, features: [], warianty: [{ variant_id: 4242, features: [] }] }],
      });

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO9", { dryRun: true });

      expect(wynik.stats).toMatchObject({ total: 2, dry: 2, err: 0, updated_A: 0 });
      expect(atrapa.wywolania.map((w) => w.metoda)).toEqual(["listProductsPage"]);
      // Wpis mapowania zostaje nietknięty: bez `ostatnia_sync`, bez zmiany snapshotu.
      expect(mapowanie(baza.db, "798368", "MO9")?.cena_zakupu_wyslana).toBeNull();
      expect(wpisLogu(wynik.logId)).toMatchObject({ liczba_skip: 2, liczba_ok: 0, status: "zakonczono" });
    });

    it("`SELLY_TRYB=tylko-odczyt` — żaden zapis nie dochodzi do sklepu, wszystko ląduje jako błąd", async () => {
      zmapuj336320();
      const atrapa = stworzAtrapeSelly({
        sklep: [{ product_id: 812, ean: null, features: [], warianty: [{ variant_id: 4242, features: [] }] }],
      });
      const { discovery } = stworzDiscoveryTestowe(
        opakujKlientaTrybem(atrapa.klient, "tylko-odczyt"),
        budujPayloadProduktuV2,
      );

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO9");

      expect(wynik.stats).toMatchObject({ err: 2, updated_A: 0, created_C: 0 });
      expect(atrapa.liczba("updateProduct")).toBe(0);
      expect(atrapa.liczba("createProduct")).toBe(0);
      expect(wynik.errors[0]?.error).toContain("Zapis do Selly zablokowany");
      expect(mapowanie(baza.db, "798368", "MO9")?.ostatni_status).toBe("error");
    });
  });

  describe("log i limit", () => {
    it("`maxProducts` ucina listę, a `szczegoly_json` niesie statystyki, czas i stan limitera", async () => {
      const { discovery } = przygotuj();

      const wynik = await syncFullForDostawca(baza.db, discovery, "MO9", { maxProducts: 1 });

      expect(wynik.stats.total).toBe(1);
      const szczegoly = JSON.parse(wpisLogu(wynik.logId)["szczegoly_json"] as string) as Record<string, unknown>;
      expect(szczegoly).toMatchObject({ dostawca: "MO9", dryRun: false, autoCreate: true });
      expect(szczegoly["stats"]).toMatchObject({ total: 1, created_C: 1 });
      expect(szczegoly).toHaveProperty("duration_ms");
      expect(szczegoly["limiter"]).toMatchObject({ capacity: 250 });
    });

    it("bez dostawcy rzuca — `sync_full: dostawca wymagany`", async () => {
      const { discovery } = przygotuj();
      await expect(syncFullForDostawca(baza.db, discovery, "")).rejects.toThrow("sync_full: dostawca wymagany");
    });
  });
});
