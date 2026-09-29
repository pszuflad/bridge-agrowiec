// Rozstrzygnięcie „sprzecznych pozycji w jednym cenniku" — dwa wiersze pliku dostawcy
// wskazują jedną kartę, ale różnią się danymi (`_duplicateSource`, `fabryka.ts:518-560`).
//
// ⚠ ODSTĘPSTWO OD PRODUKCJI — ŚWIADOMA DECYZJA UŻYTKOWNIKA (2026-09-29). Oryginał nie ma tu
// żadnej akcji: `resolveStaging` odmawia („Dostawca przesłał sprzeczne wiersze…", `:231`),
// a okno pokazuje sam podgląd. Użytkowniczka, która sama sprawdza takie opony, chce dwóch
// przycisków — „Połącz w jeden produkt" i „Rozdziel na dwa osobne produkty" — a po wyborze
// produkt (produkty) ma od razu trafić do katalogu, bez osobnej akceptacji w stagingu.
//
// Dlatego decyzja TU od razu wykonuje akceptację (`zatwierdzPozycjeZPolityka`), w JEDNEJ
// transakcji z rozstrzygnięciem: gdy akceptacja odmówi (np. błędny EAN), nie zostaje po niej
// ani rozstrzygnięte zgłoszenie, ani pół produktu.
//
// Snapshot zgłoszenia niesie dane WYŁĄCZNIE późniejszego wiersza; wcześniejszy istnieje tylko
// w `_sourceConflict.earlier` jako osiem pól opisowych. Z nich odtwarzamy drugą pozycję.

import type { Baza } from "../../db/index.js";
import type { NowaPozycjaStagingu, PozycjaStagingu } from "../../repos/staging.js";
import { zaktualizujPozycjeStagingu } from "../../repos/staging.js";
import { zapiszDopasowanieStagingu } from "../../repos/staging-polityka.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { zatwierdzPozycjeZPolityka } from "./akceptacja.js";
import { odmow, validateEan, version } from "./helpery.js";
import {
  pozycjaStagingu,
  produktPoKodzie,
  usunZgloszeniaPary,
  type Snapshot,
} from "./kontekst.js";
import { sourceKey } from "./podstawy.js";
import { dodajZgloszenie } from "./zgloszenia.js";

export type DecyzjaSprzecznosci = "merge" | "split";

type WierszPliku = Record<string, unknown>;

/** Etykiety pól z `_sourceConflict` (`fabryka.ts:530-539`) → klucze snapshotu. */
const POLA_WIERSZA: ReadonlyArray<readonly [string, string]> = [
  ["kod dostawcy", "kodDostawcy"],
  ["marka", "marka"],
  ["model", "model"],
  ["rozmiar", "rozmiar"],
  ["DOT", "dot"],
  ["EAN", "ean"],
  ["cena zakupu", "cenaZakupu"],
  ["stan", "stan"],
];

/**
 * Snapshot jednego wiersza pliku: baza (późniejszy wiersz) z nałożonymi polami tego wiersza,
 * bez znaczników sprzeczności, z przeliczonym EAN i kluczem źródłowym wiersza.
 */
function snapshotWiersza(
  dostawca: string,
  baza: Snapshot,
  wiersz: WierszPliku,
  resolution: "link" | "new",
): Snapshot {
  const s: Snapshot = { ...baza };
  for (const [etykieta, klucz] of POLA_WIERSZA) {
    if (etykieta in wiersz) s[klucz] = wiersz[etykieta];
  }
  const ev = validateEan(s.ean);
  s.ean = ev.value;
  s.eanRaw = ev.raw;
  s.eanIsValid = ev.valid === null ? null : Number(ev.valid);
  s.eanSourceStatus = ev.status;
  s._eanIssue = ev.error;

  delete s._duplicateSource;
  delete s._sourceConflict;
  s._resolution = resolution;
  s._sourceKey = sourceKey(dostawca, { ...s, kod: wiersz.kod });
  return s;
}

/** Nowe zgłoszenie z jednego wiersza — kształt jak w `rozstrzygnijZgloszenie`. */
function zgloszenieZWiersza(
  row: PozycjaStagingu,
  db: Baza,
  kod: string,
  snap: Snapshot,
  opis: string,
): NowaPozycjaStagingu {
  const { id: _pomijane, ...bezId } = row;
  const istniejacy = produktPoKodzie(db, kod);
  snap._catalogVersion = version(istniejacy);
  const cena = snap.cenaZakupu == null ? null : Number(snap.cenaZakupu);
  const stan = snap.stan == null ? null : Number(snap.stan);
  const cenaStara = istniejacy?.cenaZakupu ?? null;
  return {
    ...bezId,
    kod,
    typZmiany: snap._eanIssue ? "blad" : istniejacy ? "zmiana_kluczowa" : "nowa",
    stanStary: istniejacy?.stan ?? null,
    stanNowy: stan ?? istniejacy?.stan ?? 0,
    cenaZakupuStara: cenaStara,
    cenaZakupuNowa: cena ?? istniejacy?.cenaZakupu ?? 0,
    zmianaPct: cenaStara && cenaStara > 0 && cena != null ? ((cena - cenaStara) / cenaStara) * 100 : null,
    eanRaw: (snap.eanRaw as string) ?? null,
    eanIsValid: (snap.eanIsValid as number) ?? null,
    eanSourceStatus: (snap.eanSourceStatus as string) ?? null,
    powod:
      `Ręcznie rozstrzygnięto: ${opis}` +
      (snap._eanIssue ? ` • Błędny EAN: ${String(snap._eanIssue)}` : ""),
    snapshotJson: JSON.stringify(snap),
    utworzono: new Date().toISOString(),
  };
}

