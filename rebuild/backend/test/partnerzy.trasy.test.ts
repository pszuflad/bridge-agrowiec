/** Trasy /api/partnerzy — ustawienia partnera B2B (ticket 209, PRT-1.3). */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { auditLog, products } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("trasy /api/partnerzy", () => {
  let s: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    s = await stworzSrodowiskoTestowe();
    const odp = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    token = (odp.body as { token: string }).token;
  });
  afterEach(() => s.posprzataj());

  const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);
  const get = (u: string) => auth(request(s.app).get(u));
  const post = (u: string, c: object) => auth(request(s.app).post(u)).send(c);
  const put = (u: string, c: object) => auth(request(s.app).put(u)).send(c);
  const del = (u: string) => auth(request(s.app).delete(u));
  const dodaj = async (nazwa = "TyreWorld") => (await post("/api/partnerzy", { nazwa })).body as { id: number };

  it("wymaga logowania", async () => {
    expect((await request(s.app).get("/api/partnerzy")).status).toBe(401);
    expect((await request(s.app).post("/api/partnerzy").send({ nazwa: "X" })).status).toBe(401);
  });

  it("dodaje partnera nieaktywnego, z wartościami domyślnymi", async () => {
    const odp = await post("/api/partnerzy", { nazwa: "  Adtyres " });
    expect(odp.status).toBe(201);
    expect(odp.body).toMatchObject({
      nazwa: "Adtyres",
      aktywny: false,
      stanMin: 2,
      zaokraglanie: "grosz",
      formatPliku: "csv",
      csvSeparator: ";",
      magazyny: [],
      wykluczenia: [],
      kraje: [],
    });
  });

  it("odrzuca pustą nazwę, duplikat i złe wartości", async () => {
    expect((await post("/api/partnerzy", {})).status).toBe(400);
    expect((await post("/api/partnerzy", { nazwa: "A", stanMin: -1 })).status).toBe(400);
    expect((await post("/api/partnerzy", { nazwa: "A", formatPliku: "pdf" })).status).toBe(400);
    expect((await post("/api/partnerzy", { nazwa: "A", harmonogramMinuty: 0 })).status).toBe(400);
    await dodaj("A");
    expect((await post("/api/partnerzy", { nazwa: "A" })).status).toBe(409);
  });

  it("edytuje tylko podane pola i pilnuje unikalności nazwy", async () => {
    const a = await dodaj("A");
    await dodaj("B");
    const odp = await put(`/api/partnerzy/${a.id}`, { stanMin: 5, harmonogramMinuty: 30, tolerancjaCenyProc: 1.5, formatPliku: "xml" });
    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject({ nazwa: "A", stanMin: 5, harmonogramMinuty: 30, tolerancjaCenyProc: 1.5, formatPliku: "xml" });
    expect((await put(`/api/partnerzy/${a.id}`, { nazwa: "B" })).status).toBe(409);
    expect((await put(`/api/partnerzy/${a.id}`, { nazwa: "A" })).status).toBe(200);
    expect((await put("/api/partnerzy/999", { stanMin: 1 })).status).toBe(404);
  });

  it("aktywuje i dezaktywuje bez usuwania", async () => {
    const a = await dodaj();
    expect((await put(`/api/partnerzy/${a.id}/aktywny`, { aktywny: true })).body.aktywny).toBe(true);
    expect((await put(`/api/partnerzy/${a.id}/aktywny`, { aktywny: false })).body.aktywny).toBe(false);
    expect((await put(`/api/partnerzy/${a.id}/aktywny`, { aktywny: "tak" })).status).toBe(400);
    expect((await get("/api/partnerzy")).body.partnerzy).toHaveLength(1);
  });

  it("zastępuje zestaw magazynów i wykluczeń (bez duplikatów)", async () => {
    const a = await dodaj();
    const m = await put(`/api/partnerzy/${a.id}/magazyny`, { magazyny: ["MO1", "MO2", "MO1"] });
    expect(m.body.magazyny).toEqual(["MO1", "MO2"]);
    expect((await put(`/api/partnerzy/${a.id}/magazyny`, { magazyny: ["MO3"] })).body.magazyny).toEqual(["MO3"]);
    expect((await put(`/api/partnerzy/${a.id}/magazyny`, { magazyny: [""] })).status).toBe(400);
    const w = await put(`/api/partnerzy/${a.id}/wykluczenia`, { kody: ["MO1_1", "MO1_2"] });
    expect(w.body.wykluczenia).toEqual(["MO1_1", "MO1_2"]);
    const lista = (await get("/api/partnerzy")).body.partnerzy[0];
    expect(lista).toMatchObject({ liczbaMagazynow: 1, liczbaWykluczen: 2, liczbaKrajow: 0 });
  });

  it("dodaje, nadpisuje i usuwa kraje; ręczny kurs wymaga wartości", async () => {
    const a = await dodaj();
    const fr = await put(`/api/partnerzy/${a.id}/kraje/fr`, { narzutProc: 0.12, kosztyDodatkowe: 3 });
    expect(fr.body.kraje).toEqual([expect.objectContaining({ kraj: "FR", narzutProc: 0.12, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 3 })]);
    await put(`/api/partnerzy/${a.id}/kraje/DE`, { kursZrodlo: "reczny", kursReczny: 4.3 });
    const nadpis = await put(`/api/partnerzy/${a.id}/kraje/FR`, { narzutProc: 0.2 });
    expect(nadpis.body.kraje.map((k: { kraj: string }) => k.kraj)).toEqual(["DE", "FR"]);
    expect(nadpis.body.kraje.find((k: { kraj: string }) => k.kraj === "FR").narzutProc).toBe(0.2);
    expect((await put(`/api/partnerzy/${a.id}/kraje/IT`, { kursZrodlo: "reczny" })).status).toBe(400);
    expect((await put(`/api/partnerzy/${a.id}/kraje/FRA`, {})).status).toBe(400);
    expect((await put(`/api/partnerzy/${a.id}/kraje/NL`, { narzutProc: -1 })).status).toBe(400);
    expect((await del(`/api/partnerzy/${a.id}/kraje/FR`)).body.kraje).toHaveLength(1);
    expect((await del(`/api/partnerzy/${a.id}/kraje/FR`)).status).toBe(404);
  });

  it("zapisuje akcje w dzienniku audytu", async () => {
    const a = await dodaj();
    await put(`/api/partnerzy/${a.id}/aktywny`, { aktywny: true });
    const akcje = s.db.select({ akcja: auditLog.akcja }).from(auditLog).all().map((w) => w.akcja);
    expect(akcje).toEqual(expect.arrayContaining(["partner_dodany", "partner_aktywowany"]));
  });

  it("GET /api/partnerzy/magazyny oddaje magazyny aktywnych pozycji z liczbami (i nie jest brany za id)", async () => {
    const baza = { marka: "M", kategoria: "Rolnicze", dostawca: "MO1", stan: 5, cenaZakupu: 1, cenaSprzedazy: 2, marzaPct: 1, dataAktualizacji: "x" };
    s.db.insert(products).values([
      { ...baza, kod: "A", nazwa: "A", magazyn: "MO2" },
      { ...baza, kod: "B", nazwa: "B", magazyn: "MO1" },
      { ...baza, kod: "C", nazwa: "C", magazyn: "MO1" },
      { ...baza, kod: "D", nazwa: "D", magazyn: "MO9", status: "wstrzymany" },
    ]).run();
    expect((await request(s.app).get("/api/partnerzy/magazyny")).status).toBe(401);
    const odp = await get("/api/partnerzy/magazyny");
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ magazyny: [{ magazyn: "MO1", liczbaPozycji: 2 }, { magazyn: "MO2", liczbaPozycji: 1 }] });
  });
});
