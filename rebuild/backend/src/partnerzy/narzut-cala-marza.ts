// Ticket 275 — narzut partnera jest CAŁĄ marżą (od ceny zakupu), marża sklepu z katalogu nie jest już doliczana.
// Dotychczasowe wartości były DOPŁATAMI do marży sklepu, więc jednorazowo doliczamy do nich 6 punktów procentowych (marża sklepu wg Ani:
// 6 % + dopłata 2 % dla Niemiec = 8 %). Kraje z narzutem 0 % („jeszcze nieustawione”, ceny dla nich nie były publikowane) zostają bez zmian,
// żeby ta zmiana nie uruchomiła publikacji cen dla krajów, które nikt nie skonfigurował.

import { eq, gt, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKraje, partnerNarzuty } from "../db/schema.js";

export const MARZA_SKLEPU_PUNKTY = 6;

export function doliczMarzeSklepuDoNarzutow(db: Baza, punkty: number = MARZA_SKLEPU_PUNKTY): string {
  return db.transaction((tx) => {
    const kraje = tx
      .update(partnerKraje)
      .set({ narzutProc: sql`${partnerKraje.narzutProc} + ${punkty}` })
      .where(gt(partnerKraje.narzutProc, 0))
      .run().changes;
    const reguly = tx
      .update(partnerNarzuty)
      .set({ wartosc: sql`${partnerNarzuty.wartosc} + ${punkty}` })
      .where(gt(partnerNarzuty.wartosc, 0))
      .run().changes;
    const zera = tx.select({ n: sql<number>`count(*)` }).from(partnerKraje).where(eq(partnerKraje.narzutProc, 0)).get()?.n ?? 0;
    return `dodano ${punkty} pkt proc. do narzutów: krajów ${kraje}, reguł ${reguly}; kraje z narzutem 0 % (bez zmian): ${zera}`;
  });
}
