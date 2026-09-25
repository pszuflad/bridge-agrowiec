// Ticket 155-FEATURE-dziedziczenie-wagi-po-rozmiarze — dociągnięcie wagi WSTECZNIE dla
// produktów już w katalogu, które mają dziś pustą albo zerową wagę (decyzja 3 z Q&A).
//
// ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT — patrz `src/import/dziedziczenieWagi.ts`. Uruchamiany
// ręcznie, kiedy operator (Ania) tego chce — NIE przy starcie serwera (odrzucona opcja).
//
// Pomija produkty, dla których istnieje wiersz `manual_overrides` z `fieldName = 'waga'` dla
// ich (dostawca, kodDostawcy) — nawet z dzisiejszą wagą 0, bo to oznacza świadomą ręczną
// decyzję (decyzja 5: ręczna edycja zawsze wygrywa, backfill jej nie omija).
//
//   DB_PATH=./data/bridge.db npm run dziedzicz-wage

import { and, eq, sql } from "drizzle-orm";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { manualOverrides, products } from "../src/db/schema.js";
import { jestPustaWaga, kluczZRekordu, znajdzWageDoDziedziczenia } from "../src/import/dziedziczenieWagi.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("dziedzicz-wage: brak DB_PATH — nie wiem, którą bazę czytać. Przerywam.");
  process.exit(1);
}

const { sqlite, db } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);

  const kandydaci = db
    .select()
    .from(products)
    .where(sql`${products.waga} IS NULL OR ${products.waga} = 0`)
    .all();

  let zaktualizowano = 0;
  let pominietoOverride = 0;
  let pominietoBrakDanych = 0;
  let pominietoBrakDopasowania = 0;

  // Cały przebieg w JEDNEJ transakcji — albo wszystkie dopasowane wiersze zapisują się razem,
  // albo (przy błędzie w trakcie) żaden, zamiast zostawiać katalog w stanie „na wpół dociągniętym".
  const przetworz = sqlite.transaction(() => {
    for (const produkt of kandydaci) {
      if (!jestPustaWaga(produkt.waga)) continue; // filtr SQL wyżej jest zgrubny, dociskamy tym samym progiem co reszta mechanizmu

      const overrideWagi = db
        .select({ id: manualOverrides.id })
        .from(manualOverrides)
        .where(
          and(
            eq(manualOverrides.supplierKod, produkt.dostawca),
            eq(manualOverrides.supplierProductId, produkt.kod),
            eq(manualOverrides.fieldName, "waga"),
          ),
        )
        .get();
      if (overrideWagi) {
        pominietoOverride++;
        continue;
      }

      const klucz = kluczZRekordu(produkt as unknown as Record<string, unknown>);
      if (!klucz) {
        pominietoBrakDanych++;
        continue;
      }

      const waga = znajdzWageDoDziedziczenia(db, klucz);
      if (waga === null) {
        pominietoBrakDopasowania++;
        continue;
      }

      db.update(products)
        .set({ waga, wagaAutoUzupelniona: true })
        .where(eq(products.id, produkt.id))
        .run();
      zaktualizowano++;
    }
  });
  przetworz();

  console.log(
    `dziedzicz-wage: zaktualizowano ${zaktualizowano}/${kandydaci.length} produktów ` +
      `(pominięto: ${pominietoOverride} ręczna poprawka wagi, ${pominietoBrakDanych} brak marki/rozmiaru, ` +
      `${pominietoBrakDopasowania} brak pasującego produktu z wagą).`,
  );
} finally {
  sqlite.close();
}
