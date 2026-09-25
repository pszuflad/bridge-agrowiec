/**
 * GATE ODBUDOWY — Iteracja 2 (katalog, odczyt).
 *
 * Ścieżki kontraktu w zakresie: GET /api/products, GET /api/suppliers, GET /api/dostawcy.
 * Fixtures w zakresie: GET_products.json, GET_suppliers.json, GET_dostawcy.json.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * `szerokosc` — rozjazd DOMKNIĘTY 2026-09-08 (ticket 38, sesja 12d).
 * Do tej pory GATE przepuszczał tu zadeklarowany, samoczyszczący wyjątek `WYJATKI_SZEROKOSC`:
 * `GET_products.json` nagrano PRZED produkcyjną migracją `szertxt`, więc trzymał `szerokosc`
 * jako liczbę, podczas gdy produkcja i kanon (`003_szerokosc_text.sql`) mają tam TEXT.
 * Fixture jest przenagrany z oryginału (`tools/record-write-fixtures.cjs`) i niesie napisy
 * z zerami końcowymi („8.00"), więc wyjątek przestał cokolwiek pokrywać i — zgodnie z tym,
 * po co był samoczyszczący — zapalił test, żądając usunięcia. Usunięty, nie obejrzany.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PROMOCJA_TESTOWA,
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  zasiejDostawcow,
  zasiejHistorieCen,
  zasiejProdukty,
  zasiejPromocjeTestowa,
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
   * GŁÓWNA ścieżka katalogu, do 12d bez ani jednego fixture'a.
   *
   * `GET /api/products` BEZ parametrów to inna gałąź i INNY KSZTAŁT niż `?limit=`:
   * oryginał oddaje wtedy gołą tablicę, nie kopertę `{items,total,limit,offset}`
   * (`deminified/backend-index.cjs:48291-48295`). Do tego ticketu pokrywały ją wyłącznie
   * testy jednostkowe w `produkty.test.ts` — czyli nasz opis zachowania, nie nagranie produkcji.
   */
  it("GET /api/products bez parametrów zwraca GOŁĄ TABLICĘ 1:1 z fixture'em", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/products")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
    expect(Array.isArray(odp.body), "bez parametrów musi być goła tablica").toBe(true);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/products", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_products_bez-parametrow.json", odp.body);
  });

  /**
   * Dwa warianty tej samej trasy MUSZĄ się różnić kształtem — inaczej któryś z nich
   * przestał odtwarzać produkcję. Bez tego testu regres „zawsze koperta" albo
   * „zawsze tablica" przeszedłby przez oba fixtures osobno, bo każdy z nich
   * porównuje tylko swój wariant.
   */
  it("oba warianty GET /api/products mają RÓŻNE kształty, zgodnie z gałęzią oryginału", async () => {
    const bez = await request(srodowisko.app)
      .get("/api/products")
      .set("Authorization", `Bearer ${token}`);
    const zLimitem = await request(srodowisko.app)
      .get("/api/products?limit=5")
      .set("Authorization", `Bearer ${token}`);

    expect(Array.isArray(bez.body)).toBe(true);
    expect(Array.isArray(zLimitem.body)).toBe(false);
    expect(Object.keys(zLimitem.body as object).sort()).toEqual([
      "items",
      "limit",
      "offset",
      "total",
    ]);
  });

  /**
   * STRAŻNIK DECYZJI D1 (ticket 38). `products.uwaga_cena` istnieje w bazie od migracji 002,
   * ale API jej NIE oddaje — i to jest ODTWORZENIE produkcji, nie nasz dług.
   * Oryginał czyta produkty przez `X.select().from(he)` (`deminified/backend-index.cjs:44699`),
   * czyli Drizzle bez jawnej listy kolumn, więc oddaje pola MODELU; model `he` o `uwagaCena`
   * nie wie (zero trafień w całym bundlu), a `uwaga_cena_patch.cjs` patchuje `acceptStaging`
   * i `addProductsBulk`, ale NIE `listProducts`. Potwierdzone nagraniem: oba fixtures
   * produktów i obie mutacje `{id}` mają 72 klucze, żaden nie ma `uwagaCena`.
   *
   * Roadmapa (12d pkt 1) i backlog #3 twierdziły, że przenagranie fixtures „przy okazji ujawni"
   * tę kolumnę. To było błędne — ujawnienie byłoby ODSTĘPSTWEM od produkcji. Ten test pilnuje,
   * żeby nikt nie zdjął jej z `KOLUMNY_POZA_KONTRAKTEM` w dobrej wierze.
   */
  it("GET /api/products NIE oddaje uwagaCena (D1) ani blokowaneFormyPlatnosci (I15.1)", async () => {
    for (const sciezka of ["/api/products", "/api/products?limit=5"]) {
      const odp = await request(srodowisko.app)
        .get(sciezka)
        .set("Authorization", `Bearer ${token}`);
      const pozycje = (Array.isArray(odp.body) ? odp.body : (odp.body as { items: unknown[] }).items) as Record<string, unknown>[];

      expect(pozycje.length, sciezka).toBeGreaterThan(0);
      for (const pozycja of pozycje) {
        expect(Object.keys(pozycja), `${sciezka} — kolumna spoza kontraktu`).not.toContain(
          "uwagaCena",
        );
        // ⭐ ZMIERZONE, NIE ZAŁOŻONE (ticket 122 / karta I15.3): produkcja tego pola też nie
        // oddaje — oryginał z `88fa31c` na kopii bazy Z KOLUMNĄ WYPEŁNIONĄ dla 7405 produktów
        // i obydwoma triggerami daje 72 klucze bez niego. Ten sam mechanizm co `uwagaCena`:
        // `payment_blocks.cjs` dokłada kolumnę `ALTER TABLE`, ale bundle jej nie zna
        // (`grep -c blokowane_formy_platnosci mirror/backend/index.cjs` = 0). Karta I15.3
        // ROZSTRZYGNĘŁA, że ukrycie zostaje — nie jest to już „decyzja na później".
        expect(Object.keys(pozycja), `${sciezka} — kolumna spoza kontraktu`).not.toContain(
          "blokowaneFormyPlatnosci",
        );
        expect(Object.keys(pozycja), sciezka).toHaveLength(73);
      }
    }
  });

  /**
   * Niezmiennik, którego samo `porownajKsztalt` nie złapie: fixture ma 5 pozycji, więc
   * pole obecne tylko w części z nich mogłoby się prześlizgnąć. Tu porównujemy KOMPLETNY
   * zbiór 73 kluczy — to on pilnuje poprawek D5 (`snow3pmsf`, tryb boolean).
   * 73 = 72 kolumn produkcji + `wagaAutoUzupelniona` (ticket 155, NOWA logika, nie port).
   */
  it("GET /api/products — pozycja ma dokładnie te 73 klucze co fixture", async () => {
    const fixture = wczytajFixture("GET_products.json");
    const pozycjaWzorcowa = (fixture.body as { items: Record<string, unknown>[] }).items[0];
    const oczekiwane = Object.keys(pozycjaWzorcowa ?? {}).sort();
    expect(oczekiwane).toHaveLength(73);

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

/**
 * STRAŻNIK ŚWIADOMEGO ODSTĘPSTWA — karta 14h (ticket 61).
 *
 * CO: `GET /api/products` dokłada opcjonalny 73. klucz `_reguly` z dopasowaną promocją.
 * DLACZEGO TO ODSTĘPSTWO: nagrana produkcja oddaje 72 klucze i `_reguly` wśród nich NIE MA.
 *     Kolumna „Promocja" w `/katalog` czytała `_reguly.promocja` od baseline'u 13.08, ale
 *     ZAPISU tego pola nie dopisał nigdy nikt — ani w żywym bundlu, ani w backendzie.
 *     To NOWA FUNKCJA, nie naprawa regresji.
 * CZYJA DECYZJA I KIEDY: Ania, 2026-09-18 — „dodaj regułę wypełniania kolumny promocja".
 *     Zapis: `docs/rebuild-backlog.md` #22, `docs/rebuild-roadmap.md` §I14 karta 14h.
 *
 * ⚠ DLACZEGO OSOBNE ŚRODOWISKO, A NIE `beforeAll` WYŻEJ. Bramka powyżej celowo NIE zasiewa
 * żadnej promocji, więc żaden produkt nie dostaje tam `_reguly` i wszystkie trzy asercje
 * „dokładnie 72 klucze" przechodzą BEZ ROZLUŹNIENIA czegokolwiek — i tak ma zostać, bo to
 * one dowodzą, że produkt bez promocji jest nadal 1:1 z produkcją. Zasianie promocji w tamtym
 * środowisku skaziłoby je (testy w pliku lecą po kolei, wiersz zostałby w bazie).
 *
 * ⚠ Ten blok świadomie NIE używa `sprawdzZgodnoscZFixture` — nie istnieje żadne nagranie
 * produkcji z wypełnioną promocją, bo produkcja nigdy jej nie wypełniała. Nie ma z czym
 * porównywać, więc porównywanie z fixture'em byłoby tu udawaniem dowodu.
 */
describe("GATE — odstępstwo 14h: `_reguly.promocja` w GET /api/products", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  /** Zasięg `BKT,MICHELIN` trafia dwa produkty BKT z seeda, a mija MITAS i ALLIANCE. */
  const MARKI_TRAFIONE = ["BKT"];

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejDostawcow(srodowisko.db);
    zasiejProdukty(srodowisko.db);
    zasiejPromocjeTestowa(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  async function pozycje(sciezka: string): Promise<Record<string, unknown>[]> {
    const odp = await request(srodowisko.app)
      .get(sciezka)
      .set("Authorization", `Bearer ${token}`);
    expect(odp.status, sciezka).toBe(200);
    return (
      Array.isArray(odp.body) ? odp.body : (odp.body as { items: unknown[] }).items
    ) as Record<string, unknown>[];
  }

  /**
   * Sedno odstępstwa: klucz pojawia się WYŁĄCZNIE przy dopasowaniu i niesie dokładnie
   * `{ wartosc, nazwa }` — tyle, ile czyta renderer (`katalog/formatowanie.tsx`) i tyle,
   * ile czytał żywy bundle produkcji (`p.wartosc`, `p.nazwa || "Promocja"`).
   */
  it.each(["/api/products", "/api/products?limit=5"])(
    "%s — produkt z pasującą promocją dostaje `_reguly.promocja` o kształcie {wartosc, nazwa}",
    async (sciezka) => {
      const trafione = (await pozycje(sciezka)).filter((p) =>
        MARKI_TRAFIONE.includes(String(p.marka)),
      );

      expect(trafione.length, "seed musi mieć produkt marki BKT").toBeGreaterThan(0);
      for (const produkt of trafione) {
        expect(produkt._reguly, `${sciezka} / ${String(produkt.kod)}`).toEqual({
          promocja: { wartosc: PROMOCJA_TESTOWA.rabatPct, nazwa: PROMOCJA_TESTOWA.nazwa },
        });
      }
    },
  );

  /**
   * Druga połowa strażnika i powód, dla którego odstępstwo jest WĄSKIE: produkt, któremu
   * promocja nie odpowiada, zostaje przy 72 kluczach nagrania. Gdyby ktoś kiedyś zmienił
   * `dolaczReguly` na `_reguly: {}` „dla czystości API", ten test zapali się natychmiast.
   */
  it.each(["/api/products", "/api/products?limit=5"])(
    "%s — produkt BEZ pasującej promocji nie ma `_reguly` i ma nadal dokładnie 73 klucze",
    async (sciezka) => {
      const nietrafione = (await pozycje(sciezka)).filter(
        (p) => !MARKI_TRAFIONE.includes(String(p.marka)),
      );

      expect(nietrafione.length, "seed musi mieć produkt spoza zasięgu promocji").toBeGreaterThan(
        0,
      );
      for (const produkt of nietrafione) {
        expect(Object.keys(produkt), `${sciezka} / ${String(produkt.kod)}`).not.toContain(
          "_reguly",
        );
        expect(Object.keys(produkt), `${sciezka} / ${String(produkt.kod)}`).toHaveLength(73);
      }
    },
  );

  /** Odstępstwo ma być dokładnie JEDNYM kluczem — nie okazją do przemycenia kolejnych. */
  it.each(["/api/products", "/api/products?limit=5"])(
    "%s — `_reguly` dokłada dokładnie jeden klucz (74), reszta kształtu nietknięta",
    async (sciezka) => {
      const fixture = wczytajFixture("GET_products.json");
      const oczekiwane = Object.keys(
        (fixture.body as { items: Record<string, unknown>[] }).items[0] ?? {},
      ).sort();

      for (const produkt of await pozycje(sciezka)) {
        const klucze = Object.keys(produkt);
        const bezOdstepstwa = klucze.filter((k) => k !== "_reguly").sort();
        expect(bezOdstepstwa, `${sciezka} / ${String(produkt.kod)}`).toEqual(oczekiwane);
        expect(klucze.length, `${sciezka} / ${String(produkt.kod)}`).toBeLessThanOrEqual(74);
      }
    },
  );

  /**
   * Trasa z odstępstwem ma dalej przechodzić kontrolę kontraktu.
   *
   * ⚠ ZAKRES TEJ ASERCJI, ŻEBY NIKT NIE LICZYŁ NA WIĘCEJ: `sprawdzZgodnoscZKontraktem`
   * sprawdza ścieżkę, metodę, kod odpowiedzi i `content-type` — NIE waliduje ciała względem
   * schematu. Że dodatkowy klucz nie łamie schematu, wiemy stąd, że `additionalProperties`
   * nie jest w `contract/openapi.yaml` ustawione nigdzie. Kształt ciała pilnują testy wyżej.
   */
  it.each(["/api/products", "/api/products?limit=5"])(
    "%s — odpowiedź z `_reguly` przechodzi kontrolę kontraktu (ścieżka/kod/content-type)",
    async (sciezka) => {
      const odp = await request(srodowisko.app)
        .get(sciezka)
        .set("Authorization", `Bearer ${token}`);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/products", odpowiedz: odp });
    },
  );
});
