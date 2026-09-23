// Dodawanie, edycja i rozstrzyganie zgłoszeń — `staging_policy.cjs:163-187` i `:227-250`.

import { and, eq, sql } from "drizzle-orm";

import type { Baza } from "../../db/index.js";
import { stagingItems } from "../../db/schema.js";
import type { NowaPozycjaStagingu, PozycjaStagingu } from "../../repos/staging.js";
import { zaktualizujPozycjeStagingu } from "../../repos/staging.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { odmow, syntheticCode, validateEan, version } from "./helpery.js";
import {
  chron,
  pozycjaStagingu,
  produktPoKodzie,
  usunZgloszeniaPary,
  type Snapshot,
} from "./kontekst.js";

/**
 * Bazowe `U.addStaging` — `deminified/backend-index.cjs:44923-44927`.
 *
 * Odpowiednik jednowierszowy tego, co `repos/staging.ts::zapiszPozycjeStagingu` robi
 * wsadowo. Trzymam go tutaj, a nie w `repos/staging.ts`, bo tamten plik karmi importer
 * (karta I15.4b, pracuje równolegle) i nie chcę wchodzić w jego wiersze. Po scaleniu obu
 * kart warto, żeby wersja wsadowa wołała tę — nota w „Do koordynatora".
 *
 * Deduplikacja jest częścią kontraktu: pozycja o tym samym `kod` + `typZmiany` + `powod`
 * NIE wchodzi drugi raz, tylko oddaje tę, która już jest.
 */
function dodajPozycjeBazowo(db: Baza, row: NowaPozycjaStagingu): PozycjaStagingu {
  const istniejaca = db
    .select()
    .from(stagingItems)
    .where(
      and(
        eq(stagingItems.kod, row.kod),
        eq(stagingItems.typZmiany, row.typZmiany),
        sql`COALESCE(${stagingItems.powod}, '') = COALESCE(${row.powod ?? null}, '')`,
      ),
    )
    .get();
  if (istniejaca) return istniejaca;
  return db.insert(stagingItems).values(row).returning().get();
}

/**
 * `U.addStaging` ze Staging v2 — `staging_policy.cjs:163-167`.
 *
 * Nowe zgłoszenie KASUJE poprzednie tej samej pary `(dostawca, kod)`. Komentarz oryginału
 * mówi wprost dlaczego: „Fresh id invalidates old browser selections. Never retain the old
 * snapshot." — panel Ani trzyma zaznaczenia po `id`, więc zostawienie starego wiersza
 * pozwoliłoby zatwierdzić nieaktualny snapshot.
 *
 * Od migracji 012 pilnuje tego dodatkowo indeks `staging_one_current_product`.
 */
export function dodajZgloszenie(db: Baza, row: NowaPozycjaStagingu): PozycjaStagingu {
  return uchwytSqlite(db).transaction(() => {
    usunZgloszeniaPary(db, row.dostawca, row.kod);
    return dodajPozycjeBazowo(db, row);
  })();
}

/**
 * `U.updateStaging` ze Staging v2 — `staging_policy.cjs:168-187`.
 *
 * Dwie rzeczy dzieją się przy edycji snapshotu:
 *  • bieżnik nadąża za modelem, ale TYLKO gdy był jego automatyczną kopią (formularz edytuje
 *    model i nie pokazuje pola bieżnika — ręcznie ustawionego bieżnika nie ruszamy);
 *  • zmiana EAN-u przelicza `eanRaw`, `eanIsValid`, `eanSourceStatus` i `_eanIssue`, i to
 *    zarówno w snapshocie, jak i w kolumnach wiersza — żeby blokada akceptacji (D4) widziała
 *    poprawiony numer, a nie ten sprzed edycji.
 */
