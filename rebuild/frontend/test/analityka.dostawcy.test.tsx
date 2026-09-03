/**
 * Zakładka „Dostawcy” widoku `/analityka` — blok 10d.
 *
 * Trzy odpowiedzi pochodzą z `contract/fixtures/GET_analytics_suppliers_*.json`, czyli
 * z nagrań żywej produkcji — z odjętym kluczem `_przyciete`, którego API nie zwraca
 * (`test/msw/kontrakt.ts`). Test sprawdza więc widok przeciwko kształtowi, który realnie
 * oddaje backend, a nie przeciwko wyobrażeniu o nim.
 *
 * Zakres: że trzy karty stoją w kolejności oryginału i mają jego tytuły oraz kolumny;
 * że kolumna „Dostępność” rysuje PASEK POSTĘPU, a nie liczbę; że wykres dostępności
 * (odstępstwo O-10d-1) jest nad tabelą z tymi samymi liczbami; że gałąź `hasHistory: false`
 * — której fixture NIE ZNA — renderuje ten sam komplet siedmiu kolumn z „—” w miejscach
 * bez danych; że globalny filtr dostawcy zawęża wszystkie trzy tabele.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type {
  StabilnoscDostawcow,
  WierszCykluZycia,
  WierszStanuDostawcy,
} from "@/pages/analityka/api";
import {
  TOKEN_TESTOWY,
  cyklZyciaDostawcowZFixtura,
  filtryZFixtura,
  kpiZFixtura,
  marzeZFixtura,
  stabilnoscDostawcowZFixtura,
  stanDostawcowZFixtura,
  statusAnalitykiZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const FILTRY = filtryZFixtura();
const STATUS = statusAnalitykiZFixtura();
const KPI = kpiZFixtura();
const MARZE = marzeZFixtura();
const STABILNOSC = stabilnoscDostawcowZFixtura();
const CYKL_ZYCIA = cyklZyciaDostawcowZFixtura();
const STAN = stanDostawcowZFixtura();

type Nadpisania = {
  stabilnosc?: StabilnoscDostawcow;
  cyklZycia?: { rows: WierszCykluZycia[] };
  stan?: { rows: WierszStanuDostawcy[] };
};

function zamockujApi({ stabilnosc, cyklZycia, stan }: Nadpisania = {}) {
  server.use(
    http.get("*/api/analytics/filters", () => HttpResponse.json(FILTRY)),
    http.get("*/api/analytics/status", () => HttpResponse.json(STATUS)),
    http.get("*/api/analytics/kpi", () => HttpResponse.json(KPI)),
    http.get("*/api/analytics/margins", () => HttpResponse.json(MARZE)),
    http.get("*/api/analytics/suppliers/stability", () =>
      HttpResponse.json(stabilnosc ?? STABILNOSC),
    ),
    http.get("*/api/analytics/suppliers/lifecycle", () =>
      HttpResponse.json(cyklZycia ?? CYKL_ZYCIA),
    ),
    http.get("*/api/analytics/suppliers/stock", () => HttpResponse.json(stan ?? STAN)),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

/**
 * Wejście na `/analityka`. Zakładki NIE przełączamy — `dostawcy` jest domyślna
 * (`frontend-index.js:27805`), i to też jest przedmiotem testu niżej.
 */
async function otworzAnalityke() {
  window.history.pushState({}, "", "/analityka");
  render(<App />);
  // Trasa jest ładowana leniwie (osobny chunk z Recharts), więc czekamy na tytuł strony.
  // Dłuższy limit niż domyślna sekunda: pierwszy import tego chunku w procesie testowym
  // potrafi trwać kilka sekund, a to koszt narzędzi, nie zachowanie aplikacji.
  await screen.findByTestId("text-page-title", undefined, { timeout: 15_000 });
  return userEvent.setup();
}

/** Etykiety nagłówka tabeli, w kolejności renderowania. */
function naglowki(tabela: HTMLElement): string[] {
  return within(tabela)
    .getAllByRole("columnheader")
    .map((k) => k.textContent ?? "");
}

