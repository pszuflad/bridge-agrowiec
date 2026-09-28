/**
 * Zakładka „EAN i ceny" — blok 10c.
 *
 * Wszystkie cztery odpowiedzi EAN pochodzą z `contract/fixtures/GET_analytics_ean_*.json`,
 * czyli z nagrań żywej produkcji — z odjętym `_przyciete`, którego API nie zwraca
 * (`test/msw/kontrakt.ts`). Test sprawdza więc widok przeciwko kształtowi, który realnie
 * oddaje backend.
 *
 * ⚠ OSOBNY PLIK, NIE DOPISEK DO `analityka.test.tsx`. Bloki 10b–10e idą równolegle i każdy
 * wypełnia inną zakładkę tego samego widoku; wspólny plik byłby gwarantowanym konfliktem
 * przy merge'u.
 *
 * ⚠ CZEGO TEN TEST NIE SPRAWDZA: geometrii wykresów. Recharts w jsdom nie ma wymiarów
 * kontenera, więc `ResponsiveContainer` renderuje pustkę — to samo ograniczenie przyjęło
 * 10a. Liczby wykresu i tak są w tabeli pod nim (to obowiązek z `dataviz`, nie ozdoba),
 * więc testujemy je tam, a osobno sprawdzamy liczbę nagłówkową udziału EAN-ów wspólnych,
 * bo ta jest zwykłym tekstem.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import {
  TOKEN_TESTOWY,
  filtryZFixtura,
  kpiZFixtura,
  cyklZyciaDostawcowZFixtura,
  marzeZFixtura,
  pokrycieEanZFixtura,
  porownanieEanZFixtura,
  rankingEanZFixtura,
  stabilnoscDostawcowZFixtura,
  stanDostawcowZFixtura,
  statusAnalitykiZFixtura,
  unikalneEanZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const FILTRY = filtryZFixtura();
const PORWNANIE = porownanieEanZFixtura();
const UNIKALNE = unikalneEanZFixtura();
const POKRYCIE = pokrycieEanZFixtura();
const RANKING = rankingEanZFixtura();

function zamockujApi() {
  server.use(
    http.get("*/api/analytics/filters", () => HttpResponse.json(FILTRY)),
    http.get("*/api/analytics/status", () => HttpResponse.json(statusAnalitykiZFixtura())),
    http.get("*/api/analytics/kpi", () => HttpResponse.json(kpiZFixtura())),
    http.get("*/api/analytics/margins", () => HttpResponse.json(marzeZFixtura())),
    http.get("*/api/analytics/ean/comparison", () => HttpResponse.json(PORWNANIE)),
    http.get("*/api/analytics/ean/unique", () => HttpResponse.json(UNIKALNE)),
    http.get("*/api/analytics/ean/coverage", () => HttpResponse.json(POKRYCIE)),
    http.get("*/api/analytics/ean/supplier-rank", () => HttpResponse.json(RANKING)),
    // Trzy trasy zakładki `dostawcy` (blok 10d) — widok pobiera KOMPLET tras przy każdym
    // wejściu, niezależnie od aktywnej zakładki, więc bez nich `onUnhandledRequest: "error"`
    // wywala test. Treść nieistotna dla asercji tego pliku.
    http.get("*/api/analytics/suppliers/stability", () =>
      HttpResponse.json(stabilnoscDostawcowZFixtura()),
    ),
    http.get("*/api/analytics/suppliers/lifecycle", () =>
      HttpResponse.json(cyklZyciaDostawcowZFixtura()),
    ),
    http.get("*/api/analytics/suppliers/stock", () => HttpResponse.json(stanDostawcowZFixtura())),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

/** Wejście na `/analityka` i przełączenie na zakładkę „EAN i ceny" (domyślna to „Dostawcy"). */
async function otworzZakladkeEan() {
  const uzytkownik = userEvent.setup();
  window.history.pushState({}, "", "/analityka");
  render(<App />);
  await screen.findByTestId("text-page-title");
  await uzytkownik.click(await screen.findByTestId("tab-ean"));
  return uzytkownik;
}

