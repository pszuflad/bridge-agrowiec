/**
 * Seed danych katalogu dla GATE i testów Iteracji 2.
 *
 * Świadomie POZA `001_schema.sql`, który ma zostać czystym punktem zerowym
 * (rebuild/schema/README.md) — tak samo jak `zasiejUzytkownika` w `baza.ts`.
 *
 * Wartości dobrane tak, żeby porównanie z `contract/fixtures/GET_products.json`
 * faktycznie coś sprawdzało — w szczególności trzy pułapki typów:
 *
 *  1. `eanIsValid` musi wyjść jako LICZBA (1), bo kolumna nie jest w trybie boolean,
 *  2. `stubbleResistant`/`nro`/`cho`/`cfo`/`ms`/`snow3pmsf`/… muszą wyjść jako BOOLEAN,
 *     mimo że w SQLite leżą jako 0/1,
 *  3. `NULL` w kolumnie boolean musi zostać `null`, a nie zamienić się w `false`
 *     (`reinforced` w fixture jest nullem).
 */
import type { Baza, BazaSqlite } from "../../src/db/index.js";
import { historiaCen, products, stagingItems, suppliers } from "../../src/db/schema.js";
import { wczytajFixture } from "./fixtures.js";

export type NowyProdukt = typeof products.$inferInsert;
export type NowyDostawca = typeof suppliers.$inferInsert;

/**
 * Cztery produkty od trzech dostawców. Pierwszy jest odwzorowaniem pozycji z fixture
 * (`MO9_336320`) i pokrywa komplet typów; kolejne dokładają warianty brzegowe:
 * brak EAN-u, status `wstrzymany`, `stan = 0`, nulle w kolumnach boolean.
 */
