/**
 * `POST /api/maintenance/usun-nieopony` i `POST /api/products/clear`
 * — port `deminified/backend-index.cjs:48392-48405` i `:48315-48334`.
 *
 * Nazwy pozycji są PRAWDZIWE (z importów MO4/MO5 widocznych w `contract/fixtures/GET_audit-log.json`
 * jako `odrzuconeNieOpony`), bo testujemy tu realny detektor `czyOpona()`, a nie atrapę.
 * Kopia bazy jest sprawdzana na pliku, nie na wywołaniu — bezpiecznik, którego nie widać
 * na dysku, nie jest bezpiecznikiem.
 */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, manualOverrides, products } from "../src/db/schema.js";
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
  /**
   * Retencja kopii — ODSTĘPSTWO ŚWIADOME od oryginału (12e, D2d, backlog #49). Produkcja nie
   * sprząta tych plików nigdy, więc katalog danych rośnie z każdym kliknięciem „Usuń wszystko
   * z katalogu". Limit w kodzie to 5 NAJNOWSZYCH.
   *
   * Kopie z przeszłości podkładamy na dysk zamiast wywoływać trasę osiem razy: znacznik ma
   * rozdzielczość milisekundy, więc dwa szybkie wywołania mogłyby trafić w tę samą nazwę
   * i po cichu się nadpisać, a test mierzyłby wtedy co innego niż retencję.
   */
  it("po czyszczeniu zostaje 5 najnowszych kopii, starsze znikają", async () => {
    const katalog = dirname(srodowisko.sciezka);
    const nazwaBazy = basename(srodowisko.sciezka);
    const stare = [
      "2020-01-01T00-00-00-000Z",
      "2021-01-01T00-00-00-000Z",
      "2022-01-01T00-00-00-000Z",
      "2023-01-01T00-00-00-000Z",
      "2024-01-01T00-00-00-000Z",
      "2025-01-01T00-00-00-000Z",
      "2026-01-01T00-00-00-000Z",
    ];
    for (const znacznik of stare) {
      writeFileSync(join(katalog, `${nazwaBazy}.bak_before_clear_${znacznik}`), "stara kopia");
    }
    expect(kopie()).toHaveLength(7);

    const odp = await wyczysc({ potwierdzenie: "WYCZYSC" });
    expect(odp.status).toBe(200);

    const zostaly = kopie().sort();
    expect(zostaly).toHaveLength(5);
    // Cztery najnowsze podłożone + świeża z tego wywołania; najstarsze trzy skasowane.
    expect(zostaly.slice(0, 4)).toEqual([
      `${nazwaBazy}.bak_before_clear_2023-01-01T00-00-00-000Z`,
      `${nazwaBazy}.bak_before_clear_2024-01-01T00-00-00-000Z`,
      `${nazwaBazy}.bak_before_clear_2025-01-01T00-00-00-000Z`,
      `${nazwaBazy}.bak_before_clear_2026-01-01T00-00-00-000Z`,
    ]);
    expect(statSync(join(katalog, zostaly[4]!)).size).toBeGreaterThan(0);
  });

  /**
   * Sprzątanie jest BEST-EFFORT tak samo jak sama kopia: niemożność skasowania starego pliku
   * nie może zablokować czyszczenia katalogu. Zamiast atrapy `fs` podkładamy realny warunek
   * systemu plików — wpis o pasującej nazwie, który jest KATALOGIEM, więc `unlinkSync` na nim
   * pada. Trasa ma mimo to oddać 200 i wyczyścić produkty.
   */
  it("błąd sprzątania nie przerywa ani czyszczenia, ani kasowania POZOSTAŁYCH kopii", async () => {
    const katalog = dirname(srodowisko.sciezka);
    const nazwaBazy = basename(srodowisko.sciezka);
    const zepsuta = `${nazwaBazy}.bak_before_clear_2019-01-01T00-00-00-000Z`;
    mkdirSync(join(katalog, zepsuta));
    for (const rok of ["2020", "2021", "2022", "2023", "2024", "2025"]) {
      writeFileSync(join(katalog, `${nazwaBazy}.bak_before_clear_${rok}-01-01T00-00-00-000Z`), "x");
    }

    const odp = await wyczysc({ potwierdzenie: "WYCZYSC" });

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true });
    expect(listaProduktow(srodowisko.db)).toHaveLength(0);

    // 7 podłożonych + 1 świeża = 8; do skasowania 3 najstarsze. Najstarsza (`zepsuta`) jest
    // katalogiem i skasować się nie da — ale POZOSTAŁE DWIE muszą zniknąć mimo to. Gdyby
    // `try` obejmował całą pętlę, jeden zepsuty wpis blokowałby retencję trwale: zawsze
    // sortuje się jako najstarszy, więc przy każdym kolejnym czyszczeniu wywracałby ją znowu.
    const zostaly = kopie().sort();
    expect(zostaly).toContain(zepsuta);
    expect(zostaly).not.toContain(`${nazwaBazy}.bak_before_clear_2020-01-01T00-00-00-000Z`);
    expect(zostaly).not.toContain(`${nazwaBazy}.bak_before_clear_2021-01-01T00-00-00-000Z`);
    expect(zostaly).toHaveLength(6);

    // Sprzątamy sami: `beforeEach` kasuje kopie zwykłym `rmSync`, który na katalogu padłby.
    rmSync(join(katalog, `${nazwaBazy}.bak_before_clear_2019-01-01T00-00-00-000Z`), {
      recursive: true,
      force: true,
    });
  });
});

