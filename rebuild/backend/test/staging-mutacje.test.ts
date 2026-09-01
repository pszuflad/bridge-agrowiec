/**
 * Dziewięć tras mutacji stagingu i poprawek Marty — przez PRAWDZIWE HTTP.
 *
 * Charakteryzacja (`akceptacja.charakteryzacja.test.ts`) dowodzi, że `acceptStaging` liczy
 * to samo co produkcja. Ten plik dowodzi czegoś innego i równie potrzebnego: że łańcuch
 * żądanie → trasa → repozytorium → baza jest spięty, a brzegi (404, walidacja, audit log,
 * operacje masowe) zachowują się jak w oryginale.
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { auditLog, manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

/** Wiersz stagingu w kształcie, jaki produkuje silnik z 3d-1. */
function pozycja(pola: Record<string, unknown> = {}) {
  const snapshot = {
    kod: "P1",
    nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
    marka: "BKT",
    model: "AGRIMAX RT 765",
    kategoria: "Rolnicze",
    rozmiar: "480/70R28",
    ean: "5901234123457",
    eanIsValid: 1,
    ...((pola.snapshot as Record<string, unknown>) ?? {}),
  };
  const { snapshot: _p, ...reszta } = pola;
  return {
    typZmiany: "nowa",
    kod: "P1",
    nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
    dostawca: "MO5",
    magazyn: "PL",
    stanNowy: 4,
    cenaZakupuNowa: 1000,
    utworzono: "2026-02-01T00:00:00.000Z",
    ...reszta,
    snapshotJson: JSON.stringify(snapshot),
  };
}

