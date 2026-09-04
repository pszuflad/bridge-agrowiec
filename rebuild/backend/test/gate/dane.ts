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
import type { Baza } from "../../src/db/index.js";
import {
  KONFIGURACJA_POCZATKOWA,
  SPEDYCJA_POCZATKOWA,
} from "../../src/db/seed-poczatkowy.js";
import {
  auditLog,
  config,
  history,
  historiaCen,
  markups,
  products,
  promotions,
  sellyKategoriaNormMap,
  sellySyncLog,
  sellyZastosowanieCategoryMap,
  spedycjaLimity,
  stagingItems,
  suppliers,
} from "../../src/db/schema.js";
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
    szerokosc: "620",
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
    szerokosc: "240",
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
    szerokosc: "11.2",
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
    szerokosc: "600",
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
 * Historia cen pod GATE bloku 10b — kilku dostawców, po dwa miesiące, z niepustym `ean`.
 *
 * ⚠ PO CO OSOBNY ZASIEW, SKORO `zasiejHistorieCen` JUŻ ISTNIEJE. Tamten ma trzy wiersze
 * JEDNEGO dostawcy, w JEDNYM miesiącu i BEZ `ean` — i to mu wystarcza, bo służy testom
 * dostawców. Dla tras cen dałby fałszywie zielony gate na dwa sposoby naraz:
 *
 *  • `prices/inflation` liczy `LAG` po miesiącach w obrębie dostawcy. Przy jednym miesiącu
 *    `inflacjaPct` wychodzi `NULL` w KAŻDYM wierszu, a `gate/ksztalt.ts` traktuje „odpowiedź
 *    ma null tam, gdzie fixture miał liczbę" jako OSTRZEŻENIE, nie różnicę — czyli kolumna
 *    przeszłaby bez dowodu, że w ogóle umiemy ją policzyć.
 *  • `prices/product-history` zwraca `ean`. Przy zasiewie bez EAN-ów kolumna byłaby
 *    nullem w każdym wierszu i znowu skończyłoby się na ostrzeżeniu.
 *
 * Stąd: trzej dostawcy, dwa miesiące (2026-06 i 2026-07), rosnące ceny, w tym jeden wiersz
 * z `cenaZakupu: 0` — po to, żeby test mógł sprawdzić, że `inflation` go odsiewa
 * (`WHERE cena_zakupu > 0`), a `stats` w `product-history` JUŻ NIE (`filter(v => v != null)`
 * przepuszcza zero). Ta jedna różnica progu między dwiema trasami tego samego bloku jest
 * w oryginale i łatwo ją przeoczyć.
 */
export function zasiejHistorieCenDlaCen(db: Baza): void {
  db.insert(historiaCen)
    .values([
      // MO1 — dwa miesiące, cena rośnie: `inflacjaPct` policzone dla lipca.
      { kod: "MO1_A1", ean: "5901234123457", dostawca: "MO1", cenaZakupu: 1000, cenaSprzedazy: 1300, stan: 4, zarejestrowanoAt: "2026-06-10T08:00:00.000Z" },
      { kod: "MO1_A1", ean: "5901234123457", dostawca: "MO1", cenaZakupu: 1200, cenaSprzedazy: 1560, stan: 3, zarejestrowanoAt: "2026-07-10T08:00:00.000Z" },
      // MO2 — dwa miesiące, cena spada: ujemna inflacja w drugim miesiącu.
      { kod: "MO2_B2", ean: "5901234123464", dostawca: "MO2", cenaZakupu: 800, cenaSprzedazy: 1040, stan: 10, zarejestrowanoAt: "2026-06-15T08:00:00.000Z" },
      { kod: "MO2_B2", ean: "5901234123464", dostawca: "MO2", cenaZakupu: 600, cenaSprzedazy: 780, stan: 12, zarejestrowanoAt: "2026-07-15T08:00:00.000Z" },
      // MO3 — jeden miesiąc: pierwszy wiersz dostawcy zawsze ma `inflacjaPct: null`.
      { kod: "MO3_C3", ean: "5901234123471", dostawca: "MO3", cenaZakupu: 450.5, cenaSprzedazy: 585.65, stan: 0, zarejestrowanoAt: "2026-07-20T08:00:00.000Z" },
      // Wiersz o cenie zerowej — patrz nota wyżej o różnicy progów.
      { kod: "MO3_C3", ean: "5901234123471", dostawca: "MO3", cenaZakupu: 0, cenaSprzedazy: 0, stan: 0, zarejestrowanoAt: "2026-07-21T08:00:00.000Z" },
    ])
    .run();
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

/**
 * Zasiew reguł narzutu wprost z `contract/fixtures/GET_markups.json` (Iteracja 4a).
 *
 * Ta sama metoda co przy stagingu: wiersz bierzemy z NAGRANIA produkcji, a nie z własnej
 * wyobraźni, więc porównanie odpowiedzi z fixture'em sprawdza całą warstwę odczytu —
 * typy kolumn, mapowanie snake_case → camelCase i to, że `warunki` wychodzi jako STRING
 * z JSON-em w środku, a nie jako rozpakowana tablica.
 */
export function zasiejNarzutyZFixtures(db: Baza): void {
  const fixture = wczytajFixture("GET_markups.json");
  const wiersze = (fixture.body as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    typ: r.typ as string,
    zakres: r.zakres as string,
    warunki: (r.warunki ?? null) as string | null,
    nazwa: (r.nazwa ?? null) as string | null,
    wartosc: r.wartosc as number,
    jednostka: r.jednostka as string,
    priorytet: r.priorytet as number,
    status: r.status as string,
    zmienilUzytkownikId: (r.zmienilUzytkownikId ?? null) as number | null,
    zmienionoData: (r.zmienionoData ?? null) as string | null,
  }));
  if (wiersze.length > 0) db.insert(markups).values(wiersze).run();
}

