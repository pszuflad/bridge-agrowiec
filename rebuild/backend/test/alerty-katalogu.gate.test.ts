/**
 * GATE — statusy pseudo-alertów katalogowych (karta P6.2, ticket
 * `77-FEATURE-pseudo-alerty-katalogowe`).
 *
 * Ścieżki: `GET` i `PUT /api/alerty-katalogu/statusy` — trasa NOWA w odbudowie (produkcja
 * trzyma status w IndexedDB), więc fixture'a nie ma i być nie może. Wzorcem jest ręczny opis
 * w `contract/openapi.yaml` (blok „ODSTĘPSTWO OD PRODUKCJI — P6.2”): testy czytają schematy
 * STAMTĄD i sprawdzają ciało odpowiedzi, a nie tylko status — inaczej opis w kontrakcie mógłby
 * się rozjechać z kodem bez żadnego sygnału.
 */
import { readFileSync } from "node:fs";

import { eq } from "drizzle-orm";
import yaml from "js-yaml";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { alertyKataloguStatusy, products } from "../src/db/schema.js";
import { rozbierzIdAlertu } from "../src/repos/alerty-katalogu.js";
import {
  SCIEZKA_KONTRAKTU,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

const SCIEZKA = "/api/alerty-katalogu/statusy";

// ── Minimalny walidator schematu z kontraktu ─────────────────────────────────────────────
// Obsługuje dokładnie te konstrukcje, których używa opis trasy: object/array/string/integer/
// boolean, `required`, `properties`, `enum`, `nullable`. Nieznane słowo kluczowe = błąd testu,
// żeby rozbudowa opisu w kontrakcie nie przeszła po cichu bez sprawdzenia.
type Schemat = {
  type?: string;
  required?: string[];
  properties?: Record<string, Schemat>;
  items?: Schemat;
  enum?: unknown[];
  nullable?: boolean;
  [klucz: string]: unknown;
};

const ZNANE = new Set([
  "type", "required", "properties", "items", "enum", "nullable",
  "description", "minItems", "maxItems", "minLength", "maxLength",
]);

function naruszenia(wartosc: unknown, schemat: Schemat, sciezka = "$"): string[] {
  for (const klucz of Object.keys(schemat)) {
    if (!ZNANE.has(klucz)) return [`${sciezka}: walidator nie zna słowa „${klucz}”`];
  }
  if (wartosc === null) return schemat.nullable ? [] : [`${sciezka}: null niedozwolony`];
  const bledy: string[] = [];
  switch (schemat.type) {
    case "object": {
      if (typeof wartosc !== "object" || Array.isArray(wartosc)) return [`${sciezka}: nie obiekt`];
      const obiekt = wartosc as Record<string, unknown>;
      for (const pole of schemat.required ?? []) {
        if (!(pole in obiekt)) bledy.push(`${sciezka}.${pole}: brak wymaganego pola`);
      }
      for (const pole of Object.keys(obiekt)) {
        const podschemat = schemat.properties?.[pole];
        if (!podschemat) bledy.push(`${sciezka}.${pole}: pole spoza kontraktu`);
        else bledy.push(...naruszenia(obiekt[pole], podschemat, `${sciezka}.${pole}`));
      }
      break;
    }
    case "array":
      if (!Array.isArray(wartosc)) return [`${sciezka}: nie tablica`];
      wartosc.forEach((el, i) => bledy.push(...naruszenia(el, schemat.items ?? {}, `${sciezka}[${i}]`)));
      break;
    case "string":
      if (typeof wartosc !== "string") bledy.push(`${sciezka}: nie tekst`);
      break;
    case "integer":
      if (!Number.isInteger(wartosc)) bledy.push(`${sciezka}: nie liczba całkowita`);
      break;
    case "boolean":
      if (typeof wartosc !== "boolean") bledy.push(`${sciezka}: nie boolean`);
      break;
    default:
      bledy.push(`${sciezka}: nieobsługiwany typ ${String(schemat.type)}`);
  }
  if (schemat.enum && !schemat.enum.includes(wartosc)) bledy.push(`${sciezka}: spoza enum`);
  return bledy;
}

type OperacjaKontraktu = {
  responses: Record<string, { content?: { "application/json": { schema: Schemat } } }>;
};

function schematOdpowiedzi(metoda: "get" | "put", status: string): Schemat {
  const dokument = yaml.load(readFileSync(SCIEZKA_KONTRAKTU(), "utf8")) as {
    paths: Record<string, Record<string, OperacjaKontraktu>>;
  };
  const schemat = dokument.paths[SCIEZKA]?.[metoda]?.responses[status]?.content?.[
    "application/json"
  ].schema;
  if (!schemat) throw new Error(`Brak schematu ${metoda.toUpperCase()} ${SCIEZKA} ${status}`);
  return schemat;
}

function sprawdzCialo(metoda: "get" | "put", odp: request.Response): void {
  const bledy = naruszenia(odp.body, schematOdpowiedzi(metoda, String(odp.status)));
  expect(bledy, bledy.join("\n")).toEqual([]);
  sprawdzZgodnoscZKontraktem({ metoda: metoda.toUpperCase(), sciezka: SCIEZKA, odpowiedz: odp });
}

// ── Testy ────────────────────────────────────────────────────────────────────────────────

describe("GATE — statusy pseudo-alertów katalogowych", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  let idProduktu: number;
  let idInnegoProduktu: number;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    const ids = srodowisko.db.select({ id: products.id }).from(products).all().map((p) => p.id);
    idProduktu = ids[0]!;
    idInnegoProduktu = ids[1]!;

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  beforeEach(() => {
    srodowisko.db.delete(alertyKataloguStatusy).run();
  });

  const pobierz = () => request(srodowisko.app).get(SCIEZKA).set("Authorization", `Bearer ${token}`);
  const ustaw = (cialo: unknown) =>
    request(srodowisko.app).put(SCIEZKA).set("Authorization", `Bearer ${token}`).send(cialo as object);
  const wiersze = () => srodowisko.db.select().from(alertyKataloguStatusy).all();

  it("GET na pustej tabeli — goła pusta tablica zgodna z kontraktem", async () => {
    const odp = await pobierz();
    expect(odp.status).toBe(200);
    expect(odp.body).toEqual([]);
    sprawdzCialo("get", odp);
  });

  it("PUT zapisuje status z „kto i kiedy”, GET oddaje go w kształcie z kontraktu", async () => {
    const id = `${idProduktu}-marza-niska-3.2`;
    const zapis = await ustaw({ ids: [id], status: "przejrzany" });
    expect(zapis.status).toBe(200);
    expect(zapis.body).toEqual({ ok: true, zmienione: 1 });
    sprawdzCialo("put", zapis);

    const odp = await pobierz();
    sprawdzCialo("get", odp);
    const [wpis] = odp.body as Array<Record<string, unknown>>;
    expect(wpis).toMatchObject({ id, status: "przejrzany", kto: srodowisko.uzytkownik.imieNazwisko });
    expect(Number.isNaN(Date.parse(String(wpis!.kiedy)))).toBe(false);

    const [wiersz] = wiersze();
    expect(wiersz).toMatchObject({
      klucz: `${idProduktu}-marza-niska`,
      produktId: idProduktu,
      uzytkownikId: srodowisko.uzytkownik.id,
    });
  });

  it("zmiana statusu tego samego id nadpisuje wpis (jeden wiersz)", async () => {
    const id = `${idProduktu}-marza-ujemna--2.5`;
    await ustaw({ ids: [id], status: "przejrzany" });
    await ustaw({ ids: [id], status: "rozwiazany" });
    expect(wiersze()).toHaveLength(1);
    expect(wiersze()[0]).toMatchObject({ id, status: "rozwiazany" });
  });

  it("status `nowy` kasuje wpis („Otwórz ponownie”)", async () => {
    const id = `${idProduktu}-marza-niska-3.2`;
    await ustaw({ ids: [id], status: "rozwiazany" });
    const odp = await ustaw({ ids: [id], status: "nowy" });
    expect(odp.body).toEqual({ ok: true, zmienione: 1 });
    expect(wiersze()).toEqual([]);
  });

  it("wiele id naraz („Zaakceptuj wszystko”) — duplikaty liczone raz", async () => {
    const ids = [
      `${idProduktu}-marza-niska-3.2`,
      `${idInnegoProduktu}-nie-opona-DĘTKA 8.3-24|Dętki`,
      "dostawca-MO1-brak-importu-12",
      "dostawca-MO1-brak-importu-12",
    ];
    const odp = await ustaw({ ids, status: "rozwiazany" });
    expect(odp.body).toEqual({ ok: true, zmienione: 3 });
    expect(wiersze().map((w) => w.id).sort()).toEqual([...new Set(ids)].sort());
  });

  describe("sprzątanie (decyzja Q2 — wypieranie + sierotki)", () => {
    it("nowy odcisk tej samej pary (produkt, reguła) wypiera stary", async () => {
      await ustaw({ ids: [`${idProduktu}-marza-niska-3.2`], status: "rozwiazany" });
      await ustaw({ ids: [`${idProduktu}-marza-niska-4.1`], status: "przejrzany" });
      expect(wiersze().map((w) => w.id)).toEqual([`${idProduktu}-marza-niska-4.1`]);
    });

    it("dostawca: jutrzejszy licznik dni wypiera dzisiejszy", async () => {
      await ustaw({ ids: ["dostawca-MO1-brak-importu-8"], status: "przejrzany" });
      await ustaw({ ids: ["dostawca-MO1-brak-importu-9"], status: "przejrzany" });
      await ustaw({ ids: ["dostawca-MO10-brak-importu-9"], status: "przejrzany" });
      expect(wiersze().map((w) => w.id).sort()).toEqual([
        "dostawca-MO1-brak-importu-9",
        "dostawca-MO10-brak-importu-9",
      ]);
    });

    it("różne reguły tego samego produktu się NIE wypierają", async () => {
      await ustaw({ ids: [`${idProduktu}-marza-niska-3.2`], status: "rozwiazany" });
      await ustaw({ ids: [`${idProduktu}-marza-ujemna--1`], status: "rozwiazany" });
      await ustaw({ ids: [`${idProduktu}-nie-opona-WENTYL TR-15|Akcesoria`], status: "rozwiazany" });
      expect(wiersze()).toHaveLength(3);
    });

    it("ten sam odcisk u INNEGO produktu nie wypiera (klucz zawiera id produktu)", async () => {
      await ustaw({ ids: [`${idProduktu}-marza-niska-3.2`], status: "rozwiazany" });
      await ustaw({ ids: [`${idInnegoProduktu}-marza-niska-3.2`], status: "rozwiazany" });
      expect(wiersze()).toHaveLength(2);
    });

    it("zapis kasuje wpisy produktów, których nie ma już w katalogu", async () => {
      const [dodany] = srodowisko.db
        .insert(products)
        .values({ ...kopiaProduktu(srodowisko, idProduktu), kod: "TYMCZASOWY-P62" })
        .returning({ id: products.id })
        .all();
      await ustaw({ ids: [`${dodany!.id}-marza-niska-1`], status: "rozwiazany" });
      expect(wiersze()).toHaveLength(1);

      srodowisko.db.delete(products).where(eq(products.id, dodany!.id)).run();
      await ustaw({ ids: ["dostawca-MO2-brak-importu-7"], status: "przejrzany" });
      expect(wiersze().map((w) => w.id)).toEqual(["dostawca-MO2-brak-importu-7"]);
    });
  });

  describe("walidacja — 400 z komunikatem, bez zapisu", () => {
    const przypadki: Array<[string, unknown]> = [
      ["status spoza trzech", { ids: ["1-marza-niska-3"], status: "zamkniety" }],
      ["brak statusu", { ids: ["1-marza-niska-3"] }],
      ["puste ids", { ids: [], status: "przejrzany" }],
      ["ids nie tablica", { ids: "1-marza-niska-3", status: "przejrzany" }],
      ["id nie tekst", { ids: [12], status: "przejrzany" }],
      ["id pusty", { ids: [""], status: "przejrzany" }],
      [
        "paczka ponad limit 20 000 id",
        { ids: Array.from({ length: 20_001 }, (_, i) => `1-marza-niska-${i}`), status: "przejrzany" },
      ],
      ["id za długi", { ids: [`1-nie-opona-${"x".repeat(2001)}`], status: "przejrzany" }],
      ["forma nieznana silnikowi", { ids: ["1-brak-stanu"], status: "przejrzany" }],
      ["reguła wyłączona w oryginale", { ids: ["1-rozmiar-sklejony"], status: "przejrzany" }],
    ];

    it.each(przypadki)("%s", async (_opis, cialo) => {
      const odp = await ustaw(cialo);
      expect(odp.status).toBe(400);
      sprawdzCialo("put", odp);
      expect(wiersze()).toEqual([]);
    });

    it("paczka równa limitowi 20 000 id przechodzi (i wypiera do jednego wiersza)", async () => {
      const ids = Array.from({ length: 20_000 }, (_, i) => `${idProduktu}-marza-niska-${i}`);
      const odp = await ustaw({ ids, status: "przejrzany" });
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true, zmienione: 20_000 });
      // Wszystkie to ta sama para (produkt, reguła) — zostaje ostatni odcisk.
      expect(wiersze().map((w) => w.id)).toEqual([`${idProduktu}-marza-niska-19999`]);
    });

    it("jeden zły id w paczce odrzuca całą paczkę", async () => {
      const odp = await ustaw({ ids: ["1-marza-niska-3", "śmieć"], status: "przejrzany" });
      expect(odp.status).toBe(400);
      expect(wiersze()).toEqual([]);
    });
  });

  it("bez tokenu: 401 dla GET i PUT", async () => {
    const get = await request(srodowisko.app).get(SCIEZKA);
    const put = await request(srodowisko.app).put(SCIEZKA).send({ ids: ["1-marza-niska-3"], status: "przejrzany" });
    expect(get.status).toBe(401);
    expect(put.status).toBe(401);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: SCIEZKA, odpowiedz: get });
    sprawdzZgodnoscZKontraktem({ metoda: "PUT", sciezka: SCIEZKA, odpowiedz: put });
  });
});

