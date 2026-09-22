/**
 * Migracja 011 (karta I15.1, ticket 107) — kolumna `products.blokowane_formy_platnosci` i sześć triggerów
 * produkcji, plus dyrektywa runnera `@dodaj-kolumne-jesli-brak`, na której migracja stoi.
 *
 * ⭐ Karta wymaga dowodu na TRZECH bazach:
 *   1. świeżej (pełny łańcuch migracji),
 *   2. kopii `db/snapshot.db` (13.08 — bez kolumny, bez triggerów, bez `_migracje`) — test z `SNAPSHOT_DB`,
 *   3. bazie symulującej produkcję: kolumna, wartości i triggery JUŻ SĄ, bo zakłada je stary backend przy
 *      każdym starcie (`payment_blocks.cjs`, `application_rules.cjs` @ 7d6cfc9). Na niej 011 nie może się
 *      wywrócić — to jest scenariusz cutoveru.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujDyrektywy, zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const PLIK_011 = "011_blokowane_formy_i_triggery.sql";

/**
 * NIEZALEŻNA kopia mapy z produkcji — `git show 7d6cfc9:mirror/backend/payment_blocks.cjs`,
 * `BLOCKED_PAYMENT_FORMS`. Sprawdza, że CASE w SQL-u migracji mówi to samo co kod, z którego
 * produkcja go generuje. MO6 celowo nie ma (CHANGELOG produkcji 2026-09-10).
 */
const BLOKADY_PRODUKCJI: Record<string, string> = {
  MO1: "203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO2: "201, 202, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO3: "201, 202, 203, 204, 205, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO4: "201, 202, 203, 204, 205, 206, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO5: "201, 202, 203, 204, 205, 206, 207, 208, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO7: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 213, 214, 215, 216, 217, 218, 219",
  MO8: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 215, 216, 217, 218, 219",
  MO9: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 217, 218, 219",
  MO10: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216",
};
const blokadaDla = (dostawca: string): string | null =>
  BLOKADY_PRODUKCJI[dostawca.trim().toUpperCase()] ?? null;

const TRIGGERY = [
  "products_blokowane_formy_ai",
  "products_blokowane_formy_au",
  "products_zastosowanie_ai",
  "products_zastosowanie_au",
  "manual_overrides_kategoria_ai",
  "manual_overrides_kategoria_au",
];

/**
 * Definicje `CREATE TRIGGER … END` z pliku 011 — ta część pliku jest kopią bajt w bajt
 * `7d6cfc9:db/schema.sql:334-385` (zweryfikowane `diff`em przy tworzeniu, ticket 107).
 * `sqlite_master.sql` trzyma tekst instrukcji bez końcowego średnika.
 */
const definicjeZPliku = (): Map<string, string> => {
  const sql = readFileSync(join(KATALOG_SCHEMATU(), PLIK_011), "utf8");
  const wynik = new Map<string, string>();
  for (const m of sql.matchAll(/^CREATE TRIGGER (\w+)[\s\S]*?^\s*END(?=;$)/gm)) {
    wynik.set(m[1]!, m[0]);
  }
  return wynik;
};

