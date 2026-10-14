/** Ticket 266: krok zmieniający e-mail zamawiającego TyreWorld na adres zamówień. */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { partnerzy } from "../src/db/schema.js";
import { ustawEmailZamowienTyreworld } from "../src/partnerzy/dane-partnerow.js";
import { dodajPartnera } from "../src/repos/partnerzy.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const przygotuj = (email: string | null) => {
  const { sqlite, db } = otworzBaze(":memory:");
  zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  const id = dodajPartnera(db, { nazwa: "TyreWorld" })!;
  db.update(partnerzy).set({ kontaktEmail: email }).where(eq(partnerzy.id, id)).run();
  const odczyt = () => db.select().from(partnerzy).where(eq(partnerzy.id, id)).get()!.kontaktEmail;
  return { db, odczyt };
};

describe("e-mail zamówień TyreWorld (ticket 266)", () => {
  it("zamienia adres księgowości na adres zamówień", () => {
    const { db, odczyt } = przygotuj("buchhaltung@tyre-world.de");
    ustawEmailZamowienTyreworld(db);
    expect(odczyt()).toBe("bestellung@tyre-world.de");
  });
  it("nie nadpisuje adresu ustawionego ręcznie ani pustego", () => {
    const a = przygotuj("inny@tyre-world.de");
    ustawEmailZamowienTyreworld(a.db);
    expect(a.odczyt()).toBe("inny@tyre-world.de");
    const b = przygotuj(null);
    ustawEmailZamowienTyreworld(b.db);
    expect(b.odczyt()).toBeNull();
  });
});
