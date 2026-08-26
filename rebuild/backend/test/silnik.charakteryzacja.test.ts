// GATE ITERACJI 3c — dowód, że przepisany w TypeScripcie silnik importu zachowuje się
// dokładnie tak, jak `tk()` w produkcji.
//
// DLACZEGO INACZEJ NIŻ W 3a. Tam strażnikiem był sha256 port↔`mirror/backend/parsers/*.cjs`,
// bo mirror to czytelne pliki, które Ania utrzymuje. Tutaj jedyną postacią oryginału jest
// zminifikowany bundle, więc kopiowanie bajtów nie dałoby się z niczym porównać w sposób,
// który cokolwiek znaczy dla człowieka. Zamiast tego URUCHAMIAMY oryginał i porównujemy
// zachowanie — dowód mocniejszy niż skrót kopii, bo łapie też rozjazd po aktualizacji mirrora.
//
// Cztery warstwy, każda dowodzi czego innego:
//   1. INTEGRALNOŚĆ  — wycinek `mirror/backend/index.cjs` zgadza się ze skrótem, na którym
//      nagrano wzorzec. Bez tego zielony wynik mógłby znaczyć „porównaliśmy się z czymś innym".
//   2. CENNIKI       — realne pliki MO1–MO10 przez nasz silnik dają to samo, co przez oryginał.
//      Szerokość: 1838 rekordów wejścia, 7405 produktów katalogu ze zrzutu produkcji.
//   3. SCENARIUSZE   — gałęzie, których realne cenniki nie ruszają: `blad`, kasowanie
//      nie-opony, konflikt EAN, identyfikator zastępczy, deduplikacja stagingu.
//   4. PRZYDATNOŚĆ   — zielony wynik nie może brać się z pustego wejścia.
//
// Nagranie wzorca: BRIDGE_SNAPSHOT_DB=… node scripts/charakteryzacja-silnik-nagraj.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { products, stagingItems } from "../src/db/schema.js";
import type { Baza } from "../src/db/index.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { wytnijFragmenty } from "./charakteryzacja/silnik/oryginal.mjs";
import { SCENARIUSZE } from "./charakteryzacja/silnik/scenariusze.mjs";
import { KODY_DOSTAWCOW, POLA_WIERSZA, UTWORZONO_WZORCOWE } from "./charakteryzacja/silnik/wzorzec.mjs";

const backendDir = dirname(fileURLToPath(import.meta.url));
const katalog3a = join(backendDir, "charakteryzacja");
const katalogWzorca = join(katalog3a, "silnik");

type Wiersz = Record<string, unknown>;
type Wzorzec = {
  dostawca: string;
  wejscie: { rekordow: number };
  katalog: { produktow: number };
  statystyki: Record<string, unknown>;
  pozaZakresem3c: Record<string, unknown>;
  staging: Wiersz[];
  skasowane: number[];
  resetyNieobecnosci: { id: number; patch: Record<string, unknown> }[];
};

const wczytaj = <T>(sciezka: string): T => JSON.parse(readFileSync(sciezka, "utf-8")) as T;

const wzorzecDostawcy = (kod: string) =>
  wczytaj<Wzorzec>(join(katalogWzorca, `${kod}.expected.json`));

const katalogDostawcy = (kod: string) =>
  wczytaj<Wiersz[]>(join(katalogWzorca, "katalog", `${kod}.katalog.json`));

/** Rekordy wejściowe = wzorzec 3a, czyli nagrane wyjście ORYGINALNYCH parserów. */
const rekordyDostawcy = (kod: string) =>
  wczytaj<{ rekordy: RekordSurowy[] }>(join(katalog3a, `${kod}.expected.json`)).rekordy;

/** Sprowadza wiersz `staging_items` do kształtu wzorca — te same pola, ten sam znacznik. */
function normalizujWiersz(wiersz: Wiersz): Wiersz {
  const wynik: Wiersz = {};
  for (const nazwaPola of POLA_WIERSZA) {
    wynik[nazwaPola] = nazwaPola === "utworzono" ? UTWORZONO_WZORCOWE : (wiersz[nazwaPola] ?? null);
  }
  return wynik;
}

interface WynikPortu {
  statystyki: Record<string, unknown>;
  wycofane: number;
  staging: Wiersz[];
  skasowane: number[];
  resetyNieobecnosci: { id: number; patch: Record<string, unknown> }[];
  znacznikiUtworzenia: Set<unknown>;
}

/**
 * Uruchamia NASZ silnik na tym samym wejściu, na którym nagrano wzorzec, i zbiera z bazy
 * dokładnie to samo, co atrapy zbierały z oryginału.
 *
 * Kasowania i resety odczytujemy ze STANU bazy (co zniknęło, komu wyzerował się licznik),
 * a nie z instrumentacji kodu — dzięki temu test mierzy skutek, a nie to, że wywołaliśmy
 * odpowiednią funkcję.
 */
