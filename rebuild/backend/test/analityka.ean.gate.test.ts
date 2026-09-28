/**
 * GATE ODBUDOWY — Iteracja 10, blok 10c (EAN).
 *
 * Ścieżki kontraktu w zakresie (`contract/openapi.yaml:124-177`), wszystkie `GET`:
 * `/api/analytics/ean/comparison`, `/ean/coverage`, `/ean/details`, `/ean/supplier-rank`,
 * `/ean/unique` oraz `/api/analytics/ean-porownanie`.
 * Fixtures w zakresie: `GET_analytics_ean_{comparison,coverage,details,supplier-rank,unique}.json`
 * i `GET_analytics_ean-porownanie.json` — sześć nagrań.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 *
 * ⚠ OSOBNY PLIK, NIE DOPISEK DO `analityka.gate.test.ts`. Bloki 10b–10e idą RÓWNOLEGLE
 * (`docs/rebuild-roadmap.md` §5) i każdy dokłada własne ścieżki do tej samej rodziny tras;
 * wspólny plik gate'u byłby gwarantowanym konfliktem przy merge'u czterech gałęzi.
 *
 * ⚠ CZTERY SŁABOŚCI TEJ SIATKI, NAZWANE WPROST — bo bez ich zaadresowania gate byłby teatrem.
 *
 * 1. KONTRAKT NIC NIE MÓWI O KSZTAŁCIE. `contract/openapi.yaml` nie ma dla żadnej trasy
 *    analityki schematu odpowiedzi — tylko `responses: {200, 400, 401}` i `security`.
 *    `sprawdzZgodnoscZKontraktem` dowodzi tu więc wyłącznie: ścieżka i metoda istnieją,
 *    status jest zadeklarowany, ciało jest JSON-em.
 *
 * 2. PUSTA ODPOWIEDŹ PRZECHODZI GATE ZA DARMO. `gate/ksztalt.ts:50` porównuje elementy
 *    tablicy ODPOWIEDZI z szablonem z fixture'a — gdy odpowiedź jest pusta, pętla nie ma po
 *    czym iterować i różnic nie ma. Domyślny zasiew (`PRODUKTY_TESTOWE`) NIE MA ani jednego
 *    EAN-u u dwóch dostawców, więc `comparison`, `supplier-rank` i `ean-porownanie`
 *    wyszłyby na nim puste i gate przepuściłby DOWOLNY kształt wiersza. Dlatego ten plik
 *    dosypuje `PRODUKTY_WSPOLNE_EAN` i po każdym zapytaniu asercją sprawdza, że wierszy
 *    JEST — dopiero wtedy porównanie kształtu cokolwiek znaczy.
 *
 * 3. FIXTURE `ean/details` NAGRAŁ GAŁĄŹ PUSTĄ. `{ean: null, offers: []}` to odpowiedź na
 *    żądanie BEZ `?ean`. Gałąź z podanym `ean` — cztery klucze, `pozycjaCenowa` w ofertach —
 *    nie ma fixture'a i pokrywa ją `analityka.ean.test.ts`.
 *
 * 4. FIXTURE `ean-porownanie` TEŻ NAGRAŁ TYLKO JEDNĄ GAŁĄŹ (agregat, bez `?ean`).
 *    Gałąź z `?ean` (goła tablica ofert) — także test jednostkowy.
 *
 * ⚠ CZEGO ODPOWIEDZI MIEĆ NIE MOGĄ: kluczy `_przyciete` i `_body_przyciete_z`. W fixtures
 * one są, ale jako adnotacja NAGRYWARKI (`contract/README.md:29`), nie pole produkcji.
 * Harness pomija klucze na `_` po stronie fixture'a, a klucz nadmiarowy po stronie ODPOWIEDZI
 * zgłasza jako różnicę — czyli sam pilnuje, żebyśmy ich nie dorobili. Poniżej i tak jest
 * asercja wprost, żeby przyszły czytelnik zobaczył zdanie z uzasadnieniem, a nie zagadkę.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  zasiejProdukty,
  type NowyProdukt,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Sześć operacji, które ten blok musi dowieźć. */
const OPERACJE: [string, string][] = [
  ["GET", "/api/analytics/ean/comparison"],
  ["GET", "/api/analytics/ean/details"],
  ["GET", "/api/analytics/ean/unique"],
  ["GET", "/api/analytics/ean/coverage"],
  ["GET", "/api/analytics/ean/supplier-rank"],
  ["GET", "/api/analytics/ean-porownanie"],
];

/** Minimum pól wymaganych przez `products` — reszta kolumn jest nullable albo ma default. */
function produkt(dane: Partial<NowyProdukt> & Pick<NowyProdukt, "kod" | "dostawca">): NowyProdukt {
  return {
    nazwa: `Opona ${dane.kod}`,
    marka: "BKT",
    kategoria: "Rolnicze",
    magazyn: "—",
    stan: 4,
    cenaZakupu: 100,
    cenaSprzedazy: 130,
    marzaPct: 30,
    vat: 23,
    status: "aktywny",
    dataAktualizacji: "2026-08-13T12:00:00.000Z",
    ...dane,
  };
}

/**
 * Dwa EAN-y dzielone przez wielu dostawców — bez nich trzy z sześciu tras zwracają pustkę
 * i gate nie dowodzi kształtu wiersza (słabość 2 z nagłówka).
 *
 * `EAN_WSPOLNY_2` ma dwóch dostawców, `EAN_WSPOLNY_3` trzech — dzięki temu `ean/coverage`
 * dostaje trzy różne wiersze histogramu (1, 2 i 3 dostawców), a nie jeden.
 */
