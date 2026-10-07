// Ticket 194: `GET /api/selly/usuwanie-status` — stan Toru 3 dla panelu Selly.
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { odczytajStanTor3, zapiszStanTor3, zresetujStanTor3 } from "../src/selly/rest/stan-tor3.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("GET /api/selly/usuwanie-status", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    zresetujStanTor3();
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });
  afterEach(() => srodowisko.posprzataj());

  const pobierz = () => request(srodowisko.app).get("/api/selly/usuwanie-status").set("Authorization", `Bearer ${token}`);

  it("wymaga logowania", async () => {
    expect((await request(srodowisko.app).get("/api/selly/usuwanie-status")).status).toBe(401);
  });

  it("przed pierwszym przebiegiem: `ostatni_przebieg` jest null, a liczby i limity są podane", async () => {
    const odp = await pobierz();
    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject({
      ostatni_przebieg: null,
      proba_uprawnien: null,
      sierot_teraz: 0,
      usuniec_24h: 0,
      limit_dobowy: 200,
      ostatnie_usuniecie: null,
    });
    expect(Array.isArray((odp.body as { powody_wylaczenia: unknown }).powody_wylaczenia)).toBe(true);
  });

  it("oddaje wynik ostatniego przebiegu zapisany przez Tor 3", async () => {
    zapiszStanTor3({ wynik: "brak_sierot", opis: "Przebieg wykonany — nie ma produktów do usunięcia z Selly", sieroty: 0 });
    const odp = await pobierz();
    expect(odp.body).toMatchObject({ ostatni_przebieg: { wynik: "brak_sierot", sieroty: 0 } });
    expect(odczytajStanTor3()?.kiedy).toBe((odp.body as { ostatni_przebieg: { kiedy: string } }).ostatni_przebieg.kiedy);
  });

  it("`GET /api/selly/log?grupa=…` rozdziela wpisy usuwania od synchronizacji (nie wypychają się nawzajem)", async () => {
    const wstaw = srodowisko.db.$client.prepare(
      `INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip, rozpoczeto, status)
       VALUES (?, ?, 0, 0, 0, ?, 'zakonczono')`,
    );
    wstaw.run("sync_delete", "ALL", "2026-10-06 01:00:00");
    wstaw.run("probe_delete_ok", "ALL", "2026-10-06 00:30:00");
    for (let i = 0; i < 15; i++) wstaw.run("sync_delta", `MO${i}`, `2026-10-06 10:${String(i).padStart(2, "0")}:00`);

    const pobierzLog = (q: string) =>
      request(srodowisko.app).get(`/api/selly/log${q}`).set("Authorization", `Bearer ${token}`);

    // Bez parametru jak dotąd — 5 najnowszych to same sync_delta (usuwanie wypadło z okna).
    const wszystko = (await pobierzLog("?limit=5")).body as { items: { operacja: string }[] };
    expect(wszystko.items.map((w) => w.operacja)).toEqual(Array(5).fill("sync_delta"));

    const usuwanie = (await pobierzLog("?limit=5&grupa=usuwanie")).body as { items: { operacja: string }[] };
    expect(usuwanie.items.map((w) => w.operacja)).toEqual(["sync_delete", "probe_delete_ok"]);

    const sync = (await pobierzLog("?limit=50&grupa=synchronizacja")).body as { items: { operacja: string }[] };
    expect(sync.items).toHaveLength(15);
    expect(sync.items.every((w) => w.operacja === "sync_delta")).toBe(true);

    // nieznana grupa = brak filtra
    const nieznana = (await pobierzLog("?limit=50&grupa=cokolwiek")).body as { items: unknown[] };
    expect(nieznana.items).toHaveLength(17);
  });

  it("liczy sieroty (mapowania bez produktu w Bridge) i pokazuje ostatnie usunięcie z Historii", async () => {
    srodowisko.db.$client
      .prepare("INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id) VALUES ('S1','MO1','MO1_NIE_MA',900,901)")
      .run();
    srodowisko.db.$client
      .prepare(
        `INSERT INTO audit_log (uzytkownik_imie, akcja, encja_typ, encja_id, szczegoly_json, kiedy)
         VALUES ('System (Selly)', 'selly_usuniecie', 'produkt', 'MO1_USUNIETY', '{"nazwa":"Opona X","akcja":"usunieto_produkt"}', '2026-10-06T09:00:00.000Z')`,
      )
      .run();

    const odp = await pobierz();

    expect(odp.body).toMatchObject({
      sierot_teraz: 1,
      usuniec_24h: expect.any(Number),
      ostatnie_usuniecie: { kod: "MO1_USUNIETY", nazwa: "Opona X", kiedy: "2026-10-06T09:00:00.000Z" },
    });
  });
});
