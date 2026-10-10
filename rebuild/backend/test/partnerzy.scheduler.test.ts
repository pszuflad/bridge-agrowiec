/** Harmonogram i ręczne generowanie cenników partnerów (ticket 220, PRT-4.1). */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { products } from "../src/db/schema.js";
import type { KlientNbp } from "../src/partnerzy/kurs-nbp.js";
import { pobierzBledy, pobierzLogi } from "../src/partnerzy/logi.js";
import { GenerowanieTrwaError, stworzSerwisPartnerow, type SerwisPartnerow } from "../src/partnerzy/scheduler.js";
import { importujTabeleGeis } from "../src/partnerzy/transport.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const NBP: KlientNbp = { pobierzKursEur: async () => ({ kurs: 4.3, data: "2026-10-09" }) };

describe("serwis partnerów (harmonogram + generuj teraz)", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  let czas: Date;
  const teraz = () => czas;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-sched-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    czas = new Date("2026-10-10T12:00:00.000Z");
    importujTabeleGeis(db, { AT: { wspGabarytowy: 200, stawki: [[100, 61], [500, 187]] } });
    db.insert(products).values({
      kod: "A", nazwa: "Opona", marka: "M", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1500, marzaPct: 50,
      dataAktualizacji: "2026-10-10T00:00:00.000Z", waga: 40, dlugosc: 70, szerokoscPaczki: 50, wysokosc: 70,
    }).run();
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  const partner = (nazwa: string, aktywny: boolean, minuty: number | null): number => {
    const id = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, aktywny, harmonogram_minuty, utworzono, zmieniono) VALUES (?, ?, ?, 'x', 'x')").run(nazwa, aktywny ? 1 : 0, minuty).lastInsertRowid);
    sqlite.prepare("INSERT INTO partner_magazyny VALUES (?, 'MO1')").run(id);
    sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj, narzut_proc) VALUES (?, 'AT', 10)").run(id);
    sqlite.prepare("INSERT INTO partner_kolumny (partner_id, pozycja, nazwa_w_pliku, zrodlo_typ, zrodlo) VALUES (?, 1, 'Kod', 'katalog', 'kod'), (?, 2, 'Cena', 'cena', 'AT')").run(id, id);
    return id;
  };
  const serwis = (klient: KlientNbp = NBP) => stworzSerwisPartnerow({ db, klientNbp: klient, katalogBazowy: join(katalog, "partnerzy"), teraz });

  it("generuj teraz: zapisuje plik w katalogu partnera i wpis w logu (także dla nieaktywnego)", async () => {
    const id = partner("Nieaktywny", false, null);
    const w = await serwis().generujTeraz(id);
    expect(w.pliki[0]).toMatchObject({ nazwa: "nieaktywny_AT.csv", zapisany: true });
    expect(existsSync(join(katalog, "partnerzy", String(id), "pricelist", "nieaktywny_AT.csv"))).toBe(true);
    expect(pobierzLogi(db, id)[0]!.opis).toMatch(/Wygenerowano 1 plik: nieaktywny_AT\.csv \(1 pozycji\)/);
  });

  it("tick uruchamia tylko aktywnych z harmonogramem i tylko gdy minął interwał od ostatniej próby", async () => {
    const a = partner("Aktywny", true, 30);
    partner("BezHarmonogramu", true, null);
    partner("Wylaczony", false, 30);
    const s = serwis();
    expect(await s.tick()).toEqual([a]); // pierwsza próba: od razu
    expect(await s.tick()).toEqual([]); // tuż po: za wcześnie
    czas = new Date(czas.getTime() + 29 * 60_000);
    expect(await s.tick()).toEqual([]); // 29 min < 30
    czas = new Date(czas.getTime() + 60_000);
    expect(await s.tick()).toEqual([a]); // 30 min
    expect(pobierzLogi(db, a)).toHaveLength(2);
  });

  it("każdy partner ma własny harmonogram", async () => {
    const a = partner("A", true, 10);
    const b = partner("B", true, 60);
    const s = serwis();
    expect(await s.tick()).toEqual([a, b]);
    czas = new Date(czas.getTime() + 15 * 60_000);
    expect(await s.tick()).toEqual([a]);
  });

  it("nieudana próba też liczy się do interwału (nie powtarza się co minutę), a wyjątek trafia do logów", async () => {
    const id = partner("Awaria", true, 30);
    sqlite.prepare("DROP TABLE geis_stawki").run(); // wywołuje wyjątek w generatorze
    sqlite.prepare("DROP TABLE geis_kraje").run();
    const s = serwis();
    expect(await s.tick()).toEqual([id]);
    expect(pobierzLogi(db, id)[0]!.opis).toMatch(/Generowanie przerwane wyjątkiem/);
    expect(pobierzBledy(db, id)).toHaveLength(1);
    expect(await s.tick()).toEqual([]);
    await expect(s.generujTeraz(id)).rejects.toThrow();
  });

  it("zamek: drugie generowanie tego samego partnera w trakcie pierwszego jest odrzucone", async () => {
    const id = partner("Wolny", true, 30);
    let zwolnij!: () => void;
    const bramka = new Promise<void>((r) => (zwolnij = r));
    const s = serwis({ pobierzKursEur: async () => (await bramka, { kurs: 4.3, data: "2026-10-09" }) });
    const pierwsze = s.generujTeraz(id);
    await expect(s.generujTeraz(id)).rejects.toBeInstanceOf(GenerowanieTrwaError);
    expect(await s.tick()).toEqual([]); // tick też omija partnera w trakcie generowania
    zwolnij();
    await pierwsze;
    await expect(s.generujTeraz(id)).resolves.toBeTruthy(); // po zakończeniu zamek zwolniony
  });
});

