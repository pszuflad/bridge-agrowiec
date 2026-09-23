// Oracle dla karty I15.4c: PRAWDZIWY `staging_policy.cjs` @ 88fa31c, zainstalowany na
// prawdziwym `U` wyciętym z produkcyjnego bundla, na prawdziwej bazie z naszego kanonu.
//
// PO CO: dla czterech tras polityki i dla `checkAcceptance` NIE MA ani fixtures, ani wpisów
// w `contract/openapi.yaml` — klasyczny GATE („porównaj z nagraniem") nie istnieje. Decyzja
// użytkownika (plan.md D129.5): dowodem wierności jest URUCHOMIONY oryginał.
//
// DLACZEGO TO W OGÓLE MOŻLIWE — trzy własności modułu, sprawdzone przed napisaniem harnessu:
//   • `staging_policy.cjs` NIE jest zminifikowany (Ania utrzymuje go jako zwykły plik),
//   • nie ma efektów ubocznych przy `require()`,
//   • nie otwiera bazy sam — `install()` dostaje `db` argumentem.
// Dlatego wystarczy go `require()` i wpiąć w `U`, zamiast wycinać kotwicami z bundla.
//
// CZYM SIĘ RÓŻNI OD `../akceptacja/oryginal.mjs`: tamten daje `U` SPRZED polityki (stan
// produkcji z Iteracji 3). Tutaj bierzemy tamto `U` i wykonujemy na nim dokładnie to, co robi
// produkcja przy starcie: `install({U, db, …})`. Efekt to `U` takie, jakie ma produkcja
// @ 88fa31c — z nadpisanymi `addStaging`, `updateStaging`, `acceptStaging`, `updateProduct`
// oraz z `checkStagingAcceptance`, `resolveStaging`, `closeAbsenceReview`, `chooseAbsenceCard`.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { eq, sql } from "drizzle-orm";

import { products } from "../../../src/db/schema.js";
import { bridgeExt } from "../../../src/import/silnik/bridge-ext.js";
import { SCIEZKA_BUNDLA, zaladujOryginal } from "../akceptacja/oryginal.mjs";

// Harness akceptacji tnie `U` OD `updateProduct(t,e){`, więc nie ma w nim metod odczytu
// produktów. Polityka ich potrzebuje: `find()` woła `getProductByKod`, a nadpisany
// `assignKodImportu` — `listProducts`. Docinamy ten jeden brakujący kawałek.
const KOTWICA_POCZATEK = "var U={listProducts(){";
const KOTWICA_KONIEC = "updateProduct(t,e){";

function wytnijOdczytProduktow() {
  const zrodlo = readFileSync(SCIEZKA_BUNDLA, "utf-8");
  const poczatek = zrodlo.indexOf(KOTWICA_POCZATEK);
  const koniec = zrodlo.indexOf(KOTWICA_KONIEC, poczatek);
  if (poczatek === -1 || koniec === -1) {
    throw new Error(
      `Nie znaleziono kotwic odczytu produktów w ${SCIEZKA_BUNDLA}. ` +
        "Układ bundla się zmienił — przenagraj wycinek.",
    );
  }
  // Pomijamy samo `var U={`, bo metody wklejamy do istniejącego obiektu.
  const fragment = zrodlo.slice(poczatek + "var U={".length, koniec);
  return {
    fragment,
    integralnosc: {
      sha256: createHash("sha256").update(fragment, "utf-8").digest("hex"),
      dlugosc: fragment.length,
    },
  };
}

/** Zależność, której ścieżka odczytu/decyzji NIE MA PRAWA wołać — cała jest w `importer()`. */
function nieuzywane(nazwa) {
  return () => {
    throw new Error(
      `Ścieżka akceptacji zawołała \`${nazwa}\`, a w oryginale używa jej wyłącznie ` +
        "`importer()` (staging_policy.cjs:332-618, karta I15.4b). To rozjazd w porcie.",
    );
  };
}

/**
 * Ładuje oryginał z ZAINSTALOWANĄ polityką Staging v2.
 *
 * @param {{db: unknown, sqlite: unknown}} baza nasza baza testowa (Drizzle + surowy uchwyt)
 */
export function zaladujPolityke(baza) {
  // ⚠ KOPIA `bridgeExt`, NIE ORYGINAŁ. `install()` nadpisuje `ext.assignKodImportu`
  // (`staging_policy.cjs:141`). Gdyby dostał współdzielony obiekt modułu, podmiana
  // wyciekłaby na CAŁY proces testowy i zmieniła zachowanie innych plików testów.
  // Ta sama kopia idzie do wycinka bundla, więc oryginalne `acceptStaging` widzi
  // podmienioną wersję — dokładnie jak w produkcji.
  const ext = { ...bridgeExt };
  const { U, integralnosc: integralnoscAkceptacji } = zaladujOryginal(baza, ext);

  const { fragment, integralnosc: integralnoscOdczytu } = wytnijOdczytProduktow();
  const modul = { exports: {} };
  const zrodlo = [
    '"use strict";',
    "var X, he, se, A;",
    `var METODY = { ${fragment} };`,
    "module.exports = {",
    "  ustaw(z) { X = z.X; he = z.he; se = z.se; A = z.A; },",
    "  METODY,",
    "};",
  ].join("\n");
  new Function("require", "module", "exports", zrodlo)(
    createRequire(import.meta.url),
    modul,
    modul.exports,
  );
  modul.exports.ustaw({ X: baza.db, he: products, se: eq, A: sql });
  Object.assign(U, modul.exports.METODY);

  const wymagaj = createRequire(import.meta.url);
  const polityka = wymagaj("../../../src/import/legacy/staging_policy.cjs");

  polityka.install({
    U,
    db: baza.sqlite,
    normalize: nieuzywane("normalize"),
    classify: nieuzywane("classify"),
    badName: nieuzywane("badName"),
    ext,
  });

  return {
    U,
    polityka,
    ext,
    integralnosc: { ...integralnoscAkceptacji, odczytProduktow: integralnoscOdczytu },
  };
}
