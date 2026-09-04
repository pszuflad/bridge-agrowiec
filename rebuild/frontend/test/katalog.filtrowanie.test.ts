/**
 * Logika filtrowania katalogu — najgęstszy kawałek tego widoku i jedyny, który
 * w oryginale w całości dzieje się po stronie klienta (`frontend-index.js:23287-23312`).
 *
 * Testy chodzą po czystych funkcjach, bez renderowania i bez mocków — sprawdzają
 * REGUŁY, a nie to, że React wyświetla to, co mu podamy.
 */
import { describe, expect, it } from "vitest";
import {
  filtrujStatus,
  filtrujSzukajka,
  listaKategorii,
  listaMarek,
  sortuj,
  zastosujFiltry,
  type Produkt,
} from "@/pages/katalog/filtrowanie";
import { uzupelnijKodImportu } from "@/pages/katalog/kolumny";

function produkt(nadpisania: Partial<Produkt> & { id: number }): Produkt {
  return {
    kod: `K${nadpisania.id}`,
    nazwa: "Opona testowa",
    marka: "BKT",
    kategoria: "Rolnicze",
    dostawca: "MO9",
    magazyn: null,
    stan: 5,
    ean: "1234567890123",
    status: "aktywny",
    rozmiar: null,
    szerokosc: null,
    ...nadpisania,
  };
}

describe("filtrujSzukajka", () => {
  const dane = [
    produkt({ id: 1, nazwa: "620/70R42 BKT AGRIMAX FACTOR", marka: "BKT", rozmiar: "620/70R42" }),
    produkt({ id: 2, nazwa: "240/70R16 MITAS RIDEMAX", marka: "MITAS", rozmiar: "240/70R16" }),
    produkt({ id: 3, nazwa: "11.2-24 ALLIANCE", marka: "ALLIANCE", rozmiar: "11.2-24" }),
  ];

  it("pusta fraza nie filtruje niczego", () => {
    expect(filtrujSzukajka(dane, "")).toHaveLength(3);
    expect(filtrujSzukajka(dane, "   ")).toHaveLength(3);
  });

  it("ignoruje wielkość liter", () => {
    expect(filtrujSzukajka(dane, "bkt").map((p) => p.id)).toEqual([1]);
    expect(filtrujSzukajka(dane, "BKT").map((p) => p.id)).toEqual([1]);
  });

  /** Sedno szukajki oryginału: AND po tokenach, OR po polach. */
  it("wszystkie tokeny muszą trafić, ale każdy może trafić w INNE pole", () => {
    // „mitas" jest w marce, „240" w rozmiarze — obie części muszą pasować naraz.
    expect(filtrujSzukajka(dane, "mitas 240").map((p) => p.id)).toEqual([2]);
    // „mitas" pasuje, „999" nie pasuje nigdzie ⇒ pusto.
    expect(filtrujSzukajka(dane, "mitas 999")).toHaveLength(0);
  });

  it("szuka po fragmencie, nie po całym słowie", () => {
    expect(filtrujSzukajka(dane, "agrim").map((p) => p.id)).toEqual([1]);
  });

  it("przeszukuje też pola spoza tabeli, np. kod dostawcy", () => {
    const zKodem = [produkt({ id: 9, kodDostawcy: "521560" })];
    expect(filtrujSzukajka(zKodem, "521560")).toHaveLength(1);
  });

  it("brakujące pola nie wywracają filtra", () => {
    const bezPol = [produkt({ id: 4, marka: null, kategoria: null, ean: null })];
    expect(filtrujSzukajka(bezPol, "opona")).toHaveLength(1);
    expect(filtrujSzukajka(bezPol, "null")).toHaveLength(0);
  });
});

