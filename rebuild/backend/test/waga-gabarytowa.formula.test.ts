/**
 * Formuła wagi gabarytowej paletowej — GŁÓWNY dowód zgodności z oryginałem.
 *
 * ⚠ DLACZEGO CIĘŻAR DOWODU LEŻY TUTAJ, A NIE W GATE'CIE. Dla ścieżki
 * `POST /api/waga-gabarytowa/oblicz` NIE ISTNIEJE żaden fixture (`contract/fixtures/` nie ma
 * ani jednego pliku o tej nazwie — sprawdzone), więc nie mamy nagrania produkcji, z którym
 * dałoby się porównać wynik. Zgodność opieramy na oczekiwaniach wyliczonych RĘCZNIE z kodu
 * `deminified/backend-index.cjs:48749-48769`, po jednym co najmniej na każdą gałąź decyzyjną.
 * To słabsza siatka niż fixture-diff i tak ją traktujemy.
 */
import { describe, expect, it } from "vitest";

import {
  obliczWageGabarytowa,
  type UstawieniaWagiGabarytowej,
} from "../src/waga-gabarytowa/formula.js";

/** Domyślne `waga_gab.*` z `backend-index.cjs:45633-45637`, po `parseFloat`. */
const DOMYSLNE: UstawieniaWagiGabarytowej = {
  szerPolpaleta: 55,
  szerPaleta: 80,
  wysPalety: 10,
  wspolczynnik: 0.000167,
};

describe("obliczWageGabarytowa — gałęzie progu szerokości", () => {
  /**
   * Szerokość 40 ≤ 55 → szerokość efektywna to STAŁA 60, nie próg 55.
   * 60 × 120 × (20+10) × 0,000167 = 36,072 kg.
   */
  it("szerokość poniżej progu półpalety liczy się jako 60 cm", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: 40, dlugosc: 120, wysokosc: 20 },
      DOMYSLNE,
    );

    expect(wynik.szerokoscEfektywna).toBe(60);
    expect(wynik.wysokoscZPaleta).toBe(30);
    expect(wynik.wagaGabarytowa).toBe(36.072);
    expect(wynik.opis).toBe(
      "Szerokość 40 cm ≤ 55 cm (półpaleta) → zaokrąglone do 60 cm",
    );
  });

  /** Granica jest DOMKNIĘTA (`h <= p`): dokładnie 55 wpada jeszcze w półpaletę. */
  it("szerokość równa progowi półpalety wpada w gałąź półpalety", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: 55, dlugosc: 100, wysokosc: 0 },
      DOMYSLNE,
    );

    expect(wynik.szerokoscEfektywna).toBe(60);
    expect(wynik.opis).toContain("(półpaleta)");
  });

  /**
   * 55 < 70 ≤ 80 → szerokość efektywna to próg palety, czyli 80.
   * 80 × 100 × (15+10) × 0,000167 = 33,4 kg.
   */
  it("szerokość między progami zaokrągla się do szerokości palety", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: 70, dlugosc: 100, wysokosc: 15 },
      DOMYSLNE,
    );

    expect(wynik.szerokoscEfektywna).toBe(80);
    expect(wynik.wysokoscZPaleta).toBe(25);
    expect(wynik.wagaGabarytowa).toBe(33.4);
    expect(wynik.opis).toBe(
      "Szerokość 70 cm > 55 cm, ≤ 80 cm (paleta) → zaokrąglone do 80 cm",
    );
  });

  /** Druga granica też domknięta (`h <= f`): 80 to jeszcze paleta, nie oryginał. */
  it("szerokość równa progowi palety wpada w gałąź palety", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: 80, dlugosc: 100, wysokosc: 0 },
      DOMYSLNE,
    );

    expect(wynik.szerokoscEfektywna).toBe(80);
    expect(wynik.opis).toContain("(paleta)");
  });

  /**
   * Powyżej progu palety idzie szerokość oryginalna.
   * 120 × 200 × (50+10) × 0,000167 = 240,48 kg.
   */
  it("szerokość powyżej progu palety zostaje bez zaokrąglenia", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: 120, dlugosc: 200, wysokosc: 50 },
      DOMYSLNE,
    );

    expect(wynik.szerokoscEfektywna).toBe(120);
    expect(wynik.wagaGabarytowa).toBe(240.48);
    expect(wynik.opis).toBe("Szerokość 120 cm > 80 cm → użyto oryginału");
  });
});