export function zaktualizujZgloszenie(db: Baza, id: number, patch: Record<string, unknown>) {
  const row = pozycjaStagingu(db, id);
  let doZapisu = patch;

  if (row && patch.snapshotJson) {
    const snap = JSON.parse(String(patch.snapshotJson)) as Snapshot;
    const old = JSON.parse(row.snapshotJson || "{}") as Snapshot;

    if (snap.model !== old.model && old.bieznik === old.model && snap.bieznik === old.bieznik) {
      snap.bieznik = snap.model;
    }

    const edytowanoEan =
      patch.edytowanePola &&
      (JSON.parse(String(patch.edytowanePola)) as unknown[]).includes("ean");
    if (snap.ean !== old.ean || edytowanoEan) {
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
  }

  return zaktualizujPozycjeStagingu(db, id, doZapisu);
}

/**
 * `U.resolveStaging` — `staging_policy.cjs:227-250`.
 *
 * Rozstrzygnięcie NIE edytuje zgłoszenia: kasuje je i zakłada NOWE, z przeliczonym typem
 * zmiany i powodem opisującym decyzję. Nowe `id` unieważnia zaznaczenie w panelu, tak samo
 * jak przy `addStaging`.
 */
export function rozstrzygnijZgloszenie(
  db: Baza,
  id: number,
  action: unknown,
  targetCode: unknown,
): PozycjaStagingu {
  const row = pozycjaStagingu(db, id);
  if (!row) odmow("Zgłoszenie już nie istnieje.");

  const snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
  if (!snap._matchIssue) odmow("To zgłoszenie nie wymaga rozstrzygnięcia dopasowania.");
  if (snap._duplicateSource) {
    odmow(
      "Dostawca przesłał sprzeczne wiersze pod tym samym kodem. Najpierw popraw plik źródłowy.",
    );
  }

  let current = null;
  let code = row.kod;
  const kandydaci = (snap._candidates ?? []) as Array<Record<string, unknown>>;

  if (action === "link") {
    current = produktPoKodzie(db, String(targetCode)) ?? null;
    if (!current || current.dostawca !== row.dostawca || !kandydaci.some((p) => p.kod === current!.kod)) {
      odmow("Wybierz produkt z listy kandydatów tego dostawcy.");
    }
    code = current.kod;
  } else if (action === "new") {
    // Kolizja kodu → kod zastępczy z tożsamości opony. Druga kolizja znaczy, że pod tym
    // oznaczeniem naprawdę coś już stoi i decyzja „dodaj osobny" jest błędna.
    if (produktPoKodzie(db, code)) code = syntheticCode(row.dostawca, snap);
    if (produktPoKodzie(db, code)) {
      odmow("Produkt z takim oznaczeniem już istnieje. Wybierz właściwe dopasowanie.");
    }
  } else {
    odmow("Nieprawidłowa decyzja.");
  }

  const safe = chron(db, row.dostawca, snap, code);
  safe._resolution = action;
  safe._catalogVersion = version(current);

  const opis = action === "link" ? `połącz z ${code}` : "dodaj osobny produkt";
  const { id: _pomijane, ...bezId } = row;

  return uchwytSqlite(db).transaction(() => {
    usunZgloszeniaPary(db, row.dostawca, row.kod);
    // ⚠ `dodajZgloszenie`, NIE `dodajPozycjeBazowo`. Oryginał (`:245`) woła NADPISANE
    // `U.addStaging`, więc czyszczenie pary leci DWA RAZY i za drugim razem dotyczy kodu
    // DOCELOWEGO (`code`), nie źródłowego. Bez tego `action:"link"` na kod, pod którym wisi
    // już inne zgłoszenie, wywala się o indeks unikalny `staging_one_current_product`
    // (surowe 500 z treścią SQL-a), zamiast — jak w produkcji — zastąpić tamto zgłoszenie.
    return dodajZgloszenie(db, {
      ...bezId,
      kod: code,
      typZmiany: safe._eanIssue ? "blad" : current ? "zmiana_kluczowa" : "nowa",
      powod:
        `Ręcznie rozstrzygnięto: ${opis}` +
        (safe._eanIssue ? ` • Błędny EAN: ${String(safe._eanIssue)}` : ""),
      snapshotJson: JSON.stringify(safe),
      utworzono: new Date().toISOString(),
    });
  })();
}