describe("filtrujStatus", () => {
  const dane = [
    produkt({ id: 1, status: "aktywny", stan: 5, ean: "111" }),
    produkt({ id: 2, status: "wstrzymany", stan: 0, ean: "222" }),
    produkt({ id: 3, status: "aktywny", stan: -1, ean: null }),
    produkt({ id: 4, status: "aktywny", stan: null, ean: "" }),
  ];

  it("tryb all przepuszcza wszystko", () => {
    expect(filtrujStatus(dane, "all")).toHaveLength(4);
  });

  /** `stan === -1` to „na zamówienie" — NIE jest dostępne, mimo że kolumna nie jest zerowa. */
  it("tryb dostepne wymaga liczbowego stanu większego od zera", () => {
    expect(filtrujStatus(dane, "dostepne").map((p) => p.id)).toEqual([1]);
  });

  it("tryb brak_ean łapie zarówno null, jak i pusty string", () => {
    expect(filtrujStatus(dane, "brak_ean").map((p) => p.id)).toEqual([3, 4]);
  });

  it("pozostałe tryby porównują kolumnę status dosłownie", () => {
    expect(filtrujStatus(dane, "wstrzymany").map((p) => p.id)).toEqual([2]);
    expect(filtrujStatus(dane, "aktywny").map((p) => p.id)).toEqual([1, 3, 4]);
  });
});

describe("sortuj", () => {
  it("liczby porównuje numerycznie, nie tekstowo", () => {
    const dane = [produkt({ id: 1, stan: 9 }), produkt({ id: 2, stan: 100 })];
    // Sort tekstowy dałby „100" przed „9" — to typowy błąd, którego pilnuje ten test.
    expect(sortuj(dane, "stan", "asc").map((p) => p.id)).toEqual([1, 2]);
    expect(sortuj(dane, "stan", "desc").map((p) => p.id)).toEqual([2, 1]);
  });

  it("teksty porównuje przez localeCompare", () => {
    const dane = [produkt({ id: 1, marka: "Zeta" }), produkt({ id: 2, marka: "Alfa" })];
    expect(sortuj(dane, "marka", "asc").map((p) => p.id)).toEqual([2, 1]);
  });

  it("nie modyfikuje tablicy wejściowej", () => {
    const dane = [produkt({ id: 2, stan: 9 }), produkt({ id: 1, stan: 1 })];
    sortuj(dane, "stan", "asc");
    expect(dane.map((p) => p.id)).toEqual([2, 1]);
  });

  it("brak wybranej kolumny zostawia kolejność bez zmian", () => {
    const dane = [produkt({ id: 3 }), produkt({ id: 1 })];
    expect(sortuj(dane, "", "asc").map((p) => p.id)).toEqual([3, 1]);
  });

  it("nulle traktuje jak pusty string i nie wywala się na nich", () => {
    const dane = [produkt({ id: 1, marka: null }), produkt({ id: 2, marka: "Alfa" })];
    expect(sortuj(dane, "marka", "asc").map((p) => p.id)).toEqual([1, 2]);
  });

  /**
   * ODSTĘPSTWO D1 / backlog #3 w praktyce: przy kolumnie REAL (kanon) `szerokosc` to
   * liczby i sortuje się numerycznie, przy TEXT (staging po `szertxt`) to stringi
   * i sortuje się leksykalnie. Obie ścieżki są zachowaniem ORYGINAŁU — ta sama funkcja
   * w produkcji robi dziś dokładnie to samo.
   */
  it("mieszana szerokosc: liczby sortują się numerycznie, stringi leksykalnie", () => {
    const liczbowe = [produkt({ id: 1, szerokosc: 9 }), produkt({ id: 2, szerokosc: 100 })];
    expect(sortuj(liczbowe, "szerokosc", "asc").map((p) => p.id)).toEqual([1, 2]);

    const tekstowe = [produkt({ id: 1, szerokosc: "9" }), produkt({ id: 2, szerokosc: "100" })];
    expect(sortuj(tekstowe, "szerokosc", "asc").map((p) => p.id)).toEqual([2, 1]);
  });
});

