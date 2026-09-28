/**
 * TOR 1 — delta ceny/stanu (`src/selly/rest/sync-delta.ts`, port
 * `origin/main:mirror/backend/selly/sync_delta.cjs`; karta I15.6, ticket 108).
 *
 * ⚠ To JEST operacja zmieniająca cudzy sklep (`PUT /api/products/{pid}/variants/{vid}`).
 * Testy chodzą wyłącznie po atrapie; baza — prawdziwy SQLite w katalogu tymczasowym.
 *
 * Produkty z `PRODUKTY_TESTOWE`: `MO9_336320` (aktywny, stan 2, cena 7252), `MO9_336319`
 * (aktywny, stan 2, cena 730), `MO2_200002` (aktywny, stan 7, cena 2730), `MO1_100001`
 * (wstrzymany, BEZ EAN).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BladSelly, type KlientSelly } from "../src/selly/klient.js";
import { findDeltaProducts, grupyKolizyjne, syncDelta } from "../src/selly/rest/sync-delta.js";
import { opakujKlientaTrybem } from "../src/selly/tryb.js";
import {
  PRODUKTY_TESTOWE,
  mapowanie,
  stworzAtrapeSelly,
  stworzDiscoveryTestowe,
  stworzTestowaBaze,
  zasiejMapowanie,
  zasiejProdukty,
  type OpcjeAtrapy,
  type TestowaBaza,
} from "./gate/index.js";

/** Kopia produktu wzorcowego — `PRODUKTY_TESTOWE[i]` bez `| undefined` z indeksowania. */
const produktWzorcowy = (i: number) => {
  const wzorzec = PRODUKTY_TESTOWE[i];
  if (!wzorzec) throw new Error(`brak PRODUKTY_TESTOWE[${i}]`);
  return wzorzec;
};

const magazyn = (dostawca: string, featureId: number) => ({ feature_id: featureId, name: "Magazyny", value: dostawca });

