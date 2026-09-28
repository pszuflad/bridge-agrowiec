/**
 * Test integracyjny stagingu FE ↔ BE — BEZ MOCKÓW.
 *
 * PO CO, skoro `staging.test.tsx` już sprawdza widok: tamten test dowodzi, że frontend WYSYŁA
 * to, co myślę — mocki MSW odpowiadają tak, jak im każę. Ten dowodzi, że backend to ROZUMIE.
 * Różnica ujawnia się dokładnie tam, gdzie łatwo o pomyłkę: nazwy parametrów `/paged`, kształt
 * ciała `allFiltered` i to, czy akceptacja naprawdę przenosi pozycję do katalogu.
 *
 * NIE wchodzi do `npm test` — job `frontend` w CI instaluje tylko `rebuild/frontend`.
 * Uruchomienie: `npm run test:integracja` (wymaga `npm ci` w `rebuild/backend`).
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { zapiszToken } from "@/lib/api";
import { _zresetujStanSesji, zaloguj } from "@/lib/auth";
import { zapytanieZwracajaceNullNa401 } from "@/lib/queryClient";
import {
  adresStrony,
  odrzucWszystkie,
  zapiszPozycje,
  zatwierdzPozycje,
  type PozycjaStaginguSzczegol,
  type StronaStagingu,
} from "@/pages/staging/dane";

const katalogTestu = dirname(fileURLToPath(import.meta.url));
const katalogBackendu = resolve(katalogTestu, "../../../backend");

const EMAIL = "test.staging@bridge.local";
const HASLO = "Integracja123!";
const IMIE_NAZWISKO = "Testowe Konto";
const DOSTAWCA = "MO5";

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

/** Rekord cennika w kształcie, jaki produkuje adapter — wejście `POST /api/staging/import`. */
function rekord(pola: Record<string, unknown> = {}) {
  return {
    kod: "INT-1",
    nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
    rozmiar: "480/70R28",
    marka: "BKT",
    model: "AGRIMAX RT 765",
    kategoria: "Opony rolnicze",
    ean: "5901234123457",
    stan: 4,
    cenaZakupu: 1000,
    magazyn: "PL",
    ...pola,
  };
}

