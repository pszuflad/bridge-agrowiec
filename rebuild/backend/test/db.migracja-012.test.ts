/**
 * Migracja 012 — fundament polityki stagingu (karta I15.4a, ticket 124).
 *
 * GATE karty: migracja musi przejść na TRZECH bazach i na każdej zostawić ten sam kształt:
 *   1. ŚWIEŻEJ — cały kanon 001 → 013 od zera;
 *   2. kopii `db/snapshot.db` (13.08, 3362 wiersze `staging_items` z duplikatami) — test z
 *      `SNAPSHOT_DB=…`, bo plik nie jest wersjonowany;
 *   3. SYMULUJĄCEJ PRODUKCJĘ — `schemat-produkcji/88fa31c-schema.sql`, czyli zrzut
 *      `git show 88fa31c:db/schema.sql` BAJT W BAJT, gdzie wszystkie sześć tabel i oba indeksy
 *      JUŻ ISTNIEJĄ (Ania założyła je 22–23.09). Tu migracja musi być no-opem, inaczej cutover
 *      wywróciłby się na `table … already exists` — runner wykonuje plik jednym `exec()`.
 *
 * ⭐ NAJMOCNIEJSZA ASERCJA jest niżej: DDL zapisany przez naszą migrację porównujemy nie ze
 * stałą w teście, tylko z `sqlite_master` bazy ZBUDOWANEJ ZE ZRZUTU PRODUKCJI. SQLite normalizuje
 * `IF NOT EXISTS` przy zapisie do `sqlite_master`, więc oba teksty muszą wyjść identyczne co do
 * znaku — literówka w typie kolumny przestaje być wykrywalna dopiero na produkcji.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const KATALOG_TESTU = dirname(fileURLToPath(import.meta.url));
const SCHEMAT_88FA31C = join(KATALOG_TESTU, "schemat-produkcji", "88fa31c-schema.sql");
const PLIK_012 = join(KATALOG_SCHEMATU(), "012_staging_polityka.sql");

/** Sześć tabel i dwa indeksy wniesione przez 012 — nazwy jak w `88fa31c:db/schema.sql:332-347`. */
const OBIEKTY_012 = [
  "product_absence_checks",
  "product_auto_suspensions",
  "staging_absence_decisions",
  "staging_absence_one_choice",
  "staging_matches",
  "staging_one_current_product",
  "supplier_feed_state",
  "supplier_feed_versions",
] as const;

const zbudujZeZrzutu = (db: BazaSqlite, plik: string): void => {
  const ddl = readFileSync(plik, "utf8");
  // SQLite zakłada `sqlite_sequence` sam i nie pozwala jej utworzyć ręcznie (jak w db.migracje-produkcja).
  db.exec(ddl.replace(/^CREATE TABLE sqlite_sequence\(name,seq\);\n/, ""));
};

/** Wiersze `sqlite_master` dla obiektów 012 — `sql` to DDL tak, jak SQLite go PRZECHOWUJE. */
const ddl012 = (db: BazaSqlite): { type: string; name: string; tbl_name: string; sql: string }[] =>
  db
    .prepare(
      `SELECT type, name, tbl_name, sql FROM sqlite_master
        WHERE name IN (${OBIEKTY_012.map(() => "?").join(",")}) ORDER BY name`,
    )
    .all(...OBIEKTY_012) as never;

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
  katalog = mkdtempSync(join(tmpdir(), "bridge-012-"));
  ({ sqlite } = otworzBaze(join(katalog, "test.db")));
});
afterEach(() => {
  sqlite.close();
  rmSync(katalog, { recursive: true, force: true });
});