/**
 * Promocja do sprawdzenia KSZTAŁTU odpowiedzi `/api/promotions`.
 *
 * ⚠ OGRANICZENIE SIATKI, NAZWANE WPROST: `GET_promotions.json` jest PUSTĄ TABLICĄ, więc
 * produkcja nie nagrała ani jednego wiersza promocji. Kształt poniżej pochodzi ze schematu
 * (`rebuild/schema/001_schema.sql:156-168`), nie z nagrania — i tylko tyle może dowodzić
 * test, który go używa. Sam fixture pilnuje wyłącznie tego, że pusty katalog promocji
 * zwraca `[]` z kodem 200.
 */
export const PROMOCJA_TESTOWA = {
  id: 1,
  nazwa: "Wyprzedaż zimowa",
  rabatPct: 10,
  zasieg: "BKT,MICHELIN",
  warunki: null,
  priorytet: 50,
  start: "2026-01-01",
  koniec: "2026-03-31",
  status: "aktywna",
  zmienilUzytkownikId: 1,
  zmienionoData: "2026-07-31T13:07:21.578Z",
} as const;

/** Wstawia `PROMOCJA_TESTOWA` — do testów kształtu, nie do porównania z fixture'em. */
export function zasiejPromocjeTestowa(db: Baza): void {
  db.insert(promotions).values({ ...PROMOCJA_TESTOWA }).run();
}

// ─── Iteracja 5: historia ────────────────────────────────────────────────────────────────
//
// Dwa seedy, bo trzy trasy historii czytają DWIE różne tabele (routes/history.ts):
// `GET /api/history` → `history`, a `/meta` i `/paged` → `audit_log`.

/**
 * Tabela `history` prosto z `contract/fixtures/GET_history.json`.
 *
 * `GET /api/history` to czysty `SELECT … ORDER BY data DESC`, więc nagranie produkcji
 * jest tu jednocześnie wejściem i oczekiwanym wyjściem — dokładnie ten wariant seedu,
 * co `zasiejStagingZFixtures`.
 */
export function zasiejDziennikZmianZFixtures(db: Baza): void {
  const fixture = wczytajFixture("GET_history.json");
  const wiersze = (fixture.body as Record<string, unknown>[]).map((w) => ({
    id: w["id"] as number,
    data: w["data"] as string,
    kodProduktu: w["kodProduktu"] as string,
    nazwa: w["nazwa"] as string,
    pole: w["pole"] as string,
    staraWartosc: (w["staraWartosc"] ?? null) as string | null,
    nowaWartosc: (w["nowaWartosc"] ?? null) as string | null,
    zrodlo: w["zrodlo"] as string,
    kto: w["kto"] as string,
    wykonalUzytkownikId: (w["wykonalUzytkownikId"] ?? null) as number | null,
  }));
  db.insert(history).values(wiersze).run();
}

