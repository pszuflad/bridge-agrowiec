/**
 * Mapowanie produktu na payload Selly (blok 8a) — port `mirror/backend/selly/mapper.cjs`.
 *
 * Najgęstsza logika całej iteracji siedzi w `mapujZastosowanieNaKategorie`: to ona decyduje,
 * do której kategorii w cudzym sklepie trafi produkt. Ma trzy wyjścia (`zastosowanie`,
 * `fallback_kategoria`, `fallback_empty`) i regułę dziedziczenia, której nie widać po
 * sygnaturze. Fixture'a dla niej nie ma — tabele `selly_*_map` nie są wystawione przez API.
 *
 * ⚠ ZWIĄZEK Z BACKLOGIEM #12. Produkt bez `zastosowanie` wpada w `fallback_kategoria`, czyli
 * ląduje wyłącznie w kategorii głównej, bez podkategorii i bez `multi_cat`. W produkcji pole
 * to jest uzupełniane po każdej akceptacji stagingu przez `__restoreZastosowanie()`, którego
 * świadomie nie portujemy (plan.md D3). Testy niżej zamrażają OBIE ścieżki, żeby skutek tej
 * decyzji był widoczny w kodzie, a nie tylko w dokumentacji.
 */
import { beforeEach, afterEach, describe, expect, it } from "vitest";

import {
  DOMYSLNY_MAGAZYN_ID,
  mapujKategorieGlownaId,
  mapujMagazynId,
  mapujProducentaId,
  mapujZastosowanieNaKategorie,
  naPayloadSelly,
  podzielZastosowanie,
  walidujPayload,
  zbudujOpisOpony,
  type MapySelly,
} from "../src/selly/mapper.js";
import type { ProduktWewnetrzny } from "../src/repos/products.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { zasiejMapySelly, zasiejProdukty } from "./gate/dane.js";
import { produktPoKodzie } from "../src/repos/selly.js";

const MAPY: MapySelly = {
  producerMap: { bkt: 6, alliance: 3 },
  catMap: { "opony rolnicze": 1 },
  vatMap: { "23": 5 },
  whMap: { mo9: 7, "magazyn główny": 1 },
};

describe("podzielZastosowanie", () => {
  it("rozbija po `+` i przycina białe znaki", () => {
    expect(podzielZastosowanie("Koparka + Ładowarka kołowa")).toEqual([
      "Koparka",
      "Ładowarka kołowa",
    ]);
  });

  it("brak wartości daje pustą listę, a nie listę z pustym napisem", () => {
    expect(podzielZastosowanie(null)).toEqual([]);
    expect(podzielZastosowanie("")).toEqual([]);
    expect(podzielZastosowanie(" + + ")).toEqual([]);
  });
});

describe("mapowanie na id-ki Selly", () => {
  it("producent szukany po nazwie małymi literami", () => {
    expect(mapujProducentaId("BKT", MAPY.producerMap)).toBe(6);
    expect(mapujProducentaId(" bkt ", MAPY.producerMap)).toBe(6);
    expect(mapujProducentaId("NIEZNANA", MAPY.producerMap)).toBeNull();
    expect(mapujProducentaId(null, MAPY.producerMap)).toBeNull();
  });

  /** Każdy dostawca ma w Selly magazyn o nazwie równej swojemu kodowi; brak → główny. */
  it("magazyn per dostawca, z zejściem do magazynu głównego", () => {
    expect(mapujMagazynId("MO9", MAPY.whMap)).toBe(7);
    expect(mapujMagazynId("MO1", MAPY.whMap)).toBe(1);
    expect(mapujMagazynId("MO1", {})).toBe(DOMYSLNY_MAGAZYN_ID);
  });
});

