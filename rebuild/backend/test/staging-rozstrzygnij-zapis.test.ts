/**
 * `POST /api/staging/:id/resolve` po zmianie z 2026-09-30: decyzja od razu trafia do katalogu
 * (bez drugiej akceptacji w stagingu) i przyjmuje własne, poprawione parametry opony.
 * Plus `GET /api/staging/:id/review` — wyjaśnienie, propozycja pól i `produktId` kandydata.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { pozycja, produkt } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;

const EAN = "5901234123457";
const NAZWA_IMPORTU = "20.8x38 BKT TR 270 DOT 8PR TT";

/** Opona z oferty, której kod zajmuje w katalogu INNA opona (`fabryka.ts:453-459`). */
function zgloszenie(pola: Wiersz = {}) {
  return pozycja({
    kod: "MO9_37513",
    nazwa: NAZWA_IMPORTU,
    dostawca: "MO5",
    ...pola,
    snapshot: {
      kod: "MO9_37513",
      nazwa: NAZWA_IMPORTU,
      marka: "BKT",
      model: "TR 270 DOT",
      rozmiar: "20.8x38",
      dot: "DOT nie starsza niz 3 lata",
      ean: "8903094004874",
      kodDostawcy: "MO9_37513",
      _policyVersion: 2,
      _catalogVersion: null,
      _matchIssue: "Oznaczenie wskazuje inną oponę. Sprawdź dopasowanie.",
      _candidates: [{ kod: "MO9_37513", nazwa: "20.8X38 BKT TR 270 8PR TT", rozmiar: "20.8x38" }],
      ...((pola.snapshot as Wiersz) ?? {}),
    },
  }) as Wiersz;
}

