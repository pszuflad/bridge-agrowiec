/**
 * Migracja `007_selly_products_warianty.sql` (Iteracja 13d-1, ticket 45).
 *
 * ⭐ STRAŻNIK KSZTAŁTU. Kształt docelowy jest przepisany z `main:db/schema.sql:307-331`,
 * czyli ze zrzutu produkcji z 08.09 — nie z naszego pomysłu. Ten test pilnuje, żeby
 * przebudowa dała DOKŁADNIE to, co ma Ania, łącznie z rozkładem indeksów, który zdradza
 * metodę migracji (`ALTER TABLE ... RENAME`, nie przebudowa tabeli).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import type { BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { stworzTestowaBaze } from "./gate/baza.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("migracja 007 — `selly_products` w modelu wariantowym", () => {
  let sqlite: BazaSqlite;
  let posprzataj: () => void;

  beforeEach(() => {
    const baza = stworzTestowaBaze();
    sqlite = baza.sqlite;
    posprzataj = baza.posprzataj;
  });

  afterEach(() => posprzataj());

  const kolumny = (tabela: string) =>
    (sqlite.pragma(`table_info(${tabela})`) as { name: string; notnull: number }[]).map((k) => ({
      nazwa: k.name,
      notNull: k.notnull === 1,
    }));

  const indeksy = (tabela: string) =>
    (sqlite.pragma(`index_list(${tabela})`) as { name: string; origin: string }[])
      .filter((i) => i.origin === "c") // tylko jawne CREATE INDEX, bez autoindeksów UNIQUE
      .map((i) => i.name)
      .sort();

  it("tworzy komplet kolumn nowego modelu", () => {
    expect(kolumny("selly_products").map((k) => k.nazwa)).toEqual([
      "id",
      "kod_importu",
      "dostawca",
      "bridge_kod",
      "selly_product_id",
      "selly_variant_id",
      "selly_category_id",
      "selly_producer_id",
      "feature_id_magazyn",
      "ostatnia_sync",
      "ostatni_status",
      "ostatni_blad",
      "cena_sprzedazy_wyslana",
      "cena_zakupu_wyslana",
      "stan_wyslany",
      "utworzono",
    ]);
  });

  /**
   * ⚠ To `NOT NULL` jest powodem, dla którego stary `POST /api/selly/sync-supplier` z I8
   * jest u Ani ZEPSUTY od 07.09 (decyzja D3) — jego INSERT tych kolumn nie podaje.
   */
  it("`kod_importu` i `dostawca` są NOT NULL, `selly_variant_id` nullowalne", () => {
    const wg = Object.fromEntries(kolumny("selly_products").map((k) => [k.nazwa, k.notNull]));

    expect(wg.kod_importu).toBe(true);
    expect(wg.dostawca).toBe(true);
    expect(wg.bridge_kod).toBe(true);
    expect(wg.selly_product_id).toBe(true);
    // Wariant bywa nieznany aż do discovery — stąd nullowalny.
    expect(wg.selly_variant_id).toBe(false);
    expect(wg.feature_id_magazyn).toBe(false);
  });

  it("unikatowość przeniosła się na parę (kod_importu, dostawca)", () => {
    sqlite
      .prepare(
        `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id)
         VALUES ('798368', 'MO2', 'MO2_1', 812)`,
      )
      .run();

    // Ten sam kod_importu u INNEGO dostawcy jest w porządku — to inny wariant.
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id)
           VALUES ('798368', 'MO9', 'MO9_1', 812)`,
        )
        .run(),
    ).not.toThrow();

    // Ta sama para — już nie.
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id)
           VALUES ('798368', 'MO2', 'MO2_2', 999)`,
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it("`bridge_kod` NIE jest już unikatowy (był w starej tabeli)", () => {
    const stmt = sqlite.prepare(
      `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id)
       VALUES (?, ?, 'TEN_SAM', 812)`,
    );
    stmt.run("A", "MO2");
    expect(() => stmt.run("B", "MO9")).not.toThrow();
  });

  it("domyślny status to `pending` (stara tabela miała `ok`)", () => {
    sqlite
      .prepare(
        `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id)
         VALUES ('1', 'MO2', 'K', 1)`,
      )
      .run();
    const wiersz = sqlite.prepare(`SELECT ostatni_status FROM selly_products`).get() as {
      ostatni_status: string;
    };

    expect(wiersz.ostatni_status).toBe("pending");
  });

  it("zachowuje starą tabelę jako `selly_products_old` w jej pierwotnym kształcie", () => {
    expect(kolumny("selly_products_old").map((k) => k.nazwa)).toEqual([
      "id",
      "bridge_kod",
      "selly_product_id",
      "selly_category_id",
      "selly_producer_id",
      "ostatnia_sync",
      "ostatni_status",
      "ostatni_blad",
      "cena_sprzedazy_wyslana",
      "cena_zakupu_wyslana",
      "stan_wyslany",
      "utworzono",
    ]);
  });

  /**
   * ⭐ ROZKŁAD INDEKSÓW JEST DOWODEM METODY. W `main:db/schema.sql` stara tabela ma tylko
   * `idx_selly_products_kod`, a `idx_selly_products_status` siedzi na NOWEJ. SQLite przy
   * `RENAME` przenosi indeksy razem z tabelą, zachowując nazwy — taki układ powstaje więc
   * wyłącznie przez rename + `DROP INDEX` zwalniający nazwę. Gdyby ktoś przepisał migrację
   * na „utwórz nową i skopiuj dane", ten test to wyłapie.
   */
  it("indeksy rozłożone jak w produkcji", () => {
    expect(indeksy("selly_products")).toEqual([
      "idx_selly_products_bridge",
      "idx_selly_products_dostaw",
      "idx_selly_products_kod_imp",
      "idx_selly_products_prodid",
      "idx_selly_products_status",
      "idx_selly_products_varid",
    ]);
    expect(indeksy("selly_products_old")).toEqual(["idx_selly_products_kod"]);
  });

  it("dane ze starej tabeli zostają w `selly_products_old`, nowa startuje pusta", () => {
    // Świeża baza jest pusta, więc dosypujemy wiersz „sprzed migracji" wprost do archiwum —
    // sama migracja jest już zastosowana przez `stworzTestowaBaze`.
    sqlite
      .prepare(
        `INSERT INTO selly_products_old (bridge_kod, selly_product_id) VALUES ('MO1_STARY', 7)`,
      )
      .run();

    const stare = sqlite.prepare(`SELECT count(*) AS c FROM selly_products_old`).get() as {
      c: number;
    };
    const nowe = sqlite.prepare(`SELECT count(*) AS c FROM selly_products`).get() as { c: number };

    expect(stare.c).toBe(1);
    expect(nowe.c).toBe(0);
  });

  it("jest idempotentna — drugi przebieg nic nie stosuje i nie wywraca się", () => {
    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());

    expect(wynik.zastosowane).toEqual([]);
    expect(wynik.pominiete).toContain("007_selly_products_warianty.sql");
    // Kształt po drugim przebiegu bez zmian — `RENAME` nie poszedł drugi raz.
    expect(indeksy("selly_products_old")).toEqual(["idx_selly_products_kod"]);
  });
});
