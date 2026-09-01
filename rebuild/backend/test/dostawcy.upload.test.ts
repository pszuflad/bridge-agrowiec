/**
 * `POST /api/dostawcy/{kod}/upload` — ręczne wgranie cennika (blok 3f-1).
 *
 * Testy chodzą po PRAWDZIWEJ ścieżce: multipart → multer → port parserów z 3a → silnik
 * `tk()` z 3c → SQLite. Mockowane nie jest nic. Pliki to te same próbki, na których stoi
 * gate charakteryzacji (`test/charakteryzacja/probki/`), w tym XLSX-y MO8 i MO10 — bo to
 * właśnie one uzasadniły dopuszczenie XLSX w przeglądarce (decyzja sesji 3f-1).
 *
 * Port: deminified/backend-index.cjs:48243-48280.
 */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { alerts, auditLog, stagingItems, suppliers } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const KATALOG_PROBEK = join(import.meta.dirname, "charakteryzacja", "probki");

function probka(nazwa: string): Buffer {
  return readFileSync(join(KATALOG_PROBEK, nazwa));
}

describe("POST /api/dostawcy/:kod/upload", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  beforeEach(() => {
    srodowisko.db.delete(stagingItems).run();
    srodowisko.db.delete(auditLog).run();
    srodowisko.db.delete(alerts).run();
    srodowisko.db.delete(suppliers).run();
    rmSync(srodowisko.katalogArchiwum, { recursive: true, force: true });
  });

  const zasiejDostawce = (kod: string, nadpisania: Record<string, unknown> = {}) => {
    srodowisko.db
      .insert(suppliers)
      .values({
        kod,
        nazwa: `Dostawca ${kod}`,
        formatPliku: kod === "MO8" || kod === "MO10" ? "xlsx" : "csv",
        sposobDostarczania: "mail",
        ...nadpisania,
      })
      .run();
  };

  const wgraj = (kod: string, dane: Buffer, nazwa: string) =>
    request(srodowisko.app)
      .post(`/api/dostawcy/${kod}/upload`)
      .set("Authorization", `Bearer ${token}`)
      .attach("plik", dane, nazwa);

  const policzStaging = () =>
    (srodowisko.sqlite.prepare("SELECT count(*) AS c FROM staging_items").get() as { c: number }).c;

  const wszystkieAlerty = () =>
    srodowisko.sqlite.prepare("SELECT * FROM alerts").all() as Record<string, unknown>[];

  describe("ścieżka główna — GATE 3f-1", () => {
    it("wgranie poprawnego cennika CSV daje pozycje w stagingu, alert i znaczniki na dostawcy", async () => {
      zasiejDostawce("MO1");
      const odp = await wgraj("MO1", probka("MO1.csv"), "bohnenkamp_2026.csv");

      expect(odp.status).toBe(200);
      const cialo = odp.body as Record<string, unknown>;
      expect(cialo.ok).toBe(true);
      expect(cialo.nazwaPliku).toBe("bohnenkamp_2026.csv");
      expect(Number(cialo.liczbaProduktow)).toBeGreaterThan(0);

      // 1. pozycje fizycznie w stagingu
      expect(policzStaging()).toBe(Number(cialo.doStagingu));
      expect(policzStaging()).toBeGreaterThan(0);

      // 2. alert „Ręczny upload"
      const alerty = wszystkieAlerty();
      expect(alerty).toHaveLength(1);
      expect(alerty[0]!.typ).toBe("Ręczny upload");
      expect(alerty[0]!.poziom).toBe("info");
      expect(alerty[0]!.status).toBe("rozwiazany");
      expect(alerty[0]!.dostawca).toBe("MO1");
      expect(String(alerty[0]!.opis)).toContain("bohnenkamp_2026.csv");

      // 3. ostatniPlik / ostatniaSync / liczbaProduktow na dostawcy
      const dostawca = srodowisko.sqlite
        .prepare("SELECT * FROM suppliers WHERE kod = 'MO1'")
        .get() as Record<string, unknown>;
      expect(dostawca.ostatni_plik).toBeTruthy();
      expect(dostawca.ostatnia_sync).toBeTruthy();
      expect(dostawca.liczba_produktow).toBe(Number(cialo.liczbaProduktow));
      expect(dostawca.status).toBe("aktywny");

      // 4. wpis w audit logu
      const audyt = srodowisko.sqlite
        .prepare("SELECT * FROM audit_log WHERE akcja = 'upload_pliku'")
        .all() as Record<string, unknown>[];
      expect(audyt).toHaveLength(1);
      expect(audyt[0]!.encja_id).toBe("MO1");
      const szczegoly = JSON.parse(String(audyt[0]!.szczegoly_json)) as Record<string, unknown>;
      expect(szczegoly.nazwaPliku).toBe("bohnenkamp_2026.csv");
      expect(szczegoly.liczbaProduktow).toBe(Number(cialo.liczbaProduktow));
    });

    it("odpowiedź niesie podgląd pierwszych 5 rekordów", async () => {
      zasiejDostawce("MO1");
      const odp = await wgraj("MO1", probka("MO1.csv"), "MO1.csv");

      const podglad = (odp.body as { podglad: Record<string, unknown>[] }).podglad;
      expect(podglad).toHaveLength(5);
      // Podgląd jest PO adapterze — ma kształt rekordu surowego, nie wiersza CSV.
      expect(podglad[0]!).toHaveProperty("kod");
      expect(podglad[0]!).toHaveProperty("nazwa");
    });

    /**
     * Zestaw kluczy odpowiedzi jest kontraktem dla frontendu — oryginał rozsypuje
     * statystyki `tk()` wprost do ciała (`...m`, backend-index.cjs:48274).
     */
    it("odpowiedź ma zestaw kluczy jak w oryginale", async () => {
      zasiejDostawce("MO1");
      const odp = await wgraj("MO1", probka("MO1.csv"), "MO1.csv");

      expect(Object.keys(odp.body as object).sort()).toEqual(
        [
          "ok",
          "nazwaPliku",
          "liczbaProduktow",
          "podglad",
          "doStagingu",
          "odrzuconeNieOpony",
          "odrzuconeBrakDanych",
          "odrzuconeSmieciMO2",
          "nowe",
          "zmienione",
          "wycofane",
          "bezZmian",
          "autoZatwierdzone",
          "szczegolyOdrzuconych",
        ].sort(),
      );
    });

    /**
     * MO8 i MO10 to XLSX — i to one przesądziły o odstępstwie „dopuszczamy XLSX
     * w przeglądarce" (sesja 3f-1). Wierne odtworzenie blokady z `oP()` oznaczałoby,
     * że tych dwóch dostawców Ania nie wgra w ogóle.
     */
    it.each(["MO8", "MO10"])("wgrywa cennik XLSX dostawcy %s", async (kod) => {
      zasiejDostawce(kod);
      const odp = await wgraj(kod, probka(`${kod}.xlsx`), `${kod}.xlsx`);

      expect(odp.status).toBe(200);
      expect(Number((odp.body as { liczbaProduktow: number }).liczbaProduktow)).toBeGreaterThan(0);
      expect(policzStaging()).toBeGreaterThan(0);
    });

    it("archiwizuje bufor — tak jak produkcyjne `nq()` przed parsowaniem", async () => {
      zasiejDostawce("MO1");
      await wgraj("MO1", probka("MO1.csv"), "MO1.csv");

      const { readdirSync, existsSync } = await import("node:fs");
      expect(existsSync(srodowisko.katalogArchiwum)).toBe(true);
      const zawartosc = readdirSync(srodowisko.katalogArchiwum, { recursive: true }) as string[];
      expect(zawartosc.some((n) => String(n).includes("MO1"))).toBe(true);
    });
  });

  describe("plik nieparsowalny — błąd MUSI być widoczny (GATE)", () => {
    /**
     * Kluczowy gate sesji: bez fallbacku `Wc()` (decyzja zaklepana w roadmapie) awaria
     * parsera nie może przejść po cichu. Wysyłamy plik XLSX-owego dostawcy jako śmieci,
     * żeby wywrócić parser SheetJS.
     */
    it("zwraca czytelny błąd i NIE zapisuje pozycji", async () => {
      zasiejDostawce("MO8");
      const odp = await wgraj("MO8", Buffer.from("to nie jest xlsx, tylko tekst"), "smieci.xlsx");

      expect(odp.status).toBeGreaterThanOrEqual(400);
      const cialo = odp.body as { error: string; dostawcaKod: string; nazwaPliku: string };
      expect(cialo.error).toBeTruthy();
      expect(cialo.error).not.toBe("Błąd serwera");
      expect(cialo.dostawcaKod).toBe("MO8");
      expect(cialo.nazwaPliku).toBe("smieci.xlsx");
      expect(policzStaging()).toBe(0);
    });

    it("zostawia alert ostrzegawczy o nieudanym wgraniu", async () => {
      zasiejDostawce("MO8");
      await wgraj("MO8", Buffer.from("to nie jest xlsx, tylko tekst"), "smieci.xlsx");

      const alerty = wszystkieAlerty();
      expect(alerty).toHaveLength(1);
      expect(alerty[0]!.typ).toBe("Ręczny upload");
      expect(alerty[0]!.poziom).toBe("ostrzezenie");
      expect(alerty[0]!.status).toBe("nowy");
      expect(String(alerty[0]!.opis)).toContain("smieci.xlsx");
    });

    it("nie podbija znaczników importu na dostawcy po nieudanym parsowaniu", async () => {
      zasiejDostawce("MO8");
      await wgraj("MO8", Buffer.from("nie xlsx"), "smieci.xlsx");

      const dostawca = srodowisko.sqlite
        .prepare("SELECT * FROM suppliers WHERE kod = 'MO8'")
        .get() as Record<string, unknown>;
      expect(dostawca.ostatni_plik).toBeNull();
      expect(dostawca.ostatnia_sync).toBeNull();
    });
  });

  describe("bramki wejścia", () => {
    it("brak pliku → 400 „Brak pliku”", async () => {
      zasiejDostawce("MO1");
      const odp = await request(srodowisko.app)
        .post("/api/dostawcy/MO1/upload")
        .set("Authorization", `Bearer ${token}`);

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Brak pliku");
    });

    it("nieznany dostawca → 404 „Brak dostawcy”", async () => {
      const odp = await wgraj("MO99", probka("MO1.csv"), "MO1.csv");

      expect(odp.status).toBe(404);
      expect((odp.body as { error: string }).error).toBe("Brak dostawcy");
    });

    /**
     * Kolejność bramek jest częścią portu: oryginał sprawdza plik PRZED dostawcą
     * (backend-index.cjs:48245-48250), więc żądanie bez pliku do nieznanego dostawcy
     * dostaje 400, nie 404.
     */
    it("brak pliku ma pierwszeństwo przed nieznanym dostawcą", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/dostawcy/MO99/upload")
        .set("Authorization", `Bearer ${token}`);

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Brak pliku");
    });

    it("dostawca wyłączony z importu (MO6) → 400 i nic nie zapisuje", async () => {
      zasiejDostawce("MO6", { importWylaczony: 1 });
      const odp = await wgraj("MO6", probka("MO6.csv"), "MO6.csv");

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Dostawca MO6 jest wyłączony z importu");
      expect(policzStaging()).toBe(0);
      expect(wszystkieAlerty()).toHaveLength(0);
    });

    it("bez tokenu → 401", async () => {
      zasiejDostawce("MO1");
      const odp = await request(srodowisko.app)
        .post("/api/dostawcy/MO1/upload")
        .attach("plik", probka("MO1.csv"), "MO1.csv");

      expect(odp.status).toBe(401);
    });
  });
});
