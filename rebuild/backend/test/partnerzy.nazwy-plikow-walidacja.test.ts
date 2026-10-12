/** Ticket 235: walidacja `nazwaPliku` i `przesylkaStalaEur`, `ostatniKurs` w szczegółach, czyszczenie archiwum ze starymi nazwami. */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { wyczyscArchiwum } from "../src/partnerzy/generator.js";
import { zapiszUzytyKurs } from "../src/partnerzy/kurs-nbp.js";
import { ustawPaliwo } from "../src/partnerzy/transport.js";
import { czyBlad, szczegolyPartnera, ustawKraj, walidujUstawieniaKraju, walidujUstawieniaPartnera } from "../src/repos/partnerzy.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("ticket 235 — walidacja i szczegóły", () => {
  it("nazwaPliku: dozwolone litery/cyfry/_/-, null; ścieżki i rozszerzenia odrzucone", () => {
    expect(walidujUstawieniaPartnera({ nazwaPliku: "adtyres_agrowiec" }, true)).toEqual({ nazwaPliku: "adtyres_agrowiec" });
    expect(walidujUstawieniaPartnera({ nazwaPliku: null }, true)).toEqual({ nazwaPliku: null });
    for (const zla of ["../x", "a/b", "a.csv", "", " ", "a".repeat(61), 5])
      expect(czyBlad(walidujUstawieniaPartnera({ nazwaPliku: zla }, true))).toBe(true);
  });

  it("dane do faktury: opcjonalne teksty, kraj dwuliterowy wielkimi literami, null czyści", () => {
    expect(walidujUstawieniaPartnera({ fakturaNazwa: " Firma ", fakturaKraj: "pl", fakturaNip: null }, true)).toEqual({ fakturaNazwa: "Firma", fakturaKraj: "PL", fakturaNip: null });
    for (const zle of [{ fakturaNazwa: "" }, { fakturaNip: 5 }, { fakturaKraj: "POL" }, { fakturaMiasto: "x".repeat(121) }])
      expect(czyBlad(walidujUstawieniaPartnera(zle, true))).toBe(true);
  });

  it("kraj: myto i pakowanie (≥ 0, domyślnie 0) oraz opcjonalne paliwo 0–1000 %", () => {
    expect(walidujUstawieniaKraju({})).toMatchObject({ mytoEur: 0, pakowanieEur: 0, paliwoProc: null });
    expect(walidujUstawieniaKraju({ mytoEur: 9.92, pakowanieEur: 15, paliwoProc: 44 })).toMatchObject({ mytoEur: 9.92, pakowanieEur: 15, paliwoProc: 44 });
    for (const zle of [{ mytoEur: -1 }, { pakowanieEur: "5" }, { paliwoProc: -1 }, { paliwoProc: 1001 }]) expect(czyBlad(walidujUstawieniaKraju(zle))).toBe(true);
  });

  it("przesylkaStalaEur: liczba ≥ 0 albo null (domyślnie null)", () => {
    expect(walidujUstawieniaKraju({})).toMatchObject({ przesylkaStalaEur: null });
    expect(walidujUstawieniaKraju({ przesylkaStalaEur: 15 })).toMatchObject({ przesylkaStalaEur: 15 });
    expect(czyBlad(walidujUstawieniaKraju({ przesylkaStalaEur: -1 }))).toBe(true);
    expect(czyBlad(walidujUstawieniaKraju({ przesylkaStalaEur: "15" }))).toBe(true);
  });

  describe("z bazą", () => {
    let katalog: string;
    let sqlite: BazaSqlite;
    let db: ReturnType<typeof otworzBaze>["db"];
    beforeEach(() => {
      katalog = mkdtempSync(join(tmpdir(), "bridge-235-"));
      ({ sqlite, db } = otworzBaze(join(katalog, "t.db")));
      zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    });
    afterEach(() => {
      sqlite.close();
      rmSync(katalog, { recursive: true, force: true });
    });

    it("szczegóły: ostatniKurs per kraj (najnowszy wpis) albo null", () => {
      const id = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES ('P', 'x', 'x')").run().lastInsertRowid);
      sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj, narzut_proc) VALUES (?, 'FR', 12), (?, 'DE', 12)").run(id, id);
      zapiszUzytyKurs(db, { partnerId: id, kraj: "FR", kurs: { kurs: 4.2, zrodlo: "nbp", dataTabeli: null, ostrzezenie: null } }, () => new Date("2026-10-10T10:00:00Z"));
      zapiszUzytyKurs(db, { partnerId: id, kraj: "FR", kurs: { kurs: 4.3, zrodlo: "nbp", dataTabeli: null, ostrzezenie: null } }, () => new Date("2026-10-11T10:00:00Z"));
      const k = szczegolyPartnera(db, id)!.kraje;
      expect(k.find((x) => x.kraj === "FR")!.ostatniKurs).toMatchObject({ kurs: 4.3, zrodlo: "nbp" });
      expect(k.find((x) => x.kraj === "DE")!.ostatniKurs).toBeNull();
    });

    it("PUT kraju zapisuje paliwo w historii, a szczegóły partnera oddają bieżące paliwo kraju", () => {
      const id = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES ('P2', 'x', 'x')").run().lastInsertRowid);
      ustawKraj(db, id, "FR", { narzutProc: 12, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 0, przesylkaStalaEur: 50, mytoEur: 9.92, pakowanieEur: 15 });
      ustawPaliwo(db, "FR", 44, "2026-01-01");
      const fr = szczegolyPartnera(db, id)!.kraje.find((k) => k.kraj === "FR")!;
      expect(fr).toMatchObject({ paliwoProc: 44, mytoEur: 9.92, pakowanieEur: 15 });
    });

    it("czyszczenie archiwum: stare kopie z godziną i nowe z samą datą wygasają po 30 dniach od daty", () => {
      const arch = join(katalog, "arch");
      mkdirSync(arch);
      for (const n of ["20260901_120000_stary.csv", "20260901_stary.csv", "20261009_120000_swiezy.csv", "20261009_swiezy.csv"]) writeFileSync(join(arch, n), "x");
      expect(wyczyscArchiwum(arch, new Date("2026-10-10T12:00:00Z"))).toBe(2);
      expect(readdirSync(arch).sort()).toEqual(["20261009_120000_swiezy.csv", "20261009_swiezy.csv"]);
    });
  });
});
