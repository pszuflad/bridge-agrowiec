/**
 * Zakładka „Ceny w czasie" — blok 10b.
 *
 * Dane pochodzą z `contract/fixtures/GET_analytics_prices_*.json`, czyli z nagrań żywej
 * produkcji, z odjętym kluczem `_przyciete` (patrz `test/msw/kontrakt.ts`). Widok jest więc
 * sprawdzany przeciwko kształtowi, który realnie oddaje backend.
 *
 * Zakres: że karty są TRZY i w kolejności oryginału; że etykiety kolumn są 1:1; że karta
 * historii NIE PYTA backendu, dopóki oba pola są puste, a po wpisaniu pyta z właściwym
 * query stringiem i tylko RAZ (debounce, O-10b-1); że filtr globalny zawęża obie tabele
 * tabelaryczne i mówi, których wymiarów nie stosuje; że wykres inflacji pojawia się razem
 * z tabelą, gdy szereg ma więcej niż jeden miesiąc.
 *
 * ⚠ CZEGO TEN PLIK NIE TESTUJE I NIE MA TESTOWAĆ: `top-zmiany` ani `market/group-prices`.
 * Obie mają backend, żadna nie ma UI (decyzje D1 i D2) — widok ich nie woła, więc nie ma
 * tu czego sprawdzać. Pokrywa je `analityka.ceny.gate.test.ts` po stronie backendu.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { HistoriaCenyProduktu, WierszInflacji } from "@/pages/analityka/api";
import { OPOZNIENIE_MS } from "@/pages/analityka/useOpoznionaWartosc";
import {
  TOKEN_TESTOWY,
  filtryZFixtura,
  historiaCenyZFixtura,
  inflacjaZFixtura,
  kpiZFixtura,
  marzeZFixtura,
  ostatniImportZFixtura,
  statusAnalitykiZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const FILTRY = filtryZFixtura();
const STATUS = statusAnalitykiZFixtura();
const KPI = kpiZFixtura();
const MARZE = marzeZFixtura();
const OSTATNI_IMPORT = ostatniImportZFixtura();
const INFLACJA = inflacjaZFixtura();
const HISTORIA = historiaCenyZFixtura();

/**
 * Wersja odpowiedzi inflacji z DWOMA miesiącami, zbudowana z nagranych wierszy.
 *
 * ⚠ OGRANICZENIE SIATKI, NAZWANE WPROST — dwa razy, bo nagranie zawodzi tu dwukrotnie.
 *
 * 1. `GET_analytics_prices_inflation.json` ma pięciu dostawców, ale WSZYSTKICH w jednym
 *    miesiącu (`2026-08`): nagranie przycięto do pięciu wierszy z siedemnastu i wszystkie
 *    trafiły z tego samego miesiąca. Na takich danych wykres liniowy się nie rysuje i nie
 *    powinien — linia przez jeden punkt to nie szereg czasowy. Drugi miesiąc dokładamy sami,
 *    zachowując kształt wiersza z nagrania.
 * 2. Piąty dostawca nagrania to `MO5`, a lista filtra (`GET_analytics_filters.json`) niesie
 *    `MO1, MO10, MO2, MO3, MO4` — `MO5` nie da się w UI zaznaczyć. Podmieniamy go więc na
 *    `MO10`, żeby każdy dostawca wykresu był wybieralny.
 *
 * `MO4` zostaje przy jednym miesiącu i dzięki temu jest JEDYNYM dostawcą poza czwórką serii
 * (`MAX_SERII`), deterministycznie i bez polegania na rozstrzyganiu remisów alfabetem.
 */
function inflacjaZDwomaMiesiacami(): { hasHistory: boolean; rows: WierszInflacji[] } {
  const sierpien = INFLACJA.rows.map((w) => ({
    ...w,
    dostawca: w.dostawca === "MO5" ? "MO10" : w.dostawca,
  }));
  const lipiec = sierpien
    .filter((w) => w.dostawca !== "MO4")
    .map((w) => ({
      ...w,
      miesiac: "2026-07",
      sredniaCena: (w.sredniaCena ?? 0) / 2,
      inflacjaPct: null,
    }));
  return { hasHistory: true, rows: [...sierpien, ...lipiec] };
}

