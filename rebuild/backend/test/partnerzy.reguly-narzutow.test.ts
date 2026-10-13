/** Ticket 247: reguły narzutów partnera — silnik (jak w sklepie), API i wpływ na cenę w pliku. */
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { products } from "../src/db/schema.js";
import { wybierzRegule, type RegulaNarzutu } from "../src/partnerzy/reguly-narzutow.js";
import { wybierzPozycje, wycenPozycje } from "../src/partnerzy/selekcja.js";
import { importujTabeleGeis, ustawPaliwo } from "../src/partnerzy/transport.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const r = (id: number, nad: Partial<RegulaNarzutu> = {}): RegulaNarzutu => ({ id, kraj: null, nazwa: `R${id}`, warunki: "[]", wartosc: 10, priorytet: 50, status: "aktywny", ...nad });
const w = (typ: string, wartosc: string) => JSON.stringify([{ typ, wartosc }]);
const OPONA = { kod: "K1", nazwa: "Mitas AC85", marka: "MITAS", kategoria: "Rolnicze", dostawca: "MO1", rozmiar: "600/65R38" };

describe("wybierzRegule (zasada jak w sklepie)", () => {
  it("specyficzna bije globalną niezależnie od priorytetu; globalna jest zapasowa; brak pasującej = null", () => {
    expect(wybierzRegule([r(1, { wartosc: 5, priorytet: 99 }), r(2, { warunki: w("marka", "mitas"), wartosc: 20, priorytet: 1 })], "DE", OPONA)?.id).toBe(2);
    expect(wybierzRegule([r(1, { wartosc: 5 })], "DE", OPONA)?.id).toBe(1);
    expect(wybierzRegule([r(2, { warunki: w("marka", "bkt") })], "DE", OPONA)).toBeNull();
    expect(wybierzRegule([], "DE", OPONA)).toBeNull();
  });

  it("między specyficznymi decyduje priorytet; warunki to koniunkcja; dostawca przez równość, marka przez zawieranie", () => {
    const a = r(1, { warunki: w("marka", "mit"), priorytet: 10 });
    const b = r(2, { warunki: w("kategoria", "roln"), priorytet: 70 });
    expect(wybierzRegule([a, b], "DE", OPONA)?.id).toBe(2);
    const oba = r(3, { warunki: JSON.stringify([{ typ: "marka", wartosc: "mitas" }, { typ: "kategoria", wartosc: "osobowe" }]) });
    expect(wybierzRegule([oba], "DE", OPONA)).toBeNull();
    expect(wybierzRegule([r(4, { warunki: w("dostawca", "MO") })], "DE", OPONA)).toBeNull(); // równość, nie fragment
    expect(wybierzRegule([r(5, { warunki: w("dostawca", "mo1") })], "DE", OPONA)?.id).toBe(5);
  });

  it("kraj: reguła zawężona działa tylko w swoim kraju; remis priorytetu: kraj przed „wszystkie kraje”, potem niższe id", () => {
    const wszystkie = r(1, { warunki: w("marka", "mitas"), wartosc: 8 });
    const niemcy = r(2, { warunki: w("marka", "mitas"), wartosc: 12, kraj: "DE" });
    expect(wybierzRegule([wszystkie, niemcy], "DE", OPONA)?.id).toBe(2);
    expect(wybierzRegule([wszystkie, niemcy], "FR", OPONA)?.id).toBe(1);
    expect(wybierzRegule([r(9, { warunki: w("marka", "mitas") }), r(3, { warunki: w("marka", "mitas") })], "DE", OPONA)?.id).toBe(3);
  });

  it("nieaktywna reguła jest pomijana", () => {
    expect(wybierzRegule([r(1, { status: "nieaktywny" })], "DE", OPONA)).toBeNull();
  });
});

