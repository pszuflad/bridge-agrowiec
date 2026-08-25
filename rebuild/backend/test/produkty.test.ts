/**
 * `GET /api/products` — zachowanie odtworzone z oryginału (backend-index.cjs:48280-48294).
 *
 * Testy chodzą po prawdziwym SQLite w katalogu tymczasowym (harness GATE z I1), bez mocków
 * i bez `listen()` — żaden port nie jest zajmowany, więc równoległa praca innego agenta
 * niczego tu nie wywróci.
 */
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DOMYSLNY_LIMIT, MAX_LIMIT } from "../src/routes/products.js";
import {
  PRODUKTY_TESTOWE,
  stworzSrodowiskoTestowe,
  zasiejDostawcow,
  przelaczSzerokoscNaText,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("GET /api/products", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejDostawcow(srodowisko.db);
    zasiejProdukty(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const pobierz = (query = ""): request.Test =>
    request(srodowisko.app).get(`/api/products${query}`).set("Authorization", `Bearer ${token}`);

  it("bez tokenu odpowiada 401 z komunikatem oryginału", async () => {
    const odp = await request(srodowisko.app).get("/api/products");
    expect(odp.status).toBe(401);
    expect(odp.body).toEqual({ error: "Nieautoryzowany" });
  });

  /**
   * NAJWAŻNIEJSZY test tego endpointu i jedyny wariant faktycznie używany przez katalog —
   * a zarazem jedyny, którego NIE pokrywa żaden fixture (nagrano `?limit=5`).
   * Bez `limit` i bez `dostawca` oryginał zwraca gołą tablicę, nie obiekt z paginacją.
   */
  it("bez żadnych parametrów zwraca GOŁĄ TABLICĘ wszystkich produktów", async () => {
    const odp = await pobierz();

    expect(odp.status).toBe(200);
    expect(Array.isArray(odp.body)).toBe(true);
    expect(odp.body).toHaveLength(PRODUKTY_TESTOWE.length);
    // Świadomie sprawdzamy też, czego NIE ma — obiekt z paginacją byłby regresem.
    expect(odp.body).not.toHaveProperty("items");
  });

  it("z parametrem limit zwraca obiekt {items,total,limit,offset}", async () => {
    const odp = await pobierz("?limit=2");

    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject({ total: PRODUKTY_TESTOWE.length, limit: 2, offset: 0 });
    expect((odp.body as { items: unknown[] }).items).toHaveLength(2);
  });

  it("offset przesuwa okno, a total pozostaje liczbą wszystkich produktów", async () => {
    const pierwsza = await pobierz("?limit=2&offset=0");
    const druga = await pobierz("?limit=2&offset=2");

    expect((druga.body as { offset: number }).offset).toBe(2);
    expect((druga.body as { total: number }).total).toBe(PRODUKTY_TESTOWE.length);
    const kody = (o: unknown): string[] =>
      (o as { items: { kod: string }[] }).items.map((p) => p.kod);
    expect(kody(pierwsza.body)).not.toEqual(kody(druga.body));
  });

  /** `parseInt(...) || 200` z oryginału: NaN i 0 wpadają w fallback, nie w błąd. */
  it.each([
    ["?limit=abc", DOMYSLNY_LIMIT],
    ["?limit=0", DOMYSLNY_LIMIT],
    ["?limit=", DOMYSLNY_LIMIT],
  ])("niepoprawny limit %s daje %i, nie błąd", async (query, oczekiwany) => {
    const odp = await pobierz(query);
    expect(odp.status).toBe(200);
    expect((odp.body as { limit: number }).limit).toBe(oczekiwany);
  });

  it("limit jest ograniczony z góry do 2000", async () => {
    const odp = await pobierz("?limit=99999");
    expect((odp.body as { limit: number }).limit).toBe(MAX_LIMIT);
  });

  it("niepoprawny offset traktowany jest jak 0", async () => {
    const odp = await pobierz("?limit=2&offset=abc");
    expect((odp.body as { offset: number }).offset).toBe(0);
  });

  it("filtr dostawca zawęża items ORAZ total", async () => {
    const odp = await pobierz("?dostawca=MO9");

    expect(odp.status).toBe(200);
    const ciało = odp.body as { items: { dostawca: string }[]; total: number; limit: number };
    expect(ciało.items.every((p) => p.dostawca === "MO9")).toBe(true);
    // total liczony PO filtrze — w seedzie MO9 ma 2 z 4 produktów.
    expect(ciało.total).toBe(2);
    // sam `dostawca` (bez `limit`) przełącza na wariant obiektowy z domyślnym limitem 200
    expect(ciało.limit).toBe(DOMYSLNY_LIMIT);
  });

  it("filtr dostawca dopasowuje DOKŁADNIE, bez ignorowania wielkości liter", async () => {
    const odp = await pobierz("?dostawca=mo9");
    expect((odp.body as { total: number }).total).toBe(0);
  });

  it("nieznany parametr (np. search) jest ignorowany — produkcja go nie zna", async () => {
    const odp = await pobierz("?search=BKT");
    // Brak `limit` i brak `dostawca` ⇒ nadal goła tablica ze WSZYSTKIMI produktami.
    expect(Array.isArray(odp.body)).toBe(true);
    expect(odp.body).toHaveLength(PRODUKTY_TESTOWE.length);
  });

});

/**
 * TEST-STRAŻNIK ODSTĘPSTWA `szerokosc` (plan.md D1, backlog #3).
 *
 * Baza staging to snapshot produkcji PO migracji `szertxt`, gdzie `products.szerokosc`
 * jest kolumną TEXT z zapisem zachowującym zera („10.00"). Kanon (`001_schema.sql`) ma
 * tam wciąż REAL.
 *
 * ⚠ Sam UPDATE na kolumnie REAL tego NIE odtworzy: SQLite stosuje type affinity i sam
 * zamieni napis „10.00" na liczbę 10.0. Dlatego test przebudowuje tabelę dokładnie tak,
 * jak zrobiła to migracja produkcji, i dopiero wtedy sprawdza, co odda endpoint.
 *
 * Utrwalamy pass-through: Drizzle `real()` nie mapuje wartości z drivera, więc backend
 * oddaje to, co leży w bazie — liczbę na kanonie, string na stagingu. Gdyby ktoś dodał
 * normalizację, ten test zaświeci i wymusi świadomą decyzję zamiast cichej zmiany.
 */
describe("GET /api/products — pass-through `szerokosc` (odstępstwo D1 / backlog #3)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejDostawcow(srodowisko.db);
    zasiejProdukty(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  it("na kanonicznym schemacie (REAL) SQLite sam konwertuje napis na liczbę", () => {
    srodowisko.sqlite
      .prepare("UPDATE products SET szerokosc = '10.00' WHERE kod = ?")
      .run("MO1_100001");
    const wiersz = srodowisko.db.get<{ t: string; w: unknown }>(
      sql`SELECT typeof(szerokosc) AS t, szerokosc AS w FROM products WHERE kod = 'MO1_100001'`,
    );
    // To jest powód, dla którego GATE nie łapie rozjazdu wartości: kanon FIZYCZNIE
    // nie jest w stanie przechować tego, co trzyma staging.
    expect(wiersz?.t).toBe("real");
    expect(wiersz?.w).toBe(10);
  });

  it("po migracji kolumny na TEXT backend oddaje string BEZ konwersji", async () => {
    przelaczSzerokoscNaText(srodowisko.sqlite);
    srodowisko.sqlite
      .prepare("UPDATE products SET szerokosc = '10.00' WHERE kod = ?")
      .run("MO1_100001");

    const wiersz = srodowisko.db.get<{ t: string }>(
      sql`SELECT typeof(szerokosc) AS t FROM products WHERE kod = 'MO1_100001'`,
    );
    expect(wiersz?.t).toBe("text");

    const odp = await request(srodowisko.app)
      .get("/api/products?dostawca=MO1")
      .set("Authorization", `Bearer ${token}`);
    const produkt = (odp.body as { items: { szerokosc: unknown }[] }).items[0];

    // Dokładnie to zobaczy Ania na stagingu — i dokładnie tego fixture NIE ma.
    expect(produkt?.szerokosc).toBe("10.00");
    expect(typeof produkt?.szerokosc).toBe("string");
  });

  it("wartości liczbowe na kolumnie TEXT wracają jako string — mieszanka jest po stronie danych, nie kodu", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/products?dostawca=MO2")
      .set("Authorization", `Bearer ${token}`);
    const produkt = (odp.body as { items: { szerokosc: unknown }[] }).items[0];
    expect(produkt?.szerokosc).toBe("600.0");
  });
});