/** Zaznacza dostawcę w globalnym filtrze — kontrolka z 10a jest wyszukiwalnym popoverem. */
async function zaznaczDostawce(uzytkownik: ReturnType<typeof userEvent.setup>, nazwa: string) {
  await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
  await uzytkownik.click(await screen.findByRole("option", { name: nazwa }));
  await uzytkownik.keyboard("{Escape}");
}

/**
 * Dostawca obecny JEDNOCZEŚNIE w kontrolce filtra i w danej tabeli.
 *
 * ⚠ Nie da się wziąć po prostu pierwszego wiersza tabeli. Nagrywarka przycięła każdą listę
 * `GET /api/analytics/filters` do pięciu pozycji (`contract/README.md:29`), więc dostawca
 * z czoła rankingu (`MO9`) w kontrolce filtra po prostu nie istnieje — klik w nieistniejącą
 * opcję wywalał test. Bierzemy więc część wspólną obu list.
 */
function dostawcaZFiltra(wiersze: { dostawca: string }[]): string {
  const dostepni = new Set(FILTRY.dostawcy.map((d) => d.value));
  const znaleziony = wiersze.map((w) => w.dostawca).find((d) => dostepni.has(d));
  if (!znaleziony) throw new Error("Żaden dostawca z fixture'a nie jest w kontrolce filtra");
  return znaleziony;
}

beforeEach(() => {
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
  zamockujApi();
});

describe("1. Trzy karty 1:1 z oryginałem (`frontend-index.js:28175-28294`)", () => {
  it("pokazuje trzy karty w kolejności i z tytułami z produkcji", async () => {
    await otworzZakladkeEan();

    expect(await screen.findByText("2.1-2.4 Porównanie cen po EAN")).toBeInTheDocument();
    expect(screen.getByText("2.5 Pozycje unikalne")).toBeInTheDocument();
    expect(screen.getByText("2.6 Pokrycie wspólne i ranking dostawcy")).toBeInTheDocument();
  });

  it("karta „2.1-2.4” ma siedem kolumn oryginału", async () => {
    await otworzZakladkeEan();
    const tabela = await screen.findByTestId("tabela-ean-porownanie");

    expect(within(tabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "EAN",
      "Nazwa",
      "Dostawcy",
      "Min",
      "Max",
      "Spread zł",
      "Spread %",
    ]);
  });

  it("karta „2.5” ma pięć kolumn oryginału", async () => {
    await otworzZakladkeEan();
    const tabela = await screen.findByTestId("tabela-ean-unikalne");

    expect(within(tabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "EAN",
      "Nazwa",
      "Dostawca",
      "Cena",
      "Stan",
    ]);
  });

  it("karta „2.6” to JEDNA karta z DWIEMA tabelami — pokrycie i ranking", async () => {
    await otworzZakladkeEan();

    const pokrycie = await screen.findByTestId("tabela-ean-pokrycie");
    const rankingTabela = screen.getByTestId("tabela-ean-ranking");

    expect(within(pokrycie).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "Liczba dostawców",
      "EAN",
    ]);
    expect(within(rankingTabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "Dostawca",
      "Wspólne",
      "Najtańszy",
      "Najtańszy %",
    ]);
  });

  it("renderuje wiersze z fixtures, z formatowaniem `pl-PL`", async () => {
    await otworzZakladkeEan();
    const tabela = await screen.findByTestId("tabela-ean-porownanie");
    const pierwszy = PORWNANIE.rows[0]!;

    const wiersz = within(tabela).getByText(pierwszy.ean).closest("tr");
    expect(wiersz).not.toBeNull();
    // `spreadZl: 10348` → „10 348" (spacja nierozdzielająca z locale `pl-PL`).
    expect(wiersz!.textContent).toContain(pierwszy.spreadZl.toLocaleString("pl-PL"));
    expect(wiersz!.textContent).toContain(pierwszy.nazwa);
  });

  /**
   * ⚠ ZAKTUALIZOWANE W BLOKU 10f. Do 2026-09-04 ten test zamrażał BRAK przycisków „CSV" —
   * 10c pominęło je świadomie, bo trasa `GET /api/analytics/export/{view}` jeszcze nie
   * istniała. Teraz istnieje, więc przyciski są tam, gdzie w oryginale: przy kartach
   * „2.1-2.4" i „2.5", ale NIE przy „2.6". Komplet sprawdza `analityka.eksport.test.tsx`;
   * tutaj pilnujemy tylko liczby, żeby nie przybyło ich po cichu w tej zakładce.
   */
  it("ma przyciski CSV przy kartach „2.1-2.4” i „2.5”, ale nie przy „2.6”", async () => {
    await otworzZakladkeEan();
    await screen.findByTestId("tabela-ean-porownanie");

    expect(screen.getAllByRole("button", { name: "CSV" })).toHaveLength(2);
    expect(screen.getByTestId("csv-ean-comparison")).toBeInTheDocument();
    expect(screen.getByTestId("csv-unique")).toBeInTheDocument();
  });
});

