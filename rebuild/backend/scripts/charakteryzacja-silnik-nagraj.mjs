// Nagrywa OCZEKIWANE wyjście silnika importu, uruchamiając ORYGINALNE `tk()` wycięte
// z produkcyjnego bundla `mirror/backend/index.cjs` (nie nasz port!).
//
// To jest wzorzec, do którego `test/silnik.charakteryzacja.test.ts` porównuje port z 3c.
// Odpowiednik `charakteryzacja-nagraj.mjs` z 3a, o jedną warstwę wyżej: 3a nagrywała wyjście
// PARSERÓW, ta skrypt nagrywa wyjście SILNIKA, który te parsery konsumuje.
//
// WEJŚCIE SILNIKA = wzorzec 3a. Rekordy bierzemy wprost z `test/charakteryzacja/MOx.expected.json`
// (pole `rekordy`), czyli z nagranego wyjścia ORYGINALNYCH parserów. Dzięki temu obie
// charakteryzacje się składają, a ta tutaj mierzy wyłącznie silnik — nie miesza w wynik
// ewentualnego dryfu parserów, który ma własny gate.
//
// KATALOG = `db/snapshot.db`, prawdziwy zrzut produkcji (7405 produktów MO1–MO10). Plik jest
// w .gitignore i NIE jedzie do repo, dlatego skrypt wypłaszcza wiersze do
// `test/charakteryzacja/silnik/katalog/MOx.katalog.json` — i to te pliki czyta test.
//
// OVERRIDY = `manual_overrides` z tego samego zrzutu (12 620 wierszy). 3c jechała na pustej
// liście, bo `Gq()` była wtedy przepuszczającym stubem; 3d-1 podaje realne poprawki Marty,
// więc oryginał wykonuje prawdziwe `Gq()`. Wypłaszczane do
// `test/charakteryzacja/silnik/overrides/MOx.overrides.json`.
//
// PROJEKCJA KOLUMN: pełne wiersze to 10 MB, więc zapisujemy tylko kolumny, których `tk()`
// realnie dotyka (KOLUMNY_KATALOGU niżej). Kompletność tej listy NIE jest przyjmowana na
// słowo — dla każdego dostawcy skrypt uruchamia oryginał DWA RAZY, na pełnym i na przyciętym
// katalogu, i wymaga identycznego wyniku. Gdyby projekcja gubiła pole czytane przez silnik,
// przebiegi by się rozjechały i nagranie padnie zamiast po cichu zawęzić próbę.
//
// Uruchamiać po każdej zmianie w mirrorze albo po przenagraniu wzorca 3a. Wynik pokaże
// w `git diff`, co dokładnie zmieniło się w zachowaniu importu.
//
// Użycie:  node scripts/charakteryzacja-silnik-nagraj.mjs

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { stworzAtrapy } from "../test/charakteryzacja/silnik/atrapy.mjs";
import { SCENARIUSZE } from "../test/charakteryzacja/silnik/scenariusze.mjs";
import {
  KODY_DOSTAWCOW,
  UTWORZONO_WZORCOWE,
  normalizujPrzebieg,
} from "../test/charakteryzacja/silnik/wzorzec.mjs";
import { wytnijFragmenty, zaladujOryginal } from "../test/charakteryzacja/silnik/oryginal.mjs";

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoDir = join(backendDir, "..", "..");
const katalogCharakteryzacji3a = join(backendDir, "test", "charakteryzacja");
const katalogWynikow = join(katalogCharakteryzacji3a, "silnik");
const katalogKatalogow = join(katalogWynikow, "katalog");
const katalogOverrides = join(katalogWynikow, "overrides");
// `db/snapshot.db` jest w .gitignore, więc w worktree ticketa go nie ma — a skrypt bywa
// uruchamiany właśnie stamtąd. Ścieżkę da się wskazać zmienną BRIDGE_SNAPSHOT_DB.
const sciezkaZrzutu = process.env.BRIDGE_SNAPSHOT_DB ?? join(repoDir, "db", "snapshot.db");

const naCamel = (nazwa) => nazwa.replace(/_([a-z0-9])/g, (_, z) => z.toUpperCase());

/**
 * Kolumny `products` zapisywane do wzorca.
 *
 * Pierwsza grupa: wszystko, co ŻYWE `tk()` czyta z dopasowanego produktu — klucze map
 * dopasowania, pola porównywane przez `Vq` (`:47264`), pola kluczowe `_KP` (`:47751`),
 * pola auto-patcha `AP` (`:47760-47764`), `eanIsValid` z `_cb` i `nieobecnoscPodRzad`.
 * Druga grupa: kolumny NOT NULL, bez których nie da się zasiać wiersza w naszej bazie
 * (gate treści importuje do prawdziwego SQLite).
 */
