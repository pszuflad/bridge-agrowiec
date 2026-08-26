// Kopiuje portowany podsystem parserów (src/import/legacy/**) do dist/import/legacy/.
//
// Powód: `tsc` przenosi wyłącznie pliki, które kompiluje — moduły `.cjs` oraz słownik
// `dictionaries/oznaczenia.json` zostałyby w src/ i release wgrany na VPS (deploy kopiuje
// tylko dist/) nie miałby czym parsować plików dostawców. To ta sama zasada co
// scripts/copy-schema.mjs, tylko dla innego rodzaju assetu.
import { cpSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(backendDir, "src", "import", "legacy");
const dest = join(backendDir, "dist", "import", "legacy");

/** Zwraca ścieżki wszystkich plików w katalogu, rekurencyjnie. */
function wszystkiePliki(katalog) {
  const wynik = [];
  for (const wpis of readdirSync(katalog)) {
    const sciezka = join(katalog, wpis);
    if (statSync(sciezka).isDirectory()) wynik.push(...wszystkiePliki(sciezka));
    else wynik.push(sciezka);
  }
  return wynik;
}

const pliki = wszystkiePliki(src);
for (const plik of pliki) {
  const cel = join(dest, relative(src, plik));
  mkdirSync(dirname(cel), { recursive: true });
  cpSync(plik, cel);
}
console.log(`copy-parsery: skopiowano ${pliki.length} plik(ów) do dist/import/legacy/`);
