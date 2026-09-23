/**
 * Pełne pliki CSV z Analityki — zdjęcie sufitu tras WYŁĄCZNIE dla pliku
 * (karta P10.5, backlog #96, decyzja Ani 2026-09-23 „chcę pełne pliki").
 *
 * Co tu jest dowodzone, a czego NIE dowodzi `analityka.eksport.test.tsx`:
 *
 * Tamten plik sprawdza, że plik = tabela po filtrach, ale jego mocki oddają jedną i tę samą
 * tablicę niezależnie od parametrów — bo MSW dopasowuje handler po ŚCIEŻCE i ignoruje query
 * string. Sufit backendu był tam więc niewidoczny: „wszystkie wiersze" znaczyło „wszystkie
 * z tego, co mock oddał".
 *
 * Tutaj handlery ROZRÓŻNIAJĄ `?limit=0` od zapytania bez parametru i oddają różne zbiory —
 * dokładnie tak, jak robi to backend po P10.5. Dopiero to pozwala pokazać, że:
 *  • plik dostaje PEŁNY zbiór, a tabela i kafel KPI nadal widzą ZBIÓR Z SUFITEM;
 *  • filtry stosują się na pełnym zbiorze, a nie na jego uciętym kawałku;
 *  • Rotacja niesie `?days` i `?limit=0` naraz;
 *  • błąd pobrania NIE daje pliku (cicho ucięty plik to usterka z #96);
 *  • karty bez sufitu nie robią drugiego zapytania.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { WierszUnikalnegoEan } from "@/pages/analityka/api";
import {
  TOKEN_TESTOWY,
  cyklZyciaDostawcowZFixtura,
  cyklZyciaModeliZFixtura,
  filtryZFixtura,
  kpiZFixtura,
  marzeZFixtura,
  ostatniImportZFixtura,
  pokrycieEanZFixtura,
  porownanieEanZFixtura,
  rankingEanZFixtura,
  sezonowoscZFixtura,
  stabilnoscDostawcowZFixtura,
  stanDostawcowZFixtura,
  statusAnalitykiZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

vi.setConfig({ testTimeout: 30_000 });

const UZYTKOWNIK = uzytkownikZFixtura();

const pobrania: { nazwa: string; tresc: string }[] = [];

vi.mock("@/pages/katalog/eksport", async (oryginalny) => {
  const modul = await oryginalny<typeof import("@/pages/katalog/eksport")>();
  return {
    ...modul,
    pobierzPlik: (nazwa: string, tresc: string) => {
      pobrania.push({ nazwa, tresc });
    },
  };
});

/**
 * Sufit odwzorowany w mocku. Liczby są małe (renderowanie 5109 wierszy w jsdom trwa),
 * ale układ jest ten sam co na produkcji: zbiór jest WIELOKROTNIE większy niż sufit,
 * a sufit jest większy niż 300 wierszy rysowanych przez tabelę.
 */
const SUFIT = 400;
const PELNY = 1200;

/** Co drugi wiersz u innego dostawcy — pozwala sprawdzić filtr na pełnym zbiorze. */
function unikalne(ile: number): WierszUnikalnegoEan[] {
  return Array.from({ length: ile }, (_, i) => ({
    ean: String(5900000000000 + i),
    nazwa: `Pozycja ${String(i).padStart(5, "0")}`,
    dostawca: i % 2 === 0 ? "MO1" : "MO2",
    cenaZakupu: 100 + i,
    stan: i,
  }));
}

/** Zapytania, które poszły do trasy `ean/unique` — z surowym query stringiem. */
let zapytaniaUnikalnych: string[] = [];
/** Zapytania do tras BEZ sufitu — mają NIE dostać drugiego strzału z `?limit=0`. */
let zapytaniaStanu: string[] = [];
let zapytaniaRotacji: string[] = [];

