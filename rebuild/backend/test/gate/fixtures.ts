import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KATALOG_FIXTURES } from "./repo.js";

/** Kształt pliku z contract/fixtures/ (contract/README.md). */
export type Fixture = {
  endpoint: string;
  method: string;
  status: number;
  json: boolean;
  body: unknown;
};

/**
 * Ładuje nagraną odpowiedź żywego backendu. Nazwa pliku = `GET_<ścieżka z _ zamiast />.json`,
 * np. `/api/me` → `GET_me.json`.
 */
export function wczytajFixture(nazwaPliku: string): Fixture {
  const sciezka = join(KATALOG_FIXTURES(), nazwaPliku);
  const surowy = readFileSync(sciezka, "utf8");
  const fixture = JSON.parse(surowy) as Fixture;
  if (!fixture || typeof fixture !== "object" || !("body" in fixture)) {
    throw new Error(`Fixture ${nazwaPliku} nie ma pola "body" — czy to na pewno plik kontraktu?`);
  }
  return fixture;
}
