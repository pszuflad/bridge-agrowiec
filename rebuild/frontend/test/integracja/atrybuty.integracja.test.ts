/**
 * @vitest-environment node
 */
/**
 * Test integracyjny atrybutów FE ↔ BE — BEZ MOCKÓW (sesja 7b).
 *
 * PO CO, skoro `atrybuty.test.tsx` i `atrybuty.pending.test.tsx` sprawdzają już widok:
 * tamte dowodzą, że front WYSYŁA to, co zaplanowałem — MSW odpowiada, jak mu każę. Ten
 * dowodzi, że PRAWDZIWY backend 7a to rozumie, i pilnuje trzech asymetrii kontraktu, których
 * mock nigdy sam nie wykryje, bo to ja bym je w mocku odtworzył:
 *   1. `GET /api/atrybuty` zwraca rodzaje Z polem `utworzony`, a `GET /api/atrybuty/rodzaje` BEZ;
 *   2. `GET /api/atrybuty/liczniki` oddaje GOŁĄ MAPĘ `"<rodzaj>::<wartosc>": liczba` — bez `ok`;
 *   3. `GET /api/atrybuty/uzycie` BEZ parametrów oddaje 400 (tak powstał nagrany fixture).
 *
 * Sprawdza też, że wszystkie te trasy są za `requireAuth` — bez tokenu 401.
 *
 * NIE wchodzi do `npm test`. Uruchomienie: `npm run test:integracja`
 * (wymaga `npm ci` w `rebuild/backend`).
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { naglowki, zapiszToken } from "@/lib/api";
import { _zresetujStanSesji, zaloguj } from "@/lib/auth";
import {
  dodajRodzaj,
  dodajWartosc,
  pobierzLiczniki,
  pobierzPending,
  pobierzSlownik,
  pobierzUzycie,
  usunWartosc,
  zapiszWartosc,
  type Rodzaj,
} from "@/pages/atrybuty/api";

const katalogTestu = dirname(fileURLToPath(import.meta.url));
const katalogBackendu = resolve(katalogTestu, "../../../backend");

const EMAIL = "test.atrybuty@bridge.local";
const HASLO = "Integracja123!";
const IMIE_NAZWISKO = "Testowe Konto";

/** Minimalna atrapa `Storage` — jak w pozostałych testach integracyjnych. */
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

beforeAll(async () => {
  if (!existsSync(join(katalogBackendu, "node_modules"))) {
    throw new Error(
      "Brak zależności backendu. Uruchom najpierw: (cd ../backend && npm ci), " +
        "potem `npm run test:integracja`.",
    );
  }

  globalThis.localStorage = atrapaStorage();
  globalThis.sessionStorage = atrapaStorage();

  katalogBazy = mkdtempSync(join(tmpdir(), "bridge-atrybuty-integracja-"));
  const sciezkaBazy = join(katalogBazy, "data.db");
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
});

afterAll(() => {
  backend?.kill("SIGTERM");
  if (katalogBazy) rmSync(katalogBazy, { recursive: true, force: true });
});

/** Trasy danych stoją za `requireAuth` — sprawdzamy PRZED zalogowaniem. */
describe("1. Wszystkie trasy atrybutów wymagają tokenu", () => {
  const sciezki = [
    "/api/atrybuty",
    "/api/atrybuty/rodzaje",
    "/api/atrybuty/wartosci",
    "/api/atrybuty/liczniki",
    "/api/atrybuty/uzycie?rodzaj=marka&wartosc=BKT",
    "/api/atrybuty/pending",
  ];

  it.each(sciezki)("GET %s bez tokenu → 401", async (sciezka) => {
    zapiszToken(null);
    _zresetujStanSesji();
    const odpowiedz = await fetch(`${bazaUrl}${sciezka}`);
    expect(odpowiedz.status).toBe(401);
  });
});