/**
 * Wiersze `audit_log` dla `/api/history/meta` i `/paged`.
 *
 * ⚠ INACZEJ NIŻ POZOSTAŁE SEEDY: tu fixture jest WYJŚCIEM, nie wejściem. `/paged` nie
 * publikuje wierszy audytu, tylko wynik mapowania (`historia/mapowanie.ts`), więc seed
 * musi odtworzyć DANE ŹRÓDŁOWE, z których to mapowanie da kształt zgodny z
 * `GET_history_paged.json`. Dzięki temu GATE sprawdza całą drogę audyt → widok,
 * a nie samo przepisanie wiersza.
 *
 * Zawartość dobrana tak, żeby pokryć wszystkie trzy typy i pułapki, które są w bazie
 * produkcyjnej OD RAZU (ostrzeżenia z bloku I5 roadmapy):
 *
 *  • pięć `edycja_produktu` — NAJŚWIEŻSZE, żeby to one wypełniły pierwszą stronę
 *    i dały się porównać z fixture'em 1:1 (`zmienionePola` z `szczegoly_json.zmiany`);
 *  • `upload_pliku` i `import_cennika` dla pięciu dostawców — zasilają `meta.dostawcy`
 *    i pokrywają obie gałęzie fallbacku `liczbaPozycji` (`liczbaProduktow` vs `wczytanych`);
 *  • `eksport_shoper` — jedyne wejście dające niepuste `format`;
 *  • `synchronizacja_reczna` z `szczegoly_json = NULL` i `encja_id` spoza `suppliers`
 *    (dostawca „MO99" nie istnieje) — dokładnie ten wiersz, przed którym ostrzega roadmapa;
 *  • dwa wiersze z niepoprawnym JSON-em w `szczegoly_json` (`JSON.parse` na nich rzuca):
 *    jeden przy akcji nierozpoznanej, drugi przy `upload_pliku` — ten drugi przechodzi
 *    przez PEŁNE mapowanie, więc dowodzi, że parser broni całej drogi, a nie tylko odsiewu;
 *  • wiersz z akcją spoza słownika pięciu rozpoznawanych.
 *
 * Razem: 12 wierszy rozpoznawanych i 3 odsiane. Żaden z odsianych nie może wywrócić odczytu.
 */
export function zasiejAudytHistorii(db: Baza): void {
  db.insert(auditLog).values(wierszeAudytuHistorii()).run();
}

/**
 * Ile wierszy z `zasiejAudytHistorii` przechodzi przez odsiew akcji, czyli ile wpisów ma
 * zobaczyć `/api/history/paged`. Liczone z seeda, nie wpisane na sztywno — inaczej każda
 * przyszła zmiana seeda (np. przy pracach nad `/api/audit-log` w I12) cicho wywalałaby
 * asercje w `historia.odczyt.test.ts` bez powiedzenia dlaczego.
 */
export function liczbaRozpoznanychWpisowHistorii(): number {
  const rozpoznawane = new Set([
    "upload_pliku",
    "import_cennika",
    "eksport_csv",
    "eksport_shoper",
    "edycja_produktu",
  ]);
  return wierszeAudytuHistorii().filter((w) => rozpoznawane.has(w.akcja)).length;
}