/**
 * Rozstrzyga sprzeczne wiersze jednego cennika i od razu zatwierdza wynik do katalogu.
 *
 *  • `merge` — to jedna opona: powstaje JEDEN produkt na karcie zgłoszenia. Dane bierze
 *    z późniejszego wiersza (tak samo importer traktuje wiersze, które się nie różnią:
 *    ostatni wygrywa). Klucze źródłowe OBU wierszy zapamiętują się na tę kartę, żeby kolejny
 *    import nie pytał o to samo.
 *  • `split` — to dwie różne opony: każdy wiersz dostaje własny produkt o kodzie z pliku
 *    dostawcy. Wiersz, którego kod pokrywa się z kartą zgłoszenia (albo, gdy żaden się nie
 *    pokrywa, a karta istnieje — wcześniejszy), aktualizuje kartę; drugi zakłada nowy produkt.
 */
export function rozstrzygnijSprzecznoscZrodla(
  db: Baza,
  id: number,
  decyzja: unknown,
  uzytkownikId: number,
): { kody: string[] } {
  if (decyzja !== "merge" && decyzja !== "split") odmow("Nieprawidłowa decyzja.");

  const row = pozycjaStagingu(db, id);
  if (!row) odmow("Zgłoszenie już nie istnieje.");

  const snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
  if (!snap._duplicateSource) {
    odmow("To zgłoszenie nie dotyczy sprzecznych wierszy w jednym cenniku.");
  }
  const konflikt = snap._sourceConflict as
    | { earlier?: WierszPliku; later?: WierszPliku }
    | undefined;
  if (!konflikt?.earlier || !konflikt.later) {
    odmow(
      "To starsze zgłoszenie nie zawiera porównania wierszy. Wczytaj ponownie aktualny cennik.",
    );
  }
  const { earlier, later } = konflikt;

  return uchwytSqlite(db).transaction(() => {
    if (decyzja === "merge") {
      const s = snapshotWiersza(row.dostawca, snap, later, "link");
      s._sourceKey = snap._sourceKey ?? s._sourceKey;
      const nowe = zgloszenieZWiersza(row, db, row.kod, s, "połączono wiersze pliku w jeden produkt");
      zaktualizujPozycjeStagingu(db, id, {
        typZmiany: nowe.typZmiany,
        stanStary: nowe.stanStary,
        stanNowy: nowe.stanNowy,
        cenaZakupuStara: nowe.cenaZakupuStara,
        cenaZakupuNowa: nowe.cenaZakupuNowa,
        zmianaPct: nowe.zmianaPct,
        eanRaw: nowe.eanRaw,
        eanIsValid: nowe.eanIsValid,
        eanSourceStatus: nowe.eanSourceStatus,
        powod: nowe.powod,
        snapshotJson: nowe.snapshotJson,
      });
      zatwierdzPozycjeZPolityka(db, id, uzytkownikId);
      // Drugi wiersz też ma wskazywać tę kartę — akceptacja zapamiętała tylko klucz późniejszego.
      const klucz = snapshotWiersza(row.dostawca, snap, earlier, "link")._sourceKey;
      zapiszDopasowanieStagingu(db, row.dostawca, String(klucz), row.kod, new Date().toISOString());
      return { kody: [row.kod] };
    }

    // ——— split ———
    const kodWczesniejszy = String(earlier.kod ?? "");
    const kodPozniejszy = String(later.kod ?? "");
    if (!kodWczesniejszy || !kodPozniejszy || kodWczesniejszy === kodPozniejszy) {
      odmow(
        "Nie można rozdzielić wierszy: brak różnych kodów w pliku dostawcy. Popraw plik u dostawcy.",
      );
    }
    let kodA = kodWczesniejszy;
    let kodB = kodPozniejszy;
    if (row.kod === kodPozniejszy) kodB = row.kod;
    else if (row.kod === kodWczesniejszy || produktPoKodzie(db, row.kod)) kodA = row.kod;

    for (const kod of [kodA, kodB]) {
      if (kod !== row.kod && produktPoKodzie(db, kod)) {
        odmow(`Produkt o kodzie ${kod} już istnieje w katalogu. Nie można założyć go drugi raz.`);
      }
    }

    usunZgloszeniaPary(db, row.dostawca, row.kod);
    const wiersze: Array<[string, WierszPliku]> = [
      [kodA, earlier],
      [kodB, later],
    ];
    const zapisane = wiersze.map(([kod, wiersz]) => {
      const s = snapshotWiersza(row.dostawca, snap, wiersz, produktPoKodzie(db, kod) ? "link" : "new");
      s.kod = kod;
      return dodajZgloszenie(
        db,
        zgloszenieZWiersza(row, db, kod, s, "rozdzielono wiersze pliku na osobne produkty"),
      );
    });
    for (const z of zapisane) zatwierdzPozycjeZPolityka(db, z.id, uzytkownikId);
    return { kody: [kodA, kodB] };
  })();
}
