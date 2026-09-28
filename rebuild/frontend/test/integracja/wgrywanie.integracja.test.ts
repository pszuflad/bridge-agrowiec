/**
 * @vitest-environment node
 */
/**
 * Test integracyjny wgrywania FE ↔ BE — BEZ MOCKÓW (GATE 3f-1).
 *
 * PO CO, skoro `konfiguracja.test.tsx` już sprawdza widok: tamten test dowodzi, że frontend
 * WYSYŁA multipart, jaki zaplanowałem — MSW odpowiada tak, jak mu każę. Ten dowodzi, że
 * PRAWDZIWY backend to rozumie: że pole nazywa się `plik`, że nazwa pliku dojeżdża w całości
 * (jsdom gubi ją w teście widoku), że parser z portu 3a przerabia plik na rekordy i że
 * pozycje FIZYCZNIE lądują w stagingu.
 *
 * NIE wchodzi do `npm test` — job `frontend` w CI instaluje tylko `rebuild/frontend`.
 * Uruchomienie: `npm run test:integracja` (wymaga `npm ci` w `rebuild/backend`).
 *
 * ⚠ ŚRODOWISKO `node`, nie jsdom — inaczej niż pozostałe testy integracyjne. Powód jest
 * konkretny: `fetch` z ciałem `FormData` zbudowanym z klas jsdom NIE KOŃCZY SIĘ — żądanie
 * wisi do timeoutu. Sprawdzone osobnym testem-sondą na trywialnym serwerze HTTP: to samo
 * żądanie w środowisku `node` przechodzi w kilkadziesiąt milisekund. To ograniczenie
 * jsdom, nie naszego kodu — a ten test istnieje właśnie po to, żeby przepchnąć PRAWDZIWY
 * multipart przez PRAWDZIWY backend, więc musi biec tam, gdzie multipart działa.
 * `localStorage`/`sessionStorage` dokładamy niżej jako minimalne atrapy, bo warstwa auth
 * frontendu trzyma w nich token.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { zapiszToken } from "@/lib/api";
import { _zresetujStanSesji, zaloguj } from "@/lib/auth";
import { przeanalizujPlik } from "@/pages/konfiguracja/detekcja";
import { wgrajPlik } from "@/pages/konfiguracja/wgrywanie";

const katalogTestu = dirname(fileURLToPath(import.meta.url));
const katalogBackendu = resolve(katalogTestu, "../../../backend");
const KATALOG_PROBEK = join(katalogBackendu, "test/charakteryzacja/probki");

const EMAIL = "test.wgrywanie@bridge.local";
const HASLO = "Integracja123!";
const IMIE_NAZWISKO = "Testowe Konto";

/**
 * Minimalna atrapa `Storage` — środowisko `node` go nie ma, a `lib/api.ts` trzyma tam
 * token. Atrapujemy WYŁĄCZNIE magazyn; logowanie, nagłówki i upload idą prawdziwym kodem.
 */
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
let bazaUrl: string;
let token = "";

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

/** Plik z katalogu próbek jako `File` — dokładnie te bajty, które dostaje Ania. */
function probkaJakoFile(nazwaProbki: string, nazwaPliku: string): File {
  const bajty = readFileSync(join(KATALOG_PROBEK, nazwaProbki));
  return new File([new Uint8Array(bajty)], nazwaPliku);
}

