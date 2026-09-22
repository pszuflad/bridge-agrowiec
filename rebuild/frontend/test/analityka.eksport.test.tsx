/**
 * Przyciski „CSV” w widoku `/analityka` — plik = to, co widać w tabeli karty
 * (karta P10.3, backlog #91; wcześniej blok 10f z nawigacją pod `export/{view}`).
 *
 * Sprawdzamy na pełnym `<App/>` z danymi z fixtures:
 *  1. przycisk stoi w każdej z dziesięciu kart, które mają go w oryginale — i tylko tam;
 *  2. plik każdej karty ma NAGŁÓWEK = nagłówki tabeli i WIERSZE = wiersze tabeli, komórka
 *     w komórkę (liczby porównane po wartości, bo tabela formatuje je `pl-PL`);
 *  3. filtr globalny zawęża plik, „Bez ruchu dni” zmienia plik Rotacji, a plik ma wszystkie
 *     wiersze, gdy tabela rysuje tylko 300;
 *  4. żaden przycisk nie woła już `GET /api/analytics/export/{view}`.
 *
 * Pobranie przechwytujemy na GRANICY MODUŁU (`pobierzPlik`), jak `katalog.eksport-przycisk.test.tsx`.
 * Sam zapis pliku (BOM, typ MIME, kotwica) ma test w `analityka.csv.test.tsx`.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type {
  WierszDostepnosci,
  WierszRotacji,
  WierszTempaSchodzenia,
} from "@/pages/analityka/api";
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
  unikalneEanZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

// Ten sam powód co w testach 10d/10e: chunk `/analityka` ciągnie Recharts.
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

/** Zakładka → widoki eksportu, które mają w niej przycisk (kolejność kart z oryginału). */
const KARTY_Z_CSV = {
  "tab-dostawcy": ["suppliers-stability", "suppliers-lifecycle", "suppliers-stock"],
  "tab-ean": ["ean-comparison", "unique"],
  "tab-ceny": ["prices-last"],
  "tab-dostepnosc": ["availability-products", "sell-through"],
  "tab-marza": ["margins", "rotation-inactive"],
} as const;

/** Przycisk karty → `data-testid` tabeli tej samej karty. */
const TABELA_KARTY: Record<string, string> = {
  "suppliers-stability": "tabela-stabilnosc-dostawcow",
  "suppliers-lifecycle": "tabela-cykl-zycia-dostawcow",
  "suppliers-stock": "tabela-stan-dostawcow",
  "ean-comparison": "tabela-ean-porownanie",
  unique: "tabela-ean-unikalne",
  "prices-last": "tabela-ceny-ostatni-import",
  "availability-products": "tabela-dostepnosc-produktow",
  "sell-through": "tabela-tempo-schodzenia",
  margins: "tabela-marze",
  "rotation-inactive": "tabela-rotacja",
};

// ── Wiersze syntetyczne dla trzech tras, których nagrania są PUSTE ─────────────────────────
// `GET_analytics_availability_products.json`, `…_sell-through.json` i `…_rotation_inactive.json`
// mają `rows: []` (#32 w produkcji), a plik pustej tabeli niczego nie dowodzi. Pola celowo
// zawierają to, co w pliku jest nieoczywiste: `null` (pusta nazwa po P10.1), ułamek, średnik,
// cudzysłów i polskie znaki.

const DOSTEPNOSC: WierszDostepnosci[] = [
  { dostawca: "MO1", kod: "MO1_A", ean: "0440000005139", nazwa: 'Opona 20" Łódź; TL', dostepnoscPct: 87.5, miesiaceBrakow: "2026-07" },
  { dostawca: "MO2", kod: "MO2_B", ean: null, nazwa: null, dostepnoscPct: null, miesiaceBrakow: null },
];

const TEMPO: WierszTempaSchodzenia[] = [
  { dostawca: "MO1", kod: "MO1_A", nazwa: "Ciężarowa", zeszloSztuk: 12 },
  { dostawca: "MO2", kod: "MO2_B", nazwa: null, zeszloSztuk: 3.5 },
];

