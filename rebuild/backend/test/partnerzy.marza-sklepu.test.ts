/** Ticket 255 (wariant B, decyzja użytkowniczki 2026-10-13): cena partnera = zakup × (1 + marża sklepu na produkcie + dopłata kraju/reguły), jak w starym systemie. */
import { afterEach, describe, expect, it } from "vitest";

import { partnerKraje, partnerMagazyny, partnerNarzuty, partnerzy, products } from "../src/db/schema.js";
import { wybierzPozycje, wycenPozycje } from "../src/partnerzy/selekcja.js";
import { importujTabeleGeis } from "../src/partnerzy/transport.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("marża sklepu + dopłata kraju (wariant B)", () => {
  let s: SrodowiskoTestowe;
  afterEach(() => s.posprzataj());

  const przygotuj = async (marzaSklepu: number, doplata: number) => {
    s = await stworzSrodowiskoTestowe();
    const { db } = s;
    const partnerId = Number(db.insert(partnerzy).values({ nazwa: "P", aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    db.insert(products).values({
      kod: "A", nazwa: "A", marka: "ALLIANCE", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1000 * (1 + marzaSklepu / 100), marzaPct: marzaSklepu,
      dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: "IA", waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85,
    }).run();
    importujTabeleGeis(db, { DE: { wspGabarytowy: 250, stawki: [[200, 1]] } }); // przesyłka = 1 EUR (paliwo 0 %)
    db.insert(partnerKraje).values({ partnerId, kraj: "DE", narzutProc: doplata }).run();
    db.insert(partnerMagazyny).values({ partnerId, magazyn: "MO1" }).run();
    return { db, partnerId };
  };
  const cenaDE = (db: SrodowiskoTestowe["db"], partnerId: number) => wycenPozycje(db, partnerId, wybierzPozycje(db, partnerId).pozycje, { DE: 1 }, "2026-10-12").wiersze[0]!.ceny.DE;

  it("przykład użytkowniczki: marża sklepu 6 % + dopłata 2 % = 8 % od zakupu (kurs 1, przesyłka 1 EUR z tabeli GEIS)", async () => {
    const { db, partnerId } = await przygotuj(6, 2);
    expect(cenaDE(db, partnerId)).toBe(1081);
  });

  it("zmiana marży sklepu przesuwa cenę partnera (dopłata zostaje), a produkt bez marży sklepu dostaje samą dopłatę", async () => {
    const { db, partnerId } = await przygotuj(6, 4);
    expect(cenaDE(db, partnerId)).toBe(1101);
    db.update(products).set({ marzaPct: 10 }).run();
    expect(cenaDE(db, partnerId)).toBe(1141);
    db.update(products).set({ marzaPct: 0 }).run();
    expect(cenaDE(db, partnerId)).toBe(1041);
  });

  it("reguła narzutu partnera to też dopłata do marży sklepu", async () => {
    const { db, partnerId } = await przygotuj(6, 2);
    db.insert(partnerNarzuty).values({ partnerId, kraj: "DE", nazwa: "Alliance", warunki: JSON.stringify([{ typ: "marka", wartosc: "alliance" }]), wartosc: 5, priorytet: 50, status: "aktywny", zmieniono: "x" }).run();
    expect(cenaDE(db, partnerId)).toBe(1111); // 1000 × (1 + 0,06 + 0,05)
  });

  it("dopłata 0 nadal blokuje publikację (zabezpieczenie przed wypuszczeniem cen sklepu), mimo marży sklepu", async () => {
    const { db, partnerId } = await przygotuj(6, 0);
    const w = wycenPozycje(db, partnerId, wybierzPozycje(db, partnerId).pozycje, { DE: 1 }, "2026-10-12");
    expect(w.wiersze[0]!.ceny.DE).toBeNull();
    expect(w.bledy[0]!.powod).toMatch(/Narzut kraju nie jest ustawiony/);
  });
});
