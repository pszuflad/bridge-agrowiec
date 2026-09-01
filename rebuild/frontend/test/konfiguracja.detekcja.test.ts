/**
 * Port detekcji dostawcy (`FE()` + `qu`) — sprawdzany na PRAWDZIWYCH nagłówkach
 * cenników z `rebuild/backend/test/charakteryzacja/probki/`, czyli na tych samych
 * plikach, na których stoi gate charakteryzacji parserów z 3a.
 *
 * To jest cała wartość tego testu: gdyby detekcja była sprawdzana na nagłówkach
 * wymyślonych przeze mnie, przechodziłaby nawet wtedy, gdy rozjeżdża się z rzeczywistością.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  policzTrafienia,
  rozbijCsv,
  rozpoznajDostawce,
  SYGNATURY,
  wymusDostawce,
  znormalizuj,
  type AnalizaPliku,
} from "@/pages/konfiguracja/detekcja";

const korzenRepo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KATALOG_PROBEK = resolve(korzenRepo, "rebuild/backend/test/charakteryzacja/probki");

function pierwszaLiniaProbki(kod: string): string {
  const tresc = readFileSync(resolve(KATALOG_PROBEK, `${kod}.csv`), "latin1");
  return tresc.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
}

function naglowkiProbki(kod: string): string[] {
  return rozbijCsv(readFileSync(resolve(KATALOG_PROBEK, `${kod}.csv`), "utf8")).naglowki;
}

describe("rozpoznajDostawce — nazwa pliku ma pierwszeństwo", () => {
  it.each([
    ["bohnenkamp_2026.csv", "MO1"],
    ["Cennik_26002.csv", "MO2"],
    ["grasdorf-export.csv", "MO3"],
    ["agrowiec_wr.csv", "MO4"],
    ["agrowiec_mw.csv", "MO5"],
    ["cennik_agrowiec.csv", "MO6"],
    ["nokian-2026.csv", "MO7"],
    ["trelleborg.xlsx", "MO8"],
    ["agrorami.csv", "MO9"],
    ["GRI_2026.xlsx", "MO10"],
  ])("%s → %s z wysoką pewnością", (nazwa, kod) => {
    const wynik = rozpoznajDostawce(nazwa, []);
    expect(wynik.kod).toBe(kod);
    expect(wynik.pewnosc).toBe("wysoka");
    expect(wynik.powod).toContain("Nazwa pliku pasuje");
  });

  /**
   * MO8 i MO10 to XLSX i dla nich detekcja z nazwy jest JEDYNĄ, jaką mamy — treści
   * arkusza w przeglądarce nie czytamy (decyzja sesji 3f-1). Gdyby te wzorce zniknęły,
   * oba pliki wymagałyby ręcznego wyboru dostawcy.
   */
  it("MO8 i MO10 mają wzorce nazwy — bez nich XLSX byłby nierozpoznawalny", () => {
    for (const kod of ["MO8", "MO10"]) {
      expect(SYGNATURY.find((s) => s.kod === kod)?.nazwy.length).toBeGreaterThan(0);
    }
  });
});

describe("rozpoznajDostawce — nagłówki prawdziwych cenników", () => {
  /**
   * Wynik jest tu ZMIERZONY na próbkach, nie zgadnięty. MO4 i MO5 mają IDENTYCZNĄ
   * sygnaturę nagłówków (Handlopex Wrocław i Rzeszów), więc po samej treści są
   * nierozróżnialne i wygrywa wpis wcześniejszy — MO4. Rozróżnia je dopiero nazwa pliku.
   */
  it.each([
    ["MO2", "MO2"],
    ["MO4", "MO4"],
    ["MO5", "MO4"],
    ["MO6", "MO6"],
    ["MO7", "MO7"],
  ])("nagłówki %s przy neutralnej nazwie pliku → %s", (probka, oczekiwany) => {
    const wynik = rozpoznajDostawce("cennik.csv", naglowkiProbki(probka));
    expect(wynik.kod).toBe(oczekiwany);
    expect(wynik.pewnosc).toBe("wysoka");
    expect(wynik.powod).toContain("Dopasowano");
  });

  it("nazwa pliku rozstrzyga tam, gdzie nagłówki nie potrafią (MO4 vs MO5)", () => {
    expect(rozpoznajDostawce("agrowiec_mw.csv", naglowkiProbki("MO5")).kod).toBe("MO5");
    expect(rozpoznajDostawce("agrowiec_wr.csv", naglowkiProbki("MO4")).kod).toBe("MO4");
  });

  /**
   * MO3 po samych nagłówkach przegrywa z MO9: własna sygnatura daje mu 5 trafień,
   * a sygnatura MO9 zbiera 6 (`id`, `ean`, `producent`, `rozmiar`… to tokeny na tyle
   * ogólne, że trafiają w cudzy cennik). Oryginał porównuje LICZBĘ trafień, nie udział,
   * więc wygrywa MO9 — i to zostaje, bo tak działa produkcja. MO3 rozpoznaje się po
   * nazwie pliku, dla której ma cztery wzorce.
   */
  it("MO3 po samych nagłówkach wychodzi jako MO9 — rozstrzyga nazwa pliku", () => {
    expect(rozpoznajDostawce("cennik.csv", naglowkiProbki("MO3")).kod).toBe("MO9");
    expect(rozpoznajDostawce("grasdorf.csv", naglowkiProbki("MO3")).kod).toBe("MO3");
  });

  it("MO1 nie ma nagłówków — łapie go wzorzec pierwszej linii", () => {
    const wynik = rozpoznajDostawce("cennik.csv", [], pierwszaLiniaProbki("MO1"));
    expect(wynik.kod).toBe("MO1");
    expect(wynik.pewnosc).toBe("srednia");
    expect(wynik.powod).toContain("bez nagłówków");
  });

  it("nieznany format → brak rozpoznania i podpowiedź ręcznego wyboru", () => {
    const wynik = rozpoznajDostawce("losowe.csv", ["alfa", "beta", "gamma"]);
    expect(wynik.kod).toBe("");
    expect(wynik.pewnosc).toBe("brak");
    expect(wynik.powod).toContain("wybierz dostawcę ręcznie");
  });
});

