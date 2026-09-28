// `U.acceptStaging` ze Staging v2 — `staging_policy.cjs:202-226`.
//
// ⭐ TO JEST WARSTWA NAD `zatwierdzPozycjeStagingu`, NIE ZMIANA W NIM. W oryginale
// `install()` robi `original.accept = U.acceptStaging.bind(U)` i dopiero potem podmienia
// `U.acceptStaging` — czyli stara akceptacja zostaje nietknięta i jest wołana w środku.
// U nas jest tak samo: `zatwierdzPozycjeStagingu` (port bazowego `:44827`) NIE JEST
// modyfikowane, a ten plik je opakowuje.
//
// Gdyby wepchnąć blokady DO `zatwierdzPozycjeStagingu`, wszystkie istniejące scenariusze
// charakteryzacyjne (`test/charakteryzacja/akceptacja/scenariusze.mjs` — żaden nie ma
// `_policyVersion`) zaczęłyby padać blokadą „stary import". Warstwa jest tu po to.

import type { Baza } from "../../db/index.js";
import { aktualizujProdukt } from "../../repos/products.js";
import { zaktualizujPozycjeStagingu } from "../../repos/staging.js";
import {
  czyAutomatycznieWstrzymany,
  usunAutomatyczneWstrzymanie,
  zapiszDopasowanieStagingu,
} from "../../repos/staging-polityka.js";
import { zatwierdzPozycjeStagingu } from "../akceptacja.js";
import { nadajKodImportu } from "./kod-importu.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { sprawdzAkceptacje } from "./blokady.js";
import { odmow, validateEan } from "./helpery.js";
import { chron, usunZgloszeniaPary } from "./kontekst.js";

/**
 * Zatwierdza JEDNĄ pozycję stagingu z pełną polityką Staging v2 — `:202-226`.
 *
 * ⚠ ATOMOWOŚĆ JEST PER POZYCJA, nie per żądanie. Oryginał zawija w transakcję właśnie tyle
 * i nie więcej; `POST /api/staging/accept` woła to w pętli BEZ `try`/`catch`
 * (`deminified/backend-index.cjs:48544`), więc pierwsza zablokowana pozycja przerywa całe
 * żądanie, a pozycje zatwierdzone wcześniej ZOSTAJĄ zatwierdzone. Odtworzone 1:1.
 */
export function zatwierdzPozycjeZPolityka(db: Baza, id: number, uzytkownikId: number): void {
  uchwytSqlite(db).transaction(() => {
    const { row, snap, current } = sprawdzAkceptacje(db, id);

    // Wycofanie kończy się tutaj — bazowa akceptacja wstrzymuje produkt i kasuje pozycję,
    // a reszta polityki (EAN, dopasowania) nie ma do czego się odnieść (`:204`).
    if (row.typZmiany === "wycofana") {
      zatwierdzPozycjeStagingu(db, id, uzytkownikId, nadajKodImportu);
      usunZgloszeniaPary(db, row.dostawca, row.kod);
      return;
    }

    const safe = chron(db, row.dostawca, snap, row.kod);

    // Druga walidacja EAN-u — tym razem po nałożeniu ręcznych poprawek. Poprawka mogła
    // wprowadzić zły numer i wtedy zapis staje (`:206-207`).
    const ev = validateEan(safe.ean);
    if (ev.error) odmow("Zapis został zatrzymany: nieprawidłowy EAN.");

    // Pusty EAN dziedziczy po karcie w katalogu — cennik bez EAN-u nie kasuje tego,
    // co już wiemy o produkcie (`:208`).
    if (!ev.value && current?.ean) safe.ean = current.ean;

    const sv = validateEan(safe.ean);
    safe.ean = sv.value;
    safe.eanIsValid = sv.valid === null ? null : Number(sv.valid);
    safe.eanRaw = sv.raw;
    safe.eanSourceStatus = sv.status;

    // Snapshot z poprawkami wraca do wiersza stagingu PRZED akceptacją, żeby bazowa
    // akceptacja zobaczyła dokładnie te dane, które przeszły politykę (`:212-214`).
    zaktualizujPozycjeStagingu(db, id, {
      snapshotJson: JSON.stringify(safe),
      nazwa: safe.nazwa || row.nazwa,
      cenaZakupuNowa: safe.cenaZakupu ?? row.cenaZakupuNowa,
      stanNowy: safe.stan ?? row.stanNowy,
      magazyn: safe.magazyn ?? row.magazyn,
      eanRaw: sv.raw,
      eanIsValid: safe.eanIsValid,
      eanSourceStatus: sv.status,
    });

    zatwierdzPozycjeStagingu(db, id, uzytkownikId, nadajKodImportu);

    // ——— Ochrona ręcznego wstrzymania (#104, `:216-222`) ———
    // Produkt wstrzymany AUTOMATYCZNIE wraca do gry: znika znacznik, a świeża akceptacja
    // ustawiła już status z cen. Produkt wstrzymany RĘCZNIE zostaje wstrzymany — akceptacja
    // nie zdejmuje decyzji człowieka, tylko wymusza z powrotem `wstrzymany` i stan 0.
    if (current?.status === "wstrzymany") {
      if (czyAutomatycznieWstrzymany(db, row.dostawca, row.kod)) {
        usunAutomatyczneWstrzymanie(db, row.dostawca, row.kod);
      } else {
        aktualizujProdukt(db, current.id, { status: "wstrzymany", stan: 0 });
      }
    }

    usunZgloszeniaPary(db, row.dostawca, row.kod);

    // Świadome rozstrzygnięcie zapamiętuje się na przyszłe importy (`:224-225`),
    // żeby ta sama pozycja dostawcy nie pytała o to samo drugi raz.
    if (snap._resolution && snap._sourceKey) {
      zapiszDopasowanieStagingu(
        db,
        row.dostawca,
        String(snap._sourceKey),
        row.kod,
        new Date().toISOString(),
      );
    }
  })();
}
