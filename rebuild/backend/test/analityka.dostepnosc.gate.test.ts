/**
 * GATE ODBUDOWY — Iteracja 10, blok 10e (dostępność / rotacja / cykl).
 *
 * Ścieżki kontraktu w zakresie — sześć operacji GET:
 * `/api/analytics/availability/products`, `/availability/sell-through`, `/rotation/inactive`,
 * `/lifecycle/models`, `/seasonality/monthly`, `/importy-timeline`.
 * Fixtures w zakresie: `GET_analytics_{availability_products,availability_sell-through,
 * rotation_inactive,lifecycle_models,seasonality_monthly,importy-timeline}.json`.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * ⚠ TO JEST NAJSŁABSZA SIATKA W CAŁEJ ITERACJI 10 I TRZEBA WIEDZIEĆ, CZEGO ONA NIE DOWODZI.
 *
 * 1. KONTRAKT nie ma dla analityki ŻADNEGO schematu odpowiedzi (`contract/openapi.yaml:85-102`,
 *    `:198-206`, `:216-224`, `:270-287` — same `responses: {200, 400, 401}` i `security`).
 *    `sprawdzZgodnoscZKontraktem` dowodzi tu wyłącznie, że ścieżka istnieje, status jest
 *    zadeklarowany, a ciało jest JSON-em.
 *
 * 2. CZTERY Z SZEŚCIU FIXTURES SĄ PUSTE: `availability/products`, `availability/sell-through`
 *    i `rotation/inactive` mają `rows: []`, a `importy-timeline` jest pustą tablicą.
 *    `gate/ksztalt.ts:50` nie zagląda do elementów pustej tablicy, więc dla tych czterech tras
 *    ten plik dowodzi TYLKO koperty (`{hasHistory, rows}` / `{days, rows}` / goła tablica)
 *    i braku klucza nadmiarowego. Kształt WIERSZA niosą testy jednostkowe
 *    w `analityka.dostepnosc.agregaty.test.ts` — bez nich blok nie miałby żadnego dowodu.
 *
 * ⚠ DLATEGO ZASIEWAMY WIĘCEJ NIŻ 10a. `zasiejHistorieCen` daje trzy migawki JEDNEGO kodu
 * bez marki i modelu — przy takim zasiewie `lifecycle/models` zwróciłoby pustą listę, a jego
 * fixture jest jedynym w tym bloku, który realnie POKAZUJE kształt wiersza (pięć kolumn).
 * Dokładamy więc migawki z marką, modelem i EAN-em, żeby dwie trasy z niepustym fixture'em
 * (`lifecycle/models`, `seasonality/monthly`) porównały się wiersz w wiersz, a nie na sucho.
 *
 * ⚠ `audit_log` ZOSTAJE PUSTY. `importy-timeline` ma odpowiedzieć `[]`, dokładnie jak nagranie
 * produkcji; kształt jego wiersza pokrywa test jednostkowy.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { historiaCen } from "../src/db/schema.js";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  zasiejHistorieCen,
  zasiejProdukty,
  zasiejStagingZFixtures,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Sześć operacji, które ten blok musi dowieźć. */
const OPERACJE: [string, string][] = [
  ["GET", "/api/analytics/availability/products"],
  ["GET", "/api/analytics/availability/sell-through"],
  ["GET", "/api/analytics/seasonality/monthly"],
  ["GET", "/api/analytics/lifecycle/models"],
  ["GET", "/api/analytics/rotation/inactive"],
  ["GET", "/api/analytics/importy-timeline"],
];

