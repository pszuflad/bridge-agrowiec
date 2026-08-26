/**
 * GATE TREŚCI ITERACJI 3c — realny import pliku przez HTTP i porównanie wierszy
 * `staging_items` POLE PO POLU.
 *
 * Czym różni się od `silnik.charakteryzacja.test.ts`: tamten karmi silnik nagranymi rekordami
 * i dowodzi, że zachowuje się jak produkcyjne `tk()`. Ten idzie CAŁĄ drogą — żądanie HTTP →
 * parser (port 3a) → adapter → silnik (3c) → transakcja → tabela — i dowodzi, że łańcuch jest
 * spięty, a treść wierszy jest taka, jak trzeba. Gate 3b świadomie tego nie robił: sadził dane
 * wprost z fixtures, bo silnika jeszcze nie było.
 *
 * Plik wejściowy jest skrojony pod scenariusze, ale jedzie przez PRAWDZIWY parser MO1
 * (`legacy/parsers/mo1_bohnenkamp.cjs`) w prawdziwym formacie Bohnenkampa, więc rekordy
 * powstają tak samo jak z cennika od dostawcy.
 *
 * ⚠ Dwóch gałęzi silnika NIE DA SIĘ tędy pokazać i to jest ustalenie, nie luka: adapter
 * (`legacy/parsers/adapter.cjs`) sam nadaje `kod` każdemu rekordowi — z EAN-u albo
 * z własnego syntetycznego skrótu — więc identyfikator zastępczy `Lq()` i „użyto EAN jako
 * identyfikatora" są przez ścieżkę plikową NIEOSIĄGALNE. Wejdą dopiero z
 * `POST /api/staging/import` (3d), które bierze pozycje wprost z ciała żądania. Obie gałęzie
 * są pokryte w `silnik.charakteryzacja.test.ts` (scenariusze `identyfikator-zastepczy-lq`
 * i `dopasowanie-po-eanie-znormalizowanym`).
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { podpiszToken } from "../src/auth/jwt.js";
import { products, stagingItems } from "../src/db/schema.js";
import { stworzAtrapy } from "./charakteryzacja/silnik/atrapy.mjs";
import { zaladujOryginal } from "./charakteryzacja/silnik/oryginal.mjs";
import { POLA_WIERSZA } from "./charakteryzacja/silnik/wzorzec.mjs";
import { parsujBufor } from "../src/import/parsuj.js";
import { SEKRET_TESTOWY, stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

/**
 * Cennik MO1 w formacie Bohnenkampa: `kod;ean;producent;nazwa;specyfikacja;marka;szt;cena;stan;`
 * (parser wymaga min. 9 kolumn, kolumnę stanu świadomie ignoruje).
 */
const WIERSZE_CENNIKA = [
  "GATE-NOWA;5901234123457;BKT;Opona 480 / 70 R 28, Agrimax RT 765;150 D, TL;BKT;1;1000,00;0,00;",
  "GATE-KOD;5901234123464;BKT;Opona 420 / 85 R 30, Agrimax RT 855;140 A8, TL;BKT;1;1100,00;0,00;",
  "GATE-EAN;5901234123471;BKT;Opona 340 / 85 R 24, Agrimax RT 945;125 A8, TL;BKT;1;1200,00;0,00;",
  "GATE-NORMEAN;8,05997E+12;BKT;Opona 520 / 70 R 38, Agrimax Elos;150 D, TL;BKT;1;1300,00;0,00;",
  "GATE-KONFLIKT;5901234123495;BKT;Opona 380 / 70 R 24, Agrimax RT 765;125 A8, TL;BKT;1;1500,00;0,00;",
  "GATE-ZLANAZWA;5901234123501;BKT;Opona480/70R28 Agrimax;150 D, TL;BKT;1;1600,00;0,00;",
  "GATE-TARCZA;5901234123518;BKT;Opona 480 / 70 R 28, Tarcza hamulcowa;150 D, TL;BKT;1;900,00;0,00;",
];

const CENNIK = Buffer.from(`${WIERSZE_CENNIKA.join("\n")}\n`, "utf-8");

