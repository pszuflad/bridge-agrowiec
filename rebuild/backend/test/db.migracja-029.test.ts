/** Migracja 029 (ticket 232, PRT-7.4a) — kolumny wyniku walidacji zamówień partnera. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("migracja 029 — walidacja zamówień", () => {
  let katalog: string;
  let sqlite: BazaSqlite;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-029-"));
    ({ sqlite } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const kolumny = (tabela: string): string[] => (sqlite.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map((k) => k.name);

  it("dokłada kolumny `blad_importu` i `blad`, domyślnie NULL", () => {
    expect(kolumny("partner_zamowienia")).toContain("blad_importu");
    expect(kolumny("partner_zamowienia_pozycje")).toContain("blad");
    const p = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES ('P', 'x', 'x')").run().lastInsertRowid);
    const z = Number(sqlite.prepare("INSERT INTO partner_zamowienia (partner_id, numer_partnera, surowy_xml, skrot_xml, pobrano) VALUES (?, 'A1', '<x/>', 'h', 'x')").run(p).lastInsertRowid);
    sqlite.prepare("INSERT INTO partner_zamowienia_pozycje (zamowienie_id, lp, kod, ilosc) VALUES (?, 1, 'K', 1)").run(z);
    expect(sqlite.prepare("SELECT blad_importu FROM partner_zamowienia WHERE id = ?").get(z)).toEqual({ blad_importu: null });
    expect(sqlite.prepare("SELECT blad FROM partner_zamowienia_pozycje WHERE zamowienie_id = ?").get(z)).toEqual({ blad: null });
  });

  it("jest idempotentna: drugie uruchomienie niczego nie zmienia", () => {
    expect(zastosujMigracje(sqlite, KATALOG_SCHEMATU()).zastosowane).toEqual([]);
  });
});