/**
 * `POST /api/products/dziedzicz-wage` — ticket 156 (NOWA logika, nie port; nadbudowa nad
 * ticketem 155). Trasa woła dokładnie tę samą funkcję co skrypt CLI `npm run dziedzicz-wage`
 * (`dziedziczWageWstecznie`, pokryta osobnymi testami jednostkowymi/integracyjnymi w
 * `dziedziczenie-wagi.test.ts`/`dziedziczenie-wagi.integracja.test.ts`) — tu sprawdzamy TYLKO
 * warstwę HTTP: autoryzację, kształt odpowiedzi i audyt.
 */
describe("POST /api/products/dziedzicz-wage", () => {
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
    srodowisko.sqlite.prepare("DELETE FROM manual_overrides").run();
  });

  const dziedzicz = () =>
    request(srodowisko.app)
      .post("/api/products/dziedzicz-wage")
      .set("Authorization", `Bearer ${token}`);

  function produktZWaga(kod: string, nadpisania: Partial<NowyProdukt> = {}): NowyProdukt {
    return {
      ...produkt("MO1", kod, "Opona testowa"),
      marka: "MITAS",
      szerokosc: "16.5",
      profil: null,
      srednica: 12,
      konstrukcja: "Diagonalna",
      bieznik: "AW",
      waga: null,
      ...nadpisania,
    };
  }

  it("wymaga tokenu", async () => {
    expect((await request(srodowisko.app).post("/api/products/dziedzicz-wage")).status).toBe(401);
  });

  it("uzupełnia pustą wagę dziedziczeniem i zwraca liczniki", async () => {
    srodowisko.db
      .insert(products)
      .values([
        produktZWaga("Z1", { waga: 78 }),
        produktZWaga("Z2", { waga: null }),
      ])
      .run();

    const odp = await dziedzicz();

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({
      ok: true,
      wszystkichKandydatow: 1,
      zaktualizowano: 1,
      pominietoOverride: 0,
      pominietoBrakDanych: 0,
      pominietoBrakDopasowania: 0,
    });

    const po = listaProduktow(srodowisko.db).find((p) => p.kod === "Z2")!;
    expect(po.waga).toBe(78);
    expect(po.wagaAutoUzupelniona).toBe(true);
  });

  it("pomija produkt chroniony ręczną poprawką wagi", async () => {
    srodowisko.db
      .insert(products)
      .values([produktZWaga("Z3", { waga: 78 }), produktZWaga("Z4", { waga: 0 })])
      .run();
    srodowisko.db
      .insert(manualOverrides)
      .values({
        supplierKod: "MO1",
        supplierProductId: "Z4",
        fieldName: "waga",
        overrideValue: "0",
        createdAt: "2026-09-25T00:00:00.000Z",
      })
      .run();

    const odp = await dziedzicz();

    expect(odp.body).toMatchObject({ zaktualizowano: 0, pominietoOverride: 1 });
    const po = listaProduktow(srodowisko.db).find((p) => p.kod === "Z4")!;
    expect(po.waga).toBe(0);
  });

  it("audytuje przebieg z licznikami w szczegółach", async () => {
    srodowisko.db
      .insert(products)
      .values([produktZWaga("Z5", { waga: 78 }), produktZWaga("Z6", { waga: null })])
      .run();

    await dziedzicz();

    const wpisy = srodowisko.db.select().from(auditLog).all();
    expect(wpisy).toHaveLength(1);
    expect(wpisy[0]).toMatchObject({
      akcja: "dziedziczenie_wagi_wsteczne",
      encjaTyp: "produkt",
      encjaId: "wszystkie",
    });
    expect(JSON.parse(wpisy[0]!.szczegolyJson!)).toMatchObject({
      zaktualizowano: 1,
      wszystkichKandydatow: 1,
    });
  });
});

