// Ticket 207: zakładka „Nieobecne w imporcie” — lista (próg od wstrzymania), usunięcie z archiwum, przywrócenie jako aktywne.
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listaNieobecnych, progDniDostawcy } from "../src/import/nieobecne.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const TERAZ = new Date("2026-10-20T12:00:00.000Z");
const dniTemu = (n: number): string => new Date(TERAZ.getTime() - n * 86_400_000).toISOString();

describe("Nieobecne w imporcie", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });
  afterEach(() => srodowisko.posprzataj());

  const sqlite = () => srodowisko.sqlite;
  const karta = (kod: string, dostawca: string, status: string, wstrzymanoDniTemu: number | null) => {
    sqlite()
      .prepare(
        `INSERT INTO products (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy, marza_pct, data_aktualizacji, status)
         VALUES (?, ?, 'BKT', 'Rolnicze', ?, '0', 0, 1, 1, 0, '2026-10-01', ?)`,
      )
      .run(kod, `Opona ${kod}`, dostawca, status);
    if (wstrzymanoDniTemu !== null)
      sqlite()
        .prepare("INSERT INTO product_auto_suspensions (supplier, product_code, suspended_at, reason) VALUES (?,?,?, 'Brak w aktualnym, kompletnym cenniku dostawcy')")
        .run(dostawca, kod, dniTemu(wstrzymanoDniTemu));
  };
  const id = (kod: string) => (sqlite().prepare("SELECT id FROM products WHERE kod=?").get(kod) as { id: number }).id;
  const kody = () => (sqlite().prepare("SELECT kod FROM products ORDER BY kod").all() as { kod: string }[]).map((r) => r.kod);

  it("próg: 7 dni od wstrzymania; MO7/MO8 (roczne cenniki) bez bufora; ręcznie wstrzymane i aktywne nie wchodzą", () => {
    karta("MO1_STARA", "MO1", "wstrzymany", 8);
    karta("MO1_SWIEZA", "MO1", "wstrzymany", 3);
    karta("MO7_NOKIAN", "MO7", "wstrzymany", 0);
    karta("MO8_TRELL", "MO8", "wstrzymany", 1);
    karta("MO1_RECZNA", "MO1", "wstrzymany", null);
    karta("MO1_AKTYWNA", "MO1", "aktywny", 30);

    const lista = listaNieobecnych(sqlite(), TERAZ).map((p) => p.kod);

    expect(lista.sort()).toEqual(["MO1_STARA", "MO7_NOKIAN", "MO8_TRELL"]);
    expect(progDniDostawcy("MO7")).toBe(0);
    expect(progDniDostawcy("MO1")).toBe(7);
  });

  it("GET /api/nieobecne wymaga logowania i zwraca listę z liczbą dni", async () => {
    expect((await request(srodowisko.app).get("/api/nieobecne")).status).toBe(401);
    karta("MO1_STARA", "MO1", "wstrzymany", 400);

    const odp = await request(srodowisko.app).get("/api/nieobecne").set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
    expect(odp.body.items).toHaveLength(1);
    expect(odp.body.items[0]).toMatchObject({ kod: "MO1_STARA", dostawca: "MO1" });
    expect(odp.body.items[0].dniNieobecnosci).toBeGreaterThanOrEqual(7);
  });

  it("usuń: karta znika z katalogu, trafia do archiwum i audytu; ids spoza listy są pomijane", async () => {
    karta("MO1_STARA", "MO1", "wstrzymany", 400);
    karta("MO1_SWIEZA", "MO1", "wstrzymany", 1);
    karta("MO1_AKTYWNA", "MO1", "aktywny", null);

    const odp = await request(srodowisko.app)
      .post("/api/nieobecne/usun")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [id("MO1_STARA"), id("MO1_SWIEZA"), id("MO1_AKTYWNA")] });

    expect(odp.body).toMatchObject({ ok: true, usuniete: 1, kody: ["MO1_STARA"] });
    expect(kody()).toEqual(["MO1_AKTYWNA", "MO1_SWIEZA"]);
    expect(sqlite().prepare("SELECT scalono_do FROM products_scalone WHERE kod='MO1_STARA'").get()).toEqual({
      scalono_do: "USUNIĘTA (nieobecna w imporcie)",
    });
    expect(sqlite().prepare("SELECT COUNT(*) c FROM audit_log WHERE akcja='usuniecie_nieobecnej'").get()).toEqual({ c: 1 });
  });

  it("przywróć jako aktywne: status aktywny, znika z listy, zdjęte automatyczne wstrzymanie", async () => {
    karta("MO1_STARA", "MO1", "wstrzymany", 400);
    sqlite().prepare("INSERT INTO product_absence_checks (supplier, product_code, checks_json) VALUES ('MO1','MO1_STARA','[]')").run();

    const odp = await request(srodowisko.app)
      .post("/api/nieobecne/przywroc")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [id("MO1_STARA")] });

    expect(odp.body).toMatchObject({ ok: true, przywrocone: 1 });
    expect(sqlite().prepare("SELECT status FROM products WHERE kod='MO1_STARA'").get()).toEqual({ status: "aktywny" });
    expect(sqlite().prepare("SELECT COUNT(*) c FROM product_auto_suspensions").get()).toEqual({ c: 0 });
    expect(sqlite().prepare("SELECT COUNT(*) c FROM product_absence_checks").get()).toEqual({ c: 0 });
    expect(listaNieobecnych(sqlite(), TERAZ)).toHaveLength(0);
  });
});
