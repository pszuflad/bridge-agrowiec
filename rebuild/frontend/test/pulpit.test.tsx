/**
 * Widok Pulpitu `/` — blok 10f (ostatni placeholder Iteracji 10).
 *
 * Dane idą z `contract/fixtures/` przez loadery w `test/msw/kontrakt.ts`, więc test pracuje
 * na kształtach, które produkcja realnie zwraca — łącznie z tym, że wiersz `/api/history`
 * nie ma pola `typ`.
 *
 * ⚠ TRZY RZECZY, KTÓRE TEN PLIK ZAMRAŻA, BO WYGLĄDAJĄ JAK USTERKA, A SĄ ODBUDOWĄ:
 *  1. kafel „Ostatni eksport CSV" pokazuje „—" i „Brak eksportów ani importów" ZAWSZE
 *     (decyzja D3 — `/api/history` nie niesie pola, którego szuka oryginał);
 *  2. pusta odpowiedź `/api/history` (`[]`, dzisiejszy staging) NIE jest błędem — widok
 *     renderuje się w całości;
 *  3. karty „Najnowsze powiadomienia" NIE MA WCALE, gdy nie ma alertów do pokazania
 *     (`o.length > 0 && …` w oryginale), zamiast pustej karty z komunikatem.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Alert } from "@/pages/alerty/api";
import {
  TOKEN_TESTOWY,
  alertyZFixtura,
  dostawcyZFixtura,
  dziennikZmianZFixtura,
  produktyZFixtura,
  stronaStaginguZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const PRODUKTY = produktyZFixtura();
const DOSTAWCY = dostawcyZFixtura();
/** `GET /api/staging` bez parametrów oddaje GOŁĄ TABLICĘ — bierzemy same `items` nagrania. */
const STAGING = stronaStaginguZFixtura().items;

type Opcje = {
  alerty?: Alert[];
  dziennik?: Record<string, unknown>[];
};

