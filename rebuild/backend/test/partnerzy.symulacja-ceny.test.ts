/** Ticket 273: symulacja ceny na prawdziwych produktach z rozbiciem składników. */
import { afterEach, describe, expect, it } from "vitest";

import { partnerKraje, partnerMagazyny, partnerNarzuty, partnerzy, products } from "../src/db/schema.js";
import type { KlientNbp } from "../src/partnerzy/kurs-nbp.js";
import { symulujCeny } from "../src/partnerzy/symulacja-ceny.js";
import { importujTabeleGeis } from "../src/partnerzy/transport.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const nbp: KlientNbp = { pobierzKursEur: async () => ({ kurs: 4, data: "2026-10-12" }) };
const TERAZ = () => new Date("2026-10-14T12:00:00Z");

describe("symulacja ceny partnera", () => {
  let s: SrodowiskoTestowe;
  afterEach(() => s.posprzataj());

  const przygotuj = async (opcje: { waga?: number | null; doplata?: number } = {}) => {
    s = await stworzSrodowiskoTestowe();
    const { db } = s;
    const partnerId = Number(db.insert(partnerzy).values({ nazwa: "P", aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    const baza = { marka: "ALLIANCE", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, dataAktualizacji: "2026-10-10T00:00:00.000Z", szerokoscPaczki: 60, wysokosc: 85, dlugosc: 80 };
    db.insert(products).values([
      { ...baza, kod: "A", nazwa: "Opona A", cenaZakupu: 1000, cenaSprzedazy: 1060, marzaPct: 6, kodImportu: "IA", waga: opcje.waga === undefined ? 56 : opcje.waga },
      { ...baza, kod: "B", nazwa: "Opona B", cenaZakupu: 500, cenaSprzedazy: 530, marzaPct: 6, kodImportu: "IB", waga: 40 },
    ]).run();
    importujTabeleGeis(db, { DE: { wspGabarytowy: 250, kosztPakowania: 0, stawki: [[200, 1]] } });
    db.insert(partnerKraje).values({ partnerId, kraj: "DE", narzutProc: opcje.doplata ?? 8, mytoEur: 0, pakowanieEur: 0 }).run();
    db.insert(partnerMagazyny).values({ partnerId, magazyn: "MO1" }).run();
    return { db, partnerId };
  };

  it("rozbija cenę na składniki: zakup, narzut (cała marża), przesyłka GEIS, kurs; cena = zakup×(1+narzut)/kurs + przesyłka", async () => {
    const { db, partnerId } = await przygotuj();
    const w = await symulujCeny(db, nbp, partnerId, { kraj: "de", teraz: TERAZ });
    expect(w.kraj).toBe("DE");
    expect(w.kurs).toMatchObject({ kurs: 4 });
    const a = w.wiersze.find((r) => r.kod === "A")!;
    expect(a).toMatchObject({ zakupPln: 1000, narzutProc: 8, zrodloNarzutu: "kraj", kosztyDodatkoweEur: 0 });
    expect(a.przesylka).toMatchObject({ stawkaEur: 1, paliwoProc: 0, razemEur: 1, progKg: 200 });
    expect(a.cenaEur).toBe(271); // 1000 × 1,08 / 4 + 1
    expect(a.blad).toBeNull();
  });

  it("reguła narzutu zastępuje narzut kraju i jest nazwana w rozbiciu", async () => {
    const { db, partnerId } = await przygotuj();
    db.insert(partnerNarzuty).values({ partnerId, kraj: "DE", nazwa: "Alliance", warunki: JSON.stringify([{ typ: "marka", wartosc: "alliance" }]), wartosc: 11, priorytet: 50, status: "aktywny", zmieniono: "x" }).run();
    const w = await symulujCeny(db, nbp, partnerId, { kraj: "DE", kody: ["A"], teraz: TERAZ });
    expect(w.wiersze).toHaveLength(1);
    expect(w.wiersze[0]).toMatchObject({ narzutProc: 11, zrodloNarzutu: "reguła „Alliance”" });
    expect(w.wiersze[0]!.cenaEur).toBe(278.5); // 1000 × 1,11 / 4 + 1
  });

  it("pozycja bez wagi nie dostaje ceny i ma powód; narzut 0 % daje cenę po koszcie", async () => {
    const { db, partnerId } = await przygotuj({ waga: null });
    const w = await symulujCeny(db, nbp, partnerId, { kraj: "DE", teraz: TERAZ });
    const a = w.wiersze.find((r) => r.kod === "A")!;
    expect(a.cenaEur).toBeNull();
    expect(a.blad).toMatch(/Brak wagi/);
    expect(a.przesylka).toBeNull();
    expect(w.wiersze.find((r) => r.kod === "B")!.cenaEur).not.toBeNull();
    const zero = await przygotuj({ doplata: 0 });
    const w0 = await symulujCeny(zero.db, nbp, zero.partnerId, { kraj: "DE", teraz: TERAZ });
    expect(w0.wiersze[0]!.cenaEur).toBe(251); // 1000 / 4 + 1 EUR przesyłki
    expect(w0.wiersze[0]!.blad).toBeNull();
  });

  it("nieznany kraj partnera → błąd; limit próbkuje całą ofertę", async () => {
    const { db, partnerId } = await przygotuj();
    await expect(symulujCeny(db, nbp, partnerId, { kraj: "FR", teraz: TERAZ })).rejects.toThrow(/nie ma kraju FR/);
    const w = await symulujCeny(db, nbp, partnerId, { kraj: "DE", limit: 1, teraz: TERAZ });
    expect(w.wiersze).toHaveLength(1);
    expect(w.pozycjeWybrane).toBe(2);
  });
});