describe("rozbierzIdAlertu — cztery formy z silnika", () => {
  it.each([
    ["12-marza-ujemna--2.5", "12-marza-ujemna", 12],
    ["12-marza-ujemna-0", "12-marza-ujemna", 12],
    ["12-marza-niska-4.9", "12-marza-niska", 12],
    ["12-nie-opona-DĘTKA 8.3-24 TR-218|Dętki", "12-nie-opona", 12],
    ["12-nie-opona-|", "12-nie-opona", 12],
    ["12-nie-opona-LINIA1\nLINIA2|kat", "12-nie-opona", 12],
    ["dostawca-MO1-brak-importu-7", "dostawca-MO1-brak-importu", null],
    ["dostawca-A-B-brak-importu-30", "dostawca-A-B-brak-importu", null],
  ])("%s → %s", (id, klucz, produktId) => {
    expect(rozbierzIdAlertu(id)).toEqual({ klucz, produktId });
  });

  it.each(["", "abc", "12-marza-niska", "x-marza-niska-3", "dostawca-MO1-brak-importu-", "12-brak-stanu"])(
    "odrzuca %j",
    (id) => {
      expect(rozbierzIdAlertu(id)).toBeNull();
    },
  );
});

function kopiaProduktu(srodowisko: SrodowiskoTestowe, id: number) {
  const { id: _pominiete, ...reszta } = srodowisko.db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .get()!;
  return reszta;
}
