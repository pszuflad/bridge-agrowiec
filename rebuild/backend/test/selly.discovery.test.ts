/**
 * Lazy discovery mapowania Bridge → Selly (`src/selly/discovery.ts`, port `discovery.cjs`).
 *
 * ⚠ CO TE TESTY DOWODZĄ, A CZEGO NIE. Dowodzą, że nasz kod przechodzi te same ścieżki
 * i zapisuje to samo co kod Ani. NIE dowodzą, że Selly odpowiada tak, jak oboje zakładamy —
 * dla tras wariantowych (`/variants`) NIE MA nagrania w `contract/fixtures/`, bo nie da się
 * go zrobić bez odpytania żywego, cudzego sklepu (zakaz z CLAUDE.md). Kształty odpowiedzi
 * w atrapie są odczytane z KODU oryginału, nie nagrane. To jest świadoma granica dowodu,
 * opisana też w `raport.md`.
 *
 * Baza jest prawdziwym SQLite w katalogu tymczasowym — atrapowany jest wyłącznie klient HTTP.
 */
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { stworzDiscovery, type WierszBridge } from "../src/selly/discovery.js";
import type { WariantSelly } from "../src/selly/klient.js";
import { stworzLimiter, type ZegarLimitera } from "../src/selly/limiter.js";
import {
  stworzAtrapeSelly,
  stworzSrodowiskoTestowe,
  type AtrapaSelly,
  type OpcjeAtrapy,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Zegar sterowany — żeby throttle nie kosztował testu realnych 240 ms na wywołanie. */
function zegarTestowy(): ZegarLimitera & { drzemki: number[] } {
  let czas = 1_000_000;
  const drzemki: number[] = [];
  return {
    teraz: () => czas,
    spij: (ms: number) => {
      drzemki.push(ms);
      czas += ms;
      return Promise.resolve();
    },
    drzemki,
  };
}

const WIERSZ: WierszBridge = {
  kod: "MO2_19539",
  kod_importu: "798368",
  dostawca: "MO2",
  ean: "5901234123457",
  stan: 7,
  cena_sprzedazy: 1234.5,
  vat_rate: 23,
};

/** Wariant z cechą „Magazyny" — tak Selly oznacza, do którego dostawcy należy. */
const wariantMagazynu = (variantId: number, dostawca: string, featureId = 5): WariantSelly => ({
  variant_id: variantId,
  features: [{ feature_id: featureId, name: "Magazyny", value: dostawca }],
});

describe("discovery — mapowanie (kod_importu, dostawca) → (product_id, variant_id)", () => {
  let srodowisko: SrodowiskoTestowe;
  let atrapa: AtrapaSelly;
  let zegar: ReturnType<typeof zegarTestowy>;

  const zbuduj = (opcje: OpcjeAtrapy = {}) => {
    atrapa = stworzAtrapeSelly(opcje);
    zegar = zegarTestowy();
    return stworzDiscovery({
      klient: atrapa.klient,
      limiter: stworzLimiter(250, 60_000, zegar),
    });
  };

  const mapowanie = (db: Baza, kodImportu: string, dostawca: string) =>
    db
      .all<{
        selly_product_id: number;
        selly_variant_id: number | null;
        feature_id_magazyn: number | null;
        bridge_kod: string;
        ostatni_status: string;
      }>(
        sql`SELECT selly_product_id, selly_variant_id, feature_id_magazyn, bridge_kod, ostatni_status
            FROM selly_products WHERE kod_importu = ${kodImportu} AND dostawca = ${dostawca}`,
      )
      .at(0);

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
  });

  afterEach(() => srodowisko.posprzataj());

  describe("pięć wartości `action`", () => {
    it("`cache_hit` — zmapowany wariant NIE odpytuje Selly ani razu", async () => {
      const discovery = zbuduj();
      srodowisko.db.run(
        sql`INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id,
              selly_variant_id, feature_id_magazyn, ostatni_status)
            VALUES ('798368', 'MO2', 'MO2_19539', 812, 4242, 5, 'ok')`,
      );

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      expect(wynik).toEqual({
        product_id: 812,
        variant_id: 4242,
        feature_id_magazyn: 5,
        action: "cache_hit",
      });
      // Sedno „lazy": trafienie w cache nie kosztuje ANI JEDNEGO żądania.
      expect(atrapa.wywolania).toEqual([]);
    });

    it("`found_variant` — wariant z cechą Magazyny=MO2 znaleziony po EAN i zapisany", async () => {
      const discovery = zbuduj({
        produktyPoEan: { "5901234123457": 812 },
        wariantyProduktu: {
          812: [wariantMagazynu(9001, "MO9", 1), wariantMagazynu(9002, "MO2", 5)],
        },
      });

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      // Wybrany JEST drugi wariant — dopasowanie idzie po cesze, nie po kolejności.
      expect(wynik).toMatchObject({
        product_id: 812,
        variant_id: 9002,
        feature_id_magazyn: 5,
        action: "found_variant",
      });
      expect(mapowanie(srodowisko.db, "798368", "MO2")).toMatchObject({
        selly_product_id: 812,
        selly_variant_id: 9002,
        feature_id_magazyn: 5,
        bridge_kod: "MO2_19539",
        ostatni_status: "ok",
      });
      expect(atrapa.liczba("createVariant")).toBe(0);
    });

    it("`created_variant` — produkt jest, ale bez wariantu naszego dostawcy", async () => {
      const discovery = zbuduj({
        produktyPoEan: { "5901234123457": 812 },
        wariantyProduktu: { 812: [wariantMagazynu(9001, "MO9", 1)] },
      });

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      expect(wynik).toMatchObject({ product_id: 812, action: "created_variant" });
      expect(atrapa.liczba("createVariant")).toBe(1);

      const cialo = atrapa.wywolania.find((w) => w.metoda === "createVariant")?.argumenty[1];
      // ⚠ `attributes: []` jest WYMAGANE nawet puste — bez niego Selly odbija HTTP 400
      // „Brak wymaganego argumentu attributes" (poprawka Ani z 2026-09-08 12:50).
      expect(cialo).toMatchObject({
        quantity: 7,
        price: 1234.5,
        vat: 23,
        ean: "5901234123457",
        default: 0,
        attributes: [],
        features: [{ feature_id: 5, name: "Magazyny", value: "MO2" }],
      });
      expect(mapowanie(srodowisko.db, "798368", "MO2")?.selly_variant_id).toBe(
        (wynik as { variant_id: number }).variant_id,
      );
    });

    it("`not_found` — produktu nie ma w Selly, a Tor 1 nie dostaje słowników", async () => {
      const discovery = zbuduj({ produktyPoEan: {} });

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      // ⚠ KOMUNIKAT VERBATIM — `oznaczBlad` w `sync-delta.ts` rozpoznaje po nim
      // `pending_create` zamiast `error`. Zmiana słowa zamienia „czeka na Tor 2" w „awaria".
      expect(wynik).toEqual({
        error: "produkt nie istnieje w Selly ale brak dictMaps do createProduct",
        action: "not_found",
      });
      expect(mapowanie(srodowisko.db, "798368", "MO2")).toBeUndefined();
      expect(atrapa.liczba("createProduct")).toBe(0);
    });

    /**
     * ⭐ DEFEKT PRODUKCJI ODTWORZONY ŚWIADOMIE (ticket 45, decyzja D5).
     *
     * `discovery.cjs:147` woła `mapper.buildProductPayload(...)`, a `mapper_v2.cjs` takiej
     * funkcji NIE EKSPORTUJE (`mapper.cjs` v1 też nie) — sprawdzone na `main`. U Ani kończy
     * się to `TypeError` złapanym przez `catch` i zwróconym jako `{ error }`. Nie dopisujemy
     * brakującej funkcji, bo to byłoby projektowanie Toru 2 w tickecie o Torze 1 (→ 13d-2).
     *
     * Ścieżka jest osiągalna WYŁĄCZNIE ze słownikami, których Tor 1 nigdy nie podaje.
     */
    it("`created_product` jest w produkcji ZEPSUTE — brak `buildProductPayload` (D5)", async () => {
      const discovery = zbuduj({ produktyPoEan: {} });

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ, {
        catMap: new Map([["Rolnicze", 1]]),
        prodMap: new Map([["BKT", 2]]),
      });

      expect(wynik.action).toBe("not_found");
      expect(wynik.error).toContain("createProduct:");
      expect(wynik.error).toContain("buildProductPayload is not a function");
      expect(atrapa.liczba("createProduct")).toBe(0);
    });
  });

  describe("szczegóły algorytmu", () => {
    it("bez `kod_importu` albo `dostawca` kończy od razu, bez pytania Selly", async () => {
      const discovery = zbuduj();

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, {
        ...WIERSZ,
        kod_importu: null,
      });

      expect(wynik).toEqual({ error: "brak kod_importu lub dostawca" });
      expect(atrapa.wywolania).toEqual([]);
    });

    /**
     * Krok 3 oryginału: gdy EAN nie trafił, ale INNY wariant tego samego `kod_importu` jest
     * już zmapowany, `product_id` bierzemy z niego. Ten sam `kod_importu` = ten sam produkt
     * w Selly, tylko inny wariant — dzięki temu drugi dostawca nie pyta Selly o EAN na darmo.
     */
    it("„rodzeństwo” — product_id z innego wariantu tego samego kod_importu", async () => {
      const discovery = zbuduj({
        produktyPoEan: {}, // EAN nie trafia
        wariantyProduktu: { 812: [wariantMagazynu(9002, "MO2", 5)] },
      });
      srodowisko.db.run(
        sql`INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id,
              selly_variant_id, ostatni_status)
            VALUES ('798368', 'MO9', 'MO9_19539', 812, 9001, 'ok')`,
      );

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      expect(wynik).toMatchObject({ product_id: 812, variant_id: 9002, action: "found_variant" });
    });

    it("uczy się `feature_id` Magazynów dla dostawcy, którego nie znaliśmy", async () => {
      // MO6 nie jest w mapie znanych (`FEATURE_ID_MAGAZYNOW`) — ma tam `null`.
      const discovery = zbuduj({
        produktyPoEan: { "5901234123457": 900 },
        wariantyProduktu: { 900: [wariantMagazynu(7777, "MO6", 42)] },
      });
      expect(discovery.featureIdDlaDostawcy("MO6")).toBeNull();

      await discovery.zapewnijMapowanie(srodowisko.db, {
        ...WIERSZ,
        kod: "MO6_1",
        dostawca: "MO6",
      });

      expect(discovery.featureIdDlaDostawcy("MO6")).toBe(42);
    });

    it("nie nadpisuje znanego `feature_id` — nauka dotyczy tylko pustych", () => {
      const discovery = zbuduj();

      discovery.naucz("MO2", 999);

      expect(discovery.featureIdDlaDostawcy("MO2")).toBe(5);
    });

    /**
     * Wiersz BEZ `selly_variant_id` (np. zostawiony przez wcześniejszą nieudaną próbę) NIE
     * jest trafieniem w cache — warunek to `cached?.selly_variant_id`, nie samo istnienie
     * wiersza. Discovery idzie więc do Selly i domyka wpis przez
     * `ON CONFLICT(kod_importu, dostawca) DO UPDATE`, zamiast wywalić się na `UNIQUE`.
     */
    it("niedokończony wpis (bez variant_id) jest UZUPEŁNIANY, nie duplikowany", async () => {
      const discovery = zbuduj({
        produktyPoEan: { "5901234123457": 812 },
        wariantyProduktu: { 812: [wariantMagazynu(9002, "MO2", 5)] },
      });
      srodowisko.db.run(
        sql`INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id,
              selly_variant_id, ostatni_status)
            VALUES ('798368', 'MO2', 'MO2_STARY', 812, NULL, 'pending_create')`,
      );

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      expect(wynik).toMatchObject({ variant_id: 9002, action: "found_variant" });
      const wiersze = srodowisko.db.all<{ c: number }>(
        sql`SELECT count(*) AS c FROM selly_products
            WHERE kod_importu = '798368' AND dostawca = 'MO2'`,
      );
      expect(wiersze[0]?.c).toBe(1);
      expect(mapowanie(srodowisko.db, "798368", "MO2")).toMatchObject({
        selly_variant_id: 9002,
        bridge_kod: "MO2_19539",
        /*
         * ⚠ STATUS ZOSTAJE STARY — i to NIE jest przeoczenie testu. Klauzula
         * `DO UPDATE` oryginału (`discovery.cjs:229-234`) odświeża wyłącznie cztery
         * kolumny id-ków (`selly_product_id`, `selly_variant_id`, `feature_id_magazyn`,
         * `bridge_kod`); `ostatni_status` nie jest w tej liście, więc `pending_create`
         * przeżywa UDANE discovery. W Torze 1 nie boli, bo `markSynced` ustawia `ok`
         * chwilę później — ale wiersz, dla którego PUT padnie, zostanie z mylącym
         * `pending_create` mimo poprawnego mapowania.
         */
        ostatni_status: "pending_create",
      });
    });

    it("kolejne discovery dla zmapowanej pary to `cache_hit` — zero ruchu do Selly", async () => {
      const discovery = zbuduj({
        produktyPoEan: { "5901234123457": 812 },
        wariantyProduktu: { 812: [wariantMagazynu(9002, "MO2", 5)] },
      });

      await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);
      const poPierwszym = atrapa.wywolania.length;
      const drugi = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      expect(drugi.action).toBe("cache_hit");
      expect(atrapa.wywolania.length).toBe(poPierwszym);
    });

    /**
     * ⚠ `findProductByEan`/`fetchVariants` POŁYKAJĄ błąd i oddają `null`/`[]` — 1:1
     * z oryginałem. Skutek uboczny, który trzeba znać przy diagnozie: padnięte Selly wygląda
     * dokładnie tak samo jak „produktu nie ma", więc produkt ląduje w `pending_create`.
     */
    it("błąd HTTP przy szukaniu po EAN wygląda jak „produktu nie ma”", async () => {
      const discovery = zbuduj({
        bledy: { listProductsByEan: new Error("[Selly] HTTP 500 GET /api/products") },
      });

      const wynik = await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      expect(wynik.action).toBe("not_found");
      expect(wynik.error).toContain("brak dictMaps");
    });
  });

  describe("throttle i HTTP 429", () => {
    it("⭐ throttle idzie PRZED każdym żądaniem", async () => {
      const discovery = zbuduj({
        produktyPoEan: { "5901234123457": 812 },
        wariantyProduktu: { 812: [wariantMagazynu(9002, "MO2", 5)] },
      });

      await discovery.zapewnijMapowanie(srodowisko.db, WIERSZ);

      // Dwa żądania (EAN + warianty) — drugie musiało odczekać minimalny odstęp 240 ms.
      // To jest ta poprawka, która zamieniła ~730 błędów 429 z cyklu 20:10 w zero.
      expect(atrapa.liczba("listProductsByEan")).toBe(1);
      expect(atrapa.liczba("listVariants")).toBe(1);
      expect(zegar.drzemki).toEqual([240]);
    });

    /**
     * ⭐⭐ RETRY NA 429 JEST W ORYGINALE MARTWYM KODEM I U NAS TEŻ (ticket 45, decyzja D2).
     *
     * `client.cjs:56-60` (`request()`) ODRZUCA każdą odpowiedź spoza 2xx, a `apiWithRetry`
     * nie ma `try/catch` wokół wywołania — więc do sprawdzenia `if (r.status !== 429)`
     * sterowanie nigdy nie dociera ścieżką błędu. Nasz `zapytaj()` zachowuje się tak samo.
     *
     * Test utrwala zachowanie FAKTYCZNE, nie deklarowane: 429 leci wyjątkiem po PIERWSZEJ
     * próbie, bez ponowienia i bez oglądania się na `Retry-After`.
     */
    it("429 NIE jest ponawiany — leci wyjątkiem po pierwszej próbie", async () => {
      const discovery = zbuduj();
      const blad = Object.assign(new Error("[Selly] HTTP 429 PUT /api/products/1/variants/2"), {
        status: 429,
      });
      let prob = 0;

      await expect(
        discovery.wykonajZPonowieniem("PUT wariantu", () => {
          prob++;
          return Promise.reject(blad);
        }),
      ).rejects.toThrow("HTTP 429");

      expect(prob).toBe(1);
    });

    it("throttle działa też dla wywołania, które padło", async () => {
      const discovery = zbuduj();

      await discovery.wykonajZPonowieniem("pierwsze", () => Promise.resolve({ ok: true }));
      await expect(
        discovery.wykonajZPonowieniem("drugie", () => Promise.reject(new Error("boom"))),
      ).rejects.toThrow("boom");

      // Zgoda limitera jest pobierana ZANIM poleci żądanie — więc także to nieudane
      // zajęło miejsce w oknie i odczekało odstęp.
      expect(zegar.drzemki).toEqual([240]);
    });
  });
});
