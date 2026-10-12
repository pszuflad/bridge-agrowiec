/** Ticket 240: słowniki zamówień Selly (tylko odczyt) dla partnerów — wyłącznie atrapa klienta Selly, nigdy prawdziwy sklep. */
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { stworzAtrapeSelly } from "./gate/selly-atrapa.js";

describe("GET /api/partnerzy/selly/slowniki-zamowien", () => {
  let s: SrodowiskoTestowe;
  afterEach(() => s.posprzataj());

  const zaloguj = async (): Promise<string> => {
    const odp = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    return (odp.body as { token: string }).token;
  };

  it("zwraca statusy, płatności i dostawy z Selly (tylko odczyt, kolejność nie psuje ścieżki :id)", async () => {
    const atrapa = stworzAtrapeSelly();
    s = await stworzSrodowiskoTestowe(undefined, { klientSelly: atrapa.klient });
    const odp = await request(s.app).get("/api/partnerzy/selly/slowniki-zamowien").set("Authorization", `Bearer ${await zaloguj()}`);
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({
      statusy: [{ status_id: 1, name: "Nowe" }],
      platnosci: [{ payment_id: 1, name: "Przelew" }],
      dostawy: [{ delivery_id: 1, name: "Kurier" }],
    });
    expect(atrapa.wywolania.map((w) => w.metoda).sort()).toEqual(["listOrderDeliveries", "listOrderPayments", "listOrderStatuses"]);
  });

  it("bez zalogowania 401", async () => {
    s = await stworzSrodowiskoTestowe();
    expect((await request(s.app).get("/api/partnerzy/selly/slowniki-zamowien")).status).toBe(401);
  });
});
