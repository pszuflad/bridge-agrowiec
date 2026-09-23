// Kopiuje kanoniczne migracje (rebuild/schema/*.sql) do dist/schema/,
// żeby release wgrany na VPS był samowystarczalny — deploy kopiuje tylko dist/.
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(backendDir, "..", "schema");
const dest = join(backendDir, "dist", "schema");

// SPRZĄTANIE PRZED KOPIOWANIEM — `tsc` nie czyści `dist/`, a ten skrypt tylko NADPISYWAŁ pliki,
// więc migracja usunięta lub PRZENUMEROWANA w repo zostawała w `dist/schema/` jako widmo.
// Runner (`db/migrate.ts`) stosuje migracje PO NAZWIE, więc widmo pod starą nazwą wygląda jak
// niezastosowana migracja i leci drugi raz. Zmierzone na stagingu 2026-09-23 (ticket 147):
// `007_selly_products_warianty.sql` z cofniętej gałęzi (revert `48d8d84`) przeżył w katalogu
// roboczym deployu i przez 6 kolejnych wdrożeń wywracał je na
// „there is already another table or index with this name: selly_products_old" — staging stał
// na kodzie sprzed 6 wydań, a log deployu nie pokazywał przyczyny.
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const pliki = readdirSync(src).filter((f) => f.endsWith(".sql"));
for (const plik of pliki) cpSync(join(src, plik), join(dest, plik));
console.log(`copy-schema: skopiowano ${pliki.length} plik(ów) .sql do dist/schema/`);
