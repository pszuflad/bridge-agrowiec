/**
 * `POST /api/maintenance/usun-nieopony` i `POST /api/products/clear`
 * — port `deminified/backend-index.cjs:48392-48405` i `:48315-48334`.
 *
 * Nazwy pozycji są PRAWDZIWE (z importów MO4/MO5 widocznych w `contract/fixtures/GET_audit-log.json`
 * jako `odrzuconeNieOpony`), bo testujemy tu realny detektor `czyOpona()`, a nie atrapę.
 * Kopia bazy jest sprawdzana na pliku, nie na wywołaniu — bezpiecznik, którego nie widać
 * na dysku, nie jest bezpiecznikiem.
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, products } from "../src/db/schema.js";
import { listaProduktow } from "../src/repos/products.js";
import {
  stworzSrodowiskoTestowe,
  type NowyProdukt,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/**
 * Wiersz katalogu z kompletem kolumn `NOT NULL` — wartości poza `nazwa`/`kategoria` nie mają
 * dla tych tras znaczenia, bo `czyOpona()` patrzy WYŁĄCZNIE na te dwie.
 *
 * ⚠ Domyślna kategoria jest PUSTA, nie „opony". `czyOpona()` skleja nazwę z kategorią i szuka
 * w całości słów kluczowych, więc kategoria „opony" uznałaby za oponę DOWOLNĄ pozycję — łącznie
 * z tymi, które produkcja odrzuciła jako nie-opony. Test straciłby wtedy przedmiot.
 */
function produkt(dostawca: string, kod: string, nazwa: string, kategoria = ""): NowyProdukt {
  return {
    dostawca,
    kod,
    nazwa,
    marka: "TEST",
    kategoria,
    magazyn: "GL",
    stan: 4,
    cenaZakupu: 100,
    cenaSprzedazy: 150,
    marzaPct: 50,
    dataAktualizacji: "2026-08-17T15:49:19.820Z",
  };
}

const OPONY = [
  produkt("MO4", "P1", "MICHELIN 480/70R28 140D TL AGRIBIB"),
  produkt("MO5", "P2", "BKT AGRIMAX RT 855 320/85R24 122A8 TL"),
];

const NIE_OPONY = [
  produkt("MO4", "N1", "MO4_STFP2391000000000 — STARCO"),
  produkt("MO5", "N2", "Zawory do kół rolniczych komplet"),
  produkt("MO5", "N3", "Obręcz stalowa W10x24"),
  produkt("MO9", "N4", "BKT EARTHMAX SR 22 G 146A8/169A2 TL", "koła kompletne"),
];

describe("POST /api/maintenance/usun-nieopony", () => {
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
    srodowisko.sqlite.prepare("DELETE FROM products").run();
    srodowisko.sqlite.prepare("DELETE FROM audit_log").run();
  });

  const usun = () =>
    request(srodowisko.app)
      .post("/api/maintenance/usun-nieopony")
      .set("Authorization", `Bearer ${token}`);

  it("wymaga tokenu", async () => {
    expect((await request(srodowisko.app).post("/api/maintenance/usun-nieopony")).status).toBe(401);
  });

  it("pusty katalog daje zero i puste rozbicie", async () => {
    const odp = await usun();

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true, usuniete: 0, perDostawca: {}, przyklady: [] });
  });

  /**
   * Sedno tej trasy: opony ZOSTAJĄ, reszta znika. Gdyby ktoś podmienił detektor na własny,
   * ten test złapie rozjazd z silnikiem importu.
   */
  it("usuwa wyłącznie pozycje, które nie są oponami", async () => {
    srodowisko.db.insert(products).values([...OPONY, ...NIE_OPONY]).run();

    const odp = await usun();

    expect(odp.status).toBe(200);
    expect((odp.body as { usuniete: number }).usuniete).toBe(NIE_OPONY.length);

    const zostaly = listaProduktow(srodowisko.db);
    expect(zostaly.map((p) => p.kod).sort()).toEqual(["P1", "P2"]);
  });

  it("rozbija licznik na dostawców", async () => {
    srodowisko.db.insert(products).values([...OPONY, ...NIE_OPONY]).run();

    const odp = await usun();

    expect((odp.body as { perDostawca: Record<string, number> }).perDostawca).toEqual({
      MO4: 1,
      MO5: 2,
      MO9: 1,
    });
  });

  it("przykłady mają format dostawca/kod: nazwa i limit dziesięciu", async () => {
    const duzo = Array.from({ length: 15 }, (_, i) =>
      produkt("MO4", `N${i}`, `Zawory partia ${i}`),
    );
    srodowisko.db.insert(products).values(duzo).run();

    const odp = await usun();
    const { usuniete, przyklady } = odp.body as { usuniete: number; przyklady: string[] };

    expect(usuniete).toBe(15);
    expect(przyklady).toHaveLength(10);
    expect(przyklady[0]).toBe("MO4/N0: Zawory partia 0");
  });

  it("przycina nazwę w przykładzie do 60 znaków", async () => {
    const dluga = `Zawory ${"x".repeat(200)}`;
    srodowisko.db.insert(products).values([produkt("MO4", "N1", dluga)]).run();

    const odp = await usun();
    const przyklad = (odp.body as { przyklady: string[] }).przyklady[0]!;

    expect(przyklad).toBe(`MO4/N1: ${dluga.substring(0, 60)}`);
    expect(przyklad.length).toBe("MO4/N1: ".length + 60);
  });

  it("audytuje licznik i rozbicie, bez listy pozycji", async () => {
    srodowisko.db.insert(products).values([...OPONY, ...NIE_OPONY]).run();

    await usun();

    const wpisy = srodowisko.db.select().from(auditLog).all();
    expect(wpisy).toHaveLength(1);
    const wpis = wpisy[0]!;
    expect(wpis).toMatchObject({
      akcja: "maintenance_usun_nieopony",
      encjaTyp: "produkt",
      encjaId: "wszystkie",
    });
    expect(JSON.parse(wpis.szczegolyJson!)).toEqual({
      usuniete: 4,
      perDostawca: { MO4: 1, MO5: 2, MO9: 1 },
    });
    expect(wpis.szczegolyJson).not.toContain("przyklady");
  });
});

