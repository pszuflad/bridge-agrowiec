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
