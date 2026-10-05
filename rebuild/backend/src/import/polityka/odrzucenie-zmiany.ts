// „Odrzuć” w szczegółach pozycji stagingu: ZOSTAW KARTĘ BEZ ZMIAN i zapamiętaj to jak poprawkę Marty.
//
// ⚠ NOWE ZACHOWANIE, NIE PORT (decyzja użytkowniczki, 2026-10-05). Gdy plik dostawcy proponuje zmianę
// nazwy/modelu/marki/rozmiaru istniejącej karty, a proponowana wartość jest gorsza, do tej pory były
// dwie drogi: ręcznie wpisać starą wartość w pola edycji albo „Odrzuć” z listy, które nic nie
// zapamiętywało (ta sama propozycja wracała przy następnym imporcie).
//
// Tu decyzja: karta zostaje DOKŁADNIE taka, jaka jest (żadnej zmiany w katalogu), a dla każdego pola
// tożsamości, które się różni, powstaje poprawka Marty (`manual_overrides`) z OBECNĄ wartością karty
// i `acknowledgedSourceValue` = wartość z pliku. Skutek jest ten sam, co przy ręcznej edycji:
//  • kolejny import podstawia wartość karty i nie zgłasza różnicy,
//  • ⚠ TAK SAMO JAK KAŻDA POPRAWKA MARTY: Staging v2 nakłada poprawki CICHO (`fabryka.ts`, `nalozPoprawki`) —
//    także gdy dostawca zmieni wartość jeszcze raz, karta zostaje przy wartości z poprawki i nic nie
//    alarmuje (alarm „plik chciał nadpisać poprawkę” istniał tylko w starym `tk()`),
//  • poprawka jest widoczna na karcie produktu i można ją usunąć (`DELETE /api/overrides/{id}`),
//    wtedy plik znów decyduje.
// Zgłoszenie znika. Cena i stan z tej pozycji NIE są stosowane teraz — zrobi to zwykła cicha
// aktualizacja przy następnym imporcie, bo różnica na polach tożsamości już nie istnieje.

import type { Baza } from "../../db/index.js";
import { zapiszPoprawke } from "../../repos/overrides.js";
import { odrzucPozycjeStagingu } from "../akceptacja.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { KEYS, norm, odmow } from "./helpery.js";
import { pozycjaStagingu, produktPoKodzie, type Snapshot } from "./kontekst.js";

export type WynikOdrzuceniaZmiany = {
  kod: string;
  /** Pola, dla których powstała poprawka z wartością karty. */
  zachowanePola: string[];
  /** Pola, które się różnią, ale karta ma je puste — nie da się ich zachować poprawką. */
  pominietePola: string[];
};

export function odrzucZmianeKarty(db: Baza, id: number, uzytkownikId: number): WynikOdrzuceniaZmiany {
  const row = pozycjaStagingu(db, id);
  if (!row) odmow("Zgłoszenie już nie istnieje. Odśwież staging.");
  if (row.typZmiany !== "zmiana_kluczowa") {
    odmow(
      "„Odrzuć” zostawia kartę bez zmian, więc działa tylko dla zmiany istniejącego produktu. " +
        "Pozycję innego typu odrzucisz na liście.",
    );
  }
  const karta = produktPoKodzie(db, row.kod);
  if (!karta) odmow("W katalogu nie ma karty tej pozycji — nie ma czego zachować.");

  let snap: Snapshot = {};
  try {
    snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
  } catch {
    odmow("Zgłoszenie ma uszkodzone dane z pliku — nie można ustalić, co się zmieniło.");
  }

  const doZachowania: { pole: string; wartoscKarty: string; wartoscZPliku: string }[] = [];
  const pominiete: string[] = [];
  const kartaJakRekord = karta as unknown as Record<string, unknown>;
  for (const pole of KEYS) {
    const zPliku = snap[pole];
    const zKarty = kartaJakRekord[pole];
    if (norm(zPliku) === norm(zKarty)) continue;
    if (zKarty == null || String(zKarty).trim() === "") {
      pominiete.push(pole);
      continue;
    }
    doZachowania.push({
      pole,
      wartoscKarty: String(zKarty),
      wartoscZPliku: zPliku == null ? "" : String(zPliku),
    });
  }

  if (!doZachowania.length) {
    odmow(
      pominiete.length
        ? "Karta ma puste pola, w których plik się różni — nie da się ich zachować poprawką."
        : "Pozycja nie różni się już od karty — nic do odrzucenia.",
    );
  }

  const teraz = new Date().toISOString();
  uchwytSqlite(db).transaction(() => {
    for (const { pole, wartoscKarty, wartoscZPliku } of doZachowania) {
      zapiszPoprawke(db, {
        supplierKod: row.dostawca,
        supplierProductId: row.kod,
        fieldName: pole,
        overrideValue: wartoscKarty,
        reason: `Odrzucona zmiana z pliku dostawcy (staging): plik podał „${wartoscZPliku}”`,
        createdBy: uzytkownikId,
        createdAt: teraz,
        // Wartość z pliku zapamiętana jako „widziana” — ten sam wpis nie wraca; inny wywoła alarm.
        acknowledgedSourceValue: wartoscZPliku || null,
      });
    }
    odrzucPozycjeStagingu(db, id);
  })();

  return { kod: row.kod, zachowanePola: doZachowania.map((d) => d.pole), pominietePola: pominiete };
}
