// Wycięcie ŻYWEGO silnika importu wprost z produkcyjnego bundla `mirror/backend/index.cjs`.
//
// PO CO: sesja 3c portuje `tk()` do TypeScriptu (plan.md D1), a jedynym wiarygodnym wzorcem
// wierności jest zachowanie ORYGINAŁU. W 3a dało się uruchomić oryginalne parsery, bo
// `mirror/backend/parsers/*.cjs` to czytelne, samodzielne moduły. Tutaj cały graf wywołań
// żyje WEWNĄTRZ jednego bundla esbuild (1,48 MB), więc trzeba go stamtąd wyciąć.
//
// DLACZEGO NIE `require("mirror/backend/index.cjs")`: plik kończy się natychmiast wykonywanym
// IIFE, które otwiera bazę przez better-sqlite3 i woła `listen({ port: process.env.PORT || 5000 })`.
// `require()` postawiłby prawdziwy serwer i dotknął prawdziwej bazy.
//
// CO WYCINAMY — dwa ciągłe fragmenty, po kotwicach tekstowych, nie po numerach linii
// (numery linii są kruche przy re-deminifikacji, treść kodu nie jest):
//
//   1. HELPERY  — od `function mm` (suma kontrolna EAN-13) do początku MARTWEJ `function tk`.
//      Zawiera komplet grafu: mm, zq, Lq(licznik cyfr), ZT, qq/Mq/Fq/$q, Zc, hm, bn, YT,
//      JT, ek, Kq, Uq, Vq, Xq, Lq(sha1), Gq, Hq.
//   2. SILNIK   — ŻYWE `tk = function` (nadpisuje wcześniejszą `function tk`) do najbliższego
//      `var ih=` za nim.
//
// ⚠ DWIE DEFINICJE `Lq` I DWIE `tk` SĄ REALNE W WYSŁANYM BUNDLU — to nie artefakt naszej
// deminifikacji. esbuild nigdy nie wyemitowałby dwóch deklaracji tej samej nazwy w jednym
// zakresie (zmienia nazwę przy kolizji); biorą się z łatek `patch_*.cjs` doklejanych do
// `index.cjs` PO buildzie (w `mirror/backend/` jest ich kilkanaście). Skutek: obie deklaracje
// siedzą w TYM SAMYM zakresie i wygrywa PÓŹNIEJSZA. Dlatego wycinamy helpery RAZEM
// (żeby zachować oba `Lq` i ich kolejność) i pomijamy martwą `function tk` w całości.
//
// Wycinki są pilnowane skrótem sha256 (`integralnosc.json`). Zmiana w mirrorze zapala test
// z jawną instrukcją przenagrania wzorca — bo wtedy zmieniła się produkcja, a nie nasz kod.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// .../test/charakteryzacja/silnik/oryginal.mjs → .../rebuild/backend
const backendDir = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

/** Produkcyjny bundle — źródło prawdy dla całej charakteryzacji 3c. */
export const SCIEZKA_BUNDLA = join(backendDir, "..", "..", "mirror", "backend", "index.cjs");

/**
 * Kotwice tekstowe wycięcia. Każda MUSI wystąpić w bundlu dokładnie raz — inaczej wycięcie
 * jest niejednoznaczne i lepiej, żeby test padł, niż żeby wzorzec po cichu się przesunął.
 */
const KOTWICE = {
  /** Początek helperów: suma kontrolna EAN-13 (`deminified/backend-index.cjs:46940`). */
  poczatekHelperow: "function mm(t){if(!/^\\d{13}$/.test(t))return!1;",
  /** MARTWA `function tk` (`:47378`) — koniec helperów i początek kodu, który pomijamy. */
  martwyTk: "function tk(t,e){let n=new Date().toISOString(),i={doStagingu",
  /** ŻYWE przypisanie `tk = function` (`:47584`) — to jest silnik, który odtwarzamy. */
  zywyTk: "tk=function(t,e){let n=new Date().toISOString(),i={doStagingu",
  /** Pierwsze `var ih=` ZA żywym `tk` — koniec funkcji (`:47852`). */
  koniecSilnika: "var ih=",
};

function pozycjaJedyna(zrodlo, kotwica, nazwa) {
  const pierwsza = zrodlo.indexOf(kotwica);
  if (pierwsza === -1) {
    throw new Error(
      `Kotwica "${nazwa}" nie występuje w ${SCIEZKA_BUNDLA}. ` +
        `Bundle produkcyjny się zmienił — wycięcie oryginału wymaga aktualizacji kotwic.`,
    );
  }
  const druga = zrodlo.indexOf(kotwica, pierwsza + 1);
  if (druga !== -1) {
    throw new Error(
      `Kotwica "${nazwa}" występuje w bundlu więcej niż raz (${pierwsza}, ${druga}). ` +
        `Wycięcie byłoby niejednoznaczne.`,
    );
  }
  return pierwsza;
}

