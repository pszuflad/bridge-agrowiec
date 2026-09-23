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

import { silnikStagingu, type OpcjeImportu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { historiaCen, manualOverrides, products, stagingItems } from "../src/db/schema.js";
import type { Baza } from "../src/db/index.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { wytnijFragmenty } from "./charakteryzacja/silnik/oryginal.mjs";
import { SCENARIUSZE } from "./charakteryzacja/silnik/scenariusze.mjs";
import { KOLUMNY_HISTORII, POLA_PRODUKTU } from "./charakteryzacja/silnik/polityka.mjs";
import {
  KODY_DOSTAWCOW,
  normalizujWiersz,
  POLA_WIERSZA,
  UTWORZONO_WZORCOWE,
} from "./charakteryzacja/silnik/wzorzec.mjs";

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
  blad?: string | null;
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
  /** Komunikat blokady źródła (#103), gdy import się zatrzymał; `null` przy przebiegu udanym. */
  blad: string | null;
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
/**
 * Migracja 011 (karta I15.1, backlog #73/#75/#79) zakłada triggery, które przy każdym INSERT/UPDATE
 * `products` i `manual_overrides` normalizują kategorię, zastosowanie i blokady płatności.
 * Wzorzec nagrano, uruchamiając oryginalne `tk()` na ATRAPACH w JS (`atrapy.mjs`) — bez SQLite, więc
 * bez triggerów. Charakteryzacja porównuje SILNIK, a triggery to warstwa bazy, identyczna w obu
 * stosach i testowana osobno (`test/db.migracje.test.ts`). Bez ich zdjęcia katalog wzorca zmieniałby
 * się już przy wsadzeniu do bazy (np. `rolnicze` → `Rolnicze`) i porównanie przestałoby mierzyć silnik.
 */
function bezTriggerowBazy(baza: TestowaBaza): TestowaBaza {
  for (const t of [
    "products_blokowane_formy_ai",
    "products_blokowane_formy_au",
    "products_zastosowanie_ai",
    "products_zastosowanie_au",
    "manual_overrides_kategoria_ai",
    "manual_overrides_kategoria_au",
  ]) {
    baza.sqlite.exec(`DROP TRIGGER ${t}`);
  }
  return baza;
}

function uruchomPort(
  db: Baza,
  dostawca: string,
  katalog: Wiersz[],
  rekordy: RekordSurowy[],
  overridy: Wiersz[],
  opcje: OpcjeImportu = {},
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
  // Blokada źródła (#103) jest WYNIKIEM przebiegu, nie awarią testu — wzorzec nagrywa ją
  // w polu `blad`, więc port musi ją tak samo oddać, a nie wywrócić się na niej.
  let statystyki: WynikPortu["statystyki"] | null = null;
  let blad: string | null = null;
  try {
    statystyki = silnikStagingu(db)(dostawca, rekordy, opcje);
  } catch (e) {
    blad = (e as Error).message;
  }
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
    statystyki: statystyki ?? ({} as WynikPortu["statystyki"]),
    blad,
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

  expect(wynik.blad ?? null, `${etykieta}: blokada źródła`).toEqual(wzorzec.blad ?? null);
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

      baza = bezTriggerowBazy(stworzTestowaBaze());
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

      baza = bezTriggerowBazy(stworzTestowaBaze());
      porownajZWzorcem(
        uruchomPort(
          baza.db,
          scenariusz.dostawca,
          scenariusz.katalog as Wiersz[],
          scenariusz.rekordy as unknown as RekordSurowy[],
          (scenariusz.overrides ?? []) as Wiersz[],
          // Scenariusze mają SPÓJNY katalog, więc — jak w nagrywarce — deklarują kompletną
          // ofertę i przechodzą przez gałęzie #103/#104.
          scenariusz.meta === null
            ? {}
            : {
                meta: (scenariusz.meta ?? {
                  complete: true,
                  parserErrors: 0,
                  source: scenariusz.dostawca === "MO9" ? "Agrorami GraphQL" : "supplier file",
                  rawCount: scenariusz.rekordy.length,
                  excludedCodes: [],
                }) as OpcjeImportu["meta"],
                ...(scenariusz.opcje ?? {}),
              },
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

  it("typy zmian pokryte przez cenniki i scenariusze", () => {
    const typy = new Set(wszystkieWiersze.map((w) => w.typZmiany));
    // ⚠ BEZ `wycofana` — i tak ma być. Od #103 wycofanie wymaga TRZECH różnych kompletnych
    // ofert i minimum 24 h między potwierdzeniami, więc pojedynczy przebieg nie może go
    // wytworzyć. Regułę 3×24 h pokrywa `test/silnik.polityka-zrodla.test.ts`, który
    // porównuje port z ŻYWYM oryginałem na serii przebiegów.
    expect([...typy].sort()).toEqual(["blad", "nowa", "zmiana_kluczowa"]);
  });

  it("gałęzie boczne silnika są pokryte", () => {
    const wszystkie: Wzorzec[] = [...wzorce, ...scenariusze];
    const suma = (klucz: string) =>
      wszystkie.reduce((s: number, w: Wzorzec) => s + Number(w.statystyki[klucz] ?? 0), 0);

    expect(suma("odrzuconeNieOpony"), "odrzucenia nie-opon").toBeGreaterThan(0);
    expect(suma("autoZatwierdzone"), "decyzje auto-zatwierdzenia").toBeGreaterThan(0);
    expect(suma("bezZmian"), "pozycje bez zmian").toBeGreaterThan(0);
    expect(suma("nowe"), "nowe pozycje").toBeGreaterThan(0);
    expect(suma("zmienione"), "pozycje zmienione").toBeGreaterThan(0);

    const historii = wszystkie.reduce((s: number, w: Wzorzec) => s + w.historiaCen.length, 0);
    const zmianProduktow = wszystkie.reduce(
      (s: number, w: Wzorzec) => s + w.zmianyProduktow.length,
      0,
    );
    expect(historii, "wpisy do historia_cen z auto-zatwierdzania").toBeGreaterThan(0);
    expect(zmianProduktow, "mutacje katalogu przez import").toBeGreaterThan(0);

    // ⚠ Liczniki, które `staging_policy` deklaruje, ale których NIGDY nie podbija.
    // `odrzuconeBrakDanych` nie ma w module ani jednego `++` — pozycja bez danych idzie do
    // stagingu jako `blad`, a nie do licznika odrzuceń. Utrwalamy to, bo gdyby produkcja
    // zaczęła go używać, wzorzec to pokaże.
    expect(suma("odrzuconeBrakDanych"), "licznik braku danych jest martwy").toBe(0);

    // ⚠ Od I15.4b kasowanie produktu przy nie-oponie NIE ZACHODZI. Stary `tk()` usuwał kartę
    // z katalogu (`:47689`); `staging_policy` zostawia ją i wystawia sprawę do sprawdzenia.
    const skasowanych = wszystkie.reduce((s: number, w: Wzorzec) => s + w.skasowane.length, 0);
    expect(skasowanych, "polityka stagingu nie kasuje kart z katalogu").toBe(0);
  });

  it("blokady źródła (#103) są realnie wyzwalane", () => {
    const zablokowane = scenariusze.filter((w) => w.blad);
    expect(zablokowane.length, "scenariusze zatrzymane blokadą źródła").toBeGreaterThan(0);
    // Cennik, z którego po filtrach nie zostaje ani jedna pozycja, jest „podejrzanie mały" —
    // to ta sama gałąź, która chroni przed obciętym plikiem dostawcy.
    expect(
      zablokowane.some((w) => String(w.blad).includes("podejrzanie mały")),
      "próg minimalnej wielkości cennika",
    ).toBe(true);
  });

  it("poprawki Marty są realnie w grze — inaczej `protect()` jechałoby na pustej ścieżce", () => {
    const overridow = wzorce.reduce((s, w) => s + w.overridy.wierszy, 0);
    expect(overridow, "wiersze manual_overrides w charakteryzacji cenników").toBeGreaterThan(10000);

    // ⚠ BEZ asercji na ostrzeżenie „plik nadpisuje poprawke Marty". Stary `tk()` meldował
    // konflikt przez `Gq()`; `protect()` w `staging_policy` (`:158-162`) nakłada poprawkę
    // CICHO i nie zostawia śladu w ostrzeżeniu. Że poprawki realnie się nakładają, widać
    // w scenariuszach `override-*`, które porównują się z oryginałem pole po polu.
    const scenariuszeOverride = scenariusze.filter((w) => w.nazwa.startsWith("override-"));
    expect(scenariuszeOverride.length, "scenariusze poprawek Marty").toBeGreaterThan(0);
  });

  it("ostrzeżenia nowego silnika faktycznie występują", () => {
    const ostrzezenia = wszystkieWiersze.map((w) => String(w.ostrzezenie ?? ""));
    // Słownik ostrzeżeń zmienił się razem z silnikiem — to są komunikaty `staging_policy`,
    // nie starego `tk()`.
    expect(ostrzezenia.some((o) => o.includes("Sprawdź dopasowanie")), "sprawy dopasowania").toBe(
      true,
    );
    expect(ostrzezenia.some((o) => o.includes("Błędny EAN")), "ścisła walidacja EAN (D4)").toBe(
      true,
    );
    expect(ostrzezenia.some((o) => o.includes("Nie wykryto rozmiaru opony")), "brak rozmiaru").toBe(
      true,
    );
    expect(
      ostrzezenia.some((o) => o.includes("Błędny zapis nazwy")),
      "kontrola zapisu nazwy",
    ).toBe(true);
    expect(
      ostrzezenia.some((o) => o.includes("Brak kodu dostawcy i poprawnego EAN")),
      "pozycja bez jakiegokolwiek identyfikatora",
    ).toBe(true);
  });
});