describe("listy słownikowe filtrów", () => {
  it("marki: bez duplikatów, bez wartości z cyframi, posortowane po polsku", () => {
    const dane = [
      produkt({ id: 1, marka: "Żubr" }),
      produkt({ id: 2, marka: "Alliance" }),
      produkt({ id: 3, marka: "Alliance" }),
      // Śmieć z importu — oryginał odsiewa marki zawierające cyfrę.
      produkt({ id: 4, marka: "11.2-24" }),
      produkt({ id: 5, marka: null }),
    ];
    expect(listaMarek(dane)).toEqual(["Alliance", "Żubr"]);
  });

  it("kategorie: bez duplikatów i nulli (cyfry NIE są odsiewane — jak w oryginale)", () => {
    const dane = [
      produkt({ id: 1, kategoria: "Rolnicze" }),
      produkt({ id: 2, kategoria: "Rolnicze" }),
      produkt({ id: 3, kategoria: "Przyczepy" }),
      produkt({ id: 4, kategoria: null }),
    ];
    expect(listaKategorii(dane)).toEqual(["Przyczepy", "Rolnicze"]);
  });

  /**
   * Sesja 7c — domknięcie degradacji D3 z I2: listy filtrów to SUMA słownika atrybutów
   * i danych katalogu (`frontend-index.js:23287-23295`). Do tej pory powstawały wyłącznie
   * z produktów, więc marka bez ani jednego produktu nie dawała się wybrać.
   */
  describe("suma ze słownikiem atrybutów (7c)", () => {
    const SLOWNIK = [
      { rodzaj: "marka", wartosc: "Michelin" },
      { rodzaj: "marka", wartosc: "BKT" },
      // ⚠ Wartość słownikowa Z CYFRĄ — filtr „bez cyfr” jej NIE dotyczy (patrz test niżej).
      { rodzaj: "marka", wartosc: "Gruma 3" },
      { rodzaj: "kategoria", wartosc: "Quady" },
      { rodzaj: "bieznik", wartosc: "AGRO 10" },
    ];

    it("marki: dokłada wartości słownikowe do marek z katalogu, bez duplikatów", () => {
      const dane = [produkt({ id: 1, marka: "BKT" }), produkt({ id: 2, marka: "Alliance" })];

      const wynik = listaMarek(dane, SLOWNIK);

      expect(wynik).toContain("Michelin"); // tylko słownik
      expect(wynik).toContain("Alliance"); // tylko katalog
      expect(wynik.filter((m) => m === "BKT")).toHaveLength(1); // w obu źródłach
    });

    it("marki: filtr „bez cyfr” dotyczy WYŁĄCZNIE marek z produktów", () => {
      // W oryginale `filter(!/\d/)` wisi na gałęzi produktowej (`:23288`), nie na złączeniu.
      const dane = [produkt({ id: 1, marka: "11.2-24" })];

      const wynik = listaMarek(dane, SLOWNIK);

      expect(wynik).not.toContain("11.2-24"); // śmieć z importu — odsiany
      expect(wynik).toContain("Gruma 3"); // ze słownika — zostaje mimo cyfry
    });

    it("marki: sortowanie po polsku obejmuje oba źródła", () => {
      const dane = [produkt({ id: 1, marka: "Zeta" })];

      expect(listaMarek(dane, [{ rodzaj: "marka", wartosc: "Ćma" }])).toEqual(["Ćma", "Zeta"]);
    });

    it("kategorie: SUMA słownika i katalogu — inaczej niż w dialogu reguł", () => {
      /*
       * ⚠ To jest miejsce, w którym łatwo skopiować niewłaściwą regułę. W `/narzuty`
       * (sesja 7b) kategorie idą WYŁĄCZNIE ze słownika, bo regułę cenową zakłada się także
       * na kategorię spoza katalogu. Tutaj filtr zawęża to, co widać w tabeli, więc oba
       * źródła się sumują — tak jak w oryginale (`:23292-23295`).
       */
      const dane = [produkt({ id: 1, kategoria: "Rolnicze" })];

      const wynik = listaKategorii(dane, SLOWNIK);

      expect(wynik).toContain("Rolnicze"); // z katalogu — NIE znika
      expect(wynik).toContain("Quady"); // ze słownika
    });

    it("kategorie: zwykły sort() i brak filtra cyfr — obie asymetrie zachowane", () => {
      const dane = [produkt({ id: 1, kategoria: "Ćwiartki" }), produkt({ id: 2, kategoria: "1 os" })];

      const wynik = listaKategorii(dane, [{ rodzaj: "kategoria", wartosc: "Zimowe" }]);

      expect(wynik).toContain("1 os"); // cyfry NIE są odsiewane
      // Domyślny `sort()` układa po kodach znaków, więc „Ć" ląduje ZA „Z" — inaczej niż marki.
      expect(wynik).toEqual(["1 os", "Zimowe", "Ćwiartki"]);
    });

    it("wartości innych rodzajów nie zanieczyszczają list", () => {
      const dane = [produkt({ id: 1, marka: "BKT", kategoria: "Rolnicze" })];

      expect(listaMarek(dane, SLOWNIK)).not.toContain("AGRO 10");
      expect(listaKategorii(dane, SLOWNIK)).not.toContain("AGRO 10");
    });

    it("brak słownika degraduje listy do samych produktów — stan sprzed 7c", () => {
      const dane = [produkt({ id: 1, marka: "BKT", kategoria: "Rolnicze" })];

      expect(listaMarek(dane, [])).toEqual(["BKT"]);
      expect(listaKategorii(dane, [])).toEqual(["Rolnicze"]);
    });
  });
});

