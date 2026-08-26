/**
 * Strażnik jawnej projekcji kontraktowej (plan.md D6).
 *
 * Migracja 002 dokłada do bazy dwie kolumny, których produkcja nie ma
 * (`suppliers.import_wylaczony`, `products.uwaga_cena`). Zamrożony kontrakt ich nie zna,
 * więc NIE WOLNO im wyciec do odpowiedzi HTTP. Te testy pilnują obu stron umowy:
 * kolumna jest w bazie ORAZ jej nie ma w API.
 *
 * Gdyby ktoś w przyszłości usunął projekcję z repozytorium, `katalog.gate.test.ts`
 * zaświeci pierwszy — ale zaświeci komunikatem o „kluczu nadmiarowym", z którego nie
 * widać przyczyny. Ten plik nazywa przyczynę wprost.
 */
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { products, suppliers } from "../src/db/schema.js";
import { KOLUMNY_POZA_KONTRAKTEM, projekcjaKontraktowa } from "../src/repos/kolumny.js";
import { wczytajFixture } from "./gate/fixtures.js";

describe("projekcja kontraktowa", () => {
  it("products: projekcja ma dokładnie te 72 klucze co GET_products.json", () => {
    const fixture = wczytajFixture("GET_products.json");
    const wzorzec = (fixture.body as { items: Record<string, unknown>[] }).items[0];
    const oczekiwane = Object.keys(wzorzec ?? {}).sort();
    expect(oczekiwane).toHaveLength(72);

    const projekcja = projekcjaKontraktowa(products, KOLUMNY_POZA_KONTRAKTEM.products);
    expect(Object.keys(projekcja).sort()).toEqual(oczekiwane);
  });

  /**
   * `GET /api/suppliers` to 15 kolumn tabeli + 3 pola liczone w locie
   * (`ostatniaAktualizacjaCeny`, `ostatniaAktualizacjaStanu`, a `liczbaProduktow`
   * i `status` są nadpisywane). Projekcja odpowiada za część tabelaryczną.
   */
  it("suppliers: projekcja to klucze fixture'a minus 2 pola liczone w locie", () => {
    const fixture = wczytajFixture("GET_suppliers.json");
    const wzorzec = (fixture.body as Record<string, unknown>[])[0];
    const kluczeFixture = Object.keys(wzorzec ?? {});
    expect(kluczeFixture).toHaveLength(17);

    const liczoneWLocie = ["ostatniaAktualizacjaCeny", "ostatniaAktualizacjaStanu"];
    const oczekiwane = kluczeFixture.filter((k) => !liczoneWLocie.includes(k)).sort();

    const projekcja = projekcjaKontraktowa(suppliers, KOLUMNY_POZA_KONTRAKTEM.suppliers);
    expect(Object.keys(projekcja).sort()).toEqual(oczekiwane);
  });

  it("kolumny wewnętrzne SĄ w schemacie tabeli — ukrywamy je, nie usuwamy", () => {
    expect(Object.keys(getTableColumns(suppliers))).toContain("importWylaczony");
    expect(Object.keys(getTableColumns(products))).toContain("uwagaCena");
  });

  it("każda kolumna wewnętrzna jest wykluczona z projekcji", () => {
    const projekcjaDostawcow = projekcjaKontraktowa(
      suppliers,
      KOLUMNY_POZA_KONTRAKTEM.suppliers,
    );
    const projekcjaProduktow = projekcjaKontraktowa(products, KOLUMNY_POZA_KONTRAKTEM.products);
    for (const kolumna of KOLUMNY_POZA_KONTRAKTEM.suppliers) {
      expect(Object.keys(projekcjaDostawcow)).not.toContain(kolumna);
    }
    for (const kolumna of KOLUMNY_POZA_KONTRAKTEM.products) {
      expect(Object.keys(projekcjaProduktow)).not.toContain(kolumna);
    }
  });

  /**
   * Lista wykluczeń nie może po cichu rozjechać się ze schematem — literówka w nazwie
   * kolumny dawałaby projekcję, która niczego nie ukrywa, i cichy wyciek do API.
   *
   * Pierwszą linią obrony jest typ (`keyof T["_"]["columns"]`) — literówka nie przejdzie
   * `typecheck`. Rzutowanie omija ją tu celowo, żeby sprawdzić drugą linię: strażnika
   * w czasie wykonania, który broni wywołań spoza TypeScriptu i po refaktorze schematu.
   */
  it("nieistniejąca kolumna na liście wykluczeń to błąd, nie cisza", () => {
    const literowka = ["takiejKolumnyNieMa"] as unknown as readonly "uwagaCena"[];
    expect(() => projekcjaKontraktowa(products, literowka)).toThrow(/nie istnieje w tabeli/);
  });
});
