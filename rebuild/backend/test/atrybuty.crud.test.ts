/**
 * CRUD słownika atrybutów + agregaty — zachowanie z `mirror/backend/atrybuty_module.cjs`.
 *
 * Tu leży dowód dla kodów, których zamrożony `openapi.yaml` nie deklaruje (403/404/409 —
 * patrz nagłówek `atrybuty.gate.test.ts`) oraz dla liczb w `liczniki`/`uzycie`, których
 * fixture nie może udowodnić, bo pochodzą z zawartości `products` produkcji.
 *
 * Baza jest prawdziwa (SQLite w katalogu tymczasowym z kanonicznego `001_schema.sql`),
 * bez mocków — sprawdzamy też skutki uboczne w tabelach, nie tylko odpowiedzi.
 */
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { auditLog, atrybutyWartosci } from "../src/db/schema.js";
import { slugRodzaju, zasiejSlownikAtrybutow } from "../src/repos/atrybuty.js";
import { stworzSrodowiskoTestowe, zasiejProdukty, type SrodowiskoTestowe } from "./gate/index.js";

describe("atrybuty — CRUD słownika", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    zasiejSlownikAtrybutow(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterEach(() => srodowisko.posprzataj());

  const get = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);
  const post = (sciezka: string, cialo?: object) =>
    request(srodowisko.app).post(sciezka).set("Authorization", `Bearer ${token}`).send(cialo ?? {});
  const put = (sciezka: string, cialo?: object) =>
    request(srodowisko.app).put(sciezka).set("Authorization", `Bearer ${token}`).send(cialo ?? {});
  const del = (sciezka: string) =>
    request(srodowisko.app).delete(sciezka).set("Authorization", `Bearer ${token}`);

  describe("rodzaje", () => {
    it("POST bez `value` generuje slug z etykiety, rodzaj jest non-core", async () => {
      const odp = await post("/api/atrybuty/rodzaje", { label: "Głębokość bieżnika", opis: "mm" });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        rodzaj: { value: "glebokosc_bieznika", label: "Głębokość bieżnika", opis: "mm", core: 0 },
      });
    });

    /**
     * Slug obcina do 32 znaków (`:136`) — i robi to PO zamianie znaków, więc dwie różne
     * długie etykiety mogą dać ten sam klucz i drugi zapis dostanie 409. Zastane.
     */
    it("slug obcina do 32 znaków i normalizuje polskie znaki", () => {
      expect(slugRodzaju("Zażółć gęślą jaźń")).toBe("zazolc_gesla_jazn");
      expect(slugRodzaju("A".repeat(40))).toHaveLength(32);
      expect(slugRodzaju("!!!")).toBe("");
    });

    it("POST z samą etykietą nie do przetłumaczenia na slug → 400", async () => {
      const odp = await post("/api/atrybuty/rodzaje", { label: "!!!" });
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({
        ok: false,
        error: "Nie udało się wygenerować value z label",
      });
    });

    it("POST bez etykiety → 400 „Brak label”", async () => {
      const odp = await post("/api/atrybuty/rodzaje", { value: "cos" });
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ ok: false, error: "Brak label" });
    });

    it("POST duplikatu → 409", async () => {
      const odp = await post("/api/atrybuty/rodzaje", { value: "marka", label: "Marka" });
      expect(odp.status).toBe(409);
      expect(odp.body).toEqual({ ok: false, error: "Rodzaj 'marka' już istnieje" });
    });

    /**
     * ⚠ ASYMETRIA Z ORYGINAŁU: `core` blokuje USUNIĘCIE (`:174`), ale NIE edycję (`:153-166`).
     * Wbudowany rodzaj można więc przemianować i to jest zachowanie produkcji.
     */
    it("PUT działa także dla rodzaju wbudowanego (core nie blokuje edycji)", async () => {
      const odp = await put("/api/atrybuty/rodzaje/marka", { label: "Producent" });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true });

      const lista = await get("/api/atrybuty/rodzaje");
      const marka = (lista.body as { rodzaje: { value: string; label: string; core: number }[] })
        .rodzaje.find((r) => r.value === "marka");
      expect(marka).toMatchObject({ label: "Producent", core: 1 });
    });

    it("PUT z pustym `label` NIE czyści pola (COALESCE po `|| null`)", async () => {
      await put("/api/atrybuty/rodzaje/marka", { label: "" });
      const lista = await get("/api/atrybuty/rodzaje");
      const marka = (lista.body as { rodzaje: { value: string; label: string }[] }).rodzaje.find(
        (r) => r.value === "marka",
      );
      expect(marka?.label).toBe("Marka");
    });

    it("PUT nieistniejącego → 404", async () => {
      const odp = await put("/api/atrybuty/rodzaje/nie_ma", { label: "X" });
      expect(odp.status).toBe(404);
      expect(odp.body).toEqual({ ok: false, error: "Nie znaleziono" });
    });

    it("DELETE rodzaju wbudowanego → 403", async () => {
      const odp = await del("/api/atrybuty/rodzaje/marka");
      expect(odp.status).toBe(403);
      expect(odp.body).toEqual({ ok: false, error: "Nie można usunąć wbudowanego rodzaju" });
    });

    it("DELETE nieistniejącego → 404", async () => {
      const odp = await del("/api/atrybuty/rodzaje/nie_ma");
      expect(odp.status).toBe(404);
    });

    /** Kaskada z klucza obcego — działa dzięki `PRAGMA foreign_keys = ON` (`db/index.ts:18`). */
    it("DELETE rodzaju non-core kasuje kaskadą jego wartości", async () => {
      await post("/api/atrybuty/rodzaje", { value: "pr", label: "PR" });
      await post("/api/atrybuty/wartosci", { rodzaj: "pr", wartosc: "12PR" });
      await post("/api/atrybuty/wartosci", { rodzaj: "pr", wartosc: "16PR" });

      const przed = await get("/api/atrybuty/wartosci?rodzaj=pr");
      expect((przed.body as { wartosci: unknown[] }).wartosci).toHaveLength(2);

      const odp = await del("/api/atrybuty/rodzaje/pr");
      expect(odp.status).toBe(200);

      const po = await get("/api/atrybuty/wartosci?rodzaj=pr");
      expect((po.body as { wartosci: unknown[] }).wartosci).toHaveLength(0);
    });
  });

  describe("wartości", () => {
    it("POST dodaje wartość i zwraca ją z nadanym id", async () => {
      const odp = await post("/api/atrybuty/wartosci", { rodzaj: "kategoria", wartosc: "Quady" });
      expect(odp.status).toBe(200);
      expect(odp.body).toMatchObject({
        ok: true,
        wartosc: { rodzaj: "kategoria", wartosc: "Quady" },
      });
      expect(typeof (odp.body as { wartosc: { id: number } }).wartosc.id).toBe("number");
    });

    it("POST przycina białe znaki, a samą spację odrzuca jako pustą wartość", async () => {
      const zeSpacjami = await post("/api/atrybuty/wartosci", {
        rodzaj: "kategoria",
        wartosc: "  Quady  ",
      });
      expect((zeSpacjami.body as { wartosc: { wartosc: string } }).wartosc.wartosc).toBe("Quady");

      const pusta = await post("/api/atrybuty/wartosci", { rodzaj: "kategoria", wartosc: "   " });
      expect(pusta.status).toBe(400);
      expect(pusta.body).toEqual({ ok: false, error: "Pusta wartość" });
    });

    it("POST bez pól → 400, dla nieznanego rodzaju → 400 z nazwą rodzaju", async () => {
      const bezPol = await post("/api/atrybuty/wartosci", {});
      expect(bezPol.status).toBe(400);
      expect(bezPol.body).toEqual({ ok: false, error: "Brak rodzaj lub wartosc" });

      const zlyRodzaj = await post("/api/atrybuty/wartosci", { rodzaj: "widmo", wartosc: "X" });
      expect(zlyRodzaj.status).toBe(400);
      expect(zlyRodzaj.body).toEqual({ ok: false, error: "Rodzaj 'widmo' nie istnieje" });
    });

    it("POST duplikatu w tym samym rodzaju → 409, w innym rodzaju przechodzi", async () => {
      const duplikat = await post("/api/atrybuty/wartosci", {
        rodzaj: "kategoria",
        wartosc: "Rolnicze",
      });
      expect(duplikat.status).toBe(409);
      expect(duplikat.body).toEqual({
        ok: false,
        error: "Taka wartość już istnieje dla tego rodzaju",
      });

      // UNIQUE jest na parze (rodzaj, wartosc) — ta sama nazwa pod innym rodzajem jest OK.
      const innyRodzaj = await post("/api/atrybuty/wartosci", {
        rodzaj: "bieznik",
        wartosc: "Rolnicze",
      });
      expect(innyRodzaj.status).toBe(200);
    });

    it("PUT zmienia wartość; 400 bez pola, 404 dla nieznanego id, 409 przy kolizji", async () => {
      const dodana = await post("/api/atrybuty/wartosci", {
        rodzaj: "kategoria",
        wartosc: "Quady",
      });
      const id = (dodana.body as { wartosc: { id: number } }).wartosc.id;

      const zmiana = await put(`/api/atrybuty/wartosci/${id}`, { wartosc: "Quady i ATV" });
      expect(zmiana.status).toBe(200);
      expect(zmiana.body).toEqual({ ok: true });

      const bezPola = await put(`/api/atrybuty/wartosci/${id}`, {});
      expect(bezPola.status).toBe(400);
      expect(bezPola.body).toEqual({ ok: false, error: "Brak wartosc" });

      const nieistnieje = await put("/api/atrybuty/wartosci/999999", { wartosc: "X" });
      expect(nieistnieje.status).toBe(404);

      const kolizja = await put(`/api/atrybuty/wartosci/${id}`, { wartosc: "Rolnicze" });
      expect(kolizja.status).toBe(409);
      expect(kolizja.body).toEqual({ ok: false, error: "Taka wartość już istnieje" });
    });

    it("DELETE usuwa wartość; nieznane id → 404", async () => {
      const dodana = await post("/api/atrybuty/wartosci", {
        rodzaj: "kategoria",
        wartosc: "Quady",
      });
      const id = (dodana.body as { wartosc: { id: number } }).wartosc.id;

      expect((await del(`/api/atrybuty/wartosci/${id}`)).status).toBe(200);
      expect((await del(`/api/atrybuty/wartosci/${id}`)).status).toBe(404);
    });

    it("GET z filtrem `rodzaj` zwraca tylko ten rodzaj, bez filtru — całość", async () => {
      const zFiltrem = await get("/api/atrybuty/wartosci?rodzaj=konstrukcja");
      const wartosci = (zFiltrem.body as { wartosci: { rodzaj: string; wartosc: string }[] })
        .wartosci;
      expect(wartosci.map((w) => w.wartosc)).toEqual(["B", "D", "R"]);

      const bezFiltru = await get("/api/atrybuty/wartosci");
      expect((bezFiltru.body as { wartosci: unknown[] }).wartosci.length).toBeGreaterThan(
        wartosci.length,
      );
    });
  });

  describe("audyt", () => {
    /**
     * Sześć tras CRUD pisze do `audit_log` (`be(…)` w oryginale). Trasy kolejki pending —
     * NIE (moduł nie dostaje `be`, `pending_module.cjs:199`); pilnuje tego
     * `atrybuty.pending.test.ts`.
     */
    it("CRUD rodzajów i wartości zostawia sześć rodzajów wpisów", async () => {
      await post("/api/atrybuty/rodzaje", { value: "pr", label: "PR" });
      await put("/api/atrybuty/rodzaje/pr", { label: "PR (płótna)" });
      const wartosc = await post("/api/atrybuty/wartosci", { rodzaj: "pr", wartosc: "12PR" });
      const id = (wartosc.body as { wartosc: { id: number } }).wartosc.id;
      await put(`/api/atrybuty/wartosci/${id}`, { wartosc: "12 PR" });
      await del(`/api/atrybuty/wartosci/${id}`);
      await del("/api/atrybuty/rodzaje/pr");

      const akcje = srodowisko.db
        .select({ akcja: auditLog.akcja, encjaTyp: auditLog.encjaTyp })
        .from(auditLog)
        .all()
        .map((w) => w.akcja);

      expect(akcje).toEqual(
        expect.arrayContaining([
          "atrybut_rodzaj_dodano",
          "atrybut_rodzaj_zmieniono",
          "atrybut_rodzaj_usunieto",
          "atrybut_wartosc_dodano",
          "atrybut_wartosc_zmieniono",
          "atrybut_wartosc_usunieto",
        ]),
      );
    });
  });

  describe("liczniki i użycie", () => {
    it("liczniki liczą produkty per rodzaj::wartosc i nie mają klucza `ok`", async () => {
      const odp = await get("/api/atrybuty/liczniki");
      const mapa = odp.body as Record<string, number>;

      expect(mapa).not.toHaveProperty("ok");
      expect(mapa["marka::BKT"]).toBe(2);
      expect(mapa["marka::MITAS"]).toBe(1);
      expect(mapa["konstrukcja::R"]).toBe(2);
      // Wartości puste i NULL są odfiltrowane, więc klucz z pustym napisem nie powstaje.
      expect(Object.keys(mapa).some((k) => k.endsWith("::"))).toBe(false);
    });

    /**
     * Mapa liczników ma 15 rodzajów, w tym `model` i `zastosowanie`, których NIE MA mapa
     * kolejki pending (13 rodzajów, `repos/atrybuty-pending.ts`). Rozbieżność jest
     * w oryginale i ten test ją utrwala, żeby nikt jej „nie posprzątał”.
     */
    it("liczniki obejmują rodzaj `model`, którego kolejka pending nie zna", async () => {
      const odp = await get("/api/atrybuty/liczniki");
      const mapa = odp.body as Record<string, number>;
      expect(mapa["model::AGRIMAX FACTOR"]).toBe(1);

      const { RODZAJE_KOLUMNY } = await import("../src/repos/atrybuty-pending.js");
      expect(Object.hasOwn(RODZAJE_KOLUMNY, "model")).toBe(false);
    });

    it("użycie: brak `wartosc` → 400, nieznany rodzaj → 400 z jego nazwą", async () => {
      const bezWartosci = await get("/api/atrybuty/uzycie?rodzaj=marka");
      expect(bezWartosci.status).toBe(400);
      expect(bezWartosci.body).toEqual({ ok: false, error: "Brak wartosc" });

      const zlyRodzaj = await get("/api/atrybuty/uzycie?rodzaj=widmo&wartosc=X");
      expect(zlyRodzaj.status).toBe(400);
      expect(zlyRodzaj.body).toEqual({ ok: false, error: "Nieznany rodzaj atrybutu: widmo" });
    });

    it("użycie zwraca produkty posortowane po nazwie, `count` niezależnie od limitu", async () => {
      const odp = await get("/api/atrybuty/uzycie?rodzaj=marka&wartosc=BKT");
      const cialo = odp.body as { count: number; products: { nazwa: string; kod: string }[] };
      expect(cialo.count).toBe(2);
      expect(cialo.products.map((p) => p.nazwa)).toEqual(
        [...cialo.products.map((p) => p.nazwa)].sort(),
      );
    });

    it("użycie nieistniejącej wartości → 200 z pustą listą, nie 404", async () => {
      const odp = await get("/api/atrybuty/uzycie?rodzaj=marka&wartosc=NIE_MA_TAKIEJ");
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true, count: 0, products: [] });
    });
  });

  describe("seed słownika", () => {
    /**
     * ⚠ „BIEŻNIK Z MODELU" JEST W ORYGINALE (`atrybuty_module.cjs:80-83`) — słownik `bieznik`
     * zasilany jest z `products.model`, choć `products` ma osobną kolumnę `bieznik`.
     * W danych testowych obie kolumny mają tę samą treść, więc sprawdzamy to wprost na
     * produkcie, w którym się różnią.
     */
    it("seed bierze wartości `bieznik` z kolumny `model`, nie `bieznik`", () => {
      // Rozjeżdżamy obie kolumny dla jednego produktu i powtarzamy seed (jak restart procesu).
      srodowisko.db.run(
        sql`UPDATE products SET model = 'MODEL_X', bieznik = 'BIEZNIK_Y' WHERE kod = 'MO1_100001'`,
      );
      zasiejSlownikAtrybutow(srodowisko.db);

      const wartosci = srodowisko.db
        .select({ wartosc: atrybutyWartosci.wartosc, rodzaj: atrybutyWartosci.rodzaj })
        .from(atrybutyWartosci)
        .all()
        .filter((w) => w.rodzaj === "bieznik")
        .map((w) => w.wartosc);

      expect(wartosci).toContain("MODEL_X");
      expect(wartosci).not.toContain("BIEZNIK_Y");
    });

    it("seed jest idempotentny — powtórzenie nie mnoży wierszy", () => {
      const przed = srodowisko.db.select().from(atrybutyWartosci).all().length;
      zasiejSlownikAtrybutow(srodowisko.db);
      zasiejSlownikAtrybutow(srodowisko.db);
      expect(srodowisko.db.select().from(atrybutyWartosci).all()).toHaveLength(przed);
    });
  });
});
