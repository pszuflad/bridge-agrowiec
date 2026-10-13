/** Ticket 250: `GET /api/partnerzy/kurs-nbp` — aktualny kurs EUR do podglądu w panelu (atrapa NBP, bez sieci). */
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { kursyNbp } from "../src/db/schema.js";
import type { KlientNbp } from "../src/partnerzy/kurs-nbp.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("GET /api/partnerzy/kurs-nbp", () => {
  let s: SrodowiskoTestowe;
  afterEach(() => s.posprzataj());
  const zaloguj = async () => {
    const odp = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    return { Authorization: `Bearer ${(odp.body as { token: string }).token}` };
  };

  it("oddaje kurs i datę tabeli z NBP i zapisuje go w kursy_nbp (ten sam mechanizm co generowanie cennika)", async () => {
    const klientNbp: KlientNbp = { pobierzKursEur: () => Promise.resolve({ kurs: 4.2431, data: "2026-10-13" }) };
    s = await stworzSrodowiskoTestowe(undefined, { klientNbp });
    const odp = await request(s.app).get("/api/partnerzy/kurs-nbp").set(await zaloguj());
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ kurs: 4.2431, zrodlo: "nbp", dataTabeli: "2026-10-13", ostrzezenie: null });
    expect(s.db.select().from(kursyNbp).all()).toMatchObject([{ data: "2026-10-13", kurs: 4.2431 }]);
  });

  it("NBP nie odpowiada: ostatni zapisany kurs z ostrzeżeniem; bez żadnego kursu 502", async () => {
    const klientNbp: KlientNbp = { pobierzKursEur: () => Promise.reject(new Error("timeout")) };
    s = await stworzSrodowiskoTestowe(undefined, { klientNbp });
    const auth = await zaloguj();
    expect((await request(s.app).get("/api/partnerzy/kurs-nbp").set(auth)).status).toBe(502);
    s.db.insert(kursyNbp).values({ data: "2026-10-10", kurs: 4.3, pobrano: "x" }).run();
    const odp = await request(s.app).get("/api/partnerzy/kurs-nbp").set(auth);
    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject({ kurs: 4.3, zrodlo: "nbp-zapisany", dataTabeli: "2026-10-10" });
    expect(odp.body.ostrzezenie).toMatch(/timeout/);
  });

  it("bez klienta NBP 503, bez zalogowania 401", async () => {
    s = await stworzSrodowiskoTestowe();
    expect((await request(s.app).get("/api/partnerzy/kurs-nbp")).status).toBe(401);
    expect((await request(s.app).get("/api/partnerzy/kurs-nbp").set(await zaloguj())).status).toBe(503);
  });
});
