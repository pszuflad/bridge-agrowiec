/**
 * Test integracyjny FE ↔ BE — BEZ MOCKÓW.
 *
 * Startuje prawdziwy backend z `rebuild/backend` na wolnym porcie, ze świeżą bazą
 * tymczasową i zasianym użytkownikiem, po czym przepuszcza przez niego prawdziwego
 * klienta frontendu (`src/lib/auth.ts`, `src/lib/queryClient.ts`). Weryfikuje kontrakt
 * naprawdę, a nie moje wyobrażenie o nim.
 *
 * NIE wchodzi do `npm test`: job `frontend` w CI (`.github/workflows/ci.yml`) instaluje
 * wyłącznie `rebuild/frontend`, więc test padłby na braku zależności backendu.
 * Uruchomienie: `npm run test:integracja` (wymaga `npm ci` w `rebuild/backend`).
 *
 * Zakres świadomie ograniczony: `fetch` w Node nie ma słoika na ciasteczka, więc
 * `credentials:"include"` jest tu bez efektu i sprawdzamy ŚCIEŻKĘ BEARER. To, że
 * backend ustawia cookie `bridge_session`, weryfikujemy osobno na nagłówku odpowiedzi;
 * pełną ścieżkę cookie pokrywają testy backendu z Iteracji 1a.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KLUCZE_STORAGE, zapiszToken } from "@/lib/api";
import { _zresetujStanSesji, pobierzUzytkownika, wyloguj, zaloguj } from "@/lib/auth";
import { zapytanieZwracajaceNullNa401 } from "@/lib/queryClient";

const katalogTestu = dirname(fileURLToPath(import.meta.url));
const katalogBackendu = resolve(katalogTestu, "../../../backend");

const EMAIL = "test.integracja@bridge.local";
const HASLO = "Integracja123!";
const IMIE_NAZWISKO = "Testowe Konto";

let backend: ChildProcess;
let katalogBazy: string;
let bazaUrl: string;

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
      // Bez sesji `/api/me` odpowiada 401 — dla nas to dowód, że serwer żyje.
      const odpowiedz = await fetch(`${url}/api/me`);
      if (odpowiedz.status === 401) return;
    } catch (blad) {
      ostatniBlad = blad;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Backend nie wstał w 60 s. Ostatni błąd: ${String(ostatniBlad)}`);
}

beforeAll(async () => {
  if (!existsSync(join(katalogBackendu, "node_modules"))) {
    throw new Error(
      "Brak zależności backendu. Uruchom najpierw: (cd ../backend && npm ci), " +
        "potem `npm run test:integracja`.",
    );
  }

  katalogBazy = mkdtempSync(join(tmpdir(), "bridge-integracja-"));
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
  };

  // Migracje + użytkownik testowy (skrypt backendu, ten sam co w developmencie).
  execFileSync("npm", ["run", "seed:dev", "--silent", "--", EMAIL, HASLO, IMIE_NAZWISKO], {
    cwd: katalogBackendu,
    env: srodowisko,
    stdio: "pipe",
  });

  backend = spawn("npx", ["tsx", "src/server.ts"], {
    cwd: katalogBackendu,
    env: srodowisko,
    stdio: "pipe",
  });
  backend.stderr?.on("data", (fragment: Buffer) => {
    process.stderr.write(`[backend] ${fragment.toString()}`);
  });

  await poczekajNaBackend(bazaUrl);

  // Klient FE woła ścieżki względne (`/api/...`) — w przeglądarce rozwiązuje je origin
  // strony, tutaj kierujemy je na uruchomiony backend.
  const fetchPodSpodem = globalThis.fetch;
  globalThis.fetch = ((zasob: RequestInfo | URL, opcje?: RequestInit) => {
    if (typeof zasob === "string" && zasob.startsWith("/")) {
      return fetchPodSpodem(`${bazaUrl}${zasob}`, opcje);
    }
    return fetchPodSpodem(zasob, opcje);
  }) as typeof fetch;

  zapiszToken(null);
  _zresetujStanSesji();
});

afterAll(() => {
  backend?.kill("SIGTERM");
  if (katalogBazy) rmSync(katalogBazy, { recursive: true, force: true });
});

describe("logowanie przeciw żywemu backendowi", () => {
  it("odrzuca złe hasło komunikatem z backendu", async () => {
    await expect(zaloguj(EMAIL, "zupelnie-zle-haslo", false)).rejects.toThrow(
      /Nieprawid[łl]owy email lub has[łl]o/,
    );
    expect(pobierzUzytkownika()).toBeNull();
  });

  it("odrzuca puste pola kodem 400", async () => {
    await expect(zaloguj("", "", false)).rejects.toThrow(/Email i has[łl]o są wymagane/);
  });

  it("loguje poprawnymi danymi i zwraca użytkownika o kształcie z kontraktu", async () => {
    const uzytkownik = await zaloguj(`  ${EMAIL}  `, HASLO, false);

    // Kształt 1:1 z contract/fixtures/GET_me.json (bez iat/exp, które dokłada /api/me).
    expect(Object.keys(uzytkownik).sort()).toEqual(["email", "id", "imieNazwisko"]);
    expect(uzytkownik.email).toBe(EMAIL);
    expect(uzytkownik.imieNazwisko).toBe(IMIE_NAZWISKO);
    expect(typeof uzytkownik.id).toBe("number");

    // Token trafił do magazynu i jest realnym JWT (trzy segmenty).
    const token = sessionStorage.getItem(KLUCZE_STORAGE.token);
    expect(token).toBeTruthy();
    expect(token!.split(".")).toHaveLength(3);
  });

  it("backend ustawia cookie sesji bridge_session", async () => {
    const odpowiedz = await fetch(`${bazaUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: HASLO }),
    });

    expect(odpowiedz.status).toBe(200);
    expect(odpowiedz.headers.get("set-cookie") ?? "").toContain("bridge_session=");
  });

  it("GET /api/me przez wspólny queryFn zwraca payload z polami iat/exp", async () => {
    await zaloguj(EMAIL, HASLO, false);

    const dane = (await zapytanieZwracajaceNullNa401({ queryKey: ["/api/me"] } as never)) as Record<
      string,
      unknown
    >;

    expect(dane).toMatchObject({ email: EMAIL, imieNazwisko: IMIE_NAZWISKO });
    expect(typeof dane.iat).toBe("number");
    expect(typeof dane.exp).toBe("number");
  });

  it("po wylogowaniu zapytanie odczytowe dostaje 401 i zwraca null", async () => {
    await zaloguj(EMAIL, HASLO, false);
    await wyloguj();

    const dane = await zapytanieZwracajaceNullNa401({ queryKey: ["/api/me"] } as never);

    expect(dane).toBeNull();
    expect(pobierzUzytkownika()).toBeNull();
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
  });
});
