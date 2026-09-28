/**
 * GATE ODBUDOWY — poprawki Marty.
 *
 * Ścieżka w zakresie: `GET /api/overrides`. Fixture: `GET_overrides.json` — ostatni
 * nieodhaczony plik z siatki bezpieczeństwa Iteracji 3.
 *
 * Rozbieżność z fixture'em = STOP (nie poprawiamy fixture'a).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { manualOverrides } from "../src/db/schema.js";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  type SrodowiskoTestowe,
} from "./gate/index.js";

type WierszPoprawki = Record<string, unknown>;

describe("GATE — kontrakt i fixtures dla poprawek Marty", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();

    // Zasiew WPROST z fixture'a — dokładnie te wartości, które nagrała produkcja.
    const fixture = wczytajFixture("GET_overrides.json");
    srodowisko.db
      .insert(manualOverrides)
      .values(fixture.body as WierszPoprawki[] as never)
      .run();

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/overrides zwraca kształt 1:1 z contract/fixtures/GET_overrides.json", async () => {
    const odp = await zAuth("/api/overrides");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/overrides", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_overrides.json", odp.body);
  });

  /**
   * Odpowiedź jest GOŁĄ TABLICĄ, bez koperty `{items,total}` — inaczej niż `/api/staging`
   * z parametrem `limit`. Fixture jest na to jedynym dowodem, a `porownajKsztalt` sam
   * z siebie nie odróżni pustej tablicy od poprawnej.
   */
  it("odpowiedź jest gołą tablicą z kompletem 9 pól w każdej pozycji", async () => {
    const fixture = wczytajFixture("GET_overrides.json");
    const wzorcowa = (fixture.body as WierszPoprawki[])[0]!;
    const oczekiwaneKlucze = Object.keys(wzorcowa).sort();
    expect(oczekiwaneKlucze).toHaveLength(9);

    const odp = await zAuth("/api/overrides");
    const pozycje = odp.body as WierszPoprawki[];

    expect(Array.isArray(pozycje)).toBe(true);
    expect(pozycje.length).toBe((fixture.body as unknown[]).length);
    for (const pozycja of pozycje) {
      expect(Object.keys(pozycja).sort()).toEqual(oczekiwaneKlucze);
    }
  });

  /**
   * `acknowledgedSourceValue` to pole, którym akceptacja wycisza powtarzający się konflikt
   * (3d-1 melduje, 3d-2 potwierdza). W nagranej próbce jest wypełnione we wszystkich
   * pięciu wierszach — gdyby wypadło z odpowiedzi, cały mechanizm byłby niewidoczny dla UI.
   */
  it("`acknowledgedSourceValue` realnie wychodzi na zewnątrz, a nie jest gubione", async () => {
    const odp = await zAuth("/api/overrides");
    const zPotwierdzeniem = (odp.body as WierszPoprawki[]).filter(
      (p) => p.acknowledgedSourceValue != null,
    );
    expect(zPotwierdzeniem.length).toBeGreaterThan(0);
  });

  /**
   * KOLEJNOŚĆ JEST CZĘŚCIĄ KONTRAKTU, nie szczegółem: `listOverrides` sortuje `createdAt`
   * MALEJĄCO (`:44928`), a nagrana próbka to potwierdza — pięć wierszy idzie od 06:22:26
   * do 06:22:00. UI pokazuje najnowsze poprawki na górze i to na tym stoi.
   */
  it("lista jest posortowana `createdAt` MALEJĄCO — dokładnie jak w nagranej próbce", async () => {
    const fixture = wczytajFixture("GET_overrides.json");
    const oczekiwaneId = (fixture.body as WierszPoprawki[]).map((p) => p.id);

    const odp = await zAuth("/api/overrides");
    expect((odp.body as WierszPoprawki[]).map((p) => p.id)).toEqual(oczekiwaneId);

    const znaczniki = (odp.body as WierszPoprawki[]).map((p) => String(p.createdAt));
    expect([...znaczniki].sort().reverse()).toEqual(znaczniki);
  });

  it("filtr `?dostawca=&kod=` zawęża do jednej pozycji, zachowując ten sam kształt", async () => {
    const fixture = wczytajFixture("GET_overrides.json");
    const wzorcowa = (fixture.body as WierszPoprawki[])[0]!;

    const odp = await zAuth(
      `/api/overrides?dostawca=${String(wzorcowa.supplierKod)}&kod=${String(wzorcowa.supplierProductId)}`,
    );

    expect(odp.status).toBe(200);
    const pozycje = odp.body as WierszPoprawki[];
    expect(pozycje.length).toBeGreaterThan(0);
    for (const pozycja of pozycje) {
      expect(pozycja.supplierKod).toBe(wzorcowa.supplierKod);
      expect(pozycja.supplierProductId).toBe(wzorcowa.supplierProductId);
      expect(Object.keys(pozycja).sort()).toEqual(Object.keys(wzorcowa).sort());
    }
  });
});
