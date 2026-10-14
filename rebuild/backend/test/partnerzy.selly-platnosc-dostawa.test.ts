/** Ticket 269: ID płatności i dostawy Selly dla partnerów. */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { partnerzy } from "../src/db/schema.js";
import { ustawPlatnoscIDostaweSelly } from "../src/partnerzy/dane-partnerow.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const baza = () => {
  const { sqlite, db } = otworzBaze(":memory:");
  zastosujMigracje(sqlite, KATALOG_SCHEMATU());
  return db;
};
const dodaj = (db: ReturnType<typeof baza>, nazwa: string, pola: { sellyPaymentId: number | null; sellyDeliveryId: number | null }) =>
  Number(db.insert(partnerzy).values({ nazwa, aktywny: true, utworzono: "x", zmieniono: "x", ...pola }).run().lastInsertRowid);
const odczyt = (db: ReturnType<typeof baza>, id: number) => db.select().from(partnerzy).where(eq(partnerzy.id, id)).get()!;

describe("płatność i dostawa Selly (ticket 269)", () => {
  it("zastępuje znane błędne wartości (10, 101) i uzupełnia puste, ręcznych nie rusza", () => {
    const db = baza();
    const a = dodaj(db, "Adtyres", { sellyPaymentId: 10, sellyDeliveryId: 101 });
    const t = dodaj(db, "TyreWorld", { sellyPaymentId: null, sellyDeliveryId: null });
    const inny = dodaj(db, "Inny", { sellyPaymentId: 10, sellyDeliveryId: 101 });
    const r = dodaj(db, "Ręczny", { sellyPaymentId: 7, sellyDeliveryId: 8 });
    ustawPlatnoscIDostaweSelly(db, 1, 209);
    expect(odczyt(db, a)).toMatchObject({ sellyPaymentId: 1, sellyDeliveryId: 209 });
    expect(odczyt(db, t)).toMatchObject({ sellyPaymentId: 1, sellyDeliveryId: 209 });
    expect(odczyt(db, inny)).toMatchObject({ sellyPaymentId: 10, sellyDeliveryId: 101 });
    expect(odczyt(db, r)).toMatchObject({ sellyPaymentId: 7, sellyDeliveryId: 8 });
  });

  it("wartość ustawiona ręcznie u Adtyres (np. 5) zostaje", () => {
    const db = baza();
    const a = dodaj(db, "Adtyres", { sellyPaymentId: 5, sellyDeliveryId: 6 });
    ustawPlatnoscIDostaweSelly(db, 1, 209);
    expect(odczyt(db, a)).toMatchObject({ sellyPaymentId: 5, sellyDeliveryId: 6 });
  });
});