describe("GATE — kontrakt i fixtures dla analityki (blok 10e)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    zasiejStagingZFixtures(srodowisko.db);
    zasiejHistorieCen(srodowisko.db);

    // Dwie marki × dwa modele × dwa miesiące na dwóch dostawcach — minimum, przy którym
    // `lifecycle/models` i `seasonality/monthly` mają co zwrócić, a `sell-through` ma między
    // czym liczyć różnicę stanów.
    srodowisko.db
      .insert(historiaCen)
      .values([
        {
          kod: "MO1_100",
          ean: "5901234123457",
          dostawca: "MO1",
          marka: "BKT",
          model: "AS 504",
          cenaZakupu: 1200,
          cenaSprzedazy: 1500,
          stan: 10,
          zarejestrowanoAt: "2026-07-01T10:00:00.000Z",
        },
        {
          kod: "MO1_100",
          ean: "5901234123457",
          dostawca: "MO1",
          marka: "BKT",
          model: "AS 504",
          cenaZakupu: 1250,
          cenaSprzedazy: 1560,
          stan: 4,
          zarejestrowanoAt: "2026-08-01T10:00:00.000Z",
        },
        {
          kod: "MO2_200",
          ean: "5901234123464",
          dostawca: "MO2",
          marka: "CULTOR",
          model: "AS AGRI 10",
          cenaZakupu: 900,
          cenaSprzedazy: 1100,
          stan: 0,
          zarejestrowanoAt: "2026-08-02T10:00:00.000Z",
        },
      ])
      .run();

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/analytics/availability/products zwraca kształt 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/availability/products");

    expect(odp.status).toBe(200);
    // ⚠ `rows` jest PUSTE mimo zasianej historii — i tak samo jest w produkcji: zapytanie
    // gałęzi historycznej pyta `historia_cen` o nieistniejącą kolumnę `nazwa`, a port
    // `safeAll` połyka błąd. Uzasadnienie i dowód z nagrań: `repos/analityka.ts`,
    // nagłówek `bezpiecznieWiersze`.
    expect(odp.body).toEqual({ hasHistory: true, rows: [] });
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/availability/products",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_availability_products.json", odp.body);
  });

  it("GET /api/analytics/availability/sell-through zwraca kształt 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/availability/sell-through");

    expect(odp.status).toBe(200);
    // Ta sama przyczyna co wyżej — `MAX(nazwa)` w CTE `seq`.
    expect(odp.body).toEqual({ hasHistory: true, rows: [] });
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/availability/sell-through",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_availability_sell-through.json", odp.body);
  });

  it("GET /api/analytics/seasonality/monthly zwraca kształt 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/seasonality/monthly");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/seasonality/monthly",
      odpowiedz: odp,
    });
    // Zasiew gwarantuje wiersze, więc to porównanie realnie sprawdza cztery kolumny.
    expect((odp.body as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZFixture("GET_analytics_seasonality_monthly.json", odp.body);
  });

  it("GET /api/analytics/lifecycle/models zwraca kształt 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/lifecycle/models");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/lifecycle/models",
      odpowiedz: odp,
    });
    expect((odp.body as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZFixture("GET_analytics_lifecycle_models.json", odp.body);
  });

  it("GET /api/analytics/rotation/inactive zwraca kształt 1:1 z fixture'em", async () => {
    const odp = await zAuth("/api/analytics/rotation/inactive");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/rotation/inactive",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_rotation_inactive.json", odp.body);
  });

  it("GET /api/analytics/rotation/inactive bez parametru odbija domyślne 60 dni", async () => {
    const odp = await zAuth("/api/analytics/rotation/inactive");

    // Fixture też ma `days: 60` — to jedyna wartość deterministyczna, jaką nagranie niesie.
    expect((odp.body as { days: number }).days).toBe(60);
  });

  it("GET /api/analytics/importy-timeline zwraca GOŁĄ TABLICĘ, nie kopertę", async () => {
    const odp = await zAuth("/api/analytics/importy-timeline");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/importy-timeline",
      odpowiedz: odp,
    });
    // Asercja wprost obok gate'a: trzy trasy analityki oddają gołą tablicę i pomylenie tego
    // z kopertą `{rows}` jest najłatwiejszym błędem tej iteracji (`analityka-bloki-10b-10f.md` §3).
    expect(Array.isArray(odp.body)).toBe(true);
    sprawdzZgodnoscZFixture("GET_analytics_importy-timeline.json", odp.body);
  });

  it("żadna z sześciu odpowiedzi nie zawiera klucza `_przyciete`", async () => {
    // `_przyciete` jest w dwóch fixture'ach tego bloku (`lifecycle_models`,
    // `seasonality_monthly`), ale to adnotacja NAGRYWARKI (`contract/README.md:29`), nie pole
    // produkcji. Gate złapałby to jako klucz nadmiarowy — ta asercja mówi wprost DLACZEGO.
    for (const [, sciezka] of OPERACJE) {
      const odp = await zAuth(sciezka);
      const cialo = odp.body as unknown;
      const klucze = Array.isArray(cialo) ? [] : Object.keys(cialo as object);
      expect(klucze, `${sciezka} ma klucz techniczny nagrywarki`).not.toContain("_przyciete");
    }
  });

  it.each(OPERACJE)("%s %s bez tokenu zwraca 401", async (metoda, sciezka) => {
    const odp = await request(srodowisko.app).get(sciezka);

    expect(odp.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda, sciezka, odpowiedz: odp });
  });
});
