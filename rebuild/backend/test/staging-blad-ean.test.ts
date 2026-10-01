/**
 * `POST /api/staging/:id/resolve-ean` — „Rozstrzygnij" dla pozycji z BŁĘDNYM EAN-em od dostawcy
 * (decyzja użytkowniczki, 2026-10-01): `keep` = zostaje EAN z katalogu, `set` = wpisany poprawny.
 * Decyzja od razu zatwierdza pozycję i zapamiętuje się jako poprawka `ean`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";

import { manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { version } from "../src/import/polityka/helpery.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { pozycja, produkt } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;

const EAN_KARTY = "5901234123457";
const BLEDNY = "5901234123457_D";
const KOMUNIKAT = `Błędny EAN „${BLEDNY}”: numer zawiera znaki inne niż cyfry. Numer nie zostanie zapisany.`;

describe("POST /api/staging/:id/resolve-ean", () => {
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
      .post(`/api/staging/${id}/resolve-ean`)
      .set("Authorization", `Bearer ${token}`)
      .send(cialo);

  /** Karta w katalogu + pozycja stagingu z błędnym EAN-em z pliku. */
  function zasiej(eanKarty: string | null = EAN_KARTY, snapshot: Wiersz = {}) {
    srodowisko.db
      .insert(products)
      .values(produkt({ id: 5, kod: "P1", ean: eanKarty }) as never)
      .run();
    const karta = srodowisko.db.select().from(products).where(eq(products.kod, "P1")).get()!;
    srodowisko.db
      .insert(stagingItems)
      .values(
        pozycja({
          kod: "P1",
          typZmiany: "blad",
          powod: KOMUNIKAT,
          ostrzezenie: KOMUNIKAT,
          eanRaw: BLEDNY,
          eanIsValid: 0,
          eanSourceStatus: "invalid",
          snapshot: {
            _policyVersion: 2,
            _catalogVersion: version(karta as never),
            ean: null,
            eanRaw: BLEDNY,
            eanIsValid: 0,
            _eanIssue: "numer zawiera znaki inne niż cyfry",
            ...snapshot,
          },
        }) as never,
      )
      .run();
    return srodowisko.db.select().from(stagingItems).all()[0]!.id as number;
  }
  const katalog = () => srodowisko.db.select().from(products).all() as unknown as Wiersz[];
  const poprawki = () => srodowisko.db.select().from(manualOverrides).all() as unknown as Wiersz[];
  const staging = () => srodowisko.db.select().from(stagingItems).all();

  it("keep: zostaje EAN z katalogu, pozycja zatwierdzona, błędny numer zapamiętany", async () => {
    const id = zasiej();

    const odp = await post(id, { decision: "keep" });

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true, kod: "P1", ean: EAN_KARTY });
    expect(katalog()[0]).toMatchObject({ kod: "P1", ean: EAN_KARTY });
    expect(staging()).toHaveLength(0);
    expect(poprawki().find((o) => o.fieldName === "ean")).toMatchObject({
      overrideValue: EAN_KARTY,
      acknowledgedSourceValue: BLEDNY,
    });
  });

  it("keep bez poprawnego EAN-u na karcie → 409, nic się nie zmienia", async () => {
    const id = zasiej(null);

    const odp = await post(id, { decision: "keep" });

    expect(odp.status).toBe(409);
    expect(odp.body.message).toMatch(/nie ma poprawnego EAN/);
    expect(staging()).toHaveLength(1);
    expect(poprawki()).toHaveLength(0);
  });

  it("set: wpisany poprawny EAN trafia do katalogu", async () => {
    const id = zasiej(null);

    const odp = await post(id, { decision: "set", ean: "5901234123464" });

    expect(odp.status).toBe(200);
    expect(katalog()[0]).toMatchObject({ kod: "P1", ean: "5901234123464" });
    expect(staging()).toHaveLength(0);
  });

  it("set z błędnym EAN-em → 409 i nic się nie zmienia", async () => {
    const id = zasiej(null);

    const odp = await post(id, { decision: "set", ean: "123" });

    expect(odp.status).toBe(409);
    expect(odp.body.message).toMatch(/Nieprawidłowy EAN/);
    expect(staging()).toHaveLength(1);
  });

  it("pozycja bez błędnego EAN-u → 409", async () => {
    const id = zasiej(EAN_KARTY, { _eanIssue: null, eanRaw: EAN_KARTY, eanIsValid: 1, ean: EAN_KARTY });

    const odp = await post(id, { decision: "keep" });

    expect(odp.status).toBe(409);
    expect(odp.body.message).toMatch(/nie ma błędnego EAN/);
  });

  it("nieprawidłowa decyzja → 409; bez tokenu → 401", async () => {
    const id = zasiej();
    expect((await post(id, { decision: "cokolwiek" })).status).toBe(409);
    const bez = await request(srodowisko.app).post(`/api/staging/${id}/resolve-ean`).send({});
    expect(bez.status).toBe(401);
  });
});