export const PRODUKTY_TESTOWE: NowyProdukt[] = [
  {
    kod: "MO9_336320",
    nazwa: "620/70R42 BKT AGRIMAX FACTOR 166D/169A8 TL",
    marka: "BKT",
    kategoria: "Rolnicze",
    dostawca: "MO9",
    magazyn: "—",
    stan: 2,
    cenaZakupu: 5562.4,
    cenaSprzedazy: 7252,
    marzaPct: 6,
    vat: 23,
    ean: "8903094073627",
    eanRaw: "8903094073627",
    // LICZBA, nie boolean — kolumna świadomie poza trybem boolean (schema.ts, D5).
    eanIsValid: 1,
    eanSourceStatus: "ok",
    eanCandidates: '["8903094073627"]',
    status: "aktywny",
    dataAktualizacji: "2026-08-04T14:30:34.149Z",
    rozmiar: "620/70R42",
    szerokosc: 620,
    profil: 70,
    srednica: 42,
    konstrukcja: "R",
    indeksNosnosci: "166/169",
    indeksPredkosci: "D/A8",
    tlTt: "TL",
    bieznik: "AGRIMAX FACTOR",
    model: "AGRIMAX FACTOR",
    dot: "nie starsza niz 3 lata",
    kodDostawcy: "521560",
    // Kolumny boolean: false/true wchodzą jako 0/1, null zostaje nullem.
    reinforced: null,
    extraLoad: null,
    cutResistant: null,
    heatResistant: null,
    stubbleResistant: false,
    nro: false,
    cho: false,
    indeksy: "166D/169A8",
    indeks1: "166/169",
    indeks2: "D/A8",
    waga: 242,
    dlugosc: 194,
    szerokoscPaczki: 67,
    wysokosc: 194,
    wysokoscPrzesylki: 209,
    linkZdjecia: "https://agritires.eu/zdjecia-produktow/bkt/521561.jpg",
    ms: null,
    snow3pmsf: null,
    cfo: false,
    zastosowanie: "Ciągnik",
    kodImportu: "798368",
    nieobecnoscPodRzad: 0,
  },
  {
    kod: "MO9_336319",
    nazwa: "240/70R16 BKT RIDEMAX IT696 107A8/107B TL",
    marka: "BKT",
    kategoria: "Rolnicze",
    dostawca: "MO9",
    magazyn: "—",
    stan: 2,
    cenaZakupu: 560,
    cenaSprzedazy: 730,
    marzaPct: 6,
    vat: 23,
    ean: "8903094067503",
    eanRaw: "8903094067503",
    eanIsValid: 1,
    eanSourceStatus: "ok",
    eanCandidates: '["8903094067503"]',
    status: "aktywny",
    dataAktualizacji: "2026-08-04T14:30:34.147Z",
    rozmiar: "240/70R16",
    szerokosc: 240,
    profil: 70,
    srednica: 16,
    konstrukcja: "R",
    tlTt: "TL",
    bieznik: "RIDEMAX IT696",
    model: "RIDEMAX IT696",
    kodDostawcy: "521559",
    stubbleResistant: true,
    nro: true,
    cho: true,
    ms: true,
    snow3pmsf: true,
    cfo: true,
    reinforced: true,
    extraLoad: true,
    cutResistant: true,
    heatResistant: true,
    indeksy: "107A8/107B",
    waga: 22,
    zastosowanie: "Ciągnik",
    kodImportu: "798369",
    nieobecnoscPodRzad: 0,
  },
  {
    kod: "MO1_100001",
    nazwa: "11.2-24 MITAS TD-03 8PR TT",
    marka: "MITAS",
    kategoria: "Rolnicze",
    dostawca: "MO1",
    magazyn: "GL",
    stan: 0,
    cenaZakupu: 900,
    cenaSprzedazy: 1170,
    marzaPct: 6,
    vat: 23,
    // Brak EAN-u — pokrywa filtr `brak_ean` na froncie.
    ean: null,
    eanRaw: null,
    eanIsValid: null,
    status: "wstrzymany",
    dataAktualizacji: "2026-08-01T09:00:00.000Z",
    rozmiar: "11.2-24",
    szerokosc: 11.2,
    srednica: 24,
    konstrukcja: "-",
    tlTt: "TT",
    pr: "8",
    bieznik: "TD-03",
    model: "TD-03",
    kodDostawcy: "A100001",
    zastosowanie: "Ciągnik",
    kodImportu: "100001",
    nieobecnoscPodRzad: 1,
  },
  {
    kod: "MO2_200002",
    nazwa: "600/50-22.5 ALLIANCE 380 152A8/149B TL",
    marka: "ALLIANCE",
    kategoria: "Przyczepy",
    dostawca: "MO2",
    magazyn: "—",
    stan: 7,
    cenaZakupu: 2100,
    cenaSprzedazy: 2730,
    marzaPct: 6,
    vat: 23,
    ean: "8903094012345",
    eanRaw: "8903094012345",
    eanIsValid: 1,
    eanSourceStatus: "ok",
    status: "aktywny",
    dataAktualizacji: "2026-08-03T11:15:00.000Z",
    rozmiar: "600/50-22.5",
    szerokosc: 600,
    profil: 50,
    srednica: 22.5,
    konstrukcja: "-",
    tlTt: "TL",
    bieznik: "380",
    model: "380",
    kodDostawcy: "B200002",
    indeksy: "152A8/149B",
    indeks1: "152/149",
    indeks2: "A8/B",
    zastosowanie: "Forwarder",
    kodImportu: "235633",
    nieobecnoscPodRzad: 0,
  },
];

/**
 * Trzej dostawcy pokrywający gałęzie przeliczania statusu (repos/suppliers.ts):
 * świeży plik + produkty (`aktywny`), plik starszy niż 30 dni (`wstrzymany`),
 * brak pliku i zero produktów (`wstrzymany`).
 */
export const DOSTAWCY_TESTOWI: NowyDostawca[] = [
  {
    kod: "MO1",
    nazwa: "Bohnenkamp",
    email: "no-reply@bohnenkamp.pl",
    formatPliku: "csv",
    sposobDostarczania: "mail",
    url: "https://agroopony.eu/imports/bohnenkamp.csv",
    czestotliwoscMinuty: 10080,
    status: "aktywny",
    ostatniPlik: "2026-08-12T09:47:19.358Z",
    ostatniaSync: "2026-07-27T10:27:14.327Z",
    liczbaProduktow: 657,
    parser: "bohnenkamp",
    kodowanie: "ISO-8859-1",
    uwagi: "Plik wysyłany codziennie mailem; równolegle URL na agroopony.eu",
  },
  {
    kod: "MO2",
    nazwa: "JMK",
    email: "kontakt@jmk.pl",
    formatPliku: "xlsx",
    sposobDostarczania: "url",
    url: "https://agroopony.eu/imports/jmk.xlsx",
    czestotliwoscMinuty: null,
    status: "aktywny",
    // Plik starszy niż 30 dni względem `TERAZ_TESTOWE` → status ma wyjść „wstrzymany".
    ostatniPlik: "2026-06-01T08:00:00.000Z",
    ostatniaSync: "2026-06-01T08:00:00.000Z",
    liczbaProduktow: 12,
    parser: "jmk",
    kodowanie: "UTF-8",
    uwagi: null,
  },
  {
    kod: "MO9",
    nazwa: "Marso",
    email: "biuro@marso.hu",
    formatPliku: "csv",
    sposobDostarczania: "url",
    url: "https://agroopony.eu/imports/marso.csv",
    czestotliwoscMinuty: 1440,
    status: "aktywny",
    ostatniPlik: "2026-08-04T14:30:34.149Z",
    ostatniaSync: "2026-08-04T14:30:34.149Z",
    liczbaProduktow: 4210,
    parser: "marso",
    kodowanie: "UTF-8",
    uwagi: null,
  },
];

