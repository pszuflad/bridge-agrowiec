/**
 * GATE ODBUDOWY — Iteracja 5 (historia, odczyt).
 *
 * Ścieżki kontraktu w zakresie: GET /api/history, /api/history/meta, /api/history/paged.
 * Fixtures w zakresie: GET_history.json, GET_history_meta.json, GET_history_paged.json.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * Dwa źródła danych, więc dwa seedy (`test/gate/dane.ts`):
 *  • `zasiejDziennikZmianZFixtures` — tabela `history`, wprost z nagrania produkcji;
 *  • `zasiejAudytHistorii` — wiersze `audit_log` dobrane tak, żeby mapowanie
 *    (`src/historia/mapowanie.ts`) dało kształt zgodny z `/paged` i `/meta`.
 *    Fixture jest tam WYJŚCIEM, nie wejściem — gate sprawdza całą drogę audyt → widok.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  zasiejAudytHistorii,
  zasiejDziennikZmianZFixtures,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("GATE — kontrakt i fixtures dla historii", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejDziennikZmianZFixtures(srodowisko.db);
    zasiejAudytHistorii(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/history zwraca kształt 1:1 z contract/fixtures/GET_history.json", async () => {
    const odp = await zAuth("/api/history");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/history", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_history.json", odp.body);
  });

  it("GET /api/history/meta zwraca kształt 1:1 z contract/fixtures/GET_history_meta.json", async () => {
    const odp = await zAuth("/api/history/meta");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/history/meta", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_history_meta.json", odp.body);
  });

  it("GET /api/history/paged zwraca kształt 1:1 z contract/fixtures/GET_history_paged.json", async () => {
    const odp = await zAuth("/api/history/paged");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/history/paged", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_history_paged.json", odp.body);
  });

  /**
   * Niezmiennik, którego samo `porownajKsztalt` nie złapie: fixture pokazuje 5 wierszy,
   * więc pole obecne tylko w części z nich mogłoby się prześlizgnąć. Tu porównujemy
   * KOMPLETNE zbiory kluczy — 10 dla `history`, 11 dla `paged.items`. To one pilnują,
   * że dwa kształty historii nie zaczną się zlewać w jeden.
   */
  it("GET /api/history — wiersz ma dokładnie te 10 kluczy co fixture", async () => {
    const fixture = wczytajFixture("GET_history.json");
    const oczekiwane = Object.keys((fixture.body as Record<string, unknown>[])[0] ?? {}).sort();
    expect(oczekiwane).toHaveLength(10);

    const odp = await zAuth("/api/history");
    const wiersze = odp.body as Record<string, unknown>[];

    expect(wiersze.length).toBeGreaterThan(0);
    for (const wiersz of wiersze) expect(Object.keys(wiersz).sort()).toEqual(oczekiwane);
  });

  it("GET /api/history/paged — wpis ma dokładnie te 11 kluczy co fixture", async () => {
    const fixture = wczytajFixture("GET_history_paged.json");
    const wzorzec = (fixture.body as { items: Record<string, unknown>[] }).items[0];
    const oczekiwane = Object.keys(wzorzec ?? {}).sort();
    expect(oczekiwane).toHaveLength(11);

    const odp = await zAuth("/api/history/paged");
    const items = (odp.body as { items: Record<string, unknown>[] }).items;

    expect(items.length).toBeGreaterThan(0);
    for (const wpis of items) expect(Object.keys(wpis).sort()).toEqual(oczekiwane);
  });

  /**
   * Porównanie WARTOŚCI, nie tylko kształtu: pięć najświeższych wpisów `/paged` musi wyjść
   * dokładnie takie, jak nagrała produkcja — z `typ`, `kodProduktu` i `zmienionePola`
   * odtworzonymi z `szczegoly_json.zmiany`. To dowód, że mapowanie `audit_log → widok`
   * jest wierne, a nie tylko typologicznie zgodne.
   */
  it("GET /api/history/paged — pięć najświeższych wpisów ma wartości z fixture'a", async () => {
    const fixture = wczytajFixture("GET_history_paged.json");
    const wzorcowe = (fixture.body as { items: Record<string, unknown>[] }).items;

    const odp = await zAuth("/api/history/paged?typ=edycja");
    const items = (odp.body as { items: Record<string, unknown>[] }).items;

    expect(items).toHaveLength(wzorcowe.length);
    items.forEach((wpis, i) => {
      const wzorzec = wzorcowe[i]!;
      expect(wpis["typ"]).toBe(wzorzec["typ"]);
      expect(wpis["kiedy"]).toBe(wzorzec["kiedy"]);
      expect(wpis["kodProduktu"]).toBe(wzorzec["kodProduktu"]);
      expect(wpis["zmienionePola"]).toEqual(wzorzec["zmienionePola"]);
      expect(wpis["uzytkownik"]).toBe(wzorzec["uzytkownik"]);
      expect(wpis["liczbaPozycji"]).toBe(wzorzec["liczbaPozycji"]);
      // Fixture ma tu nulle i tak też ma wyjść: edycja nie niesie pliku, formatu ani uwag.
      expect(wpis["nazwaPliku"]).toBeNull();
      expect(wpis["format"]).toBeNull();
      expect(wpis["uwagi"]).toBeNull();
      expect(wpis["dostawca"]).toBeNull();
    });
  });

  /**
   * ODSTĘPSTWO ŚWIADOME D1 — kontrakt (`contract/openapi.yaml:627-650`) opisuje wszystkie
   * trzy ścieżki jako publiczne, bo w produkcji wygrywa rejestracja z rdzenia, bez `we`.
   * Utrwalamy, że u nas wymagają auth — inaczej odstępstwo mogłoby po cichu zniknąć.
   */
  it.each(["/api/history", "/api/history/meta", "/api/history/paged"])(
    "%s wymaga auth mimo `security: []` w kontrakcie (D1)",
    async (sciezka) => {
      const odp = await request(srodowisko.app).get(sciezka);
      expect(odp.status).toBe(401);
    },
  );
});
