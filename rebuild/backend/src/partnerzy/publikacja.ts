// Publikacja wygenerowanych cenników do katalogów partnerów (karta PARTNERZY, ticket 238).
//
// Katalogi FTP partnerów leżą na TYM SAMYM serwerze co Bridge i są zapisywalne dla procesu (potwierdzone odczytem serwera 2026-10-12), więc
// publikacja to kopia pliku do katalogu partnera przez plik tymczasowy + rename (partner nigdy nie widzi pliku w połowie). Mapowanie
// partner → katalog jest w `PARTNERZY_KATALOGI_PUBLIKACJI` (`Nazwa=/ścieżka;Nazwa2=/ścieżka2`) i jest ustawiane WYŁĄCZNIE w `.env` produkcji —
// środowisko testowe działa na tym samym serwerze jako ten sam użytkownik i bez tej zmiennej nic nie publikuje. Brak wpisu = brak publikacji.
// Katalog docelowy musi już istnieć (nie tworzymy ścieżek na serwerze plików). Błąd jednego pliku nie przerywa pozostałych.

import { copyFileSync, renameSync, rmSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export type KatalogiPublikacji = ReadonlyMap<string, string>;

/** Parsuje `Nazwa=/ścieżka;Nazwa2=/ścieżka2` (nazwa partnera bez rozróżniania wielkości liter). Niepoprawny wpis → błąd z opisem. */
export function parsujKatalogiPublikacji(tekst: string | undefined, zmienna = "PARTNERZY_KATALOGI_PUBLIKACJI"): Map<string, string> {
  const wynik = new Map<string, string>();
  for (const wpis of (tekst ?? "").split(";")) {
    const t = wpis.trim();
    if (t === "") continue;
    const i = t.indexOf("=");
    const nazwa = i > 0 ? t.slice(0, i).trim() : "";
    const sciezka = i > 0 ? t.slice(i + 1).trim() : "";
    if (nazwa === "" || !isAbsolute(sciezka)) throw new Error(`${zmienna}: niepoprawny wpis „${nazwa || t}” (oczekiwane Nazwa=/ścieżka bezwzględna).`);
    wynik.set(nazwa.toLowerCase(), sciezka);
  }
  return wynik;
}

export type WynikPublikacji = { opublikowane: string[]; bledy: string[] };

/** Kopiuje pliki `nazwy` z `zrodlo` do `docelowy`. Nazwy muszą być zwykłymi nazwami plików (bez ścieżek). */
export function publikujPliki(zrodlo: string, docelowy: string, nazwy: readonly string[]): WynikPublikacji {
  const wynik: WynikPublikacji = { opublikowane: [], bledy: [] };
  try {
    if (!statSync(docelowy).isDirectory()) throw new Error("to nie katalog");
  } catch (e) {
    wynik.bledy.push(`Publikacja: katalog docelowy ${docelowy} niedostępny (${e instanceof Error ? e.message : e}) — pliki nie zostały opublikowane.`);
    return wynik;
  }
  for (const nazwa of nazwy) {
    if (nazwa !== nazwa.split(/[\\/]/).pop() || nazwa === "" || nazwa.startsWith(".")) {
      wynik.bledy.push(`Publikacja: pominięto niepoprawną nazwę pliku „${nazwa}”.`);
      continue;
    }
    const plik = join(docelowy, nazwa);
    const tymczasowy = `${plik}.tmp-${process.pid}`;
    try {
      copyFileSync(join(zrodlo, nazwa), tymczasowy);
      renameSync(tymczasowy, plik);
      wynik.opublikowane.push(nazwa);
    } catch (e) {
      wynik.bledy.push(`Publikacja: ${nazwa} — ${e instanceof Error ? e.message : e}`);
    } finally {
      rmSync(tymczasowy, { force: true });
    }
  }
  return wynik;
}
