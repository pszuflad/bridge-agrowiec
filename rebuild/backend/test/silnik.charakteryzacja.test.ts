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
import { historiaCen, manualOverrides, products, stagingItems } from "../src/db/schema.js";
import type { Baza } from "../src/db/index.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { wytnijFragmenty } from "./charakteryzacja/silnik/oryginal.mjs";
import { SCENARIUSZE } from "./charakteryzacja/silnik/scenariusze.mjs";
import { KOLUMNY_HISTORII, POLA_PRODUKTU } from "./charakteryzacja/silnik/atrapy.mjs";
import { KODY_DOSTAWCOW, POLA_WIERSZA, UTWORZONO_WZORCOWE } from "./charakteryzacja/silnik/wzorzec.mjs";

const backendDir = dirname(fileURLToPath(import.meta.url));
const katalog3a = join(backendDir, "charakteryzacja");
const katalogWzorca = join(katalog3a, "silnik");

type Wiersz = Record<string, unknown>;
type ZmianaProduktu = { id: number; zmiany: Record<string, { przed: unknown; po: unknown }> };
type Wzorzec = {
  dostawca: string;
  wejscie: { rekordow: number };
  katalog: { produktow: number };
  overridy: { wierszy: number };
  statystyki: Record<string, unknown>;
  wierszyPoDeduplikacji: number;
  staging: Wiersz[];
  skasowane: number[];
  historiaCen: Wiersz[];
  zmianyProduktow: ZmianaProduktu[];
  zapytanDoPamieciLinkow: number;
};

const wczytaj = <T>(sciezka: string): T => JSON.parse(readFileSync(sciezka, "utf-8")) as T;

const wzorzecDostawcy = (kod: string) =>
  wczytaj<Wzorzec>(join(katalogWzorca, `${kod}.expected.json`));

const katalogDostawcy = (kod: string) =>
  wczytaj<Wiersz[]>(join(katalogWzorca, "katalog", `${kod}.katalog.json`));

/** REALNE poprawki Marty ze zrzutu produkcji — bez nich `Gq()` nie ma czego nakładać. */
const overridyDostawcy = (kod: string) =>
  wczytaj<Wiersz[]>(join(katalogWzorca, "overrides", `${kod}.overrides.json`));

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

/**
 * Znacznik czasu jest jeden na przebieg (`tk()`, :47585) i nieporównywalny między
 * uruchomieniami, więc wszędzie, gdzie występuje jako WARTOŚĆ, podstawiamy stały napis —
 * dokładnie tak, jak robi to `wzorzec.mjs` po stronie oryginału.
 */
const znormalizujZnacznik = (wartosc: unknown, znacznik: unknown) =>
  wartosc === znacznik ? UTWORZONO_WZORCOWE : wartosc;

/** Wiersz `historia_cen` w kształcie wzorca — te same kolumny, ta sama kolejność. */
function normalizujHistorie(wiersz: Wiersz, znacznik: unknown): Wiersz {
  return Object.fromEntries(
    KOLUMNY_HISTORII.map((k) => [k, znormalizujZnacznik(wiersz[k] ?? null, znacznik)]),
  );
}

/** Zmiana stanu produktu w kształcie wzorca. */
function normalizujZmianeProduktu(wpis: ZmianaProduktu, znacznik: unknown): ZmianaProduktu {
  const zmiany: ZmianaProduktu["zmiany"] = {};
  for (const [pole, { przed, po }] of Object.entries(wpis.zmiany)) {
    zmiany[pole] = {
      przed: znormalizujZnacznik(przed, znacznik),
      po: znormalizujZnacznik(po, znacznik),
    };
  }
  return { id: wpis.id, zmiany };
}

