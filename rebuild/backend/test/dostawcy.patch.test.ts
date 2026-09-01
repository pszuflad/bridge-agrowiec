/**
 * `PATCH /api/dostawcy/{id}` — sterowanie dostawcą z panelu (blok 3f-2).
 *
 * Dwie rzeczy pod obserwacją, i celowo są RÓŻNE:
 *  - co wolno ZAPISAĆ — nasza lista `POLA_EDYTOWALNE_DOSTAWCY` (odstępstwo świadome,
 *    decyzja użytkownika 2026-09-01; oryginał zapisuje całe ciało żądania),
 *  - co trafia do AUDYTU — cztery pola, port 1:1 (backend-index.cjs:48232).
 *
 * Rozjazd między tymi dwiema listami JEST zachowaniem produkcji i tu jest testowany,
 * a nie naprawiany.
 */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, suppliers } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("PATCH /api/dostawcy/:id", () => {
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
    srodowisko.db.delete(auditLog).run();
    srodowisko.db.delete(suppliers).run();
  });

  const zasiej = (nadpisania: Record<string, unknown> = {}): number => {
    srodowisko.db
      .insert(suppliers)
      .values({
        kod: "MO2",
        nazwa: "JMK",
        formatPliku: "csv",
        sposobDostarczania: "url",
        url: "https://przyklad.test/cennik.csv",
        czestotliwoscMinuty: 60,
        uwagi: "stara notatka",
        ...nadpisania,
      })
      .run();
    const kod = String(nadpisania.kod ?? "MO2");
    return (
      srodowisko.sqlite.prepare("SELECT id FROM suppliers WHERE kod = ?").get(kod) as {
        id: number;
      }
    ).id;
  };

  const patch = (id: number | string, cialo: Record<string, unknown>) =>
    request(srodowisko.app)
      .patch(`/api/dostawcy/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(cialo);

  const wiersz = () =>
    srodowisko.sqlite.prepare("SELECT * FROM suppliers WHERE kod = 'MO2'").get() as Record<
      string,
      unknown
    >;
  const audyt = () =>
    srodowisko.sqlite.prepare("SELECT * FROM audit_log").all() as Record<string, unknown>[];
  const szczegoly = (wpis: Record<string, unknown>) =>
    JSON.parse(String(wpis.szczegoly_json)) as Record<string, unknown>;

  describe("GATE — audyt obejmuje dokładnie cztery pola", () => {
    it("zmiana `czestotliwoscMinuty` TRAFIA do audytu", async () => {
      const id = zasiej();

      const odp = await patch(id, { czestotliwoscMinuty: 240 });

      expect(odp.status).toBe(200);
      expect(Number(wiersz().czestotliwosc_minuty)).toBe(240);

      const wpisy = audyt();
      expect(wpisy).toHaveLength(1);
      expect(wpisy[0]!.akcja).toBe("edycja_dostawcy");
      expect(wpisy[0]!.encja_typ).toBe("dostawca");
      expect(wpisy[0]!.encja_id).toBe("MO2");
      expect(szczegoly(wpisy[0]!)).toEqual({ czestotliwoscMinuty: 240 });
    });

    it("pole SPOZA czwórki (`uwagi`) zapisuje się, ale do audytu NIE trafia", async () => {
      const id = zasiej();

      const odp = await patch(id, { uwagi: "nowa notatka" });

      expect(odp.status).toBe(200);
      // zapis doszedł…
      expect(wiersz().uwagi).toBe("nowa notatka");
      // …a śladu w audycie nie ma. Tak działa produkcja — port 1:1.
      expect(audyt()).toHaveLength(0);
    });

    it("pozostałe trzy pola czwórki też trafiają do audytu, w kolejności z oryginału", async () => {
      const id = zasiej();

      await patch(id, {
        status: "wstrzymany",
        url: "https://inny.test/plik.csv",
        sposobDostarczania: "mail",
        uwagi: "przy okazji",
      });

      const wpisy = audyt();
      expect(wpisy).toHaveLength(1);
      // `uwagi` zapisane, ale poza audytem; kolejność kluczy jak w oryginale (`:48232`).
      expect(Object.keys(szczegoly(wpisy[0]!))).toEqual(["status", "url", "sposobDostarczania"]);
      expect(wiersz().uwagi).toBe("przy okazji");
    });

    it("wartość IDENTYCZNA z obecną nie tworzy wpisu w audycie", async () => {
      const id = zasiej({ czestotliwoscMinuty: 60 });

      const odp = await patch(id, { czestotliwoscMinuty: 60 });

      expect(odp.status).toBe(200);
      expect(audyt()).toHaveLength(0);
    });
  });

  describe("lista pól edytowalnych — ODSTĘPSTWO ŚWIADOME", () => {
    it("`importWylaczony` z ciała żądania jest IGNOROWANY — bramki D5 nie da się zdjąć PATCH-em", async () => {
      const id = zasiej({ kod: "MO6", importWylaczony: 1 });

      const odp = await patch(id, { importWylaczony: 0, czestotliwoscMinuty: 30 });

      expect(odp.status).toBe(200);
      const po = srodowisko.sqlite
        .prepare("SELECT * FROM suppliers WHERE kod = 'MO6'")
        .get() as Record<string, unknown>;
      expect(Number(po.import_wylaczony)).toBe(1); // bramka trzyma
      expect(Number(po.czestotliwosc_minuty)).toBe(30); // reszta patcha przeszła
    });

    it("pola należące do importu (`liczbaProduktow`, `ostatniPlik`, `ostatniaSync`) są ignorowane", async () => {
      const id = zasiej({ liczbaProduktow: 7, ostatniPlik: null, ostatniaSync: null });

      await patch(id, {
        liczbaProduktow: 99999,
        ostatniPlik: "2099-01-01T00:00:00.000Z",
        ostatniaSync: "2099-01-01T00:00:00.000Z",
      });

      const po = wiersz();
      expect(Number(po.liczba_produktow)).toBe(7);
      expect(po.ostatni_plik).toBeNull();
      expect(po.ostatnia_sync).toBeNull();
    });

    it("`id` i `kod` z ciała nie przepisują tożsamości wiersza", async () => {
      const id = zasiej();

      await patch(id, { id: 4242, kod: "MO9" });

      const po = wiersz();
      expect(Number(po.id)).toBe(id);
      expect(po.kod).toBe("MO2");
    });
  });

  describe("odpowiedź i bramki", () => {
    it("odsyła dostawcę BEZ kolumny wewnętrznej `importWylaczony`", async () => {
      const id = zasiej();

      const odp = await patch(id, { czestotliwoscMinuty: 120 });

      const cialo = odp.body as Record<string, unknown>;
      expect(cialo).not.toHaveProperty("importWylaczony");
      // 16 kolumn tabeli minus kolumna wewnętrzna. `GET_dostawcy.json` ma 18 kluczy,
      // bo dokłada trzy pola liczone w locie — PATCH ich nie liczy, tak jak oryginał.
      expect(Object.keys(cialo)).toHaveLength(15);
      expect(cialo.czestotliwoscMinuty).toBe(120);
    });

    it("nieistniejące `id` → 404", async () => {
      zasiej();
      const odp = await patch(999_999, { czestotliwoscMinuty: 5 });
      expect(odp.status).toBe(404);
      expect(odp.body).toEqual({ error: "Brak dostawcy" });
    });

    it("`id` nieliczbowe → 404 (`parseInt` daje NaN, jak w oryginale)", async () => {
      zasiej();
      const odp = await patch("abc", { czestotliwoscMinuty: 5 });
      expect(odp.status).toBe(404);
    });

    it("puste ciało → 200 i dostawca bez zmian", async () => {
      const id = zasiej();
      const odp = await patch(id, {});
      expect(odp.status).toBe(200);
      expect(Number(wiersz().czestotliwosc_minuty)).toBe(60);
      expect(audyt()).toHaveLength(0);
    });

    it("bez tokenu → 401", async () => {
      const id = zasiej();
      const odp = await request(srodowisko.app)
        .patch(`/api/dostawcy/${id}`)
        .send({ czestotliwoscMinuty: 5 });
      expect(odp.status).toBe(401);
    });
  });
});
