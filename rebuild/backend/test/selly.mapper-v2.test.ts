/**
 * Mapper Bridge → Selly v2 (`src/selly/mapper-v2.ts`, port `mapper_v2.cjs`).
 *
 * ⚠ W TORZE 1 TEN MODUŁ NIE JEST WOŁANY ANI RAZU — `sync-delta.ts` liczy deltę SQL-em
 * i wysyła gołe `{quantity, price}`. Testujemy go mimo to, bo jest portem 1:1 pliku Ani
 * i fundamentem dla Toru 2 (13d-2). To czyste funkcje: żadnej bazy, żadnej sieci.
 */
import { describe, expect, it } from "vitest";

import {
  DOMYSLNA_STAWKA_VAT,
  DOSTAWCA_NA_FEATURE_ID_MAGAZYNU,
  featureIdMagazynuDlaDostawcy,
  MAPA_CECH,
  naPayloadDelty,
  naPayloadSellyV2,
  num,
  txt,
  yn,
  zastosowaniePierwsze,
  zbudujCechy,
  zbudujCechyLustro,
} from "../src/selly/mapper-v2.js";

describe("mapper v2 — helpery transformacji", () => {
  it("`yn` sprowadza flagi Bridge do `'Tak'` albo `null`", () => {
    for (const puste of [null, undefined, "", 0, "0"]) {
      expect(yn(puste)).toBeNull();
    }
    for (const prawda of [1, "1", true, "Tak", "tak", "TAK"]) {
      expect(yn(prawda)).toBe("Tak");
    }
    // Awaryjnie: cokolwiek innego idzie jako string (np. liczba dB) — 1:1 z oryginałem.
    expect(yn("72")).toBe("72");
  });

  it("`txt` przycina i zamienia pustkę na `null`", () => {
    expect(txt("  BKT  ")).toBe("BKT");
    expect(txt("   ")).toBeNull();
    expect(txt(null)).toBeNull();
  });

  it("`num` gubi końcowe zera, a nie-liczbę przepuszcza jako tekst", () => {
    expect(num(17.5)).toBe("17.5");
    expect(num(17.0)).toBe("17");
    expect(num("")).toBeNull();
    expect(num("R-1W")).toBe("R-1W");
  });

  it("`zastosowaniePierwsze` bierze człon przed `+`", () => {
    expect(zastosowaniePierwsze("Koparka + Ładowarka kołowa")).toBe("Koparka");
    expect(zastosowaniePierwsze("Ciągnik")).toBe("Ciągnik");
    expect(zastosowaniePierwsze(null)).toBeNull();
  });
});

describe("mapper v2 — mapa 21 cech", () => {
  it("ma dokładnie 21 pozycji, w kolejności oryginału", () => {
    expect(MAPA_CECH).toHaveLength(21);
    expect(MAPA_CECH.map(([nazwa]) => nazwa)).toEqual([
      "Bieżnik / model",
      "Rozmiar",
      "Szerokość opony",
      "Profil",
      "Średnica",
      "Rozmiar alternatywny",
      "R/D",
      "PR",
      "TL/TT",
      "Indeksy",
      "Indeks nośności",
      "Indeks prędkości",
      "DOT",
      "Zastosowanie",
      "Przyczepność",
      "Opór toczenia",
      "Hałas",
      "Błoto + śnieg",
      "Śnieg-3PMSF",
      "Śnieg",
      "Marka",
    ]);
  });

  it("⚠ „Bieżnik / model” bierze `bieznik`, NIE `model` (decyzja Anny)", () => {
    const [, pole] = MAPA_CECH[0]!;
    expect(pole).toBe("bieznik");
  });

  it("⚠ NIE mapuje „Lód” ani „Magazyny”", () => {
    const nazwy = MAPA_CECH.map(([n]) => n);
    // `label_ice` jest w Bridge zepsute (0% pokrycia, wartości „0.0");
    // „Magazyny" to cecha WARIANTU, idzie osobną ścieżką (discovery).
    expect(nazwy).not.toContain("Lód");
    expect(nazwy).not.toContain("Magazyny");
    expect(MAPA_CECH.map(([, p]) => p)).not.toContain("label_ice");
  });

  it("`zbudujCechy` pomija puste — nie kasujemy tym, co jest w Selly", () => {
    const cechy = zbudujCechy({
      bieznik: "AGRIMAX",
      rozmiar: "620/70R42",
      profil: 70,
      srednica: 42.0,
      ms: 1,
      snow_3pmsf: 0, // → null, więc NIE wychodzi
      label_noise: null, // → null, więc NIE wychodzi
      marka: "BKT",
    });

    expect(cechy).toEqual([
      { name: "Bieżnik / model", values: ["AGRIMAX"] },
      { name: "Rozmiar", values: ["620/70R42"] },
      { name: "Profil", values: ["70"] },
      { name: "Średnica", values: ["42"] },
      { name: "Błoto + śnieg", values: ["Tak"] },
      { name: "Marka", values: ["BKT"] },
    ]);
  });

  /**
   * ⭐ Tryb „lustro" jest bezpieczny dla cudzego sklepu: cechy spoza NASZEJ mapy zostają
   * nietknięte. Bez tego wysłanie payloadu skasowałoby w Selly wszystko, czego nie znamy.
   */
  it("`zbudujCechyLustro` zachowuje cechy spoza mapy i dokłada nasze", () => {
    const wynik = zbudujCechyLustro({ marka: "BKT", rozmiar: "620/70R42" }, [
      { name: "Kolor", values: ["czarny"] }, // spoza mapy — MUSI przetrwać
      { name: "Marka", values: ["STARA"] }, // w mapie — nadpisujemy
    ]);

    expect(wynik).toEqual([
      { name: "Kolor", values: ["czarny"] },
      { name: "Marka", values: ["BKT"] },
      { name: "Rozmiar", values: ["620/70R42"] },
    ]);
  });
});

