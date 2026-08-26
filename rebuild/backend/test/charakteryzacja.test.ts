// GATE ITERACJI 3a — dowód, że portowany podsystem parserów jest wierny oryginałowi.
//
// Trzy warstwy, bo dowodzą trzech różnych rzeczy:
//   1. INTEGRALNOŚĆ  — src/import/legacy/** jest bajt-w-bajt kopią mirror/backend/**.
//      To dowodzi dosłownie „port = oryginał 1:1" i wyłapuje przypadkową edycję portu.
//   2. CHARAKTERYZACJA — portowany potok na próbkach realnych plików dostawców daje
//      wyjście identyczne z tym, co dał ORYGINALNY parser (nagrane przez
//      scripts/charakteryzacja-nagraj.mjs). Przy porcie verbatim nie może to wykryć
//      błędu przepisania — bo nic nie przepisujemy — więc dowodzi czegoś innego i
//      równie potrzebnego: że podsystem DZIAŁA TAK SAMO w nowym środowisku (interop
//      ESM↔CJS, rozwiązywanie __dirname, wersje csv-parse/iconv-lite/xlsx, obecność
//      słownika). Jest też siatką regresji dla sesji 3b–3e i dla przyszłych
//      re-synchronizacji parserów z produkcją.
//   3. PRZYDATNOŚĆ PRÓBKI — zielony wynik nie może brać się z pustego wejścia.
//
// Nagranie wzorca: node scripts/charakteryzacja-nagraj.mjs
// Pochodzenie próbek:  test/charakteryzacja/ZRODLA.md

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { parsujBufor, parsujPlik } from "../src/import/parsuj.js";
import type { RekordSurowy, WynikParsowania } from "../src/import/typy.js";
import { pobierzMo9Offline } from "./charakteryzacja/mo9-offline.mjs";

const wymagaj = createRequire(import.meta.url);
const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const katalogPortu = join(backendDir, "src", "import", "legacy");
const katalogOryginalu = join(backendDir, "..", "..", "mirror", "backend");
const katalogCharakteryzacji = join(backendDir, "test", "charakteryzacja");
const katalogProbek = join(katalogCharakteryzacji, "probki");

/** Dostawcy z próbką plikową — parsowani przez pełne parsujPlik(). */
const PROBKI_PLIKOWE: Record<string, string> = {
  MO1: "MO1.csv",
  MO2: "MO2.csv",
  MO3: "MO3.csv",
  MO4: "MO4.csv",
  MO5: "MO5.csv",
  MO6: "MO6.csv",
  MO7: "MO7.csv",
  MO8: "MO8.xlsx",
  MO10: "MO10.csv",
};

const WSZYSCY_DOSTAWCY = [...Object.keys(PROBKI_PLIKOWE), "MO9"];

function sciezkiPlikow(katalog: string): string[] {
  return readdirSync(katalog).flatMap((wpis) => {
    const sciezka = join(katalog, wpis);
    return statSync(sciezka).isDirectory() ? sciezkiPlikow(sciezka) : [sciezka];
  });
}

const sha256 = (sciezka: string) =>
  createHash("sha256").update(readFileSync(sciezka)).digest("hex");

function wczytajWzorzec(kod: string): WynikParsowania {
  return JSON.parse(
    readFileSync(join(katalogCharakteryzacji, `${kod}.expected.json`), "utf-8"),
  ) as WynikParsowania;
}

/** Uruchamia portowany potok dla dostawcy — plikowy albo (MO9) przez offline API. */
async function uruchomPort(kod: string): Promise<WynikParsowania> {
  if (kod !== "MO9") return parsujPlik(kod, join(katalogProbek, PROBKI_PLIKOWE[kod]!));

  const api = wymagaj(join(katalogPortu, "parsers", "mo9_agrorami_api.cjs"));
  const adapter = wymagaj(join(katalogPortu, "parsers", "adapter.cjs"));
  const itemy = JSON.parse(readFileSync(join(katalogProbek, "MO9.items.json"), "utf-8"));
  const wynik = await pobierzMo9Offline(api, itemy);
  const rekordy = adapter.recordsToSurowe("MO9", wynik.records) as RekordSurowy[];
  return {
    dostawca: wynik.dostawca,
    rekordy,
    bledy: wynik.errors ?? [],
    odrzucone: wynik.odrzucone ?? [],
    odrzuconePrzezAdapter: wynik.records.length - rekordy.length,
  };
}