/** Import pozycji przez backend — to on wypełnia staging danymi dla testu. */
async function zaimportuj(rekordy: Record<string, unknown>[]): Promise<void> {
  const odpowiedz = await fetch(`${bazaUrl}/api/staging/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dostawcaKod: DOSTAWCA, surowe: rekordy }),
  });
  if (!odpowiedz.ok) throw new Error(`Import nie przeszedł: ${odpowiedz.status}`);
}

let token = "";

beforeAll(async () => {
  if (!existsSync(join(katalogBackendu, "node_modules"))) {
    throw new Error(
      "Brak zależności backendu. Uruchom najpierw: (cd ../backend && npm ci), " +
        "potem `npm run test:integracja`.",
    );
  }

  katalogBazy = mkdtempSync(join(tmpdir(), "bridge-staging-integracja-"));
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

  // Klient FE woła ścieżki względne — kierujemy je na uruchomiony backend.
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
  token = String(localStorage.getItem("bridge_auth_token") ?? sessionStorage.getItem("bridge_auth_token"));
});

afterAll(() => {
  backend?.kill("SIGTERM");
  if (katalogBazy) rmSync(katalogBazy, { recursive: true, force: true });
});

/** Pobranie strony DOKŁADNIE tak, jak robi to widok — przez `adresStrony` + `queryFn`. */
async function pobierzStrone(opcje: {
  page?: number;
  limit?: number;
  typZmiany?: string;
  search?: string;
}): Promise<StronaStagingu> {
  const adres = adresStrony({
    page: opcje.page ?? 1,
    limit: opcje.limit ?? 25,
    typZmiany: opcje.typZmiany ?? "all",
    search: opcje.search ?? "",
  });
  return (await zapytanieZwracajaceNullNa401({
    queryKey: [adres],
    signal: new AbortController().signal,
    meta: undefined,
    client: undefined as never,
  })) as StronaStagingu;
}

describe("Staging przeciw żywemu backendowi", () => {
  it("adres z `adresStrony()` jest zrozumiany przez backend — koperta ma komplet pól", async () => {
    await zaimportuj([rekord(), rekord({ kod: "INT-2", nazwa: "Opona 420/85R30 BKT" })]);

    const strona = await pobierzStrone({});

    // Gdyby nazwy parametrów się rozjechały, backend oddałby domyślną stronę — a nie błąd.
    // Dlatego sprawdzamy KOMPLET pól koperty, nie samo `items`.
    expect(Object.keys(strona).sort()).toEqual(["items", "page", "pageSize", "pages", "total"]);
    expect(strona.total).toBeGreaterThanOrEqual(2);
    expect(strona.page).toBe(1);
    expect(strona.pageSize).toBe(25);
  });

  it("filtr `typZmiany` i `search` realnie zawężają wynik po stronie backendu", async () => {
    const wszystkie = await pobierzStrone({});
    const nowe = await pobierzStrone({ typZmiany: "nowa" });
    expect(nowe.items.every((p) => p.typZmiany === "nowa")).toBe(true);

    const poSzukaniu = await pobierzStrone({ search: "INT-2" });
    expect(poSzukaniu.total).toBeLessThan(wszystkie.total);
    expect(poSzukaniu.items.every((p) => p.kod.includes("INT-2") || p.nazwa.includes("INT-2"))).toBe(
      true,
    );
  });

  it("`/paged` NIE zwraca `snapshotJson`, a `/{id}` — zwraca", async () => {
    const strona = await pobierzStrone({});
    const pozycja = strona.items[0]!;

    expect(pozycja).not.toHaveProperty("snapshotJson");

    const szczegol = (await zapytanieZwracajaceNullNa401({
      queryKey: ["/api/staging", String(pozycja.id)],
      signal: new AbortController().signal,
      meta: undefined,
      client: undefined as never,
    })) as PozycjaStaginguSzczegol;

    expect(szczegol.snapshotJson, "podgląd różnic stoi na tym polu").toBeTruthy();
  });

  /**
   * ⭐ NAJWAŻNIEJSZY TEST TEGO PLIKU. `PUT` z widoku ma nie tylko zmienić pozycję, ale
   * i utworzyć POPRAWKĘ MARTY — czyli spiąć interfejs z mechanizmem z 3d-1/3d-2.
   */
  it("edycja z widoku tworzy poprawkę w `manual_overrides`", async () => {
    const strona = await pobierzStrone({ search: "INT-1" });
    const pozycja = strona.items[0]!;

    await zapiszPozycje(pozycja.id, { kategoria: "Przemysłowe", _reason: "decyzja Marty" });

    const odpowiedz = await fetch(
      `${bazaUrl}/api/overrides?dostawca=${DOSTAWCA}&kod=${encodeURIComponent(pozycja.kod)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const poprawki = (await odpowiedz.json()) as { fieldName: string; overrideValue: string }[];

    const kategoria = poprawki.find((p) => p.fieldName === "kategoria");
    expect(kategoria?.overrideValue).toBe("Przemysłowe");
    expect(poprawki.find((p) => p.fieldName === "kategoria")).toBeDefined();
  });

  it("akceptacja przez `ids` przenosi pozycję do katalogu i znika ze stagingu", async () => {
    const strona = await pobierzStrone({ search: "INT-1" });
    const pozycja = strona.items[0]!;

    const ile = await zatwierdzPozycje([pozycja.id]);
    expect(ile).toBe(1);

    const po = await pobierzStrone({ search: "INT-1" });
    expect(po.items.find((p) => p.id === pozycja.id)).toBeUndefined();

    const katalog = await fetch(`${bazaUrl}/api/products?dostawca=${DOSTAWCA}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const produkty = (await katalog.json()) as { items: { kod: string }[] };
    expect(produkty.items.some((p) => p.kod === pozycja.kod)).toBe(true);
  });

  /**
   * `allFiltered` to jedyne ciało żądania, którego kształtu nie widać z listy id — i jedyne,
   * które potrafi wyczyścić cały staging jednym kliknięciem. Dlatego jedzie osobno.
   */
  it("`allFiltered` czyści wszystkie pasujące pozycje po stronie backendu", async () => {
    await zaimportuj([
      rekord({ kod: "INT-A" }),
      rekord({ kod: "INT-B" }),
      rekord({ kod: "INT-C" }),
    ]);
    const przed = await pobierzStrone({});
    expect(przed.total).toBeGreaterThan(0);

    const odrzucone = await odrzucWszystkie("all");
    expect(odrzucone).toBe(przed.total);

    const po = await pobierzStrone({});
    expect(po.total).toBe(0);
    expect(po.items).toHaveLength(0);
  });
});