const KOLUMNY_KATALOGU = [
  "id",
  "kod",
  "ean",
  "eanIsValid",
  "dostawca",
  "nazwa",
  "marka",
  "model",
  "kodDostawcy",
  "rozmiar",
  "szerokosc",
  "profil",
  "srednica",
  "konstrukcja",
  "indeksNosnosci",
  "indeksPredkosci",
  "vfIf",
  "pr",
  "cenaZakupu",
  "cenaSprzedazy",
  "marzaPct",
  "stan",
  "magazyn",
  "magazynRaw",
  "nieobecnoscPodRzad",
  // ZAKRES 3d-1: pola, które gałąź auto-zatwierdzania ZAPISUJE przez bridge_ext.applyDims
  // i applyLinkMemory (`:47794`). Bez nich porównanie nie zobaczyłoby, że rozszerzenia
  // importu w ogóle się wykonały.
  "wysokosc",
  "dlugosc",
  "szerokoscPaczki",
  "wysokoscPrzesylki",
  "linkZdjecia",
  // poniżej: wymagane przez schemat, nieczytane przez tk()
  "kategoria",
  "vat",
  "status",
  "dataAktualizacji",
];

/**
 * Kolumny `manual_overrides` czytane przez `Gq()` (`:47319-47348`). Poza kluczem
 * (`supplierKod`/`supplierProductId`) funkcja sięga wyłącznie po te trzy pola —
 * `reason`, `createdBy` i `createdAt` nie mają wpływu na zachowanie silnika.
 */
const KOLUMNY_OVERRIDES = [
  "supplierKod",
  "supplierProductId",
  "fieldName",
  "overrideValue",
  "acknowledgedSourceValue",
];

/**
 * Tablica z JEDNYM elementem na wiersz — kompromis między rozmiarem a czytelnością diffa.
 * Pretty-print rozdmuchałby katalogi do 13 MB, a jedna długa linia zrobiłaby z każdej zmiany
 * nieczytelną plamę.
 */
const jsonPoWierszu = (elementy) =>
  elementy.length === 0 ? "[]\n" : `[\n${elementy.map((e) => JSON.stringify(e)).join(",\n")}\n]\n`;

const przytnij = (produkt) =>
  Object.fromEntries(KOLUMNY_KATALOGU.map((k) => [k, produkt[k] ?? null]));

const przytnijOverride = (wiersz) =>
  Object.fromEntries(KOLUMNY_OVERRIDES.map((k) => [k, wiersz[k] ?? null]));

/**
 * Znacznik `new Date().toISOString()`, który `tk()` wzięło na wejściu (`:47585`).
 * Nie da się go odczytać z zewnątrz, więc czytamy go z pierwszego artefaktu, który go niesie.
 */
function znacznikPrzebiegu(atrapy) {
  return atrapy.staging[0]?.utworzono ?? atrapy.historiaCen[0]?.zarejestrowanoAt ?? null;
}

/** Uruchamia ORYGINALNE `tk()` na podanym katalogu i zwraca znormalizowany przebieg. */
function uruchomOryginal(kod, rekordy, produkty, overrides, opisKatalogu) {
  const atrapy = stworzAtrapy({ produkty, overrides });
  const oryginal = zaladujOryginal(atrapy.zaleznosci);
  const statystyki = oryginal.tk(kod, rekordy);
  atrapy.sprawdzUkladPetli();

  const przebieg = normalizujPrzebieg({
    dostawca: kod,
    wejscie: {
      rekordow: rekordy.length,
      zrodlo: `test/charakteryzacja/${kod}.expected.json → rekordy (wzorzec 3a)`,
    },
    katalog: { produktow: produkty.length, zrodlo: opisKatalogu },
    overridy: { wierszy: overrides.length },
    statystyki,
    staging: atrapy.staging,
    skasowane: atrapy.skasowane,
    historiaCen: atrapy.historiaCen,
    zmianyProduktow: atrapy.zmianyProduktow(),
    zapytanDoPamieciLinkow: atrapy.zapytanDoPamieciLinkow(),
    znacznikPrzebiegu: znacznikPrzebiegu(atrapy),
  });

  atrapy.zamknij();
  return przebieg;
}

/**
 * Nagrywa scenariusze celowane. Wejście jest skrojone ręcznie, ale OCZEKIWANIE nadal pochodzi
 * z uruchomionego oryginału — tak samo jak przy cennikach.
 */
