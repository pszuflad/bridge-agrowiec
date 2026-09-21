/**
 * `GET`/`PUT /api/waga-gabarytowa/przewoznicy` — karta P9.1 (ticket 76, backlog #27).
 *
 * ⚠ TRASY SPOZA PRODUKCJI. Oryginał trzyma listę przewoźników w IndexedDB przeglądarki, więc
 * nie ma fixture'a i nie może go być. Siatką jest kontrakt (`x-odbudowa-nowa-trasa` w
 * `contract/openapi.yaml`, kody 200/400/401) i seed z migracji 007, który Ania potwierdziła
 * 2026-09-21 bez poprawek. Baza prawdziwa (migracje z kanonu w katalogu tymczasowym), bez atrap.
 */
import { desc, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { auditLog, wagaGabPrzewoznicy } from "../src/db/schema.js";
import {
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajKontrakt,
  type SrodowiskoTestowe,
} from "./gate/index.js";

const SCIEZKA = "/api/waga-gabarytowa/przewoznicy";

/**
 * Lista Ani (2026-09-21) = `PRZEWOZNICY_DOMYSLNI` we froncie (`pages/waga-gabarytowa/przewoznicy.ts`),
 * z której korzysta przycisk „Przywróć domyślne". Zmiana seeda w migracji bez zmiany frontu
 * (albo odwrotnie) ma się tu wywrócić — dlatego literał, nie import.
 */
const SEED = [
  { id: "geis", nazwa: "GEIS Polska", dzielnik: 10000, domyslny: true },
  { id: "dpd", nazwa: "DPD", dzielnik: 6000, domyslny: false },
  { id: "gls", nazwa: "GLS", dzielnik: 4000, domyslny: false },
  { id: "inpost", nazwa: "InPost Kurier", dzielnik: 5000, domyslny: false },
  { id: "ups", nazwa: "UPS", dzielnik: 5000, domyslny: false },
  { id: "dhl", nazwa: "DHL Parcel", dzielnik: 5000, domyslny: false },
];

describe("wspólna lista przewoźników", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  /** Każdy test startuje od seeda — `PUT` z listy Ani przywraca stan po migracji. */
  beforeEach(async () => {
    await zapisz(SEED).expect(200);
  });

  const pobierz = () => request(srodowisko.app).get(SCIEZKA).set("Authorization", `Bearer ${token}`);
  const zapisz = (cialo: unknown) =>
    request(srodowisko.app)
      .put(SCIEZKA)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify(cialo));

  it("obie operacje są opisane w contract/openapi.yaml", () => {
    expect(wczytajKontrakt().znajdzOperacje("GET", SCIEZKA)).toBeDefined();
    expect(wczytajKontrakt().znajdzOperacje("PUT", SCIEZKA)).toBeDefined();
  });

  it("migracja 007 zasiewa sześciu przewoźników Ani w kolejności, GEIS domyślny", () => {
    // Prosto z tabeli, bez `PUT` z `beforeEach` po drodze — to jest stan, który cutover da produkcji.
    const wiersze = srodowisko.sqlite
      .prepare(
        `SELECT id, nazwa, dzielnik, kolejnosc, domyslny FROM waga_gab_przewoznicy ORDER BY kolejnosc`,
      )
      .all();
    expect(wiersze).toEqual(
      SEED.map((p, kolejnosc) => ({ ...p, kolejnosc, domyslny: p.domyslny ? 1 : 0 })),
    );
  });

  it("GET zwraca seed w kolejności, zgodnie z kontraktem", async () => {
    const odp = await pobierz();

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: SCIEZKA, odpowiedz: odp });
    expect(odp.body).toEqual(SEED);
  });

  it("PUT zapisuje całą listę, a GET oddaje ją w nowej kolejności", async () => {
    const nowa = [
      { id: "dpd", nazwa: "DPD", dzielnik: 5500 },
      { id: "custom_1790000000000", nazwa: "Pocztex", dzielnik: 3000 },
      { id: "geis", nazwa: "GEIS Polska", dzielnik: 10000, domyslny: true },
    ];

    const odp = await zapisz(nowa);
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "PUT", sciezka: SCIEZKA, odpowiedz: odp });

    const oczekiwana = nowa.map((p) => ({ domyslny: false, ...p }));
    expect(odp.body).toEqual(oczekiwana);
    expect((await pobierz()).body).toEqual(oczekiwana);
  });

  it("PUT odcina pola spoza kształtu i nie przycina nazwy", async () => {
    const odp = await zapisz([{ id: "x", nazwa: " DPD ", dzielnik: 6000, obcy: 1 }]);

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual([{ id: "x", nazwa: " DPD ", dzielnik: 6000, domyslny: false }]);
  });

  describe("walidacja → 400, lista bez zmian", () => {
    const przypadki: Array<[string, unknown, string]> = [
      ["pusta lista", [], "Musi pozostać co najmniej jeden przewoźnik"],
      ["obiekt zamiast listy", { id: "geis" }, "Oczekiwano listy przewoźników"],
      ["pusta nazwa", [{ id: "a", nazwa: "   ", dzielnik: 5000 }], "Przewoźnik nr 1: nazwa nie może być pusta"],
      ["brak nazwy", [{ id: "a", dzielnik: 5000 }], "Przewoźnik nr 1: nazwa nie może być pusta"],
      ["dzielnik 0", [{ id: "a", nazwa: "A", dzielnik: 0 }], "Przewoźnik nr 1: dzielnik musi być liczbą dodatnią"],
      ["dzielnik ujemny", [{ id: "a", nazwa: "A", dzielnik: -5 }], "Przewoźnik nr 1: dzielnik musi być liczbą dodatnią"],
      ["dzielnik tekstem", [{ id: "a", nazwa: "A", dzielnik: "5000" }], "Przewoźnik nr 1: dzielnik musi być liczbą dodatnią"],
      ["pusty identyfikator", [{ id: "", nazwa: "A", dzielnik: 5000 }], "Przewoźnik nr 1: brak identyfikatora"],
      [
        "powtórzony identyfikator",
        [
          { id: "a", nazwa: "A", dzielnik: 5000 },
          { id: "a", nazwa: "B", dzielnik: 4000 },
        ],
        "Przewoźnik nr 2: identyfikator „a\" się powtarza",
      ],
      ["domyslny nie-boolean", [{ id: "a", nazwa: "A", dzielnik: 5000, domyslny: "tak" }], "Przewoźnik nr 1: pole domyslny musi być wartością logiczną"],
      ["element nie-obiekt", ["geis"], "Przewoźnik nr 1: oczekiwano obiektu"],
    ];

    it.each(przypadki)("%s", async (_opis, cialo, komunikat) => {
      const odp = await zapisz(cialo);

      expect(odp.status).toBe(400);
      sprawdzZgodnoscZKontraktem({ metoda: "PUT", sciezka: SCIEZKA, odpowiedz: odp });
      expect(odp.body).toEqual({ error: komunikat });
      expect((await pobierz()).body).toEqual(SEED);
    });

    it("drugi przewoźnik z błędem — komunikat wskazuje jego pozycję", async () => {
      const odp = await zapisz([SEED[0], { id: "b", nazwa: "B", dzielnik: -1 }]);

      expect(odp.body).toEqual({ error: "Przewoźnik nr 2: dzielnik musi być liczbą dodatnią" });
    });
  });

  it("zapis trafia do audit_log z listą przed i po", async () => {
    await zapisz([{ id: "dpd", nazwa: "DPD", dzielnik: 5500 }]).expect(200);

    const [wpis] = srodowisko.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.akcja, "edycja_przewoznikow"))
      .orderBy(desc(auditLog.id))
      .limit(1)
      .all();

    expect(wpis).toMatchObject({
      uzytkownikId: srodowisko.uzytkownik.id,
      uzytkownikImie: srodowisko.uzytkownik.imieNazwisko,
      encjaTyp: "waga_gab_przewoznicy",
      encjaId: null,
    });
    expect(JSON.parse(wpis?.szczegolyJson ?? "null")).toEqual({
      przed: SEED,
      po: [{ id: "dpd", nazwa: "DPD", dzielnik: 5500, domyslny: false }],
    });
  });

  it("odrzucony zapis nie trafia do audit_log", async () => {
    const liczba = () =>
      srodowisko.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.akcja, "edycja_przewoznikow"))
        .all().length;
    const przed = liczba();

    await zapisz([]).expect(400);

    expect(liczba()).toBe(przed);
  });

  it("bez tokenu GET i PUT zwracają 401, a lista się nie zmienia", async () => {
    const odczyt = await request(srodowisko.app).get(SCIEZKA);
    expect(odczyt.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: SCIEZKA, odpowiedz: odczyt });

    const zapis = await request(srodowisko.app).put(SCIEZKA).send([SEED[1]]);
    expect(zapis.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda: "PUT", sciezka: SCIEZKA, odpowiedz: zapis });

    expect(srodowisko.db.select().from(wagaGabPrzewoznicy).all()).toHaveLength(SEED.length);
  });
});
