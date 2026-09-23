// Charakteryzacja `legacy/feed_safety.cjs` — modułu, który od 23.09 pilnuje, żeby niekompletny
// cennik NIE przeszedł dalej jako komplet (backlog #103, karta I15.2, ticket 120).
//
// Dlaczego osobny plik, a nie dopisek do charakteryzacja.test.ts: tamten mierzy potok na
// próbkach, które są POPRAWNE (wszystkie mają `bledy: 0` i niepustą listę). Ścieżki błędu
// nie uruchamia więc ani razu, a to właśnie one są treścią #103.
//
// Trzy rzeczy, które ten plik dowodzi:
//   1. attach() zatrzymuje import w trzech sytuacjach i robi to WYJĄTKIEM, nie cichym zerem.
//   2. `_bridgeFeedMeta` jest NIEWYLICZALNE — nie może wyciec do JSON-a odpowiedzi ani do
//      snapshotu stagingu, a mimo to przeżywa drogę dispatcher → adapter.
//   3. Komunikaty są PRZYPIĘTE. `parsuj.ts` rozpoznaje po nich, czy to pusty cennik (nasz
//      starszy bezpiecznik D7, kod 400 i komunikat bez zmian), czy błąd parsera (#103).
//      Gdyby kolejny resync zmienił treść, ten plik zaświeci na czerwono — zamiast po cichu
//      wpaść w gałąź „błąd parsera" i przestawić komunikat widziany przez Anię.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const wymagaj = createRequire(import.meta.url);
const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const feedSafety = wymagaj(
  join(backendDir, "src", "import", "legacy", "feed_safety.cjs"),
) as {
  attach: (dostawca: string, wynik: unknown) => { records: unknown[] };
  converted: (
    dostawca: string,
    records: unknown[],
    items: unknown[],
    odrzucone: unknown[],
  ) => unknown[];
};

interface Meta {
  complete: boolean;
  parserErrors: number;
  source: string;
  rawCount: number;
  excludedCodes: string[];
}

const meta = (tablica: unknown[]): Meta =>
  (tablica as unknown as { _bridgeFeedMeta: Meta })._bridgeFeedMeta;

const rekord = (kod: string) => ({ kod_dostawcy: kod });

describe("feed_safety.attach — zatrzymuje niekompletny cennik", () => {
  it("pusty cennik przerywa import zamiast oddać zero rekordów", () => {
    expect(() => feedSafety.attach("MO1", { records: [], errors: [] })).toThrow(
      /^Pusty cennik/,
    );
  });

  it("błędy parsera przerywają import — z liczbą błędów w komunikacie", () => {
    expect(() =>
      feedSafety.attach("MO1", { records: [rekord("A")], errors: [{ wiersz: 1 }, { wiersz: 2 }] }),
    ).toThrow(/^Błędy odczytu cennika \(2\)/);
  });

  /**
   * To jest sedno #103: zanim on wszedł, błąd odczytu przechodził dalej w polu `bledy`,
   * a import leciał na NIEKOMPLETNYCH danych — czyli dokładnie to, co przy trzech
   * przebiegach z rzędu wycofywało katalog dostawcy.
   */
  it("komunikat błędu parsera mówi wprost, że nie ma przełączenia na stary format", () => {
    expect(() =>
      feedSafety.attach("MO1", { records: [rekord("A")], errors: [{ wiersz: 1 }] }),
    ).toThrow(/bez przełączania na stary format/);
  });

  it("brak listy produktów przerywa import", () => {
    expect(() => feedSafety.attach("MO1", { errors: [] })).toThrow(/^Brak listy produktów/);
  });

  it("poprawny cennik przechodzi i dostaje metadane", () => {
    const wynik = feedSafety.attach("MO1", { records: [rekord("A"), rekord("B")], errors: [] });

    expect(meta(wynik.records)).toEqual({
      complete: true,
      parserErrors: 0,
      source: "supplier file",
      rawCount: 2,
      excludedCodes: [],
    });
  });

  it("MO9 ma własne źródło — pobiera z API, nie z pliku", () => {
    const wynik = feedSafety.attach("MO9", { records: [{ id: 7 }], errors: [] });
    expect(meta(wynik.records).source).toBe("Agrorami GraphQL");
  });
});

/**
 * Granica tłumaczenia wyjątków w `parsuj.ts`. Tłumaczymy WYŁĄCZNIE trzy komunikaty
 * `feed_safety` — wszystko inne ma lecieć dalej nietknięte i kończyć się kodem 500,
 * tak jak przed ticketem 120. Inaczej prawdziwa awaria serwera (zepsuty czytnik XLSX,
 * `TypeError` z naszego kodu) przebierałaby się za błąd klienta i znikała z radaru.
 */
describe("feed_safety — komunikaty, po których rozpoznajemy wyjątek", () => {
  it("trzy rozpoznawane komunikaty zaczynają się dokładnie tak, jak zakłada parsuj.ts", () => {
    const zlap = (f: () => unknown) => {
      try {
        f();
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    };

    expect(zlap(() => feedSafety.attach("MO1", { records: [], errors: [] }))).toMatch(
      /^Pusty cennik/,
    );
    expect(zlap(() => feedSafety.attach("MO1", { errors: [] }))).toMatch(/^Brak listy produktów/);
    expect(
      zlap(() => feedSafety.attach("MO1", { records: [rekord("A")], errors: [{ w: 1 }] })),
    ).toMatch(/^Błędy odczytu cennika/);
  });
});

describe("feed_safety — `_bridgeFeedMeta` nie wycieka do danych", () => {
  it("jest NIEWYLICZALNE, więc nie wchodzi do JSON.stringify ani do Object.keys", () => {
    const wynik = feedSafety.attach("MO1", { records: [rekord("A")], errors: [] });

    expect(Object.keys(wynik.records)).not.toContain("_bridgeFeedMeta");
    expect(JSON.stringify(wynik.records)).not.toContain("_bridgeFeedMeta");
    // …a mimo to jest dostępne dla kodu, który go szuka wprost.
    expect(meta(wynik.records).complete).toBe(true);
  });
});

describe("feed_safety.converted — metadane przeżywają drogę do adaptera", () => {
  it("przenosi metadane z rekordów parsera na pozycje po adapterze", () => {
    const wynik = feedSafety.attach("MO1", { records: [rekord("A")], errors: [] });
    const pozycje = feedSafety.converted("MO1", wynik.records, [{ kod: "MO1_A" }], []);

    expect(meta(pozycje).rawCount).toBe(1);
    expect(meta(pozycje).complete).toBe(true);
  });

  it("dokłada kody odrzucone przez adapter do tych odrzuconych przez parser", () => {
    const wynik = feedSafety.attach("MO1", {
      records: [rekord("A")],
      errors: [],
      odrzucone: [rekord("ODRZUCONY-PARSER")],
    });
    const pozycje = feedSafety.converted("MO1", wynik.records, [{ kod: "MO1_A" }], [
      rekord("ODRZUCONY-ADAPTER"),
    ]);

    expect(meta(pozycje).excludedCodes).toEqual([
      "MO1_ODRZUCONY-PARSER",
      "MO1_ODRZUCONY-ADAPTER",
    ]);
  });

  it("bez metadanych oddaje pozycje bez zmian, zamiast rzucać", () => {
    const pozycje = [{ kod: "MO1_A" }];
    expect(feedSafety.converted("MO1", [], pozycje, [])).toBe(pozycje);
  });
});