describe("012 na ŚWIEŻEJ bazie", () => {
  beforeEach(() => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });

  it("zakłada dokładnie sześć tabel i dwa indeksy", () => {
    expect(ddl012(sqlite).map((o) => `${o.type} ${o.name}`)).toEqual([
      "table product_absence_checks",
      "table product_auto_suspensions",
      "table staging_absence_decisions",
      "index staging_absence_one_choice",
      "table staging_matches",
      "index staging_one_current_product",
      "table supplier_feed_state",
      "table supplier_feed_versions",
    ]);
  });

  /**
   * ⭐ Dowód „bajt w bajt z produkcją". Porównujemy z bazą zbudowaną ze zrzutu 88fa31c, a nie
   * z przepisanym do testu tekstem — przepisany tekst mógłby zawierać tę samą literówkę.
   */
  it("DDL jest ZNAK W ZNAK taki jak w zrzucie produkcji `88fa31c:db/schema.sql`", () => {
    const { sqlite: produkcja } = otworzBaze(join(katalog, "prod.db"));
    try {
      zbudujZeZrzutu(produkcja, SCHEMAT_88FA31C);
      expect(ddl012(sqlite)).toEqual(ddl012(produkcja));
    } finally {
      produkcja.close();
    }
  });

  it("indeks `staging_one_current_product` egzekwuje jedno zgłoszenie na parę dostawca+kod", () => {
    const dodaj = (kod: string) =>
      sqlite
        .prepare(
          `INSERT INTO staging_items (typ_zmiany, kod, nazwa, dostawca, magazyn, utworzono)
           VALUES ('zmiana_kluczowa', ?, 'N', 'MO1', 'GL', '2026-09-23')`,
        )
        .run(kod);

    dodaj("K1");
    expect(() => dodaj("K1")).toThrow(/UNIQUE constraint failed/);
    expect(() => dodaj("K2")).not.toThrow();
  });

  /**
   * Indeks CZĘŚCIOWY: warunek `WHERE selected_source_code IS NOT NULL`. Wiele spraw zamkniętych
   * bez wyboru karty musi móc współistnieć u jednego dostawcy, ale jeden kod źródłowy nie może
   * być przypisany do dwóch kart naraz (backlog #106).
   */
  it("indeks `staging_absence_one_choice` blokuje powtórzony kod źródłowy, a NULL-e przepuszcza", () => {
    const dodaj = (kodProduktu: string, wybrany: string | null) =>
      sqlite
        .prepare(
          `INSERT INTO staging_absence_decisions
             (supplier, product_code, candidates_hash, decided_at, selected_source_code)
           VALUES ('MO1', ?, 'h', '2026-09-23', ?)`,
        )
        .run(kodProduktu, wybrany);

    dodaj("P1", null);
    expect(() => dodaj("P2", null)).not.toThrow();
    dodaj("P3", "SRC-1");
    expect(() => dodaj("P4", "SRC-1")).toThrow(/UNIQUE constraint failed/);
    expect(() => dodaj("P5", "SRC-2")).not.toThrow();
  });

  it("ponowne wykonanie TREŚCI pliku 012 nie rzuca i niczego nie zmienia", () => {
    const przed = obiekty(sqlite);
    expect(() => sqlite.exec(readFileSync(PLIK_012, "utf8"))).not.toThrow();
    expect(obiekty(sqlite)).toEqual(przed);
  });
});

describe("012 na bazie SYMULUJĄCEJ PRODUKCJĘ (zrzut 88fa31c — wszystko już istnieje)", () => {
  /** Dane w sześciu tabelach, żeby było widać, że migracja ich nie rusza. */
  const zasiej = (db: BazaSqlite): void => {
    db.prepare(`INSERT INTO staging_matches VALUES ('MO1','src-1','K1','2026-09-22T10:00:00.000Z')`).run();
    db.prepare(`INSERT INTO supplier_feed_state VALUES ('MO1','hash-1',500,900,'2026-09-22T10:00:00.000Z','2026-09-22T10:00:00.000Z')`).run();
    db.prepare(`INSERT INTO supplier_feed_versions VALUES ('MO1','odcisk-1','2026-09-22T10:00:00.000Z')`).run();
    db.prepare(`INSERT INTO product_absence_checks VALUES ('MO1','K1','[{"at":"2026-09-22"}]')`).run();
    db.prepare(`INSERT INTO product_auto_suspensions VALUES ('MO1','K1','2026-09-22T10:00:00.000Z','odcisk-1','Brak w ofercie')`).run();
    db.prepare(`INSERT INTO staging_absence_decisions VALUES ('MO1','K1','hash-kandydatow','2026-09-23T10:00:00.000Z','SRC-1')`).run();
  };

  beforeEach(() => {
    zbudujZeZrzutu(sqlite, SCHEMAT_88FA31C);
    zasiej(sqlite);
  });

  it("cały łańcuch przechodzi, 012 jest odnotowana i wykonana z treścią", () => {
    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(wynik.zastosowane).toContain("012_staging_polityka.sql");
    // 012 nie ma dyrektywy pominięcia — treść WYKONUJE się, tylko nic nie zmienia.
    expect(wynik.bezTresci).not.toContain("012_staging_polityka.sql");
    expect(zastosujMigracje(sqlite, KATALOG_SCHEMATU()).zastosowane).toEqual([]);
  });

  it("⭐ CUTOVER: żaden z ośmiu obiektów 012 nie zmienia definicji", () => {
    const przed = ddl012(sqlite);
    expect(przed).toHaveLength(OBIEKTY_012.length);
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(ddl012(sqlite)).toEqual(przed);
  });

  it("dane w sześciu tabelach zostają nietknięte", () => {
    const zrzuc = () =>
      Object.fromEntries(
        ["staging_matches", "supplier_feed_state", "supplier_feed_versions", "product_absence_checks",
         "product_auto_suspensions", "staging_absence_decisions"].map((t) => [
          t,
          sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all(),
        ]),
      );
    const przed = zrzuc();
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(zrzuc()).toEqual(przed);
  });

  it("sprzątanie duplikatów jest tu NO-OPem — indeks unikalny stoi od 22.09", () => {
    sqlite
      .prepare(
        `INSERT INTO staging_items (typ_zmiany, kod, nazwa, dostawca, magazyn, utworzono)
         VALUES ('zmiana_kluczowa', 'K9', 'N', 'MO1', 'GL', '2026-09-23')`,
      )
      .run();
    const przed = sqlite.prepare("SELECT id, dostawca, kod FROM staging_items ORDER BY id").all();
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(sqlite.prepare("SELECT id, dostawca, kod FROM staging_items ORDER BY id").all()).toEqual(przed);
  });
});