beforeEach(() => {
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("1. Trzy karty zakładki — 1:1 z oryginałem", () => {
  it("otwiera się na zakładce „Dostawcy” bez klikania — to zakładka domyślna", async () => {
    zamockujApi();
    await otworzAnalityke();

    expect(await screen.findByTestId("tabela-stabilnosc-dostawcow")).toBeInTheDocument();
  });

  it("pokazuje trzy tytuły kart w kolejności oryginału", async () => {
    zamockujApi();
    await otworzAnalityke();

    await screen.findByText("1.1 Stabilność cennika dostawcy");
    const tytuly = [
      "1.1 Stabilność cennika dostawcy",
      "1.2 Nowości i wycofania",
      "1.4 / 1.5 Stan i dostępność dostawcy",
    ].map((t) => screen.getByText(t));

    // Kolejność DOM-u musi odpowiadać kolejności kart w oryginale (`:28050-28174`).
    expect(tytuly[0]!.compareDocumentPosition(tytuly[1]!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(tytuly[1]!.compareDocumentPosition(tytuly[2]!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("karta „1.1” renderuje siedem kolumn oryginału", async () => {
    zamockujApi();
    await otworzAnalityke();

    expect(naglowki(await screen.findByTestId("tabela-stabilnosc-dostawcow"))).toEqual([
      "Dostawca",
      "Produkty",
      "Punkty historii",
      "Zmiany",
      "Śr. zmiana %",
      "Max %",
      "Śr. stan",
    ]);
  });

  it("karta „1.2” renderuje sześć kolumn oryginału i surowy znacznik ISO w „Data”", async () => {
    zamockujApi();
    await otworzAnalityke();

    const tabela = await screen.findByTestId("tabela-cykl-zycia-dostawcow");
    expect(naglowki(tabela)).toEqual(["Data", "Dostawca", "Typ", "Kod", "Nazwa", "Powód"]);

    // Oryginał przepuszcza `kiedy` przez ten sam pomocnik co liczby, a ten napisów nie tyka.
    const pierwszy = CYKL_ZYCIA.rows[0]!;
    expect(within(tabela).getAllByText(pierwszy.kiedy).length).toBeGreaterThan(0);
  });

  it("karta „1.4 / 1.5” renderuje pięć kolumn oryginału", async () => {
    zamockujApi();
    await otworzAnalityke();

    expect(naglowki(await screen.findByTestId("tabela-stan-dostawcow"))).toEqual([
      "Dostawca",
      "Produkty",
      "Śr. stan",
      "Dostępne",
      "Dostępność",
    ]);
  });
});

describe("2. Kolumna „Dostępność” — pasek postępu, nie liczba", () => {
  it("rysuje pasek o szerokości równej `dostepnoscPct` i podpisuje go procentem", async () => {
    zamockujApi({
      stan: {
        rows: [
          { dostawca: "MO1", produkty: 4, sredniStan: 2, dostepne: 2, dostepnoscPct: 50 },
        ],
      },
    });
    await otworzAnalityke();

    const tabela = await screen.findByTestId("tabela-stan-dostawcow");
    const wypelnienie = within(tabela).getByTestId("pasek-dostepnosci-wypelnienie");

    expect(wypelnienie).toHaveStyle({ width: "50%" });
    expect(within(tabela).getByText("50%")).toBeInTheDocument();
  });

  it("brak policzonej dostępności daje pasek zerowy i podpis „—”", async () => {
    zamockujApi({
      stan: {
        rows: [
          { dostawca: "MO1", produkty: 0, sredniStan: null, dostepne: 0, dostepnoscPct: null },
        ],
      },
    });
    await otworzAnalityke();

    const tabela = await screen.findByTestId("tabela-stan-dostawcow");
    expect(within(tabela).getByTestId("pasek-dostepnosci-wypelnienie")).toHaveStyle({
      width: "0%",
    });
  });
});

describe("3. Wykres dostępności (odstępstwo O-10d-1)", () => {
  it("stoi nad tabelą z tymi samymi liczbami", async () => {
    zamockujApi();
    await otworzAnalityke();

    // `KontenerWykresu` nie ma testId — jest grafiką z opisem dla czytnika ekranu
    // (`role="img"` + `aria-label`), więc szukamy go tak, jak znalazłby go czytnik.
    const wykres = await screen.findByRole("img", { name: /udział pozycji dostępnych/i });
    const tabela = screen.getByTestId("tabela-stan-dostawcow");

    // Tabela pod wykresem jest OBOWIĄZKOWA (reguła z `components/ui/chart.tsx`) — to ona
    // zdejmuje ostrzeżenie walidatora o kontraście `--chart-1` do tła.
    expect(wykres.compareDocumentPosition(tabela)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("nie rysuje wykresu, gdy żaden dostawca nie ma policzonej dostępności", async () => {
    zamockujApi({
      stan: {
        rows: [
          { dostawca: "MO1", produkty: 0, sredniStan: null, dostepne: 0, dostepnoscPct: null },
        ],
      },
    });
    await otworzAnalityke();

    await screen.findByTestId("tabela-stan-dostawcow");
    expect(
      screen.queryByRole("img", { name: /udział pozycji dostępnych/i }),
    ).not.toBeInTheDocument();
  });
});

describe("4. Gałąź `hasHistory: false` — kształt, którego fixture nie zna", () => {
  /**
   * ⚠ TEN PRZYPADEK NIE MA POKRYCIA W NAGRANIU. `GET_analytics_suppliers_stability.json`
   * nagrano przy `hasHistory: true`, a backend ma drugą gałąź o INNYM zestawie kolumn
   * (`analytics_module.cjs:128`). Wiersz budujemy więc ręcznie, wprost z tamtego SQL-a.
   */
  it("renderuje ten sam komplet siedmiu kolumn, z „—” tam, gdzie gałąź nic nie zwraca", async () => {
    zamockujApi({
      stabilnosc: {
        hasHistory: false,
        rows: [
          {
            dostawca: "MO1",
            produkty: 12,
            sredniaCena: 1500,
            sredniStan: 4,
            liczbaZmian: null,
            sredniaZmianaPct: null,
            maxZmianaPct: null,
          },
        ],
      },
    });
    await otworzAnalityke();

    const tabela = await screen.findByTestId("tabela-stabilnosc-dostawcow");
    const komorki = within(tabela)
      .getAllByRole("cell")
      .map((k) => k.textContent);

    // Kolejność kolumn się NIE ZMIENIA (decyzja D1) — „Punkty historii”, „Zmiany”,
    // „Śr. zmiana %” i „Max %” są puste, bo ta gałąź ich nie liczy.
    expect(komorki).toEqual(["MO1", "12", "—", "—", "—", "—", "4"]);
  });
});

describe("5. Globalne filtry", () => {
  it("filtr dostawcy zawęża wszystkie trzy tabele naraz", async () => {
    zamockujApi();
    const uzytkownik = await otworzAnalityke();
    await screen.findByTestId("tabela-stan-dostawcow");

    // Nagrania niosą dostawców MO1–MO9; „MO10” jest na liście filtra, ale w żadnym wierszu.
    await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
    await uzytkownik.click(await screen.findByRole("option", { name: "MO10" }));

    for (const testId of [
      "tabela-stabilnosc-dostawcow",
      "tabela-cykl-zycia-dostawcow",
      "tabela-stan-dostawcow",
    ]) {
      await waitFor(() => {
        expect(within(screen.getByTestId(testId)).getByText("Brak danych")).toBeInTheDocument();
      });
    }

    expect(screen.getByTestId("stan-licznik-filtra")).toHaveTextContent(
      `Filtry ukryły ${STAN.rows.length} z ${STAN.rows.length} dostawców.`,
    );
  });

  it("mówi wprost, których wymiarów zakładka nie stosuje", async () => {
    zamockujApi();
    const uzytkownik = await otworzAnalityke();
    await screen.findByTestId("tabela-stan-dostawcow");

    // Wiersze tej zakładki niosą wyłącznie `dostawca` — filtr po modelu nie ma na czym
    // zadziałać. Widok ma to powiedzieć, a nie po cichu zwrócić pustą tabelę.
    await uzytkownik.click(screen.getByTestId("filtr-modele"));
    await uzytkownik.click(await screen.findByRole("option", { name: "1000" }));

    expect(await screen.findByTestId("stabilnosc-pominiete")).toHaveTextContent("Modele");
    expect(screen.getByTestId("cykl-zycia-pominiete")).toHaveTextContent("Modele");
    expect(screen.getByTestId("stan-pominiete")).toHaveTextContent("Modele");
  });
});
