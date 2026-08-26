/**
 * GATE ODBUDOWY — Iteracja 2 (katalog, odczyt).
 *
 * Ścieżki kontraktu w zakresie: GET /api/products, GET /api/suppliers, GET /api/dostawcy.
 * Fixtures w zakresie: GET_products.json, GET_suppliers.json, GET_dostawcy.json.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * ⚠ ZNANE, ZATWIERDZONE ODSTĘPSTWO — `szerokosc` (backlog #3, ticket 7 / plan.md D3).
 * Do Iteracji 3d-1 kanon miał tu `REAL` i GATE rozjazdu NIE WIDZIAŁ — bo typy po obu
 * stronach się zgadzały, mimo że produkcja od migracji `szertxt` trzyma tam TEXT.
 * Migracja `003_szerokosc_text.sql` doprowadziła kanon do stanu produkcji, więc rozjazd
 * WYSZEDŁ NA WIERZCH: `GET_products.json` nagrano PRZED tamtą migracją i ma tam liczby.
 *
 * Nie „poprawiamy" fixture'a (Krok 9 tego zabrania) i nie wyłączamy GATE'u — deklarujemy
 * wyjątek (`WYJATKI_SZEROKOSC`), który mówi CO, DLACZEGO i KIEDY znika. Wyjątek jest
 * samoczyszczący: gdy I12 przenagra fixtures, przestanie cokolwiek pokrywać i test
 * zapali się, żądając usunięcia.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  type WyjatekGate,
  zasiejDostawcow,
  zasiejHistorieCen,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/**
 * Jedyny zadeklarowany wyjątek GATE I2. Lista ma zostać jednoelementowa — pilnuje tego
 * osobny test niżej, żeby nikt nie „rozszerzył" jej zamiast zgłosić nowy rozjazd.
 */
const WYJATKI_SZEROKOSC: WyjatekGate[] = [
  {
    sciezka: /^\$\.items\[\d+\]\.szerokosc$/,
    powod:
      "Produkcja po migracji `szertxt` trzyma `products.szerokosc` jako TEXT i oddaje napis " +
      "z zerami końcowymi („10.00\"). `GET_products.json` nagrano PRZED tą migracją, więc ma " +
      "tam liczby. Racja jest po stronie produkcji — fixture jest starszy niż zachowanie, " +
      "które opisuje.",
    domyka: "I12 — przenagranie contract/fixtures/GET_products.json",
  },
];

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
    sprawdzZgodnoscZFixture("GET_products.json", odp.body, WYJATKI_SZEROKOSC);
  });

  /**
   * Strażnik samego wyjątku. Zadeklarowany wyjątek to furtka w GATE — musi zostać
   * JEDNA i musi dotyczyć wyłącznie `szerokosc`. Gdyby ktoś chciał przepchnąć kolejny
   * rozjazd dopisaniem do listy zamiast zgłoszeniem go (Krok 9: „rozbieżność = STOP"),
   * zapali się tutaj.
   */
  it("GATE ma dokładnie JEDEN zadeklarowany wyjątek i dotyczy on `szerokosc`", () => {
    expect(WYJATKI_SZEROKOSC).toHaveLength(1);
    expect(WYJATKI_SZEROKOSC[0]!.sciezka.source).toContain("szerokosc");
    expect(WYJATKI_SZEROKOSC[0]!.domyka).toContain("I12");
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
