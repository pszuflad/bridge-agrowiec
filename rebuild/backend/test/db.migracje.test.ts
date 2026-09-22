/** Migracje — `npm run migrate` musi być idempotentne (kontrakt deployu). */
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("zastosujMigracje", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let sciezka: string;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-migracje-"));
    sciezka = join(katalog, "test.db");
    ({ sqlite } = otworzBaze(sciezka));
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const policzTabele = (db: BazaSqlite): number =>
    (
      db
        .prepare(
          `SELECT count(*) AS c FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_migracje'`,
        )
        .get() as { c: number }
    ).c;

  /**
   * Kolejność ma znaczenie — migracje stosowane są alfabetycznie i 002 zakłada, że
   * tabele z 001 już istnieją. Lista jest tu jawna, żeby dołożenie pliku do
   * `rebuild/schema/` było świadomą zmianą testu, a nie cichym rozszerzeniem.
   */
  const MIGRACJE = [
    "001_schema.sql",
    "002_import.sql",
    "003_szerokosc_text.sql",
    "004_kategoria_wielka_litera.sql",
    "005_konstrukcja_slowa.sql",
    "006_nazwa_caps.sql",
    "007_waga_gab_przewoznicy.sql",
    "008_alerty_katalogu_statusy.sql",
    "009_alerty_polskie_znaki.sql",
    "010_marka_caps.sql",
  ];

  it("stosuje wszystkie migracje po kolei: 28 tabel i 14 indeksów", () => {
    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(wynik.zastosowane).toEqual(MIGRACJE);
    // 002 dokłada wyłącznie KOLUMNY (plan.md D5/D9), a 003 PRZEBUDOWUJE `products`
    // (SQLite nie ma ALTER COLUMN) i odtwarza jej indeks — bilans tabel i indeksów bez zmian.
    // 007 dokłada tabelę `waga_gab_przewoznicy` (ticket 76) — spoza kanonu produkcji, bez indeksu.
    // 008 (P6.2) dokłada jedną tabelę z jednym indeksem — statusy pseudo-alertów katalogowych.
    // 009 (PR.3) to wyłącznie migracja danych `alerts` — bilans bez zmian.
    // 010 (PR.5) to migracja danych `products.marka` + słownika marek — bilans bez zmian.
    expect(policzTabele(sqlite)).toBe(28);

    const indeksy = (
      sqlite
        .prepare(
          `SELECT count(*) AS c FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`,
        )
        .get() as { c: number }
    ).c;
    expect(indeksy).toBe(14);
  });

  it("baza działa w trybie WAL (jak produkcja)", () => {
    expect(String(sqlite.pragma("journal_mode", { simple: true }))).toBe("wal");
  });

  it("drugie uruchomienie nic nie stosuje i nie rusza danych", () => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    sqlite
      .prepare(
        `INSERT INTO users (email, haslo_hash, imie_nazwisko, utworzono) VALUES (?, ?, ?, ?)`,
      )
      .run("a@b.test", "$2b$10$hash", "Ktoś Tam", new Date().toISOString());

    const wynik = zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(wynik.zastosowane).toEqual([]);
    expect(wynik.pominiete).toEqual(MIGRACJE);

    const liczba = (sqlite.prepare(`SELECT count(*) AS c FROM users`).get() as { c: number }).c;
    expect(liczba).toBe(1);
    expect(policzTabele(sqlite)).toBe(28);
  });

  /**
   * STRAŻNIK MIGRACJI 003. SQLite nie ma `ALTER TABLE … ALTER COLUMN`, więc zmiana typu
   * `products.szerokosc` wymagała PRZEPISANIA CAŁEJ TABELI — a to jedyne miejsce w repo,
   * gdzie 73 kolumny `products` istnieją w drugiej kopii. Kopia może się rozjechać z kanonem
   * po cichu (ktoś doda kolumnę do `001`, zapomni o `003`), a wtedy `INSERT … SELECT *`
   * przepisze dane do złych kolumn albo migracja padnie dopiero na produkcji.
   *
   * Dlatego porównujemy kolumny ŻYWEJ tabeli z kanonem i dopuszczamy DOKŁADNIE dwie różnice:
   * `szerokosc` REAL→TEXT (ta migracja) i doklejoną `uwaga_cena` (migracja 002).
   */
  it("003 nie rozjeżdża `products` z kanonem — zmienia wyłącznie typ `szerokosc`", () => {
    const ddlKanonu = readFileSync(join(KATALOG_SCHEMATU(), "001_schema.sql"), "utf8");
    const blok = /CREATE TABLE IF NOT EXISTS products \(([\s\S]*?)\);/.exec(ddlKanonu);
    expect(blok, "nie znaleziono definicji products w 001_schema.sql").not.toBeNull();

    // Kanon ma kolumny doklejone historycznie ALTER-em w jednej linii po przecinkach —
    // rozbijamy po przecinkach na najwyższym poziomie i bierzemy nazwę oraz typ.
    const kanon = blok![1]!
      .split(/,\s*(?![^(]*\))/)
      .map((f) => f.trim().replace(/\s+/g, " "))
      .filter((f) => f.length > 0 && !/^(PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT)\b/i.test(f))
      .map((f) => {
        const [nazwa, typ] = f.split(" ");
        return { nazwa: nazwa!, typ: typ! };
      });

    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const zywe = (
      sqlite.prepare(`PRAGMA table_info(products)`).all() as { name: string; type: string }[]
    ).map((k) => ({ nazwa: k.name, typ: k.type }));

    const oczekiwane = [
      ...kanon.map((k) => (k.nazwa === "szerokosc" ? { nazwa: "szerokosc", typ: "TEXT" } : k)),
      { nazwa: "uwaga_cena", typ: "TEXT" },
    ];

    expect(zywe).toEqual(oczekiwane);
  });

  it("tabela users ma kolumny zgodne z kanonem", () => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const kolumny = (sqlite.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map(
      (k) => k.name,
    );
    expect(kolumny).toEqual([
      "id",
      "email",
      "haslo_hash",
      "imie_nazwisko",
      "utworzono",
      "ostatnie_logowanie",
    ]);
  });
});

