/**
 * TOR 1 — delta stan/cena (`src/selly/sync-delta.ts`, port `sync_delta.cjs`).
 *
 * ⚠ To JEST operacja, która zmienia cudzy sklep — `PUT /api/products/{pid}/variants/{vid}`.
 * Testy chodzą wyłącznie po atrapie klienta; żaden bieg `npm test` nie ma prawa dotknąć
 * `agroopony.selly24.pl`. Baza jest prawdziwym SQLite w katalogu tymczasowym.
 *
 * Granica dowodu jak w `selly.discovery.test.ts`: dowodzimy zgodności z kodem Ani, nie
 * zgodności naszych założeń z realnym API Selly (dla wariantów nie ma nagrania w fixtures).
 */
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { stworzDiscovery } from "../src/selly/discovery.js";
import { stworzLimiter, type ZegarLimitera } from "../src/selly/limiter.js";
import { syncDelta, znajdzProduktyDelta } from "../src/selly/sync-delta.js";
import {
  stworzAtrapeSelly,
  stworzSrodowiskoTestowe,
  zasiejMapowanieWariantowe,
  zasiejProdukty,
  type AtrapaSelly,
  type OpcjeAtrapy,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Zegar sterowany — throttle nie ma kosztować testu realnych 240 ms na żądanie. */
const zegarTestowy = (): ZegarLimitera => {
  let czas = 1_000_000;
  return {
    teraz: () => czas,
    spij: (ms: number) => {
      czas += ms;
      return Promise.resolve();
    },
  };
};

/**
 * Produkt `MO9_336320` z `PRODUKTY_TESTOWE`: aktywny, EAN `8903094073627`,
 * `kod_importu` „798368", stan 2, cena 7252. Spełnia komplet filtrów `findDeltaProducts`.
 */
const KOD_IMPORTU = "798368";

describe("Tor 1 — delta stan/cena", () => {
  let srodowisko: SrodowiskoTestowe;
  let atrapa: AtrapaSelly;

  const zaleznosci = (opcje: OpcjeAtrapy = {}) => {
    atrapa = stworzAtrapeSelly(opcje);
    const discovery = stworzDiscovery({
      klient: atrapa.klient,
      limiter: stworzLimiter(250, 60_000, zegarTestowy()),
    });
    return { db: srodowisko.db, klient: atrapa.klient, discovery };
  };

  const wpis = (db: Baza, kodImportu: string, dostawca: string) =>
    db
      .all<{
        stan_wyslany: number | null;
        cena_sprzedazy_wyslana: number | null;
        cena_zakupu_wyslana: number | null;
        ostatni_status: string;
        ostatni_blad: string | null;
      }>(
        sql`SELECT stan_wyslany, cena_sprzedazy_wyslana, cena_zakupu_wyslana,
                   ostatni_status, ostatni_blad
            FROM selly_products WHERE kod_importu = ${kodImportu} AND dostawca = ${dostawca}`,
      )
      .at(0);

  const zasiejZmapowany = (stanWyslany: number | null, cenaWyslana: number | null) =>
    zasiejMapowanieWariantowe(srodowisko.db, [
      {
        kod: "MO9_336320",
        kodImportu: KOD_IMPORTU,
        dostawca: "MO9",
        sellyProductId: 812,
        sellyVariantId: 4242,
        featureIdMagazyn: 1,
        stanWyslany,
        cenaSprzedazyWyslana: cenaWyslana,
      },
    ]);

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
  });

  afterEach(() => srodowisko.posprzataj());

  describe("`znajdzProduktyDelta` — kto w ogóle wchodzi do przebiegu", () => {
    it("bierze produkty aktywne z EAN-em i `kod_importu`, gdy brak mapowania", () => {
      const wiersze = znajdzProduktyDelta(srodowisko.db, "MO9");

      // `MO9_336320` i `MO9_336319` — oba aktywne i z EAN-em.
      expect(wiersze.map((w) => w.kod).sort()).toEqual(["MO9_336319", "MO9_336320"]);
      // Wiersz niesie klucze `snake_case` — cały moduł czyta `row.kod_importu`, jak oryginał.
      expect(wiersze[0]).toHaveProperty("kod_importu");
      expect(wiersze[0]).toHaveProperty("cena_sprzedazy");
    });

    it("pomija wstrzymane i te bez EAN-u", () => {
      // MO1_100001 jest „wstrzymany", MO8_… nie ma EAN-u.
      const wszystkie = znajdzProduktyDelta(srodowisko.db);

      expect(wszystkie.map((w) => w.kod)).not.toContain("MO1_100001");
      for (const w of wszystkie) {
        expect(w.ean).toBeTruthy();
        expect(w.kod_importu).toBeTruthy();
      }
    });

    it("⭐ pomija produkt, którego stan i cena są już wysłane", () => {
      zasiejZmapowany(2, 7252); // dokładnie to, co ma produkt w Bridge

      const wiersze = znajdzProduktyDelta(srodowisko.db, "MO9");

      expect(wiersze.map((w) => w.kod)).toEqual(["MO9_336319"]);
    });

    it("łapie produkt, gdy różni się SAM stan", () => {
      zasiejZmapowany(99, 7252);

      const wiersze = znajdzProduktyDelta(srodowisko.db, "MO9");

      expect(wiersze.map((w) => w.kod)).toContain("MO9_336320");
    });

    it("łapie produkt, gdy różni się SAMA cena", () => {
      zasiejZmapowany(2, 1);

      const wiersze = znajdzProduktyDelta(srodowisko.db, "MO9");

      expect(wiersze.map((w) => w.kod)).toContain("MO9_336320");
    });

    it("`limit` obcina wynik", () => {
      expect(znajdzProduktyDelta(srodowisko.db, "MO9", 1)).toHaveLength(1);
    });
  });

  describe("`syncDelta` — wysyłka", () => {
    it("⭐ zmapowany produkt idzie PUT-em na wariant i odświeża snapshot", async () => {
      zasiejZmapowany(99, 1); // stan i cena rozjechane → wchodzi do delty
      const zal = zaleznosci();

      const wynik = await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(wynik.stats).toMatchObject({ total: 1, ok: 1, err: 0, skip: 0 });

      const put = atrapa.wywolania.find((w) => w.metoda === "updateVariant");
      expect(put?.argumenty[0]).toBe(812);
      expect(put?.argumenty[1]).toBe(4242);
      expect(put?.argumenty[2]).toEqual({ quantity: 2, price: 7252 });

      expect(wpis(srodowisko.db, KOD_IMPORTU, "MO9")).toMatchObject({
        stan_wyslany: 2,
        cena_sprzedazy_wyslana: 7252,
        // ⚠ `cena_zakupu_wyslana` zapisywana MIMO że Tor 1 ceny zakupu nie wysyła
        // (payload to `{quantity, price}`) — tak robi oryginał (`sync_delta.cjs:82`).
        cena_zakupu_wyslana: 5562.4,
        ostatni_status: "ok",
        ostatni_blad: null,
      });
    });

    it("zmapowany produkt NIE uruchamia discovery — idzie prosto z wiersza", async () => {
      zasiejZmapowany(99, 1);
      const zal = zaleznosci();

      const wynik = await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(wynik.stats.discovered).toBe(0);
      expect(atrapa.liczba("listProductsByEan")).toBe(0);
      expect(atrapa.liczba("listVariants")).toBe(0);
    });

    it("niezmapowany produkt przechodzi przez discovery i liczy się jako `discovered`", async () => {
      const zal = zaleznosci({
        produktyPoEan: { "8903094073627": 812 },
        wariantyProduktu: {
          812: [{ variant_id: 4242, features: [{ feature_id: 1, name: "Magazyny", value: "MO9" }] }],
        },
      });

      const wynik = await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(wynik.stats).toMatchObject({ total: 1, ok: 1, discovered: 1 });
      expect(atrapa.liczba("updateVariant")).toBe(1);
      expect(wpis(srodowisko.db, KOD_IMPORTU, "MO9")).toMatchObject({
        stan_wyslany: 2,
        ostatni_status: "ok",
      });
    });

    /**
     * ⭐ NAJWAŻNIEJSZY TEST TEGO PLIKU — `dry_run` nie ma prawa dotknąć cudzego sklepu
     * ŻADNYM zapisem ani ruszyć snapshotu.
     */
    it("`dryRun` nie wykonuje PUT-a i nie zmienia snapshotu", async () => {
      zasiejZmapowany(99, 1);
      const zal = zaleznosci();

      const wynik = await syncDelta(zal, "MO9", { dryRun: true, maxProducts: 1 });

      expect(wynik.stats).toMatchObject({ total: 1, ok: 0, skip: 1 });
      expect(atrapa.liczba("updateVariant")).toBe(0);
      expect(atrapa.liczba("createVariant")).toBe(0);
      expect(wpis(srodowisko.db, KOD_IMPORTU, "MO9")).toMatchObject({
        stan_wyslany: 99,
        cena_sprzedazy_wyslana: 1,
      });
    });

    it("padnięty PUT liczy się jako `err` i zapisuje `error` w mapowaniu", async () => {
      zasiejZmapowany(99, 1);
      const zal = zaleznosci({
        bledy: { updateVariant: new Error("[Selly] HTTP 400 PUT :: zly wariant") },
      });

      const wynik = await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(wynik.stats).toMatchObject({ total: 1, ok: 0, err: 1 });
      expect(wynik.errors[0]).toMatchObject({ kod: "MO9_336320" });
      expect(wpis(srodowisko.db, KOD_IMPORTU, "MO9")).toMatchObject({
        ostatni_status: "error",
        stan_wyslany: 99, // snapshot NIETKNIĘTY — nie wolno udawać, że wysłaliśmy
      });
    });
  });

  describe("⭐ `error` kontra `pending_create`", () => {
    /**
     * To jest rozróżnienie „awaria" od „zaplanowanej roboty dla Toru 2" i idzie po TREŚCI
     * komunikatu discovery (`sync_delta.cjs:86-89`), nie po kodzie błędu. Produkt, którego
     * nie ma w Selly, NIE jest awarią — Tor 1 go nie zakłada, bo nie dostaje słowników.
     */
    /**
     * ⭐⭐ USTALENIE Z TEGO TICKETA: `pending_create` NIE MA JAK TRAFIĆ DO BAZY W TORZE 1.
     *
     * Żeby `markError` zapisał ten status, `ensureMapping` musi zwrócić komunikat
     * „brak dictMaps do createProduct", a to wymaga `productId === null` po krokach 2 i 3.
     * Tymczasem krok 3 („rodzeństwo", `discovery.cjs:213-218`) szuka
     * `selly_product_id` po SAMYM `kod_importu`, a ta kolumna jest `NOT NULL` — więc:
     *   • jeśli wiersz dla tego `kod_importu` ISTNIEJE, rodzeństwo zawsze poda `product_id`
     *     i sterowanie idzie ścieżką `found_variant`/`created_variant`, nie `not_found`;
     *   • jeśli wiersza NIE MA, komunikat owszem powstaje, ale `markError` robi `UPDATE`
     *     bez `INSERT` (`sync_delta.cjs:96-103`) i nie trafia w żaden wiersz.
     *
     * Efekt: błąd jest POLICZONY w `stats.err` i widoczny w `errors[]`, ale w bazie nie
     * zostaje po nim ślad. Odtwarzamy to 1:1 — to defekt produkcji, nie nasz. Zgadza się
     * z tym komentarz DDL, który wymienia statusy `pending | ok | error | not_found`
     * i `pending_create` w ogóle nie zna. Zgłoszone w backlogu #60.
     */
    it("nieznany produkt: błąd policzony, ale w bazie NIE zostaje ślad (defekt)", async () => {
      // MO9_336319 nie ma żadnego wiersza mapowania, a Selly nie zna jego EAN-u.
      const zal = zaleznosci({ produktyPoEan: {} });

      const wynik = await syncDelta(zal, "MO9", { maxProducts: 10 });

      const bladProduktu = wynik.errors.find((e) => e.kod === "MO9_336319");
      expect(bladProduktu?.error).toContain("brak dictMaps do createProduct");
      expect(wynik.stats.err).toBeGreaterThan(0);
      // `markError` nie ma czego zaktualizować — wiersz nie powstaje.
      expect(wpis(srodowisko.db, "798369", "MO9")).toBeUndefined();
    });

    /**
     * Druga połowa ustalenia wyżej: wiersz BEZ `selly_variant_id` nie kończy jako
     * `pending_create`, tylko idzie przez „rodzeństwo" do tworzenia wariantu — bo własny
     * `selly_product_id` tego wiersza jest dla niego rodzeństwem.
     */
    it("wiersz bez variant_id idzie tworzyć wariant, a nie w `pending_create`", async () => {
      zasiejZmapowany(99, 1);
      srodowisko.db.run(
        sql`UPDATE selly_products SET selly_variant_id = NULL WHERE kod_importu = ${KOD_IMPORTU}`,
      );
      const zal = zaleznosci({ produktyPoEan: {} }); // EAN nie trafia — zostaje rodzeństwo

      const wynik = await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(atrapa.liczba("createVariant")).toBe(1);
      expect(wynik.stats).toMatchObject({ ok: 1, err: 0, discovered: 1 });
      expect(wpis(srodowisko.db, KOD_IMPORTU, "MO9")?.ostatni_status).toBe("ok");
    });

    it("prawdziwy błąd HTTP zostaje `error`", async () => {
      zasiejZmapowany(99, 1);
      const zal = zaleznosci({
        bledy: { updateVariant: new Error("[Selly] HTTP 500 PUT :: cos padlo") },
      });

      await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(wpis(srodowisko.db, KOD_IMPORTU, "MO9")?.ostatni_status).toBe("error");
    });

    it("komunikat błędu jest przycinany do 500 znaków", async () => {
      zasiejZmapowany(99, 1);
      const zal = zaleznosci({ bledy: { updateVariant: new Error("x".repeat(900)) } });

      await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(wpis(srodowisko.db, KOD_IMPORTU, "MO9")?.ostatni_blad).toHaveLength(500);
    });
  });

  describe("dziennik `selly_sync_log`", () => {
    const dziennik = () =>
      srodowisko.db
        .all<{
          operacja: string;
          dostawca_kod: string | null;
          liczba_ok: number;
          liczba_blad: number;
          liczba_skip: number;
          status: string;
          zakonczono: string | null;
        }>(
          sql`SELECT operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip, status, zakonczono
              FROM selly_sync_log ORDER BY id DESC`,
        )
        .at(0);

    it("udany przebieg domyka się jako `zakonczono`", async () => {
      zasiejZmapowany(99, 1);
      const zal = zaleznosci();

      await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(dziennik()).toMatchObject({
        operacja: "sync_delta",
        dostawca_kod: "MO9",
        liczba_ok: 1,
        liczba_blad: 0,
        status: "zakonczono",
      });
      expect(dziennik()?.zakonczono).not.toBeNull();
    });

    it("przebieg bez dostawcy zapisuje `ALL`", async () => {
      const zal = zaleznosci({ produktyPoEan: {} });

      await syncDelta(zal, null, { maxProducts: 1 });

      expect(dziennik()?.dostawca_kod).toBe("ALL");
    });

    /**
     * ⚠ `blad` TYLKO wtedy, gdy nie udało się NIC. Częściowe niepowodzenie zostaje
     * `zakonczono` — inaczej panel pokazywałby awarię przy jednym błędnym produkcie
     * na tysiąc (`sync_delta.cjs:176`).
     */
    it("status `blad` dopiero gdy err > 0 ORAZ ok === 0", async () => {
      zasiejZmapowany(99, 1);
      const zal = zaleznosci({ bledy: { updateVariant: new Error("padlo") } });

      await syncDelta(zal, "MO9", { maxProducts: 1 });

      expect(dziennik()).toMatchObject({ liczba_ok: 0, liczba_blad: 1, status: "blad" });
    });

    it("przy MIESZANYM wyniku zostaje `zakonczono`", async () => {
      // Dwa produkty MO9: jeden zmapowany (przejdzie), drugi bez wariantu w Selly (padnie).
      zasiejZmapowany(99, 1);
      const zal = zaleznosci({ produktyPoEan: {} });

      const wynik = await syncDelta(zal, "MO9", { maxProducts: 10 });

      expect(wynik.stats.ok).toBe(1);
      expect(wynik.stats.err).toBe(1);
      expect(dziennik()).toMatchObject({ status: "zakonczono" });
    });
  });
});
