#!/usr/bin/env node
/**
 * 59-CHORE-i14j — oracle diff trzech tras Historii.
 *
 * Stawia OBOK SIEBIE żywy oryginał (`mirror/backend/index.cjs`) i odbudowę
 * (`rebuild/backend`), obie na kopiach TEGO SAMEGO `db/snapshot.db`, i porównuje
 * odpowiedzi `GET /api/history`, `/api/history/meta` i `/api/history/paged`
 * na komplecie pól i na kolejności wierszy.
 *
 * Zastępuje ręczny test §9 instrukcji I5 („Porównanie ze starym Bridge"), którego
 * Ania nie wykonała. Metoda jest ta sama, którą 14e zastosowała do cen.
 *
 * ⚠ TO NIE JEST TEST CI. Wymaga żywego oryginału (kopia `mirror/backend` + `npm ci`),
 * więc mieszka w folderze ticketa, a nie w `rebuild/backend/test/`. Trwały ślad pomiaru
 * to `rebuild/backend/test/historia.wyrocznia.test.ts`, który zamraża odpowiedzi
 * ZAPISANE STĄD i chodzi w zwykłych bramkach, bez oryginału.
 *
 * Przepis na piaskownicę oryginału jest przepisany z `tools/record-write-fixtures.cjs`
 * (funkcje `zbudujPiaskownice`, `zainstalujZaleznosci`, `uruchomOryginal`) — z jedną
 * świadomą różnicą: NIE stosujemy `przygotujBaze()`/`migrujKonwencje()`. Wyrocznia ma
 * chodzić na surowym snapshocie, bo migracje konwencji to NASZ kod, a nie produkcji
 * (plan.md D2). Dla `history`/`audit_log` nie ma to znaczenia (D6, sprawdzane asercją
 * startową), a dla zadania B rozwiązujemy to doborem produktu.
 *
 * Użycie (Node ≥ 20):
 *   node docs/tickets/59-CHORE-i14j-oracle-diff-historii/oracle-diff-historii.cjs
 *   … --zasiew-eksportu     drugi przebieg: doszywa identyczne wiersze eksportu (plan.md D3)
 *   … --zostaw-piaskownice  nie kasuje katalogów tymczasowych (do grzebania po fakcie)
 *
 * Wynik: `wynik-oracle-diff.json` (pełny) + `wynik-oracle-diff-zasiew.json` obok tego pliku
 * oraz podsumowanie na stdout.
 */

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const net = require("node:net");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");

const KATALOG_TICKETA = __dirname;
const KORZEN = path.resolve(KATALOG_TICKETA, "..", "..", "..");
const ZRODLO_BACKENDU = path.join(KORZEN, "mirror", "backend");
const KATALOG_ODBUDOWY = path.join(KORZEN, "rebuild", "backend");

/** Hasło z WŁASNEGO seeda oryginału (`mirror/backend/index.cjs`, `hashSync("Bridge2026!", 10)`). */
const HASLO_SEEDA = "Bridge2026!";
/** Sekret tylko dla piaskownicy — nigdzie nie wychodzi poza katalog tymczasowy. */
const SEKRET_PIASKOWNICY = "piaskownica-14j-oracle-diff";
const KONTO = "marta.bieguniak@agrowiec.eu";

const ZASIEW_EKSPORTU = process.argv.includes("--zasiew-eksportu");
const ZOSTAW_PIASKOWNICE = process.argv.includes("--zostaw-piaskownice");

const PLIK_WYNIKU = path.join(
  KATALOG_TICKETA,
  ZASIEW_EKSPORTU ? "wynik-oracle-diff-zasiew.json" : "wynik-oracle-diff.json",
);

/**
 * Katalogi tymczasowe do posprzątania — rejestrowane W MOMENCIE UTWORZENIA, nie na końcu.
 *
 * Sprzątanie wisi na `finally` wokół CAŁEGO `main()`, a nie tylko wokół bloku z serwerami:
 * wywrotka przed startem serwerów (np. `npm ci`, migracje, asercja startowa) zostawiała
 * inaczej w `/tmp` kopię całego `mirror/backend` razem z `node_modules` i kopię bazy.
 */
const PIASKOWNICE = [];

function log(tekst) {
  console.log(tekst);
}

function posprzatajPiaskownice() {
  if (PIASKOWNICE.length === 0) return;
  if (ZOSTAW_PIASKOWNICE) {
    log(`\nPiaskownice zostawione (--zostaw-piaskownice):\n  ${PIASKOWNICE.join("\n  ")}`);
    return;
  }
  for (const katalog of PIASKOWNICE) fs.rmSync(katalog, { recursive: true, force: true });
}

function czekaj(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wolny port od systemu — stały port byłby proszeniem się o „port in use" (równoległe karty). */
function wolnyPort() {
  return new Promise((resolve, reject) => {
    const serwer = net.createServer();
    serwer.once("error", reject);
    serwer.listen(0, "127.0.0.1", () => {
      const { port } = serwer.address();
      serwer.close(() => resolve(port));
    });
  });
}

/**
 * `db/snapshot.db` jest w `.gitignore`, więc w worktree ticketa go NIE MA — leży wyłącznie
 * w głównym repo. Kolejność: jawny `BRIDGE_SNAPSHOT`, własny katalog, główne repo.
 * Skopiowane z `tools/record-write-fixtures.cjs:48-69`.
 */
function znajdzSnapshot() {
  const kandydaci = [];
  if (process.env.BRIDGE_SNAPSHOT) kandydaci.push(path.resolve(process.env.BRIDGE_SNAPSHOT));
  kandydaci.push(path.join(KORZEN, "db", "snapshot.db"));
  try {
    const wspolny = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: KORZEN, encoding: "utf8" },
    ).trim();
    kandydaci.push(path.join(path.dirname(wspolny), "db", "snapshot.db"));
  } catch {
    /* nie repo git albo stary git — zostają pozostałe ścieżki */
  }
  const znaleziony = kandydaci.find((p) => fs.existsSync(p));
  if (!znaleziony) {
    throw new Error(
      `Nie znaleziono db/snapshot.db. Sprawdzone: ${kandydaci.join(", ")}. ` +
        "Wskaż plik przez BRIDGE_SNAPSHOT=/sciezka/do/snapshot.db",
    );
  }
  return znaleziony;
}

// ————————————————————————————————————————————————————————————————————————————
// Piaskownice
// ————————————————————————————————————————————————————————————————————————————

/**
 * Kopia oryginału + kopia bazy w JEDNYM katalogu.
 *
 * ⚠ Baza MUSI leżeć obok `index.cjs` i proces MUSI startować z tego katalogu — oryginał
 * otwiera bazę relatywnie (`new Database("data.db")`), ale `POST /api/products/clear`
 * robi kopię przez `path.join(__dirname, "data.db")`.
 */
