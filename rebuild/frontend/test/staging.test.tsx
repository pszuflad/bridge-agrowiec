/**
 * Widok `/staging` — render przeciwko mockom MSW zbudowanym z nagranych fixtures produkcji
 * (`contract/fixtures/GET_staging_paged.json`, `GET_staging.json`).
 *
 * Zakres: że ekran renderuje dane, że filtr/szukajka/paginacja wysyłają właściwe parametry
 * do `/paged`, że trzy warianty akcji masowych wysyłają właściwe ciało, że podgląd różnic
 * dociąga pozycję po id — i że wiersz `wycofana`, który ma INNY kształt niż reszta,
 * nie wywraca podglądu.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { queryClient } from "@/lib/queryClient";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { server } from "./msw/server";
import { WYGLAD_TYPU } from "@/pages/staging/dane";
import {
  pozycjaStaginguZFixtura,
  stronaStaginguZFixtura,
  TOKEN_TESTOWY,
  uzytkownikZFixtura,
} from "./msw/kontrakt";

const UZYTKOWNIK = uzytkownikZFixtura();
const STRONA = stronaStaginguZFixtura();
const POZYCJA = pozycjaStaginguZFixtura();

/** Adresy, pod które poszły żądania — na nich sprawdzamy parametry filtrów. */
let zapytania: string[] = [];
/** Ciała żądań mutacji — na nich sprawdzamy `ids` vs `allFiltered`. */
let mutacje: { url: string; body: unknown }[] = [];