describe("Mutacje stagingu i poprawek Marty — przez HTTP", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });
  afterEach(() => srodowisko.posprzataj());

  const post = (sciezka: string, cialo: object = {}) =>
    request(srodowisko.app).post(sciezka).set("Authorization", `Bearer ${token}`).send(cialo);
  const put = (sciezka: string, cialo: object = {}) =>
    request(srodowisko.app).put(sciezka).set("Authorization", `Bearer ${token}`).send(cialo);
  const del = (sciezka: string) =>
    request(srodowisko.app).delete(sciezka).set("Authorization", `Bearer ${token}`);
  const get = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  const zasiej = (...wiersze: Record<string, unknown>[]) => {
    srodowisko.db.insert(stagingItems).values(wiersze as never).run();
    return srodowisko.db.select().from(stagingItems).all() as unknown as { id: number }[];
  };
  const staging = () => srodowisko.db.select().from(stagingItems).all();
  const katalog = () => srodowisko.db.select().from(products).all();
  const poprawki = () => srodowisko.db.select().from(manualOverrides).all();
  const audyt = () => srodowisko.db.select().from(auditLog).all() as unknown as Record<string, unknown>[];

  describe("POST /api/staging/accept", () => {
    it("zatwierdza wskazane pozycje i zwraca ich liczbę", async () => {
      const [a, b] = zasiej(pozycja(), pozycja({ kod: "P2", snapshot: { kod: "P2" } }));

      const odp = await post("/api/staging/accept", { ids: [a!.id, b!.id] });

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true, accepted: 2 });
      expect(katalog()).toHaveLength(2);
      expect(staging()).toHaveLength(0);
    });

    it("`allFiltered` z filtrem `typZmiany` bierze tylko pasujące pozycje", async () => {
      zasiej(
        pozycja({ typZmiany: "nowa" }),
        pozycja({ typZmiany: "blad", kod: "P2", snapshot: { kod: "P2" } }),
      );

      const odp = await post("/api/staging/accept", { allFiltered: true, typZmiany: "blad" });

      expect(odp.body.accepted).toBe(1);
      expect(staging()).toHaveLength(1);
      expect((staging()[0] as { typZmiany: string }).typZmiany).toBe("nowa");
    });

    it("`allFiltered` z filtrem `dostawca` i `search`", async () => {
      zasiej(
        pozycja({ kod: "AAA-1", nazwa: "Opona ALFA", dostawca: "MO5", snapshot: { kod: "AAA-1" } }),
        pozycja({ kod: "BBB-2", nazwa: "Opona BETA", dostawca: "MO2", snapshot: { kod: "BBB-2" } }),
      );

      const poDostawcy = await post("/api/staging/accept", { allFiltered: true, dostawca: "MO2" });
      expect(poDostawcy.body.accepted).toBe(1);

      const poSzukaniu = await post("/api/staging/accept", { allFiltered: true, search: "ALFA" });
      expect(poSzukaniu.body.accepted).toBe(1);
      expect(staging()).toHaveLength(0);
    });

    it("`typZmiany: \"all\"` NIE filtruje — bierze wszystko", async () => {
      zasiej(pozycja(), pozycja({ typZmiany: "blad", kod: "P2", snapshot: { kod: "P2" } }));

      const odp = await post("/api/staging/accept", { allFiltered: true, typZmiany: "all" });

      expect(odp.body.accepted).toBe(2);
    });

    it("pisze do audit logu", async () => {
      const [a] = zasiej(pozycja());
      await post("/api/staging/accept", { ids: [a!.id] });

      const wpis = audyt().find((w) => w.akcja === "akceptacja_stagingu");
      expect(wpis).toBeDefined();
      expect(JSON.parse(String(wpis!.szczegolyJson))).toMatchObject({ ile: 1, allFiltered: false });
    });
  });

  describe("POST /api/staging/reject i /clear", () => {
    it("reject kasuje pozycje BEZ dotykania katalogu", async () => {
      const [a] = zasiej(pozycja());

      const odp = await post("/api/staging/reject", { ids: [a!.id] });

      expect(odp.body).toEqual({ ok: true, rejected: 1 });
      expect(staging()).toHaveLength(0);
      expect(katalog(), "odrzucenie nie może niczego dodać do katalogu").toHaveLength(0);
    });

    it("clear czyści cały staging", async () => {
      zasiej(pozycja(), pozycja({ kod: "P2", snapshot: { kod: "P2" } }));

      const odp = await post("/api/staging/clear");

      expect(odp.body).toEqual({ ok: true });
      expect(staging()).toHaveLength(0);
      expect(audyt().some((w) => w.akcja === "czyszczenie_stagingu")).toBe(true);
    });
  });

  describe("DELETE /api/staging/{id}", () => {
    it("kasuje pojedynczą pozycję", async () => {
      const [a] = zasiej(pozycja());
      const odp = await del(`/api/staging/${a!.id}`);
      expect(odp.status).toBe(200);
      expect(staging()).toHaveLength(0);
    });

    it("404, gdy pozycji nie ma", async () => {
      const odp = await del("/api/staging/999999");
      expect(odp.status).toBe(404);
      expect(odp.body).toEqual({ error: "Nie znaleziono pozycji stagingu" });
    });
  });

  describe("PUT /api/staging/{id} — edycja, która TWORZY poprawki Marty", () => {
    it("zapisuje zmianę w pozycji, w snapshocie i w `manual_overrides`", async () => {
      const [a] = zasiej(pozycja());

      const odp = await put(`/api/staging/${a!.id}`, { nazwa: "NOWA NAZWA", _reason: "literówka" });

      expect(odp.status).toBe(200);
      const wiersz = staging()[0] as unknown as Record<string, unknown>;
      expect(wiersz.nazwa).toBe("NOWA NAZWA");
      expect(JSON.parse(String(wiersz.snapshotJson)).nazwa).toBe("NOWA NAZWA");
      expect(JSON.parse(String(wiersz.edytowanePola))).toEqual(["nazwa"]);

      const poprawka = poprawki()[0]!;
      expect(poprawka.fieldName).toBe("nazwa");
      expect(poprawka.overrideValue).toBe("NOWA NAZWA");
      expect(poprawka.reason).toBe("literówka");
    });

    it("`cenaZakupuNowa` trafia do kolumny, do snapshotu i do poprawki pod nazwą `cenaZakupu`", async () => {
      const [a] = zasiej(pozycja());

      await put(`/api/staging/${a!.id}`, { cenaZakupuNowa: "1234,,5" });

      const wiersz = staging()[0] as unknown as Record<string, unknown>;
      // `parseFloat("1234,,5") || 0` → 1234 (oryginał, `:48615`).
      expect(wiersz.cenaZakupuNowa).toBe(1234);
      expect(JSON.parse(String(wiersz.snapshotJson)).cenaZakupu).toBe(1234);
      expect(poprawki()[0]!.fieldName).toBe("cenaZakupu");
    });

    it("pola SPOZA listy edytowalnych są po cichu ignorowane — także w snapshocie", async () => {
      const [a] = zasiej(pozycja());

      await put(`/api/staging/${a!.id}`, { stanNowy: 999, typZmiany: "wycofana" });

      const wiersz = staging()[0] as unknown as Record<string, unknown>;
      expect(wiersz.stanNowy).toBe(4);
      expect(wiersz.typZmiany).toBe("nowa");
      expect(poprawki()).toHaveLength(0);
      // Bez tych dwóch asercji pola spoza listy przeciekłyby do snapshotu, a stamtąd —
      // przez `acceptStaging` — do katalogu.
      expect(JSON.parse(String(wiersz.edytowanePola))).toEqual([]);
      expect(JSON.parse(String(wiersz.snapshotJson))).not.toHaveProperty("stanNowy");
    });

    /**
     * ⭐ TEST DECYZJI D5. `acceptStaging` zapisuje `acknowledgedSourceValue`, żeby ten sam
     * konflikt nie alarmował przy każdym imporcie. Edycja pozycji NIE podaje tego pola —
     * i nie wolno jej go wyzerować, bo alarm by wrócił.
     */
    it("edycja NIE kasuje wcześniejszego potwierdzenia konfliktu (`acknowledgedSourceValue`)", async () => {
      const [a] = zasiej(pozycja());
      srodowisko.db
        .insert(manualOverrides)
        .values({
          supplierKod: "MO5",
          supplierProductId: "P1",
          fieldName: "nazwa",
          overrideValue: "STARA",
          createdAt: "2026-01-01T00:00:00.000Z",
          acknowledgedSourceValue: "WARTOŚĆ Z PLIKU",
        } as never)
        .run();

      await put(`/api/staging/${a!.id}`, { nazwa: "NOWA NAZWA" });

      const poprawka = poprawki()[0]!;
      expect(poprawka.overrideValue, "sama poprawka MA się zaktualizować").toBe("NOWA NAZWA");
      expect(
        poprawka.acknowledgedSourceValue,
        "potwierdzenie konfliktu MUSI przetrwać edycję",
      ).toBe("WARTOŚĆ Z PLIKU");
    });

    it("404, gdy pozycji nie ma", async () => {
      const odp = await put("/api/staging/999999", { nazwa: "X" });
      expect(odp.status).toBe(404);
    });
  });

  describe("POST /api/staging/import", () => {
    const rekord = {
      kod: "IMP-1",
      nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
      rozmiar: "480/70R28",
      marka: "BKT",
      kategoria: "Opony rolnicze",
      ean: "5901234123457",
      stan: 4,
      cenaZakupu: 1000,
      magazyn: "PL",
    };

    it("przepuszcza pozycje przez silnik i zwraca statystyki", async () => {
      const odp = await post("/api/staging/import", { dostawcaKod: "MO5", surowe: [rekord] });

      expect(odp.status).toBe(200);
      expect(odp.body.ok).toBe(true);
      expect(odp.body.nowe).toBe(1);
      expect(staging()).toHaveLength(1);
    });

    /**
     * ⭐ ODSTĘPSTWO D7 PRZEZ HTTP. 3d-1 sprawdziła bezpiecznik na poziomie `tk()`; tu
     * dowodzimy, że trasa go nie obchodzi. W produkcji pusta tablica przechodzi i po trzech
     * takich przebiegach wycofuje CAŁY katalog dostawcy (backlog #8).
     */
    it("pusta tablica NIE dociera do stagingu ani do liczników", async () => {
      const odp = await post("/api/staging/import", { dostawcaKod: "MO5", surowe: [] });

      expect(odp.status).toBe(400);
      expect(String(odp.body.error)).toContain("Nie ma ani jednej pozycji");
      expect(staging()).toHaveLength(0);
      expect(audyt().some((w) => w.akcja === "import_cennika")).toBe(false);
    });

    it("400 przy braku kodu dostawcy i przy `surowe` innym niż tablica", async () => {
      expect((await post("/api/staging/import", { surowe: [rekord] })).status).toBe(400);
      expect(
        (await post("/api/staging/import", { dostawcaKod: "MO5", surowe: "nie tablica" })).status,
      ).toBe(400);
    });

    it("akceptuje aliasy `dostawca` i `items`", async () => {
      const odp = await post("/api/staging/import", { dostawca: "MO5", items: [rekord] });
      expect(odp.status).toBe(200);
    });
  });

  describe("Poprawki Marty — GET / POST / DELETE", () => {
    const dodaj = (pola: Record<string, unknown> = {}) =>
      post("/api/overrides", {
        supplierKod: "MO5",
        supplierProductId: "P1",
        fieldName: "kategoria",
        overrideValue: "Rolnicze",
        ...pola,
      });

    it("POST tworzy poprawkę i pisze do audit logu", async () => {
      const odp = await dodaj();

      expect(odp.status).toBe(200);
      expect(odp.body).toMatchObject({ supplierKod: "MO5", fieldName: "kategoria" });
      expect(poprawki()).toHaveLength(1);
      expect(audyt().some((w) => w.akcja === "override")).toBe(true);
    });

    it("POST jest UPSERTEM — drugi zapis tego samego pola nadpisuje, nie dubluje", async () => {
      await dodaj();
      await dodaj({ overrideValue: "Przemysłowe" });

      expect(poprawki()).toHaveLength(1);
      expect(poprawki()[0]!.overrideValue).toBe("Przemysłowe");
    });

    it("POST bez wymaganych pól → 400", async () => {
      const odp = await post("/api/overrides", { supplierKod: "MO5" });
      expect(odp.status).toBe(400);
      expect(String(odp.body.error)).toContain("Wymagane");
    });

    it("pusta wartość jest DOZWOLONA — tak Marta czyści pole", async () => {
      const odp = await dodaj({ overrideValue: null });
      expect(odp.status).toBe(200);
      expect(poprawki()[0]!.overrideValue).toBe("");
    });

    it("GET zwraca listę, a z parą `dostawca`+`kod` — tylko tę pozycję", async () => {
      await dodaj();
      await dodaj({ supplierProductId: "P2", fieldName: "marka", overrideValue: "BKT" });

      const wszystkie = await get("/api/overrides");
      expect(wszystkie.body).toHaveLength(2);

      const jedna = await get("/api/overrides?dostawca=MO5&kod=P2");
      expect(jedna.body).toHaveLength(1);
      expect(jedna.body[0].supplierProductId).toBe("P2");
    });

    it("GET z samym `dostawca` (bez `kod`) zwraca PEŁNĄ listę — tak działa oryginał", async () => {
      await dodaj();
      await dodaj({ supplierProductId: "P2" });

      const odp = await get("/api/overrides?dostawca=MO5");
      expect(odp.body).toHaveLength(2);
    });

    it("DELETE kasuje i zwraca 404 przy nieistniejącym id", async () => {
      await dodaj();
      const id = poprawki()[0]!.id;

      expect((await del(`/api/overrides/${id}`)).status).toBe(200);
      expect(poprawki()).toHaveLength(0);
      expect((await del(`/api/overrides/${id}`)).status).toBe(404);
    });
  });

  describe("Auth — odstępstwo D1", () => {
    it("wszystkie trasy mutacji wymagają tokenu", async () => {
      const bezTokenu = [
        request(srodowisko.app).post("/api/staging/accept").send({ ids: [] }),
        request(srodowisko.app).post("/api/staging/reject").send({ ids: [] }),
        request(srodowisko.app).post("/api/staging/clear").send({}),
        request(srodowisko.app).post("/api/staging/import").send({ dostawcaKod: "MO5" }),
        request(srodowisko.app).delete("/api/staging/1"),
        request(srodowisko.app).put("/api/staging/1").send({ nazwa: "X" }),
        request(srodowisko.app).post("/api/overrides").send({}),
        request(srodowisko.app).delete("/api/overrides/1"),
      ];
      for (const odp of await Promise.all(bezTokenu)) expect(odp.status).toBe(401);
    });

    /**
     * `GET /api/overrides` jest w PRODUKCJI publiczne (brak `we` przy `:48645`). Wymagamy
     * tokenu, kontynuując decyzję z I1 — to samo odstępstwo co przy `/api/products` (I2)
     * i `/api/staging` (3b).
     */
    it("GET /api/overrides też wymaga tokenu, choć w produkcji jest publiczne", async () => {
      const odp = await request(srodowisko.app).get("/api/overrides");
      expect(odp.status).toBe(401);
    });
  });

  describe("Pełny cykl: import → edycja → akceptacja", () => {
    it("edycja w stagingu przechodzi przez akceptację do katalogu i zostaje jako poprawka", async () => {
      const [a] = zasiej(pozycja());

      await put(`/api/staging/${a!.id}`, { kategoria: "Przemysłowe", _reason: "decyzja Marty" });
      await post("/api/staging/accept", { ids: [a!.id] });

      const produkt = katalog()[0] as unknown as Record<string, unknown>;
      expect(produkt.kategoria, "ręczna zmiana ma dojechać do katalogu").toBe("Przemysłowe");

      const poprawka = srodowisko.db
        .select()
        .from(manualOverrides)
        .where(eq(manualOverrides.fieldName, "kategoria"))
        .get();
      expect(
        poprawka?.overrideValue,
        "poprawka zostaje, żeby następny import nie przywrócił wartości z pliku",
      ).toBe("Przemysłowe");
    });
  });
});