/** Chwila „teraz" ustawiona na sztywno, żeby przeliczanie statusu nie zależało od daty uruchomienia testu. */
export const TERAZ_TESTOWE = Date.parse("2026-08-13T12:00:00.000Z");

export function zasiejProdukty(db: Baza, dane: NowyProdukt[] = PRODUKTY_TESTOWE): void {
  db.insert(products).values(dane).run();
}

export function zasiejDostawcow(db: Baza, dane: NowyDostawca[] = DOSTAWCY_TESTOWI): void {
  db.insert(suppliers).values(dane).run();
}

/**
 * Trzy wpisy `historia_cen` dla jednego kodu — dwa kolejne różnią się ceną, trzeci stanem,
 * więc zapytanie okienkowe z `repos/suppliers.ts` ma co wykryć w obu kolumnach.
 */
export function zasiejHistorieCen(db: Baza): void {
  db.insert(historiaCen)
    .values([
      {
        kod: "MO9_336320",
        dostawca: "MO9",
        cenaZakupu: 5000,
        cenaSprzedazy: 6500,
        stan: 2,
        zarejestrowanoAt: "2026-08-01T10:00:00.000Z",
      },
      {
        kod: "MO9_336320",
        dostawca: "MO9",
        cenaZakupu: 5562.4,
        cenaSprzedazy: 7252,
        stan: 2,
        zarejestrowanoAt: "2026-08-02T10:00:00.000Z",
      },
      {
        kod: "MO9_336320",
        dostawca: "MO9",
        cenaZakupu: 5562.4,
        cenaSprzedazy: 7252,
        stan: 9,
        zarejestrowanoAt: "2026-08-03T10:00:00.000Z",
      },
    ])
    .run();
}

/**
 * Odtwarza na bazie testowej migrację produkcji `szertxt` (backlog #3): zmienia
 * `products.szerokosc` z REAL na TEXT.
 *
 * Po co: SQLite stosuje TYPE AFFINITY, więc do kolumny zadeklarowanej REAL nie da się
 * zapisać „10.00" — silnik sam zamieni ten napis na liczbę 10.0. Innymi słowy kanoniczny
 * schemat FIZYCZNIE nie jest w stanie odtworzyć tego, co leży na stagingu, i test
 * pass-through wymaga prawdziwej podmiany typu kolumny.
 *
 * Sposób jest ten sam, co w migracji Ani i jedyny możliwy w SQLite (nie ma ALTER COLUMN):
 * nowa tabela → przepisanie danych → podmiana nazwy → odtworzenie indeksów. DDL bierzemy
 * z `sqlite_master`, żeby nie powielać tu 72 kolumn i nie rozjechać się z kanonem.
 */
export function przelaczSzerokoscNaText(sqlite: BazaSqlite): void {
  const ddl = sqlite
    .prepare<[], { sql: string }>("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'")
    .get();
  if (!ddl) throw new Error("Brak tabeli products w bazie testowej");

  const indeksy = sqlite
    .prepare<[], { sql: string | null }>(
      "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='products' AND sql IS NOT NULL",
    )
    .all();

  const ddlNowe = ddl.sql.replace(/\bszerokosc REAL\b/, "szerokosc TEXT");
  if (ddlNowe === ddl.sql) {
    throw new Error("Nie znaleziono `szerokosc REAL` w DDL tabeli products — kanon się zmienił?");
  }

  sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.transaction(() => {
    sqlite.exec(ddlNowe.replace(/products/, "products_szertxt"));
    sqlite.exec("INSERT INTO products_szertxt SELECT * FROM products");
    sqlite.exec("DROP TABLE products");
    sqlite.exec("ALTER TABLE products_szertxt RENAME TO products");
    for (const indeks of indeksy) if (indeks.sql) sqlite.exec(indeks.sql);
  })();
  sqlite.exec("PRAGMA foreign_keys = ON");
}

