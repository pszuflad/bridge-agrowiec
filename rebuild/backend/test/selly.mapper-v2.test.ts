/**
 * Mapper v2 (`src/selly/rest/mapper-v2.ts`, port `origin/main:mirror/backend/selly/mapper_v2.cjs`;
 * karta I15.7, ticket 109).
 *
 * Czysta transformacja — bez bazy i bez sieci. Wartości wejściowe są takie, jakie daje surowy
 * odczyt SQLite (`0`/`1` zamiast boolean, liczby w kolumnach `profil`/`srednica`).
 */
import { describe, expect, it } from "vitest";

import {
  buildFeatures,
  buildFeaturesMirror,
  buildProductPayload,
  FEATURE_MAP,
  num,
  toSellyPayloadV2,
  yn,
  zastosowaniePierwsze,
  type CechaSelly,
  type WierszMapperaV2,
} from "../src/selly/rest/mapper-v2.js";

/** Wiersz wzorowany na `MO9_336320` z `PRODUKTY_TESTOWE` (kolumny jak z `collectFullSyncItems`). */
const WIERSZ: WierszMapperaV2 = {
  kod: "MO9_336320",
  nazwa: "620/70R42 BKT AGRIMAX FACTOR 166D/169A8 TL",
  waga: 242,
  kod_importu: "798368",
  kod_dostawcy: "521560",
  cena_zakupu: 5562.4,
  cena_sprzedazy: 7252,
  status: "aktywny",
  ean: "8903094073627",
  ean_is_valid: 1,
  kategoria: "Rolnicze",
  marka: "BKT",
  bieznik: "AGRIMAX FACTOR",
  rozmiar: "620/70R42",
  szerokosc: "620",
  profil: 70,
  srednica: 42,
  konstrukcja: "R",
  tl_tt: "TL",
  indeksy: "166D/169A8",
  indeks_nosnosci: "166/169",
  indeks_predkosci: "D/A8",
  dot: "nie starsza niz 3 lata",
  zastosowanie: "Ciągnik",
  ms: null,
  snow_3pmsf: null,
  label_snow: null,
};

const cecha = (features: CechaSelly[], nazwa: string): CechaSelly | undefined =>
  features.find((f) => f.name === nazwa);

describe("mapper v2 — transformacje wartości", () => {
  it("`yn`: puste i zera → null, znane prawdy → 'Tak', reszta → tekst po trim", () => {
    expect([null, undefined, "", 0, "0"].map(yn)).toEqual([null, null, null, null, null]);
    expect([1, "1", true, "Tak", "tak", "TAK"].map(yn)).toEqual(["Tak", "Tak", "Tak", "Tak", "Tak", "Tak"]);
    // ⚠ Zastane: nieznana wartość NIE jest normalizowana — wychodzi jako tekst.
    expect(yn(" Nie ")).toBe("Nie");
    expect(yn(false)).toBe("false");
  });

  it("`num`: liczba jako tekst, nieliczba przez `txt`", () => {
    expect([70, "70", 22.5, null, ""].map(num)).toEqual(["70", "70", "22.5", null, null]);
    expect(num("R-1W")).toBe("R-1W");
  });

  it("`zastosowaniePierwsze`: bierze pierwszy człon łańcucha `a + b`", () => {
    expect(zastosowaniePierwsze("Koparka + Ładowarka kołowa")).toBe("Koparka");
    expect(zastosowaniePierwsze("Ciągnik")).toBe("Ciągnik");
    expect(zastosowaniePierwsze(null)).toBeNull();
  });
});

