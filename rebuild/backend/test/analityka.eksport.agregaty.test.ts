/**
 * Kształt wierszy dziesięciu widoków `GET /api/analytics/export/{view}` — blok 10f.
 *
 * ⚠ TEN PLIK JEST JEDYNYM DOWODEM KSZTAŁTU TEJ TRASY. `export/{view}` nie ma fixture'a
 * (nagrywarka zapisywała wyłącznie odpowiedzi JSON, `contract/README.md`), a kontrakt nie
 * deklaruje dla niej żadnego `content` (`openapi.yaml:178-188`). GATE dowodzi więc tylko,
 * że ścieżka istnieje i status jest zadeklarowany — komplet kolumn każdego widoku musi
 * powiedzieć ten test, bo nie powie tego nic innego.
 *
 * Testujemy funkcje repo, nie trasę: nazwy kolumn wychodzą prosto z aliasów SQL i to one
 * lądują w nagłówku CSV (`naCsv` bierze `Object.keys(wiersze[0])`). Trasę, format i nagłówki
 * HTTP pokrywa `analityka.eksport.gate.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { historiaCen, products, stagingItems } from "../src/db/schema.js";
import {
  eksportCykluZyciaDostawcow,
  eksportDostepnosciProduktow,
  eksportMarz,
  eksportOstatnichCen,
  eksportPorownaniaEan,
  eksportRotacji,
  eksportStabilnosciDostawcow,
  eksportStanuDostawcow,
  eksportTempaSchodzenia,
  eksportUnikalnychEan,
  NAZWY_WIDOKOW_EKSPORTU,
  WIDOKI_EKSPORTU,
} from "../src/repos/analityka-eksport.js";
import {
  stworzSrodowiskoTestowe,
  zasiejHistorieCen,
  zasiejProdukty,
  zasiejStagingZFixtures,
  type SrodowiskoTestowe,
} from "./gate/index.js";

describe("eksport analityki — kształt wierszy (blok 10f)", () => {
  let srodowisko: SrodowiskoTestowe;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    zasiejStagingZFixtures(srodowisko.db);
    zasiejHistorieCen(srodowisko.db);

    // Bazowy zasiew ma cztery produkty, każdy z własnym EAN-em — `ean-comparison` nie miałby
    // wtedy ANI JEDNEGO wiersza (wymaga EAN-u u ≥2 dostawców) i test przeszedłby na sucho.
    // Dokładamy pozycję MO1 dzielącą EAN z MO9_336320, z inną ceną, żeby spread był policzalny.
    srodowisko.db
      .insert(products)
      .values({
        kod: "MO1_336320",
        nazwa: "620/70R42 BKT AGRIMAX FACTOR 166D/169A8 TL",
        marka: "BKT",
        kategoria: "Rolnicze",
        dostawca: "MO1",
        magazyn: "—",
        stan: 5,
        cenaZakupu: 5000,
        cenaSprzedazy: 6500,
        marzaPct: 23.1,
        vat: 23,
        ean: "8903094073627",
        status: "aktywny",
        dataAktualizacji: "2026-08-01T09:00:00.000Z",
        rozmiar: "620/70R42",
        model: "AGRIMAX FACTOR",
      })
      .run();

    // `zasiejStagingZFixtures` wstawia z fixtures tylko `zmiana_kluczowa` i `wycofana` (fixture ma pięć takich pozycji
    // (`GET_staging.json` + `GET_staging_paged.json`), a `suppliers-lifecycle` filtruje po
    // `IN ('nowa','nowy','wycofana','zniknal')`. Dokładamy `nowa` (żeby druga gałąź listy też
    // była pokryta) i `zmiana_ceny` (żeby dowieść, że filtr realnie ODSIEWA, a nie przepuszcza).
    srodowisko.db
      .insert(stagingItems)
      .values([
        {
          typZmiany: "nowa",
          kod: "MO1_900",
          nazwa: "480/70R28 BKT AGRIMAX RT 855",
          dostawca: "MO1",
          magazyn: "—",
          powod: "pozycja pojawiła się w cenniku",
          utworzono: "2026-08-10T08:00:00.000Z",
        },
        {
          typZmiany: "wycofana",
          kod: "MO2_901",
          nazwa: "11.2-24 CULTOR AS AGRI 13",
          dostawca: "MO2",
          magazyn: "—",
          powod: "pozycja zniknęła z cennika",
          utworzono: "2026-08-11T08:00:00.000Z",
        },
        {
          typZmiany: "zmiana_ceny",
          kod: "MO2_902",
          nazwa: "13.6-28 CULTOR AS AGRI 19",
          dostawca: "MO2",
          magazyn: "—",
          powod: "cena w górę",
          utworzono: "2026-08-12T08:00:00.000Z",
        },
      ])
      .run();

    // `produkt_id` w `historia_cen` jest nullowalne, a `COUNT(DISTINCT produkt_id)` takie
    // wiersze POMIJA. Zasiew bazowy ma same nulle, więc bez tego wiersza kolumna `produkty`
    // w `suppliers-stability` byłaby zawsze zerem i nie dowiodłaby niczego.
    srodowisko.db
      .insert(historiaCen)
      .values({
        produktId: 1,
        kod: "MO9_336320",
        dostawca: "MO9",
        cenaZakupu: 5600,
        cenaSprzedazy: 7300,
        stan: 7,
        zarejestrowanoAt: "2026-08-04T10:00:00.000Z",
      })
      .run();
  });

  afterAll(() => srodowisko.posprzataj());

  it("mapa widoków niesie dokładnie dziesięć nazw z oryginału (:311-320)", () => {
    expect(NAZWY_WIDOKOW_EKSPORTU).toEqual([
      "suppliers-stability",
      "suppliers-lifecycle",
      "suppliers-stock",
      "ean-comparison",
      "unique",
      "prices-last",
      "availability-products",
      "sell-through",
      "margins",
      "rotation-inactive",
    ]);
  });

  it("suppliers-stability — pięć kolumn liczonych ZAWSZE z historia_cen", () => {
    const wiersze = eksportStabilnosciDostawcow(srodowisko.db);

    expect(wiersze.length).toBeGreaterThan(0);
    expect(Object.keys(wiersze[0]!)).toEqual([
      "dostawca",
      "produkty",
      "punkty",
      "sredniaCena",
      "sredniStan",
    ]);

    const mo9 = wiersze.find((w) => w.dostawca === "MO9")!;
    // Cztery migawki: trzy z zasiewu bazowego + jedna dołożona wyżej.
    expect(mo9.punkty).toBe(4);
    // Tylko jedna z nich ma niepuste `produkt_id` — reszta odpada z COUNT(DISTINCT).
    expect(mo9.produkty).toBe(1);
  });

  it("suppliers-lifecycle — sześć kolumn ze staging_items, tylko typy z listy oryginału", () => {
    const wiersze = eksportCykluZyciaDostawcow(srodowisko.db);

    expect(Object.keys(wiersze[0]!)).toEqual([
      "typ",
      "dostawca",
      "kod",
      "nazwa",
      "powod",
      "kiedy",
    ]);
    // Filtr przepuszcza WYŁĄCZNIE cztery typy z listy oryginału.
    for (const w of wiersze) expect(["nowa", "nowy", "wycofana", "zniknal"]).toContain(w.typ);
    const kody = wiersze.map((w) => w.kod);
    expect(kody).toContain("MO1_900"); // `nowa` — przechodzi
    expect(kody).toContain("MO2_901"); // `wycofana` — przechodzi
    expect(kody).not.toContain("MO2_902"); // `zmiana_ceny` — odsiane
    // ORDER BY utworzono DESC — znaczniki nie rosną w dół listy.
    const kiedy = wiersze.map((w) => w.kiedy);
    expect(kiedy).toEqual([...kiedy].sort().reverse());
  });

  it("suppliers-stock — pięć kolumn per dostawca, tylko produkty aktywne", () => {
    const wiersze = eksportStanuDostawcow(srodowisko.db);

    expect(wiersze.length).toBeGreaterThan(0);
    expect(Object.keys(wiersze[0]!)).toEqual([
      "dostawca",
      "produkty",
      "sredniStan",
      "dostepne",
      "dostepnoscPct",
    ]);
    // MO1 ma w zasiewie jeden produkt `wstrzymany` i jeden `aktywny` — liczy się tylko drugi.
    expect(wiersze.find((w) => w.dostawca === "MO1")?.produkty).toBe(1);
  });

  it("ean-comparison — siedem kolumn, wyłącznie EAN-y u co najmniej dwóch dostawców", () => {
    const wiersze = eksportPorownaniaEan(srodowisko.db);

    expect(wiersze).toHaveLength(1);
    expect(Object.keys(wiersze[0]!)).toEqual([
      "ean",
      "nazwa",
      "dostawcy",
      "cenaMin",
      "cenaMax",
      "spreadZl",
      "spreadPct",
    ]);
    expect(wiersze[0]!.ean).toBe("8903094073627");
    expect(wiersze[0]!.dostawcy).toBe(2);
    expect(wiersze[0]!.cenaMin).toBe(5000);
    expect(wiersze[0]!.cenaMax).toBe(5562.4);
    expect(wiersze[0]!.spreadZl).toBe(562.4);
  });

  it("unique — pięć kolumn, wyłącznie EAN-y u dokładnie jednego dostawcy", () => {
    const wiersze = eksportUnikalnychEan(srodowisko.db);

    expect(wiersze.length).toBeGreaterThan(0);
    expect(Object.keys(wiersze[0]!)).toEqual(["ean", "nazwa", "dostawca", "cenaZakupu", "stan"]);
    // EAN dzielony przez MO1 i MO9 jest tu wykluczony przez HAVING COUNT(DISTINCT dostawca)=1.
    expect(wiersze.map((w) => w.ean)).not.toContain("8903094073627");
  });

  it("prices-last — siedem kolumn, tylko pozycje z ceną starą", () => {
    const wiersze = eksportOstatnichCen(srodowisko.db);

    expect(wiersze.length).toBeGreaterThan(0);
    expect(Object.keys(wiersze[0]!)).toEqual([
      "utworzono",
      "dostawca",
      "kod",
      "nazwa",
      "cenaStara",
      "cenaNowa",
      "zmianaPct",
    ]);
    for (const w of wiersze) expect(w.cenaStara).not.toBeNull();
  });

  it("margins — sześć kolumn PER PRODUKT, z kolumną `marza_pct` w snake_case", () => {
    const wiersze = eksportMarz(srodowisko.db);

    expect(wiersze.length).toBeGreaterThan(0);
    // Inaczej niż zgrupowany dashboard `/margins` (dostawca/kategoria/marka/produkty/avg…).
    expect(Object.keys(wiersze[0]!)).toEqual([
      "kod",
      "nazwa",
      "dostawca",
      "kategoria",
      "marka",
      "marza_pct",
    ]);
    // ORDER BY marza_pct ASC — najniższa marża na górze.
    expect(wiersze[0]!.marza_pct).toBeLessThanOrEqual(wiersze[wiersze.length - 1]!.marza_pct!);
    // Wyłącznie produkty aktywne: MO1_100001 jest `wstrzymany`.
    expect(wiersze.map((w) => w.kod)).not.toContain("MO1_100001");
  });

  it("rotation-inactive — osiem kolumn i CAŁY aktywny katalog, bez progu dni", () => {
    const wiersze = eksportRotacji(srodowisko.db);

    expect(Object.keys(wiersze[0]!)).toEqual([
      "kod",
      "nazwa",
      "dostawca",
      "marka",
      "model",
      "rozmiar",
      "stan",
      "ostatniaAktualizacja",
    ]);
    // Dashboard `rotation/inactive?days` odsiewa świeże pozycje; eksport nie odsiewa nic.
    expect(wiersze).toHaveLength(eksportMarz(srodowisko.db).length);
  });

  /**
   * Charakteryzacja usterki produkcji, nie życzenie — `docs/rebuild-backlog.md` #32.
   *
   * Oba zapytania pytają `historia_cen` o kolumnę `nazwa`, której ta tabela nie ma. Historia
   * jest ZASIANA i ma cztery migawki, a mimo to wynik jest pusty — czyli CSV to sam BOM.
   * Gdyby #32 kiedyś naprawiono, te dwie asercje zapalą się i powiedzą, że zachowanie
   * odbudowy rozjechało się z produkcją.
   */
  describe("dwa widoki trwale puste mimo danych w historii (backlog #32)", () => {
    it("historia_cen jest zasiana — pusty wynik nie bierze się z braku danych", () => {
      expect(eksportStabilnosciDostawcow(srodowisko.db).length).toBeGreaterThan(0);
    });

    it("availability-products oddaje pustą listę → CSV to sam BOM", () => {
      expect(eksportDostepnosciProduktow(srodowisko.db)).toEqual([]);
    });

    it("sell-through oddaje pustą listę → CSV to sam BOM", () => {
      expect(eksportTempaSchodzenia(srodowisko.db)).toEqual([]);
    });
  });

  it("każdy widok z mapy da się wywołać i zwraca tablicę", () => {
    for (const nazwa of NAZWY_WIDOKOW_EKSPORTU) {
      expect(Array.isArray(WIDOKI_EKSPORTU[nazwa]!(srodowisko.db)), nazwa).toBe(true);
    }
  });
});
