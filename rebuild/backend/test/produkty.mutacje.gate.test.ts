/**
 * GATE ODBUDOWY — mutacje produktów i trasy `uwaga_cena` (Iteracja 12a, ticket 35).
 *
 * ⚠ DO 2026-09-08 TEN GATE STAŁ WYŁĄCZNIE NA KONTRAKCIE — bo `contract/fixtures/` nie miał
 * ANI JEDNEGO nagrania dla sześciu operacji sesji 12a. Ticket 38 (sesja 12d) je nagrał:
 * `tools/record-write-fixtures.cjs` stawia ORYGINAŁ (`mirror/backend/index.cjs`) na kopii
 * `db/snapshot.db` i łapie żądanie razem z odpowiedzią. Od teraz gate stoi na OBU nogach —
 * kontrakcie (ścieżka, metoda, kod, JSON) i fixtures (kształt ciała 1:1).
 *
 * Charakteryzacja kodu oryginału zostaje i dalej jest potrzebna — mierzy to, czego nagranie
 * pojedynczego żądania nie pokaże (rozgałęzienia, skutki uboczne w bazie):
 *   • `produkty-bulk.charakteryzacja.test.ts` — `addProductsBulk` vs uruchomiony bundle;
 *   • `produkty.mutacje.test.ts` — warstwa trasy vs `:48306-48487` i `uwaga_cena_patch.cjs`.
 */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { products } from "../src/db/schema.js";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("GATE — kontrakt dla mutacji produktów", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  beforeEach(() => {
    srodowisko.db.delete(products).run();
  });

  const zAuth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

  const zasiejProdukt = (): number => {
    srodowisko.db
      .insert(products)
      .values({
        kod: "GATE1",
        nazwa: "Produkt do gate'u",
        marka: "BKT",
        kategoria: "Rolnicze",
        dostawca: "MO5",
        magazyn: "4",
        stan: 4,
        cenaZakupu: 1000,
        cenaSprzedazy: 1300,
        marzaPct: 30,
        vat: 23,
        status: "wstrzymany",
        dataAktualizacji: "2026-01-01T00:00:00.000Z",
      } as never)
      .run();
    return (
      srodowisko.sqlite.prepare("SELECT id FROM products WHERE kod = 'GATE1'").get() as {
        id: number;
      }
    ).id;
  };

  it("POST /api/products — 200 zadeklarowane w kontrakcie", async () => {
    const odp = await zAuth(request(srodowisko.app).post("/api/products")).send([
      { kod: "GATE_BULK", nazwa: "Z gate'u", cenaZakupu: 100, stan: 1 },
    ]);
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/products", odpowiedz: odp });
    sprawdzZgodnoscZFixture("POST_products.json", odp.body);
  });

  /**
   * Oryginał przyjmuje DWA kształty ciała: `Array.isArray(body) ? body : body.items ?? []`
   * (`deminified/backend-index.cjs:48306-48307`). Nagrane są oba, bo fixture jednego z nich
   * zamroziłby połowę prawdy o tej trasie.
   */
  it("POST /api/products — ciało `{items:[…]}` daje ten sam kształt odpowiedzi", async () => {
    const odp = await zAuth(request(srodowisko.app).post("/api/products")).send({
      items: [{ kod: "GATE_BULK_ITEMS", nazwa: "Z gate'u", cenaZakupu: 100, stan: 1 }],
    });
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/products", odpowiedz: odp });
    sprawdzZgodnoscZFixture("POST_products_items.json", odp.body);
  });

  it.each([
    ["PATCH", "patch"],
    ["PUT", "put"],
  ])("%s /api/products/{id} — 200 zadeklarowane w kontrakcie", async (metoda, czasownik) => {
    const id = zasiejProdukt();
    const odp = await zAuth(
      (request(srodowisko.app) as never as Record<string, (s: string) => request.Test>)[
        czasownik
      ]!(`/api/products/${id}`),
    ).send({ stan: 9 });

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda, sciezka: "/api/products/{id}", odpowiedz: odp });
    sprawdzZgodnoscZFixture(`${metoda}_products_id.json`, odp.body);
  });

  it("DELETE /api/products/{id} — 200 zadeklarowane w kontrakcie", async () => {
    const id = zasiejProdukt();
    const odp = await zAuth(request(srodowisko.app).delete(`/api/products/${id}`));
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "DELETE", sciezka: "/api/products/{id}", odpowiedz: odp });
    sprawdzZgodnoscZFixture("DELETE_products_id.json", odp.body);
  });

  /**
   * Kod `404` dopisano do kontraktu w tej sesji (D3). Bez niego trasy zachowywałyby się
   * zgodnie z produkcją, ale gate nie miałby prawa tego potwierdzić — i to jest dokładnie
   * powód, dla którego minimalny dopisek wszedł już tutaj, a nie dopiero w 12d.
   */
  it.each([
    ["PATCH", "patch"],
    ["PUT", "put"],
    ["DELETE", "delete"],
  ])("%s /api/products/{id} — 404 zadeklarowane w kontrakcie", async (metoda, czasownik) => {
    const odp = await zAuth(
      (request(srodowisko.app) as never as Record<string, (s: string) => request.Test>)[
        czasownik
      ]!("/api/products/999999"),
    ).send({ stan: 1 });

    expect(odp.status).toBe(404);
    sprawdzZgodnoscZKontraktem({ metoda, sciezka: "/api/products/{id}", odpowiedz: odp });
    sprawdzZgodnoscZFixture("PATCH_products_id_404.json", odp.body);
  });

  it.each([
    ["/api/products/uwagi-cena"],
    ["/api/products/hold-reasons"],
  ])("GET %s — ścieżka i status obecne w kontrakcie (dopisane w 12a)", async (sciezka) => {
    zasiejProdukt();
    const odp = await zAuth(request(srodowisko.app).get(sciezka));
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka, odpowiedz: odp });
    sprawdzZgodnoscZFixture(`GET_products_${sciezka.split("/").pop()}.json`, odp.body);
  });

  /**
   * ⚠ Klucz `uwaga_cena` jest w SNAKE_CASE i fixture jest jedynym dowodem, że tak zostanie.
   * Produkcja czyta tę trasę surowym `better-sqlite3` (`uwaga_cena_patch.cjs:98-104`), więc
   * oddaje nazwy KOLUMN; gołe `select()` Drizzle'a dałoby tu `uwagaCena`. Nagranie musiało
   * mieć niepustą listę, żeby w ogóle zamrozić kształt pozycji — dlatego nagrywarka zasiewa
   * jeden wiersz (`zasiejUwageCeny`). Ta asercja czyta klucz wprost, żeby regres do camelCase
   * zapalił się z nazwą pola, a nie jako abstrakcyjna różnica kształtu.
   */
  it("GET /api/products/uwagi-cena — pozycja ma klucz `uwaga_cena` w snake_case", async () => {
    const id = zasiejProdukt();
    srodowisko.sqlite
      .prepare("UPDATE products SET uwaga_cena = 'na zapytanie' WHERE id = ?")
      .run(id);

    const odp = await zAuth(request(srodowisko.app).get("/api/products/uwagi-cena"));
    const pozycje = (odp.body as { items: Record<string, unknown>[] }).items;

    expect(pozycje).toHaveLength(1);
    expect(Object.keys(pozycje[0]!).sort()).toEqual(["ean", "id", "kod", "uwaga_cena"]);
  });

  it.each([
    ["POST", "/api/products", "/api/products"],
    ["PATCH", "/api/products/1", "/api/products/{id}"],
    ["PUT", "/api/products/1", "/api/products/{id}"],
    ["DELETE", "/api/products/1", "/api/products/{id}"],
    ["GET", "/api/products/uwagi-cena", "/api/products/uwagi-cena"],
    ["GET", "/api/products/hold-reasons", "/api/products/hold-reasons"],
  ])("%s %s bez tokenu — 401 zadeklarowane w kontrakcie", async (metoda, url, wzorzec) => {
    const odp = await (
      request(srodowisko.app) as never as Record<string, (s: string) => request.Test>
    )[metoda.toLowerCase()]!(url).send({});

    expect(odp.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda, sciezka: wzorzec, odpowiedz: odp });
  });

  /**
   * KONTROLA NEGATYWNA GATE'U. Powyższe asercje przechodzą także wtedy, gdy `sprawdzOdpowiedz`
   * po cichu przestanie cokolwiek sprawdzać (np. po zmianie parsera kontraktu). Ten test
   * dowodzi, że siatka realnie łapie — ścieżka spoza kontraktu MUSI zapalić naruszenie.
   */
  it("gate realnie odsiewa — ścieżka spoza kontraktu zgłasza naruszenie", async () => {
    const odp = await zAuth(request(srodowisko.app).get("/api/products/uwagi-cena"));
    expect(() =>
      sprawdzZgodnoscZKontraktem({
        metoda: "GET",
        sciezka: "/api/products/tej-sciezki-nie-ma",
        odpowiedz: odp,
      }),
    ).toThrow();
  });
});