/** Szkielet wiersza `products` — pola wymagane przez schemat, reszta dosypywana per scenariusz. */
function produkt(pola: Record<string, unknown>) {
  return {
    dostawca: "MO1",
    nazwa: "STARA NAZWA",
    marka: "BKT",
    kategoria: "Rolnicze",
    magazyn: "PL",
    magazynRaw: "PL",
    stan: 4,
    cenaZakupu: 500,
    cenaSprzedazy: 650,
    marzaPct: 30,
    vat: 23,
    status: "aktywny",
    dataAktualizacji: "2026-01-01T00:00:00.000Z",
    nieobecnoscPodRzad: 0,
    ...pola,
  } as typeof products.$inferInsert;
}

/**
 * Katalog dobrany tak, żeby każdy wiersz cennika trafił w inną gałąź silnika.
 * `MO1_` w kodach bierze się stąd, że adapter prefiksuje kody dostawcy.
 */
const KATALOG = [
  // dopasowanie PO KODZIE
  produkt({ id: 101, kod: "MO1_GATE-KOD", nazwa: "STARA NAZWA PO KODZIE" }),
  // dopasowanie PO EAN — kod w katalogu inny niż w cenniku
  produkt({ id: 102, kod: "MO1_INNY-KOD", ean: "5901234123471", eanIsValid: 1 }),
  // dopasowanie PO EAN ZNORMALIZOWANYM — w cenniku „8,05997E+12", tu już rozwinięte
  produkt({ id: 103, kod: "MO1_INNY-KOD-2", ean: "8059970000000", eanIsValid: 1 }),
  // KONFLIKT EAN — dwa produkty dzielą ten sam EAN, więc mapa EAN nie rozstrzyga
  produkt({ id: 104, kod: "MO1_DUP-A", nazwa: "DUPLIKAT A", ean: "5901234123495", eanIsValid: 1 }),
  produkt({ id: 105, kod: "MO1_DUP-B", nazwa: "DUPLIKAT B", ean: "5901234123495", eanIsValid: 1 }),
  // NIE-OPONA — ten produkt ma zniknąć z katalogu
  produkt({ id: 106, kod: "MO1_GATE-TARCZA", nazwa: "OPONA DO SKASOWANIA" }),
  // dopasowany produkt z niezerowym licznikiem nieobecności — ma się wyzerować
  produkt({ id: 107, kod: "MO1_GATE-NOWA", nazwa: "STARA NAZWA NOWEJ", nieobecnoscPodRzad: 2 }),
];

type Wiersz = Record<string, unknown>;

