/**
 * Synchronizacja produktów do Selly (blok 8a) — `syncOneProduct` i `POST /api/selly/sync-supplier`
 * (`mirror/backend/selly/routes.cjs:167-249`, `:394-425`).
 *
 * ⚠ TO JEST JEDYNA OPERACJA W CAŁEJ ODBUDOWIE, KTÓRA ZMIENIA STAN POZA NASZĄ BAZĄ. Testy
 * chodzą po atrapie klienta (`test/gate/selly-atrapa.ts`), która liczy wywołania — dzięki
 * temu możemy sprawdzić rzeczy niewidoczne w odpowiedzi HTTP: że `dry_run` naprawdę NIE
 * dotknął Selly, że `multi_cat` poszedł tylko przy kategoriach dodatkowych i że nieudane
 * wywołanie zostało policzone jako `failed`, a nie `skipped`.
 *
 * Baza jest prawdziwym SQLite w katalogu tymczasowym — mockujemy wyłącznie to, czego nie
 * wolno nam dotknąć.
 *
 * ⚠⚠ PRZECZYTAJ, ZANIM UZNASZ TE TESTY ZA DZIWNE (Iteracja 13d-1, ticket 45, decyzja D3).
 * Migracja `007` przebudowała `selly_products` na model wariantowy: `kod_importu`
 * i `dostawca` są `NOT NULL` bez wartości domyślnej. Stary `syncOneProduct` z I8 — port
 * `routes.cjs:394-425` — w gałęzi CREATE tych kolumn NIE PODAJE, więc od 07.09 wywala się
 * na `NOT NULL constraint failed: selly_products.kod_importu`. Tak jest u Ani NA PRODUKCJI
 * i tak zostaje u nas: refaktor pod warianty nie doszedł do kodu z I8.
 *
 * Dlatego testy poniżej DOKUMENTUJĄ AWARIĘ zamiast dowodzić sukcesu, a wszędzie, gdzie
 * potrzebne jest istniejące mapowanie, zasiewamy je `zasiejMapowanieWariantowe` — czyli tak,
 * jak w nowym świecie robi to lazy discovery (`src/selly/discovery.ts`).
 */
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sellyProducts } from "../src/db/schema.js";
import { logSelly, produktPoKodzie } from "../src/repos/selly.js";
import {
  stworzAtrapeSelly,
  stworzSrodowiskoTestowe,
  zasiejMapowanieWariantowe,
  zasiejMapySelly,
  zasiejProdukty,
  type AtrapaSelly,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("synchronizacja z Selly (blok 8a)", () => {
  let srodowisko: SrodowiskoTestowe;
  let atrapa: AtrapaSelly;
  let token: string;

  beforeEach(async () => {
    atrapa = stworzAtrapeSelly();
    srodowisko = await stworzSrodowiskoTestowe(undefined, { klientSelly: atrapa.klient });
    zasiejProdukty(srodowisko.db);
    zasiejMapySelly(srodowisko.db);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterEach(() => srodowisko.posprzataj());

  const post = (sciezka: string) =>
    request(srodowisko.app).post(sciezka).set("Authorization", `Bearer ${token}`);

  const mapowanie = (kod: string) =>
    srodowisko.db.select().from(sellyProducts).where(eq(sellyProducts.bridgeKod, kod)).get();

  /** Dwa produkty MO9 z `PRODUKTY_TESTOWE`, zmapowane tak, jakby zrobiło to discovery. */
  const zasiejMapowanieMO9 = (ostatniaSync = "2020-01-01 00:00:00") =>
    zasiejMapowanieWariantowe(srodowisko.db, [
      {
        kod: "MO9_336320",
        kodImportu: "798368",
        dostawca: "MO9",
        sellyProductId: 5001,
        sellyVariantId: 6001,
        featureIdMagazyn: 1,
        ostatniaSync,
      },
      {
        kod: "MO9_336319",
        kodImportu: "798369",
        dostawca: "MO9",
        sellyProductId: 5002,
        sellyVariantId: 6002,
        featureIdMagazyn: 1,
        ostatniaSync,
      },
    ]);

  describe("pojedynczy produkt", () => {
    /**
     * ⭐ DEFEKT PRODUKCJI ODTWORZONY ŚWIADOMIE (ticket 45, D3) — patrz nagłówek pliku.
     *
     * I to jest najgorszy wariant awarii, jaki mógł tu wyjść: produkt POWSTAJE w cudzym
     * sklepie (`createProduct` idzie po HTTP i się udaje), a mapowanie w naszej bazie NIE
     * powstaje. Kolejny przebieg nie widzi wpisu, więc utworzy go w Selly PONOWNIE.
     * Test pilnuje obu połówek tego stanu, żeby nikt nie „naprawił" go przypadkiem.
     */
    it("nieznany produkt: Selly dostaje produkt, ale zapis mapowania PADA (defekt D3)", async () => {
      const odp = await post("/api/selly/sync-product").send({ kod: "MO9_336320" });

      const cialo = odp.body as { error?: string };
      expect(cialo.error).toContain("NOT NULL constraint failed");
      expect(cialo.error).toContain("selly_products.kod_importu");

      // Wywołanie do Selly JUŻ POSZŁO — awaria jest po naszej stronie, po fakcie.
      expect(atrapa.liczba("createProduct")).toBe(1);
      expect(mapowanie("MO9_336320")).toBeUndefined();
    });

    /**
     * Gałąź UPDATE działa dalej — i to jest istotne rozróżnienie: migracja `007` zepsuła
     * WYŁĄCZNIE tworzenie nowego mapowania, nie aktualizację istniejącego. Mapowanie
     * zasiewamy tak, jak w nowym świecie zrobiłoby to discovery.
     */
    it("znany produkt jest AKTUALIZOWANY, bez drugiego wpisu w `selly_products`", async () => {
      zasiejMapowanieMO9();
      const pierwszeId = mapowanie("MO9_336320")?.id;

      const odp = await post("/api/selly/sync-product").send({ kod: "MO9_336320" });

      expect(odp.body).toMatchObject({ action: "updated" });
      expect(atrapa.liczba("createProduct")).toBe(0);
      expect(atrapa.liczba("updateProduct")).toBe(1);
      expect(mapowanie("MO9_336320")?.id).toBe(pierwszeId);
      expect(mapowanie("MO9_336320")).toMatchObject({
        ostatniStatus: "ok",
        ostatniBlad: null,
        sellyCategoryId: 11,
        cenaSprzedazyWyslana: 7252,
        cenaZakupuWyslana: 5562.4,
        stanWyslany: 2,
      });
    });

    it("stan magazynowy idzie osobnym wywołaniem, z magazynem z payloadu", async () => {
      await post("/api/selly/sync-product").send({ kod: "MO9_336320" });

      const magazyn = atrapa.wywolania.find((w) => w.metoda === "upsertProductWarehouse");
      expect(magazyn?.argumenty[1]).toMatchObject({ quantity: 2 });
    });

    /**
     * ⚠ `multi_cat` leci TYLKO wtedy, gdy są kategorie dodatkowe. Produkt z jednym
     * zastosowaniem nie generuje tego wywołania — inaczej bilibyśmy w cudze API bez potrzeby.
     */
    it("`multi_cat` idzie tylko przy kategoriach dodatkowych", async () => {
      await post("/api/selly/sync-product").send({ kod: "MO9_336320" });
      expect(atrapa.liczba("setProductMultiCat")).toBe(0);

      srodowisko.sqlite
        .prepare("UPDATE products SET zastosowanie = ? WHERE kod = ?")
        .run("Ciągnik + Koparka", "MO9_336319");
      await post("/api/selly/sync-product").send({ kod: "MO9_336319" });

      expect(atrapa.liczba("setProductMultiCat")).toBe(1);
      const wywolanie = atrapa.wywolania.find((w) => w.metoda === "setProductMultiCat");
      expect(wywolanie?.argumenty[1]).toEqual([33]);
    });
  });

  describe("synchronizacja dostawcy", () => {
    /**
     * Ze zmapowanymi produktami przebieg liczy `updated` i domyka dziennik jak dotąd.
     * Bez mapowania — patrz test „…wszystkie pozycje są `failed`" niżej.
     */
    it("liczy `updated`, a wpis w dzienniku domyka się statusem `zakonczono`", async () => {
      zasiejMapowanieMO9();

      const odp = await post("/api/selly/sync-supplier").send({ dostawca: "MO9" });

      expect(odp.body).toMatchObject({
        dostawca: "MO9",
        total: 2,
        created: 0,
        updated: 2,
        failed: 0,
        skipped: 0,
        dry_run: false,
        errors: [],
      });

      const wpis = logSelly(srodowisko.db)[0];
      expect(wpis).toMatchObject({
        operacja: "sync_supplier",
        dostawca_kod: "MO9",
        liczba_ok: 2,
        liczba_blad: 0,
        liczba_skip: 0,
        status: "zakonczono",
      });
      expect(wpis?.zakonczono).not.toBeNull();
    });

    /**
     * ⭐ To samo żądanie BEZ zasianego mapowania — czyli stan, w jakim Ania jest dziś dla
     * każdego produktu, którego nie ma jeszcze w `selly_products` (defekt D3, patrz nagłówek).
     * Cały przebieg schodzi do `failed`, mimo że w Selly produkty POWSTAŁY.
     */
    it("bez mapowania: wszystkie pozycje są `failed`, choć Selly dostał produkty (D3)", async () => {
      const odp = await post("/api/selly/sync-supplier").send({ dostawca: "MO9" });

      expect(odp.body).toMatchObject({ total: 2, created: 0, updated: 0, failed: 2 });
      const errors = (odp.body as { errors: { error?: string }[] }).errors;
      expect(errors[0]?.error).toContain("NOT NULL constraint failed");
      expect(atrapa.liczba("createProduct")).toBe(2);
      expect(logSelly(srodowisko.db)[0]).toMatchObject({ liczba_blad: 2, status: "zakonczono" });
    });

    /**
     * ⚠ NAJWAŻNIEJSZY TEST TEGO PLIKU. `dry_run` ma przejść całą ścieżkę mapowania
     * i walidacji, ale nie wykonać ANI JEDNEGO wywołania zmieniającego cudzy sklep.
     */
    it("`dry_run` nie wykonuje żadnego wywołania zmieniającego Selly", async () => {
      const odp = await post("/api/selly/sync-supplier").send({
        dostawca: "MO9",
        dry_run: true,
      });

      expect(odp.body).toMatchObject({ total: 2, created: 0, updated: 0, dry_run: true });
      for (const metoda of [
        "createProduct",
        "updateProduct",
        "upsertProductWarehouse",
        "setProductMultiCat",
        "createProducer",
        "createCategory",
      ]) {
        expect(atrapa.liczba(metoda), `dry_run wykonał ${metoda}`).toBe(0);
      }
    });

    it("`dry_run` zwraca najwyżej pięć przykładowych payloadów", async () => {
      const odp = await post("/api/selly/sync-supplier").send({
        dostawca: "MO9",
        dry_run: true,
      });

      const cialo = odp.body as { dry_payloads: { kod: string; payload: unknown }[] };
      expect(cialo.dry_payloads).toHaveLength(2);
      expect(cialo.dry_payloads.length).toBeLessThanOrEqual(5);
      expect(cialo.dry_payloads[0]?.payload).toBeDefined();
    });

    it("bez `dry_run` klucz `dry_payloads` w ogóle nie wychodzi", async () => {
      const odp = await post("/api/selly/sync-supplier").send({ dostawca: "MO9" });
      expect(Object.keys(odp.body as object)).not.toContain("dry_payloads");
    });

    it("`limit` obcina liczbę przetwarzanych produktów", async () => {
      zasiejMapowanieMO9();

      const odp = await post("/api/selly/sync-supplier").send({ dostawca: "MO9", limit: 1 });

      expect(odp.body).toMatchObject({ total: 1, updated: 1 });
      expect(atrapa.liczba("updateProduct")).toBe(1);
    });

    /**
     * ⚠ Błąd WALIDACJI liczy się jako `skipped` i wpada do `errors` z kluczem `reason`;
     * błąd WYWOŁANIA Selly liczy się jako `failed` i ma klucz `error`. To dwie różne kolumny
     * dziennika i dwa różne problemy operacyjne — mylenie ich zaciera obraz w panelu.
     */
    it("niemapowalny produkt jest `skipped` z `reason`, nie `failed`", async () => {
      // MO2_200002 ma kategorię „Przyczepy" (poza mapą) i zastosowanie „Forwarder" (poza mapą).
      const odp = await post("/api/selly/sync-supplier").send({ dostawca: "MO2" });

      expect(odp.body).toMatchObject({ total: 1, skipped: 1, failed: 0, created: 0 });
      const errors = (odp.body as { errors: { kod: string; reason?: string }[] }).errors;
      expect(errors[0]?.kod).toBe("MO2_200002");
      expect(errors[0]?.reason).toContain("Brak category_id");
      expect(atrapa.liczba("createProduct")).toBe(0);
    });

    it("padnięte wywołanie Selly jest `failed` z `error`, a reszta produktów leci dalej", async () => {
      const padajaca = stworzAtrapeSelly({
        bledy: { createProduct: new Error("[Selly] HTTP 400 :: Brak kategorii o id 1") },
      });
      const inne = await stworzSrodowiskoTestowe(undefined, { klientSelly: padajaca.klient });
      zasiejProdukty(inne.db);
      zasiejMapySelly(inne.db);
      const logowanie = await request(inne.app)
        .post("/api/login")
        .send({ email: inne.dane.email, password: inne.dane.haslo });
      const innyToken = (logowanie.body as { token: string }).token;

      const odp = await request(inne.app)
        .post("/api/selly/sync-supplier")
        .set("Authorization", `Bearer ${innyToken}`)
        .send({ dostawca: "MO9" });

      expect(odp.body).toMatchObject({ total: 2, failed: 2, created: 0, skipped: 0 });
      const errors = (odp.body as { errors: { kod: string; error?: string }[] }).errors;
      expect(errors).toHaveLength(2);
      expect(errors[0]?.error).toContain("Brak kategorii o id 1");

      // Dziennik domyka się jako `zakonczono` — to nie był błąd globalny, tylko błędy pozycji.
      expect(logSelly(inne.db)[0]).toMatchObject({ status: "zakonczono", liczba_blad: 2 });

      inne.posprzataj();
    });

    /**
     * `only_updated` bierze produkty, których w Selly jeszcze nie ma ALBO które zmieniły się
     * po ostatniej synchronizacji. Po pełnym przebiegu drugi z `only_updated` nie ma już nic
     * do roboty.
     */
    it("`only_updated` pomija produkty zsynchronizowane i niezmienione", async () => {
      zasiejMapowanieMO9();
      await post("/api/selly/sync-supplier").send({ dostawca: "MO9" });

      const odp = await post("/api/selly/sync-supplier").send({
        dostawca: "MO9",
        only_updated: true,
      });

      expect(odp.body).toMatchObject({ total: 0, created: 0, updated: 0 });
    });

    it("`only_updated` łapie produkt zmieniony po ostatniej synchronizacji", async () => {
      zasiejMapowanieMO9();
      await post("/api/selly/sync-supplier").send({ dostawca: "MO9" });

      srodowisko.sqlite
        .prepare("UPDATE products SET data_aktualizacji = ? WHERE kod = ?")
        .run("2099-01-01T00:00:00.000Z", "MO9_336320");

      const odp = await post("/api/selly/sync-supplier").send({
        dostawca: "MO9",
        only_updated: true,
      });

      expect(odp.body).toMatchObject({ total: 1, updated: 1 });
    });

    it("bierze wyłącznie produkty aktywne — `wstrzymany` nie idzie do Selly", async () => {
      // MO1_100001 jest jedynym produktem MO1 i ma status „wstrzymany".
      const odp = await post("/api/selly/sync-supplier").send({ dostawca: "MO1" });

      expect(odp.body).toMatchObject({ total: 0 });
      expect(produktPoKodzie(srodowisko.db, "MO1_100001")?.status).toBe("wstrzymany");
      expect(atrapa.liczba("createProduct")).toBe(0);
    });
  });
});
