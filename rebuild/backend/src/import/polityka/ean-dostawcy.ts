// Ticket 180 — oznaczenia EAN Handlopexu (MO4/MO5) traktowane jako prawidłowe (decyzja Anny 2026-10-01).
//
// ⚠ ODSTĘPSTWO OD `validateEan()` (staging_policy.cjs:9), które „nigdy nie obcina liter”. Handlopex
// dopisuje do EAN-u oznaczenie partii (`4024063003477DO`, `4251438404205_D`, `…W2`) i podaje własne
// numery z niezgodną cyfrą kontrolną (`9996118002103`). Dostawca tego nie zmieni, więc:
//   1. EAN-13 z poprawną sumą + doklejone 1–3 litery (opcjonalnie `_`/`-`/spacja i cyfra) → same 13 cyfr;
//      surowy zapis zostaje w `_supplierEanOriginal`.
//   2. Numer z samych cyfr o poprawnej długości, odrzucony WYŁĄCZNIE za cyfrę kontrolną → prawidłowy.
// Dotyczy tylko MO4/MO5. Pozostali dostawcy i pozostałe błędy (litery w środku, zła długość, zapis
// naukowy, same zera) — bez zmian. Legacy `adapter.cjs` zostaje nietknięty (charakteryzacja bajt w bajt).
import { validateEan, type WynikEan } from "./helpery.js";

const HANDLOPEX = new Set(["MO4", "MO5"]);
const BLAD_SUMY = "nieprawidłowa cyfra kontrolna";
const SUFIKS_PARTII = /^([0-9]{13})[\s_-]*([A-Z]{1,3}[0-9]?)$/i;

const bazowyDostawca = (dostawca: unknown): string =>
  String(dostawca ?? "").trim().toUpperCase().replace(/_.*$/, "");

export const czyHandlopex = (dostawca: unknown): boolean => HANDLOPEX.has(bazowyDostawca(dostawca));

/** `validateEan` z wyjątkiem Handlopexu dla cyfry kontrolnej (pkt 2). */
export function validateEanDostawcy(value: unknown, dostawca: unknown, lossy = false): WynikEan {
  const ev = validateEan(value, lossy);
  if (ev.error === BLAD_SUMY && czyHandlopex(dostawca)) {
    const cyfry = ev.raw.replace(/\s/g, "");
    return { raw: ev.raw, value: cyfry, valid: true, error: null, status: "ok" };
  }
  return ev;
}

/** Surowy EAN Handlopexu bez oznaczenia partii (pkt 1); inni dostawcy i inne zapisy — bez zmian. */
export function kanonicznyEanDostawcy(raw: unknown, dostawca: unknown): unknown {
  if (!czyHandlopex(dostawca) || raw == null) return raw;
  const m = SUFIKS_PARTII.exec(String(raw).trim());
  if (!m) return raw;
  return validateEanDostawcy(m[1], dostawca).valid ? m[1] : raw;
}
