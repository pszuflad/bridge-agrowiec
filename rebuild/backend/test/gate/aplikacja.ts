import { dirname, join } from "node:path";
import type { Express } from "express";
import { wczytajEnv, type Env } from "../../src/config/env.js";
import { stworzApp } from "../../src/app.js";
import type { KlientSelly } from "../../src/selly/klient.js";
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
  /** Katalog eksportu CSV dla Selly na czas testu — sprzątany razem z bazą (I8a). */
  katalogCsvSelly: string;
};

/** Dodatki wstrzykiwane do aplikacji testowej — wszystkie opcjonalne. */
export type OpcjeSrodowiska = {
  /**
   * Atrapa klienta Selly (Iteracja 8a). Bez niej `stworzApp` zbuduje klienta prawdziwego,
   * który — przy pustych `SELLY_*` w środowisku testowym — rzuci „Brak konfiguracji"
   * na każdej z sześciu tras zewnętrznych. To jest zachowanie POŻĄDANE dla testu 500,
   * ale każdy test sprawdzający kształt odpowiedzi musi podać własną atrapę.
   *
   * ⚠ ŻADEN TEST NIE MA PRAWA WOŁAĆ PRAWDZIWEGO SELLY. `POST /api/selly/sync-supplier`
   * z `dry_run=false` tworzy i modyfikuje produkty w cudzym, produkcyjnym sklepie.
   */
  klientSelly?: KlientSelly;
};

/**
 * Kompletne środowisko testowe: świeża baza z kanonu + zasiany użytkownik + aplikacja
 * Express bez `listen()` (HTTP idzie przez supertest, więc żaden port nie jest zajmowany).
 */
export async function stworzSrodowiskoTestowe(
  dane: DaneUzytkownika = UZYTKOWNIK_TESTOWY,
  opcje: OpcjeSrodowiska = {},
): Promise<SrodowiskoTestowe> {
  const baza = stworzTestowaBaze();
  const uzytkownik = await zasiejUzytkownika(baza.db, dane);
  // Archiwum importu ląduje w katalogu tymczasowym testu, nie w repozytorium.
  const katalogArchiwum = join(dirname(baza.sciezka), "import_archive");
  // To samo dla eksportu Selly. Domyślna wartość `SELLY_CSV_DIR` to ścieżka PRODUKCYJNA
  // (`/home/admin/...`, plan.md D4) — bez nadpisania `POST /api/selly/generate-csv`
  // próbowałby tam pisać i wywracał się na uprawnieniach.
  const katalogCsvSelly = join(dirname(baza.sciezka), "selly_csv");
  const env = wczytajEnv({
    NODE_ENV: "test",
    // HOST/PORT celowo pominięte — testy nie wołają listen() (supertest), więc nie
    // zajmujemy żadnego portu i nie ryzykujemy kolizji z równolegle pracującym agentem.
    DB_PATH: baza.sciezka,
    JWT_SECRET: SEKRET_TESTOWY,
    IMPORT_ARCHIVE_DIR: katalogArchiwum,
    SELLY_CSV_DIR: katalogCsvSelly,
    // SELLY_SHOP_URL/CLIENT_ID/CLIENT_SECRET celowo PUSTE — środowisko testowe nie ma
    // i nie może mieć sekretów do cudzego sklepu.
  } as NodeJS.ProcessEnv);
  const app = stworzApp({ env, db: baza.db, sqlite: baza.sqlite, klientSelly: opcje.klientSelly });
  return { ...baza, app, env, uzytkownik, dane, katalogArchiwum, katalogCsvSelly };
}
