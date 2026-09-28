// Pomiar #107 — zatwierdzanie zbiorcze stagingu na KOPII bazy produkcji.
//
// Backlog #107: „zatwierdzanie zbiorcze stagingu blokowało panel na 5 s na pozycję".
// Produkcja naprawiała skutek własnej architektury: `uwaga_cena_patch.cjs` otwiera WŁASNE
// połączenie do `data.db`, więc każda pozycja czekała na blokadę zapisu. Odbudowa ma jedno
// połączenie i `uwagaCena` jako zwykłą kolumnę modelu. Pytanie: czy nas to dotyczy?
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { stagingItems } from "../src/db/schema.js";
import { zatwierdzPozycjeZPolityka } from "../src/import/polityka/akceptacja.js";
import { zatwierdzPozycjeStagingu } from "../src/import/akceptacja.js";

const ZRODLO = process.argv[2]!;
const ILE = Number(process.argv[3] ?? 200);
/** `polityka` (Staging v2, grupowanie przez compatibility) albo `bazowa` (grupowanie po EAN). */
const WARIANT = (process.argv[4] ?? "polityka") as "polityka" | "bazowa";
const KATALOG_SCHEMATU = join(import.meta.dirname, "..", "..", "schema");

const katalog = mkdtempSync(join(tmpdir(), "pomiar-107-"));
const sciezka = join(katalog, "kopia.db");
copyFileSync(ZRODLO, sciezka);

const { sqlite, db } = otworzBaze(sciezka);
const t0 = performance.now();
zastosujMigracje(sqlite, KATALOG_SCHEMATU);
const tMigracje = performance.now() - t0;

const ileProduktow = (
  sqlite.prepare("SELECT COUNT(*) AS c FROM products").get() as { c: number }
).c;

// Pozycje NOWE (kodów nie ma w katalogu), więc `_catalogVersion: null` przechodzi blokadę 7/7.
const wiersze = Array.from({ length: ILE }, (_, i) => {
  const kod = `POMIAR-107-${i}`;
  return {
    typZmiany: "nowa",
    kod,
    nazwa: `Opona pomiarowa ${i} 480/70R28`,
    dostawca: "MO5",
    magazyn: "PL",
    stanNowy: 4,
    cenaZakupuNowa: 1000 + i,
    utworzono: new Date().toISOString(),
    snapshotJson: JSON.stringify({
      _policyVersion: 2,
      _catalogVersion: null,
      kod,
      nazwa: `Opona pomiarowa ${i} 480/70R28`,
      marka: "BKT",
      model: "AGRIMAX RT 765",
      kategoria: "Rolnicze",
      rozmiar: "480/70R28",
      ean: null,
      uwagaCena: i % 3 === 0 ? "cena na zapytanie" : null,
    }),
  };
});
db.insert(stagingItems).values(wiersze as never).run();
const idki = (
  sqlite
    .prepare("SELECT id FROM staging_items WHERE kod LIKE 'POMIAR-107-%' ORDER BY id")
    .all() as { id: number }[]
).map((r) => r.id);

const czasy: number[] = [];
const start = performance.now();
for (const id of idki) {
  const a = performance.now();
  if (WARIANT === "polityka") zatwierdzPozycjeZPolityka(db, id, 1);
  else zatwierdzPozycjeStagingu(db, id, 1);
  czasy.push(performance.now() - a);
}
const calosc = performance.now() - start;

czasy.sort((a, b) => a - b);
const ile = czasy.length;
const suma = czasy.reduce((s, x) => s + x, 0);
const pokazMs = (n: number) => `${n.toFixed(1)} ms`;

const zapisane = (
  sqlite
    .prepare("SELECT COUNT(*) AS c FROM products WHERE kod LIKE 'POMIAR-107-%'")
    .get() as { c: number }
).c;
const zUwaga = (
  sqlite
    .prepare(
      "SELECT COUNT(*) AS c FROM products WHERE kod LIKE 'POMIAR-107-%' AND uwaga_cena IS NOT NULL",
    )
    .get() as { c: number }
).c;

console.log("=== POMIAR #107 — zatwierdzanie zbiorcze ===");
console.log(`wariant akceptacji   : ${WARIANT}`);
console.log(`baza źródłowa        : ${ZRODLO}`);
console.log(`produktów w katalogu : ${ileProduktow}`);
console.log(`migracje na kopii    : ${pokazMs(tMigracje)}`);
console.log(`pozycji zatwierdzono : ${ile} (w katalogu: ${zapisane}, z uwagą o cenie: ${zUwaga})`);
console.log(`czas łączny          : ${pokazMs(calosc)}`);
console.log(`średnia na pozycję   : ${pokazMs(suma / ile)}`);
console.log(`mediana              : ${pokazMs(czasy[Math.floor(ile / 2)]!)}`);
console.log(`p95                  : ${pokazMs(czasy[Math.floor(ile * 0.95)]!)}`);
console.log(`najwolniejsza        : ${pokazMs(czasy[ile - 1]!)}`);
console.log(`próg z backlogu #107 : 5000 ms na pozycję`);
console.log(
  `WERDYKT              : ${czasy[ile - 1]! < 5000 ? "problem produkcji NIE występuje" : "PROBLEM WYSTĘPUJE"}`,
);

sqlite.close();
rmSync(katalog, { recursive: true, force: true });
