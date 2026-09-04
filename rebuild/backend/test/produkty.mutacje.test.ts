/**
 * Mutacje produktów — `POST /api/products`, `PUT`/`PATCH`/`DELETE /api/products/{id}`
 * oraz dwie trasy `uwaga_cena` (Iteracja 12a, ticket 35).
 *
 * PODZIAŁ PRACY Z CHARAKTERYZACJĄ: `produkty-bulk.charakteryzacja.test.ts` dowodzi, że sam
 * `addProductsBulk` liczy tak jak uruchomiony oryginał. Tutaj mierzymy to, czego tamten test
 * z założenia nie widzi — warstwę TRASY: listę pól edytowalnych, skutki uboczne w trzech
 * tabelach (`manual_overrides`, `history`, `audit_log`), kody odpowiedzi i te dwa endpointy,
 * które w produkcji są monkey-patchem, a więc nie ma ich w wycinanym bundlu.
 *
 * Wzorcem jest kod oryginału: `deminified/backend-index.cjs:48306-48487` dla mutacji
 * i `mirror/backend/uwaga_cena_patch.cjs` dla `uwagi-cena`/`hold-reasons`. Fixtures dla tych
 * sześciu operacji NIE ISTNIEJĄ — nagrania POST/PUT/PATCH/DELETE dochodzą dopiero w 12d.
 */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { auditLog, history, manualOverrides, markups, products } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("Mutacje produktów", () => {
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
    srodowisko.db.delete(history).run();
    srodowisko.db.delete(manualOverrides).run();
    srodowisko.db.delete(markups).run();
    srodowisko.db.delete(products).run();
  });

  const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

  const zasiejProdukt = (nadpisania: Record<string, unknown> = {}): number => {
    srodowisko.db
      .insert(products)
      .values({
        kod: "P1",
        nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
        marka: "BKT",
        kategoria: "Rolnicze",
        dostawca: "MO5",
        magazyn: "4",
        stan: 4,
        cenaZakupu: 1000,
        cenaSprzedazy: 1300,
        marzaPct: 30,
        vat: 23,
        status: "aktywny",
        dataAktualizacji: "2026-01-01T00:00:00.000Z",
        ...nadpisania,
      } as never)
      .run();
    const kod = String(nadpisania.kod ?? "P1");
    return (
      srodowisko.sqlite.prepare("SELECT id FROM products WHERE kod = ?").get(kod) as { id: number }
    ).id;
  };

  const produktZBazy = (id: number) =>
    srodowisko.sqlite.prepare("SELECT * FROM products WHERE id = ?").get(id) as Record<
      string,
      unknown
    >;

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("Auth — wszystkie sześć operacji za requireAuth (port 1:1, `we` w oryginale)", () => {
    it.each([
      ["post", "/api/products"],
      ["put", "/api/products/1"],
      ["patch", "/api/products/1"],
      ["delete", "/api/products/1"],
      ["get", "/api/products/uwagi-cena"],
      ["get", "/api/products/hold-reasons"],
    ])("%s %s bez tokenu → 401", async (metoda, sciezka) => {
      const odp = await (request(srodowisko.app) as never as Record<string, (s: string) => request.Test>)[
        metoda
      ]!(sciezka).send({});
      expect(odp.status).toBe(401);
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("POST /api/products (bulk)", () => {
    it("przyjmuje gołą tablicę i oddaje {ok, dodano} z LICZBĄ", async () => {
      const odp = await auth(request(srodowisko.app).post("/api/products")).send([
        { kod: "A1", nazwa: "Pierwsza", cenaZakupu: 100, stan: 3 },
        { kod: "A2", nazwa: "Druga", cenaZakupu: 200, stan: 5 },
      ]);

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true, dodano: 2 });
      expect(srodowisko.db.select().from(products).all()).toHaveLength(2);
    });

    it("przyjmuje też wariant {items: [...]} — oryginał dopuszcza oba kształty (:48307)", async () => {
      const odp = await auth(request(srodowisko.app).post("/api/products")).send({
        items: [{ kod: "B1", nazwa: "Z items", cenaZakupu: 50, stan: 1 }],
      });

      expect(odp.body).toEqual({ ok: true, dodano: 1 });
      expect(srodowisko.db.select().from(products).all()).toHaveLength(1);
    });

    it("ciało spoza obu kształtów daje pustą partię, a nie błąd — oryginał nie waliduje", async () => {
      const odp = await auth(request(srodowisko.app).post("/api/products")).send({ cokolwiek: 1 });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true, dodano: 0 });
    });

    it("zapisuje audyt bulk_dodanie_produktow z encjaId = PUSTY NAPIS (:48310)", async () => {
      await auth(request(srodowisko.app).post("/api/products")).send([
        { kod: "C1", nazwa: "Audytowana", cenaZakupu: 10, stan: 1 },
      ]);

      const wpis = srodowisko.db.select().from(auditLog).all().at(-1)!;
      expect(wpis.akcja).toBe("bulk_dodanie_produktow");
      expect(wpis.encjaTyp).toBe("produkt");
      expect(wpis.encjaId).toBe("");
      expect(JSON.parse(wpis.szczegolyJson!)).toEqual({ ile: 1 });
    });

    it("gałąź cenowa działa przez trasę — reguła w markups ustala cenę i marżę", async () => {
      srodowisko.db
        .insert(markups)
        .values({
          typ: "globalny",
          zakres: "",
          nazwa: "Reguła",
          wartosc: 6,
          jednostka: "procent",
          priorytet: 50,
          status: "aktywny",
          zmienilUzytkownikId: 1,
          zmienionoData: "2026-01-01T00:00:00.000Z",
        } as never)
        .run();

      await auth(request(srodowisko.app).post("/api/products")).send([
        { kod: "D1", nazwa: "Z narzutem", cenaZakupu: 1000, stan: 2 },
      ]);

      const p = srodowisko.sqlite.prepare("SELECT * FROM products WHERE kod = 'D1'").get() as
        Record<string, unknown>;
      // floor(1000 × 1,06 × 1,23) = 1303, a nie domyślne 1250.
      expect(p.cena_sprzedazy).toBe(1303);
      expect(p.marza_pct).toBe(6);
    });

    /**
     * Propagacja `uwagaCena` — w produkcji monkey-patch `uwaga_cena_patch.cjs:72-93`.
     * Charakteryzacja tego nie mierzy (patrz nagłówek tamtego pliku), więc wzorzec stoi TU.
     */
    it("propaguje uwagaCena z payloadu do kolumny, także z klucza snake_case", async () => {
      await auth(request(srodowisko.app).post("/api/products")).send([
        { kod: "E1", nazwa: "camelCase", cenaZakupu: 10, stan: 1, uwagaCena: "na zapytanie" },
        { kod: "E2", nazwa: "snake_case", cenaZakupu: 10, stan: 1, uwaga_cena: "cena u dostawcy" },
        { kod: "E3", nazwa: "bez uwagi", cenaZakupu: 10, stan: 1 },
      ]);

      const wiersze = srodowisko.sqlite
        .prepare("SELECT kod, uwaga_cena FROM products ORDER BY kod")
        .all() as { kod: string; uwaga_cena: string | null }[];
      expect(wiersze).toEqual([
        { kod: "E1", uwaga_cena: "na zapytanie" },
        { kod: "E2", uwaga_cena: "cena u dostawcy" },
        { kod: "E3", uwaga_cena: null },
      ]);
    });

    it("BRAK uwagaCena w kolejnej partii CZYŚCI kolumnę — monkey-patch nadpisuje nullem", async () => {
      await auth(request(srodowisko.app).post("/api/products")).send([
        { kod: "F1", nazwa: "Najpierw z uwagą", cenaZakupu: 10, stan: 1, uwagaCena: "na zapytanie" },
      ]);
      await auth(request(srodowisko.app).post("/api/products")).send([
        { kod: "F1", nazwa: "Potem bez uwagi", cenaZakupu: 10, stan: 1 },
      ]);

      const p = srodowisko.sqlite.prepare("SELECT uwaga_cena FROM products WHERE kod = 'F1'").get() as
        { uwaga_cena: string | null };
      expect(p.uwaga_cena).toBeNull();
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("PATCH /api/products/{id} — lista pól edytowalnych (D1, backlog #14)", () => {
    it("zapisuje pola Z LISTY", async () => {
      const id = zasiejProdukt();
      const odp = await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        nazwa: "Nazwa poprawiona ręcznie",
        stan: 11,
        bieznik: "AGRIMAX",
      });

      expect(odp.status).toBe(200);
      const p = produktZBazy(id);
      expect(p.nazwa).toBe("Nazwa poprawiona ręcznie");
      expect(p.stan).toBe(11);
      expect(p.bieznik).toBe("AGRIMAX");
    });

    it("IGNORUJE pola spoza listy — wyliczane, tożsamość i własne odbudowy", async () => {
      const id = zasiejProdukt({ kodImportu: "424242" });
      const przed = produktZBazy(id);

      const odp = await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        marzaPct: 999,
        kodImportu: "000000",
        uwagaCena: "wstrzyknięte",
        magazyn: "PODROBIONY",
        dataAktualizacji: "1999-01-01T00:00:00.000Z",
        kod: "PODMIENIONY",
        dostawca: "MO9",
        id: 12345,
      });

      expect(odp.status).toBe(200);
      const po = produktZBazy(id);
      expect(po.marza_pct).toBe(przed.marza_pct);
      expect(po.kod_importu).toBe("424242");
      expect(po.uwaga_cena).toBeNull();
      expect(po.magazyn).toBe(przed.magazyn);
      expect(po.data_aktualizacji).toBe(przed.data_aktualizacji);
      expect(po.kod).toBe("P1");
      expect(po.dostawca).toBe("MO5");
      expect(po.id).toBe(id);
    });

    it("PATCH z SAMYMI polami spoza listy oddaje 200, a nie 500 (pusty patch)", async () => {
      const id = zasiejProdukt();
      const odp = await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        marzaPct: 1,
        _reason: "próba",
      });

      expect(odp.status).toBe(200);
      expect((odp.body as { kod: string }).kod).toBe("P1");
      expect(srodowisko.db.select().from(manualOverrides).all()).toHaveLength(0);
    });

    it("odpowiedź NIE niesie uwagaCena — projekcja kontraktowa (72 klucze)", async () => {
      const id = zasiejProdukt();
      srodowisko.sqlite.prepare("UPDATE products SET uwaga_cena = ? WHERE id = ?").run("x", id);

      const odp = await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        stan: 2,
      });
      expect(Object.keys(odp.body as object)).not.toContain("uwagaCena");
      expect(Object.keys(odp.body as object)).not.toContain("uwaga_cena");
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("PATCH — automatyczne wstrzymanie przy cenie 0 (:44729-44738)", () => {
    it("cena sprzedaży spada do 0 → status wstrzymany, mimo że żądanie go nie niosło", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({ cenaSprzedazy: 0 });
      expect(produktZBazy(id).status).toBe("wstrzymany");
    });

    it("cena zakupu spada do 0 → status wstrzymany", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({ cenaZakupu: 0 });
      expect(produktZBazy(id).status).toBe("wstrzymany");
    });

    it("JAWNY status w żądaniu wyłącza bezpiecznik — oryginał sprawdza `!(\"status\" in e)`", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        cenaZakupu: 0,
        status: "aktywny",
      });
      expect(produktZBazy(id).status).toBe("aktywny");
    });

    it("zmiana ceny na niezerową nie rusza statusu", async () => {
      const id = zasiejProdukt({ status: "wstrzymany" });
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({ cenaZakupu: 1500 });
      expect(produktZBazy(id).status).toBe("wstrzymany");
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("PATCH — skutki uboczne w trzech tabelach", () => {
    it("manual_overrides: jeden wiersz na KAŻDE zmienione pole (:48427)", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        nazwa: "Nowa nazwa",
        stan: 9,
        marka: "MICHELIN",
      });

      const poprawki = srodowisko.db.select().from(manualOverrides).all();
      expect(poprawki.map((p) => p.fieldName).sort()).toEqual(["marka", "nazwa", "stan"]);
      for (const p of poprawki) {
        expect(p.supplierKod).toBe("MO5");
        expect(p.supplierProductId).toBe("P1");
        expect(p.reason).toBe("edycja w katalogu");
      }
      expect(poprawki.find((p) => p.fieldName === "stan")!.overrideValue).toBe("9");
    });

    it("pole wysłane z NIEZMIENIONĄ wartością nie tworzy poprawki ani wpisu dziennika", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765", // dokładnie ta sama
        stan: 12, // zmieniona
      });

      expect(srodowisko.db.select().from(manualOverrides).all().map((p) => p.fieldName)).toEqual([
        "stan",
      ]);
      expect(srodowisko.db.select().from(history).all().map((h) => h.pole)).toEqual(["stan"]);
    });

    it("_reason z ciała trafia do reason poprawki i NIE jest zapisywane jako pole", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        stan: 3,
        _reason: "reklamacja dostawcy",
      });

      const poprawki = srodowisko.db.select().from(manualOverrides).all();
      expect(poprawki).toHaveLength(1);
      expect(poprawki[0]!.reason).toBe("reklamacja dostawcy");
      expect(poprawki[0]!.fieldName).toBe("stan");
    });

    /**
     * ⭐ Tabela `history` dostaje w rebuildzie PIERWSZEGO pisarza (I5 odnotowała jej brak).
     * Od tej sesji `GET /api/history` przestaje zwracać `[]`.
     */
    it("history: jeden wpis na zmienione pole, ze źródłem 'recznie' i wartością przed/po", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({ stan: 42 });

      const wpisy = srodowisko.db.select().from(history).all();
      expect(wpisy).toHaveLength(1);
      expect(wpisy[0]).toMatchObject({
        kodProduktu: "P1",
        nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
        pole: "stan",
        staraWartosc: "4",
        nowaWartosc: "42",
        zrodlo: "recznie",
      });
    });

    it("GET /api/history przestaje zwracać pustą listę po edycji produktu", async () => {
      const id = zasiejProdukt();
      const przed = await auth(request(srodowisko.app).get("/api/history"));
      expect(przed.body).toEqual([]);

      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({ stan: 7 });

      const po = await auth(request(srodowisko.app).get("/api/history"));
      expect((po.body as unknown[]).length).toBe(1);
    });

    it("audit_log: jeden wpis edycja_produktu na żądanie, z encjaId = kod i listą pól", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        stan: 5,
        nazwa: "Inna",
      });

      const wpisy = srodowisko.db.select().from(auditLog).all();
      expect(wpisy).toHaveLength(1);
      expect(wpisy[0]!.akcja).toBe("edycja_produktu");
      expect(wpisy[0]!.encjaId).toBe("P1");
      expect(JSON.parse(wpisy[0]!.szczegolyJson!).zmiany.sort()).toEqual(["nazwa", "stan"]);
    });

    it("audyt opisuje pola PO odsianiu listą — próba mass-assignmentu nie wchodzi do zmian", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({
        stan: 6,
        marzaPct: 999,
      });

      const wpis = srodowisko.db.select().from(auditLog).all()[0]!;
      expect(JSON.parse(wpis.szczegolyJson!).zmiany).toEqual(["stan"]);
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("PUT /api/products/{id} — wspólny handler z PATCH (D2)", () => {
    it("zachowuje się dokładnie jak PATCH: zapis + poprawka + dziennik + audyt", async () => {
      const id = zasiejProdukt();
      const odp = await auth(request(srodowisko.app).put(`/api/products/${id}`)).send({
        stan: 21,
        marzaPct: 999,
      });

      expect(odp.status).toBe(200);
      expect(produktZBazy(id).stan).toBe(21);
      expect(produktZBazy(id).marza_pct).toBe(30);
      expect(srodowisko.db.select().from(manualOverrides).all()).toHaveLength(1);
      expect(srodowisko.db.select().from(history).all()).toHaveLength(1);
      expect(srodowisko.db.select().from(auditLog).all()).toHaveLength(1);
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("DELETE /api/products/{id}", () => {
    it("kasuje produkt, oddaje {ok:true} i audytuje z encjaId = ID (nie kod!)", async () => {
      const id = zasiejProdukt();
      const odp = await auth(request(srodowisko.app).delete(`/api/products/${id}`));

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true });
      expect(srodowisko.db.select().from(products).all()).toHaveLength(0);

      const wpis = srodowisko.db.select().from(auditLog).all()[0]!;
      expect(wpis.akcja).toBe("usuniecie_produktu");
      // ⚠ Niespójność oryginału (:48412): tu leci `c.params.id`, a przy edycji `p.kod`.
      expect(wpis.encjaId).toBe(String(id));
    });

    it("NIE kasuje kaskadowo poprawek ani dziennika — zastane zachowanie oryginału", async () => {
      const id = zasiejProdukt();
      await auth(request(srodowisko.app).patch(`/api/products/${id}`)).send({ stan: 8 });
      await auth(request(srodowisko.app).delete(`/api/products/${id}`));

      expect(srodowisko.db.select().from(manualOverrides).all()).toHaveLength(1);
      expect(srodowisko.db.select().from(history).all()).toHaveLength(1);
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("404 dla nieistniejącego produktu", () => {
    it.each(["put", "patch", "delete"])("%s /api/products/999999 → 404", async (metoda) => {
      const odp = await auth(
        (request(srodowisko.app) as never as Record<string, (s: string) => request.Test>)[metoda]!(
          "/api/products/999999",
        ),
      ).send({ stan: 1 });

      expect(odp.status).toBe(404);
      expect(odp.body).toEqual({ error: "Nie znaleziono produktu" });
    });

    it("404 nie zostawia śladu w audycie", async () => {
      await auth(request(srodowisko.app).delete("/api/products/999999"));
      expect(srodowisko.db.select().from(auditLog).all()).toHaveLength(0);
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("GET /api/products/uwagi-cena (uwaga_cena_patch.cjs:96-110)", () => {
    it("oddaje {ok, items} z kluczem uwaga_cena w SNAKE_CASE", async () => {
      const id = zasiejProdukt({ ean: "5901234123457" });
      srodowisko.sqlite
        .prepare("UPDATE products SET uwaga_cena = ? WHERE id = ?")
        .run("na zapytanie", id);

      const odp = await auth(request(srodowisko.app).get("/api/products/uwagi-cena"));

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        items: [{ id, kod: "P1", ean: "5901234123457", uwaga_cena: "na zapytanie" }],
      });
      // ⚠ Gołe `select()` Drizzle'a dałoby tu `uwagaCena` — projekcja MUSI być jawna.
      expect(Object.keys((odp.body as { items: object[] }).items[0]!)).toEqual([
        "id",
        "kod",
        "ean",
        "uwaga_cena",
      ]);
    });

    it("pomija NULL i pusty napis (WHERE uwaga_cena IS NOT NULL AND <> '')", async () => {
      const zUwaga = zasiejProdukt({ kod: "U1" });
      zasiejProdukt({ kod: "U2" });
      const zPusta = zasiejProdukt({ kod: "U3" });
      srodowisko.sqlite.prepare("UPDATE products SET uwaga_cena = ? WHERE id = ?").run("x", zUwaga);
      srodowisko.sqlite.prepare("UPDATE products SET uwaga_cena = ? WHERE id = ?").run("", zPusta);

      const odp = await auth(request(srodowisko.app).get("/api/products/uwagi-cena"));
      expect((odp.body as { items: { kod: string }[] }).items.map((i) => i.kod)).toEqual(["U1"]);
    });
  });

  // ——————————————————————————————————————————————————————————————————————————————————
  describe("GET /api/products/hold-reasons (uwaga_cena_patch.cjs:120-147)", () => {
    /** Buduje po jednym produkcie na każdy z pięciu przypadków + jeden aktywny (odsiewany). */
    const zasiejPrzypadki = () => {
      const idUwaga = zasiejProdukt({ kod: "H1", status: "wstrzymany", cenaZakupu: 0, stan: 0 });
      srodowisko.sqlite
        .prepare("UPDATE products SET uwaga_cena = ? WHERE id = ?")
        .run("  cena na zapytanie  ", idUwaga);
      zasiejProdukt({ kod: "H2", status: "wstrzymany", cenaZakupu: 0, stan: 0 });
      zasiejProdukt({ kod: "H3", status: "wstrzymany", cenaZakupu: 0, stan: 5 });
      zasiejProdukt({ kod: "H4", status: "wstrzymany", cenaZakupu: 900, stan: 0 });
      zasiejProdukt({ kod: "H5", status: "wstrzymany", cenaZakupu: 900, stan: 5 });
      zasiejProdukt({ kod: "H6", status: "aktywny", cenaZakupu: 900, stan: 5 });
    };

    it("liczy pięć powodów w locie, z dosłownymi tekstami i w tej kolejności warunków", async () => {
      zasiejPrzypadki();
      const odp = await auth(request(srodowisko.app).get("/api/products/hold-reasons"));

      expect(odp.status).toBe(200);
      expect((odp.body as { ok: boolean }).ok).toBe(true);
      const wg = Object.fromEntries(
        (odp.body as { items: { kod: string; reason: string }[] }).items.map((i) => [
          i.kod,
          i.reason,
        ]),
      );
      expect(wg).toEqual({
        // ⚠ `uwaga_cena` BIJE wszystkie pozostałe warunki — H1 ma cenę i stan 0, a mimo to
        // dostaje treść uwagi, nie „Brak ceny i stanu". Kolejność `if`-ów jest tu istotą.
        H1: "cena na zapytanie", // po trim()
        H2: "Brak ceny i stanu u dostawcy",
        H3: "Brak ceny u dostawcy",
        H4: "Brak stanu magazynowego u dostawcy",
        H5: "Wstrzymane — sprawdź ręcznie",
      });
    });

    it("bierze WYŁĄCZNIE produkty ze statusem wstrzymany", async () => {
      zasiejPrzypadki();
      const odp = await auth(request(srodowisko.app).get("/api/products/hold-reasons"));
      expect(
        (odp.body as { items: { kod: string }[] }).items.map((i) => i.kod),
      ).not.toContain("H6");
    });

    it("oddaje dokładnie cztery klucze na pozycję: id, kod, ean, reason", async () => {
      zasiejProdukt({ kod: "H7", status: "wstrzymany", cenaZakupu: 900, stan: 5 });
      const odp = await auth(request(srodowisko.app).get("/api/products/hold-reasons"));
      expect(Object.keys((odp.body as { items: object[] }).items[0]!)).toEqual([
        "id",
        "kod",
        "ean",
        "reason",
      ]);
    });

    it("pusta lista, gdy nic nie jest wstrzymane — {ok:true, items:[]}", async () => {
      zasiejProdukt({ status: "aktywny" });
      const odp = await auth(request(srodowisko.app).get("/api/products/hold-reasons"));
      expect(odp.body).toEqual({ ok: true, items: [] });
    });
  });
});
