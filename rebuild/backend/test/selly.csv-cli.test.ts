/**
 * Polecenie `npm run selly:csv` (backlog #102, karta I15.3).
 *
 * ⭐ PO CO TEN TEST ISTNIEJE. Po cutoverze ten generator odpala **cron systemowy**, a nie
 * człowiek klikający w panelu — i jeśli CLI rozjedzie się z trasą, nikt tego nie zobaczy.
 * Objawem będzie dopiero to, że Selly o 12:00 zaciąga plik inny niż ten, który Ania widzi
 * po ręcznym „zrób to teraz". Dlatego test odpala CLI **naprawdę, jako osobny proces**,
 * dokładnie tak, jak zrobi to cron: własne środowisko, własne otwarcie bazy, `process.exitCode`.
 * Wywołanie funkcji w tym samym procesie sprawdzałoby o jedną warstwę za mało — nie dotknęłoby
 * ani odczytu `SELLY_CSV_*`, ani budowania ścieżek, czyli tego, co przy cutoverze najłatwiej pomylić.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sciezkaPliku, wygenerujCsvSelly } from "../src/selly/generator-csv.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { zasiejProdukty } from "./gate/dane.js";

const KATALOG_BACKENDU = fileURLToPath(new URL("..", import.meta.url));
const WEJSCIE_CLI = join(KATALOG_BACKENDU, "src", "selly", "csv-cli.ts");
const TSX = join(KATALOG_BACKENDU, "node_modules", ".bin", "tsx");

describe("CLI generatora CSV dla Selly (`npm run selly:csv`, backlog #102)", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejProdukty(baza.db);
    // CLI otwiera bazę własnym połączeniem — zamykamy nasze zapisy, żeby zobaczył komplet.
    baza.sqlite.pragma("wal_checkpoint(TRUNCATE)");
  });

  afterEach(() => baza.posprzataj());

  /** Uruchomienie CLI tak, jak zrobi to cron: osobny proces, konfiguracja wyłącznie z env. */
  const uruchomCli = (katalog: string, nadpisania: Record<string, string | undefined> = {}): string => {
    const env: Record<string, string | undefined> = {
      ...process.env,
      DB_PATH: baza.sciezka,
      JWT_SECRET: "test-cli",
      SELLY_CSV_DIR: katalog,
      SELLY_CSV_PLIK: "selly.csv",
      SELLY_CSV_URL: "https://przyklad/selly.csv",
      ...nadpisania,
    };
    for (const [klucz, wartosc] of Object.entries(nadpisania)) {
      if (wartosc === undefined) delete env[klucz];
    }
    return execFileSync(TSX, [WEJSCIE_CLI], { cwd: KATALOG_BACKENDU, encoding: "utf8", env });
  };

  /**
   * ⭐ GŁÓWNA ASERCJA KARTY: „plik z CLI identyczny z plikiem z trasy". Porównujemy BAJTY,
   * nie liczbę wierszy — różnica w BOM-ie, w złamaniu linii albo w jednej transformacji
   * przeszłaby przez porównanie liczby wierszy niezauważona, a Selly rozjechałaby.
   */
  it("tworzy plik bajt w bajt identyczny z plikiem z trasy", () => {
    const zTrasy = {
      katalog: `${baza.sciezka}-trasa`,
      plik: "selly.csv",
      url: "https://przyklad/selly.csv",
    };
    wygenerujCsvSelly(baza.db, zTrasy);
    const oczekiwany = readFileSync(sciezkaPliku(zTrasy));

    const katalogCli = `${baza.sciezka}-cli`;
    uruchomCli(katalogCli);

    expect(readFileSync(join(katalogCli, "selly.csv"))).toEqual(oczekiwany);
  });

  /**
   * Cron produkcji loguje stdout. Treść zostaje rozpoznawalna dla kogoś, kto czyta logi
   * sprzed cutoveru — to te same cztery linie, które wypisywał `generate_selly_export.cjs`.
   */
  it("wypisuje te same cztery linie co skrypt produkcji", () => {
    const katalog = `${baza.sciezka}-cli-stdout`;

    const stdout = uruchomCli(katalog);

    expect(stdout).toContain(`Zapisano: ${join(katalog, "selly.csv")}`);
    expect(stdout).toContain("Liczba produktow aktywnych: 3");
    expect(stdout).toContain("Liczba kolumn: 60");
    expect(stdout).toMatch(/Rozmiar pliku \(bajty\): \d+/);
  });

  /**
   * ⭐ CRON NIE DZIEDZICZY ŚRODOWISKA SERWERA. Linia w `crontab` startuje z gołym `env`, więc
   * gdyby polecenie wymagało `JWT_SECRET` (którego generowanie CSV w ogóle nie dotyka), padłoby
   * po cutoverze — a objawem byłoby dopiero to, że Selly o 12:00 zaciąga wczorajszy katalog.
   * Ten test pilnuje, że do wygenerowania pliku wystarczy `DB_PATH` i ścieżki `SELLY_CSV_*`.
   */
  it("działa bez `JWT_SECRET` — cron nie ma pełnego środowiska serwera", () => {
    const katalog = `${baza.sciezka}-cli-bez-jwt`;

    const stdout = uruchomCli(katalog, { JWT_SECRET: undefined });

    expect(stdout).toContain("Liczba kolumn: 60");
    expect(readFileSync(join(katalog, "selly.csv")).length).toBeGreaterThan(0);
  });

  /**
   * ⚠ `DB_PATH` zostaje WYMAGANY — w odróżnieniu od `JWT_SECRET`. Cichy fallback na domyślną
   * ścieżkę oznaczałby generowanie pliku z NIE TEJ bazy, czego nikt by nie zauważył.
   * Ma paść głośno i z niezerowym kodem wyjścia, żeby cron zgłosił błąd.
   */
  it("bez `DB_PATH` kończy się błędem, a nie plikiem z przypadkowej bazy", () => {
    const katalog = `${baza.sciezka}-cli-bez-db`;

    expect(() => uruchomCli(katalog, { DB_PATH: undefined })).toThrow();
    expect(existsSync(join(katalog, "selly.csv"))).toBe(false);
  });

  /**
   * ⚠ Plik CSV leży na produkcji w katalogu chronionym `.htaccess` z białą listą IP
   * (Selly + Agrowiec). Cron ma nadpisywać SAM PLIK CSV — skasowanie albo nadpisanie
   * `.htaccess` odbiera Selly dostęp do katalogu (403) i nikt się o tym nie dowie, dopóki
   * sklep nie przestanie się aktualizować. `docs/cutover.md`, krok „Frontend na miejsce".
   */
  it("nie rusza `.htaccess` ani innych plików w katalogu eksportu", () => {
    const katalog = `${baza.sciezka}-cli-htaccess`;
    const trescHtaccess = "Require ip 127.0.0.1\n";
    uruchomCli(katalog); // pierwszy przebieg zakłada katalog
    writeFileSync(join(katalog, ".htaccess"), trescHtaccess, "utf8");

    uruchomCli(katalog);

    expect(readFileSync(join(katalog, ".htaccess"), "utf8")).toBe(trescHtaccess);
    expect(readdirSync(katalog).sort()).toEqual([".htaccess", "selly.csv"]);
  });
});
