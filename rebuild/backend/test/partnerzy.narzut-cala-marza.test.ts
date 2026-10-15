/** Ticket 275: narzut kraju/reguły to CAŁA marża partnera od ceny zakupu — marża sklepu z katalogu nie wchodzi do wyceny; 0 % i ujemny dozwolone. */
import { afterEach, describe, expect, it } from "vitest";

import { partnerKraje, partnerMagazyny, partnerNarzuty, partnerzy, products } from "../src/db/schema.js";
import { doliczMarzeSklepuDoNarzutow } from "../src/partnerzy/narzut-cala-marza.js";
import { wybierzPozycje, wycenPozycje } from "../src/partnerzy/selekcja.js";
import { importujTabeleGeis } from "../src/partnerzy/transport.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("narzut = cała marża od ceny zakupu (ticket 275)", () => {
  let s: SrodowiskoTestowe;
  afterEach(() => s.posprzataj());

  const przygotuj = async (marzaSklepu: number, narzut: number) => {
    s = await stworzSrodowiskoTestowe();
    const { db } = s;
    const partnerId = Number(db.insert(partnerzy).values({ nazwa: "P", aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    db.insert(products).values({
      kod: "A", nazwa: "A", marka: "ALLIANCE", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1000 * (1 + marzaSklepu / 100), marzaPct: marzaSklepu,
      dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: "IA", waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85,
    }).run();
    importujTabeleGeis(db, { DE: { wspGabarytowy: 250, stawki: [[200, 1]] } }); // przesyłka = 1 EUR (paliwo 0 %)
    db.insert(partnerKraje).values({ partnerId, kraj: "DE", narzutProc: narzut }).run();
    db.insert(partnerMagazyny).values({ partnerId, magazyn: "MO1" }).run();
    return { db, partnerId };
  };
  const cenaDE = (db: SrodowiskoTestowe["db"], partnerId: number) => wycenPozycje(db, partnerId, wybierzPozycje(db, partnerId).pozycje, { DE: 1 }, "2026-10-12").wiersze[0]!.ceny.DE;

  it("cena = zakup × (1 + narzut kraju) + przesyłka; marża sklepu na produkcie nie ma wpływu", async () => {
    const { db, partnerId } = await przygotuj(6, 8);
    expect(cenaDE(db, partnerId)).toBe(1081); // 1000 × 1,08 + 1
    db.update(products).set({ marzaPct: 30 }).run();
    expect(cenaDE(db, partnerId)).toBe(1081);
    db.update(products).set({ marzaPct: 0 }).run();
    expect(cenaDE(db, partnerId)).toBe(1081);
  });

  it("reguła narzutu zastępuje narzut kraju (też jako cała marża)", async () => {
    const { db, partnerId } = await przygotuj(6, 8);
    db.insert(partnerNarzuty).values({ partnerId, kraj: "DE", nazwa: "Alliance", warunki: JSON.stringify([{ typ: "marka", wartosc: "alliance" }]), wartosc: 11, priorytet: 50, status: "aktywny", zmieniono: "x" }).run();
    expect(cenaDE(db, partnerId)).toBe(1111); // 1000 × 1,11 + 1
  });

  it("narzut 0 % daje cenę po koszcie (zakup + przesyłka), ujemny schodzi poniżej zakupu", async () => {
    const { db, partnerId } = await przygotuj(6, 0);
    const w = wycenPozycje(db, partnerId, wybierzPozycje(db, partnerId).pozycje, { DE: 1 }, "2026-10-12");
    expect(w.bledy).toEqual([]);
    expect(w.wiersze[0]!.ceny.DE).toBe(1001);
    db.update(partnerKraje).set({ narzutProc: -5 }).run();
    expect(cenaDE(db, partnerId)).toBe(951); // 1000 × 0,95 + 1
  });

  it("narzut tak ujemny, że cena wychodzi ≤ 0, nie daje ceny (błąd pozycji, nigdy cena 0)", async () => {
    const { db, partnerId } = await przygotuj(6, -100);
    const w = wycenPozycje(db, partnerId, wybierzPozycje(db, partnerId).pozycje, { DE: 1 }, "2026-10-12");
    expect(w.wiersze[0]!.ceny.DE).toBe(1); // zakup × 0 + przesyłka 1 EUR — dodatnia, więc poprawna
    db.update(partnerKraje).set({ narzutProc: -300 }).run();
    const zle = wycenPozycje(db, partnerId, wybierzPozycje(db, partnerId).pozycje, { DE: 1 }, "2026-10-12");
    expect(zle.wiersze[0]!.ceny.DE).toBeNull();
    expect(zle.bledy[0]!.powod).toMatch(/nie jest dodatni/);
  });

  it("krok wdrożenia: +6 pkt proc. do narzutów krajów i reguł większych od 0; kraj z 0 % zostaje; wynik opisuje zmiany", async () => {
    const { db, partnerId } = await przygotuj(6, 2);
    db.insert(partnerKraje).values({ partnerId, kraj: "FR", narzutProc: 0 }).run();
    db.insert(partnerNarzuty).values({ partnerId, kraj: "DE", nazwa: "Alliance", warunki: "[]", wartosc: 3, priorytet: 50, status: "aktywny", zmieniono: "x" }).run();
    const opis = doliczMarzeSklepuDoNarzutow(db);
    expect(opis).toMatch(/krajów 1, reguł 1/);
    const kraje = db.select().from(partnerKraje).all();
    expect(kraje.find((k) => k.kraj === "DE")!.narzutProc).toBe(8); // marża sklepu 6 % + dopłata 2 %
    expect(kraje.find((k) => k.kraj === "FR")!.narzutProc).toBe(0);
    expect(db.select().from(partnerNarzuty).all()[0]!.wartosc).toBe(9);
  });
});
