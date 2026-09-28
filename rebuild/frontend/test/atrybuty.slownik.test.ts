/**
 * Reguła scalania list wyboru w dialogu reguł (`/narzuty`) — sesja 7b, część B.
 *
 * PO CO OSOBNY PLIK: różnica między „marki = suma słownika i katalogu” a „kategorie = sam
 * słownik” jest NIEWIDOCZNA NA OKO. Po odwróceniu reguły obie listy dalej się wypełniają
 * i dalej da się zapisać regułę — psuje się tylko to, że kategoria spoza katalogu przestaje
 * być wybieralna (czyli jedyny powód, dla którego oryginał sięga po słownik), a marki z
 * katalogu znikają. Te testy mają paść, gdy ktoś zamieni te dwa źródła miejscami.
 *
 * Wzorzec z oryginału: `deminified/frontend-index.js:24204-24211`.
 */
import { describe, expect, it } from "vitest";

import type { Wartosc } from "@/pages/atrybuty/api";
import {
  dostawcyDoWyboru,
  kategorieDoWyboru,
  markiDoWyboru,
  opcjeWarunku,
  placeholderWyboru,
  wartosciRodzaju,
  type Dostawca,
  type ProduktZMarka,
} from "@/pages/narzuty/slownik";
import { produktyZFixtura, slownikZFixtura, dostawcyZFixtura } from "./msw/kontrakt";

/**
 * Fixture `GET_atrybuty.json` niesie KSZTAŁT (i rodzaje `kategoria`/`konstrukcja`), ale jego
 * pięć nagranych wartości to same `bieznik` — do sprawdzenia reguły dokładamy wiersze tego
 * samego kształtu. To nie jest obchodzenie kontraktu: kształt bierzemy z nagrania, treść
 * dobieramy tak, żeby różnica między dwoma źródłami w ogóle była widoczna.
 */
const SLOWNIK: Wartosc[] = [
  ...slownikZFixtura().wartosci,
  { id: 1, rodzaj: "marka", wartosc: "Alliance" },
  { id: 2, rodzaj: "marka", wartosc: "BKT" },
  { id: 3, rodzaj: "kategoria", wartosc: "Rolnicze" },
  { id: 4, rodzaj: "kategoria", wartosc: "Quady" },
  { id: 5, rodzaj: "konstrukcja", wartosc: "R" },
  { id: 6, rodzaj: "vfIf", wartosc: "VF" },
];

const PRODUKTY: ProduktZMarka[] = [
  { marka: "BKT" }, // jest i w słowniku, i w katalogu — nie może się zdublować
  { marka: "Michelin" }, // tylko w katalogu
  { marka: "—" }, // placeholder braku marki — nie wchodzi na listę
  { marka: null },
  { marka: "" },
];

describe("marki — SUMA słownika i katalogu", () => {
  it("bierze marki z OBU źródeł", () => {
    const marki = markiDoWyboru(SLOWNIK, PRODUKTY);
    expect(marki).toContain("Alliance"); // tylko słownik
    expect(marki).toContain("Michelin"); // tylko katalog
  });

  it("nie dubluje marki obecnej w obu źródłach", () => {
    expect(markiDoWyboru(SLOWNIK, PRODUKTY).filter((m) => m === "BKT")).toHaveLength(1);
  });

  it("pomija placeholder „—” oraz puste marki produktów", () => {
    const marki = markiDoWyboru(SLOWNIK, PRODUKTY);
    expect(marki).not.toContain("—");
    expect(marki).not.toContain("");
  });

  it("sortuje po polsku", () => {
    const marki = markiDoWyboru([{ id: 1, rodzaj: "marka", wartosc: "Żubr" }], [
      { marka: "Zeta" },
      { marka: "Ćma" },
    ]);
    expect(marki).toEqual(["Ćma", "Zeta", "Żubr"]);
  });

  it("BEZ słownika degraduje się do samego katalogu — tak wyglądał dialog przed 7b", () => {
    expect(markiDoWyboru([], PRODUKTY)).toEqual(["BKT", "Michelin"]);
  });
});

