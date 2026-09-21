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
  atrybutyRodzaje,
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
      // 13 rodzajów z `ZAKRES_SKANU`, nie wszystkie 15 z mapy rodzaj→kolumna.
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

    it("pozycja spoza słownika zostaje po skanie, nawet dopisana ręcznie", async () => {
      srodowisko.db
        .insert(atrybutyWartosciPending)
        .values({ rodzaj: "marka", wartosc: "WIDMO", ileWystapien: 1, dostawcy: "" })
        .run();

      await skanuj();
      expect(await pozycja("WIDMO")).toBeDefined();
    });
  });

  /**
   * Świadome odstępstwo, backlog #40, decyzja Ani 2026-09-21 (ticket 78): kolejka jest sprzątana
   * z pozycji, których wartość jest już dosłownie w słowniku tego rodzaju — na końcu każdego skanu
   * i przy starcie procesu, zaraz po seedzie. Oryginał tego nie robi, stąd w nagraniu produkcji
   * pozycje podpowiadające same siebie ze 100%.
   */
  describe("sprzątanie kolejki z wartości obecnych w słowniku (#40)", () => {
    const dodajDoKolejki = (rodzaj: string, wartosc: string) =>
      srodowisko.db
        .insert(atrybutyWartosciPending)
        .values({ rodzaj, wartosc, ileWystapien: 1, dostawcy: "" })
        .run();
    const dodajDoSlownika = (rodzaj: string, wartosc: string) =>
      srodowisko.db.insert(atrybutyWartosci).values({ rodzaj, wartosc }).run();
    // Rodzaje rdzenia (klucz obcy `atrybuty_wartosci.rodzaj`) zakłada seed przy tworzeniu
    // aplikacji testowej — na pustym jeszcze `products`, więc słownik marek startuje pusty.
    const wKolejce = (rodzaj: string, wartosc: string) =>
      srodowisko.db
        .select()
        .from(atrybutyWartosciPending)
        .all()
        .some((p) => p.rodzaj === rodzaj && p.wartosc === wartosc);

    it("skan usuwa pozycje obecne w słowniku — różnych rodzajów — i nie rusza produktów", async () => {
      await skanuj();
      expect(await pozycja("NOKIAN HAKKA")).toBeDefined();

      // wartości trafiają do słownika inną drogą (seed po restarcie, ręczne dodanie)
      dodajDoSlownika("marka", "NOKIAN HAKKA");
      dodajDoKolejki("kategoria", "Rolnicze"); // `CORE_WARTOSCI`, więc w słowniku od seedu
      const przed = markiProduktow();

      const odp = await skanuj();
      expect(odp.status).toBe(200);
      // kształt odpowiedzi bez zmian — liczba usuniętych idzie tylko do logu
      expect(Object.keys(odp.body as object).sort()).toEqual(
        ["nowych_wartosci", "ok", "skanowano_rodzajow", "zaktualizowano"].sort(),
      );
      expect(wKolejce("marka", "NOKIAN HAKKA")).toBe(false);
      expect(wKolejce("kategoria", "Rolnicze")).toBe(false);
      expect(markiProduktow()).toEqual(przed);
    });

    it("porównanie jest dokładne: „bkt” przy „BKT” w słowniku trafia do kolejki i zostaje", async () => {
      dodajDoSlownika("marka", "BKT");
      srodowisko.db
        .insert(products)
        .values({ ...PRODUKT_Z_NOWA_MARKA, kod: "MO1_BKT_MALE", marka: "bkt" })
        .run();

      await skanuj();
      await skanuj(); // drugi skan też jej nie sprząta

      const odp = await get("/api/atrybuty/pending?rodzaj=marka");
      const bkt = (
        odp.body as { items: { wartosc: string; sugerowane_aliasy: unknown[] }[] }
      ).items.find((i) => i.wartosc === "bkt");
      // #42: jedyną różnicą jest wielkość liter, więc alias „BKT” ze 100
      expect(bkt?.sugerowane_aliasy).toEqual([{ wartosc: "BKT", podobienstwo: 100 }]);
    });

    it("lista nie podpowiada samej siebie, zanim skan zdąży posprzątać", async () => {
      dodajDoKolejki("marka", "AGRI STAR II");
      dodajDoSlownika("marka", "AGRI STAR II"); // np. dodane ręcznie w słowniku, bez skanu

      const p = (
        (await get("/api/atrybuty/pending?rodzaj=marka")).body as {
          items: { wartosc: string; sugerowane_aliasy: { wartosc: string }[] }[];
        }
      ).items.find((i) => i.wartosc === "AGRI STAR II");
      expect(p).toBeDefined();
      expect(p!.sugerowane_aliasy.map((s) => s.wartosc)).not.toContain("AGRI STAR II");
    });

    it("start procesu sprząta kolejkę po seedzie (marka i bieżnik z `products`)", async () => {
      const { stworzApp } = await import("../src/app.js");
      // stan jak przed restartem: pozycje dodane skanem, zanim seed wsypał je do słownika
      await skanuj();
      expect(wKolejce("marka", "NOKIAN HAKKA")).toBe(true);
      const bieznik = PRODUKT_Z_NOWA_MARKA.bieznik!;
      expect(wKolejce("bieznik", bieznik)).toBe(true); // słownik `bieznik` był pusty przy skanie
      dodajDoKolejki("marka", "WIDMO"); // spoza słownika i spoza produktów — zostaje

      stworzApp({ env: srodowisko.env, db: srodowisko.db, sqlite: srodowisko.sqlite });

      expect(wKolejce("marka", "NOKIAN HAKKA")).toBe(false);
      expect(wKolejce("bieznik", bieznik)).toBe(false);
      expect(wKolejce("marka", "WIDMO")).toBe(true);
      expect(wSlowniku("marka", "NOKIAN HAKKA")).toBe(true);
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

    it("dla rodzaju spoza 15 znanych → 400 „Nieznany rodzaj”, pozycja zostaje", async () => {
      srodowisko.db
        .insert(atrybutyWartosciPending)
        .values({ rodzaj: "bieznik_zly", wartosc: "COKOLWIEK", ileWystapien: 1, dostawcy: "" })
        .run();
      const wpis = (await pozycja("COKOLWIEK"))!;

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-z-edycja`, {
        nowa_wartosc: "X",
      });
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ ok: false, error: "Nieznany rodzaj: bieznik_zly" });
      expect(await pozycja("COKOLWIEK")).toBeDefined();
    });
  });

  /**
   * Backlog #41 (decyzja Ani 2026-09-21, ticket 74): akceptacje korzystają z JEDNEJ,
   * 15-pozycyjnej mapy rodzaj→kolumna. W oryginale mapa kolejki nie znała `model`
   * i `zastosowanie`, więc obie akceptacje przepisujące produkty kończyły się tam 400.
   * Skan takich pozycji nadal nie tworzy (zakres skanu bez zmian) — wstawiamy je ręcznie.
   */
  describe("rodzaje `model` i `zastosowanie` (#41)", () => {
    /**
     * `atrybuty_wartosci.rodzaj` ma klucz obcy do `atrybuty_rodzaje`, a seed rebuildu zakłada
     * tylko pięć rodzajów rdzenia. W produkcji oba są w tabeli (`db/snapshot.db`: `model`
     * core=1, `zastosowanie` core=0, dodany ręcznie) — odtwarzamy ten stan dosłownie.
     */
    beforeEach(() => {
      srodowisko.db
        .insert(atrybutyRodzaje)
        .values([
          { value: "model", label: "Model", opis: "Model opony", core: 1 },
          {
            value: "zastosowanie",
            label: "Zastosowanie",
            opis: "Typ maszyny / zastosowanie opony (ciągnik, kombajn, ładowarka, koparka, przyczepa itd.)",
            core: 0,
          },
        ])
        .run();
    });

    const dodajPozycje = async (rodzaj: string, wartosc: string) => {
      srodowisko.db
        .insert(atrybutyWartosciPending)
        .values({ rodzaj, wartosc, ileWystapien: 1, dostawcy: "" })
        .run();
      return (await pozycja(wartosc))!;
    };

    const ileProduktow = (kolumna: "model" | "zastosowanie", wartosc: string) =>
      srodowisko.db
        .select({ model: products.model, zastosowanie: products.zastosowanie })
        .from(products)
        .all()
        .filter((p) => p[kolumna] === wartosc).length;

    it.each([
      ["model", "AGRIMAX FACTOR", "AGRIMAX FACTOR II"],
      ["zastosowanie", "Ciągnik", "Ciągnik rolniczy"],
    ] as const)("akceptacja z edycją dla `%s` przepisuje właściwą kolumnę", async (rodzaj, stara, nowa) => {
      const przed = ileProduktow(rodzaj, stara);
      expect(przed).toBeGreaterThan(0);
      const wpis = await dodajPozycje(rodzaj, stara);

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-z-edycja`, {
        nowa_wartosc: nowa,
      });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        akcja: "akceptowana_z_edycja",
        z: stara,
        na: nowa,
        produktow_zaktualizowano: przed,
      });
      expect(ileProduktow(rodzaj, stara)).toBe(0);
      expect(ileProduktow(rodzaj, nowa)).toBe(przed);
      expect(wSlowniku(rodzaj, nowa)).toBe(true);
    });

    it.each([
      ["model", "AGRIMAX FACTOR", "AGRIMAX KANON"],
      ["zastosowanie", "Ciągnik", "Rolnicze"],
    ] as const)("akceptacja jako alias dla `%s` przepisuje właściwą kolumnę", async (rodzaj, stara, kanoniczna) => {
      srodowisko.db.insert(atrybutyWartosci).values({ rodzaj, wartosc: kanoniczna }).run();
      const przed = ileProduktow(rodzaj, stara);
      expect(przed).toBeGreaterThan(0);
      const wpis = await dodajPozycje(rodzaj, stara);

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-jako-alias`, {
        kanoniczna_wartosc: kanoniczna,
      });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({
        ok: true,
        akcja: "akceptowana_jako_alias",
        z: stara,
        na: kanoniczna,
        produktow_zaktualizowano: przed,
      });
      expect(ileProduktow(rodzaj, stara)).toBe(0);
      expect(ileProduktow(rodzaj, kanoniczna)).toBe(przed);
    });

    it("skan nadal NIE tworzy pozycji rodzaju `model` ani `zastosowanie`", async () => {
      // Produkty testowe mają oba pola wypełnione wartościami spoza słownika.
      expect(ileProduktow("model", "AGRIMAX FACTOR")).toBeGreaterThan(0);
      expect(ileProduktow("zastosowanie", "Ciągnik")).toBeGreaterThan(0);

      await skanuj();
      const rodzaje = srodowisko.db
        .select({ rodzaj: atrybutyWartosciPending.rodzaj })
        .from(atrybutyWartosciPending)
        .all()
        .map((w) => w.rodzaj);
      expect(rodzaje.length).toBeGreaterThan(0);
      expect(rodzaje).not.toContain("model");
      expect(rodzaje).not.toContain("zastosowanie");
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

    /**
     * Sugestie są sortowane MALEJĄCO po podobieństwie i przycinane do PIĘCIU (`:242-243`).
     * Bez tego testu odwrócenie sortowania albo `slice(0, 4)` przeszłoby całą suitę, a to
     * pole widzi front 7b — na nim opiera się przycisk „akceptuj jako alias".
     */
    it("zwraca najwyżej 5 sugestii, malejąco po podobieństwie", async () => {
      // Rodzaj musi istnieć w słowniku — `atrybuty_wartosci.rodzaj` ma klucz obcy.
      const { zasiejSlownikAtrybutow } = await import("../src/repos/atrybuty.js");
      zasiejSlownikAtrybutow(srodowisko.db);

      // Siedmiu kandydatów w promieniu ≥ 0,9 od „ROZMIAR TESTOWY XX" (18 znaków, więc jedna
      // zmiana to 0,944, dwie 0,889 — wszystkie poniżej progu prócz jednoznakowych).
      const kanoniczne = [
        "ROZMIAR TESTOWY XA",
        "ROZMIAR TESTOWY XB",
        "ROZMIAR TESTOWY XC",
        "ROZMIAR TESTOWY XD",
        "ROZMIAR TESTOWY XE",
        "ROZMIAR TESTOWY XF",
        // Różni się tylko wielkością liter — po #42 podobieństwo 100, więc NA SZCZYCIE listy.
        "rozmiar testowy xx",
        // Identyczny z pozycją — po #40 NIE jest sugestią (dawniej był na szczycie ze 100).
        "ROZMIAR TESTOWY XX",
      ];
      for (const wartosc of kanoniczne) {
        srodowisko.db.insert(atrybutyWartosci).values({ rodzaj: "bieznik", wartosc }).run();
      }
      srodowisko.db
        .insert(atrybutyWartosciPending)
        .values({ rodzaj: "bieznik", wartosc: "ROZMIAR TESTOWY XX", ileWystapien: 1, dostawcy: "" })
        .run();

      const items = ((await get("/api/atrybuty/pending?rodzaj=bieznik")).body as {
        items: {
          wartosc: string;
          sugerowane_aliasy: { wartosc: string; podobienstwo: number }[];
        }[];
      }).items;
      const sugestie = items.find((i) => i.wartosc === "ROZMIAR TESTOWY XX")!.sugerowane_aliasy;

      expect(sugestie).toHaveLength(5);
      expect(sugestie[0]).toEqual({ wartosc: "rozmiar testowy xx", podobienstwo: 100 });
      expect(sugestie.map((s) => s.wartosc)).not.toContain("ROZMIAR TESTOWY XX");
      expect(sugestie.map((s) => s.podobienstwo)).toEqual(
        [...sugestie.map((s) => s.podobienstwo)].sort((a, b) => b - a),
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

  /**
   * Backlog #39 (decyzja Ani 2026-09-21, ticket 74) — ŚWIADOME ODSTĘPSTWO: oryginał nie audytuje
   * kolejki wcale (`pending_module.cjs:199` nie dostaje funkcji `be`). Odbudowa zapisuje
   * `atrybut_pending_*` dla każdej trasy, która coś zmienia; `GET` nie loguje.
   */
  describe("audyt (#39)", () => {
    type Wpis = typeof auditLog.$inferSelect;
    const wpisy = (): Wpis[] => srodowisko.db.select().from(auditLog).all();
    const ostatni = (): Wpis => wpisy().at(-1)!;
    const szczegoly = (w: Wpis): unknown => JSON.parse(w.szczegolyJson ?? "null");

    it("akceptacja z edycją: akcja, encja, użytkownik i szczegóły odtwarzają zmianę", async () => {
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;
      await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-z-edycja`, { nowa_wartosc: "NOKIAN" });

      const w = ostatni();
      expect(w.akcja).toBe("atrybut_pending_zaakceptowano_z_edycja");
      expect(w.encjaTyp).toBe("atrybut_pending");
      expect(w.encjaId).toBe(String(wpis.id));
      expect(w.uzytkownikImie).toBeTruthy();
      expect(szczegoly(w)).toEqual({
        rodzaj: "marka",
        kolumna: "marka",
        z: "NOKIAN HAKKA",
        na: "NOKIAN",
        produktow_zaktualizowano: 1,
      });
    });

    it("akceptacja jako alias: liczba przepisanych produktów z `UPDATE`", async () => {
      srodowisko.db.insert(atrybutyWartosci).values({ rodzaj: "marka", wartosc: "BKT" }).run();
      srodowisko.db
        .insert(atrybutyWartosciPending)
        .values({ rodzaj: "marka", wartosc: "MITAS", ileWystapien: 1, dostawcy: "" })
        .run();
      const wpis = (await pozycja("MITAS"))!;
      const przed = markiProduktow().filter((p) => p.marka === "MITAS").length;
      expect(przed).toBeGreaterThan(0);

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-jako-alias`, {
        kanoniczna_wartosc: "BKT",
      });
      expect(odp.body).toMatchObject({ produktow_zaktualizowano: przed });

      const w = ostatni();
      expect(w.akcja).toBe("atrybut_pending_zaakceptowano_jako_alias");
      expect(w.encjaId).toBe(String(wpis.id));
      expect(szczegoly(w)).toEqual({
        rodzaj: "marka",
        kolumna: "marka",
        z: "MITAS",
        na: "BKT",
        produktow_zaktualizowano: przed,
      });
    });

    it("akceptacja, odrzucenie, czyszczenie i skan zostawiają własne wpisy; lista nie", async () => {
      const staty = (await skanuj()).body as Record<string, unknown>;
      expect(ostatni().akcja).toBe("atrybut_pending_skanowano");
      expect(ostatni().encjaId).toBeNull();
      expect(szczegoly(ostatni())).toEqual({
        skanowano_rodzajow: staty.skanowano_rodzajow,
        nowych_wartosci: staty.nowych_wartosci,
        zaktualizowano: staty.zaktualizowano,
      });

      const akceptowana = (await pozycja("NOKIAN HAKKA"))!;
      await post(`/api/atrybuty/pending/${akceptowana.id}/akceptuj`);
      expect(ostatni().akcja).toBe("atrybut_pending_zaakceptowano");
      expect(ostatni().encjaId).toBe(String(akceptowana.id));
      expect(szczegoly(ostatni())).toEqual({ rodzaj: "marka", wartosc: "NOKIAN HAKKA" });

      const odrzucana = (await get("/api/atrybuty/pending")).body.items[0] as {
        id: number;
        rodzaj: string;
        wartosc: string;
      };
      await post(`/api/atrybuty/pending/${odrzucana.id}/odrzuc`);
      expect(ostatni().akcja).toBe("atrybut_pending_odrzucono");
      expect(szczegoly(ostatni())).toEqual({ rodzaj: odrzucana.rodzaj, wartosc: odrzucana.wartosc });

      const zostalo = ((await get("/api/atrybuty/pending")).body as { count: number }).count;
      const ileWpisow = wpisy().length;
      await get("/api/atrybuty/pending");
      expect(wpisy()).toHaveLength(ileWpisow);

      await del("/api/atrybuty/pending");
      expect(ostatni().akcja).toBe("atrybut_pending_wyczyszczono");
      expect(ostatni().encjaId).toBeNull();
      expect(szczegoly(ostatni())).toEqual({ rodzaj: null, usunieto: zostalo });
    });

    /**
     * Ania chciała śladu „w historii", więc wpis w `audit_log` nie wystarcza: musi go oddać
     * `GET /api/history/paged`. Widoczne są wyłącznie dwie akcje przepisujące produkty.
     */
    it("widok Historii pokazuje edycję i alias z kolejki, a pozostałe akcje pomija", async () => {
      srodowisko.db.insert(atrybutyWartosci).values({ rodzaj: "marka", wartosc: "BKT" }).run();
      await skanuj();
      const edytowana = (await pozycja("NOKIAN HAKKA"))!;
      await post(`/api/atrybuty/pending/${edytowana.id}/akceptuj-z-edycja`, {
        nowa_wartosc: "NOKIAN",
      });
      const aliasowana = (await pozycja("MITAS"))!;
      await post(`/api/atrybuty/pending/${aliasowana.id}/akceptuj-jako-alias`, {
        kanoniczna_wartosc: "BKT",
      });
      const odrzucana = (await get("/api/atrybuty/pending")).body.items[0] as { id: number };
      await post(`/api/atrybuty/pending/${odrzucana.id}/odrzuc`);
      await del("/api/atrybuty/pending");

      type Strona = {
        total: number;
        items: {
          typ: string;
          uzytkownik: string | null;
          liczbaPozycji: number | null;
          kodProduktu: string | null;
          zmienionePola: string[];
        }[];
      };
      const strona = (await get("/api/history/paged?typ=all")).body as Strona;
      expect(strona.total).toBe(2);
      // Kolejność po `kiedy` — dwie akcje w tej samej milisekundzie dałyby remis, stąd sort.
      expect(
        strona.items
          .map((w) => [w.typ, w.liczbaPozycji, w.kodProduktu, w.zmienionePola])
          .sort((a, b) => String(a[2]).localeCompare(String(b[2]))),
      ).toEqual([
        ["edycja", 1, "marka: „MITAS” → „BKT”", ["marka (alias z kolejki)"]],
        ["edycja", 1, "marka: „NOKIAN HAKKA” → „NOKIAN”", ["marka (edycja z kolejki)"]],
      ]);
      expect(strona.items.every((w) => w.uzytkownik)).toBe(true);

      // Filtr „Edycje" i wyszukiwarka (po `uwagi`, których front przy edycji nie rysuje).
      expect(((await get("/api/history/paged?typ=edycja")).body as Strona).total).toBe(2);
      const szukane = (await get("/api/history/paged?search=alias")).body as Strona;
      expect(szukane.items.map((w) => w.kodProduktu)).toEqual(["marka: „MITAS” → „BKT”"]);
    });

    it("odrzucone żądania (404, 400) nie zostawiają wpisu", async () => {
      const ileWpisow = wpisy().length;
      await post("/api/atrybuty/pending/999999/akceptuj");
      await post("/api/atrybuty/pending/999999/akceptuj-z-edycja", { nowa_wartosc: "X" });
      await post("/api/atrybuty/pending/999999/odrzuc");
      expect(wpisy()).toHaveLength(ileWpisow);
    });

    it("skan z hooka akceptacji stagingu NIE jest audytowany jako akcja kolejki", async () => {
      await post("/api/staging/accept", { ids: [] });
      expect(wpisy().some((w) => w.akcja === "atrybut_pending_skanowano")).toBe(false);
    });

    it("awaria zapisu audytu nie zamienia udanej akceptacji w 500", async () => {
      await skanuj();
      const wpis = (await pozycja("NOKIAN HAKKA"))!;
      srodowisko.db.run(sql`DROP TABLE audit_log`);

      const odp = await post(`/api/atrybuty/pending/${wpis.id}/akceptuj-z-edycja`, {
        nowa_wartosc: "NOKIAN",
      });
      expect(odp.status).toBe(200);
      expect(odp.body).toMatchObject({ ok: true, produktow_zaktualizowano: 1 });
      expect(markiProduktow().find((p) => p.kod === "MO1_NOWA")?.marka).toBe("NOKIAN");
    });
  });
});