/** Adresy `product-history`, o które widok realnie zapytał — sedno testu debounce'u. */
let zapytaniaHistorii: string[] = [];

function zamockujApi({
  inflacja = INFLACJA,
  historia = HISTORIA,
}: {
  inflacja?: { hasHistory: boolean; rows: WierszInflacji[] };
  historia?: HistoriaCenyProduktu;
} = {}) {
  server.use(
    http.get("*/api/analytics/filters", () => HttpResponse.json(FILTRY)),
    http.get("*/api/analytics/status", () => HttpResponse.json(STATUS)),
    http.get("*/api/analytics/kpi", () => HttpResponse.json(KPI)),
    http.get("*/api/analytics/margins", () => HttpResponse.json(MARZE)),
    http.get("*/api/analytics/prices/last-import", () => HttpResponse.json(OSTATNI_IMPORT)),
    http.get("*/api/analytics/prices/inflation", () => HttpResponse.json(inflacja)),
    http.get("*/api/analytics/prices/product-history", ({ request }) => {
      zapytaniaHistorii.push(new URL(request.url).search);
      return HttpResponse.json(historia);
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

/** Cisza na realnych zegarach — używana tam, gdzie sprawdzamy, że coś się NIE wydarzyło. */
function odczekaj(ms: number): Promise<void> {
  return new Promise((gotowe) => setTimeout(gotowe, ms));
}

/** Wejście na `/analityka` i przełączenie na zakładkę „Ceny w czasie". */
async function otworzZakladkeCen(opcje?: Parameters<typeof userEvent.setup>[0]) {
  const uzytkownik = userEvent.setup(opcje);
  window.history.pushState({}, "", "/analityka");
  render(<App />);
  // Trasa jest ładowana leniwie (osobny chunk z Recharts), więc czekamy na tytuł strony.
  await screen.findByTestId("text-page-title");
  await uzytkownik.click(await screen.findByTestId("tab-ceny"));
  return uzytkownik;
}

/** Etykiety nagłówków tabeli — porównujemy je z kolumnami oryginału co do znaku. */
function naglowki(testId: string): string[] {
  return within(screen.getByTestId(testId))
    .getAllByRole("columnheader")
    .map((k) => k.textContent ?? "");
}

beforeEach(() => {
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zapytaniaHistorii = [];
  zasiejSesje();
});

describe("1. Trzy karty w kolejności oryginału", () => {
  it("pokazuje tytuły trzech kart — i tylko tych trzech", async () => {
    zamockujApi();
    await otworzZakladkeCen();

    expect(await screen.findByText("3.1 Zmiany cen z ostatnich importów")).toBeInTheDocument();
    expect(screen.getByText("3.2 / 3.3 Historia ceny wybranej opony")).toBeInTheDocument();
    expect(screen.getByText("3.6 Inflacja cennika")).toBeInTheDocument();
  });

  it("nie renderuje niczego dla `top-zmiany` ani `market/group-prices`", async () => {
    zamockujApi();
    await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-ostatni-import");

    // Obie trasy mają backend i fixture, ale zero UI w oryginale (decyzje D1/D2).
    // Gdyby ktoś dorobił im kartę, ten test ma o tym powiedzieć wprost.
    expect(screen.queryByText(/top zmiany/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ceny rynkowe|group-prices/i)).not.toBeInTheDocument();
  });

  it("zastąpiła placeholder bloku 10b", async () => {
    zamockujApi();
    await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-ostatni-import");

    expect(screen.queryByText(/Dashboardy w przygotowaniu — blok 10b/)).not.toBeInTheDocument();
  });
});

describe("2. Kolumny 1:1 z oryginałem", () => {
  it("karta 3.1 ma siedem kolumn oryginału (`frontend-index.js:28315-28340`)", async () => {
    zamockujApi();
    await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-ostatni-import");

    expect(naglowki("tabela-ceny-ostatni-import")).toEqual([
      "Data",
      "Dostawca",
      "Kod",
      "Nazwa",
      "Było",
      "Jest",
      "Zmiana %",
    ]);
  });

  it("karta 3.2/3.3 ma sześć kolumn oryginału — BEZ EAN-u, choć API go zwraca", async () => {
    zamockujApi();
    await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-historia");

    expect(naglowki("tabela-ceny-historia")).toEqual([
      "Data",
      "Dostawca",
      "Kod",
      "Cena zakupu",
      "Cena sprzedaży",
      "Stan",
    ]);
  });

  it("karta 3.6 ma cztery kolumny oryginału", async () => {
    zamockujApi();
    await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-inflacja");

    expect(naglowki("tabela-ceny-inflacja")).toEqual([
      "Miesiąc",
      "Dostawca",
      "Śr. cena",
      "Zmiana %",
    ]);
  });

  it("renderuje wiersze z nagrań produkcji", async () => {
    zamockujApi();
    await otworzZakladkeCen();

    const tabelaImportu = await screen.findByTestId("tabela-ceny-ostatni-import");
    expect(within(tabelaImportu).getByText("MO2_37200095AL")).toBeInTheDocument();

    // Wszystkie pięć nagranych wierszy inflacji jest z tego samego miesiąca.
    const tabelaInflacji = screen.getByTestId("tabela-ceny-inflacja");
    expect(within(tabelaInflacji).getAllByText("2026-08")).toHaveLength(INFLACJA.rows.length);
    expect(within(tabelaInflacji).getByText("3138,08")).toBeInTheDocument();
  });
});

describe("3. Historia ceny — jedyna karta z kontrolkami wejścia", () => {
  it("NIE pyta backendu, dopóki oba pola są puste (`n || a ? … : …`)", async () => {
    zamockujApi();
    await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-historia");

    // Trasa nie ma LIMIT-u — bez tego warunku samo wejście na zakładkę ściągałoby
    // całą `historia_cen` (15 597 wierszy w nagraniu).
    expect(zapytaniaHistorii).toEqual([]);
  });

  it("pokazuje statyczny tekst oryginału niezależnie od stanu pól", async () => {
    zamockujApi();
    await otworzZakladkeCen();

    expect(
      await screen.findByText("Wykres/tabela zapełnią się po zebraniu historii cen."),
    ).toBeInTheDocument();
  });

  it("po wpisaniu EAN-u pyta z `?ean=` i pokazuje wiersze", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-historia");

    await uzytkownik.type(screen.getByTestId("input-historia-ean"), "8903635000259");

    await waitFor(() => expect(zapytaniaHistorii.length).toBeGreaterThan(0));
    expect(zapytaniaHistorii.at(-1)).toBe("?ean=8903635000259&kod=");
    expect(await screen.findByText("MO2_30800800AL-IN")).toBeInTheDocument();
  });

  it("wysyła oba parametry, gdy wypełnione są oba pola", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-historia");

    await uzytkownik.type(screen.getByTestId("input-historia-ean"), "111");
    await uzytkownik.type(screen.getByTestId("input-historia-kod"), "MO2_936570");

    await waitFor(() => expect(zapytaniaHistorii.at(-1)).toBe("?ean=111&kod=MO2_936570"));
  });

  it("debounce (O-10b-1): trzynaście znaków to JEDNO zapytanie, nie trzynaście", async () => {
    zamockujApi();
    // `delay: null` wpisuje znaki bez odstępów, więc całe trzynaście mieści się w oknie
    // debounce'u — inaczej test mierzyłby szybkość maszyny, a nie zachowanie hooka.
    const uzytkownik = await otworzZakladkeCen({ delay: null });
    await screen.findByTestId("tabela-ceny-historia");

    await uzytkownik.type(screen.getByTestId("input-historia-ean"), "8903635000259");
    await screen.findByText("MO2_30800800AL-IN");
    // Cisza dłuższa niż `OPOZNIENIE_MS` — gdyby coś jeszcze czekało w kolejce, doleci tutaj.
    await odczekaj(OPOZNIENIE_MS + 200);

    // Oryginał wysłałby trzynaście zapytań — po jednym na znak — do trasy bez LIMIT-u.
    expect(zapytaniaHistorii).toEqual(["?ean=8903635000259&kod="]);
  });

  it("NIE renderuje `stats`, choć odpowiedź je niesie (decyzja D4)", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-historia");
    await uzytkownik.type(screen.getByTestId("input-historia-ean"), "111");
    await waitFor(() => expect(zapytaniaHistorii.length).toBeGreaterThan(0));

    // `stats.max` z nagrania to 27230 — gdyby ktoś dorobił kafle min/max/śr., ta liczba
    // pojawiłaby się w dokumencie. Oryginał jej nie pokazuje, więc my też nie.
    expect(screen.queryByText(/27\s?230/)).not.toBeInTheDocument();
  });
});

describe("4. Filtry globalne", () => {
  it("zawężają obie tabele czytane klientem i mówią, czego karta nie stosuje", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-ostatni-import");

    await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
    await uzytkownik.click(await screen.findByRole("option", { name: "MO2" }));

    // Nagranie `last-import` ma jeden wiersz MO2 i cztery MO5.
    await waitFor(() =>
      expect(screen.getByTestId("ceny-ostatni-import-licznik")).toHaveTextContent(
        "Filtry ukryły 4 z 5 wierszy.",
      ),
    );
    const tabela = screen.getByTestId("tabela-ceny-ostatni-import");
    expect(within(tabela).queryByText("MO5_OZRR420710708ARO0")).not.toBeInTheDocument();
  });

  it("wypisuje wymiary, na które karty cen nie mają jak odpowiedzieć", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-inflacja");

    await uzytkownik.click(screen.getByTestId("filtr-marki"));
    // Lista marek w nagraniu filtrów to rozmiary opon — bierzemy pierwszą wartość, jaka
    // w niej realnie jest, zamiast wymyślać własną.
    await uzytkownik.click(await screen.findByRole("option", { name: "11.2R32" }));

    await waitFor(() =>
      expect(screen.getByTestId("ceny-inflacja-pominiete")).toHaveTextContent("Marki"),
    );
  });
});

