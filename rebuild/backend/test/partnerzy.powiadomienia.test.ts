/** Ticket 263: powiadomienia e-mail o błędach zamówień partnerów — atrapa nadawcy, NIGDY prawdziwy SMTP. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { zastosujMigracje } from "../src/db/migrate.js";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { partnerPowiadomienia, partnerZamowienia, partnerzy } from "../src/db/schema.js";
import { wyslijNowePowiadomienia } from "../src/partnerzy/powiadomienia.js";
import { konfiguracjaSmtp, parsujAdresy, type NadawcaEmail, type WiadomoscDoWyslania } from "../src/poczta/nadawca.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("konfiguracja SMTP i adresy", () => {
  it("konfiguracja wymaga hosta, użytkownika, hasła i nadawcy; domyślny port 465 i nazwa", () => {
    expect(konfiguracjaSmtp({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_OD: "u@h.pl" })).toBeNull(); // brak hasła
    expect(konfiguracjaSmtp({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_HASLO: "x", SMTP_OD: "u@h.pl" })).toEqual({ host: "h", port: 465, uzytkownik: "u", haslo: "x", od: "u@h.pl", nazwaNadawcy: "Bridge" });
  });
  it("adresy: przecinek lub średnik, niepoprawne odrzucone", () => {
    expect(parsujAdresy("a@x.pl, b@y.pl;zly,  ")).toEqual(["a@x.pl", "b@y.pl"]);
    expect(parsujAdresy(undefined)).toEqual([]);
  });
});

describe("przebieg powiadomień o błędach importu", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  let wyslane: WiadomoscDoWyslania[];
  let psuj: boolean;
  const nadawca: NadawcaEmail = { wyslij: async (w) => { if (psuj) throw new Error("SMTP padł"); wyslane.push(w); } };
  let partnerId: number;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-263-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "t.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    wyslane = [];
    psuj = false;
    partnerId = Number(db.insert(partnerzy).values({ nazwa: "Adtyres", utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });
  const zamowienie = (numer: string, status: string, blad: string | null = null) =>
    Number(db.insert(partnerZamowienia).values({ partnerId, numerPartnera: numer, status, bladImportu: blad, surowyXml: "<SECRET/>", skrotXml: numer, pobrano: "x" }).run().lastInsertRowid);

  it("wysyła jedną wiadomość na zamówienie z błędem importu, tylko raz; poprawne zamówienia pomija; bez surowego XML-a", async () => {
    zamowienie("A1", "blad_importu", "Brak pozycji w katalogu: X");
    zamowienie("A2", "przyjete");
    const w1 = await wyslijNowePowiadomienia(db, nadawca, ["marta@firma.example"]);
    expect(w1).toEqual({ wyslane: 1, bledy: 0 });
    expect(wyslane).toHaveLength(1);
    expect(wyslane[0]!.do).toEqual(["marta@firma.example"]);
    expect(wyslane[0]!.temat).toContain("Adtyres A1");
    expect(wyslane[0]!.tekst).toContain("Brak pozycji w katalogu: X");
    expect(wyslane[0]!.tekst).not.toContain("SECRET");
    expect((await wyslijNowePowiadomienia(db, nadawca, ["marta@firma.example"])).wyslane).toBe(0);
    expect(wyslane).toHaveLength(1);
    expect(db.select().from(partnerPowiadomienia).all()).toHaveLength(1);
  });

  it("błąd SMTP nie zapisuje „wysłano” — następny przebieg ponawia; nowe zamówienia z błędem też dostają wiadomość", async () => {
    zamowienie("A1", "blad_importu", "x");
    psuj = true;
    const log: string[] = [];
    expect(await wyslijNowePowiadomienia(db, nadawca, ["m@f.pl"], { log: (l) => log.push(l) })).toEqual({ wyslane: 0, bledy: 1 });
    expect(log[0]).toMatch(/SMTP padł.*ponowię/);
    psuj = false;
    zamowienie("A2", "blad_importu", "y");
    expect(await wyslijNowePowiadomienia(db, nadawca, ["m@f.pl"])).toEqual({ wyslane: 2, bledy: 0 });
  });

  it("bez odbiorców nic nie wysyła ani nie zapisuje", async () => {
    zamowienie("A1", "blad_importu", "x");
    expect(await wyslijNowePowiadomienia(db, nadawca, [])).toEqual({ wyslane: 0, bledy: 0 });
    expect(db.select().from(partnerPowiadomienia).all()).toHaveLength(0);
  });
});

describe("POST /api/partnerzy/powiadomienia/test", () => {
  let s: SrodowiskoTestowe;
  afterEach(() => s.posprzataj());
  const zaloguj = async () => ({ Authorization: `Bearer ${((await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo })).body as { token: string }).token}` });

  it("401 bez logowania; 503 bez konfiguracji; z konfiguracją wysyła wiadomość próbną; błąd SMTP = 502", async () => {
    s = await stworzSrodowiskoTestowe();
    expect((await request(s.app).post("/api/partnerzy/powiadomienia/test")).status).toBe(401);
    expect((await request(s.app).post("/api/partnerzy/powiadomienia/test").set(await zaloguj())).status).toBe(503);
    s.posprzataj();
    const wyslane: WiadomoscDoWyslania[] = [];
    let psuj = false;
    const nadawca: NadawcaEmail = { wyslij: async (w) => { if (psuj) throw new Error("odmowa serwera"); wyslane.push(w); } };
    s = await stworzSrodowiskoTestowe(undefined, { powiadomienia: { nadawca, odbiorcy: ["m@f.pl"] } });
    const ok = await request(s.app).post("/api/partnerzy/powiadomienia/test").set(await zaloguj());
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ wyslano: 1 });
    expect(wyslane[0]!.temat).toMatch(/próbna/);
    psuj = true;
    const zle = await request(s.app).post("/api/partnerzy/powiadomienia/test").set(await zaloguj());
    expect(zle.status).toBe(502);
    expect(zle.body.error).toMatch(/odmowa serwera/);
  });
});