function zbudujPiaskowniceOryginalu(snapshot) {
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-14j-oryginal-"));
  PIASKOWNICE.push(katalog);
  log(`[1/7] Piaskownica oryginału: ${katalog}`);
  fs.cpSync(ZRODLO_BACKENDU, katalog, { recursive: true });
  fs.copyFileSync(snapshot, path.join(katalog, "data.db"));
  // Snapshot chodził w WAL — bez tych plików SQLite otworzy bazę czysto.
  for (const przyrostek of ["-wal", "-shm"]) {
    const plik = path.join(katalog, `data.db${przyrostek}`);
    if (fs.existsSync(plik)) fs.rmSync(plik);
  }
  return katalog;
}

/**
 * ⚠ `npm ci`, NIE `npm install` — i to jest istotne, nie kosmetyczne.
 *
 * `mirror/backend/package.json` wymienia SZEŚĆ zależności, ale `package-lock.json` ma ich
 * więcej — m.in. `archiver@5.3.2`, którego `package.json` nie deklaruje, a z którego korzysta
 * gałąź ZIP w `GET /api/export-shoper` (`deminified/backend-index.cjs:48139`, `:48786`).
 * `npm install` odtwarza `package.json` i archivera NIE stawia, więc trasa oddaje 500 z powodu
 * piaskownicy, a nie z powodu produkcji. `npm ci` odtwarza lockfile, czyli `node_modules`
 * produkcji. Pierwszy przebieg tego pomiaru poszedł przez `npm install` i dał dokładnie takie
 * fałszywe 500 — stąd ten komentarz.
 */
function zainstalujZaleznosci(katalog) {
  const maLock = fs.existsSync(path.join(katalog, "package-lock.json"));
  log(`[2/7] ${maLock ? "npm ci" : "npm install"} w piaskownicy oryginału…`);
  execFileSync(
    "npm",
    maLock
      ? ["ci", "--no-audit", "--no-fund", "--loglevel", "error"]
      : ["install", "--no-audit", "--no-fund", "--loglevel", "error"],
    { cwd: katalog, stdio: ["ignore", "ignore", "inherit"] },
  );
  const archiver = fs.existsSync(path.join(katalog, "node_modules", "archiver"));
  log(`      archiver w piaskownicy: ${archiver ? "JEST" : "BRAK"}`);
}

/**
 * Wygaszenie schedulera w KOPII bazy oryginału — konieczne i jedyne, co jej robimy.
 *
 * `startScheduler` (`mirror/backend/extensions.cjs:811-838`) tika co 60 s i dla każdego
 * dostawcy z ustawionym `czestotliwosc_minuty` odpala REALNE pobranie pliku z URL-a
 * dostawcy. W snapshocie ma to ustawione 6 z 10 dostawców.
 *
 * Dla samego pomiaru historii scheduler i tak nic by nie zepsuł — `L4()`/`D4()` wołają
 * wyłącznie `addAlert`/`updateSupplier` i NIE piszą do `audit_log` ani `history` (plan.md D8).
 * Wygaszamy go z powodu ruchu sieciowego na zewnątrz, nie z powodu danych.
 */
function wygasScheduler(katalogOryginalu) {
  const Database = require(path.join(katalogOryginalu, "node_modules", "better-sqlite3"));
  const db = new Database(path.join(katalogOryginalu, "data.db"));
  try {
    const wynik = db.prepare("UPDATE suppliers SET czestotliwosc_minuty = NULL").run();
    log(`      scheduler wygaszony dla ${wynik.changes} dostawców`);
  } finally {
    db.close();
  }
}

/**
 * Kopia bazy dla odbudowy + migracje 001–006.
 *
 * Migracje NIE dotykają `history` ani `audit_log` (plan.md D6) — sprawdza to asercja
 * startowa, a nie nasza wiara.
 */
function zbudujBazeOdbudowy(snapshot) {
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-14j-odbudowa-"));
  PIASKOWNICE.push(katalog);
  const sciezka = path.join(katalog, "data.db");
  log(`[3/7] Kopia bazy dla odbudowy: ${sciezka}`);
  fs.copyFileSync(snapshot, sciezka);
  for (const przyrostek of ["-wal", "-shm"]) {
    const plik = `${sciezka}${przyrostek}`;
    if (fs.existsSync(plik)) fs.rmSync(plik);
  }
  return { katalog, sciezka };
}