function rotacja(ile: number, prefiks = "R"): WierszRotacji[] {
  return Array.from({ length: ile }, (_, i) => ({
    kod: `${prefiks}${String(i).padStart(4, "0")}`,
    nazwa: `Pozycja ${i}`,
    dostawca: i % 2 === 0 ? "MO1" : "MO2",
    marka: "BKT",
    model: null,
    rozmiar: null,
    stan: i,
    ostatniaAktualizacja: "2026-06-01T10:00:00.000Z",
  }));
}

/** Liczba wywołań trasy eksportu serwerowego — ma zostać zerem. */
let wywolaniaEksportuSerwerowego = 0;

function zamockujApi(opcje: { rotacja?: (dni: string | null) => WierszRotacji[] } = {}) {
  const wierszeRotacji = opcje.rotacja ?? (() => rotacja(4));
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
    http.get("*/api/analytics/suppliers/stock", () => HttpResponse.json(stanDostawcowZFixtura())),
    http.get("*/api/analytics/ean/comparison", () => HttpResponse.json(porownanieEanZFixtura())),
    http.get("*/api/analytics/ean/unique", () => HttpResponse.json(unikalneEanZFixtura())),
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
      HttpResponse.json({ hasHistory: true, rows: DOSTEPNOSC }),
    ),
    http.get("*/api/analytics/availability/sell-through", () =>
      HttpResponse.json({ hasHistory: true, rows: TEMPO }),
    ),
    http.get("*/api/analytics/seasonality/monthly", () => HttpResponse.json(sezonowoscZFixtura())),
    http.get("*/api/analytics/lifecycle/models", () => HttpResponse.json(cyklZyciaModeliZFixtura())),
    http.get("*/api/analytics/rotation/inactive", ({ request }) => {
      const dni = new URL(request.url).searchParams.get("days");
      return HttpResponse.json({ days: Number(dni), rows: wierszeRotacji(dni) });
    }),
    http.get("*/api/analytics/export/:view", () => {
      wywolaniaEksportuSerwerowego += 1;
      return new HttpResponse("\ufeff", { headers: { "Content-Type": "text/csv" } });
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
  wywolaniaEksportuSerwerowego = 0;
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
});

// ── Pomocniki porównania „plik vs tabela” ─────────────────────────────────────────────────

/** Minimalny parser CSV dla formatu z `csv.ts`: `;`, `\n`, pola w cudzysłowach z `""`. */
function parsujCsv(tresc: string): string[][] {
  const wiersze: string[][] = [];
  let wiersz: string[] = [];
  let pole = "";
  let wCudzyslowie = false;
  for (let i = 0; i < tresc.length; i++) {
    const znak = tresc[i]!;
    if (wCudzyslowie) {
      if (znak === '"' && tresc[i + 1] === '"') {
        pole += '"';
        i++;
      } else if (znak === '"') wCudzyslowie = false;
      else pole += znak;
    } else if (znak === '"') wCudzyslowie = true;
    else if (znak === ";") {
      wiersz.push(pole);
      pole = "";
    } else if (znak === "\n") {
      wiersz.push(pole);
      wiersze.push(wiersz);
      wiersz = [];
      pole = "";
    } else pole += znak;
  }
  wiersz.push(pole);
  wiersze.push(wiersz);
  return wiersze;
}

/** Komórka tabeli → wartość do porównania: „—” = brak, liczby `pl-PL` → number, „%” zdjęty. */
function wartoscZTabeli(tekst: string): string | number | null {
  const t = tekst.trim();
  if (t === "—") return null;
  const bezProcentu = t.endsWith("%") ? t.slice(0, -1) : t;
  if (/^-?[\d\s\u00a0\u202f]+(,\d+)?$/.test(bezProcentu)) {
    return Number(bezProcentu.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  }
  return t;
}

/** Komórka pliku → ta sama przestrzeń wartości. Liczby zaokrąglone jak w tabeli (2 miejsca). */
function wartoscZPliku(komorka: string): string | number | null {
  if (komorka === "") return null;
  if (/^-?\d+(,\d+)?$/.test(komorka)) {
    return Math.round(Number(komorka.replace(",", ".")) * 100) / 100;
  }
  return komorka;
}

function naglowkiTabeli(tabela: HTMLElement): string[] {
  return within(tabela)
    .getAllByRole("columnheader")
    .map((th) => th.textContent ?? "");
}

function wierszeTabeli(tabela: HTMLElement): string[][] {
  const tbody = tabela.querySelector("tbody")!;
  return Array.from(tbody.querySelectorAll("tr"))
    .map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent ?? ""))
    .filter((komorki) => komorki.length > 1 || !/Brak danych|Wczytywanie/.test(komorki[0] ?? ""));
}

