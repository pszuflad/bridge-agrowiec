/** Migracja 024 (ticket 208, PRT-1.1) — model danych partnerów B2B: domyślne wartości, unikalność, kaskada. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("migracja 024 — partnerzy", () => {
  let katalog: string;
  let sqlite: BazaSqlite;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-024-"));
    ({ sqlite } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const dodajPartnera = (nazwa: string): number =>
    Number(
      sqlite
        .prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES (?, '2026-10-10', '2026-10-10')")
        .run(nazwa).lastInsertRowid,
    );

  it("nowy partner jest nieaktywny, ze stanem minimalnym 2 i zaokrągleniem do grosza", () => {
    const id = dodajPartnera("TyreWorld");
    expect(sqlite.prepare("SELECT * FROM partnerzy WHERE id = ?").get(id)).toMatchObject({
      aktywny: 0,
      stan_min: 2,
      zaokraglanie: "grosz",
      format_pliku: "csv",
      csv_separator: ";",
      kanal_ftp: 0,
      kanal_email: 0,
      harmonogram_minuty: null,
      tolerancja_ceny_proc: null,
    });
  });

  it("nazwa partnera jest unikalna", () => {
    dodajPartnera("Adtyres");
    expect(() => dodajPartnera("Adtyres")).toThrow(/UNIQUE/);
  });

  it("kraj jest unikalny w obrębie partnera, ale ten sam kraj mogą mieć różni partnerzy", () => {
    const a = dodajPartnera("A");
    const b = dodajPartnera("B");
    const wstaw = sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj) VALUES (?, ?)");
    wstaw.run(a, "FR");
    wstaw.run(b, "FR");
    expect(() => wstaw.run(a, "FR")).toThrow(/UNIQUE/);
    expect(sqlite.prepare("SELECT kurs_zrodlo, narzut_proc, koszty_dodatkowe FROM partner_kraje WHERE partner_id = ?").get(a))
      .toEqual({ kurs_zrodlo: "nbp", narzut_proc: 0, koszty_dodatkowe: 0 });
  });

  it("usunięcie partnera kasuje jego ustawienia, nie dotykając innych", () => {
    const a = dodajPartnera("A");
    const b = dodajPartnera("B");
    for (const id of [a, b]) {
      sqlite.prepare("INSERT INTO partner_magazyny VALUES (?, 'MO1')").run(id);
      sqlite.prepare("INSERT INTO partner_wykluczenia VALUES (?, 'MO1_1')").run(id);
      sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj) VALUES (?, 'DE')").run(id);
      sqlite.prepare("INSERT INTO partner_kolumny (partner_id, pozycja, nazwa_w_pliku, zrodlo_typ, zrodlo) VALUES (?, 1, 'EAN', 'katalog', 'ean')").run(id);
      sqlite.prepare("INSERT INTO partner_pola_obliczeniowe (partner_id, nazwa, formula) VALUES (?, 'Cena', 'zakup')").run(id);
      sqlite.prepare("INSERT INTO partner_kursy (partner_id, kraj, kurs, zrodlo, zapisano) VALUES (?, 'DE', 4.3, 'nbp', '2026-10-10')").run(id);
    }
    sqlite.prepare("DELETE FROM partnerzy WHERE id = ?").run(a);
    for (const t of ["partner_magazyny", "partner_wykluczenia", "partner_kraje", "partner_kolumny", "partner_pola_obliczeniowe", "partner_kursy"]) {
      expect(sqlite.prepare(`SELECT partner_id FROM ${t}`).all(), t).toEqual([{ partner_id: b }]);
    }
  });

  it("historia paliwa trzyma okresy per kraj i nie pozwala dwa razy zacząć okresu tego samego dnia", () => {
    const wstaw = sqlite.prepare("INSERT INTO paliwo_historia (kraj, procent, obowiazuje_od) VALUES (?, ?, ?)");
    wstaw.run("FR", 11, "2026-10-01");
    wstaw.run("FR", 12, "2026-11-01");
    wstaw.run("DE", 11, "2026-10-01");
    expect(() => wstaw.run("FR", 13, "2026-10-01")).toThrow(/UNIQUE/);
  });
});