const triggeryWBazie = (db: BazaSqlite): Map<string, string> =>
  new Map(
    (
      db.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name`).all() as {
        name: string;
        sql: string;
      }[]
    ).map((t) => [t.name, t.sql]),
  );

const kolumnyProducts = (db: BazaSqlite): string[] =>
  (db.prepare(`PRAGMA table_info(products)`).all() as { name: string }[]).map((k) => k.name);

/**
 * Katalog ze WSZYSTKIMI migracjami poza 011 — stan bazy, na którą 011 trafia jako jedyna brakująca
 * (tak wygląda produkcja przy cutoverze: reszta odnotowana, 011 nie). Lista liczona z katalogu,
 * a nie wpisana na sztywno, żeby migracje równoległych kart (np. 013 z I15.6) nie psuły testu.
 */
const katalogBez011 = (gdzie: string): string => {
  const k = join(gdzie, "schema-bez-011");
  mkdirSync(k);
  for (const plik of readdirSync(KATALOG_SCHEMATU())) {
    if (plik.endsWith(".sql") && plik !== PLIK_011) {
      copyFileSync(join(KATALOG_SCHEMATU(), plik), join(k, plik));
    }
  }
  return k;
};

const dodajProdukt = (
  db: BazaSqlite,
  kod: string,
  pola: { dostawca?: string; kategoria?: string; zastosowanie?: string | null } = {},
) =>
  Number(
    db
      .prepare(
        `INSERT INTO products
           (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy,
            marza_pct, data_aktualizacji, zastosowanie)
         VALUES (?, 'OPONA', 'BKT', ?, ?, 'GL', 1, 100.0, 130.0, 30.0, '2026-09-22', ?)`,
      )
      .run(kod, pola.kategoria ?? "Rolnicze", pola.dostawca ?? "MO1", pola.zastosowanie ?? null)
      .lastInsertRowid,
  );

const produkt = (db: BazaSqlite, kod: string) =>
  db
    .prepare(`SELECT kategoria, zastosowanie, blokowane_formy_platnosci AS blokady FROM products WHERE kod = ?`)
    .get(kod) as { kategoria: string; zastosowanie: string | null; blokady: string | null };

let katalog: string;
let sqlite: BazaSqlite;

beforeEach(() => {
  katalog = mkdtempSync(join(tmpdir(), "bridge-migracja-011-"));
  ({ sqlite } = otworzBaze(join(katalog, "test.db")));
});
afterEach(() => {
  sqlite.close();
  rmSync(katalog, { recursive: true, force: true });
});

describe("dyrektywa runnera `@dodaj-kolumne-jesli-brak`", () => {
  const migracje = (pliki: Record<string, string>): string => {
    const k = join(katalog, "mig");
    mkdirSync(k);
    for (const [nazwa, tresc] of Object.entries(pliki)) writeFileSync(join(k, nazwa), tresc);
    return k;
  };
  const kolumny = (tabela: string) =>
    (sqlite.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map((k) => k.name);

  it("dokłada kolumnę, której brak, zanim wykona treść pliku", () => {
    const k = migracje({
      "001_a.sql": "CREATE TABLE t (id INTEGER PRIMARY KEY);",
      "002_b.sql": "-- @dodaj-kolumne-jesli-brak t c TEXT DEFAULT 'x'\nINSERT INTO t (c) VALUES ('y');",
    });
    expect(zastosujMigracje(sqlite, k).zastosowane).toEqual(["001_a.sql", "002_b.sql"]);
    expect(kolumny("t")).toEqual(["id", "c"]);
    expect(sqlite.prepare("SELECT c FROM t").all()).toEqual([{ c: "y" }]);
  });

  it("pomija kolumnę, która już jest — plik przechodzi zamiast paść na `duplicate column name`", () => {
    const k = migracje({
      "001_a.sql": "CREATE TABLE t (id INTEGER PRIMARY KEY, c TEXT);",
      "002_b.sql": "-- @dodaj-kolumne-jesli-brak t c TEXT\nINSERT INTO t (c) VALUES ('y');",
    });
    expect(zastosujMigracje(sqlite, k).zastosowane).toEqual(["001_a.sql", "002_b.sql"]);
    expect(kolumny("t")).toEqual(["id", "c"]);
  });

  it.each([
    ["brak tabeli", "-- @dodaj-kolumne-jesli-brak nie_ma c TEXT", /tabela "nie_ma" nie istnieje/],
    ["zła składnia", "-- @dodaj-kolumne-jesli-brak t c", /zła składnia/],
    ["nieznana dyrektywa", "-- @usun-tabele t", /nieznana dyrektywa migracji "@usun-tabele"/],
  ])("%s → błąd, cała migracja wycofana i nieodnotowana", (_opis, dyrektywa, blad) => {
    const k = migracje({
      "001_a.sql": "CREATE TABLE t (id INTEGER PRIMARY KEY);",
      "002_b.sql": `CREATE TABLE przed (id INTEGER);\n${dyrektywa}\n`,
    });
    expect(() => zastosujMigracje(sqlite, k)).toThrow(blad);
    const odnotowane = sqlite.prepare("SELECT nazwa FROM _migracje").all();
    expect(odnotowane).toEqual([{ nazwa: "001_a.sql" }]);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'przed'").get()).toBeUndefined();
  });

  it("błąd w treści pliku wycofuje też kolumnę dodaną dyrektywą (jedna transakcja)", () => {
    const k = migracje({
      "001_a.sql": "CREATE TABLE t (id INTEGER PRIMARY KEY);",
      "002_b.sql": "-- @dodaj-kolumne-jesli-brak t c TEXT\nINSERT INTO nie_ma VALUES (1);",
    });
    expect(() => zastosujMigracje(sqlite, k)).toThrow(/no such table: nie_ma/);
    expect(kolumny("t")).toEqual(["id"]);
  });

  it("zwykły komentarz bez `@` nie jest dyrektywą", () => {
    sqlite.exec("CREATE TABLE t (id INTEGER PRIMARY KEY);");
    expect(() => zastosujDyrektywy(sqlite, "-- dodaj-kolumne-jesli-brak t c TEXT\n", "x.sql")).not.toThrow();
    expect(kolumny("t")).toEqual(["id"]);
  });
});

describe("011 — baza 1: świeża", () => {
  beforeEach(() => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });

  it("dokłada kolumnę jako ostatnią i zakłada sześć triggerów dosłownie z produkcji", () => {
    expect(kolumnyProducts(sqlite).at(-1)).toBe("blokowane_formy_platnosci");
    const wBazie = triggeryWBazie(sqlite);
    expect([...wBazie.keys()].sort()).toEqual([...TRIGGERY].sort());
    const zPliku = definicjeZPliku();
    expect(zPliku.size).toBe(6);
    for (const [nazwa, sql] of zPliku) expect(wBazie.get(nazwa), nazwa).toBe(sql);
  });

  describe("triggery blokad płatności (#73)", () => {
    it.each([
      ["MO1", BLOKADY_PRODUKCJI.MO1],
      [" mo2 ", BLOKADY_PRODUKCJI.MO2],
      ["MO10", BLOKADY_PRODUKCJI.MO10],
      ["MO6", null],
      ["XX1", null],
    ])("INSERT z dostawcą %j → %j", (dostawca, oczekiwane) => {
      dodajProdukt(sqlite, "K1", { dostawca });
      expect(produkt(sqlite, "K1").blokady).toBe(oczekiwane ?? null);
    });

    it("zmiana dostawcy przelicza blokady, zmiana innej kolumny ich nie rusza", () => {
      dodajProdukt(sqlite, "K1", { dostawca: "MO1" });
      sqlite.prepare("UPDATE products SET dostawca = 'MO3' WHERE kod = 'K1'").run();
      expect(produkt(sqlite, "K1").blokady).toBe(BLOKADY_PRODUKCJI.MO3);

      // Ręczna wartość przetrwa UPDATE innej kolumny — trigger reaguje tylko na `dostawca`.
      sqlite.prepare("UPDATE products SET blokowane_formy_platnosci = 'RECZNIE' WHERE kod = 'K1'").run();
      sqlite.prepare("UPDATE products SET stan = 5 WHERE kod = 'K1'").run();
      expect(produkt(sqlite, "K1").blokady).toBe("RECZNIE");
    });
  });

  describe("triggery kategorii i zastosowań (#75/#79/#80/#82)", () => {
    it.each([
      // [kategoria, zastosowanie] → [kategoria, zastosowanie]
      [["rolnicza", "ładowarka"], ["Rolnicze", "Ciągnik"]],
      [["przemyslowa", "ładowarka kołowa"], ["Przemysłowe", "Ładowarka"]],
      [["Leśne", "Forwarder, Harwester"], ["Leśne", "Forwarder/Harwester"]],
      [["Leśne", "skider"], ["Leśne", "Skidder"]],
      [["Rolnicze", "Ciągnik rolniczy"], ["Rolnicze", "Uniwersalne/pozostałe"]],
      // Łańcuch wartości w kategorii kanonicznej NIE jest rozpoznawany (trigger ma tylko pojedyncze
      // wartości z listy) — spada do „Uniwersalne/pozostałe". Dosłownie jak na produkcji.
      [["Rolnicze", "Ciągnik ; Przyczepa"], ["Rolnicze", "Uniwersalne/pozostałe"]],
      // Kategoria spoza czterech kanonicznych — zastosowanie przechodzi bez zmian.
      [["Przyczepy", "Ciągnik + Koparka"], ["Przyczepy", "Ciągnik + Koparka"]],
      // Puste zastosowanie zostaje puste.
      [["rolnicze", ""], ["Rolnicze", ""]],
      [["rolnicze", null], ["Rolnicze", null]],
      // ASCII-only `LOWER()` (CLAUDE.md): `LEŚNE` nie trafia w alias `leśne` — przechodzi bez zmian,
      // a zastosowanie idzie gałęzią „kategoria spoza listy”.
      [["LEŚNE", "harwester"], ["LEŚNE", "harwester"]],
      // …ale wielkie litery ASCII już tak.
      [["ROLNICZE", "KOMBAJN"], ["Rolnicze", "Kombajn"]],
    ] as const)("INSERT %j → %j", ([kategoria, zastosowanie], [kat, zas]) => {
      dodajProdukt(sqlite, "K1", { kategoria, zastosowanie });
      expect(produkt(sqlite, "K1")).toMatchObject({ kategoria: kat, zastosowanie: zas });
    });

    it("UPDATE kategorii przelicza zastosowanie według NOWEJ kategorii", () => {
      dodajProdukt(sqlite, "K1", { kategoria: "Przyczepy", zastosowanie: "koparka" });
      expect(produkt(sqlite, "K1").zastosowanie).toBe("koparka");
      sqlite.prepare("UPDATE products SET kategoria = 'przemysłowe' WHERE kod = 'K1'").run();
      expect(produkt(sqlite, "K1")).toMatchObject({ kategoria: "Przemysłowe", zastosowanie: "Koparka" });
    });

    it("poprawka ręczna `kategoria` jest normalizowana, poprawka innego pola nie", () => {
      const wstaw = sqlite.prepare(
        `INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at)
         VALUES ('MO1', 'P1', ?, ?, '2026-09-22')`,
      );
      wstaw.run("kategoria", " lesna ");
      wstaw.run("bieznik", "rolnicze");
      const wartosci = sqlite
        .prepare("SELECT field_name, override_value FROM manual_overrides ORDER BY id")
        .all();
      expect(wartosci).toEqual([
        { field_name: "kategoria", override_value: "Leśne" },
        { field_name: "bieznik", override_value: "rolnicze" },
      ]);

      sqlite.prepare("UPDATE manual_overrides SET override_value = 'ciezarowa' WHERE field_name = 'kategoria'").run();
      expect(
        sqlite.prepare("SELECT override_value FROM manual_overrides WHERE field_name = 'kategoria'").get(),
      ).toEqual({ override_value: "Ciężarowe" });
    });
  });
});

describe("011 — baza 3: symulacja produkcji (kolumna i triggery już są)", () => {
  /**
   * Odtwarza stan produkcyjnej `data.db` po starcie starego backendu: ALTER kolumny, wartości
   * uzupełnione przez `ensurePaymentBlocks()`, triggery założone przez oba moduły. `staryTrigger`
   * podmienia jeden z nich na przestarzałą wersję — 011 musi go wymienić na aktualny.
   */
  const stanProdukcji = (opcje: { staryTrigger?: boolean } = {}) => {
    zastosujMigracje(sqlite, katalogBez011(katalog));
    sqlite.exec("ALTER TABLE products ADD COLUMN blokowane_formy_platnosci TEXT");
    for (const sql of definicjeZPliku().values()) sqlite.exec(sql);
    if (opcje.staryTrigger) {
      sqlite.exec(`DROP TRIGGER products_blokowane_formy_ai;
        CREATE TRIGGER products_blokowane_formy_ai AFTER INSERT ON products
        BEGIN UPDATE products SET blokowane_formy_platnosci = 'STARY' WHERE id = NEW.id; END;`);
    }
  };

  it("stosuje wyłącznie 011, bez błędu; kolumna nie dubluje się, triggery i dane zostają", () => {
    stanProdukcji();
    dodajProdukt(sqlite, "A", { dostawca: "MO2", kategoria: "Rolnicze", zastosowanie: "Kombajn" });
    const kolumnyPrzed = kolumnyProducts(sqlite);
    const triggeryPrzed = triggeryWBazie(sqlite);
    const wierszePrzed = sqlite.prepare("SELECT * FROM products ORDER BY id").all();

    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(wynik.zastosowane).toEqual([PLIK_011]);
    expect(kolumnyProducts(sqlite)).toEqual(kolumnyPrzed);
    expect(triggeryWBazie(sqlite)).toEqual(triggeryPrzed);
    expect(sqlite.prepare("SELECT * FROM products ORDER BY id").all()).toEqual(wierszePrzed);
    expect(produkt(sqlite, "A").blokady).toBe(BLOKADY_PRODUKCJI.MO2);
  });

  it("przestarzały trigger zostaje wymieniony na wersję z produkcji @ 7d6cfc9", () => {
    stanProdukcji({ staryTrigger: true });
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(triggeryWBazie(sqlite).get("products_blokowane_formy_ai")).toBe(
      definicjeZPliku().get("products_blokowane_formy_ai"),
    );
    dodajProdukt(sqlite, "B", { dostawca: "MO4" });
    expect(produkt(sqlite, "B").blokady).toBe(BLOKADY_PRODUKCJI.MO4);
  });

  it("uzupełnia rozjechane wartości blokad jak `ensurePaymentBlocks()`, kategorii i zastosowań nie rusza", () => {
    stanProdukcji();
    dodajProdukt(sqlite, "A", { dostawca: "MO1" });
    dodajProdukt(sqlite, "B", { dostawca: "MO6" });
    dodajProdukt(sqlite, "C", { dostawca: "MO7" });
    // Stan rozjechany ręcznie (triggery tego nie dopuszczą, więc omijamy je UPDATE-em kolumny).
    sqlite.prepare("UPDATE products SET blokowane_formy_platnosci = NULL WHERE kod = 'A'").run();
    sqlite.prepare("UPDATE products SET blokowane_formy_platnosci = '999' WHERE kod = 'B'").run();
    // Kategoria i zastosowanie spoza konwencji wpisane z pominięciem triggerów — produkcja przy
    // starcie NIE normalizuje istniejących wierszy (`ensureApplicationRules()` bez `backfill`).
    sqlite.exec("DROP TRIGGER products_zastosowanie_au");
    sqlite.prepare("UPDATE products SET kategoria = 'rolnicze', zastosowanie = 'kombajn' WHERE kod = 'C'").run();

    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(produkt(sqlite, "A").blokady).toBe(BLOKADY_PRODUKCJI.MO1);
    expect(produkt(sqlite, "B").blokady).toBeNull();
    expect(produkt(sqlite, "C")).toEqual({
      kategoria: "rolnicze",
      zastosowanie: "kombajn",
      blokady: BLOKADY_PRODUKCJI.MO7,
    });
    // Trigger zdjęty wyżej wraca razem z pozostałymi.
    expect([...triggeryWBazie(sqlite).keys()].sort()).toEqual([...TRIGGERY].sort());
  });
});

/**
 * ⭐ Baza 2: KOPIA `db/snapshot.db` (13.08 — przed #73/#75, bez `_migracje`):
 *
 *   SNAPSHOT_DB=/ścieżka/do/db/snapshot.db npx vitest run test/db.migracja-011.test.ts
 *
 * Najpierw wszystkie migracje poza 011, potem pełny katalog — 011 osobno, żeby
 * porównać wiersze przed i po samej 011.
 */
it.skipIf(!process.env.SNAPSHOT_DB)(
  "011 — baza 2: kopia snapshotu — blokady per dostawca, poza tym ani jednej zmiany w `products`",
  () => {
    const kopia = join(katalog, "snapshot.db");
    copyFileSync(process.env.SNAPSHOT_DB!, kopia);
    const { sqlite: snap } = otworzBaze(kopia);
    try {
      expect(kolumnyProducts(snap)).not.toContain("blokowane_formy_platnosci");
      zastosujMigracje(snap, katalogBez011(katalog));
      const przed = snap.prepare("SELECT * FROM products ORDER BY id").all() as Record<string, unknown>[];
      expect(przed.length).toBeGreaterThan(0);

      expect(zastosujMigracje(snap, KATALOG_SCHEMATU()).zastosowane).toEqual([PLIK_011]);

      const po = snap.prepare("SELECT * FROM products ORDER BY id").all() as Record<string, unknown>[];
      const oczekiwane = przed.map((w) => ({
        ...w,
        blokowane_formy_platnosci: blokadaDla(String(w.dostawca)),
      }));
      expect(po).toEqual(oczekiwane);
      expect(po.some((w) => w.blokowane_formy_platnosci !== null)).toBe(true);
      expect([...triggeryWBazie(snap).keys()].sort()).toEqual([...TRIGGERY].sort());
    } finally {
      snap.close();
    }
  },
);