async function pobierzCsv(uzytkownik: ReturnType<typeof userEvent.setup>, widok: string) {
  const przycisk = await screen.findByTestId(`csv-${widok}`);
  await waitFor(() => expect(przycisk).toBeEnabled());
  const przed = pobrania.length;
  await uzytkownik.click(przycisk);
  expect(pobrania).toHaveLength(przed + 1);
  const { nazwa, tresc } = pobrania[pobrania.length - 1]!;
  return { nazwa, wiersze: parsujCsv(tresc) };
}

function oczekujPlikuJakTabela(plik: string[][], tabela: HTMLElement) {
  const [naglowek, ...dane] = plik;
  expect(naglowek).toEqual(naglowkiTabeli(tabela));
  const zTabeli = wierszeTabeli(tabela);
  expect(dane).toHaveLength(zTabeli.length);
  dane.forEach((wiersz, i) => {
    expect(wiersz.map(wartoscZPliku), `wiersz ${i}`).toEqual(zTabeli[i]!.map(wartoscZTabeli));
  });
}

// ── Testy ─────────────────────────────────────────────────────────────────────────────────

describe("przycisk „CSV” stoi w każdej karcie, która ma go w oryginale", () => {
  it("karta „2.6” nie ma przycisku — oryginał też go tam nie daje", async () => {
    zamockujApi();
    await otworzZakladke("tab-ean");

    await screen.findByTestId("csv-unique");
    expect(screen.queryByTestId("csv-ean-coverage")).toBeNull();
    expect(screen.queryByTestId("csv-ean-supplier-rank")).toBeNull();
  });

  it("przycisk siedzi w NAGŁÓWKU karty, obok tytułu — nie w tabeli", async () => {
    zamockujApi();
    await otworzZakladke("tab-marza");

    const przycisk = await screen.findByTestId("csv-margins");
    const naglowek = przycisk.parentElement!;
    expect(within(naglowek).getByText("Marża per dostawca/kategoria/marka")).toBeTruthy();
  });
});

describe("plik = nagłówki i wiersze tabeli karty — każda z dziesięciu kart", () => {
  for (const [zakladka, widoki] of Object.entries(KARTY_Z_CSV)) {
    it(`${zakladka}: ${widoki.join(", ")}`, async () => {
      zamockujApi();
      const uzytkownik = await otworzZakladke(zakladka);

      for (const widok of widoki) {
        const tabela = await screen.findByTestId(TABELA_KARTY[widok]!);
        await waitFor(() => expect(wierszeTabeli(tabela).length).toBeGreaterThan(0));

        const { nazwa, wiersze } = await pobierzCsv(uzytkownik, widok);
        expect(nazwa).toBe(`${widok}.csv`);
        oczekujPlikuJakTabela(wiersze, tabela);
      }
      expect(wywolaniaEksportuSerwerowego).toBe(0);
    });
  }
});