describe("zastosujFiltry — pełny łańcuch", () => {
  const dane = [
    produkt({ id: 1, nazwa: "BKT AGRIMAX", marka: "BKT", kategoria: "Rolnicze", stan: 5 }),
    produkt({ id: 2, nazwa: "BKT RIDEMAX", marka: "BKT", kategoria: "Przyczepy", stan: 0 }),
    produkt({ id: 3, nazwa: "MITAS TD-03", marka: "MITAS", kategoria: "Rolnicze", stan: 3 }),
  ];

  it("składa szukajkę, marki, kategorie i status naraz", () => {
    const wynik = zastosujFiltry(dane, {
      fraza: "bkt",
      marki: new Set(["BKT"]),
      kategorie: new Set(["Rolnicze"]),
      status: "dostepne",
      sortKolumna: "",
      sortKierunek: "asc",
    });
    expect(wynik.map((p) => p.id)).toEqual([1]);
  });

  it("puste zbiory marek i kategorii oznaczają brak filtra", () => {
    const wynik = zastosujFiltry(dane, {
      fraza: "",
      marki: new Set(),
      kategorie: new Set(),
      status: "all",
      sortKolumna: "",
      sortKierunek: "asc",
    });
    expect(wynik).toHaveLength(3);
  });

  it("sortowanie działa na całym odfiltrowanym zbiorze", () => {
    const wynik = zastosujFiltry(dane, {
      fraza: "",
      marki: new Set(),
      kategorie: new Set(),
      status: "all",
      sortKolumna: "stan",
      sortKierunek: "desc",
    });
    expect(wynik.map((p) => p.stan)).toEqual([5, 3, 0]);
  });
});

describe("uzupelnijKodImportu (retrofit zapisu kolumn)", () => {
  it("dokłada kodImportu tuż za nazwą, gdy zapis go nie ma", () => {
    expect(uzupelnijKodImportu(["nazwa", "marka", "stan"])).toEqual([
      "nazwa",
      "kodImportu",
      "marka",
      "stan",
    ]);
  });

  it("gdy nazwy nie ma w zapisie, dokłada kodImportu na początek", () => {
    expect(uzupelnijKodImportu(["marka", "stan"])).toEqual(["kodImportu", "marka", "stan"]);
  });

  it("zapis, który już ma kodImportu, zostaje nietknięty", () => {
    const zapis = ["marka", "kodImportu", "nazwa"];
    expect(uzupelnijKodImportu(zapis)).toEqual(zapis);
  });

  it("nie modyfikuje tablicy wejściowej", () => {
    const zapis = ["nazwa", "marka"];
    uzupelnijKodImportu(zapis);
    expect(zapis).toEqual(["nazwa", "marka"]);
  });
});