function zamockujApi({ alerty = alertyZFixtura(), dziennik = dziennikZmianZFixtura() }: Opcje = {}) {
  server.use(
    http.get("*/api/products", () => HttpResponse.json(PRODUKTY)),
    http.get("*/api/staging", () => HttpResponse.json(STAGING)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/history", () => HttpResponse.json(dziennik)),
    http.get("*/api/alerts", () => HttpResponse.json(alerty)),
  );
}

async function otworzPulpit() {
  window.history.pushState({}, "", "/");
  render(<App />);
  await screen.findByTestId("text-page-title");
}

beforeEach(() => {
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
});

describe("1. Trasa `/` prowadzi do Pulpitu, nie do placeholdera", () => {
  it("pokazuje tytuł i podtytuł oryginału", async () => {
    zamockujApi();
    await otworzPulpit();

    expect(screen.getByTestId("text-page-title").textContent).toBe("Pulpit");
    expect(
      screen.getByText("Codzienny obraz kanału dostawców i katalogu produktów"),
    ).toBeTruthy();
  });

  it("nie renderuje już komunikatu „w przygotowaniu”", async () => {
    zamockujApi();
    await otworzPulpit();

    expect(screen.queryByText(/w przygotowaniu/i)).toBeNull();
  });
});

describe("2. Cztery kafle KPI — etykiety, liczby i linki oryginału", () => {
  it("ma dokładnie cztery kafle, w kolejności z produkcji", async () => {
    zamockujApi();
    await otworzPulpit();

    for (const testId of ["kpi-products", "kpi-staging", "kpi-alerts", "kpi-export"]) {
      expect(await screen.findByTestId(testId), testId).toBeTruthy();
    }
    expect(screen.getByText("Produkty w katalogu")).toBeTruthy();
    expect(screen.getByText("Oczekujące w staging")).toBeTruthy();
    expect(screen.getByText("Aktywne alerty")).toBeTruthy();
    expect(screen.getByText("Ostatni eksport CSV")).toBeTruthy();
  });

  it("liczby biorą się z DŁUGOŚCI list, a nie z analityki", async () => {
    zamockujApi();
    await otworzPulpit();

    await waitFor(() =>
      expect(screen.getByTestId("kpi-products-value").textContent).toBe(String(PRODUKTY.length)),
    );
    expect(screen.getByTestId("kpi-staging-value").textContent).toBe(String(STAGING.length));
  });

  it("kafle są klikalnymi skrótami do czterech widoków", async () => {
    zamockujApi();
    await otworzPulpit();

    const linki: [string, string][] = [
      ["kpi-products-link", "/katalog"],
      ["kpi-staging-link", "/staging"],
      ["kpi-alerts-link", "/alerty"],
      ["kpi-export-link", "/historia"],
    ];
    for (const [testId, adres] of linki) {
      expect((await screen.findByTestId(testId)).getAttribute("href"), testId).toBe(adres);
    }
  });

  it("kafel alertów liczy tylko status `nowy` i nazywa liczbę krytycznych", async () => {
    zamockujApi({
      alerty: [
        { id: 1, poziom: "krytyczny", typ: "Błąd HTTP", opis: "…", dostawca: "MO1", status: "nowy", data: "2026-09-01T10:00:00.000Z" },
        { id: 2, poziom: "ostrzezenie", typ: "Błąd pobierania", opis: "…", dostawca: "MO2", status: "nowy", data: "2026-09-02T10:00:00.000Z" },
        { id: 3, poziom: "info", typ: "Synchronizacja", opis: "…", dostawca: "MO3", status: "rozwiazany", data: "2026-09-03T10:00:00.000Z" },
      ],
    });
    await otworzPulpit();

    await waitFor(() => expect(screen.getByTestId("kpi-alerts-value").textContent).toBe("2"));
    expect(screen.getByText("1 krytycznych")).toBeTruthy();
  });

  /**
   * Decyzja D3 — kafel odtworzony jako trwale martwy. Wiersze `/api/history` nie mają pola
   * `typ`, więc `find(e => e.typ === "eksport")` nie trafia nigdy.
   */
  it("kafel „Ostatni eksport CSV” pokazuje „—”, mimo że /api/history ma wiersze (D3)", async () => {
    zamockujApi();
    await otworzPulpit();

    const dziennik = dziennikZmianZFixtura();
    expect(dziennik.length, "nagranie /api/history nie jest puste").toBeGreaterThan(0);
    expect(dziennik[0]!.typ, "wiersz nie ma pola `typ`").toBeUndefined();

    await waitFor(() => expect(screen.getByTestId("kpi-export-value").textContent).toBe("—"));
    expect(screen.getByText("Brak eksportów ani importów")).toBeTruthy();
  });
});

describe("3. Pusty `GET /api/history` nie jest błędem", () => {
  it("widok renderuje się w całości przy odpowiedzi `[]` (dzisiejszy staging)", async () => {
    zamockujApi({ dziennik: [] });
    await otworzPulpit();

    await waitFor(() => expect(screen.getByTestId("kpi-export-value").textContent).toBe("—"));
    expect(screen.getByText("Brak eksportów ani importów")).toBeTruthy();
    // Reszta strony stoi — pusta historia nie wywraca ani kafli, ani tabeli dostawców.
    expect(screen.getByTestId("kpi-products")).toBeTruthy();
    expect(screen.getByTestId("tabela-dostawcow-pulpit")).toBeTruthy();
    expect(screen.queryByText(/błąd/i)).toBeNull();
  });
});

describe("4. Karta „Najnowsze powiadomienia”", () => {
  const DUZO_ALERTOW: Alert[] = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    poziom: i === 0 ? "krytyczny" : "ostrzezenie",
    typ: `Błąd pobierania ${i + 1}`,
    opis: `opis ${i + 1}`,
    dostawca: "MO1",
    status: "nowy",
    data: `2026-09-0${(i % 4) + 1}T10:00:00.000Z`,
  }));

  it("pokazuje NAJWYŻEJ pięć wierszy, choć aktywnych jest więcej", async () => {
    zamockujApi({ alerty: DUZO_ALERTOW });
    await otworzPulpit();

    const karta = await screen.findByTestId("card-recent-alerts");
    const wiersze = within(karta).getAllByTestId(/^row-dashboard-alert-/);
    expect(wiersze).toHaveLength(5);
    // Licznik w podtytule mówi o CAŁOŚCI, nie o pokazanej piątce.
    expect(within(karta).getByText("8 aktywnych alertów łącznie")).toBeTruthy();
  });

  it("krytyczny stoi na górze, przed świeższymi ostrzeżeniami", async () => {
    zamockujApi({ alerty: DUZO_ALERTOW });
    await otworzPulpit();

    const karta = await screen.findByTestId("card-recent-alerts");
    const pierwszy = within(karta).getAllByTestId(/^row-dashboard-alert-/)[0]!;
    expect(pierwszy.getAttribute("data-testid")).toBe("row-dashboard-alert-1");
  });

  it("ma przycisk „Zobacz wszystkie” prowadzący do /alerty", async () => {
    zamockujApi({ alerty: DUZO_ALERTOW });
    await otworzPulpit();

    expect(await screen.findByTestId("link-all-alerts")).toBeTruthy();
  });

  it("karty NIE MA WCALE, gdy nie ma alertów do pokazania", async () => {
    zamockujApi({ alerty: [] });
    await otworzPulpit();

    await screen.findByTestId("kpi-alerts");
    expect(screen.queryByTestId("card-recent-alerts")).toBeNull();
  });

  it("alerty rozwiązane i poziom `info` nie trafiają do karty", async () => {
    zamockujApi({
      alerty: [
        { id: 1, poziom: "info", typ: "Synchronizacja", opis: "…", dostawca: "MO1", status: "nowy", data: "2026-09-01T10:00:00.000Z" },
        { id: 2, poziom: "krytyczny", typ: "Błąd HTTP", opis: "…", dostawca: "MO2", status: "rozwiazany", data: "2026-09-02T10:00:00.000Z" },
      ],
    });
    await otworzPulpit();

    await screen.findByTestId("kpi-alerts");
    expect(screen.queryByTestId("card-recent-alerts")).toBeNull();
  });
});

describe("5. Tabela „Ostatnia aktywność dostawców”", () => {
  it("ma dziewięć kolumn oryginału", async () => {
    zamockujApi();
    await otworzPulpit();

    const tabela = await screen.findByTestId("tabela-dostawcow-pulpit");
    expect(within(tabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "Kod",
      "Dostawca",
      "Email",
      "Format",
      "Ostatni plik",
      "Ostatnia aktualizacja ceny",
      "Ostatnia aktualizacja stanu magazynowego",
      "Produkty",
      "Status",
    ]);
  });

  it("sortuje dostawców po liczbie w kodzie, nie po napisie", async () => {
    zamockujApi();
    await otworzPulpit();

    const tabela = await screen.findByTestId("tabela-dostawcow-pulpit");
    const kody = within(tabela)
      .getAllByTestId(/^row-supplier-/)
      .map((w) => w.getAttribute("data-testid")!.replace("row-supplier-", ""));
    const numery = kody.map((k) => parseInt(k.replace(/\D/g, ""), 10) || 0);
    expect(numery).toEqual([...numery].sort((a, b) => a - b));
  });
});
