/**
 * Łańcuch migracji na DOKŁADNYM schemacie produkcji (ticket 107, decyzja koordynatora 2026-09-22).
 *
 * Produkcyjna `data.db` nie pochodzi z naszego kanonu: `products` ma 74 kolumny (kanon + `uwaga_cena`
 * z `uwaga_cena_patch.cjs` + `blokowane_formy_platnosci` z `payment_blocks.cjs`), `szerokosc` jest już
 * TEXT (własna migracja `szertxt` Ani), Selly jest już przebudowane (`selly_products_old` + nowa
 * `selly_products`), a tabeli `_migracje` nie ma wcale. Bez dyrektyw runnera `npm run migrate` padał
 * na 002 (`duplicate column name: uwaga_cena`), 003 (`INSERT … SELECT *` 74 → 73 kolumny) i 013
 * (`selly_products_old` już jest) — ani odświeżenie stagingu kopią produkcji, ani cutover nie przeszłyby
 * bez ręcznych kroków z `docs/cutover.md` §3.
 *
 * Fixture `schemat-produkcji/7d6cfc9-schema.sql` to `git show 7d6cfc9:db/schema.sql` BAJT W BAJT
 * (produkcja zamrożona od 2026-09-22). Jedyna obróbka przy wczytaniu: pominięcie
 * `CREATE TABLE sqlite_sequence(...)` — SQLite zakłada tę tabelę sam i nie pozwala jej utworzyć ręcznie.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const SCHEMAT_PRODUKCJI = join(
  dirname(fileURLToPath(import.meta.url)),
  "schemat-produkcji",
  "7d6cfc9-schema.sql",
);

const zbudujBazeProdukcji = (db: BazaSqlite): void => {
  const ddl = readFileSync(SCHEMAT_PRODUKCJI, "utf8");
  expect(ddl, "fixture musi zaczynać się od sqlite_sequence — inaczej zmienił się zrzut").toMatch(
    /^CREATE TABLE sqlite_sequence\(name,seq\);\n/,
  );
  db.exec(ddl.replace(/^CREATE TABLE sqlite_sequence\(name,seq\);\n/, ""));
};

/**
 * Dane w stanie, w jakim trzyma je produkcja — już po konwencjach 13c i po triggerach: kategoria
 * i zastosowanie kanoniczne, `nazwa` WIELKIMI, `konstrukcja` słowem, `szerokosc` napisem z zerami,
 * blokady wypełnione triggerem ze zrzutu. Migracje danych 004–010 mają być na nich no-opem.
 */
const zasiejJakProdukcja = (db: BazaSqlite): void => {
  const produkt = db.prepare(
    `INSERT INTO products
       (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy, marza_pct,
        data_aktualizacji, szerokosc, konstrukcja, zastosowanie, uwaga_cena)
     VALUES (?, ?, 'BKT', ?, ?, 'GL', 1, 100.0, 130.0, 30.0, '2026-09-22', ?, 'Radialna', ?, ?)`,
  );
  produkt.run("MO2_1", "OPONA 10.0/75-15.3 BKT", "Rolnicze", "MO2", "10.00", "Kombajn", null);
  produkt.run("MO7_1", "OPONA 650/65R42 NOKIAN", "Rolnicze", "MO7", "650", "Ciągnik", "na zapytanie");
  produkt.run("MO6_1", "OPONA 18X8.50-8 UNIGLORY", "Przemysłowe", "MO6", "18", "Wózek widłowy", null);

  db.prepare(
    `INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id)
     VALUES ('11111', 'MO2', 'MO2_1', 500, 900)`,
  ).run();
  db.prepare(`INSERT INTO suppliers (kod, nazwa, format_pliku, sposob_dostarczania) VALUES ('MO6', 'Agrowiec', 'xlsx', 'email')`).run();
};

const zrzut = (db: BazaSqlite, tabela: string) =>
  db.prepare(`SELECT * FROM ${tabela} ORDER BY rowid`).all();
const schematTabeli = (db: BazaSqlite, tabela: string) => db.prepare(`PRAGMA table_info(${tabela})`).all();
const obiekty = (db: BazaSqlite) =>
  db
    .prepare(
      `SELECT type, name, tbl_name, sql FROM sqlite_master
        WHERE name NOT LIKE 'sqlite_%' AND name <> '_migracje' ORDER BY type, name`,
    )
    .all();

let katalog: string;
let sqlite: BazaSqlite;

beforeEach(() => {
  katalog = mkdtempSync(join(tmpdir(), "bridge-migracje-produkcja-"));
  ({ sqlite } = otworzBaze(join(katalog, "test.db")));
});
afterEach(() => {
  sqlite.close();
  rmSync(katalog, { recursive: true, force: true });
});