/** Wycina oba fragmenty z bundla i liczy ich skróty. Bez ładowania czegokolwiek. */
export function wytnijFragmenty() {
  const zrodlo = readFileSync(SCIEZKA_BUNDLA, "utf-8");

  const poczatekHelperow = pozycjaJedyna(zrodlo, KOTWICE.poczatekHelperow, "poczatekHelperow");
  const martwyTk = pozycjaJedyna(zrodlo, KOTWICE.martwyTk, "martwyTk");
  const zywyTk = pozycjaJedyna(zrodlo, KOTWICE.zywyTk, "zywyTk");
  const koniecSilnika = zrodlo.indexOf(KOTWICE.koniecSilnika, zywyTk);

  if (!(poczatekHelperow < martwyTk && martwyTk < zywyTk && zywyTk < koniecSilnika)) {
    throw new Error(
      "Kotwice wystąpiły w nieoczekiwanej kolejności — układ bundla się zmienił. " +
        `Pozycje: helpery=${poczatekHelperow}, martwyTk=${martwyTk}, ` +
        `zywyTk=${zywyTk}, koniec=${koniecSilnika}.`,
    );
  }

  const helpery = zrodlo.slice(poczatekHelperow, martwyTk);
  const silnik = zrodlo.slice(zywyTk, koniecSilnika);
  const skrot = (tekst) => createHash("sha256").update(tekst, "utf-8").digest("hex");

  return {
    helpery,
    silnik,
    integralnosc: {
      helpery: { sha256: skrot(helpery), dlugosc: helpery.length },
      silnik: { sha256: skrot(silnik), dlugosc: silnik.length },
    },
  };
}

/**
 * Nazwy, które oryginał bierze z otoczenia bundla. `tk()` woła je jako wolne zmienne, więc
 * wystarczy zadeklarować je w zakresie modułu i podstawić atrapy.
 *
 *   U             — warstwa danych (listProducts/addStaging/updateProduct/deleteProduct/getOverridesFor)
 *   ww            — uchwyt better-sqlite3 (tylko `transaction` i `prepare` dla `historia_cen`)
 *   __BRIDGE_EXT  — applyDims/applyLinkMemory; w `tk()` WYŁĄCZNIE w gałęzi auto-zatwierdzania (3d)
 *   Qi            — pamięć linków dla applyLinkMemory (3d)
 */
const WSTRZYKIWANE = ["U", "ww", "__BRIDGE_EXT", "Qi"];

const EKSPORTOWANE_HELPERY = [
  "mm",
  "zq",
  "ZT",
  "Zc",
  "bn",
  "YT",
  "JT",
  "ek",
  "Kq",
  "Vq",
  "Xq",
  "Lq",
  "Gq",
  "Hq",
];

/**
 * Ładuje wycięty oryginał jako moduł i zwraca go z podstawionymi zależnościami.
 *
 * Kod jedzie przez `new Function`, a nie przez plik tymczasowy — nie zostawia śmieci na dysku
 * i nie wymaga uprawnień do zapisu. `require` przekazujemy, bo żywe `Lq()` robi lokalne
 * `require("node:crypto")` w swoim ciele.
 */
export function zaladujOryginal(zaleznosci) {
  const { helpery, silnik, integralnosc } = wytnijFragmenty();

  const zrodlo = [
    '"use strict";',
    helpery,
    // `tk=function` przypisuje do wolnej zmiennej — w bundlu deklaruje ją martwa `function tk`,
    // której tu nie ma. Deklarujemy sami, razem z resztą wstrzykiwanych nazw.
    `var tk; var ${WSTRZYKIWANE.join(", ")};`,
    silnik,
    `module.exports = {`,
    `  ustawZaleznosci(z) { ${WSTRZYKIWANE.map((n) => `${n} = z.${n};`).join(" ")} },`,
    `  tk: (dostawca, rekordy) => tk(dostawca, rekordy),`,
    `  ${EKSPORTOWANE_HELPERY.join(", ")}`,
    `};`,
  ].join("\n");

  const modul = { exports: {} };
  const wymagaj = createRequire(import.meta.url);
  // Celowo `new Function`: ładujemy wycinek produkcyjnego bundla bez pliku tymczasowego.
  new Function("require", "module", "exports", zrodlo)(wymagaj, modul, modul.exports);

  modul.exports.ustawZaleznosci(zaleznosci);
  return { ...modul.exports, integralnosc };
}
