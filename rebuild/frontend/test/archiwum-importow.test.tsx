/**
 * Widok `/archiwum` — render przeciwko MSW zasilanemu nagraniami oryginału
 * (`contract/fixtures/GET_import-archive*.json`, ticket 91 / karta PR.1).
 *
 * Zakres: lista i osiem kolumn z `archive-injection.js`, filtry (parametry zapytania i opcje
 * liczone z wczytanej listy), pasek zajętości, pobranie pliku pod ORYGINALNĄ nazwą
 * z Bearerem i dwoma segmentami ścieżki, pusty stan, błąd serwera listy, błąd statystyk,
 * błąd pobrania (toast) i pozycja w menu.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { server } from "./msw/server";
import {
  listaArchiwumZFixtura,
  plikArchiwumZFixtura,
  statystykiArchiwumZFixtura,
  TOKEN_TESTOWY,
  uzytkownikZFixtura,
} from "./msw/kontrakt";

const LISTA = listaArchiwumZFixtura();
const LISTA_MO6 = listaArchiwumZFixtura("_dostawca");
const LISTA_BLAD = listaArchiwumZFixtura("_status");
const STATY = statystykiArchiwumZFixtura();
const PLIK = plikArchiwumZFixtura();
const MO6 = LISTA.items.find((p) => p.dostawca === "MO6")!;
const MO7 = LISTA.items.find((p) => p.dostawca === "MO7")!;

let zapytania: URL[] = [];
let pobrania: { url: URL; autoryzacja: string | null }[] = [];

function zamockujApi({ lista = LISTA as unknown, staty = STATY as unknown } = {}) {
  server.use(
    http.get("*/api/import-archive/stats", () => HttpResponse.json(staty as object)),
    http.get("*/api/import-archive/file/:month/:name", ({ request }) => {
      pobrania.push({ url: new URL(request.url), autoryzacja: request.headers.get("Authorization") });
      return new HttpResponse(PLIK.tresc, {
        headers: {
          "Content-Type": PLIK.naglowki["content-type"] ?? "text/csv",
          "Content-Disposition": PLIK.naglowki["content-disposition"] ?? "",
        },
      });
    }),
    http.get("*/api/import-archive", ({ request }) => {
      const url = new URL(request.url);
      zapytania.push(url);
      // Serwer filtruje sam; tu wystarczą nagrane warianty.
      if (url.searchParams.get("dostawca") === "MO6") return HttpResponse.json(LISTA_MO6);
      if (url.searchParams.get("status") === "blad") return HttpResponse.json(LISTA_BLAD);
      return HttpResponse.json(lista as object);
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(uzytkownikZFixtura()));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzArchiwum() {
  window.history.pushState({}, "", "/archiwum");
  render(<App />);
  await screen.findByTestId("select-archiwum-dostawca");
}

const ostatnieZapytanie = () => zapytania[zapytania.length - 1]!;

/** jsdom nie ma `URL.createObjectURL` — podstawiamy go, żeby przechwycić blob i kotwicę. */
let zapisaneBloby: Blob[] = [];
let klikniete: { download: string; href: string }[] = [];

describe("Widok /archiwum", () => {
  beforeEach(() => {
    zapytania = [];
    pobrania = [];
    zapisaneBloby = [];
    klikniete = [];
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => {
          zapisaneBloby.push(blob);
          return "blob:archiwum-test";
        },
        revokeObjectURL: () => undefined,
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      klikniete.push({ download: this.download, href: this.getAttribute("href") ?? "" });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renderuje pozycje z nagrania, najnowsze pierwsze, z ośmioma kolumnami oryginału", async () => {
    await otworzArchiwum();

    const wiersze = await screen.findAllByTestId(/^row-archiwum-/);
    expect(wiersze.map((w) => w.getAttribute("data-testid"))).toEqual(
      LISTA.items.map((p) => `row-archiwum-${p.id}`),
    );
    for (const naglowek of ["Data", "Dostawca", "Źródło", "Plik", "Rozmiar", "Rekordy", "Status"]) {
      expect(screen.getByRole("columnheader", { name: naglowek })).toBeInTheDocument();
    }

    const wierszMo6 = within(screen.getByTestId(`row-archiwum-${MO6.id}`));
    expect(wierszMo6.getByText("MO6")).toBeInTheDocument();
    expect(wierszMo6.getByText(`upload · ${MO6.uzytkownik}`)).toBeInTheDocument();
    expect(wierszMo6.getByText("MO6.csv")).toBeInTheDocument();
    expect(wierszMo6.getByText("237 B")).toBeInTheDocument();
    expect(wierszMo6.getByText("OK")).toBeInTheDocument();

    // Plik, który nie przeszedł parsowania: BŁĄD, treść błędu pod nazwą, rekordy „—".
    const wierszMo7 = within(screen.getByTestId(`row-archiwum-${MO7.id}`));
    expect(wierszMo7.getByText("BŁĄD")).toBeInTheDocument();
    expect(wierszMo7.getByText(/^Quote Not Closed/)).toBeInTheDocument();
    expect(wierszMo7.getByText("—")).toBeInTheDocument();
  });

  it("pokazuje zajętość archiwum ze statystyk (limit 5 GB, retencja 7 dni)", async () => {
    await otworzArchiwum();

    // Nagranie: 23 498 B = 22.9 KB (`fmtSize`: jedno miejsce po przecinku), limit 5 GB = 5.00 GB.
    const zajetosc = await screen.findByTestId("text-archiwum-zajetosc");
    expect(zajetosc).toHaveTextContent(`Archiwum: 22.9 KB / 5.00 GB · ${STATY.plikow} plików · retencja 7 dni`);
  });

  it("filtr dostawcy wysyła `dostawca`, a opcje liczy z wczytanej listy", async () => {
    await otworzArchiwum();
    await screen.findAllByTestId(/^row-archiwum-/);

    await userEvent.click(screen.getByTestId("select-archiwum-dostawca"));
    const opcje = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(opcje).toEqual(["Wszyscy dostawcy", "MO1", "MO6", "MO7"]);
    await userEvent.click(screen.getByRole("option", { name: "MO6" }));

    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("dostawca")).toBe("MO6"));
    expect(await screen.findAllByTestId(/^row-archiwum-/)).toHaveLength(1);

    // Po zawężeniu lista dostawców to już tylko MO6 — dziwactwo oryginału, zachowane.
    await userEvent.click(screen.getByTestId("select-archiwum-dostawca"));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
      "Wszyscy dostawcy",
      "MO6",
    ]);
  });

  it("filtr statusu wysyła `status=blad`", async () => {
    await otworzArchiwum();
    await screen.findAllByTestId(/^row-archiwum-/);

    await userEvent.click(screen.getByTestId("select-archiwum-status"));
    await userEvent.click(await screen.findByRole("option", { name: "Błąd parsowania" }));

    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("status")).toBe("blad"));
    expect(await screen.findByTestId(`row-archiwum-${MO7.id}`)).toBeInTheDocument();
  });

  it("filtr miesiąca pokazuje polską nazwę i wysyła `miesiac=RRRR-MM`", async () => {
    await otworzArchiwum();
    await screen.findAllByTestId(/^row-archiwum-/);
    const miesiac = MO6.id.slice(0, 7);

    await userEvent.click(screen.getByTestId("select-archiwum-miesiac"));
    await userEvent.click(await screen.findByRole("option", { name: /^\p{L}+ \d{4}$/u }));

    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("miesiac")).toBe(miesiac));
  });

  it("„Pobierz” — fetch z Bearerem na dwa segmenty, zapis pod ORYGINALNĄ nazwą", async () => {
    await otworzArchiwum();

    await userEvent.click(await screen.findByTestId(`button-archiwum-pobierz-${MO6.id}`));

    await waitFor(() => expect(klikniete).toHaveLength(1));
    const [miesiac, nazwa] = MO6.id.split("/") as [string, string];
    expect(pobrania[0]!.url.pathname).toBe(`/api/import-archive/file/${miesiac}/${nazwa}`);
    expect(pobrania[0]!.autoryzacja).toBe(`Bearer ${TOKEN_TESTOWY}`);
    // Nazwa z listy (`oryginalnaNazwa`), NIE archiwalna z Content-Disposition.
    expect(klikniete[0]!.download).toBe("MO6.csv");
    expect(PLIK.naglowki["content-disposition"]).toContain(nazwa);
    expect(await zapisaneBloby[0]!.text()).toBe(PLIK.tresc);
  });

  it("nazwa ze spacją idzie zakodowana w ŚCIEŻCE, a zapisuje się dosłownie", async () => {
    await otworzArchiwum();

    await userEvent.click(await screen.findByTestId(`button-archiwum-pobierz-${MO7.id}`));

    await waitFor(() => expect(klikniete).toHaveLength(1));
    expect(klikniete[0]!.download).toBe("cennik MO7.csv");
    expect(pobrania[0]!.url.pathname.split("/")).toHaveLength(6);
  });

  it("błąd pobrania → toast z kodem odpowiedzi, bez zapisu pliku", async () => {
    server.use(
      http.get("*/api/import-archive/file/:month/:name", () =>
        HttpResponse.json({ ok: false, error: "Nie znaleziono pliku" }, { status: 404 }),
      ),
    );
    await otworzArchiwum();

    await userEvent.click(await screen.findByTestId(`button-archiwum-pobierz-${MO6.id}`));

    const toast = await screen.findByTestId("toast-destructive");
    expect(toast).toHaveTextContent("Nie udało się pobrać pliku");
    expect(toast).toHaveTextContent("404");
    expect(klikniete).toHaveLength(0);
  });

  it("pusty stan — komunikat z oryginału", async () => {
    zamockujApi({ lista: { ok: true, total: 0, items: [] } });
    await otworzArchiwum();

    expect(await screen.findByTestId("text-archiwum-pusto")).toHaveTextContent(
      "Brak zarchiwizowanych plików. Nowe importy będą się tu pojawiać automatycznie.",
    );
  });

  it("błąd serwera listy — komunikat `<status>: <treść>` i pusty stan zamiast tabeli", async () => {
    server.use(
      http.get("*/api/import-archive", () =>
        HttpResponse.json({ ok: false, error: "EACCES" }, { status: 500 }),
      ),
    );
    await otworzArchiwum();

    const blad = await screen.findByTestId("text-archiwum-blad");
    expect(blad).toHaveTextContent('500: {"ok":false,"error":"EACCES"}');
    expect(screen.queryAllByTestId(/^row-archiwum-/)).toHaveLength(0);
  });

  it("błąd statystyk nie psuje widoku — znika tylko pasek zajętości", async () => {
    server.use(
      http.get("*/api/import-archive/stats", () => HttpResponse.json({ ok: false }, { status: 500 })),
    );
    await otworzArchiwum();

    expect(await screen.findAllByTestId(/^row-archiwum-/)).toHaveLength(LISTA.items.length);
    expect(screen.queryByTestId("text-archiwum-zajetosc")).not.toBeInTheDocument();
  });

  it("„Odśwież” pobiera listę i statystyki od nowa", async () => {
    await otworzArchiwum();
    await screen.findAllByTestId(/^row-archiwum-/);
    const przed = zapytania.length;

    await userEvent.click(screen.getByTestId("button-archiwum-odswiez"));

    await waitFor(() => expect(zapytania.length).toBe(przed + 1));
  });

  it("pozycja „Archiwum importów” w menu prowadzi na `/archiwum`, zaraz za Historią", async () => {
    await otworzArchiwum();

    const link = screen.getByTestId("link-nav-archiwum");
    expect(link).toHaveTextContent("Archiwum importów");
    expect(link).toHaveAttribute("href", "/archiwum");
    expect(screen.getByTestId("link-nav-historia").nextElementSibling).toBe(link);
  });
});