describe("GATE treści 3c — realny import przez HTTP", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    token = podpiszToken(srodowisko.uzytkownik, SEKRET_TESTOWY);
    srodowisko.db.insert(products).values(KATALOG).run();
  });

  afterEach(() => {
    srodowisko.posprzataj();
  });

  const zaimportuj = (dane: Buffer = CENNIK) =>
    request(srodowisko.app)
      .post("/api/import/parse-file?dostawcaKod=MO1&nazwa=gate.csv")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(dane);

  const wiersze = () =>
    srodowisko.db.select().from(stagingItems).all() as unknown as Wiersz[];

  const wierszPoKodzie = (kod: string) => {
    const znaleziony = wiersze().find((w) => w.kod === kod);
    expect(znaleziony, `brak wiersza stagingu o kodzie ${kod}`).toBeDefined();
    return znaleziony!;
  };

  it("cały przebieg zgadza się POLE PO POLU z oryginalnym tk() na tym samym wejściu", async () => {
    // Wejście dla oryginału bierzemy z TEJ SAMEJ bazy, którą zobaczy nasz silnik — inaczej
    // porównywalibyśmy dwa różne katalogi i zielony wynik nic by nie znaczył.
    const katalogZBazy = srodowisko.db.select().from(products).all();
    const sparsowane = parsujBufor("MO1", CENNIK, "gate.csv");

    const atrapy = stworzAtrapy({ produkty: katalogZBazy as unknown as Record<string, unknown>[] });
    const oryginal = zaladujOryginal(atrapy.zaleznosci) as unknown as {
      tk: (dostawca: string, rekordy: unknown[]) => Record<string, number>;
    };
    const statystykiOryginalu = oryginal.tk("MO1", sparsowane.rekordy);

    const odp = await zaimportuj();
    expect(odp.status).toBe(200);

    const nasze = wiersze();
    const oryginalne = atrapy.staging as unknown as Wiersz[];

    expect(nasze.length, "liczba wierszy stagingu").toBe(oryginalne.length);

    for (const [i, oczekiwany] of oryginalne.entries()) {
      for (const nazwaPola of POLA_WIERSZA) {
        if (nazwaPola === "utworzono") continue; // znacznik czasu z innego przebiegu
        expect(
          nasze[i]![nazwaPola] ?? null,
          `wiersz ${i} (kod ${String(oczekiwany.kod)}), pole ${nazwaPola}`,
        ).toEqual(oczekiwany[nazwaPola] ?? null);
      }
    }

    const cialo = odp.body as Record<string, number>;
    for (const licznik of [
      "doStagingu",
      "odrzuconeNieOpony",
      "odrzuconeBrakDanych",
      "odrzuconeSmieciMO2",
      "nowe",
      "zmienione",
      "bezZmian",
      "autoZatwierdzone",
    ]) {
      expect(cialo[licznik], `licznik ${licznik}`).toBe(statystykiOryginalu[licznik]);
    }
  });

  it("nowa pozycja spoza katalogu — typZmiany 'nowa', bez ostrzeżeń, ceny z cennika", async () => {
    // Uwaga: MO1_GATE-NOWA JEST w katalogu (id 107), więc ta pozycja idzie ścieżką zmiany.
    // Prawdziwie nową jest tu GATE-ZLANAZWA i GATE-KONFLIKT — obie z ostrzeżeniem. Czystą
    // „nową" pokazuje import do pustego katalogu.
    srodowisko.db.delete(products).run();

    const odp = await zaimportuj();
    expect(odp.status).toBe(200);

    const w = wierszPoKodzie("MO1_GATE-NOWA");
    expect(w.typZmiany).toBe("nowa");
    expect(w.ostrzezenie).toBeNull();
    expect(w.powod).toBe("Nowa pozycja w cenniku");
    expect(w.nazwa).toBe("480/70R28 BKT AGRIMAX RT 765 150D TL");
    expect(w.dostawca).toBe("MO1");
    expect(w.stanStary).toBeNull();
    expect(w.cenaZakupuStara).toBeNull();
    expect(w.cenaZakupuNowa).toBe(1000);
    expect(w.eanRaw).toBe("5901234123457");
    expect(w.eanIsValid).toBe(1);
    expect(w.eanSourceStatus).toBe("ok");
    expect(w.eanCandidates).toBe('["5901234123457"]');
    expect(JSON.parse(String(w.snapshotJson)).rozmiar).toBe("480/70R28");
  });

  it("dopasowanie po kodzie — 'zmiana_kluczowa' z etykietami różnic z Vq", async () => {
    await zaimportuj();

    const w = wierszPoKodzie("MO1_GATE-KOD");
    expect(w.typZmiany).toBe("zmiana_kluczowa");
    expect(String(w.powod)).toContain("nazwa: STARA NAZWA PO KODZIE → 420/85R30 BKT AGRIMAX RT 855");
    expect(w.stanStary).toBe(4);
    expect(w.cenaZakupuStara).toBe(500);
    expect(w.cenaZakupuNowa).toBe(1100);
    expect(w.zmianaPct).toBeCloseTo(120, 6);
  });

  it("dopasowanie po EAN — wiersz dostaje KOD Z KATALOGU, nie z cennika", async () => {
    await zaimportuj();

    // Cennik podaje GATE-EAN, katalog ma ten EAN pod MO1_INNY-KOD — wygrywa katalog (:47772).
    const w = wierszPoKodzie("MO1_INNY-KOD");
    expect(w.typZmiany).toBe("zmiana_kluczowa");
    expect(wiersze().some((r) => r.kod === "MO1_GATE-EAN")).toBe(false);
    expect(String(w.powod)).toContain("nazwa: STARA NAZWA → 340/85R24 BKT AGRIMAX RT 945");

    // ⚠ `kodDostawcy` RÓŻNI się (katalog ma null, cennik „GATE-EAN"), a mimo to w `powod`
    // go nie ma — pętla po `Vq` (:47746) pomija przypadek „stara pusta, nowa niepusta".
    // Klasyfikację i tak wywołuje, bo `kodDostawcy` jest w `_KP` (:47751). To zachowanie
    // oryginału, nie przeoczenie: uzupełnienie brakującego pola nie jest „zmianą" do pokazania.
    expect(String(w.powod)).not.toContain("kod dostawcy");
    expect(JSON.parse(String(w.snapshotJson)).kodDostawcy).toBe("GATE-EAN");
  });

  it("dopasowanie po EAN ZNORMALIZOWANYM — surowy EAN nie trafia, rozwinięty już tak", async () => {
    await zaimportuj();

    const w = wierszPoKodzie("MO1_INNY-KOD-2");
    expect(w.typZmiany).toBe("zmiana_kluczowa");
    expect(w.eanRaw).toBe("8,05997E+12");
    expect(w.eanSourceStatus).toBe("scientific_notation_uncertain");
    // Dopasowanie zaszło dopiero po Hq(), bo w cenniku EAN jest w notacji naukowej.
    expect(JSON.parse(String(w.snapshotJson)).ean).toBe("8059970000000");
  });

  it("konflikt EAN — pozycja zostaje niedopasowana i dostaje 'blad' z listą kolidujących", async () => {
    await zaimportuj();

    const w = wierszPoKodzie("MO1_GATE-KONFLIKT");
    expect(w.typZmiany).toBe("blad");
    expect(String(w.ostrzezenie)).toContain("Konflikt EAN — ten EAN (5901234123495)");
    expect(String(w.ostrzezenie)).toContain('MO1_DUP-A "DUPLIKAT A"');
    expect(String(w.ostrzezenie)).toContain('MO1_DUP-B "DUPLIKAT B"');
    expect(String(w.powod)).toContain("Nowa pozycja wymaga sprawdzenia");
  });

  it("błędny zapis nazwy — Kq() wymusza 'blad'", async () => {
    await zaimportuj();

    const w = wierszPoKodzie("MO1_GATE-ZLANAZWA");
    expect(w.typZmiany).toBe("blad");
    expect(String(w.ostrzezenie)).toContain("bledny zapis nazwy: nazwa bez spacji po słowie Opona");
  });

  it("nie-opona — pozycja odrzucona, a odpowiadający produkt SKASOWANY z katalogu", async () => {
    const przed = srodowisko.db.select().from(products).all();
    expect(przed.some((p) => p.kod === "MO1_GATE-TARCZA")).toBe(true);

    const odp = await zaimportuj();

    expect((odp.body as { odrzuconeNieOpony: number }).odrzuconeNieOpony).toBe(1);
    expect(
      (odp.body as { szczegolyOdrzuconych: { nazwa: string; powod: string }[] }).szczegolyOdrzuconych,
    ).toContainEqual({
      nazwa: "MO1_GATE-TARCZA — 480/70R28 BKT TARCZA HAMULCOWA 150D TL",
      powod: 'nie opona (wykryto "tarcza" w nazwie/kategorii)',
    });

    expect(wiersze().some((w) => w.kod === "MO1_GATE-TARCZA")).toBe(false);
    const po = srodowisko.db.select().from(products).all();
    expect(po.some((p) => p.kod === "MO1_GATE-TARCZA")).toBe(false);
    expect(po.length).toBe(przed.length - 1);
  });

  it("dopasowanie zeruje licznik nieobecności", async () => {
    await zaimportuj();

    const produkt107 = srodowisko.db
      .select()
      .from(products)
      .all()
      .find((p) => p.id === 107);
    expect(produkt107?.nieobecnoscPodRzad).toBe(0);
  });

  it("wszystkie wiersze przebiegu mają JEDEN wspólny znacznik utworzono", async () => {
    await zaimportuj();

    const znaczniki = new Set(wiersze().map((w) => w.utworzono));
    expect(znaczniki.size).toBe(1);
  });

  it("pusty wynik parsowania — 400, ani jednego wiersza, katalog nietknięty (bezpiecznik D7)", async () => {
    const przed = srodowisko.db.select().from(products).all().length;

    const odp = await zaimportuj(Buffer.from("nie;jest;cennikiem\n", "utf-8"));

    expect(odp.status).toBe(400);
    expect((odp.body as { error: string }).error).toMatch(/ani jednej pozycji/);
    expect(wiersze().length).toBe(0);
    expect(srodowisko.db.select().from(products).all().length).toBe(przed);
  });
});