const EAN_WSPOLNY_2 = "5901234123457";
const EAN_WSPOLNY_3 = "4006381333931";

const PRODUKTY_WSPOLNE_EAN: NowyProdukt[] = [
  produkt({ kod: "MO1_EAN2", dostawca: "MO1", ean: EAN_WSPOLNY_2, cenaZakupu: 100, cenaSprzedazy: 140 }),
  produkt({ kod: "MO5_EAN2", dostawca: "MO5", ean: EAN_WSPOLNY_2, cenaZakupu: 250, cenaSprzedazy: 330 }),
  produkt({ kod: "MO1_EAN3", dostawca: "MO1", ean: EAN_WSPOLNY_3, cenaZakupu: 300, cenaSprzedazy: 400 }),
  produkt({ kod: "MO5_EAN3", dostawca: "MO5", ean: EAN_WSPOLNY_3, cenaZakupu: 330, cenaSprzedazy: 440 }),
  produkt({ kod: "MO7_EAN3", dostawca: "MO7", ean: EAN_WSPOLNY_3, cenaZakupu: 310, cenaSprzedazy: 410 }),
];

describe("GATE — kontrakt i fixtures dla analityki EAN (blok 10c)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    // Katalog domyślny (daje EAN-y unikalne) + EAN-y dzielone przez wielu dostawców.
    zasiejProdukty(srodowisko.db);
    zasiejProdukty(srodowisko.db, PRODUKTY_WSPOLNE_EAN);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/analytics/ean/comparison zwraca kształt 1:1 z contract/fixtures/GET_analytics_ean_comparison.json", async () => {
    const odp = await zAuth("/api/analytics/ean/comparison");

    expect(odp.status).toBe(200);
    // Bez tego gate byłby pusty — patrz słabość 2 w nagłówku pliku.
    expect((odp.body as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/ean/comparison",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_ean_comparison.json", odp.body);
  });

  it("GET /api/analytics/ean/unique zwraca kształt 1:1 z contract/fixtures/GET_analytics_ean_unique.json", async () => {
    const odp = await zAuth("/api/analytics/ean/unique");

    expect(odp.status).toBe(200);
    expect((odp.body as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/ean/unique",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_ean_unique.json", odp.body);
  });

  it("GET /api/analytics/ean/coverage zwraca kształt 1:1 z contract/fixtures/GET_analytics_ean_coverage.json", async () => {
    const odp = await zAuth("/api/analytics/ean/coverage");

    expect(odp.status).toBe(200);
    expect((odp.body as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/ean/coverage",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_ean_coverage.json", odp.body);
  });

  it("GET /api/analytics/ean/supplier-rank zwraca kształt 1:1 z contract/fixtures/GET_analytics_ean_supplier-rank.json", async () => {
    const odp = await zAuth("/api/analytics/ean/supplier-rank");

    expect(odp.status).toBe(200);
    expect((odp.body as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/ean/supplier-rank",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_ean_supplier-rank.json", odp.body);
  });

  it("GET /api/analytics/ean/details bez ?ean zwraca kształt 1:1 z contract/fixtures/GET_analytics_ean_details.json", async () => {
    const odp = await zAuth("/api/analytics/ean/details");

    expect(odp.status).toBe(200);
    // Fixture nagrał DOKŁADNIE tę gałąź: żądanie bez parametru. Gałąź z `?ean` — patrz
    // `analityka.ean.test.ts`; fixture jej nie pokrywa, więc gate też nie może.
    expect(odp.body).toEqual({ ean: null, offers: [] });
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/ean/details",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_ean_details.json", odp.body);
  });

  it("GET /api/analytics/ean-porownanie zwraca gołą tablicę 1:1 z contract/fixtures/GET_analytics_ean-porownanie.json", async () => {
    const odp = await zAuth("/api/analytics/ean-porownanie");

    expect(odp.status).toBe(200);
    // Goła tablica, BEZ koperty `{rows}` — jedyna taka w tym bloku.
    expect(Array.isArray(odp.body)).toBe(true);
    expect((odp.body as unknown[]).length).toBeGreaterThan(0);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/analytics/ean-porownanie",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_analytics_ean-porownanie.json", odp.body);
  });

  it("żadna z sześciu tras nie zwraca `_przyciete` ani `_body_przyciete_z` — to adnotacje nagrywarki, nie pola API", async () => {
    const zKoperta = ["comparison", "unique", "coverage", "supplier-rank"];
    for (const trasa of zKoperta) {
      const odp = await zAuth(`/api/analytics/ean/${trasa}`);
      expect(Object.keys(odp.body as object), `ean/${trasa}`).toEqual(["rows"]);
    }

    const details = await zAuth("/api/analytics/ean/details");
    expect(Object.keys(details.body as object)).toEqual(["ean", "offers"]);

    const porownanie = await zAuth("/api/analytics/ean-porownanie");
    for (const wiersz of porownanie.body as Record<string, unknown>[]) {
      expect(Object.keys(wiersz).filter((k) => k.startsWith("_"))).toEqual([]);
    }
  });

  it.each(OPERACJE)("%s %s bez tokenu zwraca 401", async (metoda, sciezka) => {
    const odp = await request(srodowisko.app).get(sciezka);

    expect(odp.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda, sciezka, odpowiedz: odp });
  });
});