describe("2. Kontrakt odczytu — asymetrie, których mock by nie wykrył", () => {
  beforeAll(async () => {
    zapiszToken(null);
    _zresetujStanSesji();
    const uzytkownik = await zaloguj(EMAIL, HASLO, false);
    expect(uzytkownik.email).toBe(EMAIL);
  });

  it("słownik jest ZASIANY przy starcie aplikacji — sześć rodzajów `core`", async () => {
    // `stworzApp` sieje słownik przy każdym starcie (`zasiejSlownikAtrybutow`, 7a) — to jest
    // odtworzenie produkcji, nie migracja, więc świeża baza od razu ma rodzaje wbudowane.
    const slownik = await pobierzSlownik();

    expect(slownik.ok).toBe(true);
    const wbudowane = slownik.rodzaje.filter((r) => r.core === 1).map((r) => r.value);
    expect(wbudowane).toEqual(
      expect.arrayContaining(["marka", "kategoria", "konstrukcja", "vfIf", "bieznik", "rodzaj"]),
    );
    // `core` jest LICZBĄ 0/1, nie booleanem — typ `Rodzaj` na tym stoi.
    expect(typeof slownik.rodzaje[0]?.core).toBe("number");
  });

  it("`/api/atrybuty` ma `utworzony`, a `/api/atrybuty/rodzaje` NIE MA", async () => {
    const slownik = await pobierzSlownik();
    const odpowiedz = await fetch(`${bazaUrl}/api/atrybuty/rodzaje`, {
      headers: naglowki(false),
    });
    const zRodzajow = (await odpowiedz.json()) as { rodzaje: Rodzaj[] };

    expect(slownik.rodzaje[0]).toHaveProperty("utworzony");
    // Różnica realna i celowa: SELECT w `atrybuty_module.cjs:116` tego pola nie pobiera.
    expect(zRodzajow.rodzaje[0]).not.toHaveProperty("utworzony");
  });

  it("`/api/atrybuty/liczniki` oddaje GOŁĄ MAPĘ, bez klucza `ok`", async () => {
    await dodajWartosc("marka", "Alliance");
    const liczniki = await pobierzLiczniki();

    expect(liczniki).not.toHaveProperty("ok");
    // Klucz to `<rodzaj>::<wartosc>`; wartości bez produktów w bazie po prostu nie ma w mapie.
    for (const klucz of Object.keys(liczniki)) {
      expect(klucz).toContain("::");
      expect(typeof liczniki[klucz]).toBe("number");
    }
  });

  it("`/api/atrybuty/uzycie` BEZ parametrów oddaje 400 — tak powstał nagrany fixture", async () => {
    // Nagłówki bierzemy z warstwy klienta — token przy `remember=false` siedzi
    // w `sessionStorage`, a nie w `localStorage` (`lib/api.ts`, `pobierzStore`).
    const odpowiedz = await fetch(`${bazaUrl}/api/atrybuty/uzycie`, {
      headers: naglowki(false),
    });

    expect(odpowiedz.status).toBe(400);
    expect(await odpowiedz.json()).toEqual({
      ok: false,
      error: "Nieznany rodzaj atrybutu: undefined",
    });
  });

  it("`/api/atrybuty/uzycie` z parametrami oddaje `{ok, count, products}`", async () => {
    const uzycie = await pobierzUzycie("marka", "BKT");

    expect(uzycie.ok).toBe(true);
    expect(typeof uzycie.count).toBe("number");
    expect(Array.isArray(uzycie.products)).toBe(true);
  });

  it("`/api/atrybuty/pending` oddaje kopertę `{ok, count, items}` bez paginacji", async () => {
    const kolejka = await pobierzPending();

    expect(kolejka.ok).toBe(true);
    expect(kolejka.count).toBe(kolejka.items.length);
  });
});

describe("3. CRUD słownika przez żywy backend", () => {
  it("pełny cykl wartości: dodanie → edycja → usunięcie", async () => {
    await dodajWartosc("marka", "Testowa Marka");
    const poDodaniu = (await pobierzSlownik()).wartosci.find(
      (w) => w.rodzaj === "marka" && w.wartosc === "Testowa Marka",
    );
    expect(poDodaniu).toBeDefined();

    await zapiszWartosc(poDodaniu!.id, "Testowa Marka XL");
    const poEdycji = (await pobierzSlownik()).wartosci.find((w) => w.id === poDodaniu!.id);
    expect(poEdycji?.wartosc).toBe("Testowa Marka XL");

    await usunWartosc(poDodaniu!.id);
    const poUsunieciu = (await pobierzSlownik()).wartosci.find((w) => w.id === poDodaniu!.id);
    expect(poUsunieciu).toBeUndefined();
  });

  it("duplikat wartości daje 409 z komunikatem, który UI pokazuje wprost", async () => {
    await dodajWartosc("kategoria", "Duplikat");

    // ⚠ 409 NIE JEST zadeklarowane w `contract/openapi.yaml` (backlog #43) — to luka
    // kontraktu, nie kodu. Trasa je zwraca i widok musi je obsłużyć.
    await expect(dodajWartosc("kategoria", "Duplikat")).rejects.toThrow(
      /Taka wartość już istnieje dla tego rodzaju/,
    );
  });

  it("nowy rodzaj zapisuje się i wraca w słowniku jako `core: 0`", async () => {
    await dodajRodzaj({ label: "Sezon", opis: "Letnie, Zimowe" });

    const rodzaj = (await pobierzSlownik()).rodzaje.find((r) => r.value === "sezon");
    expect(rodzaj).toMatchObject({ value: "sezon", label: "Sezon", core: 0 });
  });

  it("ten sam rodzaj drugi raz daje 409", async () => {
    await dodajRodzaj({ label: "Powtórka" });

    await expect(dodajRodzaj({ label: "Powtórka" })).rejects.toThrow(/już istnieje/);
  });

  it("usunięcie rodzaju WBUDOWANEGO jest zabronione (403)", async () => {
    // Widok tej operacji nie wystawia (plan.md D5), ale kod błędu jest częścią kontraktu
    // klienta — `komunikatBledu` musi umieć go rozpakować.
    const odpowiedz = await fetch(`${bazaUrl}/api/atrybuty/rodzaje/marka`, {
      method: "DELETE",
      headers: naglowki(false),
    });

    expect(odpowiedz.status).toBe(403);
    expect(await odpowiedz.json()).toEqual({
      ok: false,
      error: "Nie można usunąć wbudowanego rodzaju",
    });
  });
});
