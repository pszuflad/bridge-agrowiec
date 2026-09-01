// Wycięcie ORYGINALNEGO `acceptStaging` (i sąsiadów) wprost z produkcyjnego bundla
// `mirror/backend/index.cjs` — oracle dla sesji 3d-2.
//
// PO CO: 3c i 3d-1 dowodziły wierności portu, URUCHAMIAJĄC oryginał i porównując zachowanie.
// To dowód nieporównanie mocniejszy niż „przeczytałem i przepisałem", więc 3d-2 idzie tą samą
// drogą. Wymagało to jednak innego cięcia niż `tk()`.
//
// CZYM TO SIĘ RÓŻNI OD HARNESSU SILNIKA (`../silnik/oryginal.mjs`):
//   • `tk` to samodzielne przypisanie `tk=function(…)`, więc dało się je wyciąć w całości
//     i nakarmić PAMIĘCIOWYMI atrapami warstwy danych.
//   • `acceptStaging` jest METODĄ w środku wielkiego obiektu `U = {…}` i rozmawia wprost
//     z Drizzle (`X.select().from(he)…`). Atrapy nic by tu nie dały — trzeba podstawić
//     PRAWDZIWEGO Drizzle na PRAWDZIWEJ bazie z naszego kanonu.
// To okazało się zaletą: oryginał i nasz port operują wtedy na bazach o identycznym schemacie,
// więc porównujemy KOŃCOWY STAN BAZY, a nie ślady wywołań.
//
// CO WYCINAMY — dwa ciągłe fragmenty, po kotwicach tekstowych (numery linii są kruche):
//   1. POMOCNICY NARZUTÓW — `function __bridgeCondMatch` → `function recalcPricesFromRules`.
//      Daje `__bridgeCondMatch`, `__bridgeMarkupMatches`, `__bridgePromoMatches`,
//      `__bridgePickMarkup`, `__bridgePickPromo`.
//      ⭐ Bierzemy je NAPRAWDĘ, a nie jako zaślepki — dzięki temu charakteryzacja DOWODZI
//      decyzji D3 (pominięcie narzutów/promocji w I3): oryginał wykonuje pełną gałąź cenową
//      na pustych tabelach `markups`/`promotions` i wychodzi z tym samym wynikiem, co nasz
//      port, który tej gałęzi nie ma. Gdyby ktoś wpisał regułę, obie strony by się rozjechały
//      — i o to chodzi.
//   2. METODY WARSTWY DANYCH — `listStaging(){` → `listAlerts(){`. Daje `listStaging`,
//      `listStagingPaged`, `getStaging`, `updateStaging`, `acceptStaging`, `rejectStaging`,
//      `clearStaging`, `addStaging`, `listOverrides`, `getOverridesFor`, `upsertOverride`,
//      `deleteOverride` — czyli komplet, którego dotyka 3d-2.
//
// Wycinki są pilnowane skrótem sha256 (`integralnosc.json`). Zmiana w mirrorze zapala test
// z instrukcją przenagrania — bo wtedy zmieniła się produkcja, a nie nasz kod.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { desc, eq, sql } from "drizzle-orm";

import { markups, manualOverrides, products, promotions, stagingItems } from "../../../src/db/schema.js";
import { bridgeExt } from "../../../src/import/silnik/bridge-ext.js";

// .../test/charakteryzacja/akceptacja/oryginal.mjs → .../rebuild/backend
const backendDir = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

/** Produkcyjny bundle — źródło prawdy dla całej charakteryzacji. */
export const SCIEZKA_BUNDLA = join(backendDir, "..", "..", "mirror", "backend", "index.cjs");

const KOTWICE = {
  poczatekPomocnikow: "function __bridgeCondMatch",
  koniecPomocnikow: "function recalcPricesFromRules",
  poczatekMetod: "listStaging(){",
  koniecMetod: "listAlerts(){",
};

function pozycjaJedyna(zrodlo, kotwica, nazwa) {
  const pierwsza = zrodlo.indexOf(kotwica);
  if (pierwsza === -1) {
    throw new Error(
      `Kotwica "${nazwa}" nie występuje w ${SCIEZKA_BUNDLA}. ` +
        "Bundle produkcyjny się zmienił — wycięcie wymaga aktualizacji kotwic.",
    );
  }
  const druga = zrodlo.indexOf(kotwica, pierwsza + 1);
  if (druga !== -1) {
    throw new Error(
      `Kotwica "${nazwa}" występuje w bundlu więcej niż raz (${pierwsza}, ${druga}). ` +
        "Wycięcie byłoby niejednoznaczne.",
    );
  }
  return pierwsza;
}

