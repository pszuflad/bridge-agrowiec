/** Migracja 028 (ticket 227, PRT-7.1) — zamówienia partnerów: domyślne wartości i unikalność numeru partnera. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("migracja 028 — partner_zamowienia", () => {
  let katalog: string;
  let sqlite: BazaSqlite;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-028-"));
    ({ sqlite } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const partner = (nazwa: string): number =>
    Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES (?, 'x', 'x')").run(nazwa).lastInsertRowid);
  const zamowienie = (partnerId: number, numer: string) =>
    sqlite
      .prepare("INSERT INTO partner_zamowienia (partner_id, numer_partnera, surowy_xml, skrot_xml, pobrano) VALUES (?, ?, '<x/>', 'h', 'x')")
      .run(partnerId, numer);

  it("nowe zamówienie ma status 'nowe' i pusty numer własny", () => {
    const id = Number(zamowienie(partner("TyreWorld"), "A1").lastInsertRowid);
    expect(sqlite.prepare("SELECT status, numer_wlasny, faktura_json FROM partner_zamowienia WHERE id = ?").get(id)).toEqual({
      status: "nowe",
      numer_wlasny: null,
      faktura_json: "{}",
    });
  });

  it("numer partnera jest unikalny per partner, nie globalnie", () => {
    const a = partner("TyreWorld");
    const b = partner("Adtyres");
    zamowienie(a, "A1");
    expect(() => zamowienie(a, "A1")).toThrow(/UNIQUE/);
    expect(() => zamowienie(b, "A1")).not.toThrow();
  });

  it("pozycje: lp unikalne w zamówieniu, kasowane razem z zamówieniem", () => {
    const z = Number(zamowienie(partner("TyreWorld"), "A1").lastInsertRowid);
    const dodaj = (lp: number) => sqlite.prepare("INSERT INTO partner_zamowienia_pozycje (zamowienie_id, lp, kod, ilosc) VALUES (?, ?, '011200284', 1)").run(z, lp);
    dodaj(1);
    expect(() => dodaj(1)).toThrow(/UNIQUE/);
    sqlite.prepare("DELETE FROM partner_zamowienia WHERE id = ?").run(z);
    expect(sqlite.prepare("SELECT count(*) AS c FROM partner_zamowienia_pozycje").get()).toEqual({ c: 0 });
  });
});