describe("obliczWageGabarytowa — zaokrąglenie i współczynnik", () => {
  /**
   * `Math.round(x * 1e3) / 1e3` — dokładnie trzy miejsca po przecinku.
   * 60 × 37 × (0+10) × 0,000167 = 3,7074 → 3,707.
   */
  it("waga jest zaokrąglona do trzech miejsc po przecinku", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: 10, dlugosc: 37, wysokosc: 0 },
      DOMYSLNE,
    );

    expect(wynik.wagaGabarytowa).toBe(3.707);
  });

  /** Współczynnik wraca w odpowiedzi taki, jaki wszedł — klient go pokazuje. */
  it("współczynnik z ustawień trafia do odpowiedzi bez zmian", () => {
    const wynik = obliczWageGabarytowa({ szerokosc: 10, dlugosc: 10, wysokosc: 0 }, DOMYSLNE);

    expect(wynik.wspolczynnik).toBe(0.000167);
  });

  /**
   * Nadpisany config zmienia WSZYSTKIE cztery zachowania naraz: progi, stałą wysokości
   * palety i mnożnik. 90 × 100 × (10+20) × 0,0002 = 54 kg.
   */
  it("nadpisany config waga_gab.* przesuwa progi i zmienia wynik", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: 70, dlugosc: 100, wysokosc: 10 },
      { szerPolpaleta: 30, szerPaleta: 90, wysPalety: 20, wspolczynnik: 0.0002 },
    );

    expect(wynik.szerokoscEfektywna).toBe(90);
    expect(wynik.wysokoscZPaleta).toBe(30);
    expect(wynik.wagaGabarytowa).toBe(54);
    expect(wynik.opis).toBe(
      "Szerokość 70 cm > 30 cm, ≤ 90 cm (paleta) → zaokrąglone do 90 cm",
    );
  });
});

describe("obliczWageGabarytowa — wejścia nietypowe (port `parseFloat(x || \"0\")`)", () => {
  /** Puste ciało: wszystkie wymiary schodzą do 0, więc waga też. Nadal 1:1 z oryginałem. */
  it("puste ciało daje zera i wagę 0, bez żadnego błędu", () => {
    const wynik = obliczWageGabarytowa({}, DOMYSLNE);

    expect(wynik.szerokoscEfektywna).toBe(60);
    expect(wynik.wysokoscZPaleta).toBe(10);
    expect(wynik.wagaGabarytowa).toBe(0);
    expect(wynik.opis).toBe("Szerokość 0 cm ≤ 55 cm (półpaleta) → zaokrąglone do 60 cm");
  });

  /** Front wysyła stringi z inputów `type="number"` — muszą liczyć się tak samo. */
  it("wymiary podane jako stringi liczą się identycznie jak liczby", () => {
    const zeStringow = obliczWageGabarytowa(
      { szerokosc: "70", dlugosc: "100", wysokosc: "15" },
      DOMYSLNE,
    );
    const zLiczb = obliczWageGabarytowa(
      { szerokosc: 70, dlugosc: 100, wysokosc: 15 },
      DOMYSLNE,
    );

    expect(zeStringow).toEqual(zLiczb);
  });

  /** `parseFloat` czyta prefiks liczbowy — „60cm" to 60, nie błąd. Tak jest w oryginale. */
  it("wartość z jednostką w tekście czyta się jako prefiks liczbowy", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: "70cm", dlugosc: "100 cm", wysokosc: "15" },
      DOMYSLNE,
    );

    expect(wynik.wagaGabarytowa).toBe(33.4);
  });

  /** `null`, `""` i `false` przechodzą przez `||` na `"0"` — to nie jest NaN. */
  it("null, pusty string i false schodzą do zera przez operator ||", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: null, dlugosc: "", wysokosc: false },
      DOMYSLNE,
    );

    expect(wynik.wagaGabarytowa).toBe(0);
    expect(wynik.wysokoscZPaleta).toBe(10);
  });

  /**
   * ⚠ NaN PRZECHODZI PRZEZ CAŁĄ FORMUŁĘ — i to jest zachowanie produkcji, nie usterka
   * odbudowy. Oba porównania z NaN są fałszywe, więc wpada trzecia gałąź („użyto oryginału"),
   * a `res.json` zserializuje NaN do `null`. Gdyby ktoś kiedyś dodał tu walidację, ten test
   * ma go zatrzymać i zmusić do świadomej decyzji.
   */
  it("nieparsowalna szerokość daje NaN i gałąź „użyto oryginału”, nie błąd", () => {
    const wynik = obliczWageGabarytowa(
      { szerokosc: "abc", dlugosc: 100, wysokosc: 10 },
      DOMYSLNE,
    );

    expect(Number.isNaN(wynik.szerokoscEfektywna)).toBe(true);
    expect(Number.isNaN(wynik.wagaGabarytowa)).toBe(true);
    expect(wynik.opis).toBe("Szerokość NaN cm > 80 cm → użyto oryginału");
    expect(JSON.parse(JSON.stringify(wynik)).wagaGabarytowa).toBeNull();
  });
});
