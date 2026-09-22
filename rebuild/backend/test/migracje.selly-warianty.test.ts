/**
 * Migracja `013_selly_products_warianty.sql` (karta I15.6, ticket 108; backlog #60).
 *
 * ⭐ STRAŻNIK KSZTAŁTU. Kształt docelowy jest przepisany z `origin/main:db/schema.sql:174-331`
 * (produkcja zamrożona na 7d6cfc9) — nie z naszego pomysłu. Test pilnuje, żeby przebudowa
 * dała DOKŁADNIE to, co ma Ania, łącznie z rozkładem indeksów, który zdradza metodę migracji
 * (`ALTER TABLE … RENAME`, nie przebudowa tabeli), oraz tego, co migracja zrobi na bazie,
 * która JUŻ ma nowy kształt (produkcja przy cutoverze).
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { stworzTestowaBaze } from "./gate/baza.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const MIGRACJA = "013_selly_products_warianty.sql";

const kolumny = (sqlite: BazaSqlite, tabela: string) =>
  (sqlite.pragma(`table_info(${tabela})`) as { name: string; notnull: number }[]).map((k) => ({
    nazwa: k.name,
    notNull: k.notnull === 1,
  }));

const indeksy = (sqlite: BazaSqlite, tabela: string) =>
  (sqlite.pragma(`index_list(${tabela})`) as { name: string; origin: string }[])
    .filter((i) => i.origin === "c") // tylko jawne CREATE INDEX, bez autoindeksów UNIQUE
    .map((i) => i.name)
    .sort();

describe("migracja 013 — `selly_products` w modelu wariantowym", () => {
  let sqlite: BazaSqlite;
  let posprzataj: () => void;

  beforeEach(() => {
    const baza = stworzTestowaBaze();
    sqlite = baza.sqlite;
    posprzataj = baza.posprzataj;
  });

  afterEach(() => posprzataj());

  it("tworzy komplet kolumn nowego modelu, w kolejności z produkcji", () => {
    expect(kolumny(sqlite, "selly_products").map((k) => k.nazwa)).toEqual([
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

  /** To `NOT NULL` jest powodem awarii starego `sync-supplier` na produkcji (backlog #67). */
  it("`kod_importu`, `dostawca`, `bridge_kod`, `selly_product_id` NOT NULL; wariant nullowalny", () => {
    const wg = Object.fromEntries(kolumny(sqlite, "selly_products").map((k) => [k.nazwa, k.notNull]));

    expect(wg).toMatchObject({
      kod_importu: true,
      dostawca: true,
      bridge_kod: true,
      selly_product_id: true,
      // Wariant bywa nieznany aż do discovery — stąd nullowalny.
      selly_variant_id: false,
      feature_id_magazyn: false,
    });
  });

  it("unikatowa jest para (kod_importu, dostawca), a `bridge_kod` już nie", () => {
    const wstaw = sqlite.prepare(
      `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id)
       VALUES (?, ?, ?, ?)`,
    );
    wstaw.run("798368", "MO2", "MO2_1", 812);

    // Ten sam kod_importu u INNEGO dostawcy to inny wariant tego samego produktu.
    expect(() => wstaw.run("798368", "MO9", "MO9_1", 812)).not.toThrow();
    // Ten sam `bridge_kod` przy innej parze — dozwolone (w starej tabeli był UNIQUE).
    expect(() => wstaw.run("111", "MO3", "MO2_1", 5)).not.toThrow();
    // Ta sama para — nie.
    expect(() => wstaw.run("798368", "MO2", "MO2_2", 999)).toThrow(/UNIQUE constraint failed/);
  });

  it("domyślny status to `pending` (stara tabela miała `ok`)", () => {
    sqlite
      .prepare(
        `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id)
         VALUES ('1', 'MO2', 'K', 1)`,
      )
      .run();

    expect(sqlite.prepare(`SELECT ostatni_status FROM selly_products`).get()).toEqual({
      ostatni_status: "pending",
    });
  });

  it("stara tabela zostaje jako `selly_products_old` w pierwotnym kształcie", () => {
    expect(kolumny(sqlite, "selly_products_old").map((k) => k.nazwa)).toEqual([
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
   * ⭐ ROZKŁAD INDEKSÓW JEST DOWODEM METODY. W zrzucie produkcji stara tabela ma tylko
   * `idx_selly_products_kod`, a `idx_selly_products_status` siedzi na NOWEJ — taki układ
   * powstaje wyłącznie przez rename + `DROP INDEX` zwalniający nazwę.
   */
  it("indeksy rozłożone jak w produkcji", () => {
    expect(indeksy(sqlite, "selly_products")).toEqual([
      "idx_selly_products_bridge",
      "idx_selly_products_dostaw",
      "idx_selly_products_kod_imp",
      "idx_selly_products_prodid",
      "idx_selly_products_status",
      "idx_selly_products_varid",
    ]);
    expect(indeksy(sqlite, "selly_products_old")).toEqual(["idx_selly_products_kod"]);
  });

  it("drugi przebieg runnera nic nie stosuje", () => {
    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());

    expect(wynik.zastosowane).toEqual([]);
    expect(wynik.pominiete).toContain(MIGRACJA);
    expect(indeksy(sqlite, "selly_products_old")).toEqual(["idx_selly_products_kod"]);
  });
});

/**
 * Migracja na bazie z DANYMI: stosujemy wszystko sprzed 013, wstawiamy mapowanie w starym
 * kształcie, a dopiero potem dokładamy 013 — tak, jak zadziała na stagingu z kopią bazy.
 */
describe("migracja 013 — dane i baza w kształcie produkcji", () => {
  let katalog: string;
  let katalogSchematu: string;
  let sqlite: BazaSqlite;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-013-"));
    katalogSchematu = join(katalog, "schema");
    ({ sqlite } = otworzBaze(join(katalog, "test.db")));

    // Kopia katalogu migracji BEZ 013 (i bez niczego po niej).
    const pliki = readdirSync(KATALOG_SCHEMATU()).filter((f) => f.endsWith(".sql") && f < MIGRACJA);
    mkdirSync(katalogSchematu);
    for (const plik of pliki) copyFileSync(join(KATALOG_SCHEMATU(), plik), join(katalogSchematu, plik));
    zastosujMigracje(sqlite, katalogSchematu);
  });

  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const dolozMigracje = () =>
    copyFileSync(join(KATALOG_SCHEMATU(), MIGRACJA), join(katalogSchematu, MIGRACJA));

  it("stare mapowania przechodzą do `selly_products_old`, nowa tabela startuje pusta", () => {
    sqlite
      .prepare(
        `INSERT INTO selly_products (bridge_kod, selly_product_id, ostatni_status)
         VALUES ('MO1_STARY', 7, 'ok')`,
      )
      .run();
    dolozMigracje();

    expect(zastosujMigracje(sqlite, katalogSchematu).zastosowane).toEqual([MIGRACJA]);
    expect(sqlite.prepare(`SELECT bridge_kod, selly_product_id FROM selly_products_old`).all()).toEqual([
      { bridge_kod: "MO1_STARY", selly_product_id: 7 },
    ]);
    expect(sqlite.prepare(`SELECT count(*) AS c FROM selly_products`).get()).toEqual({ c: 0 });
  });

  /**
   * ⚠ CUTOVER. Produkcja ma OBA obiekty od 07.09 (przebudowa ręczna Ani). Migracja musi
   * wtedy paść cała — nie zostawić bazy w pół drogi — a `_migracje` nie może odnotować 013.
   * Procedurę (weryfikacja kształtu + ręczny wpis do `_migracje`) opisuje `docs/cutover.md`.
   */
  it("na bazie, która już ma nowy kształt, pada i niczego nie zmienia", () => {
    // Odtworzenie stanu produkcji: 013 zastosowana „ręcznie”, bez wpisu w `_migracje`.
    dolozMigracje();
    zastosujMigracje(sqlite, katalogSchematu);
    sqlite.prepare(`DELETE FROM _migracje WHERE nazwa = ?`).run(MIGRACJA);
    sqlite
      .prepare(
        `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id)
         VALUES ('798368', 'MO2', 'MO2_798368', 812)`,
      )
      .run();

    expect(() => zastosujMigracje(sqlite, katalogSchematu)).toThrow(
      /there is already another table or index with this name: selly_products_old/,
    );
    expect(sqlite.prepare(`SELECT count(*) AS c FROM selly_products`).get()).toEqual({ c: 1 });
    expect(sqlite.prepare(`SELECT nazwa FROM _migracje WHERE nazwa = ?`).get(MIGRACJA)).toBeUndefined();
  });
});