function zamockujApi(opcje: { unikalneBezLimitu?: () => HttpResponse<null> } = {}) {
  server.use(
    http.get("*/api/analytics/filters", () => HttpResponse.json(filtryZFixtura())),
    http.get("*/api/analytics/status", () => HttpResponse.json(statusAnalitykiZFixtura())),
    http.get("*/api/analytics/kpi", () => HttpResponse.json(kpiZFixtura())),
    http.get("*/api/analytics/margins", () => HttpResponse.json(marzeZFixtura())),
    http.get("*/api/analytics/suppliers/stability", () =>
      HttpResponse.json(stabilnoscDostawcowZFixtura()),
    ),
    http.get("*/api/analytics/suppliers/lifecycle", () =>
      HttpResponse.json(cyklZyciaDostawcowZFixtura()),
    ),
    http.get("*/api/analytics/suppliers/stock", ({ request }) => {
      zapytaniaStanu.push(new URL(request.url).search);
      return HttpResponse.json(stanDostawcowZFixtura());
    }),
    http.get("*/api/analytics/ean/comparison", () => HttpResponse.json(porownanieEanZFixtura())),

    // ⭐ SEDNO TESTU: ta trasa rozróżnia `?limit=0` od zapytania bez parametru.
    http.get("*/api/analytics/ean/unique", ({ request }) => {
      const url = new URL(request.url);
      zapytaniaUnikalnych.push(url.search);
      if (url.searchParams.get("limit") === "0") {
        return opcje.unikalneBezLimitu?.() ?? HttpResponse.json({ rows: unikalne(PELNY) });
      }
      return HttpResponse.json({ rows: unikalne(SUFIT) });
    }),

    http.get("*/api/analytics/ean/coverage", () => HttpResponse.json(pokrycieEanZFixtura())),
    http.get("*/api/analytics/ean/supplier-rank", () => HttpResponse.json(rankingEanZFixtura())),
    http.get("*/api/analytics/prices/last-import", () => HttpResponse.json(ostatniImportZFixtura())),
    http.get("*/api/analytics/prices/inflation", () =>
      HttpResponse.json({ hasHistory: false, rows: [] }),
    ),
    http.get("*/api/analytics/prices/product-history", () =>
      HttpResponse.json({ hasHistory: false, rows: [], stats: null }),
    ),
    http.get("*/api/analytics/market/group-prices", () =>
      HttpResponse.json({ group: "marka", rows: [] }),
    ),
    http.get("*/api/analytics/availability/products", () =>
      HttpResponse.json({ hasHistory: true, rows: [] }),
    ),
    http.get("*/api/analytics/availability/sell-through", () =>
      HttpResponse.json({ hasHistory: true, rows: [] }),
    ),
    http.get("*/api/analytics/seasonality/monthly", () => HttpResponse.json(sezonowoscZFixtura())),
    http.get("*/api/analytics/lifecycle/models", () => HttpResponse.json(cyklZyciaModeliZFixtura())),
    http.get("*/api/analytics/rotation/inactive", ({ request }) => {
      const url = new URL(request.url);
      zapytaniaRotacji.push(url.search);
      return HttpResponse.json({ days: Number(url.searchParams.get("days")), rows: [] });
    }),
  );
}

async function otworzZakladke(testId: string) {
  const uzytkownik = userEvent.setup();
  window.history.pushState({}, "", "/analityka");
  render(<App />);
  await screen.findByTestId("text-page-title", undefined, { timeout: 15_000 });
  await uzytkownik.click(await screen.findByTestId(testId));
  return uzytkownik;
}

beforeEach(() => {
  pobrania.length = 0;
  zapytaniaUnikalnych = [];
  zapytaniaStanu = [];
  zapytaniaRotacji = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
});

/** Wiersze `<tbody>` tabeli — ten sam sposób liczenia co `analityka.eksport.test.tsx`. */
function wierszeTabeli(tabela: HTMLElement): HTMLElement[] {
  const tbody = tabela.querySelector("tbody")!;
  return Array.from(tbody.querySelectorAll("tr")).filter(
    (tr) => !/Brak danych|Wczytywanie/.test(tr.textContent ?? ""),
  );
}

/** Liczba wierszy DANYCH w pliku (bez wiersza nagłówków). */
function wierszyDanych(tresc: string): number {
  return tresc.trimEnd().split("\n").length - 1;
}

async function kliknijCsv(uzytkownik: ReturnType<typeof userEvent.setup>, widok: string) {
  const przycisk = await screen.findByTestId(`csv-${widok}`);
  await waitFor(() => expect(przycisk).toBeEnabled());
  await uzytkownik.click(przycisk);
}