function wierszeAudytuHistorii(): (typeof auditLog.$inferInsert)[] {
  return [
    // — najstarsze: pułapki, które mają wypaść z wyniku —
    {
      uzytkownikId: 1,
      uzytkownikImie: "Marta Bieguniak",
      akcja: "synchronizacja_reczna",
      encjaTyp: "dostawca",
      // Kod dostawcy, którego NIE MA w `suppliers` — audyt zapisuje ZAMIAR przed operacją.
      encjaId: "MO99",
      szczegolyJson: null,
      kiedy: "2026-07-28T05:00:00.000Z",
    },
    {
      uzytkownikId: 1,
      uzytkownikImie: "Marta Bieguniak",
      akcja: "import_z_url",
      encjaTyp: "dostawca",
      encjaId: "MO6",
      // Nie jest poprawnym JSON-em — `JSON.parse` rzuci, mapowanie ma to znieść.
      szczegolyJson: "{niepoprawny json",
      kiedy: "2026-07-28T05:01:00.000Z",
    },
    {
      uzytkownikId: null,
      uzytkownikImie: null,
      akcja: "czyszczenie_stagingu",
      encjaTyp: null,
      encjaId: null,
      szczegolyJson: JSON.stringify({ usunieto: 12 }),
      kiedy: "2026-07-28T05:02:00.000Z",
    },

    // — akcje rozpoznawane: eksport i importy —
    {
      uzytkownikId: 1,
      uzytkownikImie: "Marta Bieguniak",
      // Zepsuty JSON przy akcji ROZPOZNAWANEJ — przechodzi przez PEŁNE mapowanie, a nie
      // wypada na odsiewie jak `import_z_url` wyżej. Ma dać `{}` i wpis z pustymi polami.
      akcja: "upload_pliku",
      encjaTyp: "dostawca",
      encjaId: "MO6",
      szczegolyJson: "{tez niepoprawny",
      kiedy: "2026-07-28T05:05:00.000Z",
    },
    {
      uzytkownikId: 1,
      uzytkownikImie: "Marta Bieguniak",
      akcja: "eksport_shoper",
      encjaTyp: null,
      encjaId: null,
      szczegolyJson: JSON.stringify({ liczbaProduktow: 7412 }),
      kiedy: "2026-07-28T05:10:00.000Z",
    },
    ...["MO1", "MO10", "MO2", "MO3", "MO6"].map((kod, i) => ({
      uzytkownikId: 1,
      uzytkownikImie: "Marta Bieguniak",
      akcja: i % 2 === 0 ? "upload_pliku" : "import_cennika",
      encjaTyp: "dostawca",
      encjaId: kod,
      szczegolyJson:
        i % 2 === 0
          ? // `upload_pliku` (routes/suppliers.ts) — ma `nazwaPliku` i `liczbaProduktow`.
            JSON.stringify({ nazwaPliku: `${kod.toLowerCase()}-cennik.xlsx`, liczbaProduktow: 120 + i })
          : // `import_cennika` (routes/staging-mutacje.ts) — bez pliku, liczba pod `wczytanych`.
            JSON.stringify({ wczytanych: 200 + i, doStagingu: 5 }),
      kiedy: `2026-07-28T05:${String(20 + i).padStart(2, "0")}:00.000Z`,
    })),

    // — najświeższe: pięć edycji produktu odpowiadających fixture'owi `/paged` —
    ...edycjeZFixture(),
  ];
}

/**
 * Pięć wpisów `edycja_produktu` odtworzonych z `GET_history_paged.json` — ze znaczników
 * `kiedy`, kodów produktu i list `zmienionePola` z nagrania. To jedyna droga, żeby GATE
 * porównał wartości, a nie sam kształt: `typ`, `kodProduktu` i `zmienionePola` muszą wyjść
 * dokładnie takie, jak zapisała je produkcja.
 */
function edycjeZFixture(): (typeof auditLog.$inferInsert)[] {
  const fixture = wczytajFixture("GET_history_paged.json");
  const items = (fixture.body as { items: Record<string, unknown>[] }).items;
  return items.map((wpis) => ({
    uzytkownikId: 1,
    uzytkownikImie: wpis["uzytkownik"] as string,
    akcja: "edycja_produktu",
    encjaTyp: "produkt",
    encjaId: wpis["kodProduktu"] as string,
    szczegolyJson: JSON.stringify({ zmiany: wpis["zmienionePola"] as string[] }),
    kiedy: wpis["kiedy"] as string,
  }));
}

/**
 * Dane startowe spedycji i konfiguracji — dokładnie te, które produkcja zasiewa przy
 * pierwszym starcie (`zw()`, `backend-index.cjs:45710-45716`). Źródłem jest wspólny moduł
 * `src/db/seed-poczatkowy.ts`, więc GATE porównuje z fixture'ami TE SAME wartości,
 * które trafiają do bazy deweloperskiej.
 *
 * ⚠ Dla `/api/config` klucze SĄ danymi, a `porownajKsztalt` porównuje zbiory kluczy obiektu.
 * Zasianie choćby jednego klucza więcej (np. `shoper.kolumny`, którego produkcja jeszcze
 * nie zapisała) wywali GATE — i słusznie, bo odpowiedź przestałaby się zgadzać z nagraniem.
 */
export function zasiejKonfiguracjeStartowa(db: Baza): void {
  db.insert(spedycjaLimity).values(SPEDYCJA_POCZATKOWA).run();
  db.insert(config)
    .values(Object.entries(KONFIGURACJA_POCZATKOWA).map(([klucz, wartosc]) => ({ klucz, wartosc })))
    .run();
}