describe("2. Liczba nagłówkowa pokrycia (odstępstwo O-10c-1)", () => {
  it("liczy udział EAN-ów dostępnych u co najmniej dwóch dostawców", async () => {
    await otworzZakladkeEan();
    const kafel = await screen.findByTestId("ean-udzial-wspolnych");

    // Fixture: 5109 + 676 + 90 + 2 + 1 = 5878 EAN-ów, z czego 769 u ≥2 dostawców → 13,08%.
    const wszystkie = POKRYCIE.rows.reduce((s, w) => s + w.liczbaEAN, 0);
    const wspolne = POKRYCIE.rows
      .filter((w) => w.liczbaDostawcow >= 2)
      .reduce((s, w) => s + w.liczbaEAN, 0);

    expect(kafel).toHaveTextContent("13,08%");
    expect(kafel).toHaveTextContent(
      `${wspolne.toLocaleString("pl-PL")} z ${wszystkie.toLocaleString("pl-PL")} EAN-ów`,
    );
  });
});

describe("3. Globalne filtry — tylko tam, gdzie wiersz niesie dostawcę (O-10c-2)", () => {
  it("filtr dostawcy zawęża „2.5 Pozycje unikalne” i mówi, ile pozycji ukrył", async () => {
    const uzytkownik = await otworzZakladkeEan();
    await screen.findByTestId("tabela-ean-unikalne");

    const dostawca = dostawcaZFiltra(UNIKALNE.rows);
    const oczekiwane = UNIKALNE.rows.filter((w) => w.dostawca === dostawca).length;
    await zaznaczDostawce(uzytkownik, dostawca);

    const tabela = screen.getByTestId("tabela-ean-unikalne");
    expect(within(tabela).getAllByRole("row")).toHaveLength(oczekiwane + 1); // + nagłówek
    expect(screen.getByTestId("ean-unikalne-licznik-filtra")).toHaveTextContent(
      `Filtry ukryły ${UNIKALNE.rows.length - oczekiwane} z ${UNIKALNE.rows.length} pozycji.`,
    );
  });

  it("filtr dostawcy zawęża ranking, ale NIE histogram pokrycia — i mówi o tym wprost", async () => {
    const uzytkownik = await otworzZakladkeEan();
    await screen.findByTestId("tabela-ean-ranking");

    const dostawca = dostawcaZFiltra(RANKING.rows);
    await zaznaczDostawce(uzytkownik, dostawca);

    expect(within(screen.getByTestId("tabela-ean-ranking")).getAllByRole("row")).toHaveLength(2);
    // Histogram liczy się po całym katalogu — wszystkie wiersze fixture'a zostają.
    expect(within(screen.getByTestId("tabela-ean-pokrycie")).getAllByRole("row")).toHaveLength(
      POKRYCIE.rows.length + 1,
    );
    expect(screen.getByTestId("ean-pokrycie-ignoruje-dostawce")).toBeInTheDocument();
  });

  it("karta „2.1-2.4” wypisuje wszystkie sześć wymiarów jako niestosowane", async () => {
    const uzytkownik = await otworzZakladkeEan();
    await screen.findByTestId("tabela-ean-porownanie");

    await zaznaczDostawce(uzytkownik, dostawcaZFiltra(UNIKALNE.rows));

    const notka = screen.getByTestId("ean-porownanie-pominiete");
    expect(notka).toHaveTextContent("nie stosuje filtrów: Dostawcy");
    // Tabela zostaje nietknięta — nie udajemy, że filtr zadziałał.
    expect(within(screen.getByTestId("tabela-ean-porownanie")).getAllByRole("row")).toHaveLength(
      PORWNANIE.rows.length + 1,
    );
  });
});