/**
 * MIGRACJE DANYCH KONWENCJI (Iteracja 13c) — `004` kategoria, `005` konstrukcja, `006` CAPS.
 *
 * Te trzy pliki różnią się od `001`–`003` tym, że ruszają WARTOŚCI, nie strukturę. Testu nie da
 * się więc oprzeć na `zastosujMigracje()` w zwykłym trybie: runner stosuje plik na świeżej,
 * PUSTEJ bazie, więc każdy `UPDATE` trafia w zero wierszy i niczego nie dowodzi.
 *
 * Dlatego tutaj: stawiamy bazę migracjami → wsypujemy wiersze w stanie „przed" → wykonujemy
 * SQL migracji RĘCZNIE, z pominięciem ewidencji `_migracje` → sprawdzamy stan „po" → wykonujemy
 * ten sam SQL DRUGI RAZ i żądamy zera zmienionych wierszy.
 *
 * ⭐ DLACZEGO IDEMPOTENCJA TREŚCIOWA JEST TU JEDYNYM SENSOWNYM TESTEM. Ewidencja `_migracje`
 * i tak nie pozwoli runnerowi puścić pliku dwa razy — testowanie „drugi przebieg runnera nic
 * nie robi" sprawdzałoby runner, nie migrację. Realne ryzyko jest inne: cutover jest big-bang
 * na TEJ SAMEJ `data.db`, którą Ania JUŻ zmigrowała (`docs/cutover.md` — „nie migrujemy
 * danych"), więc nasz PIERWSZY przebieg trafia na dane już w formie docelowej. Migracja, która
 * by się na tym wywróciła albo podwójnie przemapowała, zepsułaby produkcję przy pierwszym
 * uruchomieniu. Powtórzenie SQL-a na własnym wyniku odtwarza dokładnie ten scenariusz.
 */
