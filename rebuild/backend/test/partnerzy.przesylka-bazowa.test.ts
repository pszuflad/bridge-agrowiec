/** Ticket 259: „przesyłka bazowa” kraju wycofana — krok wdrożenia czyści stare wartości, wycena zawsze z tabel GEIS. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { zastosujMigracje } from "../src/db/migrate.js";
import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { partnerKraje, partnerzy } from "../src/db/schema.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("zdjęcie przesyłki bazowej (ticket 259)", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-259-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "t.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("krok czyści wartości we wszystkich krajach, nie rusza reszty ustawień i biegnie raz", async () => {
    const id = Number(db.insert(partnerzy).values({ nazwa: "P", utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    db.insert(partnerKraje).values([
      { partnerId: id, kraj: "AT", narzutProc: 5, przesylkaStalaEur: 15, mytoEur: 9.92 },
      { partnerId: id, kraj: "DE", narzutProc: 7, przesylkaStalaEur: 20 },
      { partnerId: id, kraj: "FR", narzutProc: 3 },
    ]).run();
    const krok = KROKI_WDROZENIA.find((k) => k.id === "2026-10-14-partnerzy-zdjecie-przesylki-bazowej")!;
    expect(krok).toBeDefined();
    expect((await uruchomKroki(sqlite, db, [krok], {})).wykonane).toEqual([krok.id]);
    const kraje = db.select().from(partnerKraje).all();
    expect(kraje.every((k) => k.przesylkaStalaEur === null)).toBe(true);
    expect(kraje.find((k) => k.kraj === "AT")).toMatchObject({ narzutProc: 5, mytoEur: 9.92 });
    expect((await uruchomKroki(sqlite, db, [krok], {})).wykonane).toEqual([]);
  });
});
