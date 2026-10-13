/** Ticket 248: podgląd zamówienia partnera przed utworzeniem w Selly — dopasowanie pozycji, dane do faktury, blokady. Nic nie jest wysyłane. */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { partnerzy, products } from "../src/db/schema.js";
import { podgladDlaSelly } from "../src/partnerzy/podglad-selly.js";
import { zapiszZamowienie } from "../src/repos/partnerzy-zamowienia.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

type Nowy = typeof products.$inferInsert;
const produkt = (kod: string, n: Partial<Nowy> = {}): Nowy => ({
  kod, nazwa: "OPONA CEAT", marka: "CEAT", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 10, cenaZakupu: 100, cenaSprzedazy: 150, marzaPct: 50,
  dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`, ...n,
});
const FAKTURA = { fakturaNazwa: "Adtyres SL", fakturaNip: "ATU1", fakturaUlica: "Calle 1", fakturaKod: "AD500", fakturaMiasto: "Andorra", fakturaKraj: "AD" };

describe("podgląd zamówienia partnera dla Selly", () => {
  let s: SrodowiskoTestowe;
  const dodajPartnera = (faktura: Partial<typeof FAKTURA> = FAKTURA): number =>
    Number(s.db.insert(partnerzy).values({ nazwa: "Adtyres", aktywny: true, utworzono: "x", zmieniono: "x", ...faktura }).run().lastInsertRowid);
  beforeEach(async () => {
    s = await stworzSrodowiskoTestowe();
  });
  afterEach(() => s.posprzataj());

  it("dopasowuje pozycje po kodzie, pokazuje zamawiającego i dostawę z zamówienia; nieznane pozycje blokują", () => {
    const partnerId = dodajPartnera();
    s.db.insert(products).values([produkt("011200284")]).run(); // „0102 00001” z przykładu zostaje bez dopasowania
    const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id;
    const p = podgladDlaSelly(s.db, partnerId, id)!;
    expect(p.zamawiajacy).toMatchObject({ nazwa: "Adtyres SL", nip: "ATU1", kraj: "AD" });
    expect(p.dostawa.CUSTOMERNAME).toBe("Jan Kowalski");
    expect(p.pozycje).toHaveLength(2);
    expect(p.pozycje[0]!.dopasowanie).toMatchObject({ kod: "011200284", nazwa: "OPONA CEAT", dostawca: "MO1" });
    expect(p.pozycje[1]!.dopasowanie).toBeNull();
    expect(p.blokady).toEqual([expect.stringMatching(/bez dopasowania.*1.*ręcznej weryfikacji/)]);
  });

  it("brak danych do faktury partnera blokuje i wymienia brakujące pola", () => {
    const partnerId = dodajPartnera({ fakturaNazwa: "Adtyres SL" });
    s.db.insert(products).values([produkt("011200284"), produkt("0102 00001")]).run();
    const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id;
    const p = podgladDlaSelly(s.db, partnerId, id)!;
    expect(p.blokady).toHaveLength(1);
    expect(p.blokady[0]).toMatch(/NIP, ulica, kod pocztowy, miasto, kraj/);
  });

  it("trasa: 404 dla cudzego/nieistniejącego zamówienia, 200 dla własnego; bez zalogowania 401", async () => {
    const partnerId = dodajPartnera();
    const inny = Number(s.db.insert(partnerzy).values({ nazwa: "Inny", aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id;
    const login = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    const auth = { Authorization: `Bearer ${(login.body as { token: string }).token}` };
    expect((await request(s.app).get(`/api/partnerzy/${partnerId}/zamowienia/${id}/podglad-selly`)).status).toBe(401);
    expect((await request(s.app).get(`/api/partnerzy/${inny}/zamowienia/${id}/podglad-selly`).set(auth)).status).toBe(404);
    expect((await request(s.app).get(`/api/partnerzy/${partnerId}/zamowienia/999/podglad-selly`).set(auth)).status).toBe(404);
    const ok = await request(s.app).get(`/api/partnerzy/${partnerId}/zamowienia/${id}/podglad-selly`).set(auth);
    expect(ok.status).toBe(200);
    expect(ok.body.pozycje).toHaveLength(2);
  });
});
