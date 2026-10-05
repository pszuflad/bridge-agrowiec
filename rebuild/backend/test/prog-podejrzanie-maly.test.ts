// Ticket 179 — Etap 4b SPEC 2026-10-01: próg „cennik podejrzanie mały” liczony od ostatniego UDANEGO importu,
// z alertem z listą brakujących kodów i ręcznym „zaakceptuj mniejszy cennik”.
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import { minimumPozycjiOferty } from "../src/import/polityka/tolerancja-dopasowania.js";
import { silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

let baza: TestowaBaza | null = null;
let srodowisko: SrodowiskoTestowe | null = null;
afterEach(() => {
  baza?.posprzataj();
  baza = null;
  srodowisko?.posprzataj();
  srodowisko = null;
});

describe("minimumPozycjiOferty", () => {
  it.each([
    [undefined, 1],
    [{ lastItemCount: 0 }, 1],
    [{ lastItemCount: 100 }, 1],
    [{ lastItemCount: 301 }, 1],
  ])("%j → %i", (stan, oczekiwane) => {
    expect(minimumPozycjiOferty(stan)).toBe(oczekiwane);
  });
});

const rekordy = (n: number, od = 0): RekordSurowy[] =>
  Array.from({ length: n }, (_, i) => {
    const k = od + i;
    return {
      kod: `MO4_K${k}`,
      kodDostawcy: `K${k}`,
      nazwa: `Opona Mitas ${k} 18.4R34`,
      marka: "MITAS",
      model: `M${k}`,
      rozmiar: "18.4R34",
      stan: 5,
      cenaZakupu: 100,
      ean: null,
    } as unknown as RekordSurowy;
  });
const KOMPLETNY = { meta: { complete: true } as never };

describe("brak progu względnego (2026-10-05)", () => {
  it("spadek o 60% przechodzi bez blokady; pusty cennik nadal zatrzymuje import", () => {
    baza = stworzTestowaBaze();
    const importuj = silnikStagingu(baza.db);
    importuj("MO4", rekordy(100), KOMPLETNY);
    expect(() => importuj("MO4", rekordy(40), KOMPLETNY)).not.toThrow();
    expect(() => importuj("MO4", [], KOMPLETNY)).toThrow(/Nie ma ani jednej pozycji/);
  });
});

describe("POST /api/dostawcy/:kod/akceptuj-mniejszy-cennik", () => {
  it("przestawia punkt odniesienia na liczbę z zablokowanej próby, zapisuje audyt; bez próby → 404", async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const s = srodowisko;
    const token = (
      (await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo })).body as {
        token: string;
      }
    ).token;
    const post = () =>
      request(s.app).post("/api/dostawcy/MO4/akceptuj-mniejszy-cennik").set("Authorization", `Bearer ${token}`).send({});

    expect((await request(s.app).post("/api/dostawcy/MO4/akceptuj-mniejszy-cennik").send({})).status).toBe(401);
    expect((await post()).status).toBe(404);

    s.sqlite
      .prepare("INSERT INTO supplier_feed_state (supplier,last_item_count,max_item_count,updated_at) VALUES ('MO4',301,311,'2026-10-01')")
      .run();
    s.sqlite.prepare("INSERT INTO supplier_feed_blocked (supplier,item_count,blocked_at) VALUES ('MO4',244,'2026-10-01')").run();
    const odp = await post();
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true, liczba: 244, poprzednia: 301 });
    expect(s.sqlite.prepare("SELECT last_item_count l, max_item_count m FROM supplier_feed_state").get()).toEqual({
      l: 244,
      m: 244,
    });
    expect(s.sqlite.prepare("SELECT 1 FROM supplier_feed_blocked").all()).toEqual([]);
    expect(s.sqlite.prepare("SELECT akcja FROM audit_log WHERE akcja='akceptacja_mniejszego_cennika'").all()).toHaveLength(1);
    expect((await post()).status).toBe(404);
  });
});

describe("migracja 019: jednorazowy reset progu", () => {
  it("max_item_count = last_item_count dla dostawców z policzoną ofertą", () => {
    baza = stworzTestowaBaze();
    // baza po wszystkich migracjach — cofamy znacznik 019 i symulujemy stan sprzed resetu
    baza.sqlite
      .prepare("INSERT INTO supplier_feed_state (supplier,last_item_count,max_item_count,updated_at) VALUES ('MO4',301,311,'x'),('MO9',0,5,'x')")
      .run();
    baza.sqlite.prepare("DELETE FROM _migracje WHERE nazwa LIKE '019%'").run();
    expect(zastosujMigracje(baza.sqlite, KATALOG_SCHEMATU()).zastosowane).toEqual(["019_feed_state_zablokowana_liczba.sql"]);
    expect(baza.sqlite.prepare("SELECT supplier, max_item_count m FROM supplier_feed_state ORDER BY supplier").all()).toEqual([
      { supplier: "MO4", m: 301 },
      { supplier: "MO9", m: 5 },
    ]);
  });
});
