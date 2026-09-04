/**
 * Kolejka pending atrybutów — pełny workflow z `mirror/backend/pending_module.cjs`.
 *
 * Testujemy SKUTKI, nie tylko odpowiedzi: co po każdej akcji zostaje w `atrybuty_wartosci`,
 * `atrybuty_wartosci_pending`, `atrybuty_wartosci_odrzucone` i w `products`. Trzy warianty
 * akceptacji różnią się właśnie skutkami ubocznymi, a nie kształtem odpowiedzi:
 *
 *   akceptuj            → wartość do słownika, `products` NIETKNIĘTE
 *   akceptuj-z-edycja   → `UPDATE products` + poprawiona wartość do słownika
 *   akceptuj-jako-alias → `UPDATE products` na wartość kanoniczną, do słownika NIC nie wchodzi
 *   odrzuc              → wpis do `_odrzucone`, kolejne skany pomijają wartość
 *
 * Baza prawdziwa, bez mocków.
 */
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  atrybutyWartosci,
  atrybutyWartosciOdrzucone,
  atrybutyWartosciPending,
  auditLog,
  products,
} from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, zasiejProdukty, type SrodowiskoTestowe } from "./gate/index.js";
import { PRODUKTY_TESTOWE } from "./gate/dane.js";

/** Produkt z marką spoza słownika — paliwo dla skanu. */
const PRODUKT_Z_NOWA_MARKA = {
  ...PRODUKTY_TESTOWE[0]!,
  kod: "MO1_NOWA",
  nazwa: "Opona z nową marką",
  marka: "NOKIAN HAKKA",
  dostawca: "MO1",
  ean: null,
  eanRaw: null,
};

/** Ten sam produkt u dostawcy MO6, którego skan ma pomijać (`pending_module.cjs:91`). */
const PRODUKT_MO6 = {
  ...PRODUKTY_TESTOWE[0]!,
  kod: "MO6_POMINIETY",
  nazwa: "Opona od MO6",
  marka: "MARKA_TYLKO_MO6",
  dostawca: "MO6",
  ean: null,
  eanRaw: null,
};

