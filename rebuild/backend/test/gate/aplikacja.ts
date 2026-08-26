import { dirname, join } from "node:path";
import type { Express } from "express";
import { wczytajEnv, type Env } from "../../src/config/env.js";
import { stworzApp } from "../../src/app.js";
import {
  stworzTestowaBaze,
  zasiejUzytkownika,
  UZYTKOWNIK_TESTOWY,
  type DaneUzytkownika,
  type TestowaBaza,
} from "./baza.js";

export const SEKRET_TESTOWY = "sekret-tylko-do-testow-nigdy-do-produkcji";

export type SrodowiskoTestowe = TestowaBaza & {
  app: Express;
  env: Env;
  uzytkownik: { id: number; email: string; imieNazwisko: string };
  dane: DaneUzytkownika;
  /** Katalog archiwum importu na czas testu — sprzątany razem z bazą. */
  katalogArchiwum: string;
};

/**
 * Kompletne środowisko testowe: świeża baza z kanonu + zasiany użytkownik + aplikacja
 * Express bez `listen()` (HTTP idzie przez supertest, więc żaden port nie jest zajmowany).
 */
export async function stworzSrodowiskoTestowe(
  dane: DaneUzytkownika = UZYTKOWNIK_TESTOWY,
): Promise<SrodowiskoTestowe> {
  const baza = stworzTestowaBaze();
  const uzytkownik = await zasiejUzytkownika(baza.db, dane);
  // Archiwum importu ląduje w katalogu tymczasowym testu, nie w repozytorium.
  const katalogArchiwum = join(dirname(baza.sciezka), "import_archive");
  const env = wczytajEnv({
    NODE_ENV: "test",
    // HOST/PORT celowo pominięte — testy nie wołają listen() (supertest), więc nie
    // zajmujemy żadnego portu i nie ryzykujemy kolizji z równolegle pracującym agentem.
    DB_PATH: baza.sciezka,
    JWT_SECRET: SEKRET_TESTOWY,
    IMPORT_ARCHIVE_DIR: katalogArchiwum,
  } as NodeJS.ProcessEnv);
  const app = stworzApp({ env, db: baza.db });
  return { ...baza, app, env, uzytkownik, dane, katalogArchiwum };
}