describe("POST /api/products/clear", () => {
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
    srodowisko.sqlite.prepare("DELETE FROM products").run();
    srodowisko.sqlite.prepare("DELETE FROM audit_log").run();
    srodowisko.db.insert(products).values([...OPONY, ...NIE_OPONY]).run();
    // Kopie z poprzednich testów — inaczej licznik plików rósłby z każdym przebiegiem.
    for (const plik of kopie()) rmSync(`${dirname(srodowisko.sciezka)}/${plik}`);
  });

  const wyczysc = (cialo: unknown) =>
    request(srodowisko.app)
      .post("/api/products/clear")
      .set("Authorization", `Bearer ${token}`)
      .send(cialo as object);

  /** Kopie leżą obok pliku bazy, w katalogu tymczasowym testu. */
  const kopie = () =>
    readdirSync(dirname(srodowisko.sciezka)).filter((n) => n.includes(".bak_before_clear_"));

  it("wymaga tokenu i nie kasuje nic bez niego", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/products/clear")
      .send({ potwierdzenie: "WYCZYSC" });

    expect(odp.status).toBe(401);
    expect(listaProduktow(srodowisko.db)).toHaveLength(6);
  });

  /**
   * ⚠ Porównanie jest ŚCISŁE. Ani inna wielkość liter, ani `true`, ani brak pola nie mogą
   * przejść — to jedyna rzecz stojąca między przypadkowym kliknięciem a pustym katalogiem.
   */
  it("odrzuca każde potwierdzenie inne niż dosłowne WYCZYSC i zostawia katalog nietknięty", async () => {
    for (const zle of [undefined, {}, { potwierdzenie: "wyczysc" }, { potwierdzenie: true }, { potwierdzenie: "WYCZYSC " }]) {
      const odp = await wyczysc(zle ?? {});

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toContain('{ potwierdzenie: "WYCZYSC" }');
      expect(listaProduktow(srodowisko.db)).toHaveLength(6);
    }

    expect(kopie()).toHaveLength(0);
    expect(srodowisko.db.select().from(auditLog).all()).toHaveLength(0);
  });

  it("z potwierdzeniem czyści cały katalog, wszystkich dostawców naraz", async () => {
    const odp = await wyczysc({ potwierdzenie: "WYCZYSC" });

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true });
    expect(listaProduktow(srodowisko.db)).toHaveLength(0);
  });

  /**
   * Bezpiecznik sprawdzany na dysku: plik kopii ma powstać PRZED czyszczeniem i ma być
   * niepusty. Sam fakt wywołania `copyFileSync` niczego by nie dowodził — przy bazie w trybie
   * WAL kopia bez checkpointu bywa cofnięta w czasie (plan.md D5).
   */
  it("zostawia niepustą kopię pliku bazy przed czyszczeniem", async () => {
    await wyczysc({ potwierdzenie: "WYCZYSC" });

    const pliki = kopie();
    expect(pliki).toHaveLength(1);
    expect(pliki[0]).toMatch(/\.bak_before_clear_\d{4}-\d{2}-\d{2}T[\d-]+Z$/);
    expect(statSync(`${dirname(srodowisko.sciezka)}/${pliki[0]}`).size).toBeGreaterThan(0);
  });

  /**
   * ⚠ Ten wiersz audytu ma `szczegoly_json = NULL` (`be()` bez szóstego argumentu, `:48332`)
   * — czyli dokładnie ten przypadek, na którym `GET /api/audit-log` musi się nie wywrócić.
   */
  it("audytuje czyszczenie wpisem bez szczegółów (NULL)", async () => {
    await wyczysc({ potwierdzenie: "WYCZYSC" });

    const wpisy = srodowisko.db.select().from(auditLog).all();
    expect(wpisy).toHaveLength(1);
    expect(wpisy[0]).toMatchObject({
      akcja: "czyszczenie_katalogu",
      encjaTyp: "produkt",
      encjaId: "wszystkie",
      szczegolyJson: null,
    });

    // Trasa surowego audytu musi ten wiersz oddać bez zmian.
    const audyt = await request(srodowisko.app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${token}`);
    expect((audyt.body as { szczegolyJson: unknown }[])[0]!.szczegolyJson).toBeNull();
  });
});
