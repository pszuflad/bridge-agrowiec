/**
 * GATE ODBUDOWY — Iteracja 7a (atrybuty, backend).
 *
 * Ścieżki w zakresie: 13 ścieżek / 18 operacji (`contract/openapi.yaml:333-530`).
 * Fixtures w zakresie: `GET_atrybuty.json`, `_rodzaje`, `_wartosci`, `_liczniki`,
 * `_uzycie`, `_pending` — komplet sześciu nagrań dla tej domeny.
 *
 * ⚠ CZEGO TEN GATE NIE OBEJMUJE I DLACZEGO. Zamrożony `openapi.yaml` deklaruje dla KAŻDEJ
 * operacji dokładnie trzy kody: 200, 401, 400 — w całym pliku nie ma ani jednego `"404"`,
 * `"409"` czy `"403"` (sprawdzone grepem). Tymczasem moduł oryginału zwraca wszystkie trzy:
 * 404 „Nie znaleziono", 409 przy duplikacie, 403 przy próbie usunięcia wbudowanego rodzaju.
 * `sprawdzZgodnoscZKontraktem` zapaliłoby się na nich, bo status nie jest zadeklarowany —
 * więc tych odpowiedzi nie przepuszczamy przez asercję kontraktu, tylko sprawdzamy wprost
 * w `atrybuty.crud.test.ts`. Wygrywa oryginał (kolejność źródeł z `.claude/commands/feature.md`),
 * a luka jest po stronie kontraktu, nie kodu. Ta sama sytuacja co z `GET /api/products/{id}`
 * w `katalog.gate.test.ts:187`.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { atrybutyWartosci, atrybutyWartosciPending } from "../src/db/schema.js";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZFixtureSlownika,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajKontrakt,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Komplet 18 operacji z kontraktu — lista jest jednocześnie zakresem ticketa. */
const OPERACJE: [string, string][] = [
  ["GET", "/api/atrybuty"],
  ["GET", "/api/atrybuty/rodzaje"],
  ["POST", "/api/atrybuty/rodzaje"],
  ["PUT", "/api/atrybuty/rodzaje/marka"],
  ["DELETE", "/api/atrybuty/rodzaje/marka"],
  ["GET", "/api/atrybuty/wartosci"],
  ["POST", "/api/atrybuty/wartosci"],
  ["PUT", "/api/atrybuty/wartosci/1"],
  ["DELETE", "/api/atrybuty/wartosci/1"],
  ["GET", "/api/atrybuty/liczniki"],
  ["GET", "/api/atrybuty/uzycie"],
  ["GET", "/api/atrybuty/pending"],
  ["DELETE", "/api/atrybuty/pending"],
  ["POST", "/api/atrybuty/pending/1/akceptuj"],
  ["POST", "/api/atrybuty/pending/1/akceptuj-z-edycja"],
  ["POST", "/api/atrybuty/pending/1/akceptuj-jako-alias"],
  ["POST", "/api/atrybuty/pending/1/odrzuc"],
  ["POST", "/api/atrybuty/scan-pending"],
];

