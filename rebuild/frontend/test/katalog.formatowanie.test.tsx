/**
 * Formatowanie komórek katalogu (`Wfmt` i `DT`, `frontend-index.js:23098-23190`).
 *
 * Te drobiazgi decydują o tym, czy Ania rozpozna swój panel: dwie cyfry w cenie zakupu,
 * `1234,-` w cenie sprzedaży, `8PR`, „Radialna", czerwone zero i kreska zamiast pustki.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatujKomorke, formatujSzerokosc } from "@/pages/katalog/formatowanie";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import { produktyZFixtura } from "./msw/kontrakt";

function produkt(nadpisania: Partial<Produkt>): Produkt {
  return {
    id: 1,
    kod: "MO9_336320",
    nazwa: "Opona",
    marka: "BKT",
    kategoria: "Rolnicze",
    dostawca: "MO9",
    magazyn: null,
    stan: 1,
    ean: "111",
    status: "aktywny",
    rozmiar: null,
    szerokosc: null,
    ...nadpisania,
  };
}

/** Renderuje wynik `formatujKomorke` i oddaje jego tekst — wynikiem bywa JSX. */
function tekstKomorki(p: Produkt, klucz: string): string {
  const { container } = render(<>{formatujKomorke(p, klucz)}</>);
  return container.textContent ?? "";
}

/**
 * ⚠ SEDNO ODSTĘPSTWA `szerokosc` (plan.md D1, backlog #3).
 *
 * Backend przepuszcza `szerokosc` bez konwersji, więc na kanonie przychodzi liczba,
 * a na stagingu po migracji `szertxt` — string „10.00". Okazuje się, że ORYGINAŁ już
 * to rozwiązał: `Wfmt` odzyskuje zapis z pola `rozmiar`, więc oba warianty renderują
 * się IDENTYCZNIE. To jest kluczowe wejście do decyzji o backlogu #3.
 */
describe("formatujSzerokosc (Wfmt)", () => {
  it("pustą wartość oddaje jako null (komórka pokaże kreskę)", () => {
    expect(formatujSzerokosc(null, "620/70R42")).toBeNull();
    expect(formatujSzerokosc("", "620/70R42")).toBeNull();
    expect(formatujSzerokosc(undefined, "620/70R42")).toBeNull();
  });

  it("wartość nieliczbową oddaje surowo", () => {
    expect(formatujSzerokosc("szeroka", "620/70R42")).toBe("szeroka");
  });

  it("odzyskuje z rozmiaru oryginalny zapis z zerami końcowymi", () => {
    // Kolumna REAL nie utrzyma „10.00", ale rozmiar owszem — i stamtąd bierzemy zapis.
    expect(formatujSzerokosc(10, "10.00-20")).toBe("10.00");
  });

  it("liczba i jej tekstowy odpowiednik dają TEN SAM wynik", () => {
    // Lewa strona = kanon (REAL), prawa = staging po `szertxt` (TEXT).
    expect(formatujSzerokosc(10, "10.00-20")).toBe(formatujSzerokosc("10.00", "10.00-20"));
    expect(formatujSzerokosc(620, "620/70R42")).toBe(formatujSzerokosc("620", "620/70R42"));
    expect(formatujSzerokosc(11.2, "11.2-24")).toBe(formatujSzerokosc("11.2", "11.2-24"));
  });

  /*
   * ⚠ ODWRÓCONY W 13e. Do 2026-09-04 `Wfmt` miał osobną gałąź dla rozmiarów bez „/"
   * w notacji `AxB` i oddawał CAŁĄ notację („14.9x28"). Łatka `szer_marka` z 04.09 15:00
   * tę gałąź usunęła, więc zostaje sam pierwszy człon. Pomiar na `db/snapshot.db`:
   * 587 z 7395 pozycji zmienia zapis.
   */
  it("z notacji AxB bierze sam pierwszy człon, nie całą notację", () => {
    expect(formatujSzerokosc(14.9, "14.9x28")).toBe("14.9");
    expect(formatujSzerokosc(16, "16x6-8")).toBe("16");
    expect(formatujSzerokosc(23, "23x10.50-12")).toBe("23");
  });

  it("z notacji AxB zachowuje zera końcowe z rozmiaru", () => {
    // Usunięcie gałęzi `AxB` NIE może zabrać zer — niesie je pętla po tokenach `rozmiar`.
    expect(formatujSzerokosc("8.00", "8.00x20")).toBe("8.00");
    expect(formatujSzerokosc(8, "8.00x20")).toBe("8.00");
  });

  it("dla rozmiaru z ukośnikiem oddaje pasujący token", () => {
    expect(formatujSzerokosc(620, "620/70R42")).toBe("620");
  });

  it("przecinek dziesiętny z rozmiaru normalizuje do kropki", () => {
    expect(formatujSzerokosc(11.2, "11,2-24")).toBe("11.2");
  });

  it("gdy rozmiar nie zawiera pasującej liczby, oddaje samą liczbę", () => {
    expect(formatujSzerokosc(999, "620/70R42")).toBe("999");
    expect(formatujSzerokosc(620, null)).toBe("620");
  });
});

