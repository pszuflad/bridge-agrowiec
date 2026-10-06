// Ticket 178 — jednorazowe czyszczenie katalogu (Etap 3c SPEC 2026-10-01).
//   DB_PATH=./data/data-prod.db npm run normalizuj-katalog [-- --raport zmiany.csv]   # dry-run
//   DB_PATH=... npm run normalizuj-katalog -- --apply                                  # backup + zapis
// Logika: src/import/migracje/normalizuj-katalog.ts. Nazwy produktów NIE są zmieniane.
// Idempotentne: gdy nie ma zmian, --apply nie robi kopii ani zapisu (bezpieczne przy każdym deployu).

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import {
  raportNormalizacjiCsv,
  zaplanujNormalizacje,
  zastosujNormalizacje,
} from "../src/import/migracje/normalizuj-katalog.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("normalizuj-katalog: brak DB_PATH — nie wiem, którą bazę czyścić. Przerywam.");
  process.exit(1);
}
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const iRaport = args.indexOf("--raport");
const plikRaportu = iRaport >= 0 ? args[iRaport + 1] : undefined;

const { sqlite } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);
  const plan = zaplanujNormalizacje(sqlite);
  if (plikRaportu) writeFileSync(plikRaportu, "﻿" + raportNormalizacjiCsv(plan), "utf-8");
  const doZmiany = plan.filter((z) => z.status === "zmiana");
  const poPolu = new Map<string, number>();
  for (const z of doZmiany) poPolu.set(z.pole, (poPolu.get(z.pole) ?? 0) + 1);
  console.log(
    `normalizuj-katalog: ${doZmiany.length} zmian do zapisu, ` +
      `${plan.length - doZmiany.length} pominiętych (poprawka ręczna).`,
  );
  for (const [p, n] of poPolu) console.log(`  ${p}: ${n}`);
  if (apply && doZmiany.length === 0) {
    console.log("normalizuj-katalog: katalog już czysty — nic do zapisu, kopii nie robię.");
  } else if (apply) {
    const znacznik = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const katalog = join(dirname(dbPath), "backups");
    mkdirSync(katalog, { recursive: true });
    const kopia = join(katalog, `${basename(dbPath)}.bak_full_normalizacja_${znacznik}`);
    sqlite.prepare("VACUUM INTO ?").run(kopia);
    console.log(`normalizuj-katalog: kopia bazy: ${kopia}`);
    console.log(`normalizuj-katalog: zapisano ${zastosujNormalizacje(sqlite)} zmian.`);
  }
} finally {
  sqlite.close();
}
