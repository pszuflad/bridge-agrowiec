// Odtwarza próbki plików dostawców MO1–MO5 z historii repozytorium.
//
// Pliki pochodzą z mirror/backend/import_archive/ — katalogu zrzutów realnych importów
// produkcji, usuniętego z drzewa commitem 72957d7 („wyklucz import_archive + usuń 1874
// zarchiwizowane CSV"). W historii są nadal dostępne pod 72957d7^.
//
// Próbki tniemy do PROBKA_WIERSZY wierszy danych, bo pełne pliki (95 KB – 742 KB) dałyby
// fixtures rzędu dziesiątek MB — nieczytelne w review i wracające jako bloat, który
// commit 72957d7 świadomie usunął. Cięcie idzie po BAJTACH na granicy \n, nigdy przez
// dekodowanie tekstu: pliki są w cp1250 albo utf-8 z BOM i każda konwersja tam i z powrotem
// mogłaby po cichu zmienić bajty, które parser realnie widzi.
//
// Próbki MO6–MO10 NIE powstają tutaj — patrz test/charakteryzacja/ZRODLA.md.
//
// Użycie:  node scripts/charakteryzacja-probki.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoDir = join(backendDir, "..", "..");
const katalogProbek = join(backendDir, "test", "charakteryzacja", "probki");

/** Commit, którego RODZIC (72957d7^) trzyma jeszcze cały import_archive. */
const COMMIT_ARCHIWUM = "72957d7^";
const PROBKA_WIERSZY = 200;

const ZRODLA = [
  { kod: "MO1", plik: "MO1__20260821__08471__bohnenkamp.csv", naglowek: false },
  { kod: "MO2", plik: "MO2__20260824__13195__rdzen.csv", naglowek: true },
  { kod: "MO3", plik: "MO3__20260821__08480__test-csv-3_t1004_pl.csv", naglowek: true },
  { kod: "MO4", plik: "MO4__20260824__05585__agrowiec_wr.csv", naglowek: true },
  { kod: "MO5", plik: "MO5__20260825__13431__agrowiec_mw.csv", naglowek: true },
];

/** Zwraca zawartość pliku z historii gita jako Buffer (bez konwersji kodowania). */
function zHistorii(sciezkaWRepo) {
  return execFileSync("git", ["show", `${COMMIT_ARCHIWUM}:${sciezkaWRepo}`], {
    cwd: repoDir,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Tnie bufor do `ileWierszy` wierszy, licząc po bajtach \n. Zachowuje bajty 1:1. */
function przytnijDoWierszy(bufor, ileWierszy) {
  let wierszy = 0;
  for (let i = 0; i < bufor.length; i++) {
    if (bufor[i] !== 0x0a) continue;
    if (++wierszy === ileWierszy) return bufor.subarray(0, i + 1);
  }
  return bufor;
}

mkdirSync(katalogProbek, { recursive: true });

for (const { kod, plik, naglowek } of ZRODLA) {
  const sciezkaWRepo = `mirror/backend/import_archive/2026-08/${plik}`;
  const pelny = zHistorii(sciezkaWRepo);
  const wycinek = przytnijDoWierszy(pelny, PROBKA_WIERSZY + (naglowek ? 1 : 0));
  const cel = join(katalogProbek, `${kod}.csv`);
  writeFileSync(cel, wycinek);
  console.log(
    `${kod}: ${plik} — ${pelny.length} B -> ${wycinek.length} B (${PROBKA_WIERSZY} wierszy danych${naglowek ? " + nagłówek" : ", bez nagłówka"})`,
  );
}