// ⚠ KOLEJNOŚĆ HANDLERÓW MA ZNACZENIE: wzorzec `.../api/staging/:id` pasuje TAKŻE do
// `/api/staging/paged` (dopasowuje `id = "paged"`), a MSW bierze handler zarejestrowany
// PÓŹNIEJ. Dlatego oba rejestrujemy w JEDNYM wywołaniu, z `paged` na początku — dołożenie
// `:id` osobnym `server.use()` przechwyciłoby listę i tabela zostałaby pusta.
function zamockujApi(
  strona: Record<string, unknown> = STRONA,
  szczegol: Record<string, unknown> | null = null,
) {
  server.use(
    http.get("*/api/staging/paged", ({ request }) => {
      zapytania.push(request.url);
      return HttpResponse.json(strona);
    }),
    http.get("*/api/staging/:id", ({ params }) =>
      HttpResponse.json(szczegol ?? { ...POZYCJA, id: Number(params.id) }),
    ),
    http.post("*/api/staging/accept", async ({ request }) => {
      const body = await request.json();
      mutacje.push({ url: request.url, body });
      return HttpResponse.json({ ok: true, accepted: 2 });
    }),
    http.post("*/api/staging/reject", async ({ request }) => {
      const body = await request.json();
      mutacje.push({ url: request.url, body });
      return HttpResponse.json({ ok: true, rejected: 1 });
    }),
    http.put("*/api/staging/:id", async ({ request }) => {
      const body = await request.json();
      mutacje.push({ url: request.url, body });
      return HttpResponse.json(POZYCJA);
    }),
    http.get("*/api/products", () => HttpResponse.json([])),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzStaging() {
  window.history.pushState({}, "", "/staging");
  render(<App />);
  await screen.findByTestId("input-search-staging");
}

/** Ostatni adres `/paged` — po nim sprawdzamy, co widok wysłał do backendu. */
const ostatnieZapytanie = () => new URL(zapytania[zapytania.length - 1]!);

describe("Widok /staging", () => {
  beforeEach(() => {
    zapytania = [];
    mutacje = [];
    sessionStorage.clear();
    localStorage.clear();
    // `queryClient` jest SINGLETONEM modułowym ze `staleTime: Infinity` (wiernie wobec
    // oryginału), więc bez czyszczenia kolejny test dostałby dane poprzedniego pod tym
    // samym kluczem — a kluczem jest tu pełny adres z parametrami.
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  it("renderuje pozycje z fixture'a wraz z kolumnami i odznaką typu", async () => {
    await otworzStaging();

    const pierwsza = STRONA.items[0] as Record<string, unknown>;
    expect(await screen.findByText(String(pierwsza.kod))).toBeInTheDocument();

    // Nagłówki kolumn 1:1 z oryginałem.
    for (const naglowek of [
      "Typ",
      "Kod",
      "Nazwa",
      "Dostawca",
      "Stan",
      "Cena zakupu",
      "Cena sprzedaży",
      "Magazyn",
      "Zmiana",
      "Powód / co sprawdzić",
      "Akcje",
    ]) {
      expect(screen.getByRole("columnheader", { name: naglowek })).toBeInTheDocument();
    }

    // Etykieta bierze się z mapy z oryginału, nie z surowej wartości pola. Oczekiwanie
    // wyprowadzamy z FIXTURE'A, żeby test nie zakładał, co produkcja akurat nagrała.
    const typWFixture = String((STRONA.items[0] as Record<string, unknown>).typZmiany);
    expect(WYGLAD_TYPU[typWFixture], `brak etykiety dla typu ${typWFixture}`).toBeDefined();
    expect(screen.getAllByText(WYGLAD_TYPU[typWFixture]!.etykieta).length).toBeGreaterThan(0);
  });

  it("pierwsze żądanie idzie z domyślnymi parametrami (strona 1, 25, wszystkie)", async () => {
    await otworzStaging();

    await waitFor(() => expect(zapytania.length).toBeGreaterThan(0));
    const url = ostatnieZapytanie();
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("typZmiany")).toBe("all");
    expect(url.searchParams.get("search")).toBe("");
  });

  it("szukajka trafia do parametru `search`", async () => {
    const uzytkownik = userEvent.setup();
    await otworzStaging();

    await uzytkownik.type(screen.getByTestId("input-search-staging"), "BKT");

    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("search")).toBe("BKT"));
  });

  it("zmiana rozmiaru strony trafia do `limit` i wraca na stronę 1", async () => {
    const uzytkownik = userEvent.setup();
    await otworzStaging();

    await uzytkownik.click(screen.getByTestId("button-next-page"));
    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("page")).toBe("2"));

    await uzytkownik.click(screen.getByTestId("button-page-size-100"));

    await waitFor(() => {
      const url = ostatnieZapytanie();
      expect(url.searchParams.get("limit")).toBe("100");
      expect(url.searchParams.get("page"), "zmiana rozmiaru strony cofa na pierwszą").toBe("1");
    });
  });

  describe("Akcje masowe — trzy warianty, trzy różne ciała żądania", () => {
    it("„zaznaczone” wysyła `ids` tylko z zaznaczonych wierszy", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`checkbox-staging-${pierwsza.id}`));
      await uzytkownik.click(screen.getByTestId("button-accept-checked"));

      await waitFor(() => expect(mutacje).toHaveLength(1));
      expect(mutacje[0]!.url).toContain("/api/staging/accept");
      expect(mutacje[0]!.body).toEqual({ ids: [pierwsza.id] });
    });

    it("„widoczne” wysyła `ids` wszystkich wierszy bieżącej strony", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      await screen.findByTestId("checkbox-select-all");

      await uzytkownik.click(screen.getByTestId("button-accept-selected"));

      await waitFor(() => expect(mutacje).toHaveLength(1));
      const ids = (mutacje[0]!.body as { ids: number[] }).ids;
      expect(ids).toHaveLength(STRONA.items.length);
    });

    it("„wszystkie” wysyła `allFiltered` z bieżącym filtrem, a nie listę id", async () => {
      const uzytkownik = userEvent.setup();
      // `confirm` w jsdom domyślnie nie istnieje — akcja masowa pyta o potwierdzenie.
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-reject-all"));

      await waitFor(() => expect(mutacje).toHaveLength(1));
      expect(mutacje[0]!.url).toContain("/api/staging/reject");
      expect(mutacje[0]!.body).toEqual({ allFiltered: true, typZmiany: "all" });
    });

    it("odmowa w oknie potwierdzenia NIE wysyła żądania", async () => {
      const uzytkownik = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(false);
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-accept-all"));

      expect(mutacje).toHaveLength(0);
    });

    it("zaznaczenie „wszystkie widoczne” zaznacza i odznacza cały zestaw", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const zaznaczWszystkie = await screen.findByTestId("checkbox-select-all");
      await uzytkownik.click(zaznaczWszystkie);
      expect(
        screen.getByTestId("button-accept-checked").textContent,
      ).toContain(String(STRONA.items.length));

      await uzytkownik.click(zaznaczWszystkie);
      expect(screen.getByTestId("button-accept-checked").textContent).toContain("(0)");
    });
  });

  describe("Podgląd różnic", () => {
    it("dociąga pozycję po id, bo `/paged` nie zwraca `snapshotJson`", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`button-details-${pierwsza.id}`));

      const dialog = await screen.findByTestId("dialog-staging");
      // Snapshot pochodzi z `GET /api/staging/{id}` — na liście go nie było.
      await waitFor(() =>
        expect(within(dialog).getByTestId("szczegoly-snapshot")).toBeInTheDocument(),
      );
      expect(within(dialog).getByTestId("szczegoly-powod")).toBeInTheDocument();
    });

    /**
     * ⚠ NAJWAŻNIEJSZY TEST TEGO PLIKU. Wiersz `wycofana` ma inny kształt niż reszta:
     * `snapshotJson` jest `null`, pola `ean*` też, `cenaZakupuNowa` i `zmianaPct` są `null`,
     * a `stanNowy` to zawsze 0. Podgląd, który zakłada obecność snapshotu, wywraca się
     * dokładnie tutaj — a `wycofana` to 149 wierszy na realnych cennikach.
     */
    it("wiersz `wycofana` renderuje się i otwiera BEZ wywrócenia podglądu", async () => {
      const wycofana = {
        ...(STRONA.items[0] as Record<string, unknown>),
        id: 999001,
        typZmiany: "wycofana",
        stanNowy: 0,
        cenaZakupuNowa: null,
        zmianaPct: null,
        eanRaw: null,
        eanIsValid: null,
        eanSourceStatus: null,
        powod: "Brak w cenniku — pozycja wycofana",
      };
      zamockujApi({ ...STRONA, items: [wycofana] }, { ...wycofana, snapshotJson: null });

      const uzytkownik = userEvent.setup();
      await otworzStaging();

      expect(await screen.findByText("Wycofana")).toBeInTheDocument();
      await uzytkownik.click(await screen.findByTestId("button-details-999001"));

      const dialog = await screen.findByTestId("dialog-staging");
      await waitFor(() =>
        expect(within(dialog).getByTestId("szczegoly-wycofana")).toBeInTheDocument(),
      );
      // Dla wycofania nie ma czego edytować — przycisk zapisu nie powstaje.
      expect(within(dialog).queryByTestId("button-save-details")).not.toBeInTheDocument();
    });
  });

  describe("Edycja — jedyna ścieżka tworząca poprawki Marty", () => {
    it("wysyła `PUT` tylko ze zmienionymi polami i z `_reason`", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`button-details-${pierwsza.id}`));
      const dialog = await screen.findByTestId("dialog-staging");

      await uzytkownik.type(within(dialog).getByTestId("input-kategoria"), "Przemysłowe");
      await uzytkownik.type(within(dialog).getByTestId("input-reason"), "decyzja Marty");
      await uzytkownik.click(within(dialog).getByTestId("button-save-details"));

      await waitFor(() => expect(mutacje).toHaveLength(1));
      expect(mutacje[0]!.url).toContain(`/api/staging/${pierwsza.id}`);
      expect(mutacje[0]!.body).toEqual({
        kategoria: "Przemysłowe",
        _reason: "decyzja Marty",
      });
    });

    it("przycisk zapisu jest nieaktywny, dopóki nic nie zmieniono", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`button-details-${pierwsza.id}`));
      const dialog = await screen.findByTestId("dialog-staging");

      expect(within(dialog).getByTestId("button-save-details")).toBeDisabled();
    });
  });

  describe("Stany brzegowe", () => {
    it("pusty wynik pokazuje komunikat z oryginału", async () => {
      zamockujApi({ items: [], total: 0, page: 1, pageSize: 25, pages: 0 });
      await otworzStaging();

      expect(await screen.findByText("Brak elementów do wyświetlenia")).toBeInTheDocument();
    });

    it("błąd pobrania pokazuje komunikat, a nie pustą tabelę", async () => {
      server.use(
        http.get("*/api/staging/paged", () => HttpResponse.json({ error: "boom" }, { status: 500 })),
      );
      await otworzStaging();

      expect(
        await screen.findByText("Nie udało się pobrać pozycji stagingu."),
      ).toBeInTheDocument();
    });
  });
});