function nagrajScenariusze() {
  const wyniki = SCENARIUSZE.map((s) => {
    const overrides = s.overrides ?? [];
    const atrapy = stworzAtrapy({ produkty: s.katalog, overrides });
    const oryginal = zaladujOryginal(atrapy.zaleznosci);
    const statystyki = oryginal.tk(s.dostawca, s.rekordy);
    atrapy.sprawdzUkladPetli();

    const przebieg = normalizujPrzebieg({
      dostawca: s.dostawca,
      wejscie: { rekordow: s.rekordy.length, zrodlo: "test/charakteryzacja/silnik/scenariusze.mjs" },
      katalog: { produktow: s.katalog.length, zrodlo: "scenariusze.mjs" },
      overridy: { wierszy: overrides.length },
      statystyki,
      staging: atrapy.staging,
      skasowane: atrapy.skasowane,
      historiaCen: atrapy.historiaCen,
      zmianyProduktow: atrapy.zmianyProduktow(),
      zapytanDoPamieciLinkow: atrapy.zapytanDoPamieciLinkow(),
      znacznikPrzebiegu: znacznikPrzebiegu(atrapy),
    });

    atrapy.zamknij();
    return { nazwa: s.nazwa, opis: s.opis, ...przebieg };
  });

  writeFileSync(
    join(katalogWynikow, "scenariusze.expected.json"),
    `${JSON.stringify(wyniki, null, 2)}\n`,
  );

  return wyniki;
}

/**
 * Wiersze `products` danego dostawcy ze zrzutu produkcji, w kształcie naszego schematu.
 *
 * ⚠ `szerokosc` wymaga konwersji, bo `db/snapshot.db` to zrzut z 2026-08-13 — SPRZED
 * produkcyjnej migracji `szertxt` (2026-08-19), więc kolumna jest tam jeszcze `REAL`.
 * Nasz kanon po `003_szerokosc_text.sql` ma `TEXT`. Bez konwersji obie strony porównania
 * dostawałyby RÓŻNE wejście (oryginał liczbę wprost ze zrzutu, port napis wyprodukowany
 * przez TEXT affinity przy wstawianiu), a charakteryzacja mierzyłaby wiek zrzutu zamiast
 * wierności silnika.
 *
 * Konwersja idzie przez `String(liczba)`, a NIE przez `CAST(… AS TEXT)` w SQLite. Różnica
 * jest istotna: SQLite renderuje `REAL` 710 jako „710.0", podczas gdy parser (`tyre_params.cjs`,
 * poprawka `szertxt`) zapisuje pierwszą liczbę z rozmiaru — czyli „710". Użycie `CAST`
 * dokładało do wzorca sztuczne różnice „szerokość: 710.0 → 710", których w produkcji nie ma.
 * `String()` daje „710" i „11.2", czyli dokładnie to, co pisze parser.
 *
 * Czego ta konwersja NIE odtworzy: prawdziwych zer końcowych („10.00"). REAL fizycznie ich
 * nie przechowa — i to jest właśnie strata, przed którą migracja 003 chroni na przyszłość.
 */
function katalogDostawcy(zrzut, kod) {
  return zrzut
    .prepare("SELECT * FROM products WHERE dostawca = ? ORDER BY id")
    .all(kod)
    .map((wiersz) => Object.fromEntries(Object.entries(wiersz).map(([k, v]) => [naCamel(k), v])))
    .map((wiersz) => ({
      ...wiersz,
      szerokosc: wiersz.szerokosc == null ? null : String(wiersz.szerokosc),
    }));
}

/**
 * REALNE poprawki Marty danego dostawcy ze zrzutu produkcji (12 620 wierszy łącznie).
 *
 * To jest przełącznik, który 3c zostawiła włączony na pusto: dopiero z tymi danymi oryginał
 * wykonuje prawdziwe `Gq()`. Ma to realne skutki dla klasyfikacji — najczęstszym polem jest
 * `kategoria` (6944 wiersze), którą czyta klasyfikator „czy opona".
 */
function overridesDostawcy(zrzut, kod) {
  return zrzut
    .prepare("SELECT * FROM manual_overrides WHERE supplier_kod = ? ORDER BY id")
    .all(kod)
    .map((wiersz) => Object.fromEntries(Object.entries(wiersz).map(([k, v]) => [naCamel(k), v])));
}

/** Rekordy wejściowe = nagrane wyjście ORYGINALNYCH parserów z 3a. */
function rekordyZWzorca3a(kod) {
  const wzorzec = JSON.parse(
    readFileSync(join(katalogCharakteryzacji3a, `${kod}.expected.json`), "utf-8"),
  );
  return wzorzec.rekordy;
}