describe("5. Wykres inflacji (O-10b-2)", () => {
  it("nie rysuje linii przez jeden punkt — nagranie ma tylko jeden miesiąc", async () => {
    zamockujApi();
    await otworzZakladkeCen();
    await screen.findByTestId("tabela-ceny-inflacja");

    // Wszystkie pięć nagranych wierszy jest z `2026-08`. Szeregu czasowego tu nie ma,
    // więc karta pokazuje samą tabelę — dokładnie tak, jak wygląda cały oryginał.
    expect(screen.queryByTestId("ceny-wykres-podpis")).not.toBeInTheDocument();
  });

  it("rysuje wykres razem z tabelą, gdy miesięcy jest więcej niż jeden", async () => {
    zamockujApi({ inflacja: inflacjaZDwomaMiesiacami() });
    await otworzZakladkeCen();

    // Tabela pod wykresem jest obowiązkowa (reguła z `components/ui/chart.tsx`) —
    // sprawdzamy oba, nigdy sam wykres.
    expect(await screen.findByTestId("ceny-wykres-podpis")).toBeInTheDocument();
    expect(screen.getByTestId("tabela-ceny-inflacja")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Wykres liniowy: średnia cena zakupu/ }),
    ).toBeInTheDocument();
  });

  it("ogranicza się do czterech serii i mówi, że reszta jest w tabeli", async () => {
    // Nagranie ma pięciu dostawców; `MAX_SERII` to cztery.
    zamockujApi({ inflacja: inflacjaZDwomaMiesiacami() });
    await otworzZakladkeCen();

    expect(await screen.findByTestId("ceny-wykres-podpis")).toHaveTextContent(
      "4 dostawców o najdłuższej historii; pozostali są w tabeli poniżej.",
    );
  });

  it("gdy filtr wyklucza wszystkich dostawców z wykresu, kieruje do tabeli zamiast pustego płótna", async () => {
    zamockujApi({ inflacja: inflacjaZDwomaMiesiacami() });
    const uzytkownik = await otworzZakladkeCen();
    await screen.findByTestId("ceny-wykres-podpis");

    // MO4 ma jeden miesiąc, więc jako jedyny wypada z czwórki serii — ale jego wiersz
    // zostaje w tabeli i to tam kieruje notka.
    await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
    await uzytkownik.click(await screen.findByRole("option", { name: "MO4" }));

    await waitFor(() => expect(screen.getByTestId("ceny-wykres-brak")).toBeInTheDocument());
    expect(screen.queryByTestId("ceny-wykres-podpis")).not.toBeInTheDocument();
  });
});