/**
 * Pozycje stagingu zasiane WPROST z nagranych fixtures.
 *
 * Po co tak: pola `typZmiany`, `powod`, `snapshotJson`, `zmianaPct` i cała rodzina
 * `ean*` nie powstają w parserze — produkuje je `tk()`, porównując cennik z istniejącym
 * katalogiem (backend-index.cjs:47584-47851). Iteracja 3b celowo nie portuje `tk()`
 * (plan.md D2), więc realny import nie wygeneruje wartości, które fixture zawiera.
 *
 * Rozdzielamy więc dwie rzeczy: WARSTWĘ ODCZYTU (projekcje, mapowanie kolumn na pola
 * JSON, koperty, sortowanie, filtry) testujemy tutaj przeciw prawdziwym nagraniom
 * produkcji, a warstwę PRODUKCJI danych — dopiero w 3c, po porcie `tk()`.
 *
 * Identyfikatory bierzemy z fixtures bez zmian, dzięki czemu odtwarza się też kolejność:
 * `/api/staging` (bez `ORDER BY`, czyli po `rowid`) zwraca pięć pozycji o najniższych id,
 * a `/api/staging/paged` (`ORDER BY id DESC`) — pięć o najwyższych.
 */
export function zasiejStagingZFixtures(db: Baza): void {
  const wiersze = [
    ...pozycjeZFixture("GET_staging.json"),
    ...pozycjeZFixture("GET_staging_paged.json"),
  ];
  db.insert(stagingItems).values(wiersze).run();
}

type PozycjaFixture = Record<string, unknown>;

function pozycjeZFixture(nazwaPliku: string): (typeof stagingItems.$inferInsert)[] {
  const fixture = wczytajFixture(nazwaPliku);
  const items = (fixture.body as { items: PozycjaFixture[] }).items;

  return items.map((p) => ({
    id: p.id as number,
    typZmiany: p.typZmiany as string,
    kod: p.kod as string,
    nazwa: p.nazwa as string,
    dostawca: p.dostawca as string,
    magazyn: p.magazyn as string,
    stanStary: (p.stanStary ?? null) as number | null,
    stanNowy: (p.stanNowy ?? null) as number | null,
    cenaZakupuStara: (p.cenaZakupuStara ?? null) as number | null,
    cenaZakupuNowa: (p.cenaZakupuNowa ?? null) as number | null,
    cenaSprzedazyNowa: (p.cenaSprzedazyNowa ?? null) as number | null,
    zmianaPct: (p.zmianaPct ?? null) as number | null,
    ostrzezenie: (p.ostrzezenie ?? null) as string | null,
    powod: (p.powod ?? null) as string | null,
    // Trzech pól poniżej NIE MA w `GET_staging_paged.json` — ten kształt ich nie zwraca
    // (repos/staging.ts). Dla tamtych wierszy zostają nullem, i tak być powinno.
    snapshotJson: (p.snapshotJson ?? null) as string | null,
    eanRaw: (p.eanRaw ?? null) as string | null,
    eanIsValid: (p.eanIsValid ?? null) as number | null,
    eanSourceStatus: (p.eanSourceStatus ?? null) as string | null,
    eanCandidates: (p.eanCandidates ?? null) as string | null,
    magazynRaw: (p.magazynRaw ?? null) as string | null,
    edytowanePola: (p.edytowanePola ?? null) as string | null,
    utworzono: p.utworzono as string,
    zatwierdzilUzytkownikId: (p.zatwierdzilUzytkownikId ?? null) as number | null,
    // `paged` i `{id}` publikują tę kolumnę pod krótszą nazwą `zatwierdzono`.
    zatwierdzonoData: (p.zatwierdzonoData ?? p.zatwierdzono ?? null) as string | null,
  }));
}
