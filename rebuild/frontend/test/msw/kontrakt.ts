import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Uzytkownik } from "@/lib/api";
import type { Produkt } from "@/pages/katalog/filtrowanie";

const katalogTestow = dirname(fileURLToPath(import.meta.url));
const korzenRepo = resolve(katalogTestow, "../../../..");

/**
 * Użytkownik do mocków brany PROSTO z `contract/fixtures/GET_me.json` — nagranej
 * odpowiedzi żywej produkcji. Dzięki temu testy sprawdzają zgodność z kontraktem,
 * a nie z moim wyobrażeniem o nim: zmiana kształtu fixtura wywali test.
 */
export function uzytkownikZFixtura(): Uzytkownik {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_me.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: { id: number; email: string; imieNazwisko: string };
  };
  const { id, email, imieNazwisko } = fixture.body;
  return { id, email, imieNazwisko };
}

/** Token o kształcie JWT — wartość nieistotna, liczy się, że FE go zapisze i odeśle. */
export const TOKEN_TESTOWY = "naglowek.tresc.podpis";

/**
 * Produkty do mocków prosto z `contract/fixtures/GET_products.json` (5 pozycji nagranych
 * z produkcji). Ta sama zasada co przy użytkowniku: testy widoku sprawdzają zgodność
 * z kontraktem, a nie z moim wyobrażeniem o kształcie danych.
 */
export function produktyZFixtura(): Produkt[] {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_products.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: { items: Produkt[] };
  };
  return fixture.body.items;
}

/** Dostawcy z `contract/fixtures/GET_suppliers.json` (5 pozycji). */
export function dostawcyZFixtura(): Record<string, unknown>[] {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_suppliers.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: Record<string, unknown>[] };
  return fixture.body;
}

/**
 * Strona stagingu prosto z `contract/fixtures/GET_staging_paged.json` — koperta
 * `{items,total,page,pageSize,pages}` z 50 nagranymi pozycjami.
 *
 * Ta sama zasada co przy produktach: widok testujemy przeciwko KSZTAŁTOWI, który realnie
 * oddaje produkcja, a nie przeciwko mojemu wyobrażeniu o nim. Fixture ma tylko 20 pól
 * w pozycji — bez `snapshotJson` — i właśnie o to chodzi: podgląd różnic MUSI dociągnąć
 * pozycję osobno.
 */
export function stronaStaginguZFixtura(): {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
} {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_staging_paged.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: { items: Record<string, unknown>[]; total: number; page: number; pageSize: number; pages: number };
  };
  const { items, total, page, pageSize, pages } = fixture.body;
  return { items, total, page, pageSize, pages };
}

/**
 * Pozycja ze `snapshotJson` prosto z `contract/fixtures/GET_staging.json` — kształt, jaki
 * oddaje `GET /api/staging/{id}` (24 pola). Używana w teście podglądu różnic.
 */
export function pozycjaStaginguZFixtura(): Record<string, unknown> {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_staging.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: Record<string, unknown>[] | { items: Record<string, unknown>[] };
  };
  const pozycje = Array.isArray(fixture.body) ? fixture.body : fixture.body.items;
  // Wybieramy pozycję, która NAPRAWDĘ ma snapshot — inaczej test podglądu byłby pusty.
  return pozycje.find((p) => p.snapshotJson) ?? pozycje[0]!;
}

/**
 * Strona historii prosto z `contract/fixtures/GET_history_paged.json` — koperta
 * `{items,total,pages,page,limit}` z 50 nagranymi wpisami. Ta sama zasada co wyżej:
 * test widoku sprawdza zgodność z kontraktem, a nie z moim wyobrażeniem o kształcie.
 */
export function stronaHistoriiZFixtura(): {
  items: Record<string, unknown>[];
  total: number;
  pages: number;
  page: number;
  limit: number;
} {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_history_paged.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: {
      items: Record<string, unknown>[];
      total: number;
      pages: number;
      page: number;
      limit: number;
    };
  };
  const { items, total, pages, page, limit } = fixture.body;
  return { items, total, pages, page, limit };
}

/** Lista dostawców do filtra historii z `contract/fixtures/GET_history_meta.json`. */
export function metaHistoriiZFixtura(): { dostawcy: string[] } {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_history_meta.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as { body: { dostawcy: string[] } };
  return { dostawcy: fixture.body.dostawcy };
}
