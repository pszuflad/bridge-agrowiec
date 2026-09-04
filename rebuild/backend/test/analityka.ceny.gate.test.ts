/**
 * GATE ODBUDOWY — Iteracja 10, blok 10b (analityka: ceny).
 *
 * Ścieżki kontraktu w zakresie: `GET /api/analytics/market/group-prices`,
 * `/prices/last-import`, `/prices/product-history`, `/prices/inflation`, `/top-zmiany`.
 * Fixtures w zakresie: pięć plików `GET_analytics_{market_group-prices,prices_last-import,
 * prices_product-history,prices_inflation,top-zmiany}.json`.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * ⚠ TEN BLOK MA NAJMOCNIEJSZĄ SIATKĘ W CAŁEJ ITERACJI 10 — i jeden warunek, żeby ją
 * naprawdę wykorzystać. Wszystkie pięć nagrań ma NIEPUSTE tablice (dla porównania blok 10e
 * ma cztery z sześciu puste), więc kształt wiersza jest realnie opisany. Ale `gate/ksztalt.ts`
 * porównuje elementy tablicy PARAMI: pustą tablicę po stronie fixture'a pomija (`:50`),
 * a pustą po stronie ODPOWIEDZI po prostu przebiega zero razy. Zielony gate na pustej
 * odpowiedzi nie dowodziłby więc niczego. Stąd `expect(rows.length).toBeGreaterThan(0)`
 * PRZED każdym porównaniem — asercja jest tu częścią gate'a, nie ozdobą.
 *
 * ⚠ KONTRAKT NIE MÓWI O KSZTAŁCIE NIC. `contract/openapi.yaml` nie ma dla żadnej trasy
 * analityki schematu odpowiedzi — tylko `responses: {200, 400, 401}` i `security`.
 * `sprawdzZgodnoscZKontraktem` dowodzi tu istnienia ścieżki, statusu i JSON-a; cały ciężar
 * kształtu niosą fixtures.
 *
 * ⚠ ADNOTACJE NAGRYWARKI, KTÓRYCH ODPOWIEDŹ MIEĆ NIE MOŻE: `_przyciete` (cztery fixtures)
 * oraz `_body_przyciete_z` w `top-zmiany` — ta druga siedzi na najwyższym poziomie, bo body
 * jest gołą tablicą i nie może nieść klucza w środku. Harness pomija oba po stronie
 * fixture'a, a klucz nadmiarowy w ODPOWIEDZI zgłasza jako różnicę — czyli sam pilnuje,
 * żebyśmy ich nie dorobili. Poniżej jest do tego jeszcze asercja wprost.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  zasiejHistorieCenDlaCen,
  zasiejProdukty,
  zasiejStagingZFixtures,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Pięć operacji, które ten blok musi dowieźć. */
const OPERACJE: [string, string][] = [
  ["GET", "/api/analytics/market/group-prices"],
  ["GET", "/api/analytics/prices/last-import"],
  ["GET", "/api/analytics/prices/product-history"],
  ["GET", "/api/analytics/prices/inflation"],
  ["GET", "/api/analytics/top-zmiany"],
];

describe("GATE — kontrakt i fixtures dla analityki cen (blok 10b)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    // Trzy źródła, z których liczy się całe pięć odpowiedzi: katalog (`group-prices`),
    // staging (`last-import`, `top-zmiany`) i historia cen (`product-history`, `inflation`).
    zasiejProdukty(srodowisko.db);
    zasiejStagingZFixtures(srodowisko.db);
    zasiejHistorieCenDlaCen(srodowisko.db);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/analytics/market/group-prices zwraca kształt 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/market/group-prices");
    const cialo = odp.body as { group: string; rows: unknown[] };

    expect(odp.status).toBe(200);
    // Bez tego porównanie kształtu wierszy przebiegłoby zero razy — patrz nagłówek pliku.
    expect(cialo.rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/market/group-prices",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_market_group-prices.json", odp.body);
  });

  it("GET /api/analytics/prices/last-import zwraca kształt 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/prices/last-import");
    const cialo = odp.body as { rows: unknown[] };

    expect(odp.status).toBe(200);
    expect(cialo.rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/prices/last-import",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_prices_last-import.json", odp.body);
  });

  it("GET /api/analytics/prices/product-history zwraca kształt 1:1 z fixture'em", async () => {
    // Bez parametrów — dokładnie tak nagrano fixture (`_przyciete.rows: 15597`, czyli
    // odpowiedź objęła całą tabelę).
    const odp = await zAuth("/api/analytics/prices/product-history");
    const cialo = odp.body as { hasHistory: boolean; rows: unknown[] };

    expect(odp.status).toBe(200);
    expect(cialo.hasHistory).toBe(true);
    expect(cialo.rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/prices/product-history",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_prices_product-history.json", odp.body);
  });

  it("GET /api/analytics/prices/product-history ma `stats` o DOKŁADNIE trzech kluczach", async () => {
    const odp = await zAuth("/api/analytics/prices/product-history");
    const cialo = odp.body as { stats: Record<string, unknown> };

    // Fixture niesie `{min, max, avg}` i nic więcej. Dopisanie tu czwartej liczby
    // (mediany, odchylenia — kusi) wywaliłoby gate jako klucz nadmiarowy, a przed samym
    // gate'em ma o tym powiedzieć ta asercja.
    expect(Object.keys(cialo.stats).sort()).toEqual(["avg", "max", "min"]);
  });

  it("GET /api/analytics/prices/inflation zwraca kształt 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/prices/inflation");
    const cialo = odp.body as { hasHistory: boolean; rows: { inflacjaPct: number | null }[] };

    expect(odp.status).toBe(200);
    expect(cialo.hasHistory).toBe(true);
    expect(cialo.rows.length).toBeGreaterThan(0);
    // Fixture ma w tej kolumnie liczby. Gdyby zasiew dawał same `null`-e, harness zgłosiłby
    // najwyżej OSTRZEŻENIE i kolumna przeszłaby bez dowodu — patrz `zasiejHistorieCenDlaCen`.
    expect(cialo.rows.some((w) => typeof w.inflacjaPct === "number")).toBe(true);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/prices/inflation",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_prices_inflation.json", odp.body);
  });

  it("GET /api/analytics/top-zmiany zwraca GOŁĄ TABLICĘ o kształcie 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/top-zmiany");
    const cialo = odp.body as unknown[];

    expect(odp.status).toBe(200);
    // Koperty nie ma i być nie może — to jedna z trzech tras modułu oddających gołą tablicę.
    expect(Array.isArray(cialo)).toBe(true);
    expect(cialo.length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/top-zmiany",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_top-zmiany.json", odp.body);
  });

  it("żadna z pięciu odpowiedzi nie niesie adnotacji nagrywarki (`_przyciete`, `_body_przyciete_z`)", async () => {
    for (const [, sciezka] of OPERACJE) {
      const odp = await zAuth(sciezka);
      const klucze = Array.isArray(odp.body)
        ? []
        : Object.keys(odp.body as Record<string, unknown>);

      expect(klucze.filter((k) => k.startsWith("_")), `${sciezka} ma klucz techniczny`).toEqual([]);
    }
  });

  it.each(OPERACJE)("%s %s bez tokenu zwraca 401", async (metoda, sciezka) => {
    const odp = await request(srodowisko.app).get(sciezka);

    expect(odp.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda, sciezka, odpowiedz: odp });
  });
});
