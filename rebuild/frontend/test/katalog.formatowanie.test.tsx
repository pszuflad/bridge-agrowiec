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

  it("dla rozmiaru w notacji AxB oddaje całą notację", () => {
    expect(formatujSzerokosc(14.9, "14.9x28")).toBe("14.9x28");
  });

  it("notacji AxB nie stosuje, gdy rozmiar zawiera ukośnik", () => {
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
    expect(tekstKomorki(produkt({ konstrukcja: "X" }), "konstrukcja")).toBe("—");
    expect(tekstKomorki(produkt({ tlTt: "TL" }), "tlTt")).toBe("TL (bezdętkowa)");
    expect(tekstKomorki(produkt({ tlTt: "TT" }), "tlTt")).toBe("TT (dętkowa)");
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

  it("promocja bez reguł cenowych (Iteracja 4) pokazuje kreskę", () => {
    expect(tekstKomorki(produkt({}), "promocja")).toBe("—");
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
});
