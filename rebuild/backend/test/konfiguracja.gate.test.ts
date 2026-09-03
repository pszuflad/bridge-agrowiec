/**
 * GATE ODBUDOWY — Iteracja 11 (konfiguracja i limity spedycji).
 *
 * Ścieżki kontraktu w zakresie: `/api/config` (GET, POST) i `/api/spedycja` (GET, POST) —
 * cztery operacje. Fixtures w zakresie: `GET_config.json`, `GET_spedycja.json`.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 * ZERO zadeklarowanych wyjątków (`WyjatekGate`) — nie przewidujemy tu żadnego rozjazdu.
 *
 * ⚠ SIŁA TEJ SIATKI, NAZWANA WPROST — jest asymetryczna i dla configu WYJĄTKOWO mocna.
 * `GET /api/config` oddaje płaski obiekt, w którym KLUCZE SĄ DANYMI, a `porownajKsztalt`
 * porównuje zbiory kluczy obiektu — więc test wywali się zarówno na brakującym, jak i na
 * nadmiarowym kluczu. Wartości są przy tym deterministyczne (seed produkcji), więc
 * porównanie de facto obejmuje i kształt, i treść.
 * Dla spedycji jest słabiej: fixture jest przycięty do 5 z 10 wierszy (`_body_przyciete_z`),
 * a harness scala szablon z nagranych elementów i stosuje go do KAŻDEGO wiersza odpowiedzi.
 * Sprawdzamy więc kształt wszystkich dziesięciu, ale wartości tylko tych pięciu — i to
 * osobną asercją poniżej, bo sam `sprawdzZgodnoscZFixture` wartości nie porównuje.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  wczytajKontrakt,
  zasiejKonfiguracjeStartowa,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Cztery operacje, które ta iteracja musi dowieźć. */
const OPERACJE: [string, string][] = [
  ["GET", "/api/config"],
  ["POST", "/api/config"],
  ["GET", "/api/spedycja"],
  ["POST", "/api/spedycja"],
];

describe("GATE — kontrakt i fixtures dla konfiguracji i spedycji", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejKonfiguracjeStartowa(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it.each(OPERACJE)("%s %s jest zadeklarowane w contract/openapi.yaml", (metoda, sciezka) => {
    // Zanim sprawdzimy odpowiedzi: kontrakt w ogóle zna tę operację. Bez tego
    // `sprawdzZgodnoscZKontraktem` na literówce w ścieżce mógłby milczeć.
    expect(wczytajKontrakt().znajdzOperacje(metoda, sciezka)).toBeDefined();
  });

  it("GET /api/config zwraca kształt 1:1 z contract/fixtures/GET_config.json", async () => {
    const odp = await zAuth("/api/config");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/config", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_config.json", odp.body);
  });

  it("GET /api/config zwraca WARTOŚCI 1:1 z fixture'em, nie tylko klucze", async () => {
    // Konfiguracja to same stringi z seeda produkcji, więc porównanie wartości jest tu
    // w pełni deterministyczne — łącznie z `"DPD 1/6000 (1 m³ = 167 kg)"` i z PUSTYMI
    // wartościami sekretów, które są realnym stanem seeda, a nie sanityzacją fixture'a.
    const fixture = wczytajFixture("GET_config.json").body as Record<string, string>;
    const odp = await zAuth("/api/config");

    expect(odp.body).toEqual(fixture);
  });

  it("GET /api/spedycja zwraca kształt 1:1 z contract/fixtures/GET_spedycja.json", async () => {
    const odp = await zAuth("/api/spedycja");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/spedycja", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_spedycja.json", odp.body);
  });

  it("GET /api/spedycja oddaje GOŁĄ TABLICĘ 10 wierszy, a pierwsze 5 zgadza się z nagraniem", async () => {
    const fixture = wczytajFixture("GET_spedycja.json");
    const nagrane = fixture.body as Record<string, unknown>[];
    const odp = await zAuth("/api/spedycja");
    const wiersze = odp.body as Record<string, unknown>[];

    // Fixture deklaruje, z ilu wierszy go przycięto — produkcja miała ich dziesięć.
    expect((fixture as unknown as { _body_przyciete_z?: number })._body_przyciete_z ?? nagrane.length)
      .toBe(10);
    expect(Array.isArray(wiersze)).toBe(true);
    expect(wiersze).toHaveLength(10);
    // Kolejność wynika z rowid (trasa nie sortuje — `repos/spedycja.ts`), więc nagrane
    // pięć wierszy musi wyjść na początku i co do wartości.
    expect(wiersze.slice(0, nagrane.length)).toEqual(nagrane);
  });

});

/**
 * Mutacje w OSOBNYM środowisku — świeża baza, świeży seed.
 *
 * Nie chodzi o wygodę: gdyby POST-y dzieliły bazę z odczytami wyżej, zielony GATE zależałby
 * od kolejności wykonania testów w pliku. Przy `--shuffle` albo po dopisaniu testu w środku
 * siatka zaczęłaby kłamać, a tego rodzaju usterka jest cicha.
 */
describe("GATE — mutacje konfiguracji i spedycji", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejKonfiguracjeStartowa(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("POST /api/config zapisuje klucz i odpowiada zgodnie z kontraktem", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/config")
      .set("Authorization", `Bearer ${token}`)
      .send({ klucz: "ai_fallback.model", wartosc: "gpt-4o" });

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/config", odpowiedz: odp });
    expect(odp.body).toEqual({ ok: true });

    const poZapisie = await zAuth("/api/config");
    expect((poZapisie.body as Record<string, string>)["ai_fallback.model"]).toBe("gpt-4o");
    // Zapis istniejącego klucza to UPDATE, nie INSERT — zbiór kluczy się nie zmienia,
    // więc odpowiedź nadal zgadza się z fixture'em co do kształtu.
    sprawdzZgodnoscZFixture("GET_config.json", poZapisie.body);
  });

  it("POST /api/spedycja zapisuje limit i odpowiada zgodnie z kontraktem", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/spedycja")
      .set("Authorization", `Bearer ${token}`)
      .send({ dostawcaKod: "MO1", progNetto: 1500, kosztPonizej: 99, kosztPowyzej: 0 });

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/spedycja", odpowiedz: odp });
    expect(odp.body).toEqual({ ok: true });

    const poZapisie = await zAuth("/api/spedycja");
    const wiersze = poZapisie.body as Record<string, unknown>[];
    // UPSERT po `dostawcaKod`: wierszy nadal dziesięć, zmieniony jest ten jeden.
    expect(wiersze).toHaveLength(10);
    expect(wiersze.find((w) => w.dostawcaKod === "MO1")).toMatchObject({
      progNetto: 1500,
      kosztPonizej: 99,
    });
    sprawdzZgodnoscZFixture("GET_spedycja.json", poZapisie.body);
  });
});
