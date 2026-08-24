import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zahashujHaslo } from "../../src/auth/password.js";
import { otworzBaze, type Baza, type BazaSqlite } from "../../src/db/index.js";
import { zastosujMigracje } from "../../src/db/migrate.js";
import { users } from "../../src/db/schema.js";
import { KATALOG_SCHEMATU } from "./repo.js";

export type TestowaBaza = {
  db: Baza;
  sqlite: BazaSqlite;
  sciezka: string;
  posprzataj: () => void;
};

/**
 * Świeża baza testowa zbudowana z KANONICZNEGO `rebuild/schema/001_schema.sql` —
 * ta sama droga, którą przechodzi staging (`npm run migrate`). Żadnych mocków:
 * testy gadają z prawdziwym SQLite w katalogu tymczasowym, więc są izolowane
 * (brak ryzyka kolizji z równolegle pracującym agentem czy z lokalną bazą dev).
 */
export function stworzTestowaBaze(): TestowaBaza {
  const katalog = mkdtempSync(join(tmpdir(), "bridge-gate-"));
  const sciezka = join(katalog, "test.db");
  const { sqlite, db } = otworzBaze(sciezka);
  zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  return {
    db,
    sqlite,
    sciezka,
    posprzataj: () => {
      sqlite.close();
      rmSync(katalog, { recursive: true, force: true });
    },
  };
}

export type DaneUzytkownika = {
  email: string;
  haslo: string;
  imieNazwisko: string;
};

export const UZYTKOWNIK_TESTOWY: DaneUzytkownika = {
  email: "marta.bieguniak@agrowiec.eu",
  haslo: "haslo-testowe-123",
  imieNazwisko: "Marta Bieguniak",
};

/**
 * Seed testowy — świadomie POZA `001_schema.sql`, który ma zostać czystym punktem
 * zerowym bez danych (rebuild/schema/README.md). Hash liczony prawdziwym bcryptem
 * (koszt 10), żeby test przechodził tę samą ścieżkę co produkcja.
 */
export async function zasiejUzytkownika(
  db: Baza,
  dane: DaneUzytkownika = UZYTKOWNIK_TESTOWY,
): Promise<{ id: number; email: string; imieNazwisko: string }> {
  const hasloHash = await zahashujHaslo(dane.haslo);
  const wstawiony = db
    .insert(users)
    .values({
      email: dane.email,
      hasloHash,
      imieNazwisko: dane.imieNazwisko,
      utworzono: new Date().toISOString(),
    })
    .returning()
    .get();
  return { id: wstawiony.id, email: wstawiony.email, imieNazwisko: wstawiony.imieNazwisko };
}