/** Wycina oba fragmenty z bundla i liczy ich skróty. Bez ładowania czegokolwiek. */
export function wytnijFragmenty() {
  const zrodlo = readFileSync(SCIEZKA_BUNDLA, "utf-8");

  const poczatekPomocnikow = pozycjaJedyna(zrodlo, KOTWICE.poczatekPomocnikow, "poczatekPomocnikow");
  const koniecPomocnikow = pozycjaJedyna(zrodlo, KOTWICE.koniecPomocnikow, "koniecPomocnikow");
  const poczatekMetod = pozycjaJedyna(zrodlo, KOTWICE.poczatekMetod, "poczatekMetod");
  const koniecMetod = pozycjaJedyna(zrodlo, KOTWICE.koniecMetod, "koniecMetod");

  if (!(poczatekPomocnikow < koniecPomocnikow && koniecPomocnikow < poczatekMetod && poczatekMetod < koniecMetod)) {
    throw new Error(
      "Kotwice wystąpiły w nieoczekiwanej kolejności — układ bundla się zmienił. " +
        `Pozycje: pomocnicy=${poczatekPomocnikow}..${koniecPomocnikow}, ` +
        `metody=${poczatekMetod}..${koniecMetod}.`,
    );
  }

  const pomocnicy = zrodlo.slice(poczatekPomocnikow, koniecPomocnikow);
  const metody = zrodlo.slice(poczatekMetod, koniecMetod);
  const skrot = (tekst) => createHash("sha256").update(tekst, "utf-8").digest("hex");

  return {
    pomocnicy,
    metody,
    integralnosc: {
      pomocnicy: { sha256: skrot(pomocnicy), dlugosc: pomocnicy.length },
      metody: { sha256: skrot(metody), dlugosc: metody.length },
    },
  };
}

/**
 * Nazwy, które wycięty kod bierze z otoczenia bundla.
 *
 *   X   — instancja Drizzle          he  — tabela products      He — tabela staging_items
 *   Yt  — tabela manual_overrides    Bt  — tabela markups       hn — tabela promotions
 *   se  — eq()                       A   — sql``               Ii — desc()
 *   Qi  — surowy uchwyt better-sqlite3 (dla bridge_ext)
 *   __BRIDGE_EXT — rozszerzenia importu (nasz port bajt-w-bajt)
 */
const WSTRZYKIWANE = ["X", "he", "He", "Yt", "Bt", "hn", "se", "A", "Ii", "Qi", "__BRIDGE_EXT"];

/**
 * Ładuje wycięty oryginał i podpina go do PODANEJ bazy.
 *
 * @param {{db: unknown, sqlite: unknown}} baza  nasza baza testowa (Drizzle + surowy uchwyt)
 * @param {Record<string, unknown>} [podmianaBridgeExt]  podmiana `__BRIDGE_EXT` (domyślnie nasz port)
 */
export function zaladujOryginal(baza, podmianaBridgeExt) {
  const { pomocnicy, metody, integralnosc } = wytnijFragmenty();

  const zrodlo = [
    '"use strict";',
    `var ${WSTRZYKIWANE.join(", ")};`,
    pomocnicy,
    // Metody wycięte z obiektu `U` — kończą się przecinkiem, więc domykamy klamrą.
    // `acceptStaging` woła `U.getOverridesFor`/`U.upsertOverride` po nazwie, nie przez `this`,
    // więc `U` MUSI być zwykłą zmienną w tym samym zakresie.
    `var U = { ${metody} };`,
    `module.exports = {`,
    `  ustawZaleznosci(z) { ${WSTRZYKIWANE.map((n) => `${n} = z.${n};`).join(" ")} },`,
    `  U,`,
    `};`,
  ].join("\n");

  const modul = { exports: {} };
  const wymagaj = createRequire(import.meta.url);
  // Celowo `new Function`: ładujemy wycinek produkcyjnego bundla bez pliku tymczasowego.
  new Function("require", "module", "exports", zrodlo)(wymagaj, modul, modul.exports);

  modul.exports.ustawZaleznosci({
    X: baza.db,
    he: products,
    He: stagingItems,
    Yt: manualOverrides,
    Bt: markups,
    hn: promotions,
    se: eq,
    A: sql,
    Ii: desc,
    Qi: baza.sqlite,
    __BRIDGE_EXT: podmianaBridgeExt ?? bridgeExt,
  });

  return { U: modul.exports.U, integralnosc };
}