describe("mapujZastosowanieNaKategorie — trzy ścieżki i dziedziczenie", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejMapySelly(baza.db);
  });

  afterEach(() => baza.posprzataj());

  it("kategoria główna czytana z `selly_kategoria_norm_map` po surowej wartości", () => {
    expect(mapujKategorieGlownaId(baza.db, "Rolnicze")).toBe(1);
    expect(mapujKategorieGlownaId(baza.db, " Rolnicze ")).toBe(1);
    // Tabela istnieje właśnie po to, żeby trzymać warianty pisowni — wariantu, którego
    // w niej nie ma, NIE zgadujemy.
    expect(mapujKategorieGlownaId(baza.db, "rolnicze")).toBeNull();
    expect(mapujKategorieGlownaId(baza.db, null)).toBeNull();
  });

  it("znane zastosowanie → `source: zastosowanie`, pierwszy id jest główny", () => {
    const wynik = mapujZastosowanieNaKategorie(baza.db, {
      zastosowanie: "Ciągnik + Koparka",
      kategoria: "Rolnicze",
    });

    expect(wynik).toEqual({ category_id: 11, extra_cat_ids: [33], source: "zastosowanie" });
  });

  it("brak zastosowania → `fallback_kategoria` z kategorii produktu", () => {
    const wynik = mapujZastosowanieNaKategorie(baza.db, {
      zastosowanie: null,
      kategoria: "Rolnicze",
    });

    expect(wynik).toEqual({ category_id: 1, extra_cat_ids: [], source: "fallback_kategoria" });
  });

  /**
   * ⚠ To jest ścieżka, w którą wpada produkcja po każdym imporcie, dopóki backlog #12
   * pozostaje nieporządzony: `zastosowanie` puste → produkt bez podkategorii.
   */
  it("brak zastosowania I niemapowalna kategoria → `category_id: null`", () => {
    const wynik = mapujZastosowanieNaKategorie(baza.db, {
      zastosowanie: null,
      kategoria: "Przyczepy",
    });

    expect(wynik).toEqual({ category_id: null, extra_cat_ids: [], source: "fallback_kategoria" });
  });

  it("same nieznane zastosowania → `fallback_empty`, nie błąd", () => {
    const wynik = mapujZastosowanieNaKategorie(baza.db, {
      zastosowanie: "Forwarder + Skider",
      kategoria: "Rolnicze",
    });

    expect(wynik).toEqual({ category_id: 1, extra_cat_ids: [], source: "fallback_empty" });
  });

  /**
   * ⚠ „(ogólne)" ma `dziedziczy_kategorie_produktu=1` — podstawia kategorię główną produktu
   * zamiast własnej podkategorii. Słowo „ogólne" NIGDY nie trafia do Selly jako nazwa.
   */
  it("wartość dziedzicząca podstawia kategorię główną produktu", () => {
    const wynik = mapujZastosowanieNaKategorie(baza.db, {
      zastosowanie: "(ogólne)",
      kategoria: "Przemysłowe",
    });

    expect(wynik).toEqual({ category_id: 3, extra_cat_ids: [], source: "zastosowanie" });
  });

  it("dziedziczenie bez mapowalnej kategorii produktu schodzi do `fallback_empty`", () => {
    const wynik = mapujZastosowanieNaKategorie(baza.db, {
      zastosowanie: "(ogólne)",
      kategoria: "Przyczepy",
    });

    expect(wynik).toEqual({ category_id: null, extra_cat_ids: [], source: "fallback_empty" });
  });

  it("duplikaty są usuwane, a kolejność pierwszego wystąpienia decyduje o głównej", () => {
    const wynik = mapujZastosowanieNaKategorie(baza.db, {
      zastosowanie: "Koparka + Ciągnik + Koparka",
      kategoria: "Rolnicze",
    });

    expect(wynik).toEqual({ category_id: 33, extra_cat_ids: [11], source: "zastosowanie" });
  });
});