/**
 * Dziennik operacji Selly wprost z `contract/fixtures/GET_selly_log.json` (Iteracja 8a).
 *
 * Ta sama metoda co przy stagingu i narzutach: wiersz bierzemy z NAGRANIA produkcji.
 * Dzięki temu porównanie odpowiedzi z fixture'em sprawdza całą warstwę odczytu, w tym
 * rzecz, która najłatwiej się psuje — projekcję `snake_case`. Drizzle `select()` bez jawnej
 * projekcji oddałby `dostawcaKod` zamiast `dostawca_kod` (repos/selly.ts), a wtedy test
 * zapala się na siedmiu kluczach naraz.
 *
 * `szczegoly_json` zostaje NAPISEM — produkcja nie rozpakowuje go przed wysłaniem, a niesie
 * w środku realne błędy zewnętrznego Selly (`[Selly] HTTP 400 ... Brak kategorii o id 1`).
 */
export function zasiejLogSellyZFixtures(db: Baza): void {
  const fixture = wczytajFixture("GET_selly_log.json");
  const items = (fixture.body as { items: Record<string, unknown>[] }).items;
  db.insert(sellySyncLog)
    .values(
      items.map((w) => ({
        id: w["id"] as number,
        operacja: w["operacja"] as string,
        dostawcaKod: (w["dostawca_kod"] ?? null) as string | null,
        liczbaOk: w["liczba_ok"] as number,
        liczbaBlad: w["liczba_blad"] as number,
        liczbaSkip: w["liczba_skip"] as number,
        szczegolyJson: (w["szczegoly_json"] ?? null) as string | null,
        uzytkownikId: (w["uzytkownik_id"] ?? null) as number | null,
        uzytkownikImie: (w["uzytkownik_imie"] ?? null) as string | null,
        rozpoczeto: w["rozpoczeto"] as string,
        zakonczono: (w["zakonczono"] ?? null) as string | null,
        status: w["status"] as string,
      })),
    )
    .run();
}

/**
 * Mapy kategorii Selly (Iteracja 8a) — `selly_kategoria_norm_map`
 * i `selly_zastosowanie_category_map`.
 *
 * ⚠ TYCH DANYCH NIE MA W ŻADNYM FIXTURZE — produkcja nie wystawia tych tabel przez API,
 * a nagrywarka zapisywała tylko odpowiedzi HTTP. Wartości są więc DOBRANE, nie nagrane,
 * i mają jeden cel: pokryć trzy ścieżki `mapujZastosowanieNaKategorie`
 * (`zastosowanie` / `fallback_kategoria` / `fallback_empty`) oraz flagę
 * `dziedziczy_kategorie_produktu`. Id-ki kategorii pochodzą z
 * `contract/fixtures/GET_selly_dictionaries.json`, żeby były spójne ze słownikiem.
 *
 * „Ciągnik" i „Forwarder" to wartości `zastosowanie` z `PRODUKTY_TESTOWE`; „(ogólne)"
 * odwzorowuje przypadek dziedziczenia, a „Koparka" — drugą wartość w łańcuchu `a + b`,
 * czyli tę, która idzie do `multi_cat`.
 */
export function zasiejMapySelly(db: Baza): void {
  db.insert(sellyKategoriaNormMap)
    .values([
      { kategoriaRaw: "Rolnicze", kategoriaGlownaNorm: "rolnicze", categoryIdGlowna: 1 },
      { kategoriaRaw: "Leśne", kategoriaGlownaNorm: "lesne", categoryIdGlowna: 2 },
      { kategoriaRaw: "Przemysłowe", kategoriaGlownaNorm: "przemyslowe", categoryIdGlowna: 3 },
      // „Przyczepy" (produkt MO2_200002) świadomie POZA mapą — to jest przypadek
      // `fallback_kategoria` z wynikiem `null`, czyli produkt, którego walidacja odrzuci.
    ])
    .run();

  db.insert(sellyZastosowanieCategoryMap)
    .values([
      {
        zastosowanie: "Ciągnik",
        categoryIdGlowna: 1,
        categoryIdZastosowanie: 11,
        dziedziczyKategorieProduktu: 0,
      },
      {
        zastosowanie: "Koparka",
        categoryIdGlowna: 3,
        categoryIdZastosowanie: 33,
        dziedziczyKategorieProduktu: 0,
      },
      {
        zastosowanie: "(ogólne)",
        categoryIdGlowna: null,
        categoryIdZastosowanie: null,
        dziedziczyKategorieProduktu: 1,
      },
    ])
    .run();
}