async function zapytaj(sciezka: string): Promise<unknown> {
  const odpowiedz = await fetch(`${bazaUrl}${sciezka}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!odpowiedz.ok) throw new Error(`${sciezka} → ${odpowiedz.status}`);
  return odpowiedz.json();
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

  katalogBazy = mkdtempSync(join(tmpdir(), "bridge-wgrywanie-integracja-"));
  const dbPath = join(katalogBazy, "data.db");
  const port = await wolnyPort();
  bazaUrl = `http://127.0.0.1:${port}`;

  const srodowisko = {
    ...process.env,
    DB_PATH: dbPath,
    JWT_SECRET: "sekret-tylko-do-testow-integracyjnych",
    HOST: "127.0.0.1",
    PORT: String(port),
    NODE_ENV: "development",
    COOKIE_SECURE: "false",
    // Archiwum importu do katalogu tymczasowego, nie do repozytorium.
    IMPORT_ARCHIVE_DIR: join(katalogBazy, "import_archive"),
  };

  execFileSync("npm", ["run", "seed:dev", "--silent", "--", EMAIL, HASLO, IMIE_NAZWISKO], {
    cwd: katalogBackendu,
    env: srodowisko,
    stdio: "pipe",
  });

  /*
   * `seed:dev` zasiewa tylko użytkownika, a upload wymaga WIERSZA DOSTAWCY — to on jest
   * bramką 404 i on dostaje `ostatniPlik`/`liczbaProduktow`. Dokładamy MO1 i MO8 wprost
   * do bazy (migracje założył już seed), bo API tworzenia dostawcy nie ma ani u nas,
   * ani w produkcji: tam wiersze przychodzą ze snapshotu.
   */
  execFileSync(
    "node",
    [
      "-e",
      `const D=require("better-sqlite3");const db=new D(process.argv[1]);
       const wstaw=db.prepare("INSERT INTO suppliers (kod,nazwa,format_pliku,sposob_dostarczania) VALUES (?,?,?,?)");
       wstaw.run("MO1","Bohnenkamp","csv","mail");
       wstaw.run("MO8","Trelleborg","xlsx","mail");
       db.close();`,
      dbPath,
    ],
    { cwd: katalogBackendu, stdio: "pipe" },
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
});

afterAll(() => {
  backend?.kill("SIGTERM");
  if (katalogBazy) rmSync(katalogBazy, { recursive: true, force: true });
});

describe("wgrywanie pliku przez żywy backend", () => {
  it("cennik MO1 wgrany z przeglądarki ląduje POZYCJAMI w stagingu", async () => {
    const plik = probkaJakoFile("MO1.csv", "bohnenkamp_2026.csv");

    // 1. detekcja po stronie klienta — tak, jak robi to widok
    const analiza = await przeanalizujPlik(plik);
    expect(analiza.detekcja.kod).toBe("MO1");
    expect(analiza.detekcja.pewnosc).toBe("wysoka");

    // 2. wysłanie ORYGINALNEGO pliku
    const wynik = await wgrajPlik(analiza.detekcja.kod, plik);

    expect(wynik.ok).toBe(true);
    // Nazwa pliku dojeżdża do backendu w całości — tego test widoku dowieść nie może,
    // bo jsdom gubi `filename` w FormData.
    expect(wynik.nazwaPliku).toBe("bohnenkamp_2026.csv");
    expect(wynik.liczbaProduktow).toBeGreaterThan(0);
    expect(wynik.podglad).toHaveLength(5);

    // 3. pozycje FIZYCZNIE w stagingu — czytane przez to samo API co widok `/staging`
    const strona = (await zapytaj("/api/staging/paged?page=1&limit=25")) as {
      total: number;
      items: { dostawca: string }[];
    };
    expect(strona.total).toBe(wynik.doStagingu);
    expect(strona.items.every((p) => p.dostawca === "MO1")).toBe(true);

    /*
     * 4. znaczniki importu na dostawcy — widoczne w `GET /api/dostawcy`.
     *
     * Sprawdzamy `ostatniPlik`, a NIE `liczbaProduktow`: to drugie pole `listaDostawcow`
     * liczy w locie z tabeli `products` (`repos/suppliers.ts:106-111`), a wgranie pliku
     * zatrzymuje pozycje w STAGINGU — do katalogu trafiają dopiero po zatwierdzeniu.
     * Zapis do kolumny `suppliers.liczba_produktow` pilnuje test backendowy, który czyta
     * bazę wprost; tutaj sprawdzamy to, co naprawdę zobaczy Ania w panelu.
     */
    const dostawcy = (await zapytaj("/api/dostawcy")) as {
      kod: string;
      ostatniPlik: string | null;
      ostatniaSync: string | null;
    }[];
    const mo1 = dostawcy.find((d) => d.kod === "MO1");
    expect(mo1?.ostatniPlik).toBeTruthy();
    expect(mo1?.ostatniaSync).toBeTruthy();
  });

  /**
   * XLSX przez CAŁĄ drogę: przeglądarka go przepuszcza (odstępstwo 3f-1), backend parsuje
   * przez port SheetJS z 3a. Bez tego MO8 nie dałoby się wgrać z panelu w ogóle.
   */
  it("cennik XLSX (MO8) przechodzi całą drogę do stagingu", async () => {
    const plik = probkaJakoFile("MO8.xlsx", "trelleborg_2026.xlsx");

    const analiza = await przeanalizujPlik(plik);
    expect(analiza.arkusz).toBe(true);
    expect(analiza.detekcja.kod).toBe("MO8");

    const wynik = await wgrajPlik("MO8", plik);
    expect(wynik.liczbaProduktow).toBeGreaterThan(0);
    expect(wynik.doStagingu).toBeGreaterThan(0);
  });

  /**
   * GATE 3f-1: brak fallbacku `Wc()` znaczy, że nieudany parse ma być GŁOŚNY.
   * Sprawdzamy, że klient dostaje komunikat backendu, a nie gołe „500".
   */
  it("plik nieparsowalny kończy się czytelnym błędem, nie ciszą", async () => {
    const smieci = new File([new Uint8Array([1, 2, 3, 4, 5])], "smieci.xlsx");

    await expect(wgrajPlik("MO8", smieci)).rejects.toThrow();
    await expect(wgrajPlik("MO8", smieci)).rejects.not.toThrow(
      /^Upload MO8 nie powiódł się$/,
    );
  });

  it("nieznany dostawca kończy się błędem „Brak dostawcy”", async () => {
    await expect(
      wgrajPlik("MO99", probkaJakoFile("MO1.csv", "MO1.csv")),
    ).rejects.toThrow("Brak dostawcy");
  });
});