describe("pełny łańcuch migracji na schemacie produkcji @ 7d6cfc9 (bez `_migracje`)", () => {
  beforeEach(() => {
    zbudujBazeProdukcji(sqlite);
    zasiejJakProdukcja(sqlite);
  });

  it("przechodzi bez błędu; 003 i 013 odnotowane bez wykonania treści", () => {
    expect(schematTabeli(sqlite, "products")).toHaveLength(74);
    const wszystkie = zastosujMigracje(sqlite, KATALOG_SCHEMATU()).zastosowane;

    const drugi = zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(drugi.zastosowane).toEqual([]);
    expect(drugi.pominiete).toEqual(wszystkie);
    expect(wszystkie).toContain("002_import.sql");
  });

  it("zwraca `bezTresci` = dokładnie 003 i 013", () => {
    expect(zastosujMigracje(sqlite, KATALOG_SCHEMATU()).bezTresci).toEqual([
      "003_szerokosc_text.sql",
      "013_selly_products_warianty.sql",
    ]);
  });

  it("`products`, `selly_products`, `selly_products_old` i triggery zostają nietknięte — kształt i dane", () => {
    const przed = {
      products: [schematTabeli(sqlite, "products"), zrzut(sqlite, "products")],
      selly: [schematTabeli(sqlite, "selly_products"), zrzut(sqlite, "selly_products")],
      sellyOld: [schematTabeli(sqlite, "selly_products_old"), zrzut(sqlite, "selly_products_old")],
      triggery: sqlite.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name`).all(),
    };
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());

    expect({
      products: [schematTabeli(sqlite, "products"), zrzut(sqlite, "products")],
      selly: [schematTabeli(sqlite, "selly_products"), zrzut(sqlite, "selly_products")],
      sellyOld: [schematTabeli(sqlite, "selly_products_old"), zrzut(sqlite, "selly_products_old")],
      triggery: sqlite.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name`).all(),
    }).toEqual(przed);
    // Wartości, które padłyby ofiarą 003 albo gołego ALTER-a w 002, są na miejscu.
    expect(
      sqlite.prepare("SELECT kod, szerokosc, uwaga_cena FROM products ORDER BY kod").all(),
    ).toEqual([
      { kod: "MO2_1", szerokosc: "10.00", uwaga_cena: null },
      { kod: "MO6_1", szerokosc: "18", uwaga_cena: null },
      { kod: "MO7_1", szerokosc: "650", uwaga_cena: "na zapytanie" },
    ]);
  });

  it("dokłada tylko to, czego produkcja nie ma: `suppliers.import_wylaczony` (MO6 = 1) i tabele odbudowy", () => {
    const przed = obiekty(sqlite) as { name: string }[];
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const po = obiekty(sqlite) as { name: string }[];

    const nazwyPrzed = new Set(przed.map((o) => o.name));
    expect(po.filter((o) => !nazwyPrzed.has(o.name)).map((o) => o.name).sort()).toEqual([
      "alerty_katalogu_statusy",
      "idx_alerty_katalogu_statusy_klucz",
      "waga_gab_przewoznicy",
    ]);
    expect(
      sqlite.prepare("SELECT kod, import_wylaczony FROM suppliers").all(),
    ).toEqual([{ kod: "MO6", import_wylaczony: 1 }]);
  });
});

describe("baza, która ma już 002/003 w `_migracje`", () => {
  /**
   * Stara procedura ręczna z `docs/cutover.md` §3 odnotowywała 002 w `_migracje` bez wykonania. Baza po
   * niej (albo staging/dev z wykonanymi 002/003 w starej treści) nie może dostać nowej treści 002/003 —
   * runner pomija je po nazwie, więc zmiana plików jest dla takich baz niewidoczna.
   */
  it("schemat produkcji z 001–003 odnotowanymi: runner zaczyna od 004 i niczego z 002/003 nie powtarza", () => {
    zbudujBazeProdukcji(sqlite);
    zasiejJakProdukcja(sqlite);
    sqlite.exec(`CREATE TABLE _migracje (nazwa TEXT PRIMARY KEY, zastosowano TEXT NOT NULL);
      INSERT INTO _migracje VALUES ('001_schema.sql', 'x'), ('002_import.sql', 'x'), ('003_szerokosc_text.sql', 'x');`);

    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(wynik.pominiete).toEqual(["001_schema.sql", "002_import.sql", "003_szerokosc_text.sql"]);
    expect(wynik.zastosowane[0]).toBe("004_kategoria_wielka_litera.sql");
    // 002 nie wykonana — `import_wylaczony` nie powstała (to był krok ręczny starej procedury).
    expect((schematTabeli(sqlite, "suppliers") as { name: string }[]).map((k) => k.name)).not.toContain(
      "import_wylaczony",
    );
  });

  it("baza z kanonu po pełnym łańcuchu: kolejne uruchomienie nie zmienia schematu ani danych", () => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    sqlite
      .prepare(
        `INSERT INTO products (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu,
           cena_sprzedazy, marza_pct, data_aktualizacji, szerokosc)
         VALUES ('K1', 'OPONA', 'BKT', 'Rolnicze', 'MO1', 'GL', 1, 1, 1, 0, '2026-09-22', '10.00')`,
      )
      .run();
    const przed = [obiekty(sqlite), zrzut(sqlite, "products")];

    expect(zastosujMigracje(sqlite, KATALOG_SCHEMATU()).zastosowane).toEqual([]);
    expect([obiekty(sqlite), zrzut(sqlite, "products")]).toEqual(przed);
  });
});