/**
 * Trzecia baza GATE-u: kopia `db/snapshot.db` (plik nie jest w repo). Uruchomienie:
 *
 *   SNAPSHOT_DB=/ścieżka/do/db/snapshot.db npx vitest run test/db.migracja-012.test.ts
 *
 * ZMIERZONE na snapshocie z 13.08: 3362 wiersze `staging_items`, 238 duplikatów `(dostawca, kod)`.
 * W łańcuchu migracja 006 sprząta szum CASE_ONLY WCZEŚNIEJ (3362 → 2639, zostaje 137 duplikatów),
 * więc 012 usuwa realnie 137 wierszy (2639 → 2502). Liczby są tu policzone z bazy, a nie wpisane
 * na sztywno — snapshot można przenagrać i test ma wtedy nadal mierzyć to, co trzeba.
 */
describe.skipIf(!process.env.SNAPSHOT_DB)("012 na kopii `db/snapshot.db`", () => {
  let kopia: BazaSqlite;

  const licz = (db: BazaSqlite, sql: string) => (db.prepare(sql).get() as { c: number }).c;
  const wierszy = (db: BazaSqlite) => licz(db, "SELECT count(*) c FROM staging_items");
  const grup = (db: BazaSqlite) =>
    licz(db, "SELECT count(*) c FROM (SELECT 1 FROM staging_items GROUP BY dostawca, kod)");

  beforeEach(() => {
    const sciezka = join(katalog, "snapshot-kopia.db");
    copyFileSync(process.env.SNAPSHOT_DB!, sciezka);
    ({ sqlite: kopia } = otworzBaze(sciezka));
  });
  afterEach(() => kopia.close());

  it("snapshot faktycznie MA duplikaty — inaczej test niczego nie dowodzi", () => {
    expect(wierszy(kopia) - grup(kopia)).toBeGreaterThan(0);
  });

  it("po migracjach duplikatów nie ma, a zostaje dokładnie jeden wiersz na parę", () => {
    zastosujMigracje(kopia, KATALOG_SCHEMATU());
    expect(wierszy(kopia)).toBe(grup(kopia));
  });

  /**
   * Reguła D5: zostaje wiersz o NAJWIĘKSZYM `id`, czyli najnowsze zgłoszenie pary.
   *
   * ⚠ Zwycięzców trzeba policzyć PO migracji 006, nie na surowym snapshocie. 006 kasuje szum
   * CASE_ONLY wcześniej w łańcuchu i potrafi skasować właśnie ten wiersz, który na surowym
   * snapshocie miał `MAX(id)` — wtedy 012 zostawia kolejny co do wielkości. Dlatego bazę
   * przepuszczamy najpierw przez łańcuch BEZ 012 (kopia katalogu migracji), odczytujemy
   * oczekiwanych zwycięzców i dopiero potem dokładamy 012.
   */
  it("ocalały wiersz to ten o MAX(id) w swojej grupie (liczone po 006)", () => {
    const bez012 = join(katalog, "schema-bez-012");
    mkdirSync(bez012);
    for (const plik of readdirSync(KATALOG_SCHEMATU())) {
      if (plik.endsWith(".sql") && !plik.startsWith("012")) {
        copyFileSync(join(KATALOG_SCHEMATU(), plik), join(bez012, plik));
      }
    }

    zastosujMigracje(kopia, bez012);
    expect(wierszy(kopia) - grup(kopia), "po 006 muszą ZOSTAĆ duplikaty, inaczej 012 nic nie robi")
      .toBeGreaterThan(0);
    const oczekiwane = kopia
      .prepare("SELECT MAX(id) AS id FROM staging_items GROUP BY dostawca, kod ORDER BY id")
      .all();

    copyFileSync(PLIK_012, join(bez012, "012_staging_polityka.sql"));
    expect(zastosujMigracje(kopia, bez012).zastosowane).toEqual(["012_staging_polityka.sql"]);

    expect(kopia.prepare("SELECT id FROM staging_items ORDER BY id").all()).toEqual(oczekiwane);
  });

  it("indeks unikalny powstaje i jest egzekwowany", () => {
    zastosujMigracje(kopia, KATALOG_SCHEMATU());
    const istniejacy = kopia.prepare("SELECT dostawca, kod FROM staging_items LIMIT 1").get() as
      | { dostawca: string; kod: string }
      | undefined;
    expect(istniejacy, "snapshot ma mieć jakiekolwiek zgłoszenia").toBeDefined();
    expect(() =>
      kopia
        .prepare(
          `INSERT INTO staging_items (typ_zmiany, kod, nazwa, dostawca, magazyn, utworzono)
           VALUES ('zmiana_kluczowa', ?, 'N', ?, 'GL', '2026-09-23')`,
        )
        .run(istniejacy!.kod, istniejacy!.dostawca),
    ).toThrow(/UNIQUE constraint failed/);
  });
});