describe("mapper v2 — payload produktu", () => {
  const WIERSZ = {
    nazwa: "620/70R42 BKT AGRIMAX",
    vat: 23,
    waga: 92.5,
    kod_importu: "798368",
    kod_dostawcy: "STARY-KOD",
    cena_zakupu: 5562.4,
    status: "aktywny",
    ean: "8903094073627",
    ean_is_valid: 1,
  };

  /**
   * ⭐⭐ TO JEST TA NAPRAWA BUGA, dla której `mapper_v2` w ogóle powstał: `provider_code`
   * bierze `kod_importu`, a nie `kod_dostawcy` jak v1.
   */
  it("`provider_code` = `kod_importu`, nie `kod_dostawcy`", () => {
    expect(naPayloadSellyV2(WIERSZ).provider_code).toBe("798368");
  });

  it("gdy `kod_importu` pusty, spada na `kod_dostawcy`, a potem na `null`", () => {
    expect(naPayloadSellyV2({ ...WIERSZ, kod_importu: null }).provider_code).toBe("STARY-KOD");
    expect(
      naPayloadSellyV2({ ...WIERSZ, kod_importu: null, kod_dostawcy: null }).provider_code,
    ).toBeNull();
  });

  it("wysyła tylko pola, które chcemy nadpisać — bez SEO, kategorii i magazynu", () => {
    const payload = naPayloadSellyV2(WIERSZ);

    expect(payload).toEqual({
      name: "620/70R42 BKT AGRIMAX",
      vat_rate: 23,
      weight: 92.5,
      provider_code: "798368",
      price_purchase: 5562.4,
      visible: true,
      ean: "8903094073627",
    });
    // Świadomie NIEOBECNE (komentarz oryginału): SEO, kategorie, magazyn, cena sprzedaży.
    for (const pole of [
      "content_html",
      "html_title",
      "category_id",
      "producer_id",
      "warehouse_id",
      "price",
    ]) {
      expect(payload).not.toHaveProperty(pole);
    }
  });

  it("`ean` idzie WYŁĄCZNIE gdy `ean_is_valid`", () => {
    expect(naPayloadSellyV2({ ...WIERSZ, ean_is_valid: 0 })).not.toHaveProperty("ean");
    expect(naPayloadSellyV2({ ...WIERSZ, ean: null })).not.toHaveProperty("ean");
  });

  it("`visible` odzwierciedla status, a brak VAT-u spada na 23", () => {
    expect(naPayloadSellyV2({ ...WIERSZ, status: "wstrzymany" }).visible).toBe(false);
    expect(naPayloadSellyV2({ ...WIERSZ, vat: null }).vat_rate).toBe(DOMYSLNA_STAWKA_VAT);
  });

  it("cechy dochodzą tylko na żądanie (Tor 2), nie domyślnie (Tor 1)", () => {
    expect(naPayloadSellyV2(WIERSZ)).not.toHaveProperty("features");
    expect(
      naPayloadSellyV2({ ...WIERSZ, marka: "BKT" }, { includeFeatures: true }).features,
    ).toEqual([{ name: "Marka", values: ["BKT"] }]);
  });
});

describe("mapper v2 — `naPayloadDelty` (martwe w Torze 1)", () => {
  it("bez zmian oddaje `null`", () => {
    expect(
      naPayloadDelty(
        { cena_sprzedazy: 100, cena_zakupu: 80, stan: 5 },
        { cena_sprzedazy_wyslana: 100, cena_zakupu_wyslana: 80, stan_wyslany: 5 },
      ),
    ).toBeNull();
  });

  it("zmiana ceny wchodzi do payloadu, stan idzie polami `_stock*`", () => {
    const wynik = naPayloadDelty(
      { cena_sprzedazy: 120, cena_zakupu: 80, stan: 9 },
      { cena_sprzedazy_wyslana: 100, cena_zakupu_wyslana: 80, stan_wyslany: 5 },
    );

    // `price_purchase` NIE wchodzi — cena zakupu się nie zmieniła.
    expect(wynik).toEqual({ price: 120, _stock: 9, _stockChanged: true });
  });

  it("brak snapshotu traktuje wszystko jako zmianę", () => {
    expect(naPayloadDelty({ cena_sprzedazy: 10, cena_zakupu: 5, stan: 1 }, null)).toMatchObject({
      price: 10,
      price_purchase: 5,
      _stockChanged: true,
    });
  });
});

describe("mapper v2 — feature_id Magazynów", () => {
  it("zna pięć dostawców odkrytych z produkcji", () => {
    expect(DOSTAWCA_NA_FEATURE_ID_MAGAZYNU).toEqual({ MO9: 1, MO5: 2, MO4: 3, MO3: 4, MO2: 5 });
  });

  it("dla nieznanego dostawcy oddaje `null` — do wykrycia przy auto-create", () => {
    expect(featureIdMagazynuDlaDostawcy("MO2")).toBe(5);
    expect(featureIdMagazynuDlaDostawcy("MO7")).toBeNull();
  });
});
