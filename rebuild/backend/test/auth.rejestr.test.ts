/**
 * Strażnik kompletności auth (finalny audyt 12e, D2a).
 *
 * ⚠ PO CO TO ISTNIEJE, skoro auth jest już testowane gdzie indziej. Wszystkie dotychczasowe
 * testy auth chodzą po LISTACH: `kontrakt.spojnosc.test.ts` iteruje po operacjach
 * z `contract/openapi.yaml`, a testy modułowe (`admin.gate`, `narzuty.gate`,
 * `produkty.mutacje`, `selly.gate`, `konfiguracja`…) po ścieżkach wypisanych ręcznie.
 * Każda z tych list wymaga, żeby ktoś PAMIĘTAŁ o jej uzupełnieniu. Trasa dodana bez
 * `requireAuth` i jednocześnie nieopisana w kontrakcie nie trafia do żadnej z nich i przechodzi
 * CI — na tym polega luka, którą ten plik zamyka.
 *
 * Dlatego ten test jako JEDYNY nie czyta żadnej listy, tylko rejestr Express zbudowanej
 * aplikacji: co jest realnie zamontowane, to jest sprawdzone.
 */
import type { Express, RequestHandler } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireAuth } from "../src/middleware/auth.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

/**
 * Trasy, które MAJĄ prawo być publiczne — jedyne trzy w całej odbudowie.
 *
 * `login` z definicji (bez niej nie da się dostać tokenu); `logout` bo JWT jest bezstanowy,
 * więc czyszczenie cookie nie ma czego autoryzować (tak samo w oryginale,
 * `backend-index.cjs:48175-48178`); `health` bo to healthcheck PM2, który nie oddaje danych.
 *
 * ⚠ Dopisanie czegokolwiek do tej listy jest ŚWIADOMĄ decyzją o wystawieniu trasy na świat.
 * Liczebność jest asercją niżej właśnie po to, żeby taka zmiana nie przeszła mimochodem.
 */
const TRASY_PUBLICZNE = ["POST /api/login", "POST /api/logout", "GET /api/health"] as const;

type ZnalezionaTrasa = { sygnatura: string; chroniona: boolean };

/** Kształt warstwy rejestru Express 4 — tyle, ile potrzebuje obchód niżej. */
type WarstwaExpress = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: RequestHandler }[];
  };
  handle?: { stack?: unknown[] };
  regexp?: { fast_slash?: boolean };
};

/**
 * Rekurencyjny obchód rejestru Express 4.
 *
 * `app._router` jest API wewnętrznym — Express nie wystawia publicznej introspekcji tras,
 * więc nie ma innej drogi do tego, co faktycznie zamontowane. Gdyby aktualizacja Express
 * zmieniła kształt tej struktury, ten test padnie na asercji „rejestr nie jest pusty" niżej
 * (a nie przemilczy problemu) — wtedy trzeba go dostosować, nie usuwać.
 *
 * `requireAuth` rozpoznajemy przez TOŻSAMOŚĆ funkcji, nie po nazwie: nazwa przeżywa
 * refaktor gorzej niż referencja, a minifikacja mogłaby ją podmienić.
 */
function zbierzTrasy(warstwy: unknown[], zebrane: ZnalezionaTrasa[] = []): ZnalezionaTrasa[] {
  for (const warstwa of warstwy as WarstwaExpress[]) {
    if (warstwa.route) {
      const { path: sciezka, methods, stack } = warstwa.route;
      const chroniona = stack.map((w) => w.handle).includes(requireAuth);
      for (const metoda of Object.keys(methods)) {
        zebrane.push({ sygnatura: `${metoda.toUpperCase()} ${sciezka}`, chroniona });
      }
      continue;
    }
    const zagniezdzony = warstwa.handle;
    if (zagniezdzony?.stack) {
      // Wszystkie routery odbudowy są montowane przez `app.use(trasyX(...))` bez prefiksu —
      // pełna ścieżka `/api/...` stoi w samym routerze. Gdyby ktoś dodał prefiks
      // (`app.use("/api/x", router)`), sygnatury poniżej byłyby niepełne i cicho rozminęłyby
      // się z rzeczywistością, więc zamiast zgadywać — pad z czytelnym powodem.
      expect(
        warstwa.regexp?.fast_slash,
        `Router zamontowany z prefiksem (${String(warstwa.regexp)}) — ` +
          "test rejestru tras zakłada montowanie bez prefiksu i wymaga aktualizacji.",
      ).toBe(true);
      zbierzTrasy(zagniezdzony.stack, zebrane);
    }
  }
  return zebrane;
}

describe("rejestr tras — requireAuth na każdej trasie danych", () => {
  let srodowisko: SrodowiskoTestowe;
  let trasy: ZnalezionaTrasa[];

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const app = srodowisko.app as Express & { _router: { stack: unknown[] } };
    trasy = zbierzTrasy(app._router.stack);
  });

  afterAll(() => srodowisko.posprzataj());

  it("rejestr da się odczytać i zawiera cały backend", () => {
    // Sanity check: gdyby introspekcja przestała działać (zmiana w Express), lista byłaby
    // pusta i wszystkie asercje niżej przechodziłyby trywialnie.
    expect(trasy.length).toBeGreaterThan(80);
    expect(trasy.map((t) => t.sygnatura)).toContain("GET /api/products");
  });

  it("każda trasa poza jawnie publicznymi wymaga tokenu", () => {
    const bezAuth = trasy
      .filter((t) => !t.chroniona)
      .map((t) => t.sygnatura)
      .sort();

    expect(bezAuth).toEqual([...TRASY_PUBLICZNE].sort());
  });

  it("lista tras publicznych ma dokładnie trzy pozycje", () => {
    // Asercja na samą listę, nie na kod: jej rozszerzenie ma wymagać zmiany TEGO testu,
    // czyli świadomej decyzji, a nie być efektem ubocznym dodania trasy.
    expect(TRASY_PUBLICZNE).toHaveLength(3);
  });

  it("trasy publiczne faktycznie istnieją — lista nie zawiera martwych wpisów", () => {
    const wszystkie = new Set(trasy.map((t) => t.sygnatura));
    for (const publiczna of TRASY_PUBLICZNE) {
      expect(wszystkie.has(publiczna), `${publiczna} nie jest zarejestrowana`).toBe(true);
    }
  });
});
