/**
 * GATE ODBUDOWY — Iteracja 2 (katalog, odczyt).
 *
 * Ścieżki kontraktu w zakresie: GET /api/products, GET /api/suppliers, GET /api/dostawcy.
 * Fixtures w zakresie: GET_products.json, GET_suppliers.json, GET_dostawcy.json.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * ⚠ ZNANE, ZATWIERDZONE ODSTĘPSTWO — `szerokosc` (backlog #3, plan.md D1):
 * fixtures nagrano przed migracją `szertxt`, więc mają wartości liczbowe; aktualna
 * produkcja trzyma tam TEXT. GATE tego nie łapie i nie ma łapać: baza testowa powstaje
 * z kanonu (`001_schema.sql`, kolumna REAL), więc TYPY się zgadzają. Rozjazd dotyczy
 * WARTOŚCI na stagingu i jest odłożony do ticketu importu/schematu. Test-strażnik
 * pass-through jest w `produkty.test.ts`.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  zasiejDostawcow,
  zasiejHistorieCen,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("GATE — kontrakt i fixtures dla katalogu", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejDostawcow(srodowisko.db);
    zasiejProdukty(srodowisko.db);
    zasiejHistorieCen(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  it("GET /api/products?limit=5 zwraca kształt 1:1 z contract/fixtures/GET_products.json", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/products?limit=5")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/products", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_products.json", odp.body);
  });

  /**
   * Niezmiennik, którego samo `porownajKsztalt` nie złapie: fixture ma 5 pozycji, więc
   * pole obecne tylko w części z nich mogłoby się prześlizgnąć. Tu porównujemy KOMPLETNY
   * zbiór 72 kluczy — to on pilnuje poprawek D5 (`snow3pmsf`, tryb boolean).
   */
  it("GET /api/products — pozycja ma dokładnie te 72 klucze co fixture", async () => {
    const fixture = wczytajFixture("GET_products.json");
    const pozycjaWzorcowa = (fixture.body as { items: Record<string, unknown>[] }).items[0];
    const oczekiwane = Object.keys(pozycjaWzorcowa ?? {}).sort();
    expect(oczekiwane).toHaveLength(72);

    const odp = await request(srodowisko.app)
      .get("/api/products?limit=5")
      .set("Authorization", `Bearer ${token}`);
    const items = (odp.body as { items: Record<string, unknown>[] }).items;

    expect(items.length).toBeGreaterThan(0);
    for (const pozycja of items) {
      expect(Object.keys(pozycja).sort()).toEqual(oczekiwane);
    }
  });

  /**
   * Trzy pułapki typów, na które fixture jest jedynym dowodem — patrz `test/gate/dane.ts`.
   * Bez trybu boolean w schemacie (D5) `stubbleResistant` wyszłoby jako 0, a nie `false`.
   */
  it("GET /api/products — eanIsValid to liczba, kolumny boolean to boolean, NULL zostaje nullem", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/products?limit=5")
      .set("Authorization", `Bearer ${token}`);
    const items = odp.body as { items: Record<string, unknown>[] };
    const pierwszy = items.items[0] as Record<string, unknown>;

    expect(typeof pierwszy.eanIsValid).toBe("number");
    expect(pierwszy.eanIsValid).toBe(1);

    for (const pole of ["stubbleResistant", "nro", "cho", "cfo"]) {
      expect(typeof pierwszy[pole], `pole ${pole}`).toBe("boolean");
      expect(pierwszy[pole], `pole ${pole}`).toBe(false);
    }
    for (const pole of ["reinforced", "ms", "snow3pmsf"]) {
      expect(pierwszy[pole], `pole ${pole}`).toBeNull();
    }

    const drugi = items.items[1] as Record<string, unknown>;
    for (const pole of ["stubbleResistant", "nro", "cho", "cfo", "ms", "snow3pmsf", "reinforced"]) {
      expect(drugi[pole], `pole ${pole} (wiersz z 1)`).toBe(true);
    }
  });

  it("GET /api/suppliers zwraca kształt 1:1 z contract/fixtures/GET_suppliers.json", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/suppliers")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/suppliers", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_suppliers.json", odp.body);
  });

  it("GET /api/dostawcy zwraca kształt 1:1 z contract/fixtures/GET_dostawcy.json", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/dostawcy")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/dostawcy", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_dostawcy.json", odp.body);
  });

  /** Oba fixtures są w repo identyczne co do bajta — bo w oryginale to ten sam handler. */
  it("GET /api/dostawcy i GET /api/suppliers zwracają tę samą odpowiedź", async () => {
    const dostawcy = await request(srodowisko.app)
      .get("/api/dostawcy")
      .set("Authorization", `Bearer ${token}`);
    const suppliers = await request(srodowisko.app)
      .get("/api/suppliers")
      .set("Authorization", `Bearer ${token}`);

    expect(dostawcy.body).toEqual(suppliers.body);
  });

  it("wszystkie trzy ścieżki iteracji istnieją w contract/openapi.yaml i wymagają auth", async () => {
    const { wczytajKontrakt } = await import("./gate/kontrakt.js");
    const kontrakt = wczytajKontrakt();
    for (const sciezka of ["/api/products", "/api/suppliers", "/api/dostawcy"]) {
      const operacja = kontrakt.znajdzOperacje("GET", sciezka);
      expect(operacja, `brak ${sciezka} w kontrakcie`).toBeDefined();
      expect(operacja?.wymagaAuth, `${sciezka} powinno wymagać auth`).toBe(true);
      expect(operacja?.kody, `${sciezka} powinno deklarować 401`).toContain("401");
    }
  });

  /**
   * `GET /api/products/{id}` NIE ISTNIEJE ani w produkcji, ani w kontrakcie (plan.md D6).
   * Utrwalamy to, żeby ewentualne dołożenie tej operacji do kontraktu od razu tu zaświeciło
   * i wymusiło świadomą decyzję, zamiast przejść niezauważone.
   */
  it("kontrakt nie deklaruje GET /api/products/{id} — i my go nie dodajemy", async () => {
    const { wczytajKontrakt } = await import("./gate/kontrakt.js");
    const operacja = wczytajKontrakt().znajdzOperacje("GET", "/api/products/97794");
    // Jedyne dopasowanie może przyjść z `/api/products` — a to inna ścieżka.
    expect(operacja?.wzorzecSciezki).not.toBe("/api/products/{id}");

    const odp = await request(srodowisko.app)
      .get("/api/products/97794")
      .set("Authorization", `Bearer ${token}`);
    expect(odp.status).toBe(404);
  });
});