function nagraj() {
  mkdirSync(katalogKatalogow, { recursive: true });
  mkdirSync(katalogOverrides, { recursive: true });

  if (!existsSync(sciezkaZrzutu)) {
    throw new Error(
      `Brak zrzutu produkcji: ${sciezkaZrzutu}\n` +
        "Plik jest w .gitignore (32 MB), więc nie ma go w świeżym klonie ani w worktree ticketa.\n" +
        "Wskaż go zmienną BRIDGE_SNAPSHOT_DB=/sciezka/do/snapshot.db",
    );
  }

  const zrzut = new Database(sciezkaZrzutu, { readonly: true, fileMustExist: true });
  const podsumowanie = [];

  for (const kod of KODY_DOSTAWCOW) {
    const pelny = katalogDostawcy(zrzut, kod);
    const przyciety = pelny.map(przytnij);
    const rekordy = rekordyZWzorca3a(kod);

    const overridesPelne = overridesDostawcy(zrzut, kod);
    const overrides = overridesPelne.map(przytnijOverride);

    const zPelnego = uruchomOryginal(
      kod,
      rekordy,
      pelny,
      overridesPelne,
      "db/snapshot.db → products (72 kolumny)",
    );
    const przebieg = uruchomOryginal(
      kod,
      rekordy,
      przyciety,
      overrides,
      `db/snapshot.db → products (projekcja ${KOLUMNY_KATALOGU.length} kolumn)`,
    );

    // Opis katalogu celowo pomijamy — różni się z definicji (pełny vs przycięty).
    const bezOpisuKatalogu = (przebieg) => ({ ...przebieg, katalog: null });
    if (JSON.stringify(bezOpisuKatalogu(zPelnego)) !== JSON.stringify(bezOpisuKatalogu(przebieg))) {
      throw new Error(
        `${kod}: oryginał zachował się INACZEJ na pełnym i na przyciętym katalogu. ` +
          "Projekcja KOLUMNY_KATALOGU / KOLUMNY_OVERRIDES gubi pole, które czyta tk() — " +
          "uzupełnij listę.",
      );
    }

    writeFileSync(join(katalogKatalogow, `${kod}.katalog.json`), jsonPoWierszu(przyciety));
    writeFileSync(join(katalogOverrides, `${kod}.overrides.json`), jsonPoWierszu(overrides));

    writeFileSync(
      join(katalogWynikow, `${kod}.expected.json`),
      `${JSON.stringify(przebieg, null, 2)}\n`,
    );

    podsumowanie.push(
      `${kod.padEnd(5)} wejscie=${String(rekordy.length).padStart(5)} ` +
        `katalog=${String(przyciety.length).padStart(5)} ` +
        `staging=${String(przebieg.staging.length).padStart(5)} ` +
        `nowe=${przebieg.statystyki.nowe} zmienione=${przebieg.statystyki.zmienione} ` +
        `blad=${przebieg.staging.filter((w) => w.typZmiany === "blad").length} ` +
        `nieOpony=${przebieg.statystyki.odrzuconeNieOpony} ` +
        `skasowane=${przebieg.skasowane.length} ` +
        `auto=${przebieg.statystyki.autoZatwierdzone} ` +
        `wycofane=${przebieg.statystyki.wycofane} ` +
        `historia=${przebieg.historiaCen.length} ` +
        `zmianyProd=${przebieg.zmianyProduktow.length} ` +
        `overridy=${przebieg.overridy.wierszy} ` +
        `bezZmian=${przebieg.statystyki.bezZmian}`,
    );
  }

  zrzut.close();

  const { integralnosc } = wytnijFragmenty();
  writeFileSync(
    join(katalogWynikow, "integralnosc.json"),
    `${JSON.stringify(integralnosc, null, 2)}\n`,
  );

  const scenariusze = nagrajScenariusze();

  console.log(podsumowanie.join("\n"));
  console.log("");
  for (const w of scenariusze) {
    const typy = w.staging.map((r) => r.typZmiany).join(",") || "-";
    console.log(
      `${w.nazwa.padEnd(38)} staging=${String(w.staging.length).padStart(2)} [${typy}] ` +
        `nowe=${w.statystyki.nowe} zmienione=${w.statystyki.zmienione} ` +
        `nieOpony=${w.statystyki.odrzuconeNieOpony} brakDanych=${w.statystyki.odrzuconeBrakDanych} ` +
        `smieciMO2=${w.statystyki.odrzuconeSmieciMO2} auto=${w.statystyki.autoZatwierdzone} ` +
        `bezZmian=${w.statystyki.bezZmian} skasowane=${w.skasowane.length} ` +
        `wycofane=${w.statystyki.wycofane} historia=${w.historiaCen.length} ` +
        `zmianyProd=${w.zmianyProduktow.length} overridy=${w.overridy.wierszy} ` +
        `doStagingu=${w.statystyki.doStagingu}`,
    );
  }
  console.log("");
  console.log(`\nZnacznik utworzono znormalizowany do "${UTWORZONO_WZORCOWE}".`);
  console.log(
    `Integralność wycinków mirrora: helpery ${integralnosc.helpery.sha256.slice(0, 12)}… ` +
      `(${integralnosc.helpery.dlugosc} B), silnik ${integralnosc.silnik.sha256.slice(0, 12)}… ` +
      `(${integralnosc.silnik.dlugosc} B).`,
  );
}

nagraj();
