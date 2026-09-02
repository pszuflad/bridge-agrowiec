/**
 * Historia — odczyt end-to-end na prawdziwej bazie SQLite (bez mocków).
 *
 * GATE (`historia.gate.test.ts`) pilnuje kształtu wobec kontraktu; ten plik pilnuje
 * ZACHOWANIA trzech tras: filtrów, paginacji i odporności na wiersze audytu, które
 * są w bazie produkcyjnej od pierwszego dnia (NULL-owe szczegóły, kod dostawcy spoza
 * `suppliers`, zepsuty JSON).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { zapiszAudyt } from "../src/repos/audit.js";
import {
  stworzSrodowiskoTestowe,
  zasiejAudytHistorii,
  zasiejDziennikZmianZFixtures,
  type SrodowiskoTestowe,
} from "./gate/index.js";

type WpisOdpowiedzi = {
  id: number;
  typ: string;
  dostawca: string | null;
  kodProduktu: string | null;
  nazwaPliku: string | null;
  liczbaPozycji: number | null;
  uwagi: string | null;
};

type StronaOdpowiedzi = {
  items: WpisOdpowiedzi[];
  total: number;
  pages: number;
  page: number;
  limit: number;
};

describe("Historia — odczyt", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejDziennikZmianZFixtures(srodowisko.db);
    zasiejAudytHistorii(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  const paged = async (query = ""): Promise<StronaOdpowiedzi> =>
    (await zAuth(`/api/history/paged${query}`)).body as StronaOdpowiedzi;

  describe("GET /api/history", () => {
    it("zwraca gołą tablicę posortowaną malejąco po `data`", async () => {
      const odp = await zAuth("/api/history");
      const wiersze = odp.body as { data: string }[];

      expect(Array.isArray(wiersze)).toBe(true);
      const daty = wiersze.map((w) => w.data);
      expect([...daty].sort().reverse()).toEqual(daty);
    });

    it("nie przyjmuje paginacji — `limit` nie zmienia odpowiedzi (1:1 z oryginałem)", async () => {
      const bez = (await zAuth("/api/history")).body as unknown[];
      const z = (await zAuth("/api/history?limit=1&page=2")).body as unknown[];
      expect(z).toHaveLength(bez.length);
    });
  });

  describe("GET /api/history/paged — odporność na dane z produkcji", () => {
    /**
     * Ostrzeżenie z bloku I5 roadmapy. Seed wstawia `synchronizacja_reczna` ze
     * `szczegoly_json = NULL` i `encja_id = "MO99"` (dostawca spoza `suppliers`).
     * Ma zniknąć przez odsiew akcji — i nie wywrócić odczytu po drodze.
     */
    it("wpis z NULL-owymi szczegółami i kodem dostawcy spoza `suppliers` nie wywraca odczytu", async () => {
      const strona = await paged();
      expect(strona.items.every((w) => w.dostawca !== "MO99")).toBe(true);
      expect(strona.total).toBeGreaterThan(0);
    });

    /**
     * Seed ma dwa wiersze z zepsutym `szczegoly_json`: jeden przy akcji nierozpoznanej
     * (wypada na odsiewie) i jeden przy `upload_pliku` dla MO6, który przechodzi przez
     * pełne mapowanie. Ten drugi ma się pojawić w wyniku z pustymi szczegółami —
     * `JSON.parse` rzuca, oryginał to łyka i zwraca `{}`.
     */
    it("wpis z niepoprawnym JSON-em przy rozpoznanej akcji mapuje się na puste szczegóły", async () => {
      const strona = await paged("?dostawca=MO6&typ=import&limit=200");

      const zepsuty = strona.items.find((w) => w.nazwaPliku === null);
      expect(zepsuty).toBeDefined();
      expect(zepsuty).toMatchObject({
        typ: "import",
        dostawca: "MO6",
        nazwaPliku: null,
        liczbaPozycji: null,
        uwagi: "Plik: ?",
      });
    });

    it("akcje spoza słownika pięciu rozpoznawanych nie pojawiają się w wyniku (port 1:1)", async () => {
      const wszystkie = await paged("?limit=200");
      expect(wszystkie.items.every((w) => ["import", "eksport", "edycja"].includes(w.typ))).toBe(
        true,
      );
      // Seed: 5 edycji + 6 importów + 1 eksport = 12 rozpoznanych, 3 odsiane.
      expect(wszystkie.total).toBe(12);
    });
  });

  describe("GET /api/history/paged — filtry", () => {
    it("`typ` zwęża wynik do jednego rodzaju", async () => {
      const edycje = await paged("?typ=edycja&limit=200");
      expect(edycje.items).toHaveLength(5);
      expect(edycje.items.every((w) => w.typ === "edycja")).toBe(true);

      const eksporty = await paged("?typ=eksport&limit=200");
      expect(eksporty.items).toHaveLength(1);
    });

    it("`dostawca` zwęża wynik do jednego kodu, nieznany kod daje pustą stronę", async () => {
      const mo1 = await paged("?dostawca=MO1&limit=200");
      expect(mo1.items.every((w) => w.dostawca === "MO1")).toBe(true);
      expect(mo1.total).toBeGreaterThan(0);

      const nieistniejacy = await paged("?dostawca=NIE-MA&limit=200");
      expect(nieistniejacy).toMatchObject({ items: [], total: 0, pages: 1 });
    });

    it("`search` trafia w kod produktu i w treść zmiany", async () => {
      const poKodzie = await paged("?search=MO2_1147700&limit=200");
      expect(poKodzie.total).toBe(1);
      expect(poKodzie.items[0]?.kodProduktu).toBe("MO2_1147700");

      const poPolu = await paged("?search=labelSnow&limit=200");
      expect(poPolu.total).toBeGreaterThan(0);
    });

    it("filtry sumują się i domyślnie (`all`) nic nie odcinają", async () => {
      const razem = await paged("?typ=import&dostawca=MO1&limit=200");
      expect(razem.items.every((w) => w.typ === "import" && w.dostawca === "MO1")).toBe(true);

      const domyslnie = await paged("?typ=all&dostawca=all&limit=200");
      expect(domyslnie.total).toBe(12);
    });
  });

  describe("GET /api/history/paged — paginacja", () => {
    it("tnie wynik na strony i liczy `pages` z `total`", async () => {
      const pierwsza = await paged("?limit=4&page=1");
      expect(pierwsza).toMatchObject({ total: 12, pages: 3, page: 1, limit: 4 });
      expect(pierwsza.items).toHaveLength(4);

      const ostatnia = await paged("?limit=4&page=3");
      expect(ostatnia.items).toHaveLength(4);

      // Strony nie zachodzą na siebie — 8 różnych wpisów, nie 4 powtórzone dwa razy.
      const rozlaczne = new Set([
        ...pierwsza.items.map((w) => w.id),
        ...ostatnia.items.map((w) => w.id),
      ]);
      expect(rozlaczne.size).toBe(8);
    });

    it("strona poza zakresem daje pustą listę, ale poprawne `total`/`pages`", async () => {
      const poza = await paged("?limit=4&page=99");
      expect(poza).toMatchObject({ items: [], total: 12, pages: 3, page: 99, limit: 4 });
    });

    it("clamp parametrów: `page=0` → 1, `limit=abc` → 50, `limit=999` → 200", async () => {
      expect((await paged("?page=0")).page).toBe(1);
      expect((await paged("?limit=abc")).limit).toBe(50);
      expect((await paged("?limit=999")).limit).toBe(200);
    });
  });

  describe("GET /api/history/meta", () => {
    it("zwraca posortowaną listę dostawców z wpisów, które przeszły odsiew", async () => {
      const odp = await zAuth("/api/history/meta");
      const { dostawcy } = odp.body as { dostawcy: string[] };

      expect(dostawcy).toEqual(["MO1", "MO10", "MO2", "MO3", "MO6"]);
      // „MO99" wchodzi wyłącznie z `synchronizacja_reczna`, więc na tej liście go nie ma —
      // dokładnie tak jak w produkcji.
      expect(dostawcy).not.toContain("MO99");
    });

    it("nowy import od nieznanego dotąd dostawcy pojawia się na liście", async () => {
      zapiszAudyt(srodowisko.db, {
        uzytkownikId: 1,
        uzytkownikImie: "Marta Bieguniak",
        akcja: "upload_pliku",
        encjaTyp: "dostawca",
        encjaId: "MO7",
        szczegoly: { nazwaPliku: "mo7.xlsx", liczbaProduktow: 5 },
      });

      const odp = await zAuth("/api/history/meta");
      expect((odp.body as { dostawcy: string[] }).dostawcy).toContain("MO7");
    });
  });
});
