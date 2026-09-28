/**
 * `GET /api/dostawcy` i `GET /api/suppliers` — odtworzenie `U.listSuppliers`
 * (backend-index.cjs:45011-45036, rejestracja tras :48213-48216).
 *
 * Nacisk na trzy rzeczy liczone w locie, które nadpisują to, co leży w tabeli:
 * `liczbaProduktow`, przeliczony `status` i znaczniki ostatnich zmian z `historia_cen`.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listaDostawcow, przeliczStatus } from "../src/repos/suppliers.js";
import {
  DOSTAWCY_TESTOWI,
  stworzSrodowiskoTestowe,
  TERAZ_TESTOWE,
  zasiejDostawcow,
  zasiejHistorieCen,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

type Wiersz = {
  kod: string;
  status: string;
  liczbaProduktow: number;
  ostatniaAktualizacjaCeny: string | null;
  ostatniaAktualizacjaStanu: string | null;
};

describe("przeliczStatus — cztery gałęzie z oryginału", () => {
  const teraz = Date.parse("2026-08-13T12:00:00.000Z");
  const swiezy = "2026-08-12T09:00:00.000Z";
  const stary = "2026-06-01T09:00:00.000Z";

  it("plik starszy niż 30 dni ⇒ wstrzymany, niezależnie od liczby produktów", () => {
    expect(przeliczStatus("aktywny", stary, 500, teraz)).toBe("wstrzymany");
    expect(przeliczStatus("aktywny", stary, 0, teraz)).toBe("wstrzymany");
  });

  it("plik świeży, ale zero produktów ⇒ blad", () => {
    expect(przeliczStatus("aktywny", swiezy, 0, teraz)).toBe("blad");
  });

  it("plik świeży i są produkty ⇒ aktywny (nawet gdy kolumna mówi inaczej)", () => {
    expect(przeliczStatus("wstrzymany", swiezy, 12, teraz)).toBe("aktywny");
  });

  it("brak pliku i zero produktów ⇒ wstrzymany", () => {
    expect(przeliczStatus("aktywny", null, 0, teraz)).toBe("wstrzymany");
  });

  it("brak pliku, ale są produkty ⇒ status z kolumny zostaje nietknięty", () => {
    expect(przeliczStatus("aktywny", null, 3, teraz)).toBe("aktywny");
    expect(przeliczStatus("wstrzymany", null, 3, teraz)).toBe("wstrzymany");
  });
});

describe("GET /api/suppliers", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejDostawcow(srodowisko.db);
    zasiejProdukty(srodowisko.db);
    zasiejHistorieCen(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  it("bez tokenu obie trasy odpowiadają 401", async () => {
    for (const sciezka of ["/api/suppliers", "/api/dostawcy"]) {
      const odp = await request(srodowisko.app).get(sciezka);
      expect(odp.status, sciezka).toBe(401);
      expect(odp.body).toEqual({ error: "Nieautoryzowany" });
    }
  });

  it("zwraca dostawców posortowanych po kodzie", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/suppliers")
      .set("Authorization", `Bearer ${token}`);

    const kody = (odp.body as Wiersz[]).map((d) => d.kod);
    expect(kody).toEqual([...kody].sort());
    expect(kody).toHaveLength(DOSTAWCY_TESTOWI.length);
  });

  it("liczbaProduktow jest liczona z products, a nie brana z kolumny", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/suppliers")
      .set("Authorization", `Bearer ${token}`);
    const wiersze = odp.body as Wiersz[];

    const mo9 = wiersze.find((d) => d.kod === "MO9");
    // W tabeli `suppliers` MO9 ma zapisane 4210, w `products` są 2 produkty.
    expect(DOSTAWCY_TESTOWI.find((d) => d.kod === "MO9")?.liczbaProduktow).toBe(4210);
    expect(mo9?.liczbaProduktow).toBe(2);

    expect(wiersze.find((d) => d.kod === "MO1")?.liczbaProduktow).toBe(1);
    expect(wiersze.find((d) => d.kod === "MO2")?.liczbaProduktow).toBe(1);
  });

  it("status jest przeliczany — MO2 ma plik starszy niż 30 dni", () => {
    const wiersze = listaDostawcow(srodowisko.db, TERAZ_TESTOWE);
    expect(wiersze.find((d) => d.kod === "MO2")?.status).toBe("wstrzymany");
    expect(wiersze.find((d) => d.kod === "MO9")?.status).toBe("aktywny");
    expect(wiersze.find((d) => d.kod === "MO1")?.status).toBe("aktywny");
  });

  it("ostatnia zmiana ceny i stanu pochodzi z historia_cen (osobne daty)", () => {
    const mo9 = listaDostawcow(srodowisko.db, TERAZ_TESTOWE).find((d) => d.kod === "MO9");
    // Seed: cena zmieniła się 02.08, stan dopiero 03.08 — muszą wyjść dwie różne daty.
    expect(mo9?.ostatniaAktualizacjaCeny).toBe("2026-08-02T10:00:00.000Z");
    expect(mo9?.ostatniaAktualizacjaStanu).toBe("2026-08-03T10:00:00.000Z");
  });

  it("dostawca bez wpisów w historia_cen ma oba znaczniki na null", () => {
    const mo1 = listaDostawcow(srodowisko.db, TERAZ_TESTOWE).find((d) => d.kod === "MO1");
    expect(mo1?.ostatniaAktualizacjaCeny).toBeNull();
    expect(mo1?.ostatniaAktualizacjaStanu).toBeNull();
  });
});