describe("1. Integralność portu — src/import/legacy jest kopią mirror/backend", () => {
  const pliki = sciezkiPlikow(katalogPortu).map((p) => relative(katalogPortu, p));

  it("obejmuje cały podsystem: common, słownik, adapter, tyre_params, dispatcher i 10 parserów", () => {
    expect(pliki).toContain("common.cjs");
    expect(pliki).toContain(join("dictionaries", "oznaczenia.json"));
    for (const nazwa of [
      "adapter.cjs",
      "tyre_params.cjs",
      "dispatcher.cjs",
      "mo1_bohnenkamp.cjs",
      "mo2_jmk.cjs",
      "mo3_grasdorf.cjs",
      "mo4_mo5_handlopex.cjs",
      "mo6_agrowiec.cjs",
      "mo7_nokian.cjs",
      "mo8_trelleborg.cjs",
      "mo9_agrorami.cjs",
      "mo9_agrorami_api.cjs",
      "mo10_gri.cjs",
    ]) {
      expect(pliki).toContain(join("parsers", nazwa));
    }
  });

  it.each(sciezkiPlikow(katalogPortu).map((p) => relative(katalogPortu, p)))(
    "%s jest bajt-w-bajt zgodny z oryginałem",
    (wzgledna) => {
      expect(sha256(join(katalogPortu, wzgledna))).toBe(
        sha256(join(katalogOryginalu, wzgledna)),
      );
    },
  );

  it("nie wciąga kopii zapasowych ani plików testowych producenta", () => {
    for (const plik of pliki) {
      expect(plik).not.toMatch(/\.bak_/);
      expect(plik).not.toMatch(/^parsers[\\/](test_tyres|check_raw_name|_mo9_.*_TEST)\.cjs$/);
    }
  });
});

describe("2. Charakteryzacja — port daje wyjście identyczne z oryginałem", () => {
  it.each(WSZYSCY_DOSTAWCY)("%s: rekordy zgadzają się co do pola", async (kod) => {
    const wzorzec = wczytajWzorzec(kod);
    const otrzymane = await uruchomPort(kod);

    expect(otrzymane.dostawca).toBe(wzorzec.dostawca);
    expect(otrzymane.rekordy).toHaveLength(wzorzec.rekordy.length);
    expect(otrzymane.odrzuconePrzezAdapter).toBe(wzorzec.odrzuconePrzezAdapter);
    expect(otrzymane.bledy).toHaveLength(wzorzec.bledy.length);
    expect(otrzymane.odrzucone).toHaveLength(wzorzec.odrzucone.length);

    // Porównanie pole po polu — przy rozjeździe komunikat wskazuje rekord i pole,
    // zamiast wyrzucać różnicę dwóch 200-elementowych tablic.
    for (let i = 0; i < wzorzec.rekordy.length; i++) {
      const oczekiwany = wzorzec.rekordy[i]!;
      const otrzymany = otrzymane.rekordy[i]!;
      expect(Object.keys(otrzymany).sort(), `${kod}[${i}] zestaw pól`).toEqual(
        Object.keys(oczekiwany).sort(),
      );
      for (const pole of Object.keys(oczekiwany) as (keyof RekordSurowy)[]) {
        expect(otrzymany[pole], `${kod}[${i}] (kod=${oczekiwany.kod}) pole "${pole}"`).toStrictEqual(
          oczekiwany[pole],
        );
      }
    }
  });
});

describe("3. Przydatność próbki — zielony wynik nie bierze się z pustego wejścia", () => {
  it.each(WSZYSCY_DOSTAWCY)("%s: rekordy istnieją, parser nie zgłasza błędów", async (kod) => {
    const wynik = await uruchomPort(kod);
    expect(wynik.rekordy.length).toBeGreaterThan(0);
    expect(wynik.bledy).toEqual([]);
  });

  it.each(WSZYSCY_DOSTAWCY)("%s: pola kluczowe są wypełnione", async (kod) => {
    const { rekordy } = await uruchomPort(kod);
    for (const rekord of rekordy) {
      expect(rekord.kod, `${kod}: brak kodu produktu`).toBeTruthy();
      expect(rekord.kod, `${kod}: kod bez prefiksu dostawcy`).toMatch(new RegExp(`^${kod}_`));
      expect(rekord.rozmiar, `${kod}/${rekord.kod}: brak rozmiaru`).toBeTruthy();
      expect(rekord.kategoria, `${kod}/${rekord.kod}: brak kategorii`).toBeTruthy();
      expect(rekord.nazwa, `${kod}/${rekord.kod}: brak nazwy`).toBeTruthy();
    }
  });

  it("łącznie charakteryzujemy komplet MO1–MO10", () => {
    expect(new Set(WSZYSCY_DOSTAWCY)).toEqual(
      new Set(["MO1", "MO2", "MO3", "MO4", "MO5", "MO6", "MO7", "MO8", "MO9", "MO10"]),
    );
  });
});

describe("4. Brzeg wejścia — parsujBufor jest równoważny parsujPlik", () => {
  it.each(Object.entries(PROBKI_PLIKOWE))(
    "%s: ten sam plik przez bufor daje ten sam wynik",
    (kod, nazwaPliku) => {
      const sciezka = join(katalogProbek, nazwaPliku);
      const zPliku = parsujPlik(kod, sciezka);
      const zBufora = parsujBufor(kod, readFileSync(sciezka), nazwaPliku);
      expect(zBufora).toStrictEqual(zPliku);
    },
  );

  it("odrzuca nieznany kod dostawcy zamiast parsować cokolwiek", () => {
    expect(() => parsujPlik("MO99", join(katalogProbek, "MO1.csv"))).toThrow(/Nieznany dostawca/);
  });
});