describe("POST /api/partnerzy/:id/generuj", () => {
  const wstrzykniety: SerwisPartnerow = {
    generujTeraz: async (id: number) => {
      if (id === 2) throw new GenerowanieTrwaError(id);
      return { pliki: [], bledy: ["jakiś błąd"], ostrzezenia: [], kursy: {}, pozycjeWybrane: 0, usunieteZArchiwum: 0 };
    },
    tick: async () => [],
    uruchom: () => undefined,
    zatrzymaj: () => undefined,
  };
  let s: SrodowiskoTestowe | null = null;
  afterEach(() => s?.posprzataj());
  const wejdz = async (serwis?: SerwisPartnerow) => {
    s = await stworzSrodowiskoTestowe(undefined, { serwisPartnerow: serwis });
    const token = ((await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo })).body as { token: string }).token;
    return (u: string) => request(s!.app).post(u).set("Authorization", `Bearer ${token}`);
  };

  it("wymaga logowania; 404 dla nieistniejącego; 503 bez skonfigurowanego serwisu", async () => {
    const post = await wejdz();
    expect((await request(s!.app).post("/api/partnerzy/1/generuj")).status).toBe(401);
    expect((await post("/api/partnerzy/99/generuj")).status).toBe(404);
    const p = (await post("/api/partnerzy").send({ nazwa: "P" })).body as { id: number };
    expect((await post(`/api/partnerzy/${p.id}/generuj`)).status).toBe(503);
  });

  it("z serwisem: zwraca wynik generowania; zamek daje 409", async () => {
    const post = await wejdz(wstrzykniety);
    const a = (await post("/api/partnerzy").send({ nazwa: "A" })).body as { id: number };
    await post("/api/partnerzy").send({ nazwa: "B" });
    const ok = await post(`/api/partnerzy/${a.id}/generuj`);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ bledy: ["jakiś błąd"], pozycjeWybrane: 0 });
    expect((await post("/api/partnerzy/2/generuj")).status).toBe(409);
  });
});
