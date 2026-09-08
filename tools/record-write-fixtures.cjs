#!/usr/bin/env node
/* eslint-disable no-console */
// ============================================================================
//  Bridge — record-write-fixtures.cjs
//
//  Nagrywa fixtures tras ZAPISUJĄCYCH (POST/PUT/PATCH/DELETE) oraz brakujące
//  warianty GET — z ORYGINALNEGO backendu produkcji (`mirror/backend/index.cjs`)
//  postawionego na KOPII bazy (`db/snapshot.db`).
//
//  Po co osobne narzędzie, skoro jest `tools/record-fixtures.sh`?
//  Tamto nagrywa GET-y przeciw ŻYWEJ produkcji i celowo nie umie nic zapisać —
//  wysłanie tam POST-a modyfikowałoby dane Ani. Tu jest odwrotnie: cały ruch
//  idzie do lokalnej kopii, więc zapisy są bezpieczne, a produkcja nietknięta.
//
//  ⭐ ZASADA NADRZĘDNA (ticket 38 / sesja 12d): fixtures są DOWODEM, więc muszą
//  powstać z ORYGINAŁU, nie z `rebuild/`. Ten skrypt nie importuje niczego
//  z `rebuild/` — jedynym serwerem, do którego wysyła żądania, jest oryginał.
//
//  Uruchomienie (Node >= 20):
//      node tools/record-write-fixtures.cjs
//      node tools/record-write-fixtures.cjs --zostaw-piaskownice   # do debugowania
//
//  Skrypt jest ODTWARZALNY: nie potrzebuje sekretów, dostępu do produkcji ani
//  Twojego udziału — każdy odtworzy nagranie jednym poleceniem.
//
//  ⚠ Odtwarzalny znaczy „ten sam KSZTAŁT", nie „bajt w bajt". Nagrania mutacji
//  niosą `dataAktualizacji` z zegara, a `PUT`/`PATCH /api/products/{id}` oddają
//  cały zapisany rekord — więc te dwa pliki różnią się między biegami znacznikiem
//  czasu. To zachowanie produkcji, nie wada nagrywarki; GATE porównuje kształt.
// ============================================================================

const { execFileSync } = require("node:child_process");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const KORZEN = path.resolve(__dirname, "..");
const ZRODLO_BACKENDU = path.join(KORZEN, "mirror", "backend");
const KATALOG_FIXTURES = path.join(KORZEN, "contract", "fixtures");

/**
 * `db/snapshot.db` jest w `.gitignore`, więc w worktree ticketa go NIE MA — leży wyłącznie
 * w głównym repo. Bez tego szukania nagrywarka działałaby tylko na `develop`, czyli dokładnie
 * nie tam, gdzie się pracuje. Kolejność: jawny `BRIDGE_SNAPSHOT`, własny katalog, główne repo.
 */
function znajdzSnapshot() {
  const kandydaci = [];
  if (process.env.BRIDGE_SNAPSHOT) kandydaci.push(path.resolve(process.env.BRIDGE_SNAPSHOT));
  kandydaci.push(path.join(KORZEN, "db", "snapshot.db"));
  try {
    const wspolny = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: KORZEN,
      encoding: "utf8",
    }).trim();
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

/** Hasło z WŁASNEGO seeda oryginału (`mirror/backend/index.cjs`, `hashSync("Bridge2026!", 10)`). */
const HASLO_SEEDA = "Bridge2026!";
/** Sekret tylko dla piaskownicy — oryginał ma własny fallback, ten nigdzie nie wychodzi. */
const SEKRET_PIASKOWNICY = "piaskownica-12d-nagrywarka";

const ZOSTAW_PIASKOWNICE = process.argv.includes("--zostaw-piaskownice");

// ————————————————————————————————————————————————————————————————————————————
// Pomocnicze
// ————————————————————————————————————————————————————————————————————————————

function log(tekst) {
  console.log(tekst);
}

/**
 * Wolny port od systemu. Nagrywarka ma móc chodzić równolegle z projektem
 * i z inną kartą — stały port byłby proszeniem się o „port in use".
 */
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

