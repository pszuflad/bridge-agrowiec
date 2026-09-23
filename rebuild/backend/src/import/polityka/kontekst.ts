// Helpery polityki stagingu, które dotykają bazy — odpowiedniki domknięć z `install()`
// (`staging_policy.cjs:108-162`). Oryginał trzyma je w zakresie `install()`, bo ma tam
// `db` i `U`; u nas `db` jest argumentem, więc to zwykłe funkcje.

import { and, eq } from "drizzle-orm";

import type { Baza } from "../../db/index.js";
import { products, stagingItems } from "../../db/schema.js";
import { poprawkiDla } from "../../repos/overrides.js";
import { aktualizujProdukt, type ProduktWewnetrzny } from "../../repos/products.js";
import {
  czyAutomatycznieWstrzymany,
  zapiszAutomatyczneWstrzymanie,
} from "../../repos/staging-polityka.js";

/** Snapshot pozycji stagingu — dowolny kształt z parsera plus pola `_`-owe polityki. */
export type Snapshot = Record<string, unknown>;

/** `find = code => U.getProductByKod(code)` — `staging_policy.cjs:134`. */
export function produktPoKodzie(db: Baza, kod: string): ProduktWewnetrzny | undefined {
  return db.select().from(products).where(eq(products.kod, kod)).get();
}

/** Pozycja stagingu po id — `U.getStaging(id)`. */
export function pozycjaStagingu(db: Baza, id: number) {
  return db.select().from(stagingItems).where(eq(stagingItems.id, id)).get();
}

/**
 * `clear.run(dostawca, kod)` — `staging_policy.cjs:132`.
 *
 * ⚠ Kasuje WSZYSTKIE zgłoszenia tej pary, nie tylko to o danym id. Od migracji 012 stoi
 * na tym indeks unikalny `staging_one_current_product`, więc w praktyce jest to jeden wiersz —
 * ale zapytanie zostaje takie jak w oryginale, bo to ono ten niezmiennik utrzymuje.
 */
export function usunZgloszeniaPary(db: Baza, dostawca: string, kod: string): void {
  db.delete(stagingItems)
    .where(and(eq(stagingItems.dostawca, dostawca), eq(stagingItems.kod, kod)))
    .run();
}

/**
 * `protect(supplier, r, code)` — `staging_policy.cjs:158-162`.
 *
 * Nakłada ręczne poprawki na snapshot, ZANIM cokolwiek z niego trafi do katalogu. To jest
 * „ochrona ręcznych poprawek bez osobnego błędu" z karty: poprawka nie powoduje konfliktu
 * ani ostrzeżenia, po prostu wygrywa z wartością z pliku dostawcy.
 */
export function chron(db: Baza, dostawca: string, r: Snapshot, kod: string): Snapshot {
  const d: Snapshot = { ...r };
  for (const o of poprawkiDla(db, dostawca, kod)) d[o.fieldName] = o.overrideValue;
  return d;
}

/**
 * `suspend(p, time, fingerprint, reason)` — `staging_policy.cjs:120-130`.
 *
 * Wstrzymuje produkt AUTOMATYCZNIE. Dwie rzeczy, które łatwo zgubić:
 *  • znacznik w `product_auto_suspensions` powstaje tylko dla produktu `aktywny` albo już
 *    oznaczonego — ręczne wstrzymanie Ani NIE zostaje przejęte przez automat;
 *  • `UPDATE` leci tylko wtedy, gdy stan faktycznie się różni, więc powtórne wstrzymanie
 *    nie przestawia `dataAktualizacji`.
 */
export function wstrzymajAutomatycznie(
  db: Baza,
  p: ProduktWewnetrzny,
  czas: string,
  odcisk: string | null,
  powod: string,
): void {
  if (p.status === "aktywny" || czyAutomatycznieWstrzymany(db, p.dostawca, p.kod)) {
    zapiszAutomatyczneWstrzymanie(db, p.dostawca, p.kod, czas, odcisk, powod);
  }
  if (p.status !== "wstrzymany" || Number(p.stan) !== 0) {
    aktualizujProdukt(db, p.id, {
      status: "wstrzymany",
      stan: 0,
      nieobecnoscPodRzad: 0,
      dataAktualizacji: czas,
    });
  }
}
