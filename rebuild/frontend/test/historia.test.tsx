/**
 * Widok `/historia` — render przeciwko mockom MSW zbudowanym z nagranych fixtures produkcji
 * (`contract/fixtures/GET_history_paged.json`, `GET_history_meta.json`).
 *
 * Zakres: że ekran renderuje wpisy i sześć kolumn z oryginału, że filtry i paginacja wysyłają
 * właściwe parametry do `/paged`, że zmiana filtra cofa na stronę 1 — i że widok znosi dane,
 * które w bazie produkcyjnej są od pierwszego dnia: puste szczegóły, brak użytkownika
 * i kod dostawcy, którego nie da się złączyć z tabelą `suppliers`.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { server } from "./msw/server";
import { metaHistoriiZFixtura, stronaHistoriiZFixtura, TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const UZYTKOWNIK = uzytkownikZFixtura();
const STRONA = stronaHistoriiZFixtura();
const META = metaHistoriiZFixtura();

/** Adresy, pod które poszły żądania — na nich sprawdzamy parametry filtrów. */
let zapytania: string[] = [];

function zamockujApi(strona: Record<string, unknown> = STRONA) {
  server.use(
    http.get("*/api/history/meta", () => HttpResponse.json(META)),
    http.get("*/api/history/paged", ({ request }) => {
      zapytania.push(request.url);
      return HttpResponse.json(strona);
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzHistorie() {
  window.history.pushState({}, "", "/historia");
  render(<App />);
  await screen.findByTestId("input-search-history");
}

const ostatnieZapytanie = () => new URL(zapytania[zapytania.length - 1]!);

/** Koperta z jednym wpisem — do testów kolumn i przypadków brzegowych. */
function stronaZWpisem(wpis: Record<string, unknown>) {
  return { items: [wpis], total: 1, pages: 1, page: 1, limit: 25 };
}

describe("Widok /historia", () => {
  beforeEach(() => {
    zapytania = [];
    sessionStorage.clear();
    localStorage.clear();
    // `queryClient` jest SINGLETONEM modułowym ze `staleTime: Infinity`, a kluczem cache
    // jest pełny adres z parametrami — bez czyszczenia kolejny test dostałby cudze dane.
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  it("renderuje wpisy z fixture'a i sześć kolumn z oryginału", async () => {
    await otworzHistorie();

    const pierwszy = STRONA.items[0] as Record<string, unknown>;
    expect(await screen.findByTestId(`row-history-${String(pierwszy["id"])}`)).toBeInTheDocument();

    for (const naglowek of ["Data", "Typ", "Dostawca", "Użytkownik", "Pozycji", "Szczegóły"]) {
      expect(screen.getByRole("columnheader", { name: naglowek })).toBeInTheDocument();
    }

    expect(screen.getByText(`${STRONA.total} wpisów`)).toBeInTheDocument();
  });

  it("pierwsze żądanie idzie z domyślnymi parametrami (strona 1, 25, wszystko)", async () => {
    await otworzHistorie();

    await waitFor(() => expect(zapytania.length).toBeGreaterThan(0));
    const url = ostatnieZapytanie();
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("search")).toBe("");
    expect(url.searchParams.get("typ")).toBe("all");
    expect(url.searchParams.get("dostawca")).toBe("all");
  });

  it("szukajka trafia do parametru `search`", async () => {
    await otworzHistorie();

    await userEvent.type(screen.getByTestId("input-search-history"), "MO2");
    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("search")).toBe("MO2"));
  });

  it("filtr typu trafia do parametru `typ`", async () => {
    await otworzHistorie();

    await userEvent.click(screen.getByTestId("select-history-type"));
    await userEvent.click(await screen.findByRole("option", { name: "Importy" }));

    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("typ")).toBe("import"));
  });

  it("filtr dostawcy wypełnia się z /api/history/meta i trafia do parametru `dostawca`", async () => {
    await otworzHistorie();

    await userEvent.click(screen.getByTestId("select-history-supplier"));
    const kod = META.dostawcy[0]!;
    await userEvent.click(await screen.findByRole("option", { name: kod }));

    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("dostawca")).toBe(kod));
  });

  it("zmiana rozmiaru strony trafia do `limit`", async () => {
    await otworzHistorie();

    await userEvent.click(screen.getByTestId("button-page-size-100"));
    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("limit")).toBe("100"));
  });

  it("paginacja przełącza stronę, a zmiana filtra cofa na pierwszą", async () => {
    zamockujApi({ ...STRONA, pages: 4 });
    await otworzHistorie();

    await userEvent.click(screen.getByTestId("button-next-page"));
    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("page")).toBe("2"));

    await userEvent.type(screen.getByTestId("input-search-history"), "x");
    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("page")).toBe("1"));
  });

  it("przyciski paginacji są wyłączone na skrajach", async () => {
    zamockujApi({ ...STRONA, pages: 1 });
    await otworzHistorie();

    await waitFor(() => expect(screen.getByTestId("button-first-page")).toBeDisabled());
    expect(screen.getByTestId("button-prev-page")).toBeDisabled();
    expect(screen.getByTestId("button-next-page")).toBeDisabled();
    expect(screen.getByTestId("button-last-page")).toBeDisabled();
  });

  describe("Szczegóły wpisu", () => {
    it("import pokazuje nazwę pliku i uwagi", async () => {
      zamockujApi(
        stronaZWpisem({
          id: 1,
          typ: "import",
          kiedy: "2026-07-28T06:22:26.735Z",
          dostawca: "MO1",
          uzytkownik: "Marta Bieguniak",
          liczbaPozycji: 120,
          nazwaPliku: "mo1-cennik.xlsx",
          format: null,
          kodProduktu: null,
          zmienionePola: [],
          uwagi: "Plik: mo1-cennik.xlsx",
        }),
      );
      await otworzHistorie();

      const wiersz = await screen.findByTestId("row-history-1");
      expect(within(wiersz).getByText("mo1-cennik.xlsx")).toBeInTheDocument();
      expect(within(wiersz).getByText("(Plik: mo1-cennik.xlsx)")).toBeInTheDocument();
      expect(within(wiersz).getByText("import")).toBeInTheDocument();
    });

    it("edycja pokazuje kod produktu i listę zmienionych pól, ucinając powyżej sześciu", async () => {
      const pola = ["a", "b", "c", "d", "e", "f", "g", "h"];
      zamockujApi(
        stronaZWpisem({
          id: 2,
          typ: "edycja",
          kiedy: "2026-07-28T06:22:26.735Z",
          dostawca: null,
          uzytkownik: "Marta Bieguniak",
          liczbaPozycji: 1,
          nazwaPliku: null,
          format: null,
          kodProduktu: "MO2_1147700",
          zmienionePola: pola,
          uwagi: null,
        }),
      );
      await otworzHistorie();

      const wiersz = await screen.findByTestId("row-history-2");
      expect(within(wiersz).getByText("MO2_1147700")).toBeInTheDocument();
      expect(within(wiersz).getByText("a")).toBeInTheDocument();
      expect(within(wiersz).getByText("f")).toBeInTheDocument();
      expect(within(wiersz).queryByText("g")).not.toBeInTheDocument();
      expect(within(wiersz).getByText("… i 2 więcej")).toBeInTheDocument();
    });

    it("eksport pokazuje format", async () => {
      zamockujApi(
        stronaZWpisem({
          id: 3,
          typ: "eksport",
          kiedy: "2026-07-28T06:22:26.735Z",
          dostawca: null,
          uzytkownik: null,
          liczbaPozycji: 7412,
          nazwaPliku: null,
          format: "shoper",
          kodProduktu: null,
          zmienionePola: [],
          uwagi: "Format: shoper",
        }),
      );
      await otworzHistorie();

      const wiersz = await screen.findByTestId("row-history-3");
      expect(within(wiersz).getByText("shoper")).toBeInTheDocument();
      expect(within(wiersz).getByText("Format: shoper")).toBeInTheDocument();
    });
  });

  describe("Odporność na dane, które są w bazie od pierwszego dnia", () => {
    /**
     * Ostrzeżenie z bloku I5 roadmapy. Wpis, którego audyt nie opisał
     * (`szczegoly_json = NULL`), przychodzi z samymi nullami — widok ma pokazać „—",
     * a nie wywalić się na odczycie pola z nieistniejącego obiektu.
     */
    it("wpis z pustymi szczegółami renderuje myślniki zamiast się wywracać", async () => {
      zamockujApi(
        stronaZWpisem({
          id: 4,
          typ: "import",
          kiedy: "2026-07-28T06:22:26.735Z",
          dostawca: null,
          uzytkownik: null,
          liczbaPozycji: null,
          nazwaPliku: null,
          format: null,
          kodProduktu: null,
          zmienionePola: [],
          uwagi: null,
        }),
      );
      await otworzHistorie();

      const wiersz = await screen.findByTestId("row-history-4");
      // Dostawca, użytkownik, liczba pozycji i nazwa pliku — cztery myślniki.
      expect(within(wiersz).getAllByText("—")).toHaveLength(4);
    });

    /**
     * Audyt zapisuje ZAMIAR przed operacją, więc `encja_id` bywa kodem, którego nie ma
     * w `suppliers`. Widok nie złącza z tabelą dostawców — pokazuje kod dosłownie.
     */
    it("kod dostawcy niezłączalny z tabelą dostawców pokazuje się dosłownie", async () => {
      zamockujApi(
        stronaZWpisem({
          id: 5,
          typ: "import",
          kiedy: "2026-07-28T06:22:26.735Z",
          dostawca: "MO99",
          uzytkownik: "Marta Bieguniak",
          liczbaPozycji: null,
          nazwaPliku: null,
          format: null,
          kodProduktu: null,
          zmienionePola: [],
          uwagi: "Plik: ?",
        }),
      );
      await otworzHistorie();

      const wiersz = await screen.findByTestId("row-history-5");
      expect(within(wiersz).getByText("MO99")).toBeInTheDocument();
    });

    it("nieznany typ wpisu pokazuje się dosłownie, zamiast udawać edycję", async () => {
      zamockujApi(
        stronaZWpisem({
          id: 6,
          typ: "cos_nowego",
          kiedy: "2026-07-28T06:22:26.735Z",
          dostawca: null,
          uzytkownik: null,
          liczbaPozycji: null,
          nazwaPliku: null,
          format: null,
          kodProduktu: null,
          zmienionePola: [],
          uwagi: null,
        }),
      );
      await otworzHistorie();

      const wiersz = await screen.findByTestId("row-history-6");
      expect(within(wiersz).getByText("cos_nowego")).toBeInTheDocument();
    });
  });

  it("pusta odpowiedź pokazuje komunikat „Brak wpisów w historii.”", async () => {
    zamockujApi({ items: [], total: 0, pages: 1, page: 1, limit: 25 });
    await otworzHistorie();

    expect(await screen.findByText("Brak wpisów w historii.")).toBeInTheDocument();
  });

  /**
   * ODSTĘPSTWO D5 — oryginał nie rozróżnia błędu od pustej historii i w obu razach pokazuje
   * „Brak wpisów w historii.". My pokazujemy komunikat błędu, jak reszta rebuildu.
   */
  it("błąd sieci pokazuje komunikat, a nie pustą historię (D5)", async () => {
    server.use(
      http.get("*/api/history/meta", () => HttpResponse.json({ dostawcy: [] })),
      http.get("*/api/history/paged", () => HttpResponse.json({ error: "boom" }, { status: 500 })),
    );
    await otworzHistorie();

    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się pobrać historii zmian.");
  });
});
