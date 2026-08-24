// Kopiuje kanoniczne migracje (rebuild/schema/*.sql) do dist/schema/,
// żeby release wgrany na VPS był samowystarczalny — deploy kopiuje tylko dist/.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(backendDir, "..", "schema");
const dest = join(backendDir, "dist", "schema");

mkdirSync(dest, { recursive: true });
const pliki = readdirSync(src).filter((f) => f.endsWith(".sql"));
for (const plik of pliki) cpSync(join(src, plik), join(dest, plik));
console.log(`copy-schema: skopiowano ${pliki.length} plik(ów) .sql do dist/schema/`);