/**
 * `POST /api/products/oszacuj-wage` — ticket 167 (NOWA logika, świadomie MNIEJ PEWNA niż
 * `dziedzicz-wage` wyżej). Trasa woła `oszacujWageWstecznie` (pokryta osobnymi testami
 * jednostkowymi w `oszacowanie-wagi.test.ts`) — tu sprawdzamy TYLKO warstwę HTTP.
 */
describe("POST /api/products/oszacuj-wage", () => {
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
    srodowisko.sqlite.prepare("DELETE FROM manual_overrides").run();
  });

  const oszacuj = () =>
    request(srodowisko.app)
      .post("/api/products/oszacuj-wage")
      .set("Authorization", `Bearer ${token}`);

  function produktZWaga(kod: string, nadpisania: Partial<NowyProdukt> = {}): NowyProdukt {
    return {
      ...produkt("MO1", kod, "Opona testowa"),
      marka: "MITAS",
      szerokosc: "16.5",
      profil: null,
      srednica: 12,
      konstrukcja: "Diagonalna",
      bieznik: "AW",
      waga: null,
      ...nadpisania,
    };
  }

  it("wymaga tokenu", async () => {
    expect((await request(srodowisko.app).post("/api/products/oszacuj-wage")).status).toBe(401);
  });

  it("oszacowuje wagę średnią dla rozmiaru, oznacza flagą wagaSzacowana, i zwraca liczniki", async () => {
    srodowisko.db
      .insert(products)
      .values([
        // Różne marki i bieżnik — przelicznik ich nie rozróżnia.
        produktZWaga("Z1", { marka: "MITAS", bieznik: "AW", waga: 70 }),
        produktZWaga("Z2", { marka: "ALLIANCE", bieznik: "IND", waga: 90 }),
        produktZWaga("Z3", { waga: null }),
      ])
      .run();

    const odp = await oszacuj();

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({
      ok: true,
      wszystkichKandydatow: 1,
      zaktualizowano: 1,
      pominietoOverride: 0,
      pominietoBrakDanych: 0,
      pominietoBrakSredniej: 0,
    });

    const po = listaProduktow(srodowisko.db).find((p) => p.kod === "Z3")!;
    expect(po.waga).toBe(80);
    expect(po.wagaSzacowana).toBe(true);
  });

  it("audytuje przebieg jako oszacowanie_wagi_wsteczne", async () => {
    srodowisko.db
      .insert(products)
      .values([produktZWaga("Z4", { waga: 78 }), produktZWaga("Z5", { waga: null })])
      .run();

    await oszacuj();

    const wpisy = srodowisko.db.select().from(auditLog).all();
    expect(wpisy).toHaveLength(1);
    expect(wpisy[0]).toMatchObject({
      akcja: "oszacowanie_wagi_wsteczne",
      encjaTyp: "produkt",
      encjaId: "wszystkie",
    });
  });
});
