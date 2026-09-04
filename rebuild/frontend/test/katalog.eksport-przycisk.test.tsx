/**
 * Przycisk „Pobierz CSV" w `/katalog` — sesja 8b (eksport odłożony z Iteracji 2).
 *
 * Format samego pliku pilnuje `katalog.eksport.test.ts` (czyste funkcje). Ten plik
 * sprawdza SPIĘCIE: którą gałąź wybiera widok, jak nazywa plik, jakie pokazuje toasty
 * i jaka jest etykieta przycisku.
 *
 * ⚠ KLUCZOWY FAKT, wbrew nazwie przycisku: `kolumnyWybrane` startuje z 15 kolumn
 * domyślnych (`Katalog.tsx`, oryginał `frontend-index.js:23272`), więc DOMYŚLNIE działa
 * gałąź „wybrane kolumny" — separator wymuszony `";"`, plik `katalog_…_wybrane_….csv`,
 * etykieta „Pobierz CSV (15 kol.)". Format Shoper włącza się dopiero po odznaczeniu
 * WSZYSTKICH kolumn w konfiguratorze. Testy niżej zamrażają obie gałęzie.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { KOLUMNY_DOMYSLNE } from "@/pages/katalog/kolumny";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import {
  TOKEN_TESTOWY,
  dostawcyZFixtura,
  produktyZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const DOSTAWCY = dostawcyZFixtura();
const PRODUKTY = produktyZFixtura();

/**
 * Co widok przekazał do `pobierzPlik` — nazwa pliku i treść CSV.
 *
 * Przechwytujemy na GRANICY MODUŁU, a nie przez podmianę `Blob`/`URL.createObjectURL`:
 * jsdom bywa niekompletny w API plikowym, a i tak interesuje nas tu wyłącznie to, CO
 * widok wybrał (gałąź, separator, kolumny, nazwa). Samo pobieranie — BOM, typ MIME,
 * kotwica `download` — ma własny test w `katalog.eksport.test.ts`.
 */
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

