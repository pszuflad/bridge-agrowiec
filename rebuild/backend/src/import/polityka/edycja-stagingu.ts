// `U.updateStaging` nadpisane przez Staging v2 — `staging_policy.cjs:168-187`.
//
// Oryginał opakowuje zapis edycji zgłoszenia i robi dwie rzeczy, zanim wiersz trafi do bazy:
//
//  1. **bieżnik idzie za modelem, jeśli był jego automatyczną kopią** (#105) — formularz
//     edytuje model, ale nie pokazuje pola bieżnika, więc bez tego karta zostawałaby
//     z bieżnikiem starego modelu;
//  2. **EAN jest ponownie walidowany ściśle**, gdy się zmienił albo gdy operator jawnie
//     wymienił go wśród edytowanych pól — to jest wejście decyzji D4 (błędny EAN ma być
//     błędem blokującym akceptację, a nie po cichu degradować się do „EAN pusty").
//
// Samo BLOKOWANIE akceptacji na podstawie tych pól należy do `checkAcceptance()`, czyli do
// karty I15.4c. Tutaj wyłącznie przygotowanie danych.

import {
  zaktualizujPozycjeStagingu,
  type PozycjaStaginguSzczegol,
} from "../../repos/staging.js";
import type { Baza } from "../../db/index.js";
import { validateEan } from "./podstawy.js";

type Snapshot = Record<string, unknown>;

/**
 * Nakłada regułę Staging v2 na patch edycji i zapisuje zgłoszenie.
 *
 * @param stary snapshot zgłoszenia SPRZED edycji (`row.snapshotJson`) — potrzebny, żeby
 *   rozpoznać, czy bieżnik był automatyczną kopią modelu.
 */
export function zapiszEdycjeStagingu(
  db: Baza,
  id: number,
  patch: Record<string, unknown>,
  starySnapshotJson: string | null,
): PozycjaStaginguSzczegol | undefined {
  if (!patch.snapshotJson) return zaktualizujPozycjeStagingu(db, id, patch);

  const snap = JSON.parse(String(patch.snapshotJson)) as Snapshot;
  const stary = JSON.parse(starySnapshotJson || "{}") as Snapshot;
  let doZapisu = { ...patch };

  // ——— 1. Bieżnik jako automatyczna kopia modelu (`:175-177`) ———
  // ⚠ Warunek jest potrójny i każdy człon ma znaczenie: model musi się ZMIENIĆ, stary bieżnik
  // musi być KOPIĄ starego modelu, a nowy bieżnik musi być nadal tą starą wartością (czyli
  // operator go nie ruszył). Osobno prowadzonego bieżnika nie nadpisujemy.
  if (
    snap.model !== stary.model &&
    stary.bieznik === stary.model &&
    snap.bieznik === stary.bieznik
  ) {
    snap.bieznik = snap.model;
  }

  // ——— 2. Ścisła walidacja EAN-u po edycji (`:178-183`, D4) ———
  const edytowanoEan = patch.edytowanePola
    ? (JSON.parse(String(patch.edytowanePola)) as string[]).includes("ean")
    : false;
  if (snap.ean !== stary.ean || edytowanoEan) {
    const v = validateEan(snap.ean);
    snap.eanRaw = v.raw;
    snap.eanIsValid = v.valid === null ? null : Number(v.valid);
    snap.eanSourceStatus = v.status;
    snap._eanIssue = v.error;
    doZapisu = {
      ...doZapisu,
      eanRaw: v.raw,
      eanIsValid: snap.eanIsValid,
      eanSourceStatus: v.status,
    };
  }

  doZapisu = { ...doZapisu, snapshotJson: JSON.stringify(snap) };
  return zaktualizujPozycjeStagingu(db, id, doZapisu);
}