describe("Tor 1 — sync_delta", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejProdukty(baza.db);
  });
  afterEach(() => baza.posprzataj());

  const kody = () => findDeltaProducts(baza.db).map((w) => w.kod).sort();

  /** Mapowanie `MO9_336320` z wariantem 4242 i podanym snapshotem wysłanych wartości. */
  const zmapuj336320 = (stanWyslany: number | null, cenaWyslana: number | null) =>
    zasiejMapowanie(baza.sqlite, {
      kodImportu: "798368",
      dostawca: "MO9",
      bridgeKod: "MO9_336320",
      productId: 812,
      variantId: 4242,
      featureId: 1,
      stanWyslany,
      cenaWyslana,
    });

  const przygotuj = (opcje: OpcjeAtrapy = {}) => {
    const atrapa = stworzAtrapeSelly({
      sklep: [{ product_id: 812, ean: null, warianty: [{ variant_id: 4242, features: [magazyn("MO9", 1)] }] }],
      ...opcje,
    });
    return { atrapa, ...stworzDiscoveryTestowe(atrapa.klient) };
  };

  const wpisLogu = (id: number) =>
    baza.sqlite.prepare("SELECT * FROM selly_sync_log WHERE id = ?").get(id) as Record<string, unknown>;

  describe("findDeltaProducts", () => {
    it("aktywne z EAN i `kod_importu` bez mapowania wchodzą; bez EAN — nie", () => {
      expect(kody()).toEqual(["MO2_200002", "MO9_336319", "MO9_336320"]);
    });

    it("wysłany snapshot równy bieżącemu → poza deltą; zmiana ceny → z powrotem", () => {
      zmapuj336320(2, 7252);
      expect(kody()).not.toContain("MO9_336320");

      baza.sqlite.prepare("UPDATE products SET cena_sprzedazy = 7300 WHERE kod = 'MO9_336320'").run();
      expect(kody()).toContain("MO9_336320");
    });

    it("#77: `wstrzymany` z wariantem wchodzi ze stanem 0; bez mapowania — nie", () => {
      baza.sqlite.prepare("UPDATE products SET status = 'wstrzymany', stan = 5 WHERE kod = 'MO9_336320'").run();
      expect(kody()).not.toContain("MO9_336320");

      zmapuj336320(5, 7252);
      const wiersz = findDeltaProducts(baza.db).find((w) => w.kod === "MO9_336320");
      expect(wiersz).toMatchObject({ stan: 0, selly_variant_id: 4242 });

      // Po wysłaniu zera snapshot `stan_wyslany = 0` zgadza się z wymuszonym zerem — koniec delty.
      baza.sqlite.prepare("UPDATE selly_products SET stan_wyslany = 0 WHERE kod_importu = '798368'").run();
      expect(kody()).not.toContain("MO9_336320");
    });

    it("filtr dostawcy i limit", () => {
      expect(findDeltaProducts(baza.db, "MO2").map((w) => w.kod)).toEqual(["MO2_200002"]);
      expect(findDeltaProducts(baza.db, null, 1)).toHaveLength(1);
    });
  });

  describe("syncDelta", () => {
    it("mapowanie z JOIN-a → PUT `{quantity, price}`, snapshot i wpis w dzienniku", async () => {
      zmapuj336320(1, 7000);
      const { atrapa, discovery } = przygotuj();

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      // MO9_336319 bez mapowania i bez produktu w sklepie → `not_found` (Tor 1 nie zakłada).
      expect(wynik.stats).toEqual({ total: 2, ok: 1, err: 1, skip: 0, kolizje_kod_importu: 0, discovered: 0, created: 0 });
      expect(wynik.errors).toEqual([
        { kod: "MO9_336319", error: "produkt nie istnieje w Selly ale brak dictMaps do createProduct" },
      ]);
      const put = atrapa.wywolania.find((w) => w.metoda === "updateVariant");
      expect(put?.argumenty).toEqual([812, 4242, { quantity: 2, price: 7252 }]);
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
        stan_wyslany: 2,
        cena_sprzedazy_wyslana: 7252,
        cena_zakupu_wyslana: 5562.4,
        ostatni_status: "ok",
        ostatni_blad: null,
      });
      // #69: pozycja bez wiersza w `selly_products` nie zostawia śladu w bazie.
      expect(mapowanie(baza.db, "798369", "MO9")).toBeUndefined();

      const log = wpisLogu(wynik.logId);
      expect(log).toMatchObject({
        operacja: "sync_delta",
        dostawca_kod: "MO9",
        liczba_ok: 1,
        liczba_blad: 1,
        liczba_skip: 0,
        status: "zakonczono",
      });
      expect(JSON.parse(String(log.szczegoly_json))).toEqual({
        stats: wynik.stats,
        kolizje: [],
        sample_errors: wynik.errors,
      });
    });

    it("bez dostawcy → `dostawca_kod = 'ALL'`; same błędy → status `blad`", async () => {
      const { discovery } = przygotuj({ sklep: [] });

      const wynik = await syncDelta(baza.db, discovery);

      expect(wynik.stats).toMatchObject({ total: 3, ok: 0, err: 3 });
      expect(wpisLogu(wynik.logId)).toMatchObject({ dostawca_kod: "ALL", status: "blad" });
    });

    it("discovery znajduje wariant → `discovered` i PUT w tym samym przebiegu", async () => {
      const { discovery } = przygotuj({
        sklep: [
          {
            product_id: 900,
            ean: "8903094073627",
            warianty: [{ variant_id: 9100, features: [magazyn("MO9", 1)] }],
          },
        ],
      });

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(wynik.stats).toMatchObject({ ok: 1, discovered: 1 });
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
        selly_variant_id: 9100,
        stan_wyslany: 2,
        ostatni_status: "ok",
      });
    });

    it("#77: `wstrzymany` z wariantem → PUT ze stanem 0", async () => {
      baza.sqlite.prepare("UPDATE products SET status = 'wstrzymany', stan = 5 WHERE kod = 'MO9_336320'").run();
      zmapuj336320(5, 7252);
      const { atrapa, discovery } = przygotuj();

      await syncDelta(baza.db, discovery, "MO9");

      const put = atrapa.wywolania.find((w) => w.metoda === "updateVariant");
      expect(put?.argumenty).toEqual([812, 4242, { quantity: 0, price: 7252 }]);
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ stan_wyslany: 0 });
    });

    it("`dryRun` pomija PUT i snapshot, liczy `skip`", async () => {
      zmapuj336320(1, 7000);
      const { atrapa, discovery } = przygotuj();

      const wynik = await syncDelta(baza.db, discovery, "MO9", { dryRun: true });

      expect(wynik.stats).toMatchObject({ skip: 1, ok: 0 });
      expect(atrapa.liczba("updateVariant")).toBe(0);
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ stan_wyslany: 1, cena_sprzedazy_wyslana: 7000 });
    });

    /** Zastane 1:1 (`sync_delta.cjs:137,151`): `dryRun` nie chroni przed discovery. */
    it("⚠ `dryRun` NADAL uruchamia discovery — może założyć wariant w Selly", async () => {
      const { atrapa, discovery } = przygotuj({
        sklep: [{ product_id: 900, ean: "8903094073627", warianty: [] }],
      });

      await syncDelta(baza.db, discovery, "MO9", { dryRun: true });

      expect(atrapa.liczba("createVariant")).toBe(1);
      expect(atrapa.liczba("updateVariant")).toBe(0);
    });

    it("błąd PUT (HTTP spoza 2xx) → `error` z komunikatem klienta w `ostatni_blad`", async () => {
      zmapuj336320(1, 7000);
      const blad = new BladSelly("[Selly] HTTP 500 PUT https://atrapa/api/products/812/variants/4242 :: {}", 500, {});
      const { discovery } = przygotuj({ bledy: { updateVariant: blad } });

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(wynik.errors).toContainEqual({ kod: "MO9_336320", error: blad.message });
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({
        ostatni_status: "error",
        ostatni_blad: blad.message,
        stan_wyslany: 1,
      });
    });

    it("`pending_create` vs `error` rozróżniane po treści komunikatu discovery", async () => {
      // Wiersz bez wariantu istnieje, a produkt 812 zniknął ze sklepu: rodzeństwo daje 812,
      // warianty → 404 połknięte, `createVariant` → 404 → to jest `error`, nie `pending_create`.
      zasiejMapowanie(baza.sqlite, { kodImportu: "798368", dostawca: "MO9", bridgeKod: "MO9_336320", productId: 812 });
      const { discovery } = przygotuj({ sklep: [] });

      await syncDelta(baza.db, discovery, "MO9");

      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ ostatni_status: "error" });
      expect(mapowanie(baza.db, "798368", "MO9")?.ostatni_blad).toMatch(/^createVariant: \[Selly\] HTTP 404/);
    });

    it("⚠ SELLY_TRYB=tylko-odczyt: PUT wariantu zablokowany, nie dociera do sklepu", async () => {
      zmapuj336320(1, 7000);
      const atrapa = stworzAtrapeSelly();
      const { discovery } = stworzDiscoveryTestowe(opakujKlientaTrybem(atrapa.klient, "tylko-odczyt"));

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(atrapa.liczba("updateVariant")).toBe(0);
      expect(wynik.errors).toContainEqual({
        kod: "MO9_336320",
        error: "[Selly] Zapis do Selly zablokowany na tym środowisku (SELLY_TRYB=tylko-odczyt)",
      });
      expect(mapowanie(baza.db, "798368", "MO9")).toMatchObject({ ostatni_status: "error", stan_wyslany: 1 });
    });
  });

  /**
   * Backlog #104 (`origin/main:abe5f14`) — stan i cena są czytane z bazy DOPIERO tuż przed
   * wysyłką, bo import mógł wstrzymać pozycję w trakcie biegu (discovery bywa długie).
   */
  describe("#104 — żywy odczyt tuż przed wysyłką", () => {
    /** Podmienia `updateVariant` tak, by PRZED pierwszym PUT-em wykonać `zmiana()` na bazie. */
    const wstrzyknijZmianeWTrakcie = (atrapa: { klient: { updateVariant: KlientSelly["updateVariant"] } }, zmiana: () => void) => {
      const oryginalny = atrapa.klient.updateVariant.bind(atrapa.klient);
      let pierwszy = true;
      atrapa.klient.updateVariant = async (pid, vid, cialo) => {
        if (pierwszy) {
          pierwszy = false;
          zmiana();
        }
        return oryginalny(pid, vid, cialo);
      };
    };

    const zmapuj336319 = () =>
      zasiejMapowanie(baza.sqlite, {
        kodImportu: "798369",
        dostawca: "MO9",
        bridgeKod: "MO9_336319",
        productId: 812,
        variantId: 4243,
        featureId: 1,
        stanWyslany: 99,
        cenaWyslana: 1,
      });

    const sklepZDwomaWariantami = () => ({
      sklep: [
        {
          product_id: 812,
          ean: null,
          warianty: [
            { variant_id: 4242, features: [magazyn("MO9", 1)] },
            { variant_id: 4243, features: [magazyn("MO9", 1)] },
          ],
        },
      ],
    });

    it("wstrzymany w TRAKCIE biegu → idzie stan 0, nie migawka sprzed wstrzymania", async () => {
      zmapuj336320(0, 0);
      zmapuj336319();
      const { atrapa, discovery } = przygotuj(sklepZDwomaWariantami());
      // W trakcie biegu import wstrzymuje MO9_336319 (stan w migawce: 2).
      wstrzyknijZmianeWTrakcie(atrapa, () =>
        baza.sqlite.prepare("UPDATE products SET status = 'wstrzymany' WHERE kod = 'MO9_336319'").run(),
      );

      await syncDelta(baza.db, discovery, "MO9");

      const put = atrapa.wywolania.find((w) => w.metoda === "updateVariant" && w.argumenty[1] === 4243);
      expect(put?.argumenty[2]).toMatchObject({ quantity: 0 });
    });

    it("wstrzymany w trakcie, ale grupa ma INNĄ aktywną ofertę → skip, żadnego PUT-a", async () => {
      // Druga, aktywna oferta w tej samej grupie (MO9, kod_importu 798369).
      zasiejProdukty(baza.db, [
        {
          ...produktWzorcowy(1),
          kod: "MO9_336319B",
          ean: "8903094073999",
          eanRaw: "8903094073999",
        },
      ]);
      zmapuj336320(0, 0);
      zmapuj336319();
      const { atrapa, discovery } = przygotuj(sklepZDwomaWariantami());
      wstrzyknijZmianeWTrakcie(atrapa, () =>
        baza.sqlite.prepare("UPDATE products SET status = 'wstrzymany' WHERE kod = 'MO9_336319'").run(),
      );

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      // Wariant 4243 jest WSPÓLNY dla grupy: aktywna bliźniaczka MOŻE go aktualizować, ale
      // wstrzymana pozycja NIE MOŻE go wyzerować — to zabiłoby sprzedaż tamtej oferty.
      const zerujace = atrapa.wywolania.filter(
        (w) =>
          w.metoda === "updateVariant" &&
          w.argumenty[1] === 4243 &&
          (w.argumenty[2] as { quantity?: number }).quantity === 0,
      );
      expect(zerujace).toHaveLength(0);
      expect(wynik.stats.skip).toBeGreaterThanOrEqual(1);
    });

    it("produkt zniknął z bazy w trakcie biegu → skip", async () => {
      zmapuj336320(0, 0);
      zmapuj336319();
      const { atrapa, discovery } = przygotuj(sklepZDwomaWariantami());
      wstrzyknijZmianeWTrakcie(atrapa, () =>
        baza.sqlite.prepare("DELETE FROM products WHERE kod = 'MO9_336319'").run(),
      );

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(atrapa.wywolania.filter((w) => w.metoda === "updateVariant" && w.argumenty[1] === 4243)).toHaveLength(0);
      expect(wynik.stats.skip).toBeGreaterThanOrEqual(1);
    });

    it("cena zmieniona w trakcie biegu → wysyłana jest ŻYWA cena, nie migawka", async () => {
      zmapuj336320(0, 0);
      zmapuj336319();
      const { atrapa, discovery } = przygotuj(sklepZDwomaWariantami());
      wstrzyknijZmianeWTrakcie(atrapa, () =>
        baza.sqlite.prepare("UPDATE products SET cena_sprzedazy = 999 WHERE kod = 'MO9_336319'").run(),
      );

      await syncDelta(baza.db, discovery, "MO9");

      const put = atrapa.wywolania.find((w) => w.metoda === "updateVariant" && w.argumenty[1] === 4243);
      expect(put?.argumenty[2]).toMatchObject({ price: 999 });
    });
  });

  /**
   * Backlog #104 — mapowany wariant wchodzi do delty BEZ EAN-u (wcześniej EAN był wymagany
   * bezwarunkowo), a wstrzymany z aktywną ofertą w grupie wypada z niej całkiem.
   */
  describe("#104 — warunek wyboru kandydatów", () => {
    it("wstrzymany BEZ EAN, ale z mapowanym wariantem → wchodzi do delty i zeruje się", () => {
      // MO1_100001 jest wstrzymany i nie ma EAN-u — bez mapowania wariantu nie wchodził.
      expect(kody()).not.toContain("MO1_100001");

      zasiejMapowanie(baza.sqlite, {
        kodImportu: "100001",
        dostawca: "MO1",
        bridgeKod: "MO1_100001",
        productId: 900,
        variantId: 7777,
        featureId: 3,
      });

      expect(kody()).toContain("MO1_100001");
      expect(findDeltaProducts(baza.db).find((w) => w.kod === "MO1_100001")?.stan).toBe(0);
    });

    it("wstrzymany z wariantem, ale grupa ma inną AKTYWNĄ ofertę → wypada z delty", () => {
      zasiejMapowanie(baza.sqlite, {
        kodImportu: "100001",
        dostawca: "MO1",
        bridgeKod: "MO1_100001",
        productId: 900,
        variantId: 7777,
        featureId: 3,
      });
      expect(kody()).toContain("MO1_100001");

      // Ta sama grupa (MO1, 100001), ale oferta czynna — zerowanie wspólnego wariantu odpada.
      zasiejProdukty(baza.db, [
        {
          ...produktWzorcowy(2),
          kod: "MO1_100001B",
          status: "aktywny",
        },
      ]);

      expect(kody()).not.toContain("MO1_100001");
    });
  });

  /**
   * Backlog #108 — kolizje `kod_importu`. Zawór (pomijanie) z `wejscie-117.md` został WYCOFANY
   * po wyjaśnieniu Ani z 2026-09-23; zostaje samo raportowanie, wysyłka bez zmian.
   */
  describe("#108 — kolizje kod_importu (raport, bez pomijania)", () => {
    /** Druga AKTYWNA oferta w grupie (MO9, 798368) — różny EAN, inna cena i stan. */
    const dodajBliznaka = () =>
      zasiejProdukty(baza.db, [
        {
          ...produktWzorcowy(0),
          kod: "MO9_336320B",
          ean: "8903094079999",
          eanRaw: "8903094079999",
          stan: 9,
          cenaSprzedazy: 6000,
        },
      ]);

    it("grupa z >1 aktywnym produktem jest wykryta i opisana", () => {
      dodajBliznaka();

      expect(grupyKolizyjne(baza.db, "MO9")).toEqual([
        { dostawca: "MO9", kod_importu: "798368", liczba: 2, rozne_ceny_lub_stany: true },
      ]);
    });

    it("ten sam kod_importu u RÓŻNYCH dostawców to wielomagazynowość, NIE kolizja", () => {
      // Potwierdzone przez Anię 2026-09-23: jedna karta w Selly, różne ceny i magazyny.
      zasiejProdukty(baza.db, [
        {
          ...produktWzorcowy(0),
          kod: "MO2_336320",
          dostawca: "MO2",
          ean: "8903094078888",
          eanRaw: "8903094078888",
        },
      ]);

      expect(grupyKolizyjne(baza.db)).toEqual([]);
    });

    it("kolizja jest RAPORTOWANA, a pozycje mimo to WYSŁANE (zachowanie produkcji)", async () => {
      dodajBliznaka();
      zmapuj336320(0, 0);
      const { atrapa, discovery } = przygotuj();

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(wynik.stats.kolizje_kod_importu).toBe(1);
      expect(wynik.kolizje).toEqual([
        { dostawca: "MO9", kod_importu: "798368", liczba: 2, rozne_ceny_lub_stany: true },
      ]);
      // Sedno decyzji: NIC nie zostało pominięte z powodu kolizji.
      expect(atrapa.liczba("updateVariant")).toBeGreaterThan(0);

      const szczegoly = JSON.parse(String(wpisLogu(wynik.logId).szczegoly_json)) as {
        stats: { kolizje_kod_importu: number };
        kolizje: { kod_importu: string }[];
      };
      expect(szczegoly.stats.kolizje_kod_importu).toBe(1);
      expect(szczegoly.kolizje).toEqual([
        { dostawca: "MO9", kod_importu: "798368", liczba: 2, rozne_ceny_lub_stany: true },
      ]);
    });

    it("grupa bez kolizji → licznik zero i pusta lista", async () => {
      zmapuj336320(0, 0);
      const { discovery } = przygotuj();

      const wynik = await syncDelta(baza.db, discovery, "MO9");

      expect(wynik.stats.kolizje_kod_importu).toBe(0);
      expect(wynik.kolizje).toEqual([]);
    });
  });
});