function zastosujMigracjeOdbudowy(sciezkaBazy) {
  log("[4/7] Migracje odbudowy (npm run migrate:dev)…");
  const wyjscie = execFileSync("npm", ["run", "--silent", "migrate:dev"], {
    cwd: KATALOG_ODBUDOWY,
    env: { ...process.env, DB_PATH: sciezkaBazy, JWT_SECRET: SEKRET_PIASKOWNICY },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const linie = wyjscie.trim().split("\n").filter(Boolean);
  for (const linia of linie.slice(-8)) log(`      ${linia}`);
}

/**
 * Zasiew gałęzi „eksport" (plan.md D3) — IDENTYCZNE wiersze po obu stronach.
 *
 * W `db/snapshot.db` nie ma ani jednego `eksport_csv`, `eksport_shoper` ani
 * `import_cennika`, więc trzy z pięciu akcji słownika `typWpisu()` są na żywych danych
 * nieosiągalne: pole `format`, tekst `uwagi: "Format: …"` i filtr `typ=eksport` zostałyby
 * bez pomiaru. Wiersze mają JAWNE `id` i `kiedy`, żeby obie strony dostały bit w bit to samo.
 *
 * ⚠ To są dane NASZE, nie produkcji. Raport musi ten przebieg trzymać osobno od przebiegu
 * na surowych danych produkcji.
 */
const WIERSZE_ZASIEWU = [
  {
    akcja: "eksport_csv",
    encja_typ: "eksport",
    encja_id: "csv",
    szczegoly_json: JSON.stringify({ liczbaProduktow: 7405, dostawca: "MO3" }),
    kiedy: "2026-08-12T09:15:00.000Z",
  },
  {
    akcja: "eksport_shoper",
    encja_typ: "eksport",
    encja_id: "shoper",
    szczegoly_json: JSON.stringify({ liczbaDostawcow: 10 }),
    kiedy: "2026-08-12T10:20:00.000Z",
  },
  {
    // Eksport BEZ żadnej liczby w szczegółach — sprawdza łańcuch fallbacków `pierwszaLiczba`
    // (`liczbaProduktow ?? liczbaDostawcow`) do `null`.
    akcja: "eksport_csv",
    encja_typ: "eksport",
    encja_id: "csv-bez-liczby",
    szczegoly_json: JSON.stringify({ cos: "innego" }),
    kiedy: "2026-08-12T11:25:00.000Z",
  },
  {
    akcja: "import_cennika",
    encja_typ: "dostawca",
    encja_id: "MO6",
    szczegoly_json: JSON.stringify({ nazwaPliku: "cennik-testowy.csv", wczytanych: 512 }),
    kiedy: "2026-08-12T12:30:00.000Z",
  },
  {
    // Import BEZ nazwy pliku — sprawdza gałąź „Plik: ?" z §8.1 instrukcji I5.
    akcja: "import_cennika",
    encja_typ: "dostawca",
    encja_id: "MO6",
    szczegoly_json: null,
    kiedy: "2026-08-12T13:35:00.000Z",
  },
];

function zasiejEksport(Database, sciezkaBazy, etykieta) {
  const db = new Database(sciezkaBazy);
  try {
    const maks = db.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM audit_log").get().m;
    const wstaw = db.prepare(
      `INSERT INTO audit_log (id, uzytkownik_id, uzytkownik_imie, akcja, encja_typ, encja_id,
                              szczegoly_json, kiedy)
       VALUES (@id, 1, 'Marta Bieguniak', @akcja, @encja_typ, @encja_id, @szczegoly_json, @kiedy)`,
    );
    WIERSZE_ZASIEWU.forEach((wiersz, i) => wstaw.run({ ...wiersz, id: maks + 1 + i }));
    log(`      ${etykieta}: doszyto ${WIERSZE_ZASIEWU.length} wierszy od id ${maks + 1}`);
  } finally {
    db.close();
  }
}

// ————————————————————————————————————————————————————————————————————————————
// Start serwerów
// ————————————————————————————————————————————————————————————————————————————

/** Gotowość obu stron: `GET /api/me` bez tokenu ma oddać 401. */
async function czekajNaGotowosc(port, proces, nazwa, dziennik) {
  for (let proba = 0; proba < 120; proba += 1) {
    if (proces.exitCode !== null) {
      throw new Error(`${nazwa} zakończył się przedwcześnie. Log startu:\n${dziennik()}`);
    }
    try {
      const odp = await fetch(`http://127.0.0.1:${port}/api/me`);
      if (odp.status === 401) {
        log(`      ${nazwa} odpowiada na ${port}`);
        return;
      }
    } catch {
      /* jeszcze nie słucha */
    }
    await czekaj(250);
  }
  proces.kill("SIGKILL");
  throw new Error(`${nazwa} nie wstał w 30 s. Log startu:\n${dziennik()}`);
}

function zbierzDziennik(proces) {
  let tekst = "";
  proces.stdout.on("data", (k) => (tekst += k));
  proces.stderr.on("data", (k) => (tekst += k));
  proces.on("error", (b) => (tekst += `\n[spawn] ${b.message}`));
  return () => tekst;
}

async function uruchomOryginal(katalog, port) {
  log(`[5/7] Start oryginału (mirror/backend/index.cjs) na porcie ${port}…`);
  const proces = spawn(process.execPath, ["index.cjs"], {
    cwd: katalog,
    env: { ...process.env, PORT: String(port), JWT_SECRET: SEKRET_PIASKOWNICY },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const dziennik = zbierzDziennik(proces);
  await czekajNaGotowosc(port, proces, "oryginał", dziennik);
  return { proces, dziennik };
}

async function uruchomOdbudowe(sciezkaBazy, port) {
  log(`[6/7] Start odbudowy (rebuild/backend, tsx src/server.ts) na porcie ${port}…`);
  const proces = spawn("npx", ["tsx", "src/server.ts"], {
    cwd: KATALOG_ODBUDOWY,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DB_PATH: sciezkaBazy,
      JWT_SECRET: SEKRET_PIASKOWNICY,
      NODE_ENV: "development",
      // Automat pollingu jest domyślnie wyłączony, ale wypisujemy to jawnie,
      // żeby nie zależeć od domyślnej wartości przy zmianie konfiguracji.
      IMPORT_SCHEDULER: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const dziennik = zbierzDziennik(proces);
  await czekajNaGotowosc(port, proces, "odbudowa", dziennik);
  return { proces, dziennik };
}

// ————————————————————————————————————————————————————————————————————————————
// Klient HTTP
// ————————————————————————————————————————————————————————————————————————————

async function zaloguj(port, nazwa) {
  const odp = await fetch(`http://127.0.0.1:${port}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: KONTO, password: HASLO_SEEDA }),
  });
  const cialo = await odp.json().catch(() => ({}));
  if (!cialo.token) {
    throw new Error(
      `Logowanie do „${nazwa}" nie dało tokenu (HTTP ${odp.status}). ` +
        "Konta w snapshocie mają inne hasło niż seed oryginału — sprawdź `users` w kopii.",
    );
  }
  return cialo.token;
}

async function pobierz(port, sciezka, token) {
  const odp = await fetch(`http://127.0.0.1:${port}${sciezka}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const tekst = await odp.text();
  let cialo;
  try {
    cialo = JSON.parse(tekst);
  } catch {
    cialo = { _nieJSON: tekst.slice(0, 400) };
  }
  return { status: odp.status, cialo };
}

// ————————————————————————————————————————————————————————————————————————————
// Porównanie
// ————————————————————————————————————————————————————————————————————————————

/**
 * Głęboka równość z RAPORTEM ŚCIEŻKI pierwszych różnic — „nie zgadza się" bez wskazania
 * miejsca byłoby bezużyteczne przy 46 916 wierszach.
 *
 * ⚠ Nie odsiewamy tu niczego. Adnotacje nagrywarki (`_body_przyciete_z`, `_przyciete`)
 * żyją w plikach `contract/fixtures/`, a NIE w odpowiedziach HTTP — porównujemy dwa żywe
 * backendy, więc po obu stronach ich nie ma.
 */
function roznice(a, b, sciezka = "", zebrane = [], limit = 25) {
  if (zebrane.length >= limit) return zebrane;

  if (a === b) return zebrane;

  const typA = Array.isArray(a) ? "array" : a === null ? "null" : typeof a;
  const typB = Array.isArray(b) ? "array" : b === null ? "null" : typeof b;

  if (typA !== typB) {
    zebrane.push({ sciezka: sciezka || "(korzeń)", oryginal: skroc(a), odbudowa: skroc(b) });
    return zebrane;
  }

  if (typA === "array") {
    if (a.length !== b.length) {
      zebrane.push({
        sciezka: `${sciezka}.length`,
        oryginal: a.length,
        odbudowa: b.length,
      });
    }
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n && zebrane.length < limit; i += 1) {
      roznice(a[i], b[i], `${sciezka}[${i}]`, zebrane, limit);
    }
    return zebrane;
  }

  if (typA === "object") {
    const kluczeA = Object.keys(a).sort();
    const kluczeB = Object.keys(b).sort();
    if (kluczeA.join(",") !== kluczeB.join(",")) {
      zebrane.push({
        sciezka: `${sciezka} (ZESTAW KLUCZY)`,
        oryginal: kluczeA.join(","),
        odbudowa: kluczeB.join(","),
      });
      return zebrane;
    }
    for (const klucz of kluczeA) {
      if (zebrane.length >= limit) break;
      roznice(a[klucz], b[klucz], sciezka ? `${sciezka}.${klucz}` : klucz, zebrane, limit);
    }
    return zebrane;
  }

  zebrane.push({ sciezka: sciezka || "(korzeń)", oryginal: skroc(a), odbudowa: skroc(b) });
  return zebrane;
}

function skroc(wartosc) {
  const tekst = typeof wartosc === "string" ? wartosc : JSON.stringify(wartosc);
  if (tekst === undefined) return String(wartosc);
  return tekst.length > 160 ? `${tekst.slice(0, 160)}…` : tekst;
}

/** Ile „wpisów" niesie odpowiedź — do rzetelnego „0 różnic NA CZYM". */
function policzWpisy(cialo) {
  if (Array.isArray(cialo)) return cialo.length;
  if (cialo && Array.isArray(cialo.items)) return cialo.items.length;
  if (cialo && Array.isArray(cialo.dostawcy)) return cialo.dostawcy.length;
  return 0;
}

// ————————————————————————————————————————————————————————————————————————————
// Siatka przypadków
// ————————————————————————————————————————————————————————————————————————————

function zbudujSiatke(dostawcy) {
  const przypadki = [
    { grupa: "/api/history", opis: "bez parametrów (cała tabela)", sciezka: "/api/history" },
    { grupa: "/api/history/meta", opis: "bez parametrów", sciezka: "/api/history/meta" },
    { grupa: "/paged bez filtrów", opis: "domyślne", sciezka: "/api/history/paged" },
  ];

  // Filtr `typ` — wszystkie cztery wartości, które zna UI.
  for (const typ of ["all", "import", "eksport", "edycja"]) {
    przypadki.push({
      grupa: "/paged filtr typ",
      opis: `typ=${typ}`,
      sciezka: `/api/history/paged?typ=${typ}&limit=200`,
    });
  }

  // Filtr `dostawca` — „all" + KAŻDY kod, który oddało `/meta`.
  przypadki.push({
    grupa: "/paged filtr dostawca",
    opis: "dostawca=all",
    sciezka: "/api/history/paged?dostawca=all&limit=200",
  });
  for (const kod of dostawcy) {
    przypadki.push({
      grupa: "/paged filtr dostawca",
      opis: `dostawca=${kod}`,
      sciezka: `/api/history/paged?dostawca=${encodeURIComponent(kod)}&limit=200`,
    });
  }

  // `search` — frazy celowo trafiające w RÓŻNE pola zmapowanego wpisu, bo oryginał
  // przeszukuje `JSON.stringify` całego wpisu, nie wybrane kolumny (§11 pkt 4 instrukcji I5).
  const frazy = [
    "MO3", // kod dostawcy
    "kategoria", // nazwa zmienionego pola
    "Plik:", // tekst składany w `uwagi` przy imporcie
    "import", // nazwa TYPU — trafia, choć podpowiedź UI o tym nie mówi
    "edycja",
    "eksport",
    "Format:",
    "csv",
    "Marta", // użytkownik
    ".csv", // fragment nazwy pliku
    "ZZZ-nie-istnieje", // kontrola: pusty wynik po obu stronach
    "", // kontrola: pusty `search` nie filtruje
  ];
  for (const fraza of frazy) {
    przypadki.push({
      grupa: "/paged filtr search",
      opis: `search=${JSON.stringify(fraza)}`,
      sciezka: `/api/history/paged?search=${encodeURIComponent(fraza)}&limit=200`,
    });
  }

  // Paginacja — trzy rozmiary strony × kolejne strony, łącznie z pierwszą PUSTĄ.
  for (const limit of [25, 50, 100]) {
    for (const page of [1, 2, 3, 4, 11, 12]) {
      przypadki.push({
        grupa: "/paged paginacja",
        opis: `limit=${limit}&page=${page}`,
        sciezka: `/api/history/paged?limit=${limit}&page=${page}`,
      });
    }
  }

  // Skrajne i zepsute wartości paginacji — tu oryginał ma własną arytmetykę
  // (`parseInt(...) || 1` PO parsowaniu), inną niż `pagination_module.cjs`.
  for (const surowe of [
    "limit=0",
    "limit=1",
    "limit=201",
    "limit=abc",
    "page=0",
    "page=abc",
    "page=-3",
    "page=99999",
    "limit=25&page=2&typ=edycja",
    "limit=25&page=2&dostawca=MO3",
    "typ=edycja&search=kategoria&limit=10&page=2",
    "typ=nieznany",
    "dostawca=NIE-MA-TAKIEGO",
  ]) {
    przypadki.push({
      grupa: "/paged skrajne",
      opis: surowe,
      sciezka: `/api/history/paged?${surowe}`,
    });
  }

  return przypadki;
}

// ————————————————————————————————————————————————————————————————————————————
// Asercje startowe
// ————————————————————————————————————————————————————————————————————————————

/**
 * Bez tego porównanie byłoby nieuczciwe: sprawdzamy POMIAREM, że migracje odbudowy
 * nie ruszyły `history` ani `audit_log` (plan.md D6) i że obie strony patrzą na te same dane.
 */
function asercjeStartowe(Database, sciezkaOryginalu, sciezkaOdbudowy) {
  const czytaj = (sciezka) => {
    const db = new Database(sciezka, { readonly: true });
    try {
      const stan = {};
      for (const tabela of ["history", "audit_log"]) {
        stan[tabela] = {
          wierszy: db.prepare(`SELECT COUNT(*) AS c FROM ${tabela}`).get().c,
          kolumny: db
            .prepare(`PRAGMA table_info(${tabela})`)
            .all()
            .map((k) => `${k.name}:${k.type}`)
            .join(","),
          sumaKontrolna: db
            .prepare(
              `SELECT COUNT(*) AS c, COALESCE(SUM(id), 0) AS s, COALESCE(MIN(id), 0) AS mn,
                      COALESCE(MAX(id), 0) AS mx FROM ${tabela}`,
            )
            .get(),
        };
      }
      return stan;
    } finally {
      db.close();
    }
  };

  const oryginal = czytaj(sciezkaOryginalu);
  const odbudowa = czytaj(sciezkaOdbudowy);
  const roznica = roznice(oryginal, odbudowa);

  if (roznica.length > 0) {
    throw new Error(
      "ASERCJA STARTOWA PADŁA: `history`/`audit_log` różnią się między kopiami PRZED pomiarem. " +
        "Porównanie byłoby nieuczciwe. Różnice:\n" +
        roznica.map((r) => `  ${r.sciezka}: oryginał=${r.oryginal} odbudowa=${r.odbudowa}`).join("\n"),
    );
  }

  log(
    `      OK — history: ${oryginal.history.wierszy} wierszy, ` +
      `audit_log: ${oryginal.audit_log.wierszy} wierszy, schematy identyczne`,
  );
  return oryginal;
}

// ————————————————————————————————————————————————————————————————————————————
// Główny przebieg
// ————————————————————————————————————————————————————————————————————————————

async function main() {
  const snapshot = znajdzSnapshot();
  log(`Snapshot: ${snapshot}`);
  log(ZASIEW_EKSPORTU ? "TRYB: przebieg z ZASIANĄ gałęzią eksportu (plan.md D3)\n" : "TRYB: dane produkcji, bez zasiewu\n");

  const katalogOryginalu = zbudujPiaskowniceOryginalu(snapshot);
  zainstalujZaleznosci(katalogOryginalu);
  wygasScheduler(katalogOryginalu);

  const { katalog: katalogOdbudowy, sciezka: bazaOdbudowy } = zbudujBazeOdbudowy(snapshot);
  zastosujMigracjeOdbudowy(bazaOdbudowy);

  const Database = require(path.join(katalogOryginalu, "node_modules", "better-sqlite3"));
  const bazaOryginalu = path.join(katalogOryginalu, "data.db");

  if (ZASIEW_EKSPORTU) {
    log("      zasiew gałęzi eksportu (identyczny po obu stronach)…");
    zasiejEksport(Database, bazaOryginalu, "oryginał");
    zasiejEksport(Database, bazaOdbudowy, "odbudowa");
  }

  log("[7/7] Asercje startowe (history / audit_log po obu stronach)…");
  const stanBaz = asercjeStartowe(Database, bazaOryginalu, bazaOdbudowy);

  const portOryginalu = await wolnyPort();
  const portOdbudowy = await wolnyPort();

  let oryginal;
  let odbudowa;
  const raport = {
    kiedy: new Date().toISOString(),
    tryb: ZASIEW_EKSPORTU ? "zasiew-eksportu" : "dane-produkcji",
    snapshot,
    stanBaz,
    przypadki: [],
    zadanieB: null,
    podsumowanie: null,
  };

  try {
    oryginal = await uruchomOryginal(katalogOryginalu, portOryginalu);
    odbudowa = await uruchomOdbudowe(bazaOdbudowy, portOdbudowy);

    const logStartu = oryginal.dziennik();
    const schedulerWLogu = (logStartu.match(/\[scheduler\][^\n]*/g) || []).join(" | ");
    raport.schedulerOryginalu = schedulerWLogu || "(brak linii [scheduler] w logu)";
    log(`      log oryginału: ${raport.schedulerOryginalu}`);

    const tokenOryginalu = await zaloguj(portOryginalu, "oryginał");
    const tokenOdbudowy = await zaloguj(portOdbudowy, "odbudowa");
    log("      obie strony zalogowane\n");

    // Lista dostawców do siatki bierze się z `/meta` ORYGINAŁU — to on jest wzorcem.
    const metaOryginalu = await pobierz(portOryginalu, "/api/history/meta", tokenOryginalu);
    const dostawcy = (metaOryginalu.cialo && metaOryginalu.cialo.dostawcy) || [];

    const siatka = zbudujSiatke(dostawcy);
    log(`Porównuję ${siatka.length} przypadków…`);

    let wpisyLacznie = 0;
    let zgodne = 0;

    for (const przypadek of siatka) {
      const a = await pobierz(portOryginalu, przypadek.sciezka, tokenOryginalu);
      const b = await pobierz(portOdbudowy, przypadek.sciezka, tokenOdbudowy);

      const wpisy = policzWpisy(a.cialo);
      wpisyLacznie += wpisy;

      const roznicaCiala = roznice(a.cialo, b.cialo);
      // Kod odpowiedzi POMIJAMY jako znalezisko — `requireAuth` w odbudowie to zatwierdzone
      // odstępstwo (D1 z I1), a obie strony i tak pytamy z tokenem, więc obie mają 200.
      const wynik = {
        grupa: przypadek.grupa,
        opis: przypadek.opis,
        sciezka: przypadek.sciezka,
        statusOryginalu: a.status,
        statusOdbudowy: b.status,
        wpisow: wpisy,
        total: a.cialo && typeof a.cialo.total === "number" ? a.cialo.total : null,
        kluczeWpisu:
          Array.isArray(a.cialo) && a.cialo[0]
            ? Object.keys(a.cialo[0]).sort().join(",")
            : a.cialo && Array.isArray(a.cialo.items) && a.cialo.items[0]
              ? Object.keys(a.cialo.items[0]).sort().join(",")
              : null,
        roznice: roznicaCiala,
      };
      if (roznicaCiala.length === 0) zgodne += 1;
      raport.przypadki.push(wynik);

      const znacznik = roznicaCiala.length === 0 ? "  ok" : "RÓŻNI";
      log(`  [${znacznik}] ${przypadek.grupa} — ${przypadek.opis} (${wpisy} wpisów)`);
      if (roznicaCiala.length > 0) {
        for (const r of roznicaCiala.slice(0, 5)) {
          log(`          ${r.sciezka}\n            oryginał: ${r.oryginal}\n            odbudowa: ${r.odbudowa}`);
        }
      }
    }

    raport.podsumowanie = {
      przypadkow: siatka.length,
      zgodnych: zgodne,
      rozjazdow: siatka.length - zgodne,
      wpisowPorownanych: wpisyLacznie,
    };

    // ——— WYROCZNIA DLA TRWAŁEGO TESTU ———————————————————————————————————
    // Świadomie PRZED zadaniem B, które mutuje obie bazy — wyrocznia ma zamrażać stan
    // produkcji, a nie skutki naszych edycji.
    if (!ZASIEW_EKSPORTU) {
      await zapiszWyrocznie({
        Database,
        bazaOryginalu,
        portOryginalu,
        tokenOryginalu,
      });
    }

    // ——— ZADANIE B ————————————————————————————————————————————————————————
    // Świadomie PO zadaniu A: mutuje obie bazy, więc wcześniej zafałszowałoby diff.
    // Błąd zadania B NIE może skasować wyniku zadania A — pierwszy przebieg pomiaru stracił
    // w ten sposób komplet 59 porównań przez wywrotkę doboru produktu.
    if (!ZASIEW_EKSPORTU) {
      try {
        raport.zadanieB = await zadanieB({
          Database,
          bazaOryginalu,
          bazaOdbudowy,
          portOryginalu,
          portOdbudowy,
          tokenOryginalu,
          tokenOdbudowy,
          dziennikOryginalu: oryginal.dziennik,
        });
      } catch (blad) {
        log(`\n  ZADANIE B PADŁO: ${blad.message}`);
        raport.zadanieB = { blad: blad.message };
      }
    }
  } finally {
    // Tylko procesy — katalogi sprząta `posprzatajPiaskownice()` wokół całego `main()`,
    // żeby wywrotka PRZED tym blokiem też ich nie zostawiała.
    for (const strona of [oryginal, odbudowa]) {
      if (strona && strona.proces.exitCode === null) strona.proces.kill("SIGKILL");
    }
    await czekaj(300);
  }

  fs.writeFileSync(PLIK_WYNIKU, `${JSON.stringify(raport, null, 2)}\n`);
  log(`\nWynik zapisany: ${PLIK_WYNIKU}`);

  const p = raport.podsumowanie;
  log(
    `\n═══ ${p.zgodnych}/${p.przypadkow} przypadków ZGODNYCH · ` +
      `${p.rozjazdow} rozjazdów · ${p.wpisowPorownanych} wpisów porównanych ═══`,
  );
  if (p.rozjazdow > 0) process.exitCode = 1;
}

// ————————————————————————————————————————————————————————————————————————————
// Wyrocznia dla trwałego testu (plan.md D1)
// ————————————————————————————————————————————————————————————————————————————

/** Przypadki, których odpowiedzi ORYGINAŁU zamrażamy w bramkach. */
const PRZYPADKI_WYROCZNI = [
  { nazwa: "meta", sciezka: "/api/history/meta" },
  { nazwa: "paged-domyslne", sciezka: "/api/history/paged" },
  { nazwa: "paged-typ-import", sciezka: "/api/history/paged?typ=import&limit=25" },
  { nazwa: "paged-typ-edycja-strona2", sciezka: "/api/history/paged?typ=edycja&limit=25&page=2" },
  { nazwa: "paged-dostawca-MO1", sciezka: "/api/history/paged?dostawca=MO1&limit=25" },
  { nazwa: "paged-search-plik", sciezka: "/api/history/paged?search=Plik%3A&limit=25" },
  { nazwa: "paged-limit-0", sciezka: "/api/history/paged?limit=0" },
  { nazwa: "paged-page-abc", sciezka: "/api/history/paged?page=abc" },
];

/** Ile wierszy `history` wchodzi do wyroczni `GET /api/history`. */
const WIERSZY_DZIENNIKA_DO_WYROCZNI = 20;

/**
 * Zapis wyroczni: wejście (surowe wiersze ze snapshotu) + wyjście (odpowiedzi ORYGINAŁU).
 *
 * Dzięki temu `rebuild/backend/test/historia.wyrocznia.test.ts` chodzi w zwykłych bramkach,
 * bez stawiania oryginału, a mimo to porównuje się z NIM, a nie sam ze sobą.
 *
 * ⚠ DLACZEGO PODZBIÓR `audit_log` WYSTARCZY, a wynik zostaje identyczny: do widoku wchodzi
 * wyłącznie pięć akcji ze słownika `typWpisu()`, reszta odpada przez `filter(Boolean)` PRZED
 * filtrowaniem i paginacją. Wiersze nierozpoznane nie zmieniają więc ani treści, ani kolejności,
 * ani `total`. Jedyne, co mogłyby zmienić, to `LIMIT 5000` — a ten w snapshocie nie gryzie
 * (3873 wiersze, backlog #87), co skrypt zapisuje w `kontrolaLimitu` jako warunek ważności.
 *
 * Dla `GET /api/history` bierzemy PIERWSZE `WIERSZY_DZIENNIKA_DO_WYROCZNI` wierszy odpowiedzi
 * oryginału i dokładnie te wiersze jako zasiew — trasa to gołe `ORDER BY data DESC` po całej
 * tabeli, więc na podzbiorze odtwarza tę samą kolejność względną.
 */
async function zapiszWyrocznie(ctx) {
  log("\n═══ WYROCZNIA dla trwałego testu ═══");
  const db = new ctx.Database(ctx.bazaOryginalu, { readonly: true });
  let zasiewAudytu;
  let wszystkichAudytu;
  try {
    wszystkichAudytu = db.prepare("SELECT COUNT(*) AS c FROM audit_log").get().c;
    zasiewAudytu = db
      .prepare(
        `SELECT * FROM audit_log
          WHERE akcja IN ('upload_pliku','import_cennika','eksport_csv','eksport_shoper','edycja_produktu')
          ORDER BY id`,
      )
      .all();
  } finally {
    db.close();
  }

  const dziennik = await pobierz(ctx.portOryginalu, "/api/history", ctx.tokenOryginalu);

  /**
   * ⚠ BIERZEMY TYLKO WIERSZE O UNIKALNEJ `data` — i to nie jest kosmetyka.
   *
   * `GET /api/history` sortuje wyłącznie `ORDER BY data DESC`, bez tiebreakera. Przy remisie
   * czasowym kolejność zależy od planu zapytania SQLite, a ten może być inny na tabeli
   * z 46 916 wierszami (oryginał) niż na 20-wierszowej tabeli testowej. Wyrocznia z remisami
   * dawałaby więc asercję, która dziś przechodzi, a jutro potrafi zaświecić bez żadnej zmiany
   * w kodzie. Pierwsze nagranie miało 18 unikalnych dat na 20 wierszy, czyli dwa remisy.
   *
   * Odsiewając remisy dostajemy podzbiór, w którym `data` wyznacza kolejność JEDNOZNACZNIE,
   * więc test porównuje to, co naprawdę jest zdefiniowane. Nie tracimy przy tym niczego:
   * kolejność przy remisie i tak nie jest kontraktem, ani u nas, ani w produkcji.
   */
  const wierszeDziennika = [];
  const widzianeDaty = new Set();
  for (const wiersz of dziennik.cialo || []) {
    if (wierszeDziennika.length >= WIERSZY_DZIENNIKA_DO_WYROCZNI) break;
    if (widzianeDaty.has(wiersz.data)) continue;
    widzianeDaty.add(wiersz.data);
    wierszeDziennika.push(wiersz);
  }

  const dbDziennik = new ctx.Database(ctx.bazaOryginalu, { readonly: true });
  let zasiewDziennika;
  try {
    const idki = wierszeDziennika.map((w) => w.id);
    zasiewDziennika = dbDziennik
      .prepare(`SELECT * FROM history WHERE id IN (${idki.map(() => "?").join(",")})`)
      .all(...idki);
  } finally {
    dbDziennik.close();
  }

  const odpowiedzi = {};
  for (const przypadek of PRZYPADKI_WYROCZNI) {
    const odp = await pobierz(ctx.portOryginalu, przypadek.sciezka, ctx.tokenOryginalu);
    odpowiedzi[przypadek.nazwa] = { sciezka: przypadek.sciezka, cialo: odp.cialo };
  }

  const wyrocznia = {
    _opis:
      "Wyrocznia nagrana z ŻYWEGO oryginału (mirror/backend/index.cjs) na kopii db/snapshot.db " +
      "przez docs/tickets/59-CHORE-i14j-oracle-diff-historii/oracle-diff-historii.cjs. " +
      "NIE EDYTOWAĆ RĘCZNIE — to zapis tego, co robi produkcja, a nie nasz oczekiwany wynik.",
    _nagrane: new Date().toISOString(),
    _ticket: "59-CHORE-i14j",
    kontrolaLimitu: {
      wierszyAuditLog: wszystkichAudytu,
      limitAudytu: 5000,
      limitNieGryzie: wszystkichAudytu < 5000,
    },
    /**
     * Warunek ważności wyroczni `GET /api/history`: wiersze mają PARAMI RÓŻNE `data`,
     * więc `ORDER BY data DESC` wyznacza ich kolejność jednoznacznie i asercja na kolejność
     * nie zależy od planu zapytania SQLite.
     */
    dziennikBezRemisow:
      new Set(wierszeDziennika.map((w) => w.data)).size === wierszeDziennika.length,
    zasiewAudytu,
    zasiewDziennika,
    dziennikPierwszeWiersze: wierszeDziennika,
    odpowiedzi,
  };

  const plik = path.join(KORZEN, "rebuild", "backend", "test", "historia.wyrocznia.json");
  fs.writeFileSync(plik, `${JSON.stringify(wyrocznia, null, 2)}\n`);
  log(
    `  zapisano: ${plik}\n` +
      `  zasiew: ${zasiewAudytu.length} wierszy audit_log + ${zasiewDziennika.length} wierszy history\n` +
      `  odpowiedzi oryginału: ${Object.keys(odpowiedzi).length} przypadków`,
  );
}

// ————————————————————————————————————————————————————————————————————————————
// Zadanie B — czy nowe ścieżki zostawiają ślad
// ————————————————————————————————————————————————————————————————————————————

/** Pola SPOZA `POLA_EDYTOWALNE_PRODUKTU` (`rebuild/backend/src/repos/products.ts:199-247`). */
const POLE_SPOZA_ALLOWLISTY = "hf";

async function zadanieB(ctx) {
  log("\n═══ ZADANIE B — ślad po edycji i po eksporcie ═══");
  const wynik = { doborProduktu: null, edycjaWspolnymiPolami: null, sondaAllowlisty: null, eksport: null };

  const produkt = dobierzProdukt(ctx.Database, ctx.bazaOryginalu, ctx.bazaOdbudowy);
  wynik.doborProduktu = produkt;
  log(
    `  Produkt: id=${produkt.id} kod=${produkt.kod} ` +
      `(pola edytowane identyczne po obu stronach: ${produkt.poleA}, ${produkt.poleB})`,
  );

  // — scenariusz główny: wyłącznie pola z allowlisty, identyczne ciało po obu stronach —
  const cialo = {
    [produkt.poleA]: produkt.nowaA,
    [produkt.poleB]: produkt.nowaB,
    _reason: "14j pomiar parzystości",
  };
  wynik.edycjaWspolnymiPolami = await porownajEdycje(ctx, produkt.id, produkt.kod, cialo);

  // — sonda allowlisty (plan.md D4): pole, którego odbudowa świadomie nie przepuszcza —
  const cialoSondy = {
    [POLE_SPOZA_ALLOWLISTY]: "14J-SONDA",
    _reason: "14j sonda allowlisty",
  };
  wynik.sondaAllowlisty = await porownajEdycje(ctx, produkt.id, produkt.kod, cialoSondy);
  wynik.sondaAllowlisty.polesondowane = POLE_SPOZA_ALLOWLISTY;

  // — ścieżka eksportu —
  wynik.eksport = await porownajEksport(ctx);

  return wynik;
}

/**
 * Dobór produktu do zadania B (plan.md D2).
 *
 * Migracje 003/004/005/006 zmieniają po stronie ODBUDOWY `products.szerokosc` (REAL→TEXT,
 * czyli PRAKTYCZNIE KAŻDY wiersz), `kategoria`, `konstrukcja` i `nazwa`, a oryginał chodzi
 * na surowym snapshocie. Produkt identyczny CAŁYM wierszem po obu stronach więc nie istnieje
 * — pierwszy przebieg tego pomiaru padł dokładnie na tym założeniu.
 *
 * Porównujemy zatem dokładnie te pola, które WCHODZĄ DO WIERSZA `history`:
 *  • `kod`   → `history.kod_produktu`,
 *  • `nazwa` → `history.nazwa` (migawka nazwy z momentu edycji),
 *  • oba pola edytowane → `history.stara_wartosc`.
 * Reszta wiersza produktu do dziennika nie trafia, więc jej rozjazd pomiaru nie fałszuje.
 *
 * Pola edytowane (`dot`, `labelSnow`) są celowo spoza zasięgu migracji 003–006.
 */
function dobierzProdukt(Database, bazaOryginalu, bazaOdbudowy) {
  const otworz = (s) => new Database(s, { readonly: true });
  const dbO = otworz(bazaOryginalu);
  const dbR = otworz(bazaOdbudowy);
  /** Kolumny SQL, które muszą być po obu stronach identyczne, i ich odpowiedniki w API. */
  const ISTOTNE = ["kod", "nazwa", "dot", "label_snow"];
  try {
    const kandydaci = dbO
      .prepare("SELECT id FROM products WHERE ean IS NOT NULL ORDER BY id LIMIT 2000")
      .all();
    for (const { id } of kandydaci) {
      const a = dbO.prepare(`SELECT id, ${ISTOTNE.join(", ")} FROM products WHERE id = ?`).get(id);
      const b = dbR.prepare(`SELECT id, ${ISTOTNE.join(", ")} FROM products WHERE id = ?`).get(id);
      if (!a || !b) continue;
      if (roznice(a, b).length > 0) continue;
      return {
        id,
        kod: a.kod,
        nazwa: a.nazwa,
        polaPorownane: ISTOTNE,
        poleA: "dot",
        poleB: "labelSnow",
        nowaA: "14J-DOT",
        nowaB: "TAK",
        staraA: a.dot,
        staraB: a.label_snow,
      };
    }
    throw new Error(
      "Nie znalazłem produktu o identycznych polach wchodzących do `history` w pierwszych " +
        "2000 wierszach — rozszerz pulę albo sprawdź, czy migracje nie ruszyły tych pól.",
    );
  } finally {
    dbO.close();
    dbR.close();
  }
}

async function porownajEdycje(ctx, id, kod, cialo) {
  const przed = {
    oryginal: await pobierz(ctx.portOryginalu, "/api/history", ctx.tokenOryginalu),
    odbudowa: await pobierz(ctx.portOdbudowy, "/api/history", ctx.tokenOdbudowy),
  };

  const wyslij = async (port, token) => {
    const odp = await fetch(`http://127.0.0.1:${port}/api/products/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(cialo),
    });
    return odp.status;
  };

  const statusOryginalu = await wyslij(ctx.portOryginalu, ctx.tokenOryginalu);
  const statusOdbudowy = await wyslij(ctx.portOdbudowy, ctx.tokenOdbudowy);

  const po = {
    oryginal: await pobierz(ctx.portOryginalu, "/api/history", ctx.tokenOryginalu),
    odbudowa: await pobierz(ctx.portOdbudowy, "/api/history", ctx.tokenOdbudowy),
  };

  const noweWpisy = (przedOdp, poOdp) => {
    const bylo = new Set((przedOdp.cialo || []).map((w) => w.id));
    return (poOdp.cialo || []).filter((w) => !bylo.has(w.id));
  };

  const noweO = noweWpisy(przed.oryginal, po.oryginal);
  const noweR = noweWpisy(przed.odbudowa, po.odbudowa);

  // Pola zależne od momentu i konta zerujemy — porównujemy TREŚĆ zmiany, nie zegar.
  const porownywalne = (w) => {
    const kopia = { ...w };
    delete kopia.id;
    delete kopia.data;
    return kopia;
  };

  const pagedO = await pobierz(
    ctx.portOryginalu,
    `/api/history/paged?typ=edycja&search=${encodeURIComponent(kod)}&limit=10`,
    ctx.tokenOryginalu,
  );
  const pagedR = await pobierz(
    ctx.portOdbudowy,
    `/api/history/paged?typ=edycja&search=${encodeURIComponent(kod)}&limit=10`,
    ctx.tokenOdbudowy,
  );

  const bezZegara = (cialoPaged) => {
    if (!cialoPaged || !Array.isArray(cialoPaged.items)) return cialoPaged;
    return {
      ...cialoPaged,
      items: cialoPaged.items.map((w) => {
        const kopia = { ...w };
        delete kopia.id;
        delete kopia.kiedy;
        return kopia;
      }),
    };
  };

  const wynik = {
    cialoZadania: cialo,
    statusOryginalu,
    statusOdbudowy,
    wpisowHistory: { oryginal: noweO.length, odbudowa: noweR.length },
    noweWpisyHistory: {
      oryginal: noweO.map(porownywalne),
      odbudowa: noweR.map(porownywalne),
    },
    rozniceHistory: roznice(noweO.map(porownywalne), noweR.map(porownywalne)),
    totalPaged: {
      oryginal: pagedO.cialo && pagedO.cialo.total,
      odbudowa: pagedR.cialo && pagedR.cialo.total,
    },
    roznicePaged: roznice(bezZegara(pagedO.cialo), bezZegara(pagedR.cialo)),
  };

  log(
    `  PATCH ${JSON.stringify(Object.keys(cialo).filter((k) => k !== "_reason"))} → ` +
      `history: oryginał ${noweO.length} / odbudowa ${noweR.length} wierszy · ` +
      `paged total: ${wynik.totalPaged.oryginal} / ${wynik.totalPaged.odbudowa}`,
  );
  return wynik;
}

/**
 * Ścieżka eksportu — karta zakłada, że odbudowa może tych akcji nie zapisywać.
 * Sprawdzamy to POMIAREM, po obu stronach.
 */
async function porownajEksport(ctx) {
  const policz = (Database, sciezka) => {
    const db = new Database(sciezka, { readonly: true });
    try {
      return db
        .prepare(
          "SELECT akcja, COUNT(*) AS c FROM audit_log WHERE akcja IN ('eksport_csv','eksport_shoper') GROUP BY akcja",
        )
        .all();
    } finally {
      db.close();
    }
  };

  const przed = {
    oryginal: policz(ctx.Database, ctx.bazaOryginalu),
    odbudowa: policz(ctx.Database, ctx.bazaOdbudowy),
  };

  const dziennikPrzed = ctx.dziennikOryginalu ? ctx.dziennikOryginalu().length : 0;

  // Trzy ścieżki, bo `/api/export-shoper` ma DWIE różne gałęzie kodu i trzeba je rozdzielić:
  //  • bez `?dostawca=` → gałąź „wszyscy" (ZIP przez `archiver`), audyt `eksport_csv`;
  //  • z konkretnym kodem → gałąź CSV, bez `archiver`, też audyt `eksport_csv`;
  //  • `/api/export/shoper` → osobna trasa, audyt `eksport_shoper`.
  // Bez rozdzielenia pierwszych dwóch nie dałoby się powiedzieć, czy 500 oryginału dotyczy
  // całej trasy, czy wyłącznie ZIP-a.
  const sciezki = ["/api/export-shoper", "/api/export-shoper?dostawca=MO1", "/api/export/shoper"];
  const statusy = {};
  for (const sciezka of sciezki) {
    const a = await fetch(`http://127.0.0.1:${ctx.portOryginalu}${sciezka}`, {
      headers: { authorization: `Bearer ${ctx.tokenOryginalu}` },
    });
    const b = await fetch(`http://127.0.0.1:${ctx.portOdbudowy}${sciezka}`, {
      headers: { authorization: `Bearer ${ctx.tokenOdbudowy}` },
    });
    statusy[sciezka] = { oryginal: a.status, odbudowa: b.status };
    await a.text();
    await b.text();
  }

  const po = {
    oryginal: policz(ctx.Database, ctx.bazaOryginalu),
    odbudowa: policz(ctx.Database, ctx.bazaOdbudowy),
  };

  const pagedO = await pobierz(ctx.portOryginalu, "/api/history/paged?typ=eksport&limit=50", ctx.tokenOryginalu);
  const pagedR = await pobierz(ctx.portOdbudowy, "/api/history/paged?typ=eksport&limit=50", ctx.tokenOdbudowy);

  // Co oryginał wypisał na stderr W TRAKCIE tych dwóch żądań — bez tego „500" jest samym
  // kodem bez przyczyny i nie da się odróżnić defektu produkcji od braku w piaskownicy.
  const logEksportu = ctx.dziennikOryginalu
    ? ctx.dziennikOryginalu().slice(dziennikPrzed).trim().split("\n").slice(0, 12)
    : [];

  const wynik = {
    statusy,
    logOryginaluPodczasEksportu: logEksportu,
    audytPrzed: przed,
    audytPo: po,
    pagedTypEksport: {
      oryginal: pagedO.cialo && pagedO.cialo.total,
      odbudowa: pagedR.cialo && pagedR.cialo.total,
    },
    roznicePaged: roznice(pagedO.cialo, pagedR.cialo),
  };
  log(`  Eksport → audyt po: oryginał ${JSON.stringify(po.oryginal)} / odbudowa ${JSON.stringify(po.odbudowa)}`);
  log(`           statusy: ${JSON.stringify(statusy)}`);
  return wynik;
}

main()
  .catch((blad) => {
    console.error(`\nBŁĄD: ${blad.message}`);
    process.exitCode = 1;
  })
  .finally(posprzatajPiaskownice);
