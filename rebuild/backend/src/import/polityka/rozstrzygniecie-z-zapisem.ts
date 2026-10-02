// Rozstrzygnięcie niejednoznacznego dopasowania, które OD RAZU trafia do katalogu, z możliwością
// wpisania własnych (poprawionych) parametrów opony.
//
// ⚠ ODSTĘPSTWO OD PRODUKCJI — ŚWIADOMA DECYZJA UŻYTKOWNICZKI (2026-09-30). W oryginale
// `POST /resolve` (`rozstrzygnijZgloszenie`) tylko zastępuje zgłoszenie NOWYM, które trzeba
// jeszcze raz zaakceptować w stagingu — czyli każdą taką oponę akceptuje się dwa razy. Tu
// decyzja w jednej transakcji: rozstrzygnięcie → (opcjonalne) poprawki → akceptacja. Gdy
// akceptacja odmówi (np. błędny EAN), nie zostaje po niej ani nowe zgłoszenie, ani pół produktu —
// tak samo jak w `sprzecznosc-zrodla.ts`.
//
// Poprawki to ta sama ścieżka, co `PUT /api/staging/:id`: pole trafia do snapshotu, do listy
// `edytowanePola` i do `manual_overrides`, dzięki czemu kolejny import nie cofnie ręcznej
// nazwy do zapisu z pliku dostawcy.
//
// `rozstrzygnijZgloszenie` zostaje BEZ ZMIAN — jest przedmiotem charakteryzacji oryginału.

import type { Baza } from "../../db/index.js";
import { zapiszPoprawke } from "../../repos/overrides.js";
import { zaktualizujPozycjeStagingu } from "../../repos/staging.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { zatwierdzPozycjeZPolityka } from "./akceptacja.js";
import { odmow } from "./helpery.js";
import { pozycjaStagingu, produktPoKodzie, type Snapshot } from "./kontekst.js";
import { rozstrzygnijZgloszenie, zaktualizujZgloszenie } from "./zgloszenia.js";

/** Pola, które wolno poprawić przy rozstrzyganiu (klucze snapshotu). */
export const POLA_POPRAWEK = ["nazwa", "marka", "model", "rozmiar", "dot", "ean"] as const;
export type PolePoprawki = (typeof POLA_POPRAWEK)[number];
export type Poprawki = Partial<Record<PolePoprawki, string>>;

/** Pola z odpowiednikiem w `manual_overrides` (jak `POLE_NA_OVERRIDE` w `staging-mutacje.ts`). */
const POLA_Z_POPRAWKA_TRWALA: ReadonlySet<string> = new Set([
  "nazwa",
  "marka",
  "model",
  "rozmiar",
  "ean",
]);

/** Ciało żądania → tylko znane pola, tylko niepuste napisy (pustego pola nie da się „poprawić"). */
export function odczytajPoprawki(surowe: unknown): Poprawki {
  if (surowe == null) return {};
  if (typeof surowe !== "object" || Array.isArray(surowe)) odmow("Nieprawidłowe poprawki.");
  const wynik: Poprawki = {};
  for (const pole of POLA_POPRAWEK) {
    const v = (surowe as Record<string, unknown>)[pole];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") odmow("Nieprawidłowe poprawki.");
    const czysta = v.trim().replace(/\s+/g, " ");
    if (czysta) wynik[pole] = czysta;
  }
  return wynik;
}

export function rozstrzygnijIZatwierdz(
  db: Baza,
  id: number,
  action: unknown,
  targetCode: unknown,
  poprawki: Poprawki,
  uzytkownikId: number,
): { kod: string } {
  return uchwytSqlite(db).transaction(() => {
    const nowe = rozstrzygnijZgloszenie(db, id, action, targetCode);
    const pola = Object.keys(poprawki) as PolePoprawki[];

    if (pola.length) {
      const snap = JSON.parse(nowe.snapshotJson || "{}") as Snapshot;
      const doZapisu: Record<string, unknown> = {};
      const teraz = new Date().toISOString();

      for (const pole of pola) {
        const wartosc = poprawki[pole]!;
        snap[pole] = wartosc;
        if (pole === "nazwa") doZapisu.nazwa = wartosc;
        if (POLA_Z_POPRAWKA_TRWALA.has(pole)) {
          zapiszPoprawke(db, {
            supplierKod: nowe.dostawca,
            supplierProductId: nowe.kod,
            fieldName: pole,
            overrideValue: wartosc,
            reason: "poprawka przy rozstrzyganiu dopasowania",
            createdBy: uzytkownikId,
            createdAt: teraz,
          });
        }
      }
      doZapisu.snapshotJson = JSON.stringify(snap);
      doZapisu.edytowanePola = JSON.stringify(pola);
      zaktualizujZgloszenie(db, nowe.id, doZapisu);

      // Poprawiony EAN zdejmuje status „błąd" nadany przy rozstrzyganiu (`typZmiany: "blad"`).
      const po = pozycjaStagingu(db, nowe.id)!;
      const snapPo = JSON.parse(po.snapshotJson || "{}") as Snapshot;
      if (po.typZmiany === "blad" && !snapPo._eanIssue) {
        zaktualizujPozycjeStagingu(db, nowe.id, {
          typZmiany: produktPoKodzie(db, nowe.kod) ? "zmiana_kluczowa" : "nowa",
          powod: (po.powod ?? "").replace(/ • Błędny EAN:.*$/, ""),
        });
      }
    }

    zatwierdzPozycjeZPolityka(db, nowe.id, uzytkownikId, true);
    return { kod: nowe.kod };
  })();
}