function uruchomPort(db: Baza, dostawca: string, katalog: Wiersz[], rekordy: RekordSurowy[]): WynikPortu {
  // Partiami, bo SQLite ma twardy limit zmiennych w jednym zapytaniu (domyślnie 32766),
  // a katalog MO5 to 1989 wierszy po 29 kolumn.
  const WIERSZY_NA_WSAD = 200;
  for (let i = 0; i < katalog.length; i += WIERSZY_NA_WSAD) {
    db.insert(products)
      .values(katalog.slice(i, i + WIERSZY_NA_WSAD) as unknown as (typeof products.$inferInsert)[])
      .run();
  }

  const przedImportem = new Map(
    db
      .select({ id: products.id, nieobecnosc: products.nieobecnoscPodRzad })
      .from(products)
      .all()
      .map((p) => [p.id, p.nieobecnosc]),
  );

  const statystyki = silnikStagingu(db)(dostawca, rekordy);

  const poImporcie = new Map(
    db
      .select({ id: products.id, nieobecnosc: products.nieobecnoscPodRzad })
      .from(products)
      .all()
      .map((p) => [p.id, p.nieobecnosc]),
  );

  const skasowane = [...przedImportem.keys()].filter((id) => !poImporcie.has(id)).sort((a, b) => a - b);

  const resetyNieobecnosci = [...przedImportem.entries()]
    .filter(([id, przed]) => przed > 0 && poImporcie.get(id) === 0)
    .map(([id]) => ({ id, patch: { nieobecnoscPodRzad: 0 } }))
    .sort((a, b) => a.id - b.id);

  const wiersze = db.select().from(stagingItems).all() as unknown as Wiersz[];
  const { wycofane, ...statystykiBezWycofan } = statystyki;

  return {
    statystyki: statystykiBezWycofan,
    wycofane,
    staging: wiersze.map(normalizujWiersz),
    skasowane,
    resetyNieobecnosci,
    znacznikiUtworzenia: new Set(wiersze.map((w) => w.utworzono)),
  };
}

/** Porównanie POLE PO POLU — najpierw wiersz po wierszu, żeby diff wskazywał konkretne pole. */
function porownajZWzorcem(wynik: WynikPortu, wzorzec: Wzorzec, etykieta: string) {
  expect(wynik.staging.length, `${etykieta}: liczba wierszy stagingu`).toBe(wzorzec.staging.length);

  for (const [i, oczekiwany] of wzorzec.staging.entries()) {
    const nasz = wynik.staging[i]!;
    for (const nazwaPola of POLA_WIERSZA) {
      expect(nasz[nazwaPola], `${etykieta}: wiersz ${i} (kod ${String(oczekiwany.kod)}), pole ${nazwaPola}`).toEqual(
        oczekiwany[nazwaPola],
      );
    }
  }

  expect(wynik.statystyki, `${etykieta}: liczniki`).toEqual(wzorzec.statystyki);
  expect(wynik.skasowane, `${etykieta}: skasowane produkty`).toEqual(wzorzec.skasowane);
  expect(wynik.resetyNieobecnosci, `${etykieta}: resety nieobecnosc_pod_rzad`).toEqual(
    wzorzec.resetyNieobecnosci,
  );

  // Poza zakresem 3c — pętla wycofań należy do 3d, więc ten licznik MUSI zostać zerem.
  expect(wynik.wycofane, `${etykieta}: licznik wycofanych (zakres 3d)`).toBe(0);

  // Jeden znacznik `utworzono` na cały przebieg (`tk()`, :47585).
  expect(wynik.znacznikiUtworzenia.size, `${etykieta}: liczba różnych znaczników utworzono`).toBeLessThanOrEqual(1);
}

describe("1. Integralność wycinka oryginału", () => {
  it("wycięty fragment mirror/backend/index.cjs zgadza się ze skrótem, na którym nagrano wzorzec", () => {
    const zapisana = wczytaj<{
      helpery: { sha256: string; dlugosc: number };
      silnik: { sha256: string; dlugosc: number };
    }>(join(katalogWzorca, "integralnosc.json"));

    const { integralnosc } = wytnijFragmenty();

    expect(
      integralnosc,
      "Wycinek produkcyjnego bundla różni się od tego, na którym nagrano wzorzec. " +
        "To NIE jest test do naprawienia — zmieniła się produkcja. Przejrzyj diff w mirror/backend, " +
        "a potem przenagraj wzorzec: BRIDGE_SNAPSHOT_DB=… node scripts/charakteryzacja-silnik-nagraj.mjs",
    ).toEqual(zapisana);
  });
});

