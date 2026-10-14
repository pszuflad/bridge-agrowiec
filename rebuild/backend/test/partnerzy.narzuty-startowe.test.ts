/** Ticket 258: krok wdrożenia z narzutami startowymi partnerów — uzupełnia tylko to, czego brak; reguły wskazują KODY dostawców. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { zastosujMigracje } from "../src/db/migrate.js";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { partnerKraje, partnerNarzuty, partnerzy, suppliers } from "../src/db/schema.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { wybierzRegule } from "../src/partnerzy/reguly-narzutow.js";
import { ustawNarzutyStartowe } from "../src/partnerzy/narzuty-startowe.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("narzuty startowe partnerów (ticket 258)", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  const dostawcy: [string, string][] = [["MO1", "Bohnenkamp"], ["MO2", "JMK"], ["MO3", "Grasdorf (kolarolnicze.pl)"], ["MO5", "Handlopex Rzeszów"]];
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-258-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "t.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    for (const [kod, nazwa] of dostawcy) db.insert(suppliers).values({ kod, nazwa, formatPliku: "csv", sposobDostarczania: "mail" }).run();
    const wstaw = (nazwa: string) => Number(db.insert(partnerzy).values({ nazwa, aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    const ad = wstaw("Adtyres");
    const tw = wstaw("TyreWorld");
    db.insert(partnerKraje).values(["DE", "AT", "PL"].map((kraj) => ({ partnerId: ad, kraj }))).run();
    db.insert(partnerKraje).values(["DE", "FR"].map((kraj) => ({ partnerId: tw, kraj }))).run();
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const kraje = () => db.select().from(partnerKraje).all();
  const reguly = (nazwa: string) => {
    const id = db.select().from(partnerzy).all().find((p) => p.nazwa === nazwa)!.id;
    return db.select().from(partnerNarzuty).all().filter((r) => r.partnerId === id);
  };

  it("ustawia 5 % w krajach z 0 %, nie zakłada nowych krajów i dodaje reguły z KODAMI dostawców", () => {
    ustawNarzutyStartowe(db);
    expect(kraje().filter((k) => k.kraj !== "PL").every((k) => k.narzutProc === 5)).toBe(true);
    expect(kraje().find((k) => k.kraj === "PL")!.narzutProc).toBe(0); // spoza listy starego panelu
    expect(kraje()).toHaveLength(5);
    const ad = reguly("Adtyres");
    expect(ad).toHaveLength(3);
    expect(ad.map((r) => r.wartosc)).toEqual([2, 2, 2]);
    expect(JSON.parse(ad[0]!.warunki)).toEqual([{ typ: "dostawca", wartosc: "MO2" }, { typ: "kategoria", wartosc: "Rolnicze" }, { typ: "marka", wartosc: "ALLIANCE" }]);
    const tw = reguly("TyreWorld");
    expect(tw).toHaveLength(4);
    expect(JSON.parse(tw[3]!.warunki)).toEqual([{ typ: "dostawca", wartosc: "MO5" }, { typ: "kategoria", wartosc: "Rolnicze" }, { typ: "marka", wartosc: "VREDESTEIN" }]);
    expect(tw[3]).toMatchObject({ kraj: "DE", wartosc: 3, status: "aktywny" });
  });

  it("reguły naprawdę łapią pozycje (Alliance z JMK w Niemczech → 2 %, w Austrii i u innej marki → narzut kraju)", () => {
    ustawNarzutyStartowe(db);
    const r = reguly("Adtyres").map((x) => ({ ...x }));
    const poz = (dostawca: string, marka: string) => ({ dostawca, marka, kategoria: "Rolnicze", kod: "x", nazwa: "x" }) as never;
    expect(wybierzRegule(r, "DE", poz("MO2", "Alliance"))?.wartosc).toBe(2);
    expect(wybierzRegule(r, "DE", poz("MO1", "Ceat"))?.wartosc).toBe(2);
    expect(wybierzRegule(r, "DE", poz("MO2", "Ceat"))).toBeNull();
    expect(wybierzRegule(r, "AT", poz("MO2", "Alliance"))).toBeNull();
  });

  it("niczego nie nadpisuje: ręczny narzut kraju i istniejąca reguła zostają, powtórka nic nie zmienia", () => {
    db.update(partnerKraje).set({ narzutProc: 7 }).where(eqKraj("AT")).run();
    ustawNarzutyStartowe(db);
    expect(kraje().find((k) => k.kraj === "AT" && k.narzutProc === 7)).toBeTruthy();
    const przed = JSON.stringify([kraje(), db.select().from(partnerNarzuty).all()]);
    ustawNarzutyStartowe(db);
    expect(JSON.stringify([kraje(), db.select().from(partnerNarzuty).all()])).toBe(przed);
  });

  it("nie dubluje ręcznie dodanej reguły o tych samych warunkach", () => {
    const ad = db.select().from(partnerzy).all().find((p) => p.nazwa === "Adtyres")!.id;
    db.insert(partnerNarzuty).values({ partnerId: ad, kraj: "DE", nazwa: "moja", warunki: JSON.stringify([{ typ: "dostawca", wartosc: "MO2" }, { typ: "kategoria", wartosc: "Rolnicze" }, { typ: "marka", wartosc: "ALLIANCE" }]), wartosc: 4, zmieniono: "x" }).run();
    ustawNarzutyStartowe(db);
    expect(reguly("Adtyres")).toHaveLength(3);
    expect(reguly("Adtyres").find((r) => r.nazwa === "moja")!.wartosc).toBe(4);
  });

  it("odkłada krok bez żadnego zapisu, gdy nie rozpozna dostawcy", () => {
    db.delete(suppliers).where(eqKod("MO5")).run();
    const w = ustawNarzutyStartowe(db);
    expect(w).toEqual({ odloz: expect.stringContaining("Handlopex Rzeszów") });
    expect(db.select().from(partnerNarzuty).all()).toHaveLength(0);
    expect(kraje().every((k) => k.narzutProc === 0)).toBe(true);
  });

  it("jest w rejestrze kroków na końcu i zapisuje wynik", async () => {
    const krok = KROKI_WDROZENIA.find((k) => k.id === "2026-10-13-partnerzy-narzuty-startowe")!;
    expect(krok).toBeDefined();
    expect((await uruchomKroki(sqlite, db, [krok], {})).wykonane).toEqual([krok.id]);
    expect((await uruchomKroki(sqlite, db, [krok], {})).wykonane).toEqual([]);
    expect(reguly("TyreWorld")).toHaveLength(4);
  });
});

import { eq } from "drizzle-orm";
const eqKraj = (k: string) => eq(partnerKraje.kraj, k);
const eqKod = (k: string) => eq(suppliers.kod, k);
