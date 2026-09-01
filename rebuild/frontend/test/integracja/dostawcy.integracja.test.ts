/**
 * @vitest-environment node
 */
/**
 * Test integracyjny sterowania dostawcami FE ↔ BE — BEZ MOCKÓW (GATE 3f-2).
 *
 * PO CO, skoro `konfiguracja.dostawcy.test.tsx` sprawdza już widok: tamten test dowodzi,
 * że frontend WYSYŁA to, co zaplanowałem — MSW odpowiada, jak mu każę. Ten dowodzi, że
 * PRAWDZIWY backend to rozumie i że pętla zamyka się do końca: cennik jest naprawdę
 * pobierany PRAWDZIWYM `fetch`-em z PRAWDZIWEGO serwera HTTP, awaria zostawia alert
 * w bazie, a `PATCH` po numerycznym `id` faktycznie zmienia wiersz.
 *
 * ⚠ Serwer dostawcy stoi lokalnie na porcie efemerycznym i NIC nie jest mockowane —
 * to jest wymóg gate'u sesji: podmiana `fetch` wycięłaby dokładnie tę warstwę, o którą
 * chodzi (transport, timeout, treść komunikatu błędu lądująca w alercie).
 *
 * NIE wchodzi do `npm test` — jak `wgrywanie.integracja.test.ts`.
 * Uruchomienie: `npm run test:integracja` (wymaga `npm ci` w `rebuild/backend`).
 *
 * Środowisko `node` — potrzebujemy `node:http` do postawienia serwera dostawcy.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createServerHttp, type Server } from "node:http";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { zapiszToken } from "@/lib/api";
import { _zresetujStanSesji, zaloguj } from "@/lib/auth";
import { synchronizujTeraz, zapiszDostawce } from "@/pages/konfiguracja/dostawcy";

const katalogTestu = dirname(fileURLToPath(import.meta.url));
const katalogBackendu = resolve(katalogTestu, "../../../backend");
const CENNIK_MO1 = readFileSync(join(katalogBackendu, "test/charakteryzacja/probki/MO1.csv"));

const EMAIL = "test.dostawcy@bridge.local";
const HASLO = "Integracja123!";
const IMIE_NAZWISKO = "Testowe Konto";

/** Minimalna atrapa `Storage` — jak w `wgrywanie.integracja.test.ts`. */
function atrapaStorage(): Storage {
  const dane = new Map<string, string>();
  return {
    get length() {
      return dane.size;
    },
    clear: () => dane.clear(),
    getItem: (klucz: string) => dane.get(klucz) ?? null,
    key: (i: number) => [...dane.keys()][i] ?? null,
    removeItem: (klucz: string) => dane.delete(klucz) as unknown as void,
    setItem: (klucz: string, wartosc: string) => {
      dane.set(klucz, wartosc);
    },
  } as Storage;
}

let backend: ChildProcess;
let katalogBazy: string;
let sciezkaBazy: string;
let bazaUrl: string;
let token = "";
let serwerDostawcy: Server;
let urlCennika = "";
/** Co ma odpowiedzieć serwer dostawcy w danym scenariuszu. */
let trybSerwera: "ok" | "500" | "zerwij" = "ok";

function wolnyPort(): Promise<number> {
  return new Promise((rozwiaz, odrzuc) => {
    const serwer = createServer();
    serwer.on("error", odrzuc);
    serwer.listen(0, "127.0.0.1", () => {
      const adres = serwer.address();
      if (typeof adres === "string" || adres === null) {
        serwer.close(() => odrzuc(new Error("Nie udało się ustalić wolnego portu.")));
        return;
      }
      const port = adres.port;
      serwer.close(() => rozwiaz(port));
    });
  });
}