/**
 * ODSTĘPSTWO ŚWIADOME (decyzja użytkownika, sesja 3f-1) — odsianie pustych nagłówków.
 *
 * Test pilnuje dokładnie tego jednego zachowania, bo bez niego regresja wróciłaby
 * niezauważona: cennik z kończącym średnikiem znów rozpoznawałby się jako MO9
 * „z wysoką pewnością", a Ania wgrałaby cudzy cennik na katalog MO9.
 */
describe("pusty nagłówek nie jest dopasowaniem (odstępstwo 3f-1)", () => {
  it("pusta kolumna nie daje trafienia żadnemu tokenowi sygnatury", () => {
    expect(policzTrafienia([""], ["id", "ean", "producent"])).toBe(0);
    expect(policzTrafienia(["   "], ["id"])).toBe(0);
  });

  it("kończący średnik nie przestawia rozpoznania na MO9", () => {
    const zPustaKolumna = [...naglowkiProbki("MO4"), ""];
    expect(rozpoznajDostawce("cennik.csv", zPustaKolumna).kod).toBe("MO4");
  });

  it("odsianie nie psuje zwykłego dopasowania", () => {
    expect(policzTrafienia(["Kod producenta", "", "Producent"], ["Kod producenta", "Producent"]))
      .toBe(2);
  });
});

describe("rozbijCsv", () => {
  it("wykrywa średnik jako separator w cennikach dostawców", () => {
    expect(rozbijCsv("a;b;c\n1;2;3").separator).toBe(";");
  });

  it("wykrywa przecinek, gdy jest go więcej niż średników", () => {
    expect(rozbijCsv("a,b,c\n1,2,3").separator).toBe(",");
  });

  it("zdejmuje BOM z pierwszego nagłówka (MO2 i MO6 mają BOM)", () => {
    expect(rozbijCsv("\uFEFFEAN;Beschreibung").naglowki[0]).toBe("EAN");
  });

  it("respektuje cudzysłowy i podwojony cudzysłów w polu", () => {
    expect(rozbijCsv('"a;b";"c""d";e').naglowki).toEqual(["a;b", 'c"d', "e"]);
  });

  it("pusty plik nie wywraca detekcji", () => {
    const wynik = rozbijCsv("");
    expect(wynik.naglowki).toEqual([]);
    expect(wynik.liczbaWierszy).toBe(0);
  });
});

describe("znormalizuj i policzTrafienia", () => {
  it("zdejmuje polskie znaki diakrytyczne i interpunkcję", () => {
    expect(znormalizuj("Indeks prędkości 1")).toBe("indeks predkosci 1");
    expect(znormalizuj("cena netto/szt")).toBe("cena netto/szt");
  });

  it("dopasowanie jest luźne w OBIE strony — tak jak w oryginale", () => {
    // „cena" w pliku trafia w „Cena netto" z sygnatury i odwrotnie.
    expect(policzTrafienia(["cena"], ["Cena netto"])).toBe(1);
    expect(policzTrafienia(["Cena netto"], ["cena"])).toBe(1);
  });
});

describe("wymusDostawce", () => {
  const analiza = { detekcja: { kod: "MO4", pewnosc: "wysoka", powod: "x" } } as AnalizaPliku;

  it("nadpisuje kod i oznacza pewność jako wymuszoną", () => {
    const wynik = wymusDostawce(analiza, "MO5");
    expect(wynik.detekcja).toEqual({
      kod: "MO5",
      pewnosc: "wymuszona",
      powod: "Wymuszone z UI (MO5)",
    });
  });

  it("nie rusza analizy, gdy kod się nie zmienia", () => {
    expect(wymusDostawce(analiza, "MO4")).toBe(analiza);
    expect(wymusDostawce(analiza, "")).toBe(analiza);
  });
});
