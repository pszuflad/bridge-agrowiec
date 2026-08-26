// Nagrywa OCZEKIWANE wyjście charakteryzacji, uruchamiając ORYGINALNE parsery z mirror/backend
// (nie port!) na próbkach z test/charakteryzacja/probki/.
//
// To jest wzorzec, do którego test porównuje portowany podsystem. Punkt przechwycenia =
// rekord PO adapter.recordsToSurowe(), przed jakimkolwiek zapisem do bazy — czyli dokładnie
// tam, gdzie kończy się zakres iteracji 3a.
//
// DLACZEGO KOPIUJEMY ORYGINAŁ DO .tmp/oryginal/
// Pliki w mirror/backend/ requireują `csv-parse`, `iconv-lite` i `xlsx` po gołej nazwie, a Node
// rozwiązuje takie ścieżki względem położenia MODUŁU, wspinając się po katalogach. Z mirror/
// nigdy nie trafi na rebuild/backend/node_modules. Kopia pod rebuild/backend/ rozwiązuje to bez
// dotykania mirrora (który jest lustrem produkcji i musi zostać nietknięty) i bez NODE_PATH.
//
// Uruchamiać po KAŻDEJ re-synchronizacji parserów z produkcją — wynik pokaże w git diff,
// co dokładnie zmieniło się w zachowaniu importu.
//
// Użycie:  node scripts/charakteryzacja-nagraj.mjs

import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { pobierzMo9Offline } from "../test/charakteryzacja/mo9-offline.mjs";

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoDir = join(backendDir, "..", "..");
const zrodloOryginalu = join(repoDir, "mirror", "backend");
const katalogTymczasowy = join(backendDir, ".tmp", "oryginal");
const katalogProbek = join(backendDir, "test", "charakteryzacja", "probki");
const katalogWynikow = join(backendDir, "test", "charakteryzacja");

/** Próbki plikowe: kod dostawcy → nazwa pliku w probki/. */
export const PROBKI_PLIKOWE = {
  MO1: "MO1.csv",
  MO2: "MO2.csv",
  MO3: "MO3.csv",
  MO4: "MO4.csv",
  MO5: "MO5.csv",
  MO6: "MO6.csv",
  MO7: "MO7.csv",
  MO8: "MO8.xlsx",
  MO10: "MO10.xlsx",
};

/** Przygotowuje kopię oryginału pod rebuild/backend/ i zwraca require wskazujący na nią. */
function przygotujOryginal() {
  rmSync(katalogTymczasowy, { recursive: true, force: true });
  mkdirSync(katalogTymczasowy, { recursive: true });

  cpSync(join(zrodloOryginalu, "common.cjs"), join(katalogTymczasowy, "common.cjs"));
  cpSync(join(zrodloOryginalu, "dictionaries"), join(katalogTymczasowy, "dictionaries"), {
    recursive: true,
  });
  cpSync(join(zrodloOryginalu, "parsers"), join(katalogTymczasowy, "parsers"), {
    recursive: true,
  });

  return createRequire(join(katalogTymczasowy, "index.cjs"));
}

/**
 * Uruchamia potok dostawcy i zwraca rekordy po recordsToSurowe().
 * Ta sama sekwencja co produkcyjne nq() w index.cjs, tylko bez zapisu do bazy.
 */
export async function nagrajDostawce(kod, wymagaj, katalogParserow) {
  const adapter = wymagaj(join(katalogParserow, "adapter.cjs"));

  if (kod === "MO9") {
    const api = wymagaj(join(katalogParserow, "mo9_agrorami_api.cjs"));
    const itemy = JSON.parse(readFileSync(join(katalogProbek, "MO9.items.json"), "utf-8"));
    const wynik = await pobierzMo9Offline(api, itemy);
    const rekordy = adapter.recordsToSurowe("MO9", wynik.records);
    return {
      dostawca: wynik.dostawca,
      rekordy,
      bledy: wynik.errors ?? [],
      odrzucone: wynik.odrzucone ?? [],
      odrzuconePrzezAdapter: wynik.records.length - rekordy.length,
    };
  }

  const dispatcher = wymagaj(join(katalogParserow, "dispatcher.cjs"));
  const wynik = dispatcher.parseByKod(kod, join(katalogProbek, PROBKI_PLIKOWE[kod]));
  const rekordy = adapter.recordsToSurowe(kod, wynik.records);
  return {
    dostawca: wynik.dostawca,
    rekordy,
    bledy: wynik.errors ?? [],
    odrzucone: wynik.odrzucone ?? [],
    odrzuconePrzezAdapter: wynik.records.length - rekordy.length,
  };
}

const wymagaj = przygotujOryginal();
const katalogParserow = join(katalogTymczasowy, "parsers");

try {
  for (const kod of [...Object.keys(PROBKI_PLIKOWE), "MO9"]) {
    const wynik = await nagrajDostawce(kod, wymagaj, katalogParserow);
    const cel = join(katalogWynikow, `${kod}.expected.json`);
    writeFileSync(cel, JSON.stringify(wynik, null, 2) + "\n", "utf-8");
    console.log(
      `${kod}: ${wynik.rekordy.length} rekordów, ${wynik.bledy.length} błędów, ` +
        `${wynik.odrzucone.length} odrzuconych przez parser, ` +
        `${wynik.odrzuconePrzezAdapter} odrzuconych przez adapter -> ${kod}.expected.json`,
    );
  }
} finally {
  rmSync(join(backendDir, ".tmp"), { recursive: true, force: true });
}
