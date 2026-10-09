/**
 * Ticket 202 — warstwa HTTP: `POST /api/products/uzupelnij-zdjecia`,
 * `GET /api/staging/{id}/propozycja-zdjecia` i edycja linku w `PUT /api/staging/{id}`.
 * Logika dopasowania ma osobne testy w `dziedziczenie-linkow.test.ts` — tu: autoryzacja,
 * kształt odpowiedzi, walidacja, audyt i poprawka Marty z edycji w stagingu.
 */
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { auditLog, manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type NowyProdukt, type SrodowiskoTestowe } from "./gate/index.js";
import { sprawdzZgodnoscZFixture, sprawdzZgodnoscZKontraktem } from "./gate/asercje.js";
import { pozycja } from "./charakteryzacja/akceptacja/scenariusze.mjs";

const LINK = "https://foto.example/a.jpg";

function produkt(kod: string, nadpisania: Partial<NowyProdukt> = {}): NowyProdukt {
  return {
    dostawca: "MO1",
    kod,
    nazwa: "Opona testowa",
    marka: "BKT",
    model: "AGRIMAX RT 765",
    kategoria: "rolnicze",
    magazyn: "GL",
    stan: 1,
    cenaZakupu: 100,
    cenaSprzedazy: 150,
    marzaPct: 50,
    dataAktualizacji: "2026-10-09T00:00:00.000Z",
    ...nadpisania,
  };
}

describe("uzupełnianie zdjęć — trasy HTTP", () => {
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
    for (const t of ["products", "audit_log", "manual_overrides", "staging_items"]) {
      srodowisko.sqlite.prepare(`DELETE FROM ${t}`).run();
    }
    srodowisko.db
      .insert(products)
      .values([produkt("DAWCA", { linkZdjecia: LINK }), produkt("PUSTY"), produkt("PUSTY2")])
      .run();
  });

  const uzupelnij = (ciało?: object) => {
    const r = request(srodowisko.app)
      .post("/api/products/uzupelnij-zdjecia")
      .set("Authorization", `Bearer ${token}`);
    return ciało ? r.send(ciało) : r;
  };

  it("wymaga tokenu", async () => {
    expect((await request(srodowisko.app).post("/api/products/uzupelnij-zdjecia")).status).toBe(401);
  });

  it("dry_run zwraca podgląd i niczego nie zapisuje", async () => {
    const odp = await uzupelnij({ dry_run: true });
    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject({ ok: true, dry_run: true, wszystkichPustych: 2 });
    expect((odp.body as { propozycje: unknown[] }).propozycje).toHaveLength(2);
    // GATE KONTRAKTU: ścieżka/status w openapi.yaml i kształt zgodny z fixture'em (ticket 202).
    sprawdzZgodnoscZKontraktem({ metoda: "post", sciezka: "/api/products/uzupelnij-zdjecia", odpowiedz: odp });
    sprawdzZgodnoscZFixture("POST_products_uzupelnij-zdjecia.json", odp.body);
    expect(srodowisko.db.select().from(products).where(eq(products.kod, "PUSTY")).get()?.linkZdjecia).toBeNull();
    expect(srodowisko.db.select().from(manualOverrides).all()).toHaveLength(0);
  });

  it("zapis uzupełnia linki, zakłada poprawki i zapisuje audyt", async () => {
    const odp = await uzupelnij({});
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true, dry_run: false, zaktualizowano: 2, pominiete: 0 });
    expect(srodowisko.db.select().from(products).where(eq(products.kod, "PUSTY")).get()?.linkZdjecia).toBe(LINK);
    expect(srodowisko.db.select().from(manualOverrides).all()).toHaveLength(2);
    expect(
      srodowisko.db.select().from(auditLog).where(eq(auditLog.akcja, "uzupelnienie_linkow_zdjec")).all(),
    ).toHaveLength(1);
  });

  it("odrzuca ids, które nie są listą liczb", async () => {
    expect((await uzupelnij({ ids: "1,2" })).status).toBe(400);
    expect((await uzupelnij({ ids: [1, "x"] })).status).toBe(400);
  });

  it("podpowiedź dla pozycji stagingu: jest propozycja, a po wpisaniu linku jej nie ma", async () => {
    srodowisko.db
      .insert(stagingItems)
      .values(pozycja({ kod: "NOWY", dostawca: "MO5", snapshot: { marka: "BKT", model: "AGRIMAX RT 765" } }) as never)
      .run();
    const id = srodowisko.db.select().from(stagingItems).get()!.id;
    const auth = { Authorization: `Bearer ${token}` };

    const przed = await request(srodowisko.app).get(`/api/staging/${id}/propozycja-zdjecia`).set(auth);
    expect(przed.status).toBe(200);
    expect(przed.body).toEqual({ propozycja: { link: LINK, produktow: 1, wariantow: 1 } });
    sprawdzZgodnoscZKontraktem({ metoda: "get", sciezka: "/api/staging/{id}/propozycja-zdjecia", odpowiedz: przed });
    sprawdzZgodnoscZFixture("GET_staging_id_propozycja-zdjecia.json", przed.body);

    const edycja = await request(srodowisko.app)
      .put(`/api/staging/${id}`)
      .set(auth)
      .send({ linkZdjecia: "https://foto.example/reczny.jpg" });
    expect(edycja.status).toBe(200);
    const poprawka = srodowisko.db
      .select()
      .from(manualOverrides)
      .where(and(eq(manualOverrides.supplierProductId, "NOWY"), eq(manualOverrides.fieldName, "linkZdjecia")))
      .get();
    expect(poprawka?.overrideValue).toBe("https://foto.example/reczny.jpg");

    const po = await request(srodowisko.app).get(`/api/staging/${id}/propozycja-zdjecia`).set(auth);
    expect(po.body).toEqual({ propozycja: null });
  });

  it("zwraca 404 dla nieistniejącej pozycji stagingu i 401 bez tokenu", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(srodowisko.app).get("/api/staging/999999/propozycja-zdjecia").set(auth)).status).toBe(404);
    expect((await request(srodowisko.app).get("/api/staging/1/propozycja-zdjecia")).status).toBe(401);
  });
});
