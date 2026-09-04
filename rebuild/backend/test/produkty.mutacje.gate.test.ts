/**
 * GATE ODBUDOWY — mutacje produktów i trasy `uwaga_cena` (Iteracja 12a, ticket 35).
 *
 * ⚠ TEN GATE STOI NA KONTRAKCIE, NIE NA FIXTURES — I TO JEST STAN ZASTANY, NIE OBEJŚCIE.
 * `contract/fixtures/` nie zawiera ANI JEDNEGO nagrania dla sześciu operacji tej sesji:
 * `POST /api/products`, `PUT`/`PATCH`/`DELETE /api/products/{id}`, `GET /api/products/uwagi-cena`,
 * `GET /api/products/hold-reasons`. Nagrania POST/PUT/PATCH/DELETE przeciw kopii bazy są
 * zaplanowane dopiero na sesję 12d (`contract/README.md`, roadmap §5 I12). Do tego czasu
 * wzorcem kształtu jest KOD ORYGINAŁU, mierzony w dwóch innych plikach:
 *   • `produkty-bulk.charakteryzacja.test.ts` — `addProductsBulk` vs uruchomiony bundle;
 *   • `produkty.mutacje.test.ts` — warstwa trasy vs `:48306-48487` i `uwaga_cena_patch.cjs`.
 *
 * Tutaj pilnujemy tego, co kontrakt realnie niesie: że wszystkie sześć operacji istnieje
 * w `contract/openapi.yaml`, że zwracane statusy są tam zadeklarowane i że odpowiedzi są
 * JSON-em. Dwie ścieżki `uwaga_cena` i kod `404` dopisano do kontraktu w tej sesji (D3) —
 * bez tego ta asercja nie miałaby czego sprawdzić.
 */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { products } from "../src/db/schema.js";
import {
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
  });

  it("DELETE /api/products/{id} — 200 zadeklarowane w kontrakcie", async () => {
    const id = zasiejProdukt();
    const odp = await zAuth(request(srodowisko.app).delete(`/api/products/${id}`));
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "DELETE", sciezka: "/api/products/{id}", odpowiedz: odp });
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
  });

  it.each([
    ["/api/products/uwagi-cena"],
    ["/api/products/hold-reasons"],
  ])("GET %s — ścieżka i status obecne w kontrakcie (dopisane w 12a)", async (sciezka) => {
    zasiejProdukt();
    const odp = await zAuth(request(srodowisko.app).get(sciezka));
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka, odpowiedz: odp });
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