describe("pełny plik CSV — zdjęcie sufitu tylko dla eksportu (P10.5)", () => {
  it("plik dostaje PEŁNY zbiór, choć tabela i kafel widzą zbiór z sufitem", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-ean");
    const tabela = await screen.findByTestId("tabela-ean-unikalne");

    // Tabela rysuje 300 — limit rysowania z oryginału, nietknięty.
    await waitFor(() => expect(wierszeTabeli(tabela)).toHaveLength(300));
    // Kafel „Pozycje unikalne" liczy zbiór Z SUFITEM (port 1:1, karta PR.2).
    expect(await screen.findByTestId("kpi-pozycje-unikalne")).toHaveTextContent(String(SUFIT));

    await kliknijCsv(uzytkownik, "unique");

    await waitFor(() => expect(pobrania).toHaveLength(1));
    expect(pobrania[0]!.nazwa).toBe("unique.csv");
    expect(wierszyDanych(pobrania[0]!.tresc)).toBe(PELNY);

    // Kafel i tabela NIE drgnęły po pobraniu pliku.
    expect(screen.getByTestId("kpi-pozycje-unikalne")).toHaveTextContent(String(SUFIT));
    expect(wierszeTabeli(tabela)).toHaveLength(300);
  });

  it("pełny zbiór leci DOPIERO po kliknięciu — wejście na zakładkę go nie ciągnie", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-ean");
    await screen.findByTestId("tabela-ean-unikalne");

    expect(zapytaniaUnikalnych.every((q) => !q.includes("limit=0"))).toBe(true);

    await kliknijCsv(uzytkownik, "unique");
    await waitFor(() => expect(pobrania).toHaveLength(1));

    expect(zapytaniaUnikalnych.filter((q) => q.includes("limit=0"))).toHaveLength(1);
  });

  it("filtr globalny zawęża PEŁNY zbiór, nie jego ucięty kawałek", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-ean");
    const tabela = await screen.findByTestId("tabela-ean-unikalne");
    await waitFor(() => expect(wierszeTabeli(tabela)).toHaveLength(300));

    // Filtr „dostawca = MO1" — co drugi wiersz, więc połowa każdego zbioru.
    await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
    await uzytkownik.click(await screen.findByRole("option", { name: "MO1" }));
    await uzytkownik.keyboard("{Escape}");
    // Tabela: połowa zbioru Z SUFITEM (200) — poniżej limitu rysowania, więc widać wszystkie.
    await waitFor(() => expect(wierszeTabeli(tabela)).toHaveLength(SUFIT / 2));

    await kliknijCsv(uzytkownik, "unique");
    await waitFor(() => expect(pobrania).toHaveLength(1));

    // Połowa PEŁNEGO zbioru (600), a nie połowa zbioru z sufitem (200).
    expect(wierszyDanych(pobrania[0]!.tresc)).toBe(PELNY / 2);
    expect(pobrania[0]!.tresc).not.toContain("MO2");
  });

  it("Rotacja niesie `?days` i `?limit=0` w jednym adresie", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-marza");
    await screen.findByTestId("tabela-rotacja");

    const pole = screen.getByTestId("pole-dni-rotacji");
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, "90");

    await waitFor(() => expect(zapytaniaRotacji.some((q) => q.includes("days=90"))).toBe(true));
    await kliknijCsv(uzytkownik, "rotation-inactive");
    await waitFor(() => expect(pobrania).toHaveLength(1));

    const eksportowe = zapytaniaRotacji.filter((q) => q.includes("limit=0"));
    expect(eksportowe).toHaveLength(1);
    expect(eksportowe[0]).toContain("days=90");
  });

  it("karta BEZ sufitu nie robi drugiego zapytania — plik z wierszy, które już są", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-dostawcy");
    await screen.findByTestId("tabela-stan-dostawcow");
    const przed = zapytaniaStanu.length;

    await kliknijCsv(uzytkownik, "suppliers-stock");
    await waitFor(() => expect(pobrania).toHaveLength(1));

    expect(zapytaniaStanu).toHaveLength(przed);
    expect(zapytaniaStanu.every((q) => !q.includes("limit=0"))).toBe(true);
  });

  describe("błąd pobrania nie daje pliku", () => {
    it("trasa zwraca 500 → komunikat, ŻADNEGO pliku", async () => {
      zamockujApi({ unikalneBezLimitu: () => new HttpResponse(null, { status: 500 }) });
      const uzytkownik = await otworzZakladke("tab-ean");
      await screen.findByTestId("tabela-ean-unikalne");

      await kliknijCsv(uzytkownik, "unique");

      expect(await screen.findByText(/Nie udało się pobrać pełnych danych/)).toBeInTheDocument();
      expect(pobrania).toHaveLength(0);
    });

    it("wygasła sesja (401 → `null`) też jest błędem, a nie pustym plikiem", async () => {
      zamockujApi({ unikalneBezLimitu: () => new HttpResponse(null, { status: 401 }) });
      const uzytkownik = await otworzZakladke("tab-ean");
      await screen.findByTestId("tabela-ean-unikalne");

      await kliknijCsv(uzytkownik, "unique");

      expect(await screen.findByText(/Nie udało się pobrać pełnych danych/)).toBeInTheDocument();
      expect(pobrania).toHaveLength(0);
    });
  });
});
