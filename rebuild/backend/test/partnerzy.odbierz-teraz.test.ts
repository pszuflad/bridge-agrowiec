/** „Odbierz teraz” zamówienia z e-maila partnera (ticket 231, PRT-7.3a): trasa na atrapie skrzynki — nigdy prawdziwa poczta. */
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { auditLog } from "../src/db/schema.js";
import { _zresetujZamkiOdbioru, type OdbiorEmail } from "../src/partnerzy/odbior-email.js";
import type { OtworzSkrzynke, WiadomoscPoczty } from "../src/partnerzy/poczta.js";
import { listaZamowien } from "../src/repos/partnerzy-zamowienia.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

const wiadomosc = (id: string): WiadomoscPoczty => ({
  id,
  wczytaj: async () => ({ temat: `Zamówienie ${id}`, od: "partner@example.test", zalaczniki: [{ nazwa: "z.xml", typ: "application/xml", tresc: Buffer.from(XML_PRZYKLAD) }] }),
  oznaczPrzetworzona: async () => undefined,
});

function odbior(opcje: { wiadomosci?: WiadomoscPoczty[]; brama?: Promise<void>; haslo?: string | undefined } = {}): OdbiorEmail & { polaczenia: number } {
  const wynik = {
    polaczenia: 0,
    otworz: (async () => {
      wynik.polaczenia++;
      if (opcje.brama) await opcje.brama;
      return { pobierzNieprzeczytane: async () => opcje.wiadomosci ?? [], zamknij: async () => undefined };
    }) as OtworzSkrzynke,
    ustawienia: { host: "imap.example.test", port: 993, haslo: () => ("haslo" in opcje ? opcje.haslo : "tajne") },
  };
  return wynik;
}

describe("POST /api/partnerzy/:id/zamowienia/odbierz", () => {
  let s: SrodowiskoTestowe;
  let token: string;

  const start = async (odbiorEmail?: OdbiorEmail) => {
    _zresetujZamkiOdbioru();
    s = await stworzSrodowiskoTestowe(undefined, { odbiorEmail });
    const odp = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    token = (odp.body as { token: string }).token;
  };
  afterEach(() => s.posprzataj());

  const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);
  const dodajPartnera = async (pola: object = { kanalEmail: true, emailSkrzynka: "zam@example.test" }) => {
    const id = ((await auth(request(s.app).post("/api/partnerzy")).send({ nazwa: "TyreWorld" })).body as { id: number }).id;
    await auth(request(s.app).put(`/api/partnerzy/${id}`)).send(pola);
    return id;
  };
  const odbierz = (id: number) => auth(request(s.app).post(`/api/partnerzy/${id}/zamowienia/odbierz`)).send({});

  it("wymaga logowania", async () => {
    await start(odbior());
    expect((await request(s.app).post("/api/partnerzy/1/zamowienia/odbierz")).status).toBe(401);
  });

  it("503, gdy aplikacja nie ma wstrzykniętego odbioru", async () => {
    await start();
    const id = await dodajPartnera();
    expect((await odbierz(id)).status).toBe(503);
  });

  it("404 dla nieistniejącego partnera; 409, gdy partner nie ma kanału e-mail lub adresu skrzynki", async () => {
    await start(odbior());
    expect((await odbierz(999)).status).toBe(404);
    const id = await dodajPartnera({ kanalEmail: false });
    const odp = await odbierz(id);
    expect(odp.status).toBe(409);
    expect((odp.body as { error: string }).error).toMatch(/kanału e-mail/);
  });

  it("odbiera zamówienie także dla partnera NIEAKTYWNEGO i zwraca wynik; zapisuje audyt", async () => {
    const o = odbior({ wiadomosci: [wiadomosc("1")] });
    await start(o);
    const id = await dodajPartnera();
    const odp = await odbierz(id);
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ polaczono: true, powod: null, wiadomosci: 1, nowe: 1, duplikaty: 0, bledy: 0 });
    expect(listaZamowien(s.db, id)).toHaveLength(1);
    expect(s.db.select().from(auditLog).where(eq(auditLog.akcja, "partner_odbior_reczny")).all()).toHaveLength(1);
    // drugi raz ten sam plik — duplikat, bez nowego zamówienia
    expect((await odbierz(id)).body).toMatchObject({ nowe: 0, duplikaty: 1 });
  });

  it("brak hasła w konfiguracji to 200 z czytelnym powodem (nazwa zmiennej, bez wartości) i bez łączenia", async () => {
    const o = odbior({ haslo: undefined });
    await start(o);
    const id = await dodajPartnera();
    const odp = await odbierz(id);
    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject({ polaczono: false, wiadomosci: 0 });
    expect((odp.body as { powod: string }).powod).toContain(`PARTNERZY_IMAP_HASLO_${id}`);
    expect(o.polaczenia).toBe(0);
  });

  it("awaria połączenia to 200 z powodem, bez wycieku hasła", async () => {
    const o = odbior();
    o.otworz = async () => {
      throw new Error("AUTH failed pass=tajne");
    };
    await start(o);
    const id = await dodajPartnera();
    const odp = await odbierz(id);
    expect(odp.status).toBe(200);
    expect((odp.body as { powod: string }).powod).toMatch(/AUTH failed pass=\*\*\*/);
    expect(JSON.stringify(odp.body)).not.toContain("tajne");
  });

  it("drugi odbiór, gdy pierwszy jeszcze trwa, dostaje 409 (zamek), a po zakończeniu znów działa", async () => {
    let zwolnij!: () => void;
    const o = odbior({ brama: new Promise<void>((r) => (zwolnij = r)) });
    await start(o);
    const id = await dodajPartnera();
    const pierwszy = odbierz(id).then((r) => r);
    while (o.polaczenia === 0) await new Promise((r) => setTimeout(r, 10)); // pierwszy trzyma zamek na bramie
    const drugi = await odbierz(id);
    expect(drugi.status).toBe(409);
    expect((drugi.body as { error: string }).error).toMatch(/już trwa/);
    zwolnij();
    expect((await pierwszy).status).toBe(200);
    expect((await odbierz(id)).status).toBe(200);
  });

  it("nieoczekiwany wyjątek to 500 z ogólnym komunikatem (bez szczegółów i sekretów)", async () => {
    const o = odbior();
    o.ustawienia = { ...o.ustawienia, haslo: () => { throw new Error("boom pass=tajne"); } };
    await start(o);
    const id = await dodajPartnera();
    const odp = await odbierz(id);
    expect(odp.status).toBe(500);
    expect(JSON.stringify(odp.body)).not.toContain("tajne");
    expect(JSON.stringify(odp.body)).not.toContain("boom");
  });

  it("przerwany po połączeniu odbiór nie wygląda na sukces: powód i licznik błędów", async () => {
    const o = odbior();
    o.otworz = async () => ({ pobierzNieprzeczytane: async () => { throw new Error("SEARCH failed"); }, zamknij: async () => undefined });
    await start(o);
    const id = await dodajPartnera();
    const odp = await odbierz(id);
    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject({ polaczono: true, bledy: 1, powod: expect.stringContaining("SEARCH failed") });
  });
});
