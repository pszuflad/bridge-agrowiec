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
  const env = wczytajEnv({
    NODE_ENV: "test",
    // HOST/PORT celowo pominięte — testy nie wołają listen() (supertest), więc nie
    // zajmujemy żadnego portu i nie ryzykujemy kolizji z równolegle pracującym agentem.
    DB_PATH: baza.sciezka,
    JWT_SECRET: SEKRET_TESTOWY,
  } as NodeJS.ProcessEnv);
  const app = stworzApp({ env, db: baza.db });
  return { ...baza, app, env, uzytkownik, dane };
}