describe("2. Charakteryzacja na realnych cennikach MO1–MO10", () => {
  let baza: TestowaBaza | null = null;

  afterEach(() => {
    baza?.posprzataj();
    baza = null;
  });

  for (const kod of KODY_DOSTAWCOW) {
    it(`${kod}: port silnika == oryginalne tk()`, () => {
      const wzorzec = wzorzecDostawcy(kod);
      const katalog = katalogDostawcy(kod);
      const rekordy = rekordyDostawcy(kod);

      expect(rekordy.length, `${kod}: wejście wzorca`).toBe(wzorzec.wejscie.rekordow);
      expect(katalog.length, `${kod}: katalog wzorca`).toBe(wzorzec.katalog.produktow);

      baza = stworzTestowaBaze();
      porownajZWzorcem(uruchomPort(baza.db, kod, katalog, rekordy), wzorzec, kod);
    });
  }
});

describe("3. Scenariusze celowane w gałęzie, których cenniki nie ruszają", () => {
  const wzorce = wczytaj<(Wzorzec & { nazwa: string; opis: string })[]>(
    join(katalogWzorca, "scenariusze.expected.json"),
  );

  let baza: TestowaBaza | null = null;

  afterEach(() => {
    baza?.posprzataj();
    baza = null;
  });

  for (const scenariusz of SCENARIUSZE) {
    it(`${scenariusz.nazwa}: ${scenariusz.opis.split(".")[0]}`, () => {
      const wzorzec = wzorce.find((w) => w.nazwa === scenariusz.nazwa);
      expect(wzorzec, `brak nagranego wzorca dla scenariusza ${scenariusz.nazwa}`).toBeDefined();

      baza = stworzTestowaBaze();
      porownajZWzorcem(
        uruchomPort(
          baza.db,
          scenariusz.dostawca,
          scenariusz.katalog as Wiersz[],
          scenariusz.rekordy as unknown as RekordSurowy[],
        ),
        wzorzec!,
        scenariusz.nazwa,
      );
    });
  }
});

describe("4. Przydatność próby — zielony wynik nie może brać się z pustego wejścia", () => {
  const wzorce = KODY_DOSTAWCOW.map(wzorzecDostawcy);
  const scenariusze = wczytaj<(Wzorzec & { nazwa: string })[]>(
    join(katalogWzorca, "scenariusze.expected.json"),
  );
  const wszystkieWiersze = [...wzorce, ...scenariusze].flatMap((w) => w.staging);

  it("cenniki dostarczają realnej objętości", () => {
    const rekordow = wzorce.reduce((suma, w) => suma + w.wejscie.rekordow, 0);
    const produktow = wzorce.reduce((suma, w) => suma + w.katalog.produktow, 0);
    expect(rekordow).toBeGreaterThan(1500);
    expect(produktow).toBeGreaterThan(7000);
    expect(wzorce.every((w) => w.wejscie.rekordow > 0)).toBe(true);
  });

  it("każdy typ zmiany w zakresie 3c jest realnie pokryty", () => {
    const typy = new Set(wszystkieWiersze.map((w) => w.typZmiany));
    expect([...typy].sort()).toEqual(["blad", "nowa", "zmiana_kluczowa"]);
  });

  it("gałęzie boczne silnika są pokryte", () => {
    const wszystkie: Wzorzec[] = [...wzorce, ...scenariusze];
    const suma = (klucz: string) =>
      wszystkie.reduce((s: number, w: Wzorzec) => s + Number(w.statystyki[klucz] ?? 0), 0);

    expect(suma("odrzuconeNieOpony"), "odrzucenia nie-opon").toBeGreaterThan(0);
    expect(suma("odrzuconeBrakDanych"), "odrzucenia braku danych").toBeGreaterThan(0);
    expect(suma("odrzuconeSmieciMO2"), "filtr śmieci MO2").toBeGreaterThan(0);
    expect(suma("autoZatwierdzone"), "decyzje auto-zatwierdzenia").toBeGreaterThan(0);
    expect(suma("bezZmian"), "pozycje bez zmian").toBeGreaterThan(0);

    const skasowanych = wszystkie.reduce((s: number, w: Wzorzec) => s + w.skasowane.length, 0);
    const resetow = wszystkie.reduce((s: number, w: Wzorzec) => s + w.resetyNieobecnosci.length, 0);
    expect(skasowanych, "kasowanie produktu przy nie-oponie").toBeGreaterThan(0);
    expect(resetow, "reset nieobecnosc_pod_rzad przy dopasowaniu").toBeGreaterThan(0);
  });

  it("ostrzeżenia i identyfikatory zastępcze faktycznie występują", () => {
    const ostrzezenia = wszystkieWiersze.map((w) => String(w.ostrzezenie ?? ""));
    expect(ostrzezenia.some((o) => o.includes("Konflikt EAN"))).toBe(true);
    expect(ostrzezenia.some((o) => o.includes("identyfikatora technicznego"))).toBe(true);
    expect(ostrzezenia.some((o) => o.includes("bledny zapis nazwy"))).toBe(true);
    expect(ostrzezenia.some((o) => o.includes("nie wykryto rozmiaru"))).toBe(true);
    expect(ostrzezenia.some((o) => o.startsWith("EAN: "))).toBe(true);
  });
});
