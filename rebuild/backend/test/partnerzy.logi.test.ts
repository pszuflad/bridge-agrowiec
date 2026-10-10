/** Logi operacji partnerów (ticket 219, PRT-4.2). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import type { WynikGenerowania } from "../src/partnerzy/generator.js";
import { MAKS_BLEDOW_NA_PRZEBIEG, pobierzBledy, pobierzLogi, wyczyscLogi, zapiszBlad, zapiszOperacje, zapiszWynikGenerowania } from "../src/partnerzy/logi.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const TERAZ = new Date("2026-10-10T12:00:00.000Z");
const wynik = (nad: Partial<WynikGenerowania> = {}): WynikGenerowania => ({
  pliki: [{ nazwa: "p_AT.csv", kraj: "AT", liczbaWierszy: 3000, pominiete: 2, zapisany: true }],
  bledy: ["Błąd kalkulacji X (AT): Brak wagi pozycji."],
  ostrzezenia: ["Y: waga szacowana (mniej pewna)."],
  kursy: {}, pozycjeWybrane: 3002, usunieteZArchiwum: 0, ...nad,
});

describe("logi partnerów", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  let id: number;
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-logi-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    id = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, utworzono, zmieniono) VALUES ('P', 'x', 'x')").run().lastInsertRowid);
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("jedna linia na operację + błędy i ostrzeżenia osobno", () => {
    zapiszWynikGenerowania(db, id, wynik(), TERAZ);
    const logi = pobierzLogi(db, id);
    expect(logi).toHaveLength(1);
    expect(logi[0]).toMatchObject({ operacja: "generowanie", liczbaPozycji: 3000, kiedy: TERAZ.toISOString() });
    expect(logi[0]!.opis).toBe("Wygenerowano 1 plik: p_AT.csv (3000 pozycji); błędów: 1; ostrzeżeń: 1");
    expect(pobierzBledy(db, id).map((b) => [b.poziom, b.komunikat])).toEqual([
      ["ostrzezenie", "Y: waga szacowana (mniej pewna)."],
      ["blad", "Błąd kalkulacji X (AT): Brak wagi pozycji."],
    ]);
    expect(pobierzBledy(db, id, 100, 0, "blad")).toHaveLength(1);
  });

  it("generowanie bez zapisanego pliku jest zalogowane jako nieudane", () => {
    zapiszWynikGenerowania(db, id, wynik({ pliki: [{ nazwa: "p.csv", kraj: null, liczbaWierszy: 0, pominiete: 0, zapisany: false }], bledy: ["a", "b"], ostrzezenia: [] }), TERAZ);
    expect(pobierzLogi(db, id)[0]).toMatchObject({ opis: "Generowanie nie zapisało żadnego pliku (błędów: 2)", liczbaPozycji: 0 });
  });

  it("ogranicza liczbę błędów z jednego przebiegu i dopisuje podsumowanie", () => {
    const duzo = Array.from({ length: MAKS_BLEDOW_NA_PRZEBIEG + 50 }, (_, i) => `błąd ${i}`);
    zapiszWynikGenerowania(db, id, wynik({ bledy: duzo, ostrzezenia: [] }), TERAZ);
    const b = pobierzBledy(db, id, 1000);
    expect(b).toHaveLength(MAKS_BLEDOW_NA_PRZEBIEG + 1);
    expect(b[0]!.komunikat).toBe("… i 50 kolejnych błędów (pominięto w logu).");
  });

  it("retencja 30 dni: stare wpisy znikają, świeże zostają", () => {
    const stare = new Date("2026-09-09T12:00:00.000Z"); // 31 dni
    const swieze = new Date("2026-09-11T12:00:00.000Z"); // 29 dni
    zapiszOperacje(db, id, "generowanie", "stare", 1, stare);
    zapiszBlad(db, id, "generowanie", "stary błąd", "blad", stare);
    zapiszOperacje(db, id, "generowanie", "świeże", 1, swieze);
    zapiszBlad(db, id, "generowanie", "świeży błąd", "blad", swieze);
    expect(wyczyscLogi(db, TERAZ)).toBe(2);
    expect(pobierzLogi(db, id).map((l) => l.opis)).toEqual(["świeże"]);
    expect(pobierzBledy(db, id).map((l) => l.komunikat)).toEqual(["świeży błąd"]);
  });

  it("zapis wyniku czyści stare wpisy; usunięcie partnera kasuje jego logi", () => {
    zapiszOperacje(db, id, "generowanie", "stare", 1, new Date("2026-08-01T00:00:00.000Z"));
    zapiszWynikGenerowania(db, id, wynik(), TERAZ);
    expect(pobierzLogi(db, id).map((l) => l.opis)).not.toContain("stare");
    sqlite.prepare("DELETE FROM partnerzy WHERE id = ?").run(id);
    expect(pobierzLogi(db, id)).toEqual([]);
    expect(pobierzBledy(db, id)).toEqual([]);
  });
});

describe("trasy logów partnera", () => {
  let s: SrodowiskoTestowe;
  let token: string;
  beforeEach(async () => {
    s = await stworzSrodowiskoTestowe();
    token = ((await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo })).body as { token: string }).token;
  });
  afterEach(() => s.posprzataj());
  const get = (u: string) => request(s.app).get(u).set("Authorization", `Bearer ${token}`);

  it("wymaga logowania, zwraca 404 dla nieistniejącego partnera i oddaje logi najnowsze pierwsze", async () => {
    expect((await request(s.app).get("/api/partnerzy/1/logi")).status).toBe(401);
    expect((await get("/api/partnerzy/99/logi")).status).toBe(404);
    const p = (await request(s.app).post("/api/partnerzy").set("Authorization", `Bearer ${token}`).send({ nazwa: "P" })).body as { id: number };
    zapiszOperacje(s.db, p.id, "generowanie", "pierwsza", 1);
    zapiszOperacje(s.db, p.id, "generowanie", "druga", 2);
    zapiszBlad(s.db, p.id, "generowanie", "błąd", "blad");
    zapiszBlad(s.db, p.id, "generowanie", "uwaga", "ostrzezenie");
    expect((await get(`/api/partnerzy/${p.id}/logi`)).body.logi.map((l: { opis: string }) => l.opis)).toEqual(["druga", "pierwsza"]);
    expect((await get(`/api/partnerzy/${p.id}/logi?limit=1&offset=1`)).body.logi.map((l: { opis: string }) => l.opis)).toEqual(["pierwsza"]);
    expect((await get(`/api/partnerzy/${p.id}/error-log`)).body.bledy).toHaveLength(2);
    expect((await get(`/api/partnerzy/${p.id}/error-log?poziom=ostrzezenie`)).body.bledy.map((b: { komunikat: string }) => b.komunikat)).toEqual(["uwaga"]);
  });
});
