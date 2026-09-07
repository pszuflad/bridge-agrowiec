/**
 * Trasy administracyjne dostawców — port `mirror/backend/extensions.cjs:296-405`.
 *
 * Testy stoją na realnej bazie i realnym dispatcherze (`import/parsuj.ts`), bo dokładnie
 * ta para decyduje o kształcie odpowiedzi: lista idzie po KODACH DISPATCHERA, a nie po
 * wierszach tabeli, i to jest najłatwiejsza rzecz do zepsucia przy refaktorze.
 */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, suppliers } from "../src/db/schema.js";
import { listaDostawcow as kodyDostawcow, urlDostawcy } from "../src/import/parsuj.js";
import { dostawcaPoKodzie } from "../src/repos/suppliers.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("trasy admin — supplier-config i suppliers-list", () => {
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

  /** Dwóch dostawców: MO1 z własnym adresem w bazie, MO2 bez adresu (pusty string). */
  beforeEach(() => {
    srodowisko.sqlite.prepare("DELETE FROM suppliers").run();
    srodowisko.sqlite.prepare("DELETE FROM audit_log").run();
    srodowisko.db
      .insert(suppliers)
      .values([
        {
          kod: "MO1",
          nazwa: "Bohnenkamp",
          formatPliku: "csv",
          sposobDostarczania: "url",
          url: "https://przyklad.test/wlasny.csv",
          czestotliwoscMinuty: 10080,
          status: "aktywny",
          ostatniPlik: "2026-08-12T09:47:19.358Z",
          liczbaProduktow: 657,
        },
        {
          kod: "MO2",
          nazwa: "JMK",
          formatPliku: "csv",
          sposobDostarczania: "url",
          url: "",
          czestotliwoscMinuty: 60,
          status: "wstrzymany",
        },
      ])
      .run();
  });

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  const patch = (kod: string, cialo: unknown) =>
    request(srodowisko.app)
      .patch(`/api/admin/supplier-config/${kod}`)
      .set("Authorization", `Bearer ${token}`)
      .send(cialo as object);

  it("wszystkie trzy trasy wymagają tokenu", async () => {
    expect((await request(srodowisko.app).get("/api/admin/supplier-config")).status).toBe(401);
    expect((await request(srodowisko.app).get("/api/admin/suppliers-list")).status).toBe(401);
    expect(
      (await request(srodowisko.app).patch("/api/admin/supplier-config/MO1").send({ status: "aktywny" }))
        .status,
    ).toBe(401);
  });

  /**
   * Najważniejsza własność obu list: liczba pozycji zależy od DISPATCHERA, nie od bazy.
   * W bazie są dwa wiersze, a odpowiedź ma tyle pozycji, ile kodów zna dispatcher.
   */
  it("supplier-config listuje wszystkich dostawców dispatchera, także tych spoza bazy", async () => {
    const odp = await zAuth("/api/admin/supplier-config");

    expect(odp.status).toBe(200);
    const { ok, dostawcy } = odp.body as { ok: boolean; dostawcy: { kod: string }[] };
    expect(ok).toBe(true);
    expect(dostawcy.map((d) => d.kod)).toEqual(kodyDostawcow());
  });

  it("supplier-config: url z bazy wygrywa i podnosi urlEfektywnyZDb", async () => {
    const odp = await zAuth("/api/admin/supplier-config");
    const dostawcy = (odp.body as { dostawcy: Record<string, unknown>[] }).dostawcy;

    const mo1 = dostawcy.find((d) => d.kod === "MO1")!;
    expect(mo1).toEqual({
      kod: "MO1",
      nazwa: "Bohnenkamp",
      url: "https://przyklad.test/wlasny.csv",
      urlEfektywnyZDb: true,
      czestotliwoscMinuty: 10080,
      status: "aktywny",
      fallbackUrl: urlDostawcy("MO1"),
    });
  });

  /** Pusty string w kolumnie `url` to NIE jest adres — schodzimy na fallback dispatchera. */
  it("supplier-config: pusty url w bazie schodzi na fallback z flagą false", async () => {
    const odp = await zAuth("/api/admin/supplier-config");
    const mo2 = (odp.body as { dostawcy: Record<string, unknown>[] }).dostawcy.find(
      (d) => d.kod === "MO2",
    )!;

    expect(mo2.url).toBe(urlDostawcy("MO2"));
    expect(mo2.urlEfektywnyZDb).toBe(false);
    expect(mo2.fallbackUrl).toBe(urlDostawcy("MO2"));
  });

  it("supplier-config: dostawca spoza bazy dostaje kod jako nazwę i status aktywny", async () => {
    const odp = await zAuth("/api/admin/supplier-config");
    const dostawcy = (odp.body as { dostawcy: Record<string, unknown>[] }).dostawcy;
    const spozaBazy = dostawcy.find((d) => d.kod !== "MO1" && d.kod !== "MO2")!;

    expect(spozaBazy.nazwa).toBe(spozaBazy.kod);
    expect(spozaBazy.status).toBe("aktywny");
    expect(spozaBazy.czestotliwoscMinuty).toBeNull();
    expect(spozaBazy.urlEfektywnyZDb).toBe(false);
  });

  it("suppliers-list niesie statystyki importu, z zerem dla dostawcy spoza bazy", async () => {
    const odp = await zAuth("/api/admin/suppliers-list");

    expect(odp.status).toBe(200);
    const dostawcy = (odp.body as { dostawcy: Record<string, unknown>[] }).dostawcy;
    expect(dostawcy.map((d) => d.kod)).toEqual(kodyDostawcow());

    expect(dostawcy.find((d) => d.kod === "MO1")).toEqual({
      kod: "MO1",
      nazwa: "Bohnenkamp",
      url: "https://przyklad.test/wlasny.csv",
      czestotliwoscMinuty: 10080,
      status: "aktywny",
      ostatniPlik: "2026-08-12T09:47:19.358Z",
      liczbaProduktow: 657,
    });

    const spozaBazy = dostawcy.find((d) => d.kod !== "MO1" && d.kod !== "MO2")!;
    expect(spozaBazy.ostatniPlik).toBeNull();
    expect(spozaBazy.liczbaProduktow).toBe(0);
  });

  describe("PATCH /api/admin/supplier-config/:kod", () => {
    it("nieznany kod daje 400 przed sprawdzeniem bazy", async () => {
      const odp = await patch("ZZZ", { status: "aktywny" });

      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: "Nieznany dostawca: ZZZ" });
    });

    it("kod dispatchera bez wiersza w bazie daje 404", async () => {
      const brakujacy = kodyDostawcow().find((k) => k !== "MO1" && k !== "MO2")!;
      const odp = await patch(brakujacy, { status: "aktywny" });

      expect(odp.status).toBe(404);
      expect(odp.body).toEqual({ error: `Dostawca ${brakujacy} nie istnieje w bazie` });
    });

    it("kod jest podnoszony do wielkich liter", async () => {
      const odp = await patch("mo1", { status: "wstrzymany" });

      expect(odp.status).toBe(200);
      expect((odp.body as { kod: string }).kod).toBe("MO1");
      expect(dostawcaPoKodzie(srodowisko.db, "MO1")?.status).toBe("wstrzymany");
    });

    it("puste ciało daje 400", async () => {
      const odp = await patch("MO1", {});

      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({
        error: "Brak pól do aktualizacji (url|czestotliwoscMinuty|status)",
      });
    });

    it("odrzuca url spoza http(s)", async () => {
      for (const zly of ["ftp://a.test/x.csv", "a.test/x.csv", 42, true]) {
        const odp = await patch("MO1", { url: zly });
        expect(odp.status).toBe(400);
        expect(odp.body).toEqual({ error: "url musi być http(s):// albo null/pusty" });
      }
    });

    /**
     * ⚠ `null` i `""` to POLECENIE WYCZYSZCZENIA, nie błąd walidacji — po nich dostawca
     * wraca na adres z dispatchera. To rozróżnienie ginie przy „uproszczeniu" walidacji
     * do zwykłego `if (url)`, dlatego ma własny test.
     */
    it("url null i pusty czyszczą adres, przywracając fallback dispatchera", async () => {
      for (const czyszczace of [null, ""]) {
        srodowisko.sqlite
          .prepare("UPDATE suppliers SET url = ? WHERE kod = 'MO1'")
          .run("https://przyklad.test/wlasny.csv");

        const odp = await patch("MO1", { url: czyszczace });
        expect(odp.status).toBe(200);
        expect(dostawcaPoKodzie(srodowisko.db, "MO1")?.url).toBeNull();

        const lista = await zAuth("/api/admin/supplier-config");
        const mo1 = (lista.body as { dostawcy: Record<string, unknown>[] }).dostawcy.find(
          (d) => d.kod === "MO1",
        )!;
        expect(mo1.url).toBe(urlDostawcy("MO1"));
        expect(mo1.urlEfektywnyZDb).toBe(false);
      }
    });

    it("url jest przycinany z białych znaków", async () => {
      const odp = await patch("MO1", { url: "  https://przyklad.test/nowy.csv  " });

      expect(odp.status).toBe(200);
      expect(dostawcaPoKodzie(srodowisko.db, "MO1")?.url).toBe("https://przyklad.test/nowy.csv");
    });

    it("częstotliwość: granice 5 i 10080 przechodzą, 4 i 10081 nie", async () => {
      for (const dobra of [5, 10080]) {
        expect((await patch("MO1", { czestotliwoscMinuty: dobra })).status).toBe(200);
      }
      // ⚠ `Number.NaN` NIE nadaje się na przypadek testowy: `JSON.stringify` zamienia go
      // na `null`, czyli na legalne polecenie wyczyszczenia — żądanie kończy się 200.
      // Wartość dającą `NaN` po `Number()` trzeba przesłać jako coś, co JSON przenosi:
      // `{}` (`Number({})` → `NaN`).
      for (const zla of [4, 10081, -1, "abc", {}]) {
        const odp = await patch("MO1", { czestotliwoscMinuty: zla });
        expect(odp.status).toBe(400);
        expect(odp.body).toEqual({ error: "czestotliwoscMinuty: 5..10080 albo null" });
      }
    });

    it("częstotliwość null czyści wartość, ułamek jest zaokrąglany", async () => {
      expect((await patch("MO1", { czestotliwoscMinuty: null })).status).toBe(200);
      expect(dostawcaPoKodzie(srodowisko.db, "MO1")?.czestotliwoscMinuty).toBeNull();

      await patch("MO1", { czestotliwoscMinuty: 60.6 });
      expect(dostawcaPoKodzie(srodowisko.db, "MO1")?.czestotliwoscMinuty).toBe(61);
    });

    it("status przyjmuje trzy wartości, także wielkimi literami, i odrzuca resztę", async () => {
      for (const dobry of ["aktywny", "wstrzymany", "blad", "AKTYWNY"]) {
        const odp = await patch("MO1", { status: dobry });
        expect(odp.status).toBe(200);
        expect(dostawcaPoKodzie(srodowisko.db, "MO1")?.status).toBe(dobry.toLowerCase());
      }
      const odp = await patch("MO1", { status: "usuniety" });
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: "status: aktywny|wstrzymany|blad" });
    });

    it("zapisuje trzy pola naraz i odsyła stan po zapisie", async () => {
      const odp = await patch("MO1", {
        url: "https://przyklad.test/trzy.csv",
        czestotliwoscMinuty: 120,
        status: "wstrzymany",
      });

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        kod: "MO1",
        url: "https://przyklad.test/trzy.csv",
        czestotliwoscMinuty: 120,
        status: "wstrzymany",
      });
    });

    it("audytuje zmianę z listą pól i nowymi wartościami", async () => {
      await patch("MO1", { czestotliwoscMinuty: 120, status: "wstrzymany" });

      const wpisy = srodowisko.db.select().from(auditLog).all();
      expect(wpisy).toHaveLength(1);
      const wpis = wpisy[0]!;
      expect(wpis).toMatchObject({
        akcja: "edit_supplier_config",
        encjaTyp: "dostawca",
        encjaId: "MO1",
        uzytkownikImie: srodowisko.uzytkownik.imieNazwisko,
      });
      expect(JSON.parse(wpis.szczegolyJson!)).toEqual({
        pola: ["czestotliwoscMinuty", "status"],
        nowe: { czestotliwoscMinuty: 120, status: "wstrzymany" },
      });
    });

    it("odrzucone żądanie nie zostawia śladu w audycie ani w bazie", async () => {
      await patch("MO1", { status: "usuniety" });

      expect(srodowisko.db.select().from(auditLog).all()).toHaveLength(0);
      expect(dostawcaPoKodzie(srodowisko.db, "MO1")?.status).toBe("aktywny");
    });

    /**
     * Walidacja jest sekwencyjna i przerywa na pierwszym błędzie — `url` jest sprawdzany
     * przed `status`, więc to komunikat o URL-u ma wyjść, a status nie może zostać zapisany.
     */
    it("pierwszy błędny warunek przerywa zapis pozostałych pól", async () => {
      const odp = await patch("MO1", { url: "ftp://zle", status: "wstrzymany" });

      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: "url musi być http(s):// albo null/pusty" });
      expect(dostawcaPoKodzie(srodowisko.db, "MO1")?.status).toBe("aktywny");
    });
  });
});
