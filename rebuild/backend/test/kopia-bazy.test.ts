/**
 * Kopia bazy przed migracjami (`scripts/kopia-bazy.cjs`).
 *
 * PO CO TEST: to jest siatka bezpieczeństwa deployu, a nieprzetestowana siatka jest gorsza
 * niż jej brak — daje poczucie ochrony, którego nie ma. Testujemy więc rzecz najważniejszą:
 * że kopia POWSTAJE dokładnie wtedy, gdy trzeba, i że da się z niej ODTWORZYĆ dane.
 *
 * Bez mocków: prawdziwy plik SQLite w katalogu tymczasowym, prawdziwe `VACUUM INTO`,
 * skrypt uruchamiany jako osobny proces — dokładnie tak, jak robi to `deploy-staging.sh`.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const SKRYPT = join(backendDir, "scripts", "kopia-bazy.cjs");

/** Uruchamia skrypt tak, jak robi to deploy: osobny proces, konfiguracja przez env. */
function uruchom(env: Record<string, string>): string {
  return execFileSync(process.execPath, [SKRYPT], {
    cwd: backendDir,
    encoding: "utf-8",
    env: { ...process.env, MIGRATIONS_DIR: KATALOG_SCHEMATU(), ...env },
  });
}

describe("kopia-bazy — siatka bezpieczeństwa przed migracjami", () => {
  let katalog: string;
  let sciezkaBazy: string;
  let katalogKopii: string;

  const kopie = () => (existsSync(katalogKopii) ? readdirSync(katalogKopii) : []);

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-kopia-"));
    sciezkaBazy = join(katalog, "data-nowy.db");
    katalogKopii = join(katalog, "backups");
  });
  afterEach(() => rmSync(katalog, { recursive: true, force: true }));

  it("gdy są migracje do zastosowania — robi kopię", () => {
    // Baza istnieje, ale nigdy nie była migrowana: wszystko jest do zastosowania.
    new Database(sciezkaBazy).close();

    const wyjscie = uruchom({ DB_PATH: sciezkaBazy, KOPIE_DIR: katalogKopii });

    expect(wyjscie).toContain("robię kopię");
    expect(kopie()).toHaveLength(1);
    expect(kopie()[0]).toContain("data-nowy.db.bak_pre-migracje_");
  });

  it("⭐ z kopii DA SIĘ odtworzyć dane sprzed migracji", () => {
    // Baza po migracjach + wiersz, który ma przeżyć.
    const { sqlite, db } = otworzBaze(sciezkaBazy);
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    sqlite
      .prepare(
        "INSERT INTO users (email, haslo_hash, imie_nazwisko, utworzono) VALUES (?, ?, ?, ?)",
      )
      .run("przed@migracja.test", "$2b$10$hash", "Ktoś Tam", "2026-01-01T00:00:00.000Z");
    sqlite.close();
    void db;

    // Dokładamy nową migrację, żeby skrypt uznał, że jest co robić.
    const katalogMigracji = mkdtempSync(join(tmpdir(), "bridge-migracje-"));
    for (const plik of readdirSync(KATALOG_SCHEMATU()).filter((f) => f.endsWith(".sql"))) {
      copyFileSync(join(KATALOG_SCHEMATU(), plik), join(katalogMigracji, plik));
    }
    writeFileSync(join(katalogMigracji, "999_test.sql"), "SELECT 1;");

    uruchom({
      DB_PATH: sciezkaBazy,
      KOPIE_DIR: katalogKopii,
      MIGRATIONS_DIR: katalogMigracji,
    });

    expect(kopie()).toHaveLength(1);

    // Kopia jest KOMPLETNĄ, otwieralną bazą — nie ułomkiem pliku WAL.
    const kopiaDb = new Database(join(katalogKopii, kopie()[0]!), { readonly: true });
    const wiersz = kopiaDb
      .prepare("SELECT email FROM users WHERE email = ?")
      .get("przed@migracja.test") as { email: string } | undefined;
    expect(wiersz?.email).toBe("przed@migracja.test");
    kopiaDb.close();

    rmSync(katalogMigracji, { recursive: true, force: true });
  });

  it("gdy nie ma czego migrować — NIE robi kopii (żeby nie zasypać dysku)", () => {
    const { sqlite } = otworzBaze(sciezkaBazy);
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    sqlite.close();

    const wyjscie = uruchom({ DB_PATH: sciezkaBazy, KOPIE_DIR: katalogKopii });

    expect(wyjscie).toContain("kopia niepotrzebna");
    expect(kopie()).toHaveLength(0);
  });

  it("gdy bazy jeszcze nie ma — wychodzi spokojnie, nie wywraca deployu", () => {
    const wyjscie = uruchom({ DB_PATH: sciezkaBazy, KOPIE_DIR: katalogKopii });

    expect(wyjscie).toContain("jeszcze nie istnieje");
    expect(kopie()).toHaveLength(0);
  });

  it("brak DB_PATH przerywa deploy zamiast po cichu nic nie zrobić", () => {
    expect(() =>
      execFileSync(process.execPath, [SKRYPT], {
        cwd: backendDir,
        encoding: "utf-8",
        env: { ...process.env, DB_PATH: "", MIGRATIONS_DIR: KATALOG_SCHEMATU() },
      }),
    ).toThrow();
  });

  it("rotacja zostawia zadaną liczbę kopii", () => {
    new Database(sciezkaBazy).close();

    for (let i = 0; i < 4; i += 1) {
      uruchom({ DB_PATH: sciezkaBazy, KOPIE_DIR: katalogKopii, KOPIE_ILE: "2" });
    }

    expect(kopie()).toHaveLength(2);
  });
});
