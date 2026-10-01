// Rozstrzygnięcie pozycji z BŁĘDNYM EAN-em od dostawcy — „Rozstrzygnij" dla zgłoszeń typu „Błąd”.
//
// ⚠ NOWE ZACHOWANIE, NIE PORT (decyzja użytkowniczki, 2026-10-01). Błędny EAN (znaki spoza cyfr,
// np. `4251438404205_D`, zła cyfra kontrolna) blokuje akceptację („popraw numer w edycji
// zgłoszenia") i do tej pory dało się to zrobić tylko ręczną edycją w szczegółach. Dwie decyzje:
//  • `keep` — karta w katalogu ma poprawny EAN (także wygenerowany 999…): zostaje on, a numer od
//    dostawcy jest ignorowany;
//  • `set`  — użytkowniczka wpisuje poprawny EAN.
//
// Decyzja od razu ZATWIERDZA pozycję do katalogu (jedna transakcja, jak `rozstrzygniecie-z-zapisem.ts`)
// i zapisuje się jako poprawka `ean` z `acknowledgedSourceValue` = błędny numer z pliku — dzięki temu
// następny import, który znów przyniesie TEN SAM błędny numer, nie robi z niego zgłoszenia
// (`zastapBlednyEan` w `tolerancja-dopasowania.ts`). Gdy dostawca zmieni numer, pytanie wraca.

import type { Baza } from "../../db/index.js";
import { zapiszPoprawke } from "../../repos/overrides.js";
import { zaktualizujPozycjeStagingu } from "../../repos/staging.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { zatwierdzPozycjeZPolityka } from "./akceptacja.js";
import { odmow, validateEan } from "./helpery.js";
import { validateEanDostawcy } from "./ean-dostawcy.js";
import { pozycjaStagingu, produktPoKodzie, type Snapshot } from "./kontekst.js";

export type DecyzjaEan = "keep" | "set";

/** Zdania o błędnym EAN-ie w `powod`/`ostrzezenie` (`fabryka.ts:483`) — po rozstrzygnięciu nieaktualne. */
const bezBlednegoEan = (tekst: string | null): string | null => {
  if (!tekst) return tekst;
  const reszta = tekst
    .split(" • ")
    .filter((czesc) => !czesc.startsWith("Błędny EAN"))
    .join(" • ");
  return reszta || null;
};

export function rozstrzygnijBlednyEan(
  db: Baza,
  id: number,
  decyzja: unknown,
  ean: unknown,
  uzytkownikId: number,
): { kod: string; ean: string } {
  if (decyzja !== "keep" && decyzja !== "set") odmow("Nieprawidłowa decyzja.");

  const row = pozycjaStagingu(db, id);
  if (!row) odmow("Zgłoszenie już nie istnieje. Odśwież staging.");
  const snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
  const bladZPliku = validateEanDostawcy(snap.eanRaw ?? snap.ean, row.dostawca);
  if (!snap._eanIssue && !bladZPliku.error) {
    odmow("To zgłoszenie nie ma błędnego EAN-u.");
  }
  if (snap._matchIssue && !snap._resolution) {
    odmow("Najpierw rozstrzygnij dopasowanie opony przyciskiem „Rozstrzygnij”.");
  }

  const karta = produktPoKodzie(db, row.kod);
  let wybrany: string;
  if (decyzja === "keep") {
    const kartowy = validateEanDostawcy(karta?.ean, row.dostawca);
    if (!karta || !kartowy.valid || !kartowy.value) {
      odmow("Karta w katalogu nie ma poprawnego EAN-u — wpisz właściwy numer.");
    }
    wybrany = kartowy.value;
  } else {
    const wpisany = validateEan(ean);
    if (!wpisany.valid || !wpisany.value) {
      odmow(`Nieprawidłowy EAN: ${wpisany.error ?? "wpisz numer"}.`);
    }
    wybrany = wpisany.value;
  }

  return uchwytSqlite(db).transaction(() => {
    const blednyZPliku = String(snap.eanRaw ?? "").trim();
    snap.ean = wybrany;
    snap.eanRaw = wybrany;
    snap.eanIsValid = 1;
    snap.eanSourceStatus = "ok";
    snap._eanIssue = null;

    const ostrzezenie = bezBlednegoEan(row.ostrzezenie);
    zaktualizujPozycjeStagingu(db, id, {
      snapshotJson: JSON.stringify(snap),
      eanRaw: wybrany,
      eanIsValid: 1,
      eanSourceStatus: "ok",
      powod: bezBlednegoEan(row.powod) ?? (karta ? "Zmiana danych" : "Nowa pozycja w cenniku"),
      ostrzezenie,
      typZmiany:
        row.typZmiany === "blad" && !ostrzezenie
          ? karta
            ? "zmiana_kluczowa"
            : "nowa"
          : row.typZmiany,
    });

    // Poprawka `ean` z potwierdzonym błędnym numerem z pliku → kolejny import go nie zgłasza.
    zapiszPoprawke(db, {
      supplierKod: row.dostawca,
      supplierProductId: row.kod,
      fieldName: "ean",
      overrideValue: wybrany,
      reason: "rozstrzygnięcie błędnego EAN-u od dostawcy",
      createdBy: uzytkownikId,
      createdAt: new Date().toISOString(),
      acknowledgedSourceValue: blednyZPliku || null,
    });

    zatwierdzPozycjeZPolityka(db, id, uzytkownikId);
    return { kod: row.kod, ean: wybrany };
  })();
}
