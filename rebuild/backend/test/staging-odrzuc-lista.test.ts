// „Odrzuć” z LISTY stagingu (ticket 202, wpis #187.1): dla zmiany istniejącej karty działa jak „Odrzuć” w szczegółach
// (poprawka Marty), reszta pozycji jest kasowana jak dotąd.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { auditLog, manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const KOD = "MO5_BFPR240460708DUT1";
const katalog = join(dirname(fileURLToPath(import.meta.url)), "charakteryzacja");
const wczytaj = <T>(sciezka: string): T => JSON.parse(readFileSync(sciezka, "utf-8")) as T;
type Wiersz = Record<string, unknown>;

describe("POST /api/staging/reject — zapamiętywanie zmian istniejących kart", () => {
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

  const reject = (cialo: object) =>
    request(srodowisko.app).post("/api/staging/reject").set("Authorization", `Bearer ${token}`).send(cialo);

  /** Karta z fixture'a + import rekordu z innym modelem → zgłoszenie `zmiana_kluczowa`. */
  function zmianaKarty(): number {
    const produkt = wczytaj<Wiersz[]>(join(katalog, "silnik", "katalog", "MO5.katalog.json")).find((p) => p.kod === KOD)!;
    const rekord = wczytaj<{ rekordy: Wiersz[] }>(join(katalog, "MO5.expected.json")).rekordy.find((r) => r.kod === KOD)!;
    const konstrukcja = produkt.konstrukcja === "D" ? "Diagonalna" : "Radialna";
    srodowisko.db
      .insert(products)
      .values({ ...produkt, konstrukcja, model: "DURAFORCE UTILITY" } as never)
      .run();
    silnikStagingu(srodowisko.db)("MO5", [{ ...rekord, model: "DURAFORCE-UTILITY" } as unknown as RekordSurowy]);
    return srodowisko.db.select().from(stagingItems).all().find((w) => w.kod === KOD)!.id;
  }

  it("zmiana istniejącej karty: karta zostaje, powstaje poprawka Marty, zgłoszenie znika, odpowiedź niesie `kept`", async () => {
    const id = zmianaKarty();

    const odp = await reject({ ids: [id] });

    expect(odp.body).toEqual({ ok: true, rejected: 1, kept: 1 });
    expect(srodowisko.db.select().from(stagingItems).all().filter((w) => w.kod === KOD)).toHaveLength(0);
    const poprawka = srodowisko.db.select().from(manualOverrides).all().find((p) => p.fieldName === "model")!;
    expect(poprawka.overrideValue).toBe("DURAFORCE UTILITY");
    const karta = srodowisko.db.select().from(products).all().find((p) => p.kod === KOD)!;
    expect(karta.model).toBe("DURAFORCE UTILITY");
    const wpis = (srodowisko.db.select().from(auditLog).all() as unknown as Wiersz[]).find(
      (w) => w.akcja === "odrzucenie_stagingu",
    )!;
    expect(String(wpis.szczegolyJson)).toContain("zapamietane_poprawka");
  });

  it("zmiana kluczowa bez karty w katalogu → zwykłe skasowanie, `kept` = 0", async () => {
    srodowisko.db
      .insert(stagingItems)
      .values({
        typZmiany: "zmiana_kluczowa",
        kod: "BRAK",
        nazwa: "Opona bez karty",
        dostawca: "MO5",
        magazyn: "PL",
        stanNowy: 1,
        cenaZakupuNowa: 10,
        utworzono: "2026-02-01T00:00:00.000Z",
        snapshotJson: JSON.stringify({ kod: "BRAK" }),
      } as never)
      .run();
    const [wiersz] = srodowisko.db.select().from(stagingItems).all();

    const odp = await reject({ ids: [wiersz!.id] });

    expect(odp.body).toEqual({ ok: true, rejected: 1, kept: 0 });
    expect(srodowisko.db.select().from(stagingItems).all()).toHaveLength(0);
    expect(srodowisko.db.select().from(manualOverrides).all()).toHaveLength(0);
  });

  it("masowo (`allFiltered`): zmiana karty zapamiętana, pozycja innego typu skasowana", async () => {
    zmianaKarty();
    srodowisko.db
      .insert(stagingItems)
      .values({
        typZmiany: "nowa",
        kod: "NOWA1",
        nazwa: "Nowa opona",
        dostawca: "MO5",
        magazyn: "PL",
        stanNowy: 1,
        cenaZakupuNowa: 10,
        utworzono: "2026-02-01T00:00:00.000Z",
        snapshotJson: JSON.stringify({ kod: "NOWA1" }),
      } as never)
      .run();

    const odp = await reject({ allFiltered: true, typZmiany: "all" });

    expect(odp.body).toEqual({ ok: true, rejected: 2, kept: 1 });
    expect(srodowisko.db.select().from(stagingItems).all()).toHaveLength(0);
  });
});