function czekaj(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ————————————————————————————————————————————————————————————————————————————
// Piaskownica
// ————————————————————————————————————————————————————————————————————————————

/**
 * Kopia oryginału + kopia bazy w JEDNYM katalogu.
 *
 * ⚠ Baza MUSI leżeć obok `index.cjs` i proces MUSI startować z tego katalogu.
 * Oryginał otwiera bazę relatywnie (`new Database("data.db")`), ale
 * `POST /api/products/clear` robi kopię zapasową przez `path.join(__dirname, "data.db")`.
 * Przy innym CWD te dwie ścieżki wskazałyby różne pliki.
 */
function zbudujPiaskownice() {
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-oryginal-"));
  log(`[1/6] Piaskownica: ${katalog}`);
  fs.cpSync(ZRODLO_BACKENDU, katalog, { recursive: true });
  fs.copyFileSync(znajdzSnapshot(), path.join(katalog, "data.db"));
  // Snapshot chodził w WAL — bez tych plików SQLite otworzy bazę czysto.
  for (const przyrostek of ["-wal", "-shm"]) {
    const plik = path.join(katalog, `data.db${przyrostek}`);
    if (fs.existsSync(plik)) fs.rmSync(plik);
  }
  return katalog;
}

function zainstalujZaleznosci(katalog) {
  log("[2/6] npm install w piaskownicy (6 zależności oryginału)…");
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--loglevel", "error"], {
    cwd: katalog,
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/**
 * Dwie zmiany w KOPII bazy, obie konieczne i obie opisane.
 *
 * (Trzecia, zasiew `uwaga_cena`, MUSI iść po starcie serwera — patrz `zasiejUwageCeny`.)
 *
 * 1. Wygaszenie schedulera. `startScheduler` (`mirror/backend/extensions.cjs:811-838`)
 *    tika co 60 s i dla każdego dostawcy z ustawionym `czestotliwosc_minuty` odpala
 *    `runAutoPull`, czyli REALNE pobranie pliku z URL-a dostawcy. W snapshocie ma to
 *    ustawione 6 z 10 dostawców. Bez tego kroku nagrywanie wysyłałoby ruch na zewnątrz.
 *
 * 2. Migracja `szertxt` — WŁASNYM skryptem Ani `migrate_szer_to_text.cjs`.
 *    Snapshot jest z 2026-08-13, a produkcja przemigrowała `products.szerokosc`
 *    z REAL na TEXT 2026-08-19/20. Bez tego nagranie `GET_products.json` wyszłoby
 *    z `szerokosc` jako liczbą — czyli dokładnie z tą wadą, którą ten ticket usuwa.
 *    Skrypt ma zahardkodowaną ścieżkę produkcyjną, więc podmieniamy WYŁĄCZNIE ją;
 *    reszta leci bajt w bajt, żeby migracja pozostała migracją produkcji, nie naszą.
 *
 *    (Kolumny `uwaga_cena` NIE trzeba dokładać — `uwaga_cena_patch.cjs:26-34` robi
 *    idempotentny `ALTER TABLE` przy każdym starcie oryginału.)
 */
function przygotujBaze(katalog) {
  log("[3/6] Przygotowanie kopii bazy (scheduler + migracja szertxt)…");
  const Database = require(path.join(katalog, "node_modules", "better-sqlite3"));
  const db = new Database(path.join(katalog, "data.db"));
  const wynik = db.prepare("UPDATE suppliers SET czestotliwosc_minuty = NULL").run();
  log(`      scheduler wygaszony dla ${wynik.changes} dostawców`);

  db.close();

  const zrodlo = fs.readFileSync(path.join(katalog, "migrate_szer_to_text.cjs"), "utf8");
  const SZUKANE = "const DB_PATH = '/home/admin/private_apps/bridge/data.db';";
  if (!zrodlo.includes(SZUKANE)) {
    throw new Error(
      "migrate_szer_to_text.cjs zmienił kształt — nie znaleziono linii z DB_PATH. " +
        "Nie zgaduj: sprawdź skrypt, zanim podmienisz ścieżkę.",
    );
  }
  const zmieniony = zrodlo.replace(SZUKANE, "const DB_PATH = process.env.BRIDGE_DB_PIASKOWNICA;");
  const plik = path.join(katalog, "_migracja-piaskownicy.cjs");
  fs.writeFileSync(plik, zmieniony);
  execFileSync(process.execPath, [plik], {
    cwd: katalog,
    env: { ...process.env, BRIDGE_DB_PIASKOWNICA: path.join(katalog, "data.db") },
    stdio: ["ignore", "ignore", "inherit"],
  });
  log("      migracja szertxt zastosowana (products.szerokosc → TEXT)");
}

/**
 * Jeden wiersz z `uwaga_cena` — ZASIEW DANYCH w kopii, nie zmiana zachowania.
 *
 * ⚠ MUSI iść PO starcie oryginału. Kolumny `uwaga_cena` nie ma w snapshocie (2026-08-13,
 * starszy niż patch z 2026-08-24) — dokłada ją dopiero `uwaga_cena_patch.cjs:26-34`
 * idempotentnym `ALTER TABLE` przy każdym boocie. Zasiew przed startem wywracał się
 * na „no such column".
 *
 * Po co w ogóle: bez ani jednego wiersza `GET /api/products/uwagi-cena` oddaje
 * `{ok:true, items:[]}`, a pusta tablica we wzorcu NIE narzuca kształtu elementów
 * (`rebuild/backend/test/gate/ksztalt.ts`). Taki fixture nie zamroziłby czterech pól
 * pozycji ani — co ważniejsze — klucza `uwaga_cena` w SNAKE_CASE. Produkcja czyta tę
 * trasę surowym `better-sqlite3`, więc oddaje nazwy KOLUMN; gołe `select()` Drizzle'a
 * dałoby `uwagaCena` i rozjechało kształt. To ta sama pułapka, którą CLAUDE.md opisuje
 * na `GET /api/selly/log` — tam przeszła code review i złapał ją dopiero GATE.
 *
 * SQL samej trasy pozostaje oryginału; my dostarczamy wyłącznie dane wejściowe.
 *
 * ⚠ KOLEJNOŚĆ MA ZNACZENIE: wołane PO nagraniu `GET /api/products`, żeby zmieniony wiersz
 * nie wszedł do fixture'ów katalogu. Zasiew dotyka produktu o najniższym id z EAN-em,
 * a ten jest pierwszą pozycją listy — nagrany wcześniej, pokazywałby nasz `status`.
 */
function zasiejUwageCeny(katalog) {
  const Database = require(path.join(katalog, "node_modules", "better-sqlite3"));
  const db = new Database(path.join(katalog, "data.db"));
  try {
    const wynik = db
      .prepare(
        "UPDATE products SET uwaga_cena = 'na zapytanie', status = 'wstrzymany' " +
          "WHERE id = (SELECT id FROM products WHERE ean IS NOT NULL ORDER BY id LIMIT 1)",
      )
      .run();
    if (wynik.changes !== 1) {
      throw new Error(
        "Nie udało się zasiać `uwaga_cena` — bez tego fixture /uwagi-cena zamrozi pustą " +
          "listę i nie ochroni klucza snake_case. Sprawdź, czy kopia ma produkty z EAN-em.",
      );
    }
    log("      zasiane uwaga_cena w 1 wierszu (dla /uwagi-cena)");
  } finally {
    db.close();
  }
}

async function uruchomOryginal(katalog, port) {
  log(`[4/6] Start oryginału (mirror/backend/index.cjs) na porcie ${port}…`);
  const proces = spawn(process.execPath, ["index.cjs"], {
    cwd: katalog,
    env: { ...process.env, PORT: String(port), JWT_SECRET: SEKRET_PIASKOWNICY },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Log startu zbieramy do PAMIĘCI, nie do pliku w piaskownicy. Strumień do pliku
  // przegrywał wyścig ze sprzątaniem: proces dostaje SIGKILL, potok się domyka,
  // a spóźniony zapis leciał w usunięty już katalog (ERR_STREAM_WRITE_AFTER_END)
  // i wywracał całą nagrywarkę PO tym, jak fixtures były już poprawnie zapisane.
  let dziennik = "";
  proces.stdout.on("data", (kawalek) => (dziennik += kawalek));
  proces.stderr.on("data", (kawalek) => (dziennik += kawalek));
  proces.on("error", (blad) => (dziennik += `\n[spawn] ${blad.message}`));

  // Gotowość: /api/me bez tokenu ma oddać 401. Cokolwiek innego = jeszcze nie wstał.
  for (let proba = 0; proba < 60; proba += 1) {
    if (proces.exitCode !== null) {
      throw new Error(`Oryginał zakończył się przedwcześnie. Log startu:\n${dziennik}`);
    }
    try {
      const odp = await fetch(`http://127.0.0.1:${port}/api/me`);
      if (odp.status === 401) {
        log("      oryginał odpowiada");
        return proces;
      }
    } catch {
      /* jeszcze nie słucha */
    }
    await czekaj(250);
  }
  proces.kill("SIGKILL");
  throw new Error(`Oryginał nie wstał w 15 s. Log startu:\n${dziennik}`);
}

// ————————————————————————————————————————————————————————————————————————————
// Zapis fixture'ów
// ————————————————————————————————————————————————————————————————————————————

/** Klucze, których wartości nigdy nie lądują w repo — nagrywamy KSZTAŁT, nie sekrety. */
const KLUCZE_WRAZLIWE = new Set([
  "password",
  "oldPassword",
  "newPassword",
  "haslo",
  "stareHaslo",
  "noweHaslo",
  "token",
  "hasloHash",
  "haslo_hash",
]);

function zamaskuj(wartosc) {
  if (Array.isArray(wartosc)) return wartosc.map(zamaskuj);
  if (wartosc && typeof wartosc === "object") {
    const wynik = {};
    for (const [klucz, v] of Object.entries(wartosc)) {
      wynik[klucz] = KLUCZE_WRAZLIWE.has(klucz) && typeof v === "string" ? "***" : zamaskuj(v);
    }
    return wynik;
  }
  return wartosc;
}

const LIMIT_TABLICY = 5;

/**
 * Przycięcie dużych tablic — konwencja z Kroku 2.4 (`contract/README.md`).
 * Fixtures zamrażają STRUKTURĘ, nie archiwum danych; `GET /api/products` bez
 * parametrów oddaje ponad 7000 pozycji i bez tego plik miałby dziesiątki MB.
 *
 * ⚠ MASKOWANIE IDZIE PIERWSZE, na CAŁYM ciele. Wcześniejsza wersja tej funkcji
 * przechodziła po obiekcie sama i wołała `zamaskuj` dopiero na WARTOŚCIACH, przez co
 * klucz wrażliwy stojący na najwyższym poziomie (dokładnie tak stoi `token`
 * w odpowiedzi `POST /api/login`) nie był w ogóle sprawdzany i wyciekał do repo.
 *
 * Adnotacje: goła tablica → `_body_przyciete_z` obok `body` (jak `GET_alerts.json`);
 * tablica w obiekcie → `_przyciete: { klucz: ile_bylo }` WEWNĄTRZ `body`
 * (jak `GET_analytics_ean_supplier-rank.json`). Porównanie kształtu pomija klucze
 * na `_`, więc adnotacja nie psuje GATE (`test/gate/ksztalt.ts`, `KLUCZ_TECHNICZNY`).
 */
function przytnij(cialoSurowe) {
  const cialo = zamaskuj(cialoSurowe);

  if (Array.isArray(cialo)) {
    return { wartosc: cialo.slice(0, LIMIT_TABLICY), przycieteZ: cialo.length };
  }

  if (cialo && typeof cialo === "object") {
    const wynik = {};
    const przyciete = {};
    for (const [klucz, wartosc] of Object.entries(cialo)) {
      if (Array.isArray(wartosc) && wartosc.length > LIMIT_TABLICY) {
        wynik[klucz] = wartosc.slice(0, LIMIT_TABLICY);
        przyciete[klucz] = wartosc.length;
      } else {
        wynik[klucz] = wartosc;
      }
    }
    if (Object.keys(przyciete).length > 0) wynik._przyciete = przyciete;
    return { wartosc: wynik, przycieteZ: null };
  }

  return { wartosc: cialo, przycieteZ: null };
}

const nagrane = [];

/**
 * Jedno żądanie do oryginału → jeden plik w `contract/fixtures/`.
 *
 * Format jest NADZBIOREM dzisiejszego (`endpoint`/`method`/`status`/`json`/`body`),
 * więc `wczytajFixture()` w GATE działa bez zmian — czyta wyłącznie `body`.
 * Nowe pole `request` niesie ciało ŻĄDANIA; to z niego powstają schematy
 * `requestBody` w `contract/openapi.yaml`.
 */
async function nagraj({ plik, metoda, sciezka, cialo, token, opis, port }) {
  const naglowki = {};
  if (token) naglowki.Authorization = `Bearer ${token}`;
  if (cialo !== undefined) naglowki["Content-Type"] = "application/json";

  const odp = await fetch(`http://127.0.0.1:${port}${sciezka}`, {
    method: metoda,
    headers: naglowki,
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
  });

  const surowe = await odp.text();
  let odpowiedz;
  let jestJson = true;
  try {
    odpowiedz = JSON.parse(surowe);
  } catch {
    odpowiedz = surowe.slice(0, 3000);
    jestJson = false;
  }

  const { wartosc, przycieteZ } = przytnij(odpowiedz);
  const fixture = {
    endpoint: sciezka,
    method: metoda,
    status: odp.status,
    json: jestJson,
    body: wartosc,
  };
  if (przycieteZ !== null) fixture._body_przyciete_z = przycieteZ;
  if (cialo !== undefined) fixture.request = zamaskuj(cialo);
  fixture._zrodlo = "mirror/backend/index.cjs na kopii db/snapshot.db (tools/record-write-fixtures.cjs)";
  if (opis) fixture._opis = opis;

  fs.writeFileSync(
    path.join(KATALOG_FIXTURES, plik),
    `${JSON.stringify(fixture, null, 2)}\n`,
    "utf8",
  );
  nagrane.push({ plik, metoda, sciezka, status: odp.status });
  log(`      ${metoda.padEnd(6)} ${sciezka.padEnd(42)} ${odp.status}  → ${plik}`);
  return { status: odp.status, body: odpowiedz };
}

// ————————————————————————————————————————————————————————————————————————————
// Scenariusze
// ————————————————————————————————————————————————————————————————————————————

/** Produkt testowy — realistyczna opona, żeby rozszerzenia importu (applyDims) miały co liczyć. */
const PRODUKT_TESTOWY = {
  kod: "TEST-12D-001",
  nazwa: "Opona testowa 12d",
  marka: "TestMarka",
  kategoria: "Rolnicze",
  dostawca: "MO2",
  stan: 4,
  cenaZakupu: 1200,
  cenaSprzedazy: 1500,
  vat: 23,
  rozmiar: "10.00/75x15.3",
  status: "aktywny",
};

async function odegrajScenariusze(port, db, katalog) {
  log("[5/6] Nagrywanie…");

  // — AUTH ————————————————————————————————————————————————————————————————
  // 401 dla /api/me i /api/login to POWÓD, dla którego ten ticket rusza kody błędów:
  // kontrakt 2.3 ich nie deklaruje, a produkcja je zwraca (contract/README.md).
  await nagraj({
    plik: "GET_me_401.json",
    metoda: "GET",
    sciezka: "/api/me",
    opis: "Bez tokenu. Kontrakt 2.3 deklarował tu 200/400 — produkcja oddaje 401.",
    port,
  });

  const email = db.prepare("SELECT email FROM users ORDER BY id LIMIT 1").get().email;

  await nagraj({
    plik: "POST_login_401.json",
    metoda: "POST",
    sciezka: "/api/login",
    cialo: { email, password: "zle-haslo-do-nagrania" },
    opis: "Złe hasło. Kontrakt 2.3 nie deklarował tu 401.",
    port,
  });

  const logowanie = await nagraj({
    plik: "POST_login.json",
    metoda: "POST",
    sciezka: "/api/login",
    cialo: { email, password: HASLO_SEEDA },
    opis: "Hasło z własnego seeda oryginału. Token w nagraniu zamaskowany.",
    port,
  });

  const token = logowanie.body && logowanie.body.token;
  if (!token) {
    throw new Error(
      "Logowanie do piaskownicy nie dało tokenu — konta w snapshocie mają inne hasło niż " +
        "seed oryginału. Bez tokenu nie da się nagrać tras za auth; sprawdź `users` w kopii.",
    );
  }

  // — PRODUKTY, ODCZYT ————————————————————————————————————————————————————
  await nagraj({
    plik: "GET_products_bez-parametrow.json",
    metoda: "GET",
    sciezka: "/api/products",
    token,
    opis:
      "GOŁA TABLICA — gałąź `if (limit === undefined && !dostawca)` oryginału " +
      "(deminified/backend-index.cjs:48291-48295). Inny kształt niż wariant `?limit=`.",
    port,
  });

  await nagraj({
    plik: "GET_products.json",
    metoda: "GET",
    sciezka: "/api/products?limit=5",
    token,
    opis:
      "PRZENAGRANE w tickecie 38 (sesja 12d): `szerokosc` jest TEKSTEM z zerami końcowymi, " +
      "zgodnie z produkcyjną migracją `szertxt`. Poprzednie nagranie było starsze niż migracja.",
    port,
  });

  // ⚠ ZASIEW DOPIERO TUTAJ — po nagraniu obu wariantów `GET /api/products`.
  // Wcześniej stał przed nimi i jego wiersz (`status: "wstrzymany"`) wchodził jako PIERWSZA
  // pozycja do `GET_products.json` i `GET_products_bez-parametrow.json`, czyli nasza ingerencja
  // trafiała do fixture'ów, które mają być czystym zapisem produkcji. Wykryte w code review.
  zasiejUwageCeny(katalog);

  await nagraj({
    plik: "GET_products_uwagi-cena.json",
    metoda: "GET",
    sciezka: "/api/products/uwagi-cena",
    token,
    opis: "Monkey-patch produkcji (uwaga_cena_patch.cjs) — klucz `uwaga_cena` w snake_case.",
    port,
  });

  await nagraj({
    plik: "GET_products_hold-reasons.json",
    metoda: "GET",
    sciezka: "/api/products/hold-reasons",
    token,
    opis: "Monkey-patch produkcji (uwaga_cena_patch.cjs) — pięć powodów wstrzymania.",
    port,
  });

  // — PRODUKTY, ZAPIS ——————————————————————————————————————————————————————
  // Oryginał przyjmuje DWA kształty ciała (`Array.isArray(body) ? body : body.items ?? []`),
  // więc nagrywamy oba — inaczej kontrakt zamroziłby tylko połowę prawdy.
  await nagraj({
    plik: "POST_products.json",
    metoda: "POST",
    sciezka: "/api/products",
    cialo: [PRODUKT_TESTOWY],
    token,
    opis: "Ciało jako GOŁA TABLICA. Odpowiedź `{ok, dodano}` — `dodano` to LICZBA.",
    port,
  });

  await nagraj({
    plik: "POST_products_items.json",
    metoda: "POST",
    sciezka: "/api/products",
    cialo: { items: [{ ...PRODUKT_TESTOWY, kod: "TEST-12D-002" }] },
    token,
    opis: "Ciało jako `{items: […]}` — drugi dopuszczalny kształt tej samej trasy.",
    port,
  });

  const idProduktu = db.prepare("SELECT id FROM products WHERE kod = ?").get(PRODUKT_TESTOWY.kod).id;

  await nagraj({
    plik: "PUT_products_id.json",
    metoda: "PUT",
    sciezka: `/api/products/${idProduktu}`,
    cialo: { cenaZakupu: 1300, cenaSprzedazy: 1650, stan: 7 },
    token,
    opis: "Oryginał ma dla PUT i PATCH dwie osobne funkcje o identycznym skutku.",
    port,
  });

  await nagraj({
    plik: "PATCH_products_id.json",
    metoda: "PATCH",
    sciezka: `/api/products/${idProduktu}`,
    cialo: { nazwa: "Opona testowa 12d — po edycji", status: "wstrzymany" },
    token,
    opis: "Trasa pisze do manual_overrides ORAZ do history, po jednym wpisie na zmienione pole.",
    port,
  });

  await nagraj({
    plik: "PATCH_products_id_404.json",
    metoda: "PATCH",
    sciezka: "/api/products/999999999",
    cialo: { nazwa: "nie istnieje" },
    token,
    opis: "Nieistniejące id — kod 404 dopisany do kontraktu w 12a, tu potwierdzony nagraniem.",
    port,
  });

  await nagraj({
    plik: "DELETE_products_id.json",
    metoda: "DELETE",
    sciezka: `/api/products/${idProduktu}`,
    token,
    opis: "Bez kaskad — osierocone manual_overrides/history to zastane zachowanie oryginału.",
    port,
  });

  // — ADMIN / KONTO ————————————————————————————————————————————————————————
  await nagraj({
    plik: "PATCH_admin_supplier-config_kod.json",
    metoda: "PATCH",
    sciezka: "/api/admin/supplier-config/MO2",
    cialo: { status: "aktywny" },
    token,
    opis: "Metoda to PATCH, nie PUT (extensions.cjs:344) — roadmapa myliła się tu trzykrotnie.",
    port,
  });

  // — MAINTENANCE ——————————————————————————————————————————————————————————
  // Kolejność: operacje NISZCZĄCE na końcu. `usun-nieopony` idzie PRZED `clear`,
  // bo po wyczyszczeniu katalogu nie miałoby czego liczyć i nagrałoby kształt z zerami.
  await nagraj({
    plik: "POST_maintenance_usun-nieopony.json",
    metoda: "POST",
    sciezka: "/api/maintenance/usun-nieopony",
    cialo: {},
    token,
    opis: "Nagrane PRZED products/clear, na pełnym katalogu — inaczej same zera.",
    port,
  });

  await nagraj({
    plik: "POST_products_clear_400.json",
    metoda: "POST",
    sciezka: "/api/products/clear",
    cialo: {},
    token,
    opis: "Brak `{potwierdzenie:\"WYCZYSC\"}` — 400 z dosłownym komunikatem oryginału.",
    port,
  });

  await nagraj({
    plik: "POST_products_clear.json",
    metoda: "POST",
    sciezka: "/api/products/clear",
    cialo: { potwierdzenie: "WYCZYSC" },
    token,
    opis: "Kasuje CAŁY katalog. Osobna trasa od DELETE /api/products/{id}.",
    port,
  });

  // — HASŁO I WYLOGOWANIE ——————————————————————————————————————————————————
  // Zmiana hasła jako przedostatnia: unieważnia hasło, którym się logowaliśmy,
  // więc każde późniejsze `POST /api/login` w tym biegu by padło.
  await nagraj({
    plik: "POST_password_change.json",
    metoda: "POST",
    sciezka: "/api/password/change",
    cialo: { oldPassword: HASLO_SEEDA, newPassword: "NoweHasloPiaskownicy1!" },
    token,
    opis: "Pola to oldPassword/newPassword (:48202-48206). Wartości zamaskowane.",
    port,
  });

  await nagraj({
    plik: "POST_logout.json",
    metoda: "POST",
    sciezka: "/api/logout",
    token,
    opis: "Ostatnie w kolejce — unieważnia sesję.",
    port,
  });
}

// ————————————————————————————————————————————————————————————————————————————
// Główna pętla
// ————————————————————————————————————————————————————————————————————————————

async function main() {
  for (const [opis, sciezka] of [
    ["oryginał backendu", ZRODLO_BACKENDU],
    ["katalog fixtures", KATALOG_FIXTURES],
  ]) {
    if (!fs.existsSync(sciezka)) throw new Error(`Brak: ${opis} (${sciezka})`);
  }
  log(`      snapshot: ${znajdzSnapshot()}`);

  const katalog = zbudujPiaskownice();
  let proces = null;
  try {
    zainstalujZaleznosci(katalog);
    przygotujBaze(katalog);
    const port = await wolnyPort();
    proces = await uruchomOryginal(katalog, port);

    const Database = require(path.join(katalog, "node_modules", "better-sqlite3"));
    const db = new Database(path.join(katalog, "data.db"), { readonly: true });
    try {
      await odegrajScenariusze(port, db, katalog);
    } finally {
      db.close();
    }

    log(`[6/6] Gotowe — ${nagrane.length} nagrań w contract/fixtures/`);
  } finally {
    if (proces) proces.kill("SIGKILL");
    if (ZOSTAW_PIASKOWNICE) {
      log(`Piaskownica ZOSTAJE: ${katalog}`);
    } else {
      fs.rmSync(katalog, { recursive: true, force: true });
    }
  }
}

// Uruchamiane jako skrypt — nagrywa. Wymagane jako moduł — oddaje czyste funkcje
// sanityzacji, żeby dało się je przetestować bez stawiania serwera. Maskowanie już raz
// przepuściło token JWT do repo (naprawione w tym samym tickecie), więc ma własne testy:
// `rebuild/backend/test/nagrywarka.sanityzacja.test.ts`.
if (require.main === module) {
  main().catch((blad) => {
    console.error(`\nBŁĄD: ${blad.message}`);
    process.exit(1);
  });
}

module.exports = { zamaskuj, przytnij, KLUCZE_WRAZLIWE, LIMIT_TABLICY };