describe("GATE — atrybuty (Iteracja 7a)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);

    // Słownik: produkty istnieją dopiero teraz, więc seed z `stworzApp` ich nie widział —
    // powtarzamy go, tak jak zrobiłby to restart procesu w produkcji.
    const { zasiejSlownikAtrybutow } = await import("../src/repos/atrybuty.js");
    zasiejSlownikAtrybutow(srodowisko.db);

    // Kolejka pending: wpisujemy wprost do tabeli, bo interesuje nas KSZTAŁT odpowiedzi,
    // a nie droga, którą pozycja tam trafiła (tę sprawdza `atrybuty.pending.test.ts`).
    // „AGRIMAX FAKTOR" różni się od katalogowego „AGRIMAX FACTOR" jedną literą na 14 znaków
    // (podobieństwo 0,93 ≥ próg 0,9), więc odpowiedź MUSI zawierać niepustą listę sugestii —
    // bez tego porównanie z fixture'em nie dotknęłoby wnętrza `sugerowane_aliasy`.
    srodowisko.db
      .insert(atrybutyWartosciPending)
      .values({
        rodzaj: "bieznik",
        wartosc: "AGRIMAX FAKTOR",
        ileWystapien: 7,
        dostawcy: "MO9,MO1",
      })
      .run();

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zTokenem = (metoda: string, sciezka: string) => {
    const agent = request(srodowisko.app);
    const wywolanie = {
      GET: () => agent.get(sciezka),
      POST: () => agent.post(sciezka),
      PUT: () => agent.put(sciezka),
      DELETE: () => agent.delete(sciezka),
    }[metoda];
    return wywolanie!().set("Authorization", `Bearer ${token}`);
  };

  it("wszystkie 18 operacji istnieje w contract/openapi.yaml", () => {
    const kontrakt = wczytajKontrakt();
    for (const [metoda, sciezka] of OPERACJE) {
      expect(
        kontrakt.znajdzOperacje(metoda, sciezka),
        `${metoda} ${sciezka} nie ma w kontrakcie`,
      ).toBeDefined();
    }
  });

  it("każda z 18 operacji jest za auth — bez tokenu 401", async () => {
    for (const [metoda, sciezka] of OPERACJE) {
      const agent = request(srodowisko.app);
      const odp = await {
        GET: () => agent.get(sciezka),
        POST: () => agent.post(sciezka),
        PUT: () => agent.put(sciezka),
        DELETE: () => agent.delete(sciezka),
      }[metoda]!();
      expect(odp.status, `${metoda} ${sciezka} bez tokenu`).toBe(401);
      sprawdzZgodnoscZKontraktem({ metoda, sciezka, odpowiedz: odp });
    }
  });

  it("GET /api/atrybuty — kształt 1:1 z GET_atrybuty.json", async () => {
    const odp = await zTokenem("GET", "/api/atrybuty");
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/atrybuty", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_atrybuty.json", odp.body);

    const cialo = odp.body as { rodzaje: unknown[]; wartosci: unknown[] };
    expect(cialo.rodzaje.length).toBeGreaterThan(0);
    expect(cialo.wartosci.length).toBeGreaterThan(0);
  });

  /**
   * ⚠ RÓŻNICA PÓL MIĘDZY DWIEMA TRASAMI JEST CELOWA. `GET /api/atrybuty` zwraca rodzaje
   * Z `utworzony`, `GET /api/atrybuty/rodzaje` — BEZ. To nie jest artefakt sanityzacji
   * fixture'ów: SELECT oryginału (`atrybuty_module.cjs:116`) tego pola nie pobiera.
   * Ten test pilnuje, żeby przyszła „porządkująca" zmiana nie zunifikowała obu tras po cichu.
   */
  it("GET /api/atrybuty/rodzaje — kształt 1:1 i BRAK pola `utworzony`", async () => {
    const odp = await zTokenem("GET", "/api/atrybuty/rodzaje");
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/atrybuty/rodzaje", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_atrybuty_rodzaje.json", odp.body);

    const rodzaje = (odp.body as { rodzaje: Record<string, unknown>[] }).rodzaje;
    expect(rodzaje.length).toBeGreaterThan(0);
    for (const rodzaj of rodzaje) {
      expect(Object.keys(rodzaj).sort()).toEqual(["core", "label", "opis", "value"]);
    }

    const pelna = await zTokenem("GET", "/api/atrybuty");
    const zPelnej = (pelna.body as { rodzaje: Record<string, unknown>[] }).rodzaje;
    expect(zPelnej.every((r) => "utworzony" in r)).toBe(true);
  });

  it("GET /api/atrybuty/wartosci — kształt 1:1 z GET_atrybuty_wartosci.json", async () => {
    const odp = await zTokenem("GET", "/api/atrybuty/wartosci");
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/atrybuty/wartosci",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_atrybuty_wartosci.json", odp.body);
  });

  it("GET /api/atrybuty/pending — kształt 1:1 z GET_atrybuty_pending.json", async () => {
    const odp = await zTokenem("GET", "/api/atrybuty/pending");
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/atrybuty/pending", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_atrybuty_pending.json", odp.body);

    const cialo = odp.body as {
      count: number;
      items: { wartosc: string; sugerowane_aliasy: { wartosc: string; podobienstwo: number }[] }[];
    };
    expect(cialo.count).toBe(cialo.items.length);
    // Dowód, że porównanie kształtu weszło do środka `sugerowane_aliasy`, a nie przeszło
    // po pustej tablicy.
    const pozycja = cialo.items.find((i) => i.wartosc === "AGRIMAX FAKTOR");
    expect(pozycja?.sugerowane_aliasy).toEqual([{ wartosc: "AGRIMAX FACTOR", podobienstwo: 93 }]);
  });

  /**
   * Nagranie produkcji dla tej trasy to ODPOWIEDŹ BŁĘDU: rejestrator wywołał ją bez
   * parametrów, więc `contract/fixtures/GET_atrybuty_uzycie.json` ma status 400 i komunikat
   * z dosłownie wstawionym `undefined` (interpolacja z `atrybuty_module.cjs:293`).
   * Odtwarzamy razem z tym `undefined` — to jest to, co produkcja realnie zwraca.
   */
  it("GET /api/atrybuty/uzycie bez parametrów — 400 co do znaku jak fixture", async () => {
    const odp = await zTokenem("GET", "/api/atrybuty/uzycie");
    expect(odp.status).toBe(400);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/atrybuty/uzycie", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_atrybuty_uzycie.json", odp.body);
    expect(odp.body).toEqual({ ok: false, error: "Nieznany rodzaj atrybutu: undefined" });
  });

  it("GET /api/atrybuty/uzycie z parametrami — 200 z listą produktów", async () => {
    const odp = await zTokenem("GET", "/api/atrybuty/uzycie?rodzaj=marka&wartosc=BKT");
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/atrybuty/uzycie", odpowiedz: odp });

    const cialo = odp.body as { ok: boolean; count: number; products: Record<string, unknown>[] };
    expect(cialo.ok).toBe(true);
    expect(cialo.count).toBe(2);
    expect(Object.keys(cialo.products[0]!).sort()).toEqual([
      "dostawca",
      "kod",
      "marka",
      "nazwa",
      "rozmiar",
      "stan",
    ]);
  });

  it("GET /api/atrybuty/liczniki — goła mapa <rodzaj>::<wartosc> → int", async () => {
    const odp = await zTokenem("GET", "/api/atrybuty/liczniki");
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/atrybuty/liczniki",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixtureSlownika("GET_atrybuty_liczniki.json", odp.body);

    const mapa = odp.body as Record<string, number>;
    expect(mapa["marka::BKT"]).toBe(2);
    expect(mapa["kategoria::Rolnicze"]).toBeGreaterThan(0);
  });

  it("POST /api/atrybuty/scan-pending — 200 zgodne z kontraktem", async () => {
    const odp = await zTokenem("POST", "/api/atrybuty/scan-pending");
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "POST",
      sciezka: "/api/atrybuty/scan-pending",
      odpowiedz: odp,
    });
    expect(Object.keys(odp.body as object).sort()).toEqual([
      "nowych_wartosci",
      "ok",
      "skanowano_rodzajow",
      "zaktualizowano",
    ]);
  });

  it("DELETE /api/atrybuty/pending — 200 zgodne z kontraktem", async () => {
    const odp = await zTokenem("DELETE", "/api/atrybuty/pending?rodzaj=nie_ma_takiego");
    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "DELETE",
      sciezka: "/api/atrybuty/pending",
      odpowiedz: odp,
    });
    expect(odp.body).toEqual({ ok: true, usunieto: 0, rodzaj: "nie_ma_takiego" });
  });

  /**
   * `POST /api/atrybuty/scan-pending` NIE MOŻE zostać przechwycone przez wzorzec
   * `/api/atrybuty/pending/:id/...` ani żadnym innym. Sprawdzamy to odpowiedzią, a nie
   * inspekcją routera: skan zwraca statystyki, akcja pending — `akcja`.
   */
  it("trasy statyczne nie kolidują ze wzorcami z parametrem", async () => {
    const skan = await zTokenem("POST", "/api/atrybuty/scan-pending");
    expect(skan.body).toHaveProperty("skanowano_rodzajow");

    const nieistniejaca = await zTokenem("POST", "/api/atrybuty/pending/999999/akceptuj");
    expect(nieistniejaca.status).toBe(404);
    expect(nieistniejaca.body).toEqual({ ok: false, error: "Pozycja pending nie istnieje" });
  });

  it("wartości słownika mają id nadawane przez AUTOINCREMENT", async () => {
    const wiersz = srodowisko.db.select().from(atrybutyWartosci).limit(1).get();
    expect(typeof wiersz?.id).toBe("number");
    expect(Number.isInteger(wiersz?.id)).toBe(true);
  });
});
