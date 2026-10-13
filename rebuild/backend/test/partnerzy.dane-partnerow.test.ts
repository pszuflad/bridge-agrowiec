/** Ticket 253: krok wdrożenia z danymi do faktury partnerów — uzupełnia tylko puste pola, nie wpisuje niepewnych numerów VAT. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { zastosujMigracje } from "../src/db/migrate.js";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { partnerKraje, partnerzy } from "../src/db/schema.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { ADTYRES_VAT_WG_KRAJU, uzupelnijDanePartnerow } from "../src/partnerzy/dane-partnerow.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("dane partnerów (ticket 253)", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-253-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "t.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const wstaw = (nazwa: string) => Number(db.insert(partnerzy).values({ nazwa, aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    const ad = wstaw("Adtyres");
    wstaw("TyreWorld");
    db.insert(partnerKraje).values(["AT", "LT", "NL", "SK"].map((kraj) => ({ partnerId: ad, kraj }))).run();
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const partner = (nazwa: string) => db.select().from(partnerzy).all().find((p) => p.nazwa === nazwa)!;
  const kraj = (k: string) => db.select().from(partnerKraje).all().find((r) => r.kraj === k)!;

  it("TyreWorld: dane do faktury, e-mail i VAT 101; Adtyres: siedziba bez NIP-u domyślnego i dane wg kraju z numerem VAT UE (także LT, NL)", () => {
    uzupelnijDanePartnerow(db);
    expect(partner("TyreWorld")).toMatchObject({ fakturaNazwa: "B. Fuhrmann Einzelhandel GmbH", fakturaNip: "DE254343915", fakturaKod: "44149", fakturaKraj: "DE", kontaktEmail: "buchhaltung@tyre-world.de", sellyVatId: 101, kontaktTelefon: null });
    expect(partner("Adtyres")).toMatchObject({ fakturaNazwa: "AD Tyres International SLU", fakturaNip: null, fakturaKraj: "AD", kontaktEmail: "bill@adtyre.com", sellyVatId: 101 });
    expect(kraj("AT")).toMatchObject({ fakturaNazwa: "AD Tyres International SLU", fakturaNip: "ATU71690869", fakturaKod: "AD500", fakturaKraj: "AD" });
    expect(kraj("SK").fakturaNip).toBe("SK4120053949");
    expect(kraj("LT")).toMatchObject({ fakturaNazwa: "AD Tyres International SLU", fakturaNip: "LT100010434310" });
    expect(kraj("NL").fakturaNip).toBe("NL824295304B01");
  });

  it("niczego nie nadpisuje: ręcznie ustawione pola partnera i kraju zostają, powtórne uruchomienie nic nie zmienia", () => {
    const ad = partner("Adtyres").id;
    db.update(partnerzy).set({ kontaktEmail: "reczny@adtyre.example", sellyVatId: 5, fakturaNazwa: "Ręczna nazwa" }).where(eq(partnerzy.id, ad)).run();
    db.update(partnerKraje).set({ fakturaNazwa: "Własna spółka AT", fakturaNip: "ATU00000000" }).where(eq(partnerKraje.kraj, "AT")).run();
    uzupelnijDanePartnerow(db);
    expect(partner("Adtyres")).toMatchObject({ kontaktEmail: "reczny@adtyre.example", sellyVatId: 5, fakturaNazwa: "Ręczna nazwa", fakturaKod: "AD500" });
    expect(kraj("AT")).toMatchObject({ fakturaNazwa: "Własna spółka AT", fakturaNip: "ATU00000000" });
    const przed = JSON.stringify([db.select().from(partnerzy).all(), db.select().from(partnerKraje).all()]);
    uzupelnijDanePartnerow(db);
    expect(JSON.stringify([db.select().from(partnerzy).all(), db.select().from(partnerKraje).all()])).toBe(przed);
  });

  it("numery VAT mają prefiks swojego kraju (ochrona przed literówką w tabeli)", () => {
    for (const [k, nip] of Object.entries(ADTYRES_VAT_WG_KRAJU)) expect(nip.startsWith(k)).toBe(true);
  });

  it("krok z rejestru biegnie raz przez runner", async () => {
    const krok = KROKI_WDROZENIA.find((k) => k.id === "2026-10-13-partnerzy-dane-faktury")!;
    expect(krok).toBeDefined();
    const w1 = await uruchomKroki(sqlite, db, [krok], {});
    expect(w1.wykonane).toEqual([krok.id]);
    const w2 = await uruchomKroki(sqlite, db, [krok], {});
    expect(w2.wykonane).toEqual([]);
    expect(partner("TyreWorld").fakturaNip).toBe("DE254343915");
  });

  it("kroki są dwa: drugi (dopełnienie numerów VAT) po pierwszym niczego nie psuje, a dopełnia kraj, który w pierwszym biegu nie miał danych", async () => {
    const pierwszy = KROKI_WDROZENIA.find((k) => k.id === "2026-10-13-partnerzy-dane-faktury")!;
    const drugi = KROKI_WDROZENIA.find((k) => k.id === "2026-10-13-partnerzy-numery-vat-adtyres")!;
    expect(drugi).toBeDefined();
    await uruchomKroki(sqlite, db, [pierwszy], {});
    db.update(partnerKraje).set({ fakturaNazwa: null, fakturaNip: null }).where(eq(partnerKraje.kraj, "LT")).run(); // jak na produkcji sprzed uzupełnienia
    const w = await uruchomKroki(sqlite, db, [pierwszy, drugi], {});
    expect(w.wykonane).toEqual([drugi.id]);
    expect(kraj("LT").fakturaNip).toBe("LT100010434310");
  });

  it("brak partnerów: krok się kończy bez błędu", () => {
    db.delete(partnerzy).run();
    expect(uzupelnijDanePartnerow(db)).toMatch(/nic do uzupełnienia/);
  });
});
