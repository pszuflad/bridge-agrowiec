/** Kolumny, pola obliczeniowe i podgląd partnera (ticket 223, PRT-5.3a). */
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { products } from "../src/db/schema.js";
import type { KlientNbp } from "../src/partnerzy/kurs-nbp.js";
import { stworzSerwisPartnerow } from "../src/partnerzy/scheduler.js";
import { importujTabeleGeis } from "../src/partnerzy/transport.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const NBP: KlientNbp = { pobierzKursEur: async () => ({ kurs: 4.3, data: "2026-10-09" }) };

describe("kolumny, pola obliczeniowe i podgląd", () => {
  let s: SrodowiskoTestowe;
  let token: string;
  let katalog: string;
  let id: number;

  beforeEach(async () => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-podglad-"));
    s = await stworzSrodowiskoTestowe(undefined, { serwisPartnerow: undefined });
    token = ((await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo })).body as { token: string }).token;
    id = ((await put("POST", "/api/partnerzy", { nazwa: "P" })).body as { id: number }).id;
    await put("PUT", `/api/partnerzy/${id}/kraje/AT`, { narzutProc: 10 });
  });
  afterEach(() => {
    s.posprzataj();
    rmSync(katalog, { recursive: true, force: true });
  });

  const put = (metoda: "PUT" | "POST", u: string, cialo: object) => {
    const r = request(s.app)[metoda === "PUT" ? "put" : "post"](u).set("Authorization", `Bearer ${token}`);
    return r.send(cialo);
  };
  const get = (u: string) => request(s.app).get(u).set("Authorization", `Bearer ${token}`);

  describe("pola obliczeniowe", () => {
    it("wymaga logowania i istniejącego partnera", async () => {
      expect((await request(s.app).put(`/api/partnerzy/${id}/pola-obliczeniowe`).send({ pola: [] })).status).toBe(401);
      expect((await put("PUT", "/api/partnerzy/99/pola-obliczeniowe", { pola: [] })).status).toBe(404);
    });

    it("zapisuje poprawne formuły (zmienne katalogu i cena_<KRAJ>) i oddaje je w szczegółach", async () => {
      const odp = await put("PUT", `/api/partnerzy/${id}/pola-obliczeniowe`, { pola: [{ nazwa: "CenaDAP", formula: "cena_AT * 1.1 + stan" }] });
      expect(odp.status).toBe(200);
      expect(odp.body.polaObliczeniowe).toEqual([expect.objectContaining({ nazwa: "CenaDAP", formula: "cena_AT * 1.1 + stan" })]);
    });

    it("odrzuca błędy z pozycją znaku: składnia, nieznana zmienna (też cudzy kraj), zła i powtórzona nazwa", async () => {
      const odp = await put("PUT", `/api/partnerzy/${id}/pola-obliczeniowe`, {
        pola: [{ nazwa: "A", formula: "zakup *" }, { nazwa: "B", formula: "cena_DE + 1" }, { nazwa: "9zla", formula: "1" }, { nazwa: "ok", formula: "1" }, { nazwa: "OK", formula: "2" }],
      });
      expect(odp.status).toBe(400);
      const bledy = odp.body.bledy as { indeks: number; komunikat: string; pozycja: number | null }[];
      expect(bledy.map((b) => b.indeks)).toEqual([0, 1, 2, 4]);
      expect(bledy[0]).toMatchObject({ pozycja: 7 });
      expect(bledy[1]!.komunikat).toMatch(/Nieznana zmienna „cena_DE”/);
      expect(bledy[3]!.komunikat).toMatch(/więcej niż raz/);
    });

    it("pole używane przez kolumnę nie może zniknąć (409)", async () => {
      await put("PUT", `/api/partnerzy/${id}/pola-obliczeniowe`, { pola: [{ nazwa: "P1", formula: "stan" }] });
      await put("PUT", `/api/partnerzy/${id}/kolumny`, { kolumny: [{ nazwaWPliku: "X", zrodloTyp: "pole", zrodlo: "P1" }] });
      const odp = await put("PUT", `/api/partnerzy/${id}/pola-obliczeniowe`, { pola: [] });
      expect(odp.status).toBe(409);
      expect(odp.body.error).toMatch(/używane przez kolumnę „X”/);
    });
  });

  describe("kolumny", () => {
    it("zastępuje zestaw w podanej kolejności (pozycje 1…n)", async () => {
      await put("PUT", `/api/partnerzy/${id}/kolumny`, { kolumny: [{ nazwaWPliku: "Stare", zrodloTyp: "katalog", zrodlo: "kod" }] });
      const odp = await put("PUT", `/api/partnerzy/${id}/kolumny`, { kolumny: [{ nazwaWPliku: "Cena", zrodloTyp: "cena", zrodlo: "AT" }, { nazwaWPliku: "Kod", zrodloTyp: "katalog", zrodlo: "kod" }] });
      expect(odp.status).toBe(200);
      expect(odp.body.kolumny.map((k: { pozycja: number; nazwaWPliku: string }) => [k.pozycja, k.nazwaWPliku])).toEqual([[1, "Cena"], [2, "Kod"]]);
    });

    it.each([
      [{ nazwaWPliku: "", zrodloTyp: "katalog", zrodlo: "kod" }, /nazwa w pliku/],
      [{ nazwaWPliku: "X", zrodloTyp: "katalog", zrodlo: "haslo_hash" }, /nieznane pole katalogu/],
      [{ nazwaWPliku: "X", zrodloTyp: "cena", zrodlo: "DE" }, /nie ma kraju/],
      [{ nazwaWPliku: "X", zrodloTyp: "pole", zrodlo: "brak" }, /brak pola obliczeniowego/],
      [{ nazwaWPliku: "X", zrodloTyp: "inny", zrodlo: "kod" }, /typ źródła/],
    ])("odrzuca błędną kolumnę %j", async (kolumna, komunikat) => {
      const odp = await put("PUT", `/api/partnerzy/${id}/kolumny`, { kolumny: [kolumna] });
      expect(odp.status).toBe(400);
      expect(odp.body.error).toMatch(komunikat);
    });

    it("odrzuca powtórzoną nazwę kolumny (bez rozróżniania wielkości liter) i nie-tablicę", async () => {
      const dwie = [{ nazwaWPliku: "Kod", zrodloTyp: "katalog", zrodlo: "kod" }, { nazwaWPliku: "kod", zrodloTyp: "katalog", zrodlo: "ean" }];
      expect((await put("PUT", `/api/partnerzy/${id}/kolumny`, { kolumny: dwie })).body.error).toMatch(/powtarza się/);
      expect((await put("PUT", `/api/partnerzy/${id}/kolumny`, { kolumny: "x" })).status).toBe(400);
    });
  });

  describe("podgląd", () => {
    const skonfiguruj = async () => {
      importujTabeleGeis(s.db, { AT: { wspGabarytowy: 200, stawki: [[100, 61], [500, 187]] } });
      sqlite_magazyn();
      s.db.insert(products).values(Array.from({ length: 30 }, (_, i) => ({
        kod: `P${String(i).padStart(2, "0")}`, nazwa: "Opona", marka: "M", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1500, marzaPct: 50,
        dataAktualizacji: "x", waga: 40, dlugosc: 70, szerokoscPaczki: 50, wysokosc: 70,
      }))).run();
      await put("PUT", `/api/partnerzy/${id}/pola-obliczeniowe`, { pola: [{ nazwa: "DAP", formula: "cena_AT + 10" }] });
      await put("PUT", `/api/partnerzy/${id}/kolumny`, { kolumny: [{ nazwaWPliku: "Kod", zrodloTyp: "katalog", zrodlo: "kod" }, { nazwaWPliku: "Cena", zrodloTyp: "cena", zrodlo: "AT" }, { nazwaWPliku: "DAP", zrodloTyp: "pole", zrodlo: "DAP" }] });
    };
    const sqlite_magazyn = () => s.sqlite.prepare("INSERT INTO partner_magazyny VALUES (?, 'MO1')").run(id);

    it("bez skonfigurowanego serwisu odpowiada 503", async () => {
      expect((await put("POST", `/api/partnerzy/${id}/podglad`, {})).status).toBe(503);
    });

    it("zwraca nagłówek i pierwsze 20 pozycji, nie zapisując niczego na dysk ani w logach i kursach", async () => {
      await skonfiguruj();
      const serwis = stworzSerwisPartnerow({ db: s.db, klientNbp: NBP, katalogBazowy: katalog });
      const wynik = await serwis.podglad(id);
      expect(wynik.pozycjeWybrane).toBe(30);
      expect(wynik.pliki).toHaveLength(1);
      const [nag, ...wiersze] = wynik.pliki[0]!.tekst.trim().split("\n");
      expect(nag).toBe("Kod;Cena;DAP");
      expect(wiersze).toHaveLength(20);
      expect(wiersze[0]).toMatch(/^P00;\d+\.\d{2};\d+(\.\d+)?$/);
      expect(readdirSync(katalog)).toEqual([]);
      expect(s.sqlite.prepare("SELECT COUNT(*) c FROM partner_kursy").get()).toEqual({ c: 0 });
      expect(s.sqlite.prepare("SELECT COUNT(*) c FROM partner_logi").get()).toEqual({ c: 0 });
    });

    it("błędy konfiguracji (brak kolumn) wracają w polu `bledy`, bez wyjątku", async () => {
      importujTabeleGeis(s.db, { AT: { wspGabarytowy: 200, stawki: [[100, 61]] } });
      const serwis = stworzSerwisPartnerow({ db: s.db, klientNbp: NBP, katalogBazowy: katalog });
      const wynik = await serwis.podglad(id);
      expect(wynik.pliki).toEqual([]);
      expect(wynik.bledy[0]).toMatch(/nie ma skonfigurowanych kolumn/);
    });
  });

  it("GET szczegółów zwraca kolumny i pola w kolejności", async () => {
    await put("PUT", `/api/partnerzy/${id}/pola-obliczeniowe`, { pola: [{ nazwa: "B", formula: "1" }, { nazwa: "A", formula: "2" }] });
    const odp = await get(`/api/partnerzy/${id}`);
    expect(odp.body.polaObliczeniowe.map((p: { nazwa: string }) => p.nazwa)).toEqual(["A", "B"]);
  });
});