describe("API reguł narzutów i wycena", () => {
  let s: SrodowiskoTestowe;
  afterEach(() => s.posprzataj());
  const token = async (): Promise<string> => {
    const odp = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    return (odp.body as { token: string }).token;
  };

  it("CRUD z walidacją; reguła zmienia cenę kraju, a kraj bez reguły zostaje na narzucie kraju", async () => {
    s = await stworzSrodowiskoTestowe();
    const auth = { Authorization: `Bearer ${await token()}` };
    const id = Number((await request(s.app).post("/api/partnerzy").set(auth).send({ nazwa: "P" })).body.id);
    expect((await request(s.app).get(`/api/partnerzy/${id}/narzuty`).set(auth)).body).toEqual({ reguly: [] });

    for (const zle of [{}, { nazwa: "X", wartosc: 0 }, { nazwa: "X", wartosc: 5, kraj: "POL" }, { nazwa: "X", wartosc: 5, warunki: [{ typ: "cokolwiek", wartosc: "a" }] }, { nazwa: "X", wartosc: 5, priorytet: 1.5 }])
      expect((await request(s.app).post(`/api/partnerzy/${id}/narzuty`).set(auth).send(zle)).status).toBe(400);

    // reguła zawężona do kraju, którego partner nie ma, jest odrzucana (nigdy by nie zadziałała)
    const bezKraju = await request(s.app).post(`/api/partnerzy/${id}/narzuty`).set(auth).send({ nazwa: "Mitas w DE", wartosc: 25, kraj: "de" });
    expect(bezKraju.status).toBe(400);
    expect(bezKraju.body.error).toMatch(/nie ma kraju DE/);
    for (const k of ["DE", "FR"]) await request(s.app).put(`/api/partnerzy/${id}/kraje/${k}`).set(auth).send({ narzutProc: 10, kursZrodlo: "reczny", kursReczny: 4 });
    expect((await request(s.app).patch(`/api/partnerzy/${id}/narzuty/abc`).set(auth).send({ nazwa: "x" })).status).toBe(404);
    const nowa = await request(s.app).post(`/api/partnerzy/${id}/narzuty`).set(auth).send({ nazwa: "Mitas w DE", wartosc: 25, kraj: "de", warunki: [{ typ: "marka", wartosc: "MITAS" }] });
    expect(nowa.status).toBe(201);
    expect(nowa.body).toMatchObject({ nazwa: "Mitas w DE", kraj: "DE", priorytet: 50, status: "aktywny", warunki: [{ typ: "marka", wartosc: "MITAS" }] });

    // wycena: DE (reguła 25 %) vs FR (narzut kraju 10 %), ta sama opona
    const { db } = s;
    db.insert(products).values({
      kod: "K1", nazwa: "Mitas AC85", marka: "MITAS", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1500, marzaPct: 50,
      dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: "IMP_K1", waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85, rozmiar: "600/65R38",
    }).run();
    importujTabeleGeis(db, { DE: { wspGabarytowy: 250, stawki: [[200, 50]] }, FR: { wspGabarytowy: 250, stawki: [[200, 50]] } });
    ustawPaliwo(db, "DE", 0, "2026-01-01");
    ustawPaliwo(db, "FR", 0, "2026-01-01");
    await request(s.app).put(`/api/partnerzy/${id}/magazyny`).set(auth).send({ magazyny: ["MO1"] });
    const wyc = wycenPozycje(db, id, wybierzPozycje(db, id).pozycje, { DE: 4, FR: 4 }, "2026-10-12");
    // Wariant B (ticket 255): marża sklepu na produkcie (tu 50 %) + dopłata kraju/reguły. zakup 1000 PLN, kurs 4: DE 1000×(1+0,50+0,25)/4 + 50 = 487,5; FR 1000×(1+0,50+0,10)/4 + 50 = 450
    expect(wyc.wiersze[0]!.ceny).toEqual({ DE: 487.5, FR: 450 });

    // bez reguł te same liczby co przed zmianą: usunięcie wszystkich reguł nie zmienia ceny FR (narzut kraju 10 %)
    // PATCH (wyłączenie) → DE wraca do narzutu kraju; usunięcie → 404 przy ponownej próbie
    const patch = await request(s.app).patch(`/api/partnerzy/${id}/narzuty/${nowa.body.id}`).set(auth).send({ status: "nieaktywny" });
    expect(patch.body.status).toBe("nieaktywny");
    expect(wycenPozycje(db, id, wybierzPozycje(db, id).pozycje, { DE: 4, FR: 4 }, "2026-10-12").wiersze[0]!.ceny).toEqual({ DE: 450, FR: 450 });
    expect((await request(s.app).delete(`/api/partnerzy/${id}/narzuty/${nowa.body.id}`).set(auth)).status).toBe(200);
    expect((await request(s.app).delete(`/api/partnerzy/${id}/narzuty/${nowa.body.id}`).set(auth)).status).toBe(404);
    expect((await request(s.app).patch(`/api/partnerzy/${id}/narzuty/99999`).set(auth).send({ nazwa: "x" })).status).toBe(404);
  });

  it("kraj bez narzutu (0 %) ale z regułą pasującą do pozycji — reguła daje cenę; bez pasującej reguły pozycja nie jest publikowana", async () => {
    s = await stworzSrodowiskoTestowe();
    const auth = { Authorization: `Bearer ${await token()}` };
    const id = Number((await request(s.app).post("/api/partnerzy").set(auth).send({ nazwa: "P2" })).body.id);
    const { db } = s;
    const baza = { kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1500, marzaPct: 50, dataAktualizacji: "2026-10-10T00:00:00.000Z", waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85 };
    db.insert(products).values([{ ...baza, kod: "A", nazwa: "A", marka: "MITAS", kodImportu: "IA" }, { ...baza, kod: "B", nazwa: "B", marka: "ALLIANCE", kodImportu: "IB" }]).run();
    importujTabeleGeis(db, { DE: { wspGabarytowy: 250, stawki: [[200, 50]] } });
    ustawPaliwo(db, "DE", 0, "2026-01-01");
    await request(s.app).put(`/api/partnerzy/${id}/kraje/DE`).set(auth).send({ narzutProc: 0 });
    await request(s.app).put(`/api/partnerzy/${id}/magazyny`).set(auth).send({ magazyny: ["MO1"] });
    await request(s.app).post(`/api/partnerzy/${id}/narzuty`).set(auth).send({ nazwa: "tylko Mitas", wartosc: 20, warunki: [{ typ: "marka", wartosc: "mitas" }] });
    const wyc = wycenPozycje(db, id, wybierzPozycje(db, id).pozycje, { DE: 4 }, "2026-10-12");
    expect(wyc.wiersze.map((x) => x.ceny.DE)).toEqual([475, null]); // 1000×(1+0,50+0,20)/4 + 50; Alliance bez reguły i bez narzutu kraju → pominięta
    expect(wyc.bledy).toHaveLength(1);
  });

  it("bez reguł cena = narzut kraju, a komunikat o braku narzutu zostaje dotychczasowy; nowe pola warunków (konstrukcja, średnica) trafiają do pozycji", async () => {
    s = await stworzSrodowiskoTestowe();
    const auth = { Authorization: `Bearer ${await token()}` };
    const id = Number((await request(s.app).post("/api/partnerzy").set(auth).send({ nazwa: "P3" })).body.id);
    const { db } = s;
    db.insert(products).values({
      kod: "X", nazwa: "X", marka: "M", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1500, marzaPct: 50,
      dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: "IX", waga: 56, dlugosc: 80, szerokoscPaczki: 60, wysokosc: 85, konstrukcja: "Radial", srednica: 38,
    }).run();
    importujTabeleGeis(db, { DE: { wspGabarytowy: 250, stawki: [[200, 50]] } });
    ustawPaliwo(db, "DE", 0, "2026-01-01");
    await request(s.app).put(`/api/partnerzy/${id}/kraje/DE`).set(auth).send({ narzutProc: 0 });
    await request(s.app).put(`/api/partnerzy/${id}/magazyny`).set(auth).send({ magazyny: ["MO1"] });
    const pozycje = wybierzPozycje(db, id).pozycje;
    expect(pozycje[0]).toMatchObject({ konstrukcja: "Radial", srednica: 38 });
    const bez = wycenPozycje(db, id, pozycje, { DE: 4 }, "2026-10-12");
    expect(bez.bledy[0]!.powod).toBe("Narzut kraju nie jest ustawiony (0 %) — ceny nie są publikowane.");
    await request(s.app).put(`/api/partnerzy/${id}/kraje/DE`).set(auth).send({ narzutProc: 10 });
    expect(wycenPozycje(db, id, pozycje, { DE: 4 }, "2026-10-12").wiersze[0]!.ceny.DE).toBe(450); // 1000×(1+0,50+0,10)/4 + 50
    await request(s.app).post(`/api/partnerzy/${id}/narzuty`).set(auth).send({ nazwa: "radial 38", wartosc: 20, warunki: [{ typ: "konstrukcja", wartosc: "radi" }, { typ: "srednica", wartosc: "38" }] });
    expect(wycenPozycje(db, id, pozycje, { DE: 4 }, "2026-10-12").wiersze[0]!.ceny.DE).toBe(475); // reguła: 1000×(1+0,50+0,20)/4 + 50
  });
});