describe("migracje danych — konwencje 13c", () => {
  let katalog: string;
  let sqlite: BazaSqlite;

  const MIGRACJE_DANYCH = [
    "004_kategoria_wielka_litera.sql",
    "005_konstrukcja_slowa.sql",
    "006_nazwa_caps.sql",
  ];

  /** Wykonuje pliki migracji poza ewidencją `_migracje` i zwraca liczbę zmienionych wierszy. */
  const wykonajMigracjeDanych = (): number => {
    const przed = (sqlite.prepare("SELECT total_changes() AS c").get() as { c: number }).c;
    for (const plik of MIGRACJE_DANYCH) {
      sqlite.exec(readFileSync(join(KATALOG_SCHEMATU(), plik), "utf8"));
    }
    return (sqlite.prepare("SELECT total_changes() AS c").get() as { c: number }).c - przed;
  };

  const dodajProdukt = (kod: string, pola: { nazwa: string; kategoria: string; konstrukcja: string | null }) =>
    sqlite
      .prepare(
        `INSERT INTO products
           (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy,
            marza_pct, data_aktualizacji, konstrukcja)
         VALUES (?, ?, 'BKT', ?, 'MO1', 'GL', 1, 100.0, 130.0, 30.0, '2026-09-09', ?)`,
      )
      .run(kod, pola.nazwa, pola.kategoria, pola.konstrukcja);

  const dodajStaging = (powod: string, typZmiany = "zmiana_kluczowa") =>
    sqlite
      .prepare(
        `INSERT INTO staging_items (typ_zmiany, kod, nazwa, dostawca, magazyn, powod, utworzono)
         VALUES (?, 'K1', 'N', 'MO1', 'GL', ?, '2026-09-09')`,
      )
      .run(typZmiany, powod).lastInsertRowid;

  const wartosc = (sql: string, ...param: unknown[]): unknown =>
    (sqlite.prepare(sql).get(...(param as never[])) as Record<string, unknown> | undefined)?.["w"];

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-migracje-dane-"));
    ({ sqlite } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("004 — kategoria z małej litery dostaje formę kanoniczną, reszta zostaje nietknięta", () => {
    dodajProdukt("A1", { nazwa: "X", kategoria: "rolnicze", konstrukcja: null });
    dodajProdukt("A2", { nazwa: "X", kategoria: "ciezarowe", konstrukcja: null }); // bez pl-znaków
    dodajProdukt("A3", { nazwa: "X", kategoria: "leśne", konstrukcja: null });
    dodajProdukt("A4", { nazwa: "X", kategoria: "rolnicze małe", konstrukcja: null });
    dodajProdukt("A5", { nazwa: "X", kategoria: "Przemysłowe", konstrukcja: null }); // już OK
    // Poza obiema mapami produkcji — `apply_kategoria.cjs` loguje takie jako `unmapped`
    // i pomija, `capitalizeKategoria()` przepuszcza przez `MAP[key] || value`.
    dodajProdukt("A6", { nazwa: "X", kategoria: "Przyczepy", konstrukcja: null });

    wykonajMigracjeDanych();

    const kat = (kod: string) => wartosc("SELECT kategoria AS w FROM products WHERE kod = ?", kod);
    expect(kat("A1")).toBe("Rolnicze");
    expect(kat("A2")).toBe("Ciężarowe");
    expect(kat("A3")).toBe("Leśne");
    expect(kat("A4")).toBe("Rolnicze małe");
    expect(kat("A5")).toBe("Przemysłowe");
    expect(kat("A6")).toBe("Przyczepy");
  });

  it("005 — kody konstrukcji stają się słowami, wartości spoza mapy zostają", () => {
    dodajProdukt("B1", { nazwa: "X", kategoria: "Rolnicze", konstrukcja: "R" });
    dodajProdukt("B2", { nazwa: "X", kategoria: "Rolnicze", konstrukcja: "D" });
    dodajProdukt("B3", { nazwa: "X", kategoria: "Rolnicze", konstrukcja: "L" });
    dodajProdukt("B4", { nazwa: "X", kategoria: "Rolnicze", konstrukcja: "B" });
    dodajProdukt("B5", { nazwa: "X", kategoria: "Rolnicze", konstrukcja: "-" });
    dodajProdukt("B6", { nazwa: "X", kategoria: "Rolnicze", konstrukcja: "Radialna" }); // już OK
    // `X` i NULL nie są w `KONSTRUKCJA_CANONICAL_MAP` — pomiar na `db/snapshot.db` pokazuje
    // po jednym `X` i 12 NULL-i; produkcja ich też nie ruszyła (`MAP[key] || value`).
    dodajProdukt("B7", { nazwa: "X", kategoria: "Rolnicze", konstrukcja: "X" });
    dodajProdukt("B8", { nazwa: "X", kategoria: "Rolnicze", konstrukcja: null });

    wykonajMigracjeDanych();

    const kon = (kod: string) =>
      wartosc("SELECT konstrukcja AS w FROM products WHERE kod = ?", kod);
    expect(kon("B1")).toBe("Radialna");
    expect(kon("B2")).toBe("Diagonalna");
    expect(kon("B3")).toBe("Diagonalna");
    expect(kon("B4")).toBe("Diagonalna");
    expect(kon("B5")).toBe("Diagonalna");
    expect(kon("B6")).toBe("Radialna");
    expect(kon("B7")).toBe("X");
    expect(kon("B8")).toBeNull();
  });

  it("006 — nazwa i override `nazwa` idą na WIELKIE, inne pola override bez zmian", () => {
    dodajProdukt("C1", { nazwa: "540/65R30 Kleber GRIPKER 143D TL", kategoria: "Rolnicze", konstrukcja: "R" });
    const dodajOverride = (pole: string, wart: string) =>
      sqlite
        .prepare(
          `INSERT INTO manual_overrides
             (supplier_kod, supplier_product_id, field_name, override_value, created_at)
           VALUES ('MO1', ?, ?, ?, '2026-09-09')`,
        )
        .run(`${pole}-1`, pole, wart);
    dodajOverride("nazwa", "Kleber GRIPKER");
    dodajOverride("model", "Gripker"); // inne pole — produkcja go nie ruszyła
    dodajOverride("konstrukcja", "D"); // patrz plan.md D7 — świadomie poza zakresem

    wykonajMigracjeDanych();

    expect(wartosc("SELECT nazwa AS w FROM products WHERE kod = 'C1'")).toBe(
      "540/65R30 KLEBER GRIPKER 143D TL",
    );
    const ov = (pole: string) =>
      wartosc("SELECT override_value AS w FROM manual_overrides WHERE field_name = ?", pole);
    expect(ov("nazwa")).toBe("KLEBER GRIPKER");
    expect(ov("model")).toBe("Gripker");
    expect(ov("konstrukcja")).toBe("D");
  });

  /**
   * ⚠ ASCII-ONLY `UPPER()`. Produkcja użyła dosłownie `UPPER(nazwa)` w SQLite, a ten nie zna
   * polskich diakrytyków. Test przybija ten fakt, żeby nikt „nie poprawił" migracji na wariant
   * locale-owy: byłoby to odstępstwo od produkcji, a nie naprawa.
   */
  it("006 — `UPPER()` zostawia polskie diakrytyki małe, dokładnie jak produkcja", () => {
    dodajProdukt("D1", { nazwa: "315/80R22.5 Dunlop SP362 prowadząca 156K TL", kategoria: "Ciężarowe", konstrukcja: "R" });

    wykonajMigracjeDanych();

    expect(wartosc("SELECT nazwa AS w FROM products WHERE kod = 'D1'")).toBe(
      "315/80R22.5 DUNLOP SP362 PROWADZąCA 156K TL",
    );
  });

  /**
   * CASE_ONLY — reguła „KAŻDY segment `powod` jest różnicą wyłącznie w wielkości liter".
   *
   * `powod` jest wielosegmentowy (`tk.ts:515` skleja przez ` • ` i dokleja `ostrzezenie`),
   * więc naiwne „wszystko po pierwszej strzałce = nowa wartość" kasowałoby wiersze niosące
   * realną zmianę. Pomiar na `db/snapshot.db`: 193 z 1441 wierszy `nazwa:%` ma >1 strzałkę.
   */
  it("006 — kasuje szum CASE_ONLY, zostawia wiersze z realną różnicą", () => {
    const jednosegmentowy = dodajStaging(
      "nazwa: 540/65R30 Kleber GRIPKER 143D TL → 540/65R30 KLEBER GRIPKER 143D TL",
    );
    const wielosegmentowy = dodajStaging(
      "nazwa: 6.50-16 Alliance FARM PRO 6PR TT → 6.50-16 ALLIANCE FARM PRO 6PR TT" +
        " • marka: Alliance → ALLIANCE",
    );
    const realnaZmianaWDrugimPolu = dodajStaging(
      "nazwa: 295/60R22.5 GOODYEAR FUELMAX DEMO 150K TL → 295/60R22.5 GOODYEAR FUELMAX 150K TL" +
        " • model: FUELMAX DEMO → FUELMAX",
    );
    const zOstrzezeniem = dodajStaging(
      "nazwa: 540/65R30 Kleber GRIPKER 143D TL → 540/65R30 KLEBER GRIPKER 143D TL" +
        " • Cena zakupu spadła o 42%",
    );
    // Warunek wejścia jest za produkcją: `powod LIKE 'nazwa:%'`. Wiersz case-only, ale
    // zaczynający się od innego pola, zostaje nietknięty.
    const innePoleNaPoczatku = dodajStaging("marka: Alliance → ALLIANCE");
    // Inny typ zmiany — poza zakresem `DELETE`.
    const innyTyp = dodajStaging(
      "nazwa: 540/65R30 Kleber GRIPKER → 540/65R30 KLEBER GRIPKER",
      "nowa",
    );

    wykonajMigracjeDanych();

    const zyje = (id: unknown) =>
      (sqlite.prepare("SELECT count(*) AS c FROM staging_items WHERE id = ?").get(id) as {
        c: number;
      }).c === 1;

    expect(zyje(jednosegmentowy), "case-only jednosegmentowy ma zniknąć").toBe(false);
    expect(zyje(wielosegmentowy), "case-only we wszystkich segmentach ma zniknąć").toBe(false);
    expect(zyje(realnaZmianaWDrugimPolu), "realna zmiana w `model` musi zostać").toBe(true);
    expect(zyje(zOstrzezeniem), "segment `ostrzezenie` bez strzałki blokuje kasowanie").toBe(true);
    expect(zyje(innePoleNaPoczatku), "powod spoza `nazwa:%` musi zostać").toBe(true);
    expect(zyje(innyTyp), "inny `typ_zmiany` musi zostać").toBe(true);
  });

  /**
   * ⚠ RESZTKA DIAKRYTYCZNA — 16 wierszy na `db/snapshot.db`, których `DELETE` NIE zabiera.
   *
   * `UPPER()` SQLite jest ASCII-only nie tylko w `UPDATE … nazwa=UPPER(nazwa)`, ale RÓWNIEŻ
   * w predykacie CASE_ONLY. Dla „prowadząca" vs „PROWADZĄCA" zostawia małe `ą` po jednej
   * stronie i duże `Ą` po drugiej, więc wiersz nie jest uznany za case-only i ZOSTAJE.
   *
   * ⭐ TO JEST ZACHOWANIE ZAMIERZONE I SPÓJNE, nie przeoczenie. Skoro `UPPER(nazwa)` zostawia
   * w bazie „PROWADZąCA", to plik dostawcy z „PROWADZĄCA" NADAL się od niej różni — wiersz
   * `zmiana_kluczowa` jest tam zasadny. Produkcja użyła tego samego SQLite-owego `UPPER()`,
   * więc ma tę samą resztkę. Ten test istnieje po to, żeby przestawienie predykatu na
   * porównanie Unicode-aware (skasowałoby wiersze, których produkcja nie skasowała) zapaliło
   * czerwone, zamiast przejść jako „poprawka".
   */
  it("006 — case-only na polskim diakrytyku NIE jest kasowany (ASCII-only `UPPER`, jak produkcja)", () => {
    const zDiakrytykiem = dodajStaging(
      "nazwa: 315/80R22.5 Dunlop SP362 prowadząca 156K TL" +
        " → 315/80R22.5 DUNLOP SP362 PROWADZĄCA 156K TL",
    );
    const bezDiakrytyku = dodajStaging(
      "nazwa: 540/65R30 Kleber GRIPKER 143D TL → 540/65R30 KLEBER GRIPKER 143D TL",
    );

    wykonajMigracjeDanych();

    const zyje = (id: unknown) =>
      (sqlite.prepare("SELECT count(*) AS c FROM staging_items WHERE id = ?").get(id) as {
        c: number;
      }).c === 1;

    expect(zyje(zDiakrytykiem), "różnica na `ą`/`Ą` jest poza zasięgiem ASCII-only `UPPER`").toBe(
      true,
    );
    expect(zyje(bezDiakrytyku), "czysto ASCII-owy case-only ma zniknąć").toBe(false);
  });

  /**
   * ⭐ TEN TEST JEST POWODEM, DLA KTÓREGO MIGRACJE MAJĄ WARUNEK „pomiń wiersz w formie
   * docelowej". Odtwarza scenariusz cutoveru: dane są już zmigrowane, a migracja rusza
   * pierwszy raz.
   */
  it("004/005/006 są idempotentne treściowo — drugie wykonanie nie rusza ani jednego wiersza", () => {
    dodajProdukt("E1", { nazwa: "540/65R30 Kleber GRIPKER 143D TL", kategoria: "rolnicze", konstrukcja: "R" });
    dodajProdukt("E2", { nazwa: "11.2-24 Mitas TD-03 8PR TT", kategoria: "ciezarowe", konstrukcja: "L" });
    dodajProdukt("E3", { nazwa: "JUŻ WIELKIE", kategoria: "Leśne", konstrukcja: "Diagonalna" });
    sqlite
      .prepare(
        `INSERT INTO manual_overrides
           (supplier_kod, supplier_product_id, field_name, override_value, created_at)
         VALUES ('MO1', 'P1', 'nazwa', 'Kleber GRIPKER', '2026-09-09')`,
      )
      .run();
    dodajStaging("nazwa: 540/65R30 Kleber GRIPKER → 540/65R30 KLEBER GRIPKER");
    dodajStaging("nazwa: 6.50-16 BKT TF 8181 → 6.50x16 BKT TF 8181"); // realna różnica

    const pierwszy = wykonajMigracjeDanych();
    expect(pierwszy, "pierwszy przebieg musi cokolwiek zmienić, inaczej test nic nie mierzy")
      .toBeGreaterThan(0);

    const stanPo = sqlite.prepare("SELECT kod, nazwa, kategoria, konstrukcja FROM products ORDER BY kod").all();
    const stagingPo = sqlite.prepare("SELECT id, powod FROM staging_items ORDER BY id").all();

    const drugi = wykonajMigracjeDanych();

    expect(drugi, "drugie wykonanie tego samego SQL-a musi być no-opem").toBe(0);
    expect(sqlite.prepare("SELECT kod, nazwa, kategoria, konstrukcja FROM products ORDER BY kod").all()).toEqual(stanPo);
    expect(sqlite.prepare("SELECT id, powod FROM staging_items ORDER BY id").all()).toEqual(stagingPo);
  });
});

/**
 * MIGRACJA DANYCH `009` (karta PR.3, ticket 92) — polskie litery zamienione na „?" w alertach.
 *
 * Ten sam układ co blok 13c wyżej: baza z migracji → wiersze „przed" → SQL pliku wykonany ręcznie
 * poza ewidencją → stan „po" → ten sam SQL drugi raz musi dać 0 zmian (cutover trafia na
 * `data.db`, którą produkcja do ostatniego dnia zasila zepsutymi literałami).
 */
describe("migracja danych 009 — polskie znaki w alertach", () => {
  const PLIK = "009_alerty_polskie_znaki.sql";
  let katalog: string;
  let sqlite: BazaSqlite;

  /** Wykonuje 009 poza ewidencją `_migracje` i zwraca liczbę zmienionych wierszy (wszystkie tabele). */
  const wykonaj009 = (db: BazaSqlite): number => {
    const przed = (db.prepare("SELECT total_changes() AS c").get() as { c: number }).c;
    db.exec(readFileSync(join(KATALOG_SCHEMATU(), PLIK), "utf8"));
    return (db.prepare("SELECT total_changes() AS c").get() as { c: number }).c - przed;
  };

  const dodajAlert = (typ: string, opis: string, poziom = "info", status = "rozwiazany") =>
    Number(
      sqlite
        .prepare(
          `INSERT INTO alerts (poziom, typ, opis, dostawca, status, data)
           VALUES (?, ?, ?, 'MO4', ?, '2026-08-13T10:00:00.000Z')`,
        )
        .run(poziom, typ, opis, status).lastInsertRowid,
    );

  const alert = (id: number) =>
    sqlite.prepare("SELECT poziom, typ, opis, dostawca, status, data FROM alerts WHERE id = ?").get(id) as
      Record<string, string>;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-migracje-009-"));
    ({ sqlite } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("naprawia typ i fragmenty szablonu w opisie; nazwa dostawcy i pliku zostają", () => {
    // Treści 1:1 z kształtów w `db/snapshot.db` (literały oryginału `:48060, :48091, :48103, :48270`).
    const pobieranie = dodajAlert("B??d pobierania", "MO3 (Grasdorf (kolarolnicze.pl)): fetch failed", "ostrzezenie", "nowy");
    const http = dodajAlert("B??d HTTP", "MO4 (Handlopex Wrocław): HTTP 404", "ostrzezenie", "nowy");
    const sync = dodajAlert(
      "Synchronizacja",
      "MO4 (Handlopex Wrocław): pobrano 344 produkt?w (nowe: 5, kluczowe/b??dy: 201, wycofane: 59, auto: 0)",
    );
    const upload = dodajAlert(
      "R?czny upload",
      "MO6: wgrano BOH_PL_NPL (2).csv (1520 produkt?w, nowe: 3, kluczowe/bledy: 40, wycofane: 0, auto: 1)",
    );

    expect(wykonaj009(sqlite)).toBe(
      3 /* typ */ + 2 /* opis: sync + upload */,
    );

    expect(alert(pobieranie)).toMatchObject({
      typ: "Błąd pobierania",
      opis: "MO3 (Grasdorf (kolarolnicze.pl)): fetch failed",
      poziom: "ostrzezenie",
      status: "nowy",
    });
    expect(alert(http)).toMatchObject({ typ: "Błąd HTTP", opis: "MO4 (Handlopex Wrocław): HTTP 404" });
    expect(alert(sync).opis).toBe(
      "MO4 (Handlopex Wrocław): pobrano 344 produktów (nowe: 5, kluczowe/błędy: 201, wycofane: 59, auto: 0)",
    );
    // `kluczowe/bledy` bez ogonków to oryginał (`:48270`) i odbudowa (`routes/suppliers.ts`) — zostaje.
    expect(alert(upload)).toMatchObject({
      typ: "Ręczny upload",
      opis: "MO6: wgrano BOH_PL_NPL (2).csv (1520 produktów, nowe: 3, kluczowe/bledy: 40, wycofane: 0, auto: 1)",
    });
  });

  it("nie rusza wartości spoza słownika, legalnych „?” ani alertów już poprawnych", () => {
    const poprawne = dodajAlert(
      "Synchronizacja",
      "MO2 (JMK): pobrano 1605 produktów (nowe: 20, kluczowe/błędy: 315, wycofane: 30, auto: 3)",
    );
    const poprawnyTyp = dodajAlert("Błąd pobierania", "MO5 (Handlopex Rzeszów): terminated", "ostrzezenie", "nowy");
    // Legalny „?" w treści (query string) przy typie, który 009 zna.
    const zapytanie = dodajAlert("B??d HTTP", "MO1 (X): HTTP 500 dla https://x.pl/cennik.csv?token=1", "ostrzezenie", "nowy");
    // Typ spoza słownika — bez dopasowania, więc nietknięty.
    const obcy = dodajAlert("Inny b??d", "produkt?w (nowe: 1)");
    // Fragment szablonu Synchronizacji w wierszu INNEGO typu — nietknięty (warunek po typie).
    const obcyTyp = dodajAlert("Eksport", "X: pobrano 1 produkt?w (nowe: 0, kluczowe/b??dy: 0, wycofane: 0, auto: 0)");
    const przed = [poprawne, poprawnyTyp, obcy, obcyTyp].map(alert);

    expect(wykonaj009(sqlite)).toBe(1); // wyłącznie typ „B??d HTTP"
    expect([poprawne, poprawnyTyp, obcy, obcyTyp].map(alert)).toEqual(przed);
    expect(alert(zapytanie)).toMatchObject({
      typ: "Błąd HTTP",
      opis: "MO1 (X): HTTP 500 dla https://x.pl/cennik.csv?token=1",
    });
  });

  /** Scenariusz cutoveru: produkcja już ma część danych naprawionych albo zmigrowanych. */
  it("jest idempotentna treściowo — drugie wykonanie nie rusza ani jednego wiersza", () => {
    dodajAlert("B??d pobierania", "MO3 (G): fetch failed", "ostrzezenie", "nowy");
    dodajAlert("R?czny upload", "MO6: wgrano a.csv (1 produkt?w, nowe: 0, kluczowe/bledy: 0, wycofane: 0, auto: 0)");
    dodajAlert("Synchronizacja", "MO2 (JMK): pobrano 1 produkt?w (nowe: 0, kluczowe/b??dy: 0, wycofane: 0, auto: 0)");

    expect(wykonaj009(sqlite), "pierwszy przebieg musi cokolwiek zmienić").toBeGreaterThan(0);
    const stanPo = sqlite.prepare("SELECT * FROM alerts ORDER BY id").all();

    expect(wykonaj009(sqlite), "drugie wykonanie tego samego SQL-a musi być no-opem").toBe(0);
    expect(sqlite.prepare("SELECT * FROM alerts ORDER BY id").all()).toEqual(stanPo);
  });

  /**
   * ⭐ POMIAR NA KOPII `db/snapshot.db` — liczby z karty PR.3. Snapshot nie jest w repo (`.gitignore`),
   * więc test rusza tylko z jawną ścieżką:
   *
   *   SNAPSHOT_DB=/ścieżka/do/db/snapshot.db npx vitest run test/db.migracje.test.ts
   *
   * Pracuje na KOPII w katalogu tymczasowym — oryginału nie otwiera. Na snapshocie nie puszczamy
   * runnera (to baza produkcji bez `_migracje`), tylko sam plik 009.
   */
  it.skipIf(!process.env.SNAPSHOT_DB)(
    "na kopii snapshotu: 435 typów i 2219 opisów naprawione, nic poza tym",
    () => {
      const kopia = join(katalog, "snapshot.db");
      copyFileSync(process.env.SNAPSHOT_DB!, kopia);
      const { sqlite: snap } = otworzBaze(kopia);
      try {
        const liczba = (sql: string) => (snap.prepare(sql).get() as { c: number }).c;
        const zepsuteTyp = "SELECT count(*) AS c FROM alerts WHERE instr(typ, '?') > 0";
        const zepsuteOpis =
          "SELECT count(*) AS c FROM alerts WHERE instr(opis, 'produkt?w') > 0 OR instr(opis, 'b??dy') > 0";
        expect(liczba(zepsuteTyp)).toBe(435);
        expect(liczba(zepsuteOpis)).toBe(2219);

        type Wiersz = { id: number; poziom: string; typ: string; opis: string; dostawca: string | null; status: string; data: string };
        const przed = snap.prepare("SELECT * FROM alerts ORDER BY id").all() as Wiersz[];

        // 435 typów + 2127 opisów Synchronizacji + 92 opisy Ręcznego uploadu. `total_changes()`
        // liczy zmiany we WSZYSTKICH tabelach — równość dowodzi, że poza `alerts` nic nie ruszono.
        expect(wykonaj009(snap)).toBe(435 + 2127 + 92);
        expect(liczba(zepsuteTyp)).toBe(0);
        expect(liczba(zepsuteOpis)).toBe(0);

        // Wiersz po wierszu: zmieniły się tylko `typ` (wg słownika) i fragmenty szablonu w `opis`.
        const slownikTypu: Record<string, string> = {
          "B??d pobierania": "Błąd pobierania",
          "R?czny upload": "Ręczny upload",
          "B??d HTTP": "Błąd HTTP",
        };
        const oczekiwane = przed.map((w) => ({
          ...w,
          typ: slownikTypu[w.typ] ?? w.typ,
          opis: w.opis
            .replace(" produkt?w (nowe: ", " produktów (nowe: ")
            .replace(", kluczowe/b??dy: ", ", kluczowe/błędy: ")
            .replace(" produkt?w, nowe: ", " produktów, nowe: "),
        }));
        expect(snap.prepare("SELECT * FROM alerts ORDER BY id").all()).toEqual(oczekiwane);

        expect(wykonaj009(snap), "drugie wykonanie na snapshocie musi być no-opem").toBe(0);
      } finally {
        snap.close();
      }
    },
  );
});

/**
 * MIGRACJA DANYCH `010` (karta PR.5, ticket 101) — duplikaty marki różniące się wyłącznie
 * wielkością liter (`ALLIANCE`/`Alliance`, backlog #92). Układ jak blok 009 wyżej.
 */
describe("migracja danych 010 — marka WIELKIMI przy duplikacie case-only", () => {
  const PLIK = "010_marka_caps.sql";
  let katalog: string;
  let sqlite: BazaSqlite;

  /** Wykonuje 010 poza ewidencją `_migracje` i zwraca liczbę zmienionych wierszy (wszystkie tabele). */
  const wykonaj010 = (db: BazaSqlite): number => {
    const przed = (db.prepare("SELECT total_changes() AS c").get() as { c: number }).c;
    db.exec(readFileSync(join(KATALOG_SCHEMATU(), PLIK), "utf8"));
    return (db.prepare("SELECT total_changes() AS c").get() as { c: number }).c - przed;
  };

  let licznik = 0;
  const dodajProdukt = (marka: string) =>
    sqlite
      .prepare(
        `INSERT INTO products
           (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy,
            marza_pct, data_aktualizacji)
         VALUES (?, 'N', ?, 'Rolnicze', 'MO1', 'GL', 1, 100.0, 130.0, 30.0, '2026-09-22')`,
      )
      .run(`K${++licznik}`, marka);

  const dodajDoSlownika = (wartosc: string, rodzaj = "marka") => {
    sqlite.prepare("INSERT OR IGNORE INTO atrybuty_rodzaje (value, label) VALUES (?, ?)").run(rodzaj, rodzaj);
    sqlite.prepare("INSERT INTO atrybuty_wartosci (rodzaj, wartosc) VALUES (?, ?)").run(rodzaj, wartosc);
  };

  const marki = () =>
    (sqlite.prepare("SELECT marka FROM products ORDER BY id").all() as { marka: string }[]).map((w) => w.marka);
  const slownik = (rodzaj = "marka") =>
    (
      sqlite
        .prepare("SELECT wartosc FROM atrybuty_wartosci WHERE rodzaj = ? ORDER BY wartosc")
        .all(rodzaj) as { wartosc: string }[]
    ).map((w) => w.wartosc);

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-migracje-010-"));
    ({ sqlite } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    licznik = 0;
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("forma różniąca się tylko wielkością liter przechodzi na WIELKIE; marki bez pary zostają", () => {
    dodajProdukt("ALLIANCE");
    dodajProdukt("Alliance");
    dodajProdukt("ALLIANCE");
    // Grupa bez formy WIELKIEJ też kończy jako WIELKIE.
    dodajProdukt("Bkt");
    dodajProdukt("bkt");
    // Bez pary — nietknięte, nawet pisane małymi (reguła celuje w duplikat, nie w konwencję).
    dodajProdukt("Mitas");
    dodajProdukt("21x7.00-15");

    expect(wykonaj010(sqlite)).toBe(3);
    expect(marki()).toEqual(["ALLIANCE", "ALLIANCE", "ALLIANCE", "BKT", "BKT", "Mitas", "21x7.00-15"]);
  });

  it("polskie litery: klucz zna `ąćęłńóśźż`, choć `UPPER()` SQLite jest ASCII-only", () => {
    dodajProdukt("STOMIL POZNAŃ");
    dodajProdukt("Stomil Poznań");
    // ASCII-owo WIELKIE, ale z małym `ń` — `UPPER()` sam by go nie ruszył.
    dodajProdukt("STOMIL POZNAń");
    // Bez pary — polska litera zostaje mała, wiersz nietknięty.
    dodajProdukt("Dębica");

    expect(wykonaj010(sqlite)).toBe(2);
    expect(marki()).toEqual(["STOMIL POZNAŃ", "STOMIL POZNAŃ", "STOMIL POZNAŃ", "Dębica"]);
  });

  it("ograniczenie: litera spoza ASCII i spoza polskiego alfabetu nie jest sprowadzana — para zostaje", () => {
    dodajProdukt("KLÉBER");
    dodajProdukt("Kléber");

    expect(wykonaj010(sqlite)).toBe(0);
    expect(marki()).toEqual(["KLÉBER", "Kléber"]);
  });

  it("słownik: forma niekanoniczna znika tylko obok kanonicznej, inne rodzaje nietknięte", () => {
    dodajProdukt("ALLIANCE");
    dodajProdukt("Alliance");
    dodajDoSlownika("ALLIANCE");
    dodajDoSlownika("Alliance");
    // Brak formy kanonicznej w słowniku — nie kasujemy (reguła nie dopisuje wartości).
    dodajDoSlownika("Trelleborg");
    // Inny rodzaj z parą case-only — poza zakresem 010.
    dodajDoSlownika("FLOTATION T422", "bieznik");
    dodajDoSlownika("Flotation T422", "bieznik");

    expect(wykonaj010(sqlite)).toBe(1 /* products */ + 1 /* słownik */);
    expect(slownik()).toEqual(["ALLIANCE", "Trelleborg"]);
    expect(slownik("bieznik")).toEqual(["FLOTATION T422", "Flotation T422"]);
  });

  /** Scenariusz cutoveru: produkcja do ostatniego dnia może mieć stan zmigrowany częściowo. */
  it("jest idempotentna treściowo — drugie wykonanie nie rusza ani jednego wiersza", () => {
    dodajProdukt("ALLIANCE");
    dodajProdukt("Alliance");
    dodajProdukt("Stomil Poznań");
    dodajProdukt("STOMIL POZNAŃ");
    dodajDoSlownika("ALLIANCE");
    dodajDoSlownika("Alliance");

    expect(wykonaj010(sqlite), "pierwszy przebieg musi cokolwiek zmienić").toBeGreaterThan(0);
    const stanPo = [marki(), slownik()];
    expect(wykonaj010(sqlite), "drugie wykonanie tego samego SQL-a musi być no-opem").toBe(0);
    expect([marki(), slownik()]).toEqual(stanPo);
  });

  /**
   * ⭐ POMIAR NA KOPII `db/snapshot.db` — liczby z karty PR.5:
   *
   *   SNAPSHOT_DB=/ścieżka/do/db/snapshot.db npx vitest run test/db.migracje.test.ts
   *
   * Na kopii puszczamy sam plik 010 (snapshot to baza produkcji bez `_migracje`).
   */
  it.skipIf(!process.env.SNAPSHOT_DB)(
    "na kopii snapshotu: 848 + 1 → 849 × `ALLIANCE`, słownik bez `Alliance`, nic poza tym",
    () => {
      const kopia = join(katalog, "snapshot.db");
      copyFileSync(process.env.SNAPSHOT_DB!, kopia);
      const { sqlite: snap } = otworzBaze(kopia);
      try {
        const liczba = (sql: string, ...p: unknown[]) =>
          (snap.prepare(sql).get(...(p as never[])) as { c: number }).c;
        const ileMarki = (m: string) => liczba("SELECT count(*) AS c FROM products WHERE marka = ?", m);
        const wSlowniku = (m: string) =>
          liczba("SELECT count(*) AS c FROM atrybuty_wartosci WHERE rodzaj = 'marka' AND wartosc = ?", m);

        expect([ileMarki("ALLIANCE"), ileMarki("Alliance")]).toEqual([848, 1]);
        expect([wSlowniku("ALLIANCE"), wSlowniku("Alliance")]).toEqual([1, 1]);
        const przed = snap.prepare("SELECT * FROM products ORDER BY id").all() as { kod: string; marka: string }[];

        // `total_changes()` liczy zmiany we WSZYSTKICH tabelach: 1 produkt + 1 wpis słownika.
        expect(wykonaj010(snap)).toBe(2);
        expect([ileMarki("ALLIANCE"), ileMarki("Alliance")]).toEqual([849, 0]);
        expect([wSlowniku("ALLIANCE"), wSlowniku("Alliance")]).toEqual([1, 0]);

        // Wiersz po wierszu: zmieniła się wyłącznie marka MO1_71970103.
        const oczekiwane = przed.map((w) => (w.kod === "MO1_71970103" ? { ...w, marka: "ALLIANCE" } : w));
        expect(snap.prepare("SELECT * FROM products ORDER BY id").all()).toEqual(oczekiwane);

        // Kontrola narzędziem znającym Unicode: po migracji nie ma już żadnej pary case-only.
        const grupy = new Map<string, Set<string>>();
        for (const { marka } of snap.prepare("SELECT DISTINCT marka FROM products").all() as { marka: string }[]) {
          const k = marka.toLocaleUpperCase("pl-PL");
          grupy.set(k, (grupy.get(k) ?? new Set()).add(marka));
        }
        expect([...grupy.values()].filter((g) => g.size > 1)).toEqual([]);

        expect(wykonaj010(snap), "drugie wykonanie na snapshocie musi być no-opem").toBe(0);
      } finally {
        snap.close();
      }
    },
  );
});