describe("mapper v2 — cechy produktu", () => {
  it("mapa ma 21 cech, bez „Lód” i bez „Magazyny”", () => {
    expect(FEATURE_MAP).toHaveLength(21);
    const nazwy = FEATURE_MAP.map(([n]) => n);
    expect(nazwy).not.toContain("Lód");
    expect(nazwy).not.toContain("Magazyny");
    expect(nazwy).toContain("Bieżnik / model");
  });

  it("`buildFeatures` pomija puste i bierze `bieznik`, nie `model`", () => {
    const features = buildFeatures({ ...WIERSZ, ms: 1 });
    expect(cecha(features, "Bieżnik / model")).toEqual({ name: "Bieżnik / model", values: ["AGRIMAX FACTOR"] });
    expect(cecha(features, "Profil")).toEqual({ name: "Profil", values: ["70"] });
    expect(cecha(features, "Błoto + śnieg")).toEqual({ name: "Błoto + śnieg", values: ["Tak"] });
    // `snow_3pmsf`/`label_snow` są nullem — nie wchodzą wcale.
    expect(cecha(features, "Śnieg-3PMSF")).toBeUndefined();
    expect(cecha(features, "Śnieg")).toBeUndefined();
    expect(cecha(features, "Marka")).toEqual({ name: "Marka", values: ["BKT"] });
  });

  it("`buildFeaturesMirror`: zachowuje cechy spoza mapy, nadpisuje zarządzane, dopisuje brakujące", () => {
    const istniejace: CechaSelly[] = [
      { name: "Kolor", values: ["czarny"] },
      { name: "Marka", values: ["STARA MARKA"] },
    ];
    const mirror = buildFeaturesMirror(WIERSZ, istniejace);

    expect(mirror[0]).toEqual({ name: "Kolor", values: ["czarny"] });
    expect(mirror[1]).toEqual({ name: "Marka", values: ["BKT"] });
    expect(cecha(mirror, "Rozmiar")).toEqual({ name: "Rozmiar", values: ["620/70R42"] });
  });

  /** Backlog #81 — sedno poprawki z 2026-09-17 (`5dedefb`). */
  it("cecha zarządzana przez Bridge, teraz pusta, NIE dziedziczy starej wartości z Selly", () => {
    const mirror = buildFeaturesMirror({ ...WIERSZ, dot: null }, [
      { name: "DOT", values: ["nie starsza niz 3 lata"] },
      { name: "Gwarancja", values: ["24 mies."] },
    ]);

    expect(cecha(mirror, "DOT")).toBeUndefined();
    expect(cecha(mirror, "Gwarancja")).toEqual({ name: "Gwarancja", values: ["24 mies."] });
  });
});

describe("mapper v2 — payload produktu", () => {
  it("`toSellyPayloadV2` bez cech: pola produktu, bez VAT-u, ceny i kategorii", () => {
    expect(toSellyPayloadV2(WIERSZ)).toEqual({
      name: "620/70R42 BKT AGRIMAX FACTOR 166D/169A8 TL",
      weight: 242,
      provider_code: "798368",
      price_purchase: 5562.4,
      visible: true,
      ean: "8903094073627",
    });
  });

  it("EAN wchodzi tylko przy `ean_is_valid`; `visible` zależy od statusu; `provider_code` ma rezerwę", () => {
    expect(toSellyPayloadV2({ ...WIERSZ, ean_is_valid: 0 })).not.toHaveProperty("ean");
    expect(toSellyPayloadV2({ ...WIERSZ, status: "wstrzymany" }).visible).toBe(false);
    expect(toSellyPayloadV2({ ...WIERSZ, kod_importu: null }).provider_code).toBe("521560");
    expect(toSellyPayloadV2({ ...WIERSZ, kod_importu: null, kod_dostawcy: null }).provider_code).toBeNull();
    expect(toSellyPayloadV2({ ...WIERSZ, waga: null, cena_zakupu: null }).weight).toBe(0);
  });

  it("`existingSellyFeatures` (nawet puste) włącza tryb lustra, brak — same cechy Bridge", () => {
    const zLustra = toSellyPayloadV2(WIERSZ, { includeFeatures: true, existingSellyFeatures: [] });
    const bezLustra = toSellyPayloadV2(WIERSZ, { includeFeatures: true });
    expect(zLustra.features).toEqual(bezLustra.features);
    expect(toSellyPayloadV2(WIERSZ, { includeFeatures: false }).features).toBeUndefined();
  });

  it("`buildProductPayload` dokłada pola wymagane przy zakładaniu produktu", () => {
    const payload = buildProductPayload(WIERSZ, {
      catMap: new Map([["rolnicze", 1]]),
      prodMap: new Map([["bkt", 6]]),
    });

    expect(payload).toMatchObject({
      category_id: 1,
      producer_id: 6,
      // `product_code` to kod Bridge BEZ podkreślników — po tym samym kluczu szuka discovery.
      product_code: "MO9336320",
      price: 7252,
      provider_code: "798368",
    });
    expect((payload as { features: CechaSelly[] }).features.length).toBeGreaterThan(10);
  });

  it("brak kategorii albo producenta w słowniku → `_error` (komunikat czyta `markError` Toru 2)", () => {
    const bezKategorii = buildProductPayload(WIERSZ, { prodMap: new Map([["bkt", 6]]) });
    expect(bezKategorii).toEqual({ _error: 'Brak kategorii w slowniku: "Rolnicze" (klucz=rolnicze)' });

    const bezProducenta = buildProductPayload(WIERSZ, { catMap: new Map([["rolnicze", 1]]) });
    expect(bezProducenta).toEqual({ _error: 'Brak producenta w slowniku: "BKT" (klucz=bkt)' });
  });

  it("słowniki działają też jako zwykłe obiekty (oryginał obsługuje oba kształty)", () => {
    const payload = buildProductPayload(WIERSZ, { catMap: { rolnicze: 1 }, prodMap: { bkt: 6 } });
    expect(payload).toMatchObject({ category_id: 1, producer_id: 6 });
  });
});