describe("filtry i zakres pliku", () => {
  it("filtr globalny (dostawca) zawęża plik tak samo jak tabelę", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-dostawcy");
    const tabela = await screen.findByTestId("tabela-stabilnosc-dostawcow");
    await waitFor(() => expect(wierszeTabeli(tabela).length).toBeGreaterThan(1));

    await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
    await uzytkownik.click(await screen.findByRole("option", { name: "MO2" }));
    await uzytkownik.keyboard("{Escape}");
    await waitFor(() => expect(wierszeTabeli(tabela)).toHaveLength(1));

    const { wiersze } = await pobierzCsv(uzytkownik, "suppliers-stability");
    expect(wiersze).toHaveLength(2);
    expect(wiersze[1]![0]).toBe("MO2");
    oczekujPlikuJakTabela(wiersze, tabela);
  });

  it("pusta tabela po filtrach → plik z samym nagłówkiem", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-dostawcy");
    const tabela = await screen.findByTestId("tabela-stabilnosc-dostawcow");
    await waitFor(() => expect(wierszeTabeli(tabela).length).toBeGreaterThan(0));

    // MO10 jest na liście filtra, ale w żadnym nagranym wierszu.
    await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
    await uzytkownik.click(await screen.findByRole("option", { name: "MO10" }));
    await uzytkownik.keyboard("{Escape}");
    await waitFor(() => expect(within(tabela).getByText("Brak danych")).toBeInTheDocument());

    const { wiersze } = await pobierzCsv(uzytkownik, "suppliers-stability");
    expect(wiersze).toEqual([naglowkiTabeli(tabela)]);
  });

  it("„Bez ruchu dni” zmienia plik Rotacji — plik bierze wiersze po `?days`", async () => {
    zamockujApi({ rotacja: (dni) => (dni === "90" ? rotacja(2, "D90-") : rotacja(5, "D60-")) });
    const uzytkownik = await otworzZakladke("tab-marza");
    const tabela = await screen.findByTestId("tabela-rotacja");
    await waitFor(() => expect(wierszeTabeli(tabela)).toHaveLength(5));

    const przed = await pobierzCsv(uzytkownik, "rotation-inactive");
    expect(przed.wiersze.slice(1).map((w) => w[2])).toEqual(
      ["D60-0000", "D60-0001", "D60-0002", "D60-0003", "D60-0004"],
    );

    const pole = screen.getByTestId("pole-dni-rotacji");
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, "90");
    await waitFor(() => expect(wierszeTabeli(tabela)).toHaveLength(2));

    const po = await pobierzCsv(uzytkownik, "rotation-inactive");
    expect(po.wiersze.slice(1).map((w) => w[2])).toEqual(["D90-0000", "D90-0001"]);
    oczekujPlikuJakTabela(po.wiersze, tabela);
  });

  it("zbiór > 300: tabela rysuje 300, plik ma WSZYSTKIE wiersze", async () => {
    zamockujApi({ rotacja: () => rotacja(350) });
    const uzytkownik = await otworzZakladke("tab-marza");
    const tabela = await screen.findByTestId("tabela-rotacja");
    await waitFor(() => expect(wierszeTabeli(tabela)).toHaveLength(300));

    const { wiersze } = await pobierzCsv(uzytkownik, "rotation-inactive");
    expect(wiersze).toHaveLength(351);
    expect(wiersze[350]![2]).toBe("R0349");
    // Pierwsze 300 wierszy pliku to dokładnie wiersze tabeli.
    expect(
      wiersze.slice(1, 301).map((w) => w.map(wartoscZPliku)),
    ).toEqual(wierszeTabeli(tabela).map((w) => w.map(wartoscZTabeli)));
  });

  it("Marża: plik ma grupy dostawca/kategoria/marka z tabeli, nie pozycje per produkt", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-marza");
    const tabela = await screen.findByTestId("tabela-marze");
    await waitFor(() => expect(wierszeTabeli(tabela).length).toBeGreaterThan(0));

    const { wiersze } = await pobierzCsv(uzytkownik, "margins");
    expect(wiersze[0]).toEqual([
      "Dostawca", "Kategoria", "Marka", "Produkty", "Śr. marża", "Min", "Max",
    ]);
    expect(wiersze).toHaveLength(marzeZFixtura().rows.length + 1);
    // Wiersz grupy z nagrania, polskie znaki bez zmian.
    expect(wiersze[1]!.slice(0, 4)).toEqual(["MO1", "Ciężarowe", "ALLIANCE", "1"]);
  });
});

describe("wartości w pliku", () => {
  it("Dostępność: surowa liczba (nie „87,5%”), brak wartości = pusta komórka, escapowanie", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-dostepnosc");
    await screen.findByTestId("tabela-dostepnosc-produktow");

    const { wiersze } = await pobierzCsv(uzytkownik, "availability-products");
    expect(wiersze).toEqual([
      ["Dostawca", "Kod", "EAN", "Nazwa", "Dostępność", "Miesiące braków"],
      ["MO1", "MO1_A", "0440000005139", 'Opona 20" Łódź; TL', "87,5", "2026-07"],
      ["MO2", "MO2_B", "", "", "", ""],
    ]);
  });
});