function zamockujApi(opcje: { produkty?: Produkt[]; config?: Record<string, string> } = {}) {
  server.use(
    http.get("*/api/products", () => HttpResponse.json(opcje.produkty ?? PRODUKTY)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/config", () => HttpResponse.json(opcje.config ?? {})),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzKatalog() {
  window.history.pushState({}, "", "/katalog");
  render(<App />);
  return await screen.findByTestId("button-export-katalog");
}

beforeEach(() => {
  pobrania.length = 0;
  queryClient.clear();
  localStorage.clear();
  sessionStorage.clear();
  zasiejSesje();
});

describe("1. Etykieta przycisku — trzy warianty oryginału", () => {
  it("domyślnie pokazuje liczbę wybranych kolumn, NIE „Pobierz CSV (Shoper)”", async () => {
    zamockujApi();
    const przycisk = await otworzKatalog();

    // 15 kolumn domyślnych — to jest stan, który Ania widzi po wejściu na katalog.
    expect(przycisk).toHaveTextContent(`Pobierz CSV (${KOLUMNY_DOMYSLNE.length} kol.)`);
  });
});

describe("2. Gałąź „wybrane kolumny” (domyślna)", () => {
  it("nazywa plik `katalog_wszyscy_wybrane_<data>.csv`", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi();
    const przycisk = await otworzKatalog();

    await uzytkownik.click(przycisk);

    await waitFor(() => expect(pobrania).toHaveLength(1));
    expect(pobrania[0]?.nazwa).toMatch(/^katalog_wszyscy_wybrane_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("wymusza separator `;` MIMO innego separatora w konfiguracji", async () => {
    const uzytkownik = userEvent.setup();
    // Kluczowy przypadek: konfiguracja mówi „|", ale przy wybranych kolumnach
    // oryginał jej NIE czyta (`:23404`). To nie jest pomyłka, tylko jego zachowanie.
    zamockujApi({ config: { "shoper.separator": "|" } });
    const przycisk = await otworzKatalog();

    await uzytkownik.click(przycisk);

    await waitFor(() => expect(pobrania).toHaveLength(1));
    const naglowek = pobrania[0]!.tresc.split("\n")[0]!;
    expect(naglowek).toContain(";");
    expect(naglowek).not.toContain("|");
  });

  it("eksportuje wszystkie produkty z fixtura (żaden nie ma ceny zerowej)", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi();
    await uzytkownik.click(await otworzKatalog());

    await waitFor(() => expect(pobrania).toHaveLength(1));
    // Nagłówek + po wierszu na produkt.
    expect(pobrania[0]!.tresc.split("\n")).toHaveLength(PRODUKTY.length + 1);
  });
});

describe("3. Gałąź Shoper (po odznaczeniu wszystkich kolumn)", () => {
  /** Odznacza komplet kolumn w konfiguratorze — jedyna droga do `size === 0`. */
  async function odznaczWszystkieKolumny(uzytkownik: ReturnType<typeof userEvent.setup>) {
    await uzytkownik.click(screen.getByTestId("button-columns"));
    // Przycisk „Żadna" w konfiguratorze nie ma testida — bierzemy go po nazwie dostępnej.
    await uzytkownik.click(await screen.findByRole("button", { name: "Żadna" }));
    await uzytkownik.keyboard("{Escape}");
  }

  it("etykieta wraca do „Pobierz CSV (Shoper)”, a plik nazywa się `shoper_…`", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi();
    await otworzKatalog();

    await odznaczWszystkieKolumny(uzytkownik);

    const przycisk = await screen.findByTestId("button-export-katalog");
    await waitFor(() => expect(przycisk).toHaveTextContent("Pobierz CSV (Shoper)"));

    await uzytkownik.click(przycisk);
    await waitFor(() => expect(pobrania).toHaveLength(1));
    expect(pobrania[0]?.nazwa).toMatch(/^shoper_wszyscy_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("bez `shoper.kolumny` w konfiguracji używa 13-kolumnowego fallbacku `TT`", async () => {
    const uzytkownik = userEvent.setup();
    // Produkcja NIE MA tego klucza (`GET_config.json`), więc to jest realna ścieżka.
    zamockujApi({ config: {} });
    await otworzKatalog();
    await odznaczWszystkieKolumny(uzytkownik);

    await uzytkownik.click(await screen.findByTestId("button-export-katalog"));

    await waitFor(() => expect(pobrania).toHaveLength(1));
    const naglowek = pobrania[0]!.tresc.split("\n")[0]!;
    expect(naglowek).toBe(
      "kod_dostawcy;nazwa;marka;kategoria;dostawca;stan;cena_zakupu;cena_sprzedazy;marza_pct;vat;ean;status;link_zdjecia",
    );
  });

  it("czyta `shoper.kolumny` i `shoper.separator` z konfiguracji, gdy są", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi({
      config: {
        "shoper.kolumny": "nazwa:Nazwa produktu\nean:Kod EAN",
        "shoper.separator": "|",
      },
    });
    await otworzKatalog();
    await odznaczWszystkieKolumny(uzytkownik);

    await uzytkownik.click(await screen.findByTestId("button-export-katalog"));

    await waitFor(() => expect(pobrania).toHaveLength(1));
    const naglowek = pobrania[0]!.tresc.split("\n")[0]!;
    expect(naglowek).toBe("Nazwa produktu|Kod EAN");
  });
});

describe("4. Toasty", () => {
  it("pusty katalog → toast „Brak produktów do eksportu” z opisem „Katalog jest pusty”", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi({ produkty: [] });
    await uzytkownik.click(await otworzKatalog());

    expect(await screen.findByText("Brak produktów do eksportu")).toBeInTheDocument();
    expect(screen.getByText("Katalog jest pusty")).toBeInTheDocument();
    expect(pobrania).toHaveLength(0);
  });

  it("same ceny zerowe → ten sam toast, mimo niepustego katalogu", async () => {
    const uzytkownik = userEvent.setup();
    const zerowe = PRODUKTY.map((produkt) => ({
      ...produkt,
      cenaZakupu: 0,
      cenaSprzedazy: 0,
    })) as Produkt[];
    zamockujApi({ produkty: zerowe });

    await uzytkownik.click(await otworzKatalog());

    expect(await screen.findByText("Brak produktów do eksportu")).toBeInTheDocument();
    expect(pobrania).toHaveLength(0);
  });

  it("udany eksport → toast „Eksport gotowy” z liczbą pozycji i nazwą pliku", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi();
    await uzytkownik.click(await otworzKatalog());

    expect(await screen.findByText("Eksport gotowy")).toBeInTheDocument();
    await waitFor(() => expect(pobrania).toHaveLength(1));
    expect(screen.getByText(new RegExp(pobrania[0]!.nazwa.replace(/\./g, "\\.")))).toBeInTheDocument();
  });
});
