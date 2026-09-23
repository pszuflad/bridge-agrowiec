// `checkAcceptance` — `staging_policy.cjs:188-200`. Bramka, przez którą musi przejść każda
// pozycja, zanim wejdzie do katalogu.
//
// ⭐ SZEŚĆ BLOKAD, NIE CZTERY. Karta I15.4c wymienia cztery; oryginał ma sześć wywołań
// `fail()`. Decyzją użytkownika (plan.md D129.2) odtwarzamy wszystkie sześć, bo dwie
// „brakujące" są nośne: `_absenceReview` kieruje sprawę starej karty na ścieżkę
// `chooseAbsenceCard`/`closeAbsenceReview` zamiast zwykłej akceptacji, a `_catalogVersion`
// chroni przed nadpisaniem produktu zmienionego po utworzeniu zgłoszenia.
//
// KOLEJNOŚĆ SPRAWDZEŃ JEST CZĘŚCIĄ KONTRAKTU — pierwszy `fail()` wygrywa, więc pozycja
// z kilkoma wadami naraz zawsze zgłasza tę samą, pierwszą przyczynę.

import type { Baza } from "../../db/index.js";
import type { PozycjaStagingu } from "../../repos/staging.js";
import type { ProduktWewnetrzny } from "../../repos/products.js";
import { odmow, validateEan, version } from "./helpery.js";
import { produktPoKodzie, pozycjaStagingu, type Snapshot } from "./kontekst.js";

export type KontekstAkceptacji = {
  row: PozycjaStagingu;
  snap: Snapshot;
  current: ProduktWewnetrzny | undefined;
};

/**
 * Sprawdza, czy pozycję wolno zatwierdzić. Rzuca `BladPolityki` (409) z komunikatem
 * skopiowanym z oryginału znak w znak.
 *
 * ⚠ `JSON.parse` CELOWO BEZ `try` — oryginał (`:191`) też go nie ma. Uszkodzony snapshot
 * ma wywrócić akceptację, a nie po cichu przejść jako pusty obiekt. To różnica wobec
 * `zatwierdzPozycjeStagingu`, które parsuje defensywnie — tam snapshot jest już
 * przepuszczony przez tę bramkę.
 */
export function sprawdzAkceptacje(db: Baza, id: number): KontekstAkceptacji {
  const row = pozycjaStagingu(db, id);
  if (!row) odmow("Zgłoszenie zostało już zastąpione lub usunięte. Odśwież staging.");

  const snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
  const current = produktPoKodzie(db, row.kod);

  // 1. Sprawa starej karty ma własną ścieżkę decyzji — nie wolno jej rozstrzygnąć akceptacją.
  if (snap._absenceReview) {
    odmow(
      "Ta stara karta wymaga porównania z bieżącą ofertą. Nie można automatycznie zmienić jej w inną oponę ani wstrzymać.",
    );
  }

  // 2. Wycofanie wymaga trzech potwierdzeń nieobecności (#103) — inaczej to fałszywe wycofanie.
  if (
    row.typZmiany === "wycofana" &&
    (!Array.isArray(snap._absenceEvidence) || snap._absenceEvidence.length < 3)
  ) {
    odmow("Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik.");
  }

  // 3. Zgłoszenie sprzed Staging v2 nie przeszło przez nową politykę — nie ma czego ufać.
  if (!snap._policyVersion) {
    odmow("To zgłoszenie pochodzi ze starego importu. Odśwież cennik przed akceptacją.");
  }

  // 4. Niejednoznaczne dopasowanie czeka na decyzję człowieka (`POST /resolve`).
  if (snap._matchIssue && !snap._resolution) {
    odmow("Najpierw rozstrzygnij dopasowanie opony przyciskiem „Rozstrzygnij”.");
  }

  // 5. Błędny EAN blokuje akceptację (decyzja D4 — zastępuje odstępstwo 14i, które
  //    zerowało EAN po cichu). Wycofania są wyjęte: tam EAN nie jedzie do katalogu.
  const ev = validateEan(snap.eanRaw ?? snap.ean);
  if (row.typZmiany !== "wycofana" && (snap._eanIssue || ev.error)) {
    odmow("Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją.");
  }

  // 6. Produkt zmienił się od chwili utworzenia zgłoszenia — zapis nadpisałby świeższe dane.
  if (snap._catalogVersion !== version(current)) {
    odmow(
      "Produkt zmienił się po utworzeniu zgłoszenia. Wczytaj aktualny cennik; stare dane nie zostały zapisane.",
    );
  }

  return { row, snap, current };
}
