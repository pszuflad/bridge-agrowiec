/** Trasy zamówień partnera (ticket 230, PRT-7.6a): lista i szczegóły, tylko odczyt. */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { products } from "../src/db/schema.js";
import { zwaliduj } from "../src/partnerzy/walidacja-zamowienia.js";
import { zapiszZamowienie } from "../src/repos/partnerzy-zamowienia.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

describe("trasy /api/partnerzy/:id/zamowienia", () => {
  let s: SrodowiskoTestowe;
  let token: string;
  let a: number;
  let b: number;

  beforeEach(async () => {
    s = await stworzSrodowiskoTestowe();
    const odp = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    token = (odp.body as { token: string }).token;
    const dodaj = async (nazwa: string) => ((await request(s.app).post("/api/partnerzy").set("Authorization", `Bearer ${token}`).send({ nazwa })).body as { id: number }).id;
    a = await dodaj("TyreWorld");
    b = await dodaj("Adtyres");
  });
  afterEach(() => s.posprzataj());

  const get = (u: string) => request(s.app).get(u).set("Authorization", `Bearer ${token}`);
  const zamowienie = (numer: string) => XML_PRZYKLAD.replaceAll("A01UF90224", numer);

  it("wymaga logowania", async () => {
    expect((await request(s.app).get(`/api/partnerzy/${a}/zamowienia`)).status).toBe(401);
    expect((await request(s.app).get(`/api/partnerzy/${a}/zamowienia/1`)).status).toBe(401);
  });

  it("lista: pusta dla nowego partnera, 404 dla nieistniejącego", async () => {
    expect((await get(`/api/partnerzy/${a}/zamowienia`)).body).toEqual({ zamowienia: [] });
    expect((await get("/api/partnerzy/9999/zamowienia")).status).toBe(404);
  });

  it("lista: najnowsze pierwsze, z liczbą pozycji, bez surowego XML i danych dostawy", async () => {
    zapiszZamowienie(s.db, a, zamowienie("A1"), new Date("2026-10-10T10:00:00Z"));
    zapiszZamowienie(s.db, a, zamowienie("A2"), new Date("2026-10-10T11:00:00Z"));
    const odp = await get(`/api/partnerzy/${a}/zamowienia`);
    expect(odp.status).toBe(200);
    const lista = (odp.body as { zamowienia: Record<string, unknown>[] }).zamowienia;
    expect(lista.map((z) => z.numerPartnera)).toEqual(["A2", "A1"]);
    expect(lista[0]).toMatchObject({ status: "nowe", numerWlasny: null, waluta: "EUR", krajDostawy: "AT", liczbaPozycji: 2 });
    for (const klucz of ["surowyXml", "skrotXml", "fakturaJson", "dostawaJson", "dostawa", "faktura"]) expect(lista[0]).not.toHaveProperty(klucz);
    expect(JSON.stringify(odp.body)).not.toContain("Jan Kowalski");
  });

  it("lista partnera nie zawiera zamówień innego partnera", async () => {
    zapiszZamowienie(s.db, a, zamowienie("OD_A"));
    zapiszZamowienie(s.db, b, zamowienie("OD_B"));
    const numery = async (id: number) => ((await get(`/api/partnerzy/${id}/zamowienia`)).body as { zamowienia: { numerPartnera: string }[] }).zamowienia.map((z) => z.numerPartnera);
    expect(await numery(a)).toEqual(["OD_A"]);
    expect(await numery(b)).toEqual(["OD_B"]);
  });

  it("lista: niecałkowity lub ujemny limit/offset nie wywraca trasy", async () => {
    zapiszZamowienie(s.db, a, zamowienie("A1"));
    for (const q of ["limit=1.5", "offset=0.7", "limit=-3&offset=-1", "limit=abc"]) {
      const odp = await get(`/api/partnerzy/${a}/zamowienia?${q}`);
      expect(odp.status, q).toBe(200);
    }
  });

  it("lista: limit i offset", async () => {
    for (const n of ["A1", "A2", "A3"]) zapiszZamowienie(s.db, a, zamowienie(n), new Date(`2026-10-10T1${n.slice(1)}:00:00Z`));
    const strona = (await get(`/api/partnerzy/${a}/zamowienia?limit=1&offset=1`)).body as { zamowienia: { numerPartnera: string }[] };
    expect(strona.zamowienia.map((z) => z.numerPartnera)).toEqual(["A2"]);
  });

  it("szczegóły: pozycje, dostawa, faktura; bez surowego XML i skrótu", async () => {
    const { id } = zapiszZamowienie(s.db, a, XML_PRZYKLAD);
    const odp = await get(`/api/partnerzy/${a}/zamowienia/${id}`);
    expect(odp.status).toBe(200);
    const z = odp.body as Record<string, unknown> & { pozycje: Record<string, unknown>[]; dostawa: Record<string, string> };
    expect(z).toMatchObject({ id, numerPartnera: "A01UF90224", krajDostawy: "AT" });
    expect(z.dostawa.CUSTOMERNAME).toBe("Jan Kowalski");
    expect(z.pozycje.map((p) => [p.lp, p.kod, p.ilosc, p.cenaSprzedazy])).toEqual([[1, "011200284", 2, 202], [2, "0102 00001", 1, 99.5]]);
    for (const klucz of ["surowyXml", "skrotXml", "fakturaJson", "dostawaJson"]) expect(z).not.toHaveProperty(klucz);
  });

  it("szczegóły: zamówienie innego partnera i nieistniejące to 404", async () => {
    const { id } = zapiszZamowienie(s.db, a, XML_PRZYKLAD);
    expect((await get(`/api/partnerzy/${b}/zamowienia/${id}`)).status).toBe(404);
    expect((await get(`/api/partnerzy/${a}/zamowienia/99999`)).status).toBe(404);
    expect((await get(`/api/partnerzy/${a}/zamowienia/abc`)).status).toBe(404);
  });

  describe("POST …/zamowienia/:zamowienieId/waliduj", () => {
    const post = (u: string) => request(s.app).post(u).set("Authorization", `Bearer ${token}`).send({});
    const wstaw = (kod: string, stan = 10) =>
      s.db.insert(products).values({
        kod, nazwa: "OPONA", marka: "CEAT", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan, cenaZakupu: 100, cenaSprzedazy: 150, marzaPct: 50,
        dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`,
      }).run();

    it("wymaga logowania; 404 dla cudzego i nieistniejącego zamówienia", async () => {
      const { id } = zapiszZamowienie(s.db, a, XML_PRZYKLAD);
      expect((await request(s.app).post(`/api/partnerzy/${a}/zamowienia/${id}/waliduj`)).status).toBe(401);
      expect((await post(`/api/partnerzy/${b}/zamowienia/${id}/waliduj`)).status).toBe(404);
      expect((await post(`/api/partnerzy/${a}/zamowienia/99999/waliduj`)).status).toBe(404);
      expect((await post(`/api/partnerzy/${a}/zamowienia/abc/waliduj`)).status).toBe(404);
    });

    it("po poprawie katalogu ponowna walidacja przywraca zamówienie; odpowiedź to świeże szczegóły z powodami per pozycja", async () => {
      const { id } = zapiszZamowienie(s.db, a, XML_PRZYKLAD);
      zwaliduj(s.db, id);
      const przed = (await get(`/api/partnerzy/${a}/zamowienia/${id}`)).body as { status: string; bladImportu: string; pozycje: { blad: string | null }[] };
      expect(przed).toMatchObject({ status: "blad_importu", bladImportu: expect.stringContaining("nieznany kod") });
      expect(przed.pozycje.map((p) => p.blad)).toEqual(["nieznany kod", "nieznany kod"]);

      wstaw("011200284");
      wstaw("0102 00001");
      const odp = await post(`/api/partnerzy/${a}/zamowienia/${id}/waliduj`);
      expect(odp.status).toBe(200);
      expect(odp.body).toMatchObject({ id, status: "przyjete", bladImportu: null });
      expect((odp.body as { pozycje: { blad: string | null }[] }).pozycje.every((p) => p.blad === null)).toBe(true);
      expect(JSON.stringify(odp.body)).not.toContain("surowyXml");
    });

    it("zamówienie w późniejszym statusie: 409 zamiast mylącego 200 „0 błędów”; szczegóły mówią mozeWalidowac", async () => {
      const { id } = zapiszZamowienie(s.db, a, XML_PRZYKLAD);
      expect(((await get(`/api/partnerzy/${a}/zamowienia/${id}`)).body as { mozeWalidowac: boolean }).mozeWalidowac).toBe(true);
      s.sqlite.prepare("UPDATE partner_zamowienia SET status = 'wyslane' WHERE id = ?").run(id);
      expect(((await get(`/api/partnerzy/${a}/zamowienia/${id}`)).body as { mozeWalidowac: boolean }).mozeWalidowac).toBe(false);
      const odp = await post(`/api/partnerzy/${a}/zamowienia/${id}/waliduj`);
      expect(odp.status).toBe(409);
      expect((odp.body as { error: string }).error).toMatch(/wyslane.*nie podlega/);
    });

    it("lista pokazuje status i opis błędu importu", async () => {
      const { id } = zapiszZamowienie(s.db, a, XML_PRZYKLAD);
      zwaliduj(s.db, id);
      const lista = ((await get(`/api/partnerzy/${a}/zamowienia`)).body as { zamowienia: { status: string; bladImportu: string | null }[] }).zamowienia;
      expect(lista[0]).toMatchObject({ status: "blad_importu", bladImportu: expect.stringContaining("nieznany kod") });
    });
  });
});