describe("atrybuty — kolejka pending", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db, [...PRODUKTY_TESTOWE, PRODUKT_Z_NOWA_MARKA, PRODUKT_MO6]);
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
  const del = (sciezka: string) =>
    request(srodowisko.app).delete(sciezka).set("Authorization", `Bearer ${token}`);

  /** Kolejka jest pusta, dopóki ktoś nie uruchomi skanu — tabele startują puste. */
  const skanuj = () => post("/api/atrybuty/scan-pending");

  const pozycja = async (wartosc: string) => {
    const odp = await get("/api/atrybuty/pending");
    const items = (odp.body as { items: { id: number; wartosc: string; rodzaj: string }[] }).items;
    return items.find((i) => i.wartosc === wartosc);
  };

  const wSlowniku = (rodzaj: string, wartosc: string) =>
    srodowisko.db
      .select()
      .from(atrybutyWartosci)
      .all()
      .some((w) => w.rodzaj === rodzaj && w.wartosc === wartosc);

  const markiProduktow = () =>
    srodowisko.db
      .select({ kod: products.kod, marka: products.marka })
      .from(products)
      .all();

  describe("scan-pending", () => {
    it("wykrywa wartości spoza słownika i zwraca statystyki", async () => {
      const odp = await skanuj();
      expect(odp.status).toBe(200);
      const staty = odp.body as {
        ok: boolean;
        skanowano_rodzajow: number;
        nowych_wartosci: number;
        zaktualizowano: number;
      };
      expect(staty.ok).toBe(true);
      // 13 rodzajów z mapy kolejki (`RODZAJE_KOLUMNY`), nie 15 z mapy liczników.
      expect(staty.skanowano_rodzajow).toBe(13);
      expect(staty.nowych_wartosci).toBeGreaterThan(0);
      expect(staty.zaktualizowano).toBe(0);

      expect(await pozycja("NOKIAN HAKKA")).toBeDefined();
    });

    it("pomija dostawcę MO6", async () => {
      await skanuj();
      expect(await pozycja("MARKA_TYLKO_MO6")).toBeUndefined();
    });

    it("pomija wartości obecne już w słowniku", async () => {
      const { zasiejSlownikAtrybutow } = await import("../src/repos/atrybuty.js");
      zasiejSlownikAtrybutow(srodowisko.db); // wsypuje wszystkie marki z `products`

      await skanuj();
      expect(await pozycja("NOKIAN HAKKA")).toBeUndefined();
    });

    /**
     * ⚠ `pierwszy_import` przy ponownym skanie ZOSTAJE — to znacznik pierwszego zauważenia
     * wartości. Aktualizuje się `ile_wystapien`, `ostatni_import` i `dostawcy` (`:120-126`).
     */
    it("ponowny skan aktualizuje pozycję, zachowując `pierwszy_import`", async () => {
      await skanuj();
      const przed = srodowisko.db
        .select()
        .from(atrybutyWartosciPending)
        .all()
        .find((p) => p.wartosc === "NOKIAN HAKKA")!;

      // Cofamy znaczniki, żeby zobaczyć, który z nich skan nadpisze.
      srodowisko.db.run(sql`
        UPDATE atrybuty_wartosci_pending
        SET pierwszy_import = '2020-01-01 00:00:00', ostatni_import = '2020-01-01 00:00:00'
        WHERE id = ${przed.id}
      `);

      const drugi = await skanuj();
      expect((drugi.body as { zaktualizowano: number }).zaktualizowano).toBeGreaterThan(0);

      const po = srodowisko.db
        .select()
        .from(atrybutyWartosciPending)
        .all()
        .find((p) => p.id === przed.id)!;
      expect(po.pierwszyImport).toBe("2020-01-01 00:00:00");
      expect(po.ostatniImport).not.toBe("2020-01-01 00:00:00");
    });

    it("nie czyści kolejki — pozycja dopisana ręcznie zostaje po skanie", async () => {
      srodowisko.db
        .insert(atrybutyWartosciPending)
        .values({ rodzaj: "marka", wartosc: "WIDMO", ileWystapien: 1, dostawcy: "" })
        .run();

      await skanuj();
      expect(await pozycja("WIDMO")).toBeDefined();
    });
  });

  describe("akceptacja zwykła", () => {
    it("dodaje wartość do słownika, usuwa z kolejki i NIE rusza produktów", async () => {
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;
      const markiPrzed = markiProduktow();

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj`);
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        akcja: "akceptowana",
        rodzaj: "marka",
        wartosc: "NOKIAN HAKKA",
      });

      expect(wSlowniku("marka", "NOKIAN HAKKA")).toBe(true);
      expect(await pozycja("NOKIAN HAKKA")).toBeUndefined();
      expect(markiProduktow()).toEqual(markiPrzed);
    });

    it("po akceptacji kolejny skan już jej nie zgłasza", async () => {
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;
      await post(`/api/atrybuty/pending/${wpis.id}/akceptuj`);

      await skanuj();
      expect(await pozycja("NOKIAN HAKKA")).toBeUndefined();
    });
  });

  describe("akceptacja z edycją", () => {
    it("przepisuje produkty, dodaje poprawioną wartość i zwraca licznik zmian", async () => {
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-z-edycja`, {
        nowa_wartosc: "NOKIAN",
      });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        akcja: "akceptowana_z_edycja",
        z: "NOKIAN HAKKA",
        na: "NOKIAN",
        produktow_zaktualizowano: 1,
      });

      expect(wSlowniku("marka", "NOKIAN")).toBe(true);
      expect(wSlowniku("marka", "NOKIAN HAKKA")).toBe(false);
      expect(markiProduktow().find((p) => p.kod === "MO1_NOWA")?.marka).toBe("NOKIAN");
      expect(await pozycja("NOKIAN HAKKA")).toBeUndefined();
    });

    it("bez `nowa_wartosc` → 400, dla nieistniejącej pozycji → 404", async () => {
      const bezPola = await post("/api/atrybuty/pending/1/akceptuj-z-edycja", {});
      expect(bezPola.status).toBe(400);
      expect(bezPola.body).toEqual({ ok: false, error: "Brak nowa_wartosc" });

      const brakPozycji = await post("/api/atrybuty/pending/999999/akceptuj-z-edycja", {
        nowa_wartosc: "X",
      });
      expect(brakPozycji.status).toBe(404);
      expect(brakPozycji.body).toEqual({ ok: false, error: "Pozycja pending nie istnieje" });
    });

    /**
     * ⚠ Mapa kolejki nie zna rodzaju `model` ani `zastosowanie` (13 pozycji wobec 15 w mapie
     * liczników). Skan takich pozycji nie tworzy, ale gdyby jakaś powstała inną drogą,
     * akceptacja przepisująca produkty kończy się 400. Rozbieżność jest w oryginale.
     */
    it("dla rodzaju spoza mapy kolejki → 400 „Nieznany rodzaj”", async () => {
      srodowisko.db
        .insert(atrybutyWartosciPending)
        .values({ rodzaj: "model", wartosc: "COKOLWIEK", ileWystapien: 1, dostawcy: "" })
        .run();
      const wpis = (await pozycja("COKOLWIEK"))!;

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-z-edycja`, {
        nowa_wartosc: "X",
      });
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ ok: false, error: "Nieznany rodzaj: model" });
    });
  });

  describe("akceptacja jako alias", () => {
    it("przepisuje produkty na kanoniczną i NIE dodaje aliasu do słownika", async () => {
      srodowisko.db
        .insert(atrybutyWartosci)
        .values({ rodzaj: "marka", wartosc: "NOKIAN" })
        .run();
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-jako-alias`, {
        kanoniczna_wartosc: "NOKIAN",
      });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        akcja: "akceptowana_jako_alias",
        z: "NOKIAN HAKKA",
        na: "NOKIAN",
        produktow_zaktualizowano: 1,
      });

      expect(markiProduktow().find((p) => p.kod === "MO1_NOWA")?.marka).toBe("NOKIAN");
      // Alias NIGDZIE nie zostaje — nie ma tabeli aliasów, jest tylko przepisanie produktów.
      expect(wSlowniku("marka", "NOKIAN HAKKA")).toBe(false);
      expect(await pozycja("NOKIAN HAKKA")).toBeUndefined();
    });

    it("kanoniczna spoza słownika → 400 z jej nazwą i nazwą rodzaju", async () => {
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-jako-alias`, {
        kanoniczna_wartosc: "WIDMO",
      });
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({
        ok: false,
        error: 'Kanoniczna "WIDMO" nie istnieje w katalogu marka',
      });
      // Pozycja ZOSTAJE w kolejce — nieudana akcja nie może jej skasować.
      expect(await pozycja("NOKIAN HAKKA")).toBeDefined();
    });

    it("bez `kanoniczna_wartosc` → 400", async () => {
      const odp = await post("/api/atrybuty/pending/1/akceptuj-jako-alias", {});
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ ok: false, error: "Brak kanoniczna_wartosc" });
    });
  });

  describe("odrzucenie", () => {
    it("przenosi wartość do odrzuconych i kolejny skan ją pomija", async () => {
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/odrzuc`);
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        akcja: "odrzucona",
        rodzaj: "marka",
        wartosc: "NOKIAN HAKKA",
      });

      const odrzucone = srodowisko.db.select().from(atrybutyWartosciOdrzucone).all();
      expect(odrzucone.map((o) => o.wartosc)).toContain("NOKIAN HAKKA");
      expect(wSlowniku("marka", "NOKIAN HAKKA")).toBe(false);

      await skanuj();
      expect(await pozycja("NOKIAN HAKKA")).toBeUndefined();
    });

    it("nieistniejąca pozycja → 404", async () => {
      const odp = await post("/api/atrybuty/pending/999999/odrzuc");
      expect(odp.status).toBe(404);
      expect(odp.body).toEqual({ ok: false, error: "Pozycja pending nie istnieje" });
    });
  });

  describe("czyszczenie kolejki", () => {
    /**
     * ⚠ Czyszczenie NIE jest odrzuceniem: nie zostawia śladu w `_odrzucone`, więc wartości
     * WRÓCĄ przy kolejnym skanie, dopóki produkty je zawierają (`:374-376`).
     */
    it("DELETE bez filtru czyści całość, a wartości wracają po skanie", async () => {
      await skanuj();
      const ile = (await get("/api/atrybuty/pending")).body as { count: number };
      expect(ile.count).toBeGreaterThan(0);

      const odp = await del("/api/atrybuty/pending");
      expect(odp.body).toEqual({ ok: true, usunieto: ile.count, rodzaj: null });
      expect(((await get("/api/atrybuty/pending")).body as { count: number }).count).toBe(0);

      await skanuj();
      expect(await pozycja("NOKIAN HAKKA")).toBeDefined();
    });

    it("DELETE z `?rodzaj=` czyści tylko ten rodzaj", async () => {
      await skanuj();
      const przed = (await get("/api/atrybuty/pending")).body as {
        count: number;
        items: { rodzaj: string }[];
      };
      const marek = przed.items.filter((i) => i.rodzaj === "marka").length;
      expect(marek).toBeGreaterThan(0);

      const odp = await del("/api/atrybuty/pending?rodzaj=marka");
      expect(odp.body).toEqual({ ok: true, usunieto: marek, rodzaj: "marka" });

      const po = (await get("/api/atrybuty/pending")).body as { count: number };
      expect(po.count).toBe(przed.count - marek);
    });
  });

  describe("lista kolejki", () => {
    it("sortuje po rodzaju, malejąco po liczbie wystąpień, potem po wartości", async () => {
      await skanuj();
      const items = ((await get("/api/atrybuty/pending")).body as {
        items: { rodzaj: string; ile_wystapien: number; wartosc: string }[];
      }).items;

      const posortowane = [...items].sort(
        (a, b) =>
          a.rodzaj.localeCompare(b.rodzaj) ||
          b.ile_wystapien - a.ile_wystapien ||
          a.wartosc.localeCompare(b.wartosc),
      );
      expect(items.map((i) => `${i.rodzaj}::${i.wartosc}`)).toEqual(
        posortowane.map((i) => `${i.rodzaj}::${i.wartosc}`),
      );
    });

    it("filtr `?rodzaj=` zawęża listę, `count` liczy zwrócone pozycje", async () => {
      await skanuj();
      const odp = (await get("/api/atrybuty/pending?rodzaj=marka")).body as {
        count: number;
        items: { rodzaj: string }[];
      };
      expect(odp.items.every((i) => i.rodzaj === "marka")).toBe(true);
      expect(odp.count).toBe(odp.items.length);
    });
  });

  describe("hook po akceptacji stagingu", () => {
    /**
     * Produkcja instaluje ten skan monkey-patchem na `POST /api/staging/accept`
     * (`pending_module.cjs:145-192`); u nas jest to jawne wywołanie w trasie (plan.md D2).
     * Bez niego kolejka rosłaby wyłącznie z ręcznego `scan-pending`.
     */
    it("POST /api/staging/accept uruchamia skan i wypełnia kolejkę", async () => {
      expect(((await get("/api/atrybuty/pending")).body as { count: number }).count).toBe(0);

      const odp = await post("/api/staging/accept", { ids: [] });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true, accepted: 0 });

      expect(await pozycja("NOKIAN HAKKA")).toBeDefined();
    });
  });

  describe("audyt", () => {
    /**
     * ⚠ ŻADNA akcja kolejki nie pisze do `audit_log` — moduł oryginału nie dostaje funkcji
     * audytu (`pending_module.cjs:199` destrukturyzuje tylko `we`). Dotyczy to także akcji
     * przepisujących `products`. Odtworzone 1:1 na wyraźną decyzję użytkownika (plan.md D4);
     * ten test pilnuje, żeby audyt nie wkradł się tu przypadkiem.
     */
    it("akcje pending nie zostawiają wpisów w audit_log", async () => {
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;
      const przed = srodowisko.db.select().from(auditLog).all().length;

      await post(`/api/atrybuty/pending/${wpis.id}/akceptuj`);
      await skanuj();
      await del("/api/atrybuty/pending");

      expect(srodowisko.db.select().from(auditLog).all()).toHaveLength(przed);
    });
  });
});