describe("naPayloadSelly i walidacja", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejMapySelly(baza.db);
    zasiejProdukty(baza.db);
  });

  afterEach(() => baza.posprzataj());

  const produkt = (kod: string): ProduktWewnetrzny => {
    const p = produktPoKodzie(baza.db, kod);
    if (!p) throw new Error(`brak produktu ${kod} w danych testowych`);
    return p;
  };

  it("buduje komplet pól payloadu Selly z wiersza `products`", () => {
    const payload = naPayloadSelly(baza.db, produkt("MO9_336320"), MAPY);

    expect(payload).toMatchObject({
      name: "620/70R42 BKT AGRIMAX FACTOR 166D/169A8 TL",
      category_id: 11,
      producer_id: 6,
      price: 7252,
      visible: true,
      product_code: "MO9_336320",
      vat_rate: 23,
      price_purchase: 5562.4,
      warehouse_id: 7,
      unit_of_measure: 1,
      availability: "dostępny",
      _extra_cat_ids: [],
    });
  });

  /**
   * `provider_code` schodzi do `kod`, gdy produkt nie ma własnego kodu dostawcy. Cenniki
   * kilku dostawców tej kolumny nie mają w ogóle, więc to nie jest przypadek brzegowy.
   */
  it("`provider_code` bierze `kodDostawcy`, a bez niego `kod`", () => {
    expect(naPayloadSelly(baza.db, produkt("MO9_336319"), MAPY).provider_code).toBe("521559");

    baza.sqlite
      .prepare("UPDATE products SET kod_dostawcy = NULL WHERE kod = ?")
      .run("MO9_336320");
    expect(naPayloadSelly(baza.db, produkt("MO9_336320"), MAPY).provider_code).toBe("MO9_336320");
  });

  it("nieznana marka daje `producer_id: undefined`, nie null", () => {
    // `MITAS` nie jest w `MAPY.producerMap`.
    const payload = naPayloadSelly(baza.db, produkt("MO1_100001"), MAPY);
    expect(payload.producer_id).toBeUndefined();
  });

  it("opis techniczny jest tabelą HTML, a produkt bez parametrów daje pusty napis", () => {
    const opis = zbudujOpisOpony(produkt("MO9_336320"));
    expect(opis).toContain('<table class="tire-specs">');
    expect(opis).toContain("<b>Rozmiar</b>");

    const golyProdukt = { kod: "X" } as ProduktWewnetrzny;
    expect(zbudujOpisOpony(golyProdukt)).toBe("");
  });

  it("boole opisowe wchodzą jako „tak”, a nieustawione nie wchodzą wcale", () => {
    const zFlagami = zbudujOpisOpony(produkt("MO9_336319"));
    const bezFlag = zbudujOpisOpony(produkt("MO9_336320"));

    expect(zFlagami).toContain("<b>Reinforced</b></td><td>tak");
    expect(bezFlag).not.toContain("Reinforced");
  });

  describe("walidujPayload — komunikaty verbatim", () => {
    const bazowy = () => naPayloadSelly(baza.db, produkt("MO9_336320"), MAPY);

    it("kompletny payload przechodzi", () => {
      expect(walidujPayload(bazowy())).toEqual({ ok: true, errors: [] });
    });

    it("brak kategorii, marki i nazwy daje trzy osobne komunikaty", () => {
      const wynik = walidujPayload({
        ...bazowy(),
        name: "",
        category_id: null,
        producer_id: undefined,
      });

      expect(wynik.ok).toBe(false);
      expect(wynik.errors).toEqual([
        "Brak name",
        "Brak category_id (nieznana kategoria)",
        "Brak producer_id (nieznana marka) — produkt zostanie pominięty",
      ]);
    });

    /**
     * ⚠ Cena 0 jest sprawdzana OSOBNO od `price >= 0`, więc daje inny komunikat niż cena
     * ujemna. To nie jest redundancja: zero oznacza „cennik nie podał ceny", a ujemna —
     * „dane są zepsute".
     */
    it("cena 0 i cena ujemna dają RÓŻNE komunikaty", () => {
      expect(walidujPayload({ ...bazowy(), price: 0 }).errors).toEqual([
        "Cena = 0 — produkt nie może być wysłany do Selly",
      ]);
      expect(walidujPayload({ ...bazowy(), price: -1 }).errors).toEqual(["Nieprawidłowa cena"]);
    });

    it("brak `product_code` jest błędem", () => {
      expect(walidujPayload({ ...bazowy(), product_code: "" }).errors).toContain(
        "Brak product_code",
      );
    });
  });
});