describe("POST /api/staging/:id/resolve — zapis od razu do katalogu", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
    srodowisko.db
      .insert(products)
      .values(
        produkt({
          id: 7,
          kod: "MO9_37513",
          nazwa: "20.8X38 BKT TR 270 8PR TT",
          model: "TR 270",
          rozmiar: "20.8x38",
          ean: "5901234123457",
        }) as never,
      )
      .run();
  });
  afterEach(() => srodowisko.posprzataj());

  const post = (id: number, cialo: object) =>
    request(srodowisko.app)
      .post(`/api/staging/${id}/resolve`)
      .set("Authorization", `Bearer ${token}`)
      .send(cialo);
  const get = (id: number) =>
    request(srodowisko.app)
      .get(`/api/staging/${id}/review`)
      .set("Authorization", `Bearer ${token}`);
  const zasiej = (w: Wiersz) => {
    srodowisko.db.insert(stagingItems).values(w as never).run();
    return (srodowisko.db.select().from(stagingItems).all() as unknown as { id: number }[])[0]!;
  };
  const katalog = () =>
    srodowisko.db.select().from(products).all() as unknown as Wiersz[];
  const staging = () => srodowisko.db.select().from(stagingItems).all();

  it("`new`: nowy produkt w katalogu, staging pusty — żadnej drugiej akceptacji", async () => {
    const a = zasiej(zgloszenie());

    const odp = await post(a.id, { action: "new" });

    expect(odp.status).toBe(200);
    expect(odp.body.ok).toBe(true);
    expect(odp.body.kod).not.toBe("MO9_37513");
    expect(katalog()).toHaveLength(2);
    expect(katalog().find((p) => p.kod === odp.body.kod)).toMatchObject({ nazwa: NAZWA_IMPORTU });
    expect(staging()).toHaveLength(0);
  });

  it("`new` z poprawkami: do katalogu idzie nazwa i parametry wpisane przez użytkownika", async () => {
    const a = zasiej(zgloszenie());

    const odp = await post(a.id, {
      action: "new",
      corrections: { nazwa: "BKT TR 270 DOT 20.8x38 8PR TT", model: "TR 270 DOT 8PR" },
    });

    expect(odp.status).toBe(200);
    const nowy = katalog().find((p) => p.kod === odp.body.kod)!;
    expect(nowy).toMatchObject({ nazwa: "BKT TR 270 DOT 20.8x38 8PR TT", model: "TR 270 DOT 8PR" });
    const nadpisania = srodowisko.db.select().from(manualOverrides).all() as unknown as Wiersz[];
    expect(nadpisania.map((o) => o.fieldName).sort()).toEqual(["model", "nazwa"]);
    expect(staging()).toHaveLength(0);
  });

  it("`link` z poprawioną nazwą: istniejąca karta dostaje poprawkę, nie powstaje druga", async () => {
    const a = zasiej(zgloszenie());

    const odp = await post(a.id, {
      action: "link",
      targetCode: "MO9_37513",
      corrections: { nazwa: "BKT TR 270 DOT 20.8x38 8PR TT" },
    });

    expect(odp.status).toBe(200);
    expect(odp.body.kod).toBe("MO9_37513");
    expect(katalog()).toHaveLength(1);
    expect(katalog()[0]).toMatchObject({ kod: "MO9_37513", nazwa: "BKT TR 270 DOT 20.8x38 8PR TT" });
    expect(staging()).toHaveLength(0);
  });

  it("błędny EAN w poprawkach → 409, katalog i zgłoszenie bez zmian", async () => {
    const a = zasiej(zgloszenie());

    const odp = await post(a.id, { action: "new", corrections: { ean: "123" } });

    expect(odp.status).toBe(409);
    expect(typeof odp.body.message).toBe("string");
    expect(katalog()).toHaveLength(1);
    expect(staging()).toHaveLength(1);
    expect((staging()[0] as unknown as Wiersz).id).toBe(a.id);
  });

  it("poprawiony EAN zdejmuje status „błąd” i zatwierdza", async () => {
    const a = zasiej(
      zgloszenie({ snapshot: { ean: "123", eanRaw: "123", _eanIssue: "zła długość" } }),
    );

    const odp = await post(a.id, { action: "new", corrections: { ean: "8903094004874" } });

    expect(odp.status).toBe(200);
    const nowy = katalog().find((p) => p.kod === odp.body.kod)!;
    expect(nowy.ean).toBe("8903094004874");
    expect(staging()).toHaveLength(0);
  });

  it("nieprawidłowe poprawki (nie napis) → 409", async () => {
    const a = zasiej(zgloszenie());
    const odp = await post(a.id, { action: "new", corrections: { nazwa: 5 } });
    expect(odp.status).toBe(409);
    expect(staging()).toHaveLength(1);
  });

  describe("GET /review — wyjaśnienie, propozycja, link do katalogu", () => {
    it("zajęty kod: zdanie o przyczynie, nazwa proponowana przez import, id produktu", async () => {
      const a = zasiej(zgloszenie());

      const odp = await get(a.id);

      expect(odp.status).toBe(200);
      const tekst = (odp.body.wyjasnienie as string[]).join("\n");
      expect(tekst).toMatch(/już jest w katalogu: MO9_37513/);
      expect(tekst).toMatch(/nie wiadomo, czy to ta sama opona/); // ocena importera, nie fakt
      expect(tekst).toContain(`Import chce ustawić nazwę: ${NAZWA_IMPORTU}`);
      expect(tekst).toContain("w katalogu jest: 20.8X38 BKT TR 270 8PR TT");
      expect(odp.body.propozycja).toMatchObject({
        nazwa: NAZWA_IMPORTU,
        marka: "BKT",
        model: "TR 270 DOT",
        rozmiar: "20.8x38",
        ean: "8903094004874",
      });
      expect(odp.body.candidates[0].produktId).toBe(7);
    });

    it("różnice z wartościami po obu stronach; DOT `24` = `2024` nie jest różnicą; wskazówka o nazwie", async () => {
      srodowisko.db
        .update(products)
        .set({ nazwa: "650/65R42 ALLIANCE 365 AGRISTAR 170D/173A8 TL", model: "365 AGRISTAR", dot: "2024" })
        .run();
      const a = zasiej(
        zgloszenie({
          nazwa: "650/65R42 ALLIANCE 365 170D/173A8 TL",
          snapshot: { nazwa: "650/65R42 ALLIANCE 365 170D/173A8 TL", model: "365", dot: "24" },
        }),
      );

      const odp = await get(a.id);
      const linie = odp.body.wyjasnienie as string[];

      expect(linie).toContain("Model: 365 AGRISTAR (katalog) → 365 (oferta)");
      expect(linie.some((l) => l.startsWith("DOT:")), "24 i 2024 to ten sam DOT").toBe(false);
      expect(linie).toContain(
        "Import chce ustawić nazwę: 650/65R42 ALLIANCE 365 170D/173A8 TL (w katalogu jest: 650/65R42 ALLIANCE 365 AGRISTAR 170D/173A8 TL).",
      );
      expect(linie.at(-1)).toMatch(/Najpewniej ta sama opona z innym zapisem nazwy/);
    });

    it("DOT nie jest różnicą (zmienia się w miejscu); różni się rozmiar → wskazówka „może być inna opona”", async () => {
      srodowisko.db.update(products).set({ dot: "2023", rozmiar: "480/70R28" }).run();
      const a = zasiej(zgloszenie({ snapshot: { dot: "2026", rozmiar: "480/70R30" } }));

      const linie = (await get(a.id)).body.wyjasnienie as string[];

      expect(linie.some((l) => l.startsWith("DOT:")), "DOT nie jest kryterium dopasowania").toBe(false);
      expect(linie).toContain("Rozmiar: 480/70R28 (katalog) → 480/70R30 (oferta)");
      expect(linie.at(-1)).toMatch(/To może być inna opona/);
    });

    it("EAN taki sam jak w innym produkcie", async () => {
      const a = zasiej(
        zgloszenie({
          snapshot: {
            _matchIssue: "Ten EAN występuje w katalogu, ale cechy są inne lub niepełne. Sprawdź dopasowanie.",
            ean: EAN,
          },
        }),
      );
      const odp = await get(a.id);
      expect((odp.body.wyjasnienie as string[])[0]).toMatch(/EAN jest taki sam jak w produkcie MO9_37513/);
    });

    it("podejrzana nazwa z importu jest nazwana wprost", async () => {
      const a = zasiej(
        zgloszenie({ powod: "Błędny zapis nazwy: rozmiar sklejony z producentem lub modelem" }),
      );
      const odp = await get(a.id);
      expect((odp.body.wyjasnienie as string[]).join("\n")).toMatch(
        /wygląda na nieprawidłową \(rozmiar sklejony z producentem lub modelem\)/,
      );
    });
  });
});