describe("kategorie — WYŁĄCZNIE słownik", () => {
  it("zawiera kategorię, której nie ma żaden produkt", () => {
    // To jest cel całej zmiany: reguła na kategorię spoza katalogu.
    expect(kategorieDoWyboru(SLOWNIK)).toContain("Quady");
  });

  it("NIE dokłada kategorii z produktów", () => {
    // Gdyby ktoś odwrócił regułę i puścił tu katalog, ta asercja padnie.
    const kategorieZKatalogu = produktyZFixtura()
      .map((p) => p.kategoria)
      .filter((k): k is string => Boolean(k));
    const zeSlownika = kategorieDoWyboru([{ id: 1, rodzaj: "kategoria", wartosc: "Quady" }]);
    expect(zeSlownika).toEqual(["Quady"]);
    for (const kategoria of kategorieZKatalogu) {
      if (kategoria !== "Quady") expect(zeSlownika).not.toContain(kategoria);
    }
  });

  it("pusty słownik daje PUSTĄ listę, nawet gdy katalog ma kategorie", () => {
    // Dokładnie to stałoby się w produkcji, gdyby 7b wyrzuciło mostek, a dialog
    // został na martwym kluczu `["/api/attributes"]`.
    expect(kategorieDoWyboru([])).toEqual([]);
  });
});

describe("dostawcy — z /api/suppliers, nie ze słownika", () => {
  const DOSTAWCY = dostawcyZFixtura() as unknown as Dostawca[];

  it("wartością opcji jest KOD, a etykietą „kod · nazwa”", () => {
    const opcje = dostawcyDoWyboru(DOSTAWCY);
    const pierwszy = DOSTAWCY[0]!;
    expect(opcje[0]).toEqual({
      wartosc: pierwszy.kod,
      etykieta: `${pierwszy.kod} · ${pierwszy.nazwa}`,
    });
  });

  it("zachowuje kolejność z API — bez sortowania i dedupu", () => {
    expect(dostawcyDoWyboru(DOSTAWCY).map((o) => o.wartosc)).toEqual(DOSTAWCY.map((d) => d.kod));
  });
});

describe("konstrukcja i vfIf — listy ze słownika (dokończenie portu z 4b)", () => {
  it("czyta wartości właściwego rodzaju", () => {
    expect(wartosciRodzaju(SLOWNIK, "konstrukcja")).toEqual(["R"]);
    expect(wartosciRodzaju(SLOWNIK, "vfIf")).toEqual(["VF"]);
  });
});

describe("opcjeWarunku — routing typu na źródło", () => {
  const dane = { slownik: SLOWNIK, produkty: PRODUKTY, dostawcy: dostawcyZFixtura() as unknown as Dostawca[] };

  it("typy słownikowe dostają listę", () => {
    for (const typ of ["marka", "kategoria", "konstrukcja", "vfIf", "dostawca"]) {
      expect(opcjeWarunku(typ, dane), typ).not.toBeNull();
    }
  });

  it("typy tekstowe NIE dostają listy — dialog rysuje wtedy pole tekstowe", () => {
    for (const typ of ["rozmiar", "bieznik", "produkt", "srednica"]) {
      expect(opcjeWarunku(typ, dane), typ).toBeNull();
    }
  });

  it("podpowiedzi selecta 1:1 z oryginałem", () => {
    expect(placeholderWyboru("kategoria")).toBe("— wybierz kategorię —");
    expect(placeholderWyboru("dostawca")).toBe("— wybierz dostawcę —");
    expect(placeholderWyboru("marka")).toBe("— wybierz markę —");
    expect(placeholderWyboru("konstrukcja")).toBe("— wybierz —");
  });
});