interface WynikPortu {
  statystyki: Record<string, unknown>;
  staging: Wiersz[];
  skasowane: number[];
  historiaCen: Wiersz[];
  zmianyProduktow: ZmianaProduktu[];
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
function uruchomPort(
  db: Baza,
  dostawca: string,
  katalog: Wiersz[],
  rekordy: RekordSurowy[],
  overridy: Wiersz[],
): WynikPortu {
  // Partiami, bo SQLite ma twardy limit zmiennych w jednym zapytaniu (domyślnie 32766),
  // a katalog MO5 to 1989 wierszy po 34 kolumny.
  const WIERSZY_NA_WSAD = 200;
  for (let i = 0; i < katalog.length; i += WIERSZY_NA_WSAD) {
    db.insert(products)
      .values(katalog.slice(i, i + WIERSZY_NA_WSAD) as unknown as (typeof products.$inferInsert)[])
      .run();
  }
  for (let i = 0; i < overridy.length; i += WIERSZY_NA_WSAD) {
    db.insert(manualOverrides)
      .values(
        overridy.slice(i, i + WIERSZY_NA_WSAD).map((o) => ({
          ...o,
          // Kolumny NOT NULL spoza projekcji `KOLUMNY_OVERRIDES` — `Gq()` ich nie czyta.
          createdAt: "2026-01-01T00:00:00.000Z",
        })) as unknown as (typeof manualOverrides.$inferInsert)[],
      )
      .run();
  }

  /** Stan produktów PRZED importem, w tych samych polach, co mierzą atrapy. */
  const stanProduktow = () =>
    new Map(
      (db.select().from(products).all() as unknown as Wiersz[]).map((p) => [
        p.id as number,
        Object.fromEntries(POLA_PRODUKTU.map((k) => [k, p[k] ?? null])),
      ]),
    );

  const przed = stanProduktow();
  const statystyki = silnikStagingu(db)(dostawca, rekordy);
  const po = stanProduktow();

  const skasowane = [...przed.keys()].filter((id) => !po.has(id)).sort((a, b) => a - b);

  // Mierzymy SKUTEK w bazie, a nie to, że wywołaliśmy odpowiednią funkcję — po stronie
  // oryginału atrapy liczą dokładnie to samo z własnego katalogu.
  const zmianyProduktow: ZmianaProduktu[] = [];
  for (const [id, stanPrzed] of przed) {
    const stanPo = po.get(id);
    if (!stanPo) continue; // skasowany — mierzy to osobno `skasowane`
    const zmiany: Record<string, { przed: unknown; po: unknown }> = {};
    for (const pole of POLA_PRODUKTU) {
      if (stanPrzed[pole] !== stanPo[pole]) zmiany[pole] = { przed: stanPrzed[pole], po: stanPo[pole] };
    }
    if (Object.keys(zmiany).length > 0) zmianyProduktow.push({ id, zmiany });
  }
  zmianyProduktow.sort((a, b) => a.id - b.id);

  const wiersze = db.select().from(stagingItems).all() as unknown as Wiersz[];
  const historia = db.select().from(historiaCen).all() as unknown as Wiersz[];

  // Ten sam sposób odczytu znacznika, co w skrypcie nagrywającym: z pierwszego artefaktu,
  // który go niesie. Przebieg bez wierszy i bez historii nie ma czego normalizować.
  const znacznik = wiersze[0]?.utworzono ?? historia[0]?.zarejestrowanoAt ?? null;

  return {
    statystyki,
    staging: wiersze.map(normalizujWiersz),
    skasowane,
    historiaCen: historia.map((w) => normalizujHistorie(w, znacznik)),
    zmianyProduktow: zmianyProduktow.map((z) => normalizujZmianeProduktu(z, znacznik)),
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

  // ZAKRES 3d-1 — efekty, których 3c nie miała i które są sednem tej sesji.
  expect(wynik.historiaCen.length, `${etykieta}: liczba wierszy historia_cen`).toBe(
    wzorzec.historiaCen.length,
  );
  for (const [i, oczekiwany] of wzorzec.historiaCen.entries()) {
    const nasz = wynik.historiaCen[i]!;
    for (const nazwaKolumny of KOLUMNY_HISTORII) {
      expect(
        nasz[nazwaKolumny],
        `${etykieta}: historia_cen wiersz ${i} (kod ${String(oczekiwany.kod)}), kolumna ${nazwaKolumny}`,
      ).toEqual(oczekiwany[nazwaKolumny]);
    }
  }

  expect(wynik.zmianyProduktow.length, `${etykieta}: liczba zmienionych produktów`).toBe(
    wzorzec.zmianyProduktow.length,
  );
  for (const [i, oczekiwana] of wzorzec.zmianyProduktow.entries()) {
    const nasza = wynik.zmianyProduktow[i]!;
    expect(nasza.id, `${etykieta}: zmiana produktu ${i} — id`).toBe(oczekiwana.id);
    expect(nasza.zmiany, `${etykieta}: zmiany produktu id=${oczekiwana.id}`).toEqual(
      oczekiwana.zmiany,
    );
  }

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
      const overridy = overridyDostawcy(kod);

      expect(rekordy.length, `${kod}: wejście wzorca`).toBe(wzorzec.wejscie.rekordow);
      expect(katalog.length, `${kod}: katalog wzorca`).toBe(wzorzec.katalog.produktow);
      expect(overridy.length, `${kod}: poprawki Marty we wzorcu`).toBe(wzorzec.overridy.wierszy);

      baza = stworzTestowaBaze();
      porownajZWzorcem(uruchomPort(baza.db, kod, katalog, rekordy, overridy), wzorzec, kod);
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
          (scenariusz.overrides ?? []) as Wiersz[],
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

  it("każdy typ zmiany jest realnie pokryty — z `wycofana` włącznie", () => {
    const typy = new Set(wszystkieWiersze.map((w) => w.typZmiany));
    expect([...typy].sort()).toEqual(["blad", "nowa", "wycofana", "zmiana_kluczowa"]);
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

    // ZAKRES 3d-1 — bez tych trzech linii zielony wynik nie znaczyłby nic dla tej sesji.
    expect(suma("wycofane"), "wycofania po trzech nieobecnościach").toBeGreaterThan(0);

    const skasowanych = wszystkie.reduce((s: number, w: Wzorzec) => s + w.skasowane.length, 0);
    const historii = wszystkie.reduce((s: number, w: Wzorzec) => s + w.historiaCen.length, 0);
    const zmianProduktow = wszystkie.reduce(
      (s: number, w: Wzorzec) => s + w.zmianyProduktow.length,
      0,
    );
    expect(skasowanych, "kasowanie produktu przy nie-oponie").toBeGreaterThan(0);
    expect(historii, "wpisy do historia_cen z auto-zatwierdzania").toBeGreaterThan(0);
    expect(zmianProduktow, "mutacje katalogu przez import").toBeGreaterThan(0);
  });

  it("poprawki Marty są realnie w grze — inaczej `Gq()` jechałoby na pustej ścieżce", () => {
    const overridow = wzorce.reduce((s, w) => s + w.overridy.wierszy, 0);
    expect(overridow, "wiersze manual_overrides w charakteryzacji cenników").toBeGreaterThan(10000);

    const ostrzezenia = wszystkieWiersze.map((w) => String(w.ostrzezenie ?? ""));
    expect(
      ostrzezenia.some((o) => o.includes("plik nadpisuje poprawke Marty")),
      "konflikt z poprawką Marty musi realnie wystąpić",
    ).toBe(true);
  });

  /**
   * Obserwacja ze strony ORYGINAŁU, nie porównanie portu: w `tk()` `applyLinkMemory` dostaje
   * PATCH auto-zatwierdzenia (bez `kod` i bez `marka/model/rozmiar`), więc wszystkie trzy
   * ścieżki pamięci linków odpadają na warunku wstępnym. Utrwalamy to, bo gdyby produkcja
   * zaczęła tu jednak czytać pamięć, przenagranie wzorca zapali ten test i wymusi decyzję.
   */
  it("tk() nie czyta pamięci linków — applyLinkMemory tylko przepisuje istniejący link", () => {
    const wszystkie: Wzorzec[] = [...wzorce, ...scenariusze];
    expect(wszystkie.map((w) => w.zapytanDoPamieciLinkow)).toEqual(wszystkie.map(() => 0));
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
