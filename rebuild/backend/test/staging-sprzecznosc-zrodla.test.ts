/**
 * `POST /api/staging/:id/resolve-source-conflict` — „Połącz w jeden produkt" / „Rozdziel na
 * dwa osobne produkty". Trasa spoza oryginału (świadoma decyzja użytkownika, 2026-09-29):
 * decyzja od razu zatwierdza wynik do katalogu.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { products, stagingItems } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { pozycja } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;

const EAN = "5901234123457";

const wiersz = (kod: string, stan: number) => ({
  kod,
  "kod dostawcy": kod,
  marka: "MITAS",
  model: "FL-08",
  rozmiar: "300-15",
  DOT: "nie starsza niz 3 lata",
  EAN,
  "cena zakupu": 1054.02,
  stan,
});

/** Zgłoszenie po imporcie z dwoma sprzecznymi wierszami — snapshot niesie późniejszy z nich. */
function sprzeczne(kodKarty: string) {
  return pozycja({
    kod: kodKarty,
    stanNowy: 1,
    cenaZakupuNowa: 1054.02,
    snapshot: {
      kod: kodKarty,
      marka: "MITAS",
      model: "FL-08",
      rozmiar: "300-15",
      dot: "nie starsza niz 3 lata",
      ean: EAN,
      cenaZakupu: 1054.02,
      stan: 1,
      kodDostawcy: "MO2_P887228318",
      _policyVersion: 2,
      _catalogVersion: null,
      _matchIssue: "Sprzeczne pozycje w jednym cenniku",
      _duplicateSource: true,
      _sourceKey: "klucz-pozniejszego",
      _sourceConflict: {
        earlier: wiersz("MO2_MIWD150315705L080", 13),
        later: wiersz("MO2_P887228318", 1),
        different: ["kod dostawcy", "stan"],
      },
    },
  }) as Wiersz;
}

describe("POST /api/staging/:id/resolve-source-conflict", () => {
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

  const post = (id: number, cialo: object) =>
    request(srodowisko.app)
      .post(`/api/staging/${id}/resolve-source-conflict`)
      .set("Authorization", `Bearer ${token}`)
      .send(cialo);
  const zasiej = (w: Wiersz) => {
    srodowisko.db.insert(stagingItems).values(w as never).run();
    return (srodowisko.db.select().from(stagingItems).all() as unknown as { id: number }[])[0]!;
  };
  const katalog = () =>
    srodowisko.db.select().from(products).all() as unknown as Record<string, unknown>[];
  const staging = () => srodowisko.db.select().from(stagingItems).all();

  it("merge: jeden produkt w katalogu, dane z późniejszego wiersza, staging pusty", async () => {
    const a = zasiej(sprzeczne("MO2_P887228318"));

    const odp = await post(a.id, { decision: "merge" });

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true, kody: ["MO2_P887228318"] });
    const p = katalog();
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ kod: "MO2_P887228318", stan: 1, ean: EAN });
    expect(staging()).toHaveLength(0);
  });

  it("split: dwa produkty o kodach z pliku, każdy z własnym stanem", async () => {
    const a = zasiej(sprzeczne("MO2_P887228318"));

    const odp = await post(a.id, { decision: "split" });

    expect(odp.status).toBe(200);
    expect([...odp.body.kody].sort()).toEqual(["MO2_MIWD150315705L080", "MO2_P887228318"]);
    const p = katalog();
    expect(p).toHaveLength(2);
    const poKodzie = Object.fromEntries(p.map((x) => [x.kod as string, x]));
    expect(poKodzie["MO2_MIWD150315705L080"]).toMatchObject({ stan: 13 });
    expect(poKodzie["MO2_P887228318"]).toMatchObject({ stan: 1 });
    expect(staging()).toHaveLength(0);
  });

  it("split: kod z pliku już zajęty w katalogu → 409 i nic się nie zmienia", async () => {
    srodowisko.db
      .insert(products)
      .values({
        kod: "MO2_MIWD150315705L080",
        nazwa: "inna",
        marka: "X",
        kategoria: "Rolnicze",
        dostawca: "MO5",
        magazyn: "PL",
        stan: 2,
        cenaZakupu: 1,
        cenaSprzedazy: 1,
        marzaPct: 0,
        vat: 23,
        status: "aktywny",
        rozmiar: "300-15",
        dataAktualizacji: "2026-01-01T00:00:00.000Z",
      } as never)
      .run();
    const a = zasiej(sprzeczne("MO2_P887228318"));

    const odp = await post(a.id, { decision: "split" });

    expect(odp.status).toBe(409);
    expect(odp.body.message).toMatch(/już istnieje/);
    expect(katalog()).toHaveLength(1);
    expect(staging()).toHaveLength(1);
  });

  it("zgłoszenie bez sprzeczności → 409", async () => {
    const a = zasiej(pozycja({ snapshot: { _policyVersion: 2, _catalogVersion: null } }) as Wiersz);

    const odp = await post(a.id, { decision: "merge" });

    expect(odp.status).toBe(409);
    expect(odp.body.message).toMatch(/nie dotyczy sprzecznych/);
  });

  it("nieprawidłowa decyzja → 409", async () => {
    const a = zasiej(sprzeczne("MO2_P887228318"));

    const odp = await post(a.id, { decision: "cokolwiek" });

    expect(odp.status).toBe(409);
    expect(odp.body).toEqual({ message: "Nieprawidłowa decyzja." });
  });

  it("bez tokenu → 401", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/staging/1/resolve-source-conflict")
      .send({ decision: "merge" });
    expect(odp.status).toBe(401);
  });
});