async function poczekajNaBackend(url: string): Promise<void> {
  const koniec = Date.now() + 60_000;
  let ostatniBlad: unknown;
  while (Date.now() < koniec) {
    try {
      const odpowiedz = await fetch(`${url}/api/me`);
      if (odpowiedz.status === 401) return;
    } catch (blad) {
      ostatniBlad = blad;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Backend nie wstał w 60 s. Ostatni błąd: ${String(ostatniBlad)}`);
}

/** Odczyt tabeli wprost z pliku bazy — alertów nie ma jeszcze żadne API (należy do I6). */
function zBazy(zapytanie: string): Record<string, unknown>[] {
  const wynik = execFileSync(
    "node",
    [
      "-e",
      `const D=require("better-sqlite3");const db=new D(process.argv[1],{readonly:true});
       process.stdout.write(JSON.stringify(db.prepare(process.argv[2]).all()));db.close();`,
      sciezkaBazy,
      zapytanie,
    ],
    { cwd: katalogBackendu, stdio: "pipe" },
  );
  return JSON.parse(wynik.toString()) as Record<string, unknown>[];
}

function wykonajWBazie(sql: string): void {
  execFileSync(
    "node",
    [
      "-e",
      `const D=require("better-sqlite3");const db=new D(process.argv[1]);
       db.exec(process.argv[2]);db.close();`,
      sciezkaBazy,
      sql,
    ],
    { cwd: katalogBackendu, stdio: "pipe" },
  );
}

beforeAll(async () => {
  if (!existsSync(join(katalogBackendu, "node_modules"))) {
    throw new Error(
      "Brak zależności backendu. Uruchom najpierw: (cd ../backend && npm ci), " +
        "potem `npm run test:integracja`.",
    );
  }

  globalThis.localStorage = atrapaStorage();
  globalThis.sessionStorage = atrapaStorage();

  // 1. PRAWDZIWY serwer dostawcy na porcie efemerycznym.
  serwerDostawcy = createServerHttp((zadanie, odpowiedz) => {
    /*
     * Zerwanie ŻĄDANIA, nie połączenia: undici trzyma gniazda przy życiu (keep-alive),
     * więc kolejne żądanie leci po sokecie otwartym w poprzednim teście i zdarzenie
     * `connection` już się nie powtarza. Niszczymy socket dopiero, gdy żądanie dojdzie.
     */
    if (trybSerwera === "zerwij") {
      zadanie.socket.destroy();
      return;
    }
    if (trybSerwera === "500") {
      odpowiedz.writeHead(500);
      odpowiedz.end("awaria u dostawcy");
      return;
    }
    odpowiedz.writeHead(200, { "content-type": "text/csv" });
    odpowiedz.end(CENNIK_MO1);
  });
  await new Promise<void>((gotowe) => serwerDostawcy.listen(0, "127.0.0.1", gotowe));
  urlCennika = `http://127.0.0.1:${(serwerDostawcy.address() as AddressInfo).port}/cennik.csv`;

  // 2. Backend na osobnym porcie efemerycznym, z własną bazą w katalogu tymczasowym.
  katalogBazy = mkdtempSync(join(tmpdir(), "bridge-dostawcy-integracja-"));
  sciezkaBazy = join(katalogBazy, "data.db");
  const port = await wolnyPort();
  bazaUrl = `http://127.0.0.1:${port}`;

  const srodowisko = {
    ...process.env,
    DB_PATH: sciezkaBazy,
    JWT_SECRET: "sekret-tylko-do-testow-integracyjnych",
    HOST: "127.0.0.1",
    PORT: String(port),
    NODE_ENV: "development",
    COOKIE_SECURE: "false",
    IMPORT_ARCHIVE_DIR: join(katalogBazy, "import_archive"),
  };

  execFileSync("npm", ["run", "seed:dev", "--silent", "--", EMAIL, HASLO, IMIE_NAZWISKO], {
    cwd: katalogBackendu,
    env: srodowisko,
    stdio: "pipe",
  });

  // `seed:dev` zasiewa tylko użytkownika — wiersz dostawcy dokładamy sami, tak jak w 3f-1.
  wykonajWBazie(
    `INSERT INTO suppliers (kod, nazwa, format_pliku, sposob_dostarczania, url, czestotliwosc_minuty)
     VALUES ('MO1', 'Bohnenkamp', 'csv', 'url', '${urlCennika}', 60);`,
  );

  backend = spawn("npx", ["tsx", "src/server.ts"], {
    cwd: katalogBackendu,
    env: srodowisko,
    stdio: "pipe",
  });
  backend.stderr?.on("data", (fragment: Buffer) => {
    process.stderr.write(`[backend] ${fragment.toString()}`);
  });

  await poczekajNaBackend(bazaUrl);

  const fetchPodSpodem = globalThis.fetch;
  globalThis.fetch = ((zasob: RequestInfo | URL, opcje?: RequestInit) => {
    if (typeof zasob === "string" && zasob.startsWith("/")) {
      return fetchPodSpodem(`${bazaUrl}${zasob}`, opcje);
    }
    return fetchPodSpodem(zasob, opcje);
  }) as typeof fetch;

  zapiszToken(null);
  _zresetujStanSesji();
  const uzytkownik = await zaloguj(EMAIL, HASLO, false);
  expect(uzytkownik.email).toBe(EMAIL);
  token = String(
    localStorage.getItem("bridge_auth_token") ?? sessionStorage.getItem("bridge_auth_token"),
  );
  expect(token).toBeTruthy();
});

afterAll(async () => {
  backend?.kill("SIGTERM");
  await new Promise<void>((gotowe) => {
    serwerDostawcy?.closeAllConnections?.();
    serwerDostawcy?.close(() => gotowe());
  });
  if (katalogBazy) rmSync(katalogBazy, { recursive: true, force: true });
});

beforeEach(() => {
  trybSerwera = "ok";
  wykonajWBazie(
    `DELETE FROM alerts;
     DELETE FROM staging_items;
     UPDATE suppliers SET status='aktywny', ostatnia_sync=NULL, ostatni_plik=NULL,
                          liczba_produktow=0, url='${urlCennika}', czestotliwosc_minuty=60
      WHERE kod='MO1';`,
  );
});

const dostawcaMO1 = () => zBazy("SELECT * FROM suppliers WHERE kod='MO1'")[0]!;
const alerty = () => zBazy("SELECT * FROM alerts ORDER BY id");

describe("sterowanie dostawcami przez żywy backend", () => {
  it("„Synchronizuj teraz” pobiera cennik z PRAWDZIWEGO serwera i zapisuje staging", async () => {
    const wynik = await synchronizujTeraz("MO1");

    expect(wynik.ok).toBe(true);
    if (!wynik.ok) return;
    expect(wynik.liczbaProduktow).toBeGreaterThan(0);

    // GATE: ostatniaSync, ostatniPlik, liczbaProduktow, status aktywny
    const po = dostawcaMO1();
    expect(po.ostatnia_sync).toBeTruthy();
    expect(po.ostatni_plik).toBeTruthy();
    expect(Number(po.liczba_produktow)).toBe(wynik.liczbaProduktow);
    expect(po.status).toBe("aktywny");

    expect(zBazy("SELECT count(*) AS c FROM staging_items")[0]!.c).toBeGreaterThan(0);

    const lista = alerty();
    expect(lista).toHaveLength(1);
    expect(lista[0]!.typ).toBe("Synchronizacja");
  });

  it("GATE: serwer zwraca 500 → alert „Błąd HTTP” i status `blad`", async () => {
    trybSerwera = "500";

    const wynik = await synchronizujTeraz("MO1");

    expect(wynik).toEqual({ ok: false, error: "HTTP 500" });
    const lista = alerty();
    expect(lista).toHaveLength(1);
    expect(lista[0]!.typ).toBe("Błąd HTTP");
    expect(lista[0]!.poziom).toBe("ostrzezenie");
    expect(lista[0]!.status).toBe("nowy");
    expect(dostawcaMO1().status).toBe("blad");
  });

  it("GATE: serwer nie odpowiada → alert „Błąd pobierania” i status `blad`", async () => {
    trybSerwera = "zerwij";

    const wynik = await synchronizujTeraz("MO1");

    expect(wynik.ok).toBe(false);
    const lista = alerty();
    expect(lista).toHaveLength(1);
    expect(lista[0]!.typ).toBe("Błąd pobierania");
    // Treść to dosłowny komunikat undici — dokładnie tak wyglądają alerty w produkcji.
    expect(String(lista[0]!.opis)).toMatch(/^MO1 \(Bohnenkamp\): .+/);
    expect(dostawcaMO1().status).toBe("blad");
  });

  it("GATE: dostawca `wstrzymany` przechodzi RĘCZNIE (flaga z `q4()`)", async () => {
    wykonajWBazie("UPDATE suppliers SET status='wstrzymany' WHERE kod='MO1';");

    const wynik = await synchronizujTeraz("MO1");

    expect(wynik.ok).toBe(true);
    expect(dostawcaMO1().status).toBe("aktywny");
  });

  it("GATE: zmiana `czestotliwoscMinuty` zapisuje się i trafia do audytu", async () => {
    const id = Number(dostawcaMO1().id);

    const po = await zapiszDostawce(id, { czestotliwoscMinuty: 240 });

    expect(po.czestotliwoscMinuty).toBe(240);
    expect(Number(dostawcaMO1().czestotliwosc_minuty)).toBe(240);

    const audyt = zBazy("SELECT * FROM audit_log WHERE akcja='edycja_dostawcy'");
    expect(audyt).toHaveLength(1);
    expect(JSON.parse(String(audyt[0]!.szczegoly_json))).toEqual({ czestotliwoscMinuty: 240 });
  });

  it("odpowiedź PATCH-a nie wynosi kolumny wewnętrznej `importWylaczony`", async () => {
    const id = Number(dostawcaMO1().id);
    const po = await zapiszDostawce(id, { czestotliwoscMinuty: 120 });
    expect(po).not.toHaveProperty("importWylaczony");
  });
});