describe("formatujKomorke — waga (ticket 155, NOWA logika, nie port)", () => {
  it("pustą wagę pokazuje jako kreskę", () => {
    expect(tekstKomorki(produkt({ waga: null }), "waga")).toBe("—");
  });

  it("wagę BEZ dziedziczenia pokazuje bez ikony/tooltipa", () => {
    const { container } = render(<>{formatujKomorke(produkt({ waga: 78 }), "waga")}</>);
    expect(container.textContent).toBe("78");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("wagę dziedziczoną automatycznie oznacza tooltipem i ikoną", () => {
    const { container } = render(
      <>{formatujKomorke(produkt({ waga: 78, wagaAutoUzupelniona: true }), "waga")}</>,
    );
    expect(container.textContent).toBe("78");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("[title]")?.getAttribute("title")).toContain(
      "uzupełniona automatycznie",
    );
  });
});

describe("formatujKomorke (DT)", () => {
  it("cena zakupu ma zawsze dwie cyfry po przecinku", () => {
    expect(tekstKomorki(produkt({ cenaZakupu: 5562.4 }), "cenaZakupu")).toBe("5562.40");
    expect(tekstKomorki(produkt({ cenaZakupu: null }), "cenaZakupu")).toBe("—");
  });

  it("cena sprzedaży jest obcinana w dół i kończy się „,-”", () => {
    expect(tekstKomorki(produkt({ cenaSprzedazy: 7252.9 }), "cenaSprzedazy")).toBe("7252,-");
  });

  it("marża pokazuje procent bez części dziesiętnej", () => {
    expect(tekstKomorki(produkt({ marzaPct: 6.4 }), "marzaPct")).toBe("6%");
  });

  it("ujemna marża jest wytłuszczona na czerwono, niska na bursztynowo", () => {
    render(<>{formatujKomorke(produkt({ marzaPct: -3 }), "marzaPct")}</>);
    expect(screen.getByText("-3%")).toHaveClass("text-red-600", "font-bold");

    render(<>{formatujKomorke(produkt({ marzaPct: 2 }), "marzaPct")}</>);
    expect(screen.getByText("2%")).toHaveClass("text-amber-600", "font-semibold");
  });

  it("stan: zero i null są czerwonym zerem, -1 to „na zamówienie”", () => {
    render(<>{formatujKomorke(produkt({ stan: 0 }), "stan")}</>);
    expect(screen.getByText("0")).toHaveClass("text-red-500");

    expect(tekstKomorki(produkt({ stan: null }), "stan")).toBe("0");
    expect(tekstKomorki(produkt({ stan: -1 }), "stan")).toBe("na zamówienie");
    expect(tekstKomorki(produkt({ stan: 7 }), "stan")).toBe("7");
  });

  it("konstrukcja i typ opony tłumaczą się na opisy", () => {
    expect(tekstKomorki(produkt({ konstrukcja: "R" }), "konstrukcja")).toBe("Radialna");
    expect(tekstKomorki(produkt({ konstrukcja: "D" }), "konstrukcja")).toBe("Diagonalna");
    expect(tekstKomorki(produkt({ tlTt: "TL" }), "tlTt")).toBe("TL (bezdętkowa)");
    expect(tekstKomorki(produkt({ tlTt: "TT" }), "tlTt")).toBe("TT (dętkowa)");
  });

  /**
   * PASS-THROUGH — zmiana `konstr` produkcji z 2026-09-01 11:35, sparowana z migracją
   * `rebuild/schema/005_konstrukcja_slowa.sql` (13c).
   *
   * ⚠ Ten test ZMIENIŁ oczekiwanie: do 13c `konstrukcja: "X"` dawała „—", bo mapa kodów
   * była jedyną drogą. Po migracji kolumna niesie PEŁNE SŁOWA, więc bundle produkcji
   * dostał pass-through (`n||null`) — a wraz z nim każda wartość spoza mapy przechodzi
   * surowa, nie tylko pełne słowo. Odtwarzamy zachowanie, nie własne wyobrażenie o nim.
   *
   * To nie jest teoria: `db/snapshot.db` ma DOKŁADNIE jeden produkt z `konstrukcja='X'`,
   * którego migracja świadomie nie rusza (nie ma go w `KONSTRUKCJA_CANONICAL_MAP`).
   * W panelu pokaże się jako „X" — tak samo jak w produkcji.
   */
  it("konstrukcja: pełne słowo z bazy przechodzi surowe, pusto nadal daje kreskę", () => {
    expect(tekstKomorki(produkt({ konstrukcja: "Radialna" }), "konstrukcja")).toBe("Radialna");
    expect(tekstKomorki(produkt({ konstrukcja: "Diagonalna" }), "konstrukcja")).toBe("Diagonalna");
    expect(tekstKomorki(produkt({ konstrukcja: "X" }), "konstrukcja")).toBe("X");
    expect(tekstKomorki(produkt({ konstrukcja: null }), "konstrukcja")).toBe("—");
    expect(tekstKomorki(produkt({ konstrukcja: "" }), "konstrukcja")).toBe("—");
  });

  it("liczba płócien dostaje sufiks PR", () => {
    expect(tekstKomorki(produkt({ pr: "8" }), "pr")).toBe("8PR");
    expect(tekstKomorki(produkt({ pr: null }), "pr")).toBe("—");
  });

  /** `kodDostawcy` nie pochodzi z kolumny, tylko ze sklejenia `kod` po podkreślniku. */
  it("kod dostawcy powstaje z pola kod, gdy prefiks zgadza się z dostawcą", () => {
    expect(tekstKomorki(produkt({ kod: "MO9_336320", dostawca: "MO9" }), "kodDostawcy")).toBe(
      "MO9336320",
    );
    // Inny prefiks ⇒ wraca do kolumny.
    expect(
      tekstKomorki(produkt({ kod: "XX_1", dostawca: "MO9", kodDostawcy: "521560" }), "kodDostawcy"),
    ).toBe("521560");
  });

  it("kolumny boolean: true daje „Tak”, false PUSTKĘ (nie „Nie”)", () => {
    expect(tekstKomorki(produkt({ nro: true }), "nro")).toBe("Tak");
    expect(tekstKomorki(produkt({ nro: false }), "nro")).toBe("");
    expect(tekstKomorki(produkt({ nro: null }), "nro")).toBe("—");
  });

  it("VAT i data aktualizacji mają swoje formaty", () => {
    expect(tekstKomorki(produkt({ vat: 23 }), "vat")).toBe("23%");
    const data = tekstKomorki(produkt({ dataAktualizacji: "2026-08-04T14:30:34.149Z" }), "dataAktualizacji");
    expect(data).toMatch(/2026/);
  });

  it("promocja pokazuje kreskę, gdy produktowi nie odpowiada żadna promocja", () => {
    expect(tekstKomorki(produkt({}), "promocja")).toBe("—");
  });

  /**
   * ŚCIEŻKA POZYTYWNA — to ona jest sednem karty 14h (ticket 61): od tego ticketu
   * `GET /api/products` realnie wypełnia `_reguly.promocja`, więc kolumna wreszcie coś
   * pokazuje. Wcześniej pokryta była wyłącznie gałąź „brak promocji → kreska", czyli
   * jedyna, jaką produkcja kiedykolwiek umiała pokazać.
   *
   * Kształt `{ wartosc, nazwa }` jest podyktowany przez oryginał, nie przez nas — żywy
   * bundle czyta `p.wartosc` i `p.nazwa || "Promocja"`.
   */
  it("promocja z `_reguly` pokazuje rabat i nazwę", () => {
    const zPromocja = produkt({
      _reguly: { promocja: { wartosc: 10, nazwa: "Wyprzedaż zimowa" } },
    } as Partial<Produkt>);

    expect(tekstKomorki(zPromocja, "promocja")).toBe("-10%Wyprzedaż zimowa");
  });

  /** Fallback nazwy jest w oryginale (`p.nazwa || "Promocja"`) — odtworzony, więc pilnowany. */
  it("promocja bez nazwy używa fallbacku Promocja", () => {
    const bezNazwy = produkt({ _reguly: { promocja: { wartosc: 5 } } } as Partial<Produkt>);

    expect(tekstKomorki(bezNazwy, "promocja")).toBe("-5%Promocja");
  });

  it("puste wartości zawsze dają kreskę, nie pusty string", () => {
    expect(tekstKomorki(produkt({ rodzaj: null }), "rodzaj")).toBe("—");
    expect(tekstKomorki(produkt({ rodzaj: "" }), "rodzaj")).toBe("—");
  });

  /** Ostatecznym sprawdzianem jest prawdziwa pozycja z nagranej odpowiedzi produkcji. */
  it("radzi sobie z prawdziwą pozycją z contract/fixtures/GET_products.json", () => {
    const pierwszy = produktyZFixtura()[0] as Produkt;
    expect(tekstKomorki(pierwszy, "cenaZakupu")).toBe("5562.40");
    expect(tekstKomorki(pierwszy, "cenaSprzedazy")).toBe("7252,-");
    expect(tekstKomorki(pierwszy, "szerokosc")).toBe("620");
    expect(tekstKomorki(pierwszy, "konstrukcja")).toBe("Radialna");
    expect(tekstKomorki(pierwszy, "stubbleResistant")).toBe("");
  });

  /*
   * Zakotwiczenie łatki `szer_marka` w NAGRANYCH danych produkcji: trzecia pozycja fixtura
   * (`id 97796`, `rozmiar:"8.00x20"`, `szerokosc:"8.00"`) to dokładnie przypadek, który
   * zniesiona gałąź `AxB` pokazywała jako „8.00x20". Fixture jest nietknięty — zmieniło się
   * oczekiwanie, bo zmienił się formater.
   */
  /**
   * Kolumna „Blokowane formy płatności" (backlog #73).
   *
   * ⭐ WARTOŚĆ LICZY SIĘ Z KODU DOSTAWCY, NIE Z PRODUKTU — i to nie jest skrót, tylko
   * odtworzenie produkcji. Zmierzone w tickecie 122 na oryginale z `origin/main` @ `88fa31c`,
   * postawionym na kopii bazy Z KOLUMNĄ WYPEŁNIONĄ dla wszystkich 7405 produktów i obydwoma
   * triggerami: `GET /api/products` oddaje 72 klucze BEZ tego pola (bundle backendu nie zna
   * kolumny dokładanej runtime'owym `ALTER TABLE` — mechanizm `uwagaCena`). Dlatego skrypt
   * produkcji liczy wartość w przeglądarce i dlatego my robimy tak samo.
   *
   * Gdyby ktoś kiedyś wystawił to pole z API, ten test NADAL przechodzi — i właśnie dlatego
   * jest tu asercja na produkt, który pole NIESIE z inną wartością: pilnuje, że źródłem
   * pozostaje `dostawca`, a nie przypadkowa zawartość odpowiedzi.
   */
  describe("kolumna blokowanych form płatności", () => {
    it("bierze listę z kodu dostawcy", () => {
      expect(tekstKomorki(produkt({ dostawca: "MO1" }), "blokowaneFormyPlatnosci")).toBe(
        "203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
      );
      expect(tekstKomorki(produkt({ dostawca: "MO10" }), "blokowaneFormyPlatnosci")).toBe(
        "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216",
      );
    });

    /**
     * ⚠ MO6 (Uniglory) CELOWO bez mapowania — CHANGELOG produkcji 2026-09-10 14:53:
     * „nie będzie na razie w sprzedaży". „—" jest tu POPRAWNYM wynikiem, nie błędem
     * (backlog #101, zamknięte 2026-09-23). Ta asercja istnieje po to, żeby nikt tego
     * nie „naprawił" dopisaniem MO6 do mapy.
     */
    it("MO6 i nieznany dostawca dają „—”, nie pustkę i nie wartość zastępczą", () => {
      expect(tekstKomorki(produkt({ dostawca: "MO6" }), "blokowaneFormyPlatnosci")).toBe("—");
      expect(tekstKomorki(produkt({ dostawca: "XYZ" }), "blokowaneFormyPlatnosci")).toBe("—");
      expect(tekstKomorki(produkt({ dostawca: "" }), "blokowaneFormyPlatnosci")).toBe("—");
    });

    it("rozpoznaje kod dostawcy niezależnie od wielkości liter i spacji", () => {
      expect(tekstKomorki(produkt({ dostawca: " mo2 " }), "blokowaneFormyPlatnosci")).toBe(
        "201, 202, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
      );
    });

    /** Źródłem jest `dostawca`, nawet gdyby produkt niósł własną wartość pola. */
    it("nie ufa wartości pola w produkcie — źródłem jest `dostawca`", () => {
      const zPolem = produkt({ dostawca: "MO1", blokowaneFormyPlatnosci: "999" } as Partial<Produkt>);
      expect(tekstKomorki(zPolem, "blokowaneFormyPlatnosci")).not.toBe("999");
    });

    /** Pełna lista trafia w `title` — kolumna bywa węższa niż 17 identyfikatorów. */
    it("pełną listę powtarza w `title` komórki", () => {
      render(<>{formatujKomorke(produkt({ dostawca: "MO9" }), "blokowaneFormyPlatnosci")}</>);
      expect(screen.getByTitle(/^201, 202, .*217, 218, 219$/)).toBeTruthy();
    });
  });

  it("pozycja AxB z contract/fixtures/GET_products.json daje sam człon szerokości", () => {
    const zNotacjaAxB = produktyZFixtura()[2] as Produkt;
    expect(zNotacjaAxB.rozmiar).toBe("8.00x20");
    expect(tekstKomorki(zNotacjaAxB, "szerokosc")).toBe("8.00");
    expect(tekstKomorki(zNotacjaAxB, "cenaSprzedazy")).toBe("782,-");
    // ⚠ „Diagonalna" to stan ODBUDOWY. Żywy bundle produkcji pokazuje tu „—", bo łatka
    // pass-through z 01.09 trafiła do martwego pliku — świadome odstępstwo D4, nie rozjazd.
    expect(tekstKomorki(zNotacjaAxB, "konstrukcja")).toBe("Diagonalna");
  });
});
