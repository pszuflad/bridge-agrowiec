/**
 * Widok `/analityka` — blok 10e (dostępność, rotacja, cykl życia).
 *
 * Wszystkie odpowiedzi pochodzą z `contract/fixtures/GET_analytics_*.json` — z odjętym
 * kluczem `_przyciete`, którego API nie zwraca (`test/msw/kontrakt.ts`).
 *
 * Zakres: że zakładka „Dostępność” niesie trzy karty w kolejności oryginału; że zakładka
 * „Marża i rotacja” ma marże z 10a NA GÓRZE, a rotację i cykl życia POD nimi; że kolumny
 * są 1:1 z produkcją; że pole „Bez ruchu dni” trafia do zapytania jako `?days` — bo to
 * jedyny filtr serwerowy całej analityki.
 *
 * ⚠ DWIE KARTY ZAKŁADKI „DOSTĘPNOŚĆ” POKAZUJĄ „BRAK DANYCH” I TAK MA BYĆ. Nagrania
 * `availability/products` i `availability/sell-through` mają `hasHistory: true` i `rows: []`,
 * bo zapytania obu tras pytają `historia_cen` o nieistniejącą kolumnę `nazwa`. Test to
 * ZAMRAŻA — gdyby kiedyś zaczęły zwracać wiersze, znaczyłoby to, że ktoś zmienił zachowanie
 * produkcji i musi to być świadoma decyzja. Uzasadnienie: `repos/analityka.ts`,
 * nagłówek `bezpiecznieWiersze`.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Dostepnosc } from "@/pages/analityka/api";
import {
  TOKEN_TESTOWY,
  cyklZyciaDostawcowZFixtura,
  cyklZyciaModeliZFixtura,
  dostepnoscProduktowZFixtura,
  filtryZFixtura,
  kpiZFixtura,
  marzeZFixtura,
  pokrycieEanZFixtura,
  porownanieEanZFixtura,
  rankingEanZFixtura,
  rotacjaZFixtura,
  sezonowoscZFixtura,
  stabilnoscDostawcowZFixtura,
  stanDostawcowZFixtura,
  statusAnalitykiZFixtura,
  tempoSchodzeniaZFixtura,
  unikalneEanZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

/**
 * ⚠ DWA LIMITY, NIE JEDEN — konwencja z `analityka.test.tsx` (blok 10d). Chunk `/analityka`
 * ciągnie Recharts i jego pierwszy import w jsdomie trwa ~1,5 s, a pod obciążeniem dłużej;
 * samo podniesienie limitu zapytania nie wystarczy, bo test padłby wcześniej na `testTimeout`.
 */
vi.setConfig({ testTimeout: 20_000 });

const UZYTKOWNIK = uzytkownikZFixtura();
const SEZONOWOSC = sezonowoscZFixtura();
const CYKL_ZYCIA = cyklZyciaModeliZFixtura();

/** Adresy `?days=…`, pod które widok realnie poszedł — dowód, że filtr jest serwerowy. */
let zapytaniaRotacji: string[] = [];

function zamockujApi(dostepnosc: Dostepnosc = dostepnoscProduktowZFixtura()) {
  server.use(
    http.get("*/api/analytics/filters", () => HttpResponse.json(filtryZFixtura())),
    http.get("*/api/analytics/status", () => HttpResponse.json(statusAnalitykiZFixtura())),
    http.get("*/api/analytics/kpi", () => HttpResponse.json(kpiZFixtura())),
    http.get("*/api/analytics/margins", () => HttpResponse.json(marzeZFixtura())),
    // Widok pobiera KOMPLET tras przy każdym wejściu, niezależnie od aktywnej zakładki —
    // bez handlerów bloków 10c i 10d `onUnhandledRequest: "error"` wywaliłby każdy test.
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
    http.get("*/api/analytics/availability/products", () => HttpResponse.json(dostepnosc)),
    http.get("*/api/analytics/availability/sell-through", () =>
      HttpResponse.json(tempoSchodzeniaZFixtura()),
    ),
    http.get("*/api/analytics/seasonality/monthly", () => HttpResponse.json(SEZONOWOSC)),
    http.get("*/api/analytics/lifecycle/models", () => HttpResponse.json(CYKL_ZYCIA)),
    http.get("*/api/analytics/rotation/inactive", ({ request }) => {
      zapytaniaRotacji.push(new URL(request.url).searchParams.get("days") ?? "");
      return HttpResponse.json(rotacjaZFixtura());
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzZakladke(testId: string) {
  const uzytkownik = userEvent.setup();
  window.history.pushState({}, "", "/analityka");
  render(<App />);
  // Limit dłuższy niż domyślna sekunda — mieści się w podniesionym `testTimeout` wyżej.
  await screen.findByTestId("text-page-title", undefined, { timeout: 15_000 });
  await uzytkownik.click(await screen.findByTestId(testId));
  return uzytkownik;
}

beforeEach(() => {
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zapytaniaRotacji = [];
  zasiejSesje();
});

describe("1. Zakładka „Dostępność” — trzy karty w kolejności oryginału", () => {
  it("pokazuje nagłówki 4.1, 4.2 i 4.4 w kolejności z produkcji", async () => {
    zamockujApi();
    await otworzZakladke("tab-dostepnosc");

    // Numeracja jest z oryginału i ma luki („4.3”, „4.5” są w innych zakładkach).
    const naglowki = await screen.findAllByText(/^4\.\d /);
    expect(naglowki.map((n) => n.textContent)).toEqual([
      "4.1 Historia dostępności pozycji",
      "4.2 Tempo schodzenia z magazynu",
      "4.4 Sezonowy wzorzec cen",
    ]);
  });

  it("karta 4.1 ma sześć kolumn oryginału", async () => {
    zamockujApi();
    await otworzZakladke("tab-dostepnosc");

    const tabela = await screen.findByTestId("tabela-dostepnosc-produktow");
    expect(within(tabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "Dostawca",
      "Kod",
      "EAN",
      "Nazwa",
      "Dostępność",
      "Miesiące braków",
    ]);
  });

  it("karta 4.2 ma cztery kolumny oryginału", async () => {
    zamockujApi();
    await otworzZakladke("tab-dostepnosc");

    const tabela = await screen.findByTestId("tabela-tempo-schodzenia");
    expect(within(tabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "Dostawca",
      "Kod",
      "Nazwa",
      "Zeszło sztuk",
    ]);
  });

  it("CHARAKTERYZACJA: obie karty dostępności są puste, dokładnie jak w produkcji", async () => {
    zamockujApi();
    await otworzZakladke("tab-dostepnosc");

    const produkty = await screen.findByTestId("tabela-dostepnosc-produktow");
    const tempo = await screen.findByTestId("tabela-tempo-schodzenia");
    expect(within(produkty).getByText("Brak danych")).toBeInTheDocument();
    expect(within(tempo).getByText("Brak danych")).toBeInTheDocument();
  });

  it("kolumna „Dostępność” rysuje pasek postępu, gdy wiersze są", async () => {
    // Nagranie produkcji jest puste (patrz nagłówek pliku), więc wiersz do sprawdzenia
    // kolumny budujemy z kształtu udowodnionego testem jednostkowym backendu.
    zamockujApi({
      hasHistory: true,
      rows: [
        {
          kod: "MO1_100",
          ean: "5901234123457",
          dostawca: "MO1",
          nazwa: "Opona testowa",
          snapshoty: 4,
          dostepnoscPct: 25,
          miesiaceBrakow: "2026-07,2026-08",
        },
      ],
    });
    await otworzZakladke("tab-dostepnosc");

    const tabela = await screen.findByTestId("tabela-dostepnosc-produktow");
    expect(within(tabela).getByText("25%")).toBeInTheDocument();
    expect(within(tabela).getByTestId("pasek-dostepnosci-wypelnienie")).toHaveStyle({
      width: "25%",
    });
  });

  it("karta 4.4 renderuje nagrane wiersze i dokłada wykres nad tabelą", async () => {
    zamockujApi();
    await otworzZakladke("tab-dostepnosc");

    const tabela = await screen.findByTestId("tabela-sezonowosc");
    expect(within(tabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "Miesiąc",
      "Marka",
      "Śr. cena",
      "Dostępność",
    ]);
    expect(within(tabela).getAllByRole("row")).toHaveLength(SEZONOWOSC.rows.length + 1);
    // Wykres to odstępstwo O-10e-1; nagranie ma dwa miesiące, więc linia ma co narysować.
    expect(screen.getByTestId("wykres-sezonowosc")).toBeInTheDocument();
  });
});

describe("2. Zakładka „Marża i rotacja” — dokładki 10e POD kartą z 10a", () => {
  it("niesie trzy karty: marże, rotację, cykl życia — w tej kolejności", async () => {
    zamockujApi();
    await otworzZakladke("tab-marza");

    await screen.findByTestId("tabela-marze");
    const tabele = screen
      .getAllByTestId(/^tabela-(marze|rotacja|cykl-zycia)$/)
      .map((t) => t.getAttribute("data-testid"));
    expect(tabele).toEqual(["tabela-marze", "tabela-rotacja", "tabela-cykl-zycia"]);
  });

  it("nie rusza karty marż z bloku 10a — siedem kolumn zostaje", async () => {
    zamockujApi();
    await otworzZakladke("tab-marza");

    const tabela = await screen.findByTestId("tabela-marze");
    expect(within(tabela).getAllByRole("columnheader")).toHaveLength(7);
  });

  it("karta rotacji ma pięć kolumn oryginału, z datą na pierwszym miejscu", async () => {
    zamockujApi();
    await otworzZakladke("tab-marza");

    const tabela = await screen.findByTestId("tabela-rotacja");
    expect(within(tabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "Ostatnia aktualizacja",
      "Dostawca",
      "Kod",
      "Nazwa",
      "Stan",
    ]);
  });

  it("karta cyklu życia ma pięć kolumn oryginału i renderuje nagrane modele", async () => {
    zamockujApi();
    await otworzZakladke("tab-marza");

    const tabela = await screen.findByTestId("tabela-cykl-zycia");
    expect(within(tabela).getAllByRole("columnheader").map((k) => k.textContent)).toEqual([
      "Marka",
      "Model",
      "Pierwszy raz",
      "Ostatni raz",
      "Produkty",
    ]);
    expect(within(tabela).getAllByRole("row")).toHaveLength(CYKL_ZYCIA.rows.length + 1);
  });
});

describe("3. „Bez ruchu dni” — jedyny filtr serwerowy analityki", () => {
  it("startuje z wartością 60 i pyta backend o `?days=60`", async () => {
    zamockujApi();
    await otworzZakladke("tab-marza");

    expect(await screen.findByTestId("pole-dni-rotacji")).toHaveValue("60");
    await waitFor(() => expect(zapytaniaRotacji).toContain("60"));
  });

  it("zmiana wartości idzie do zapytania, a nie do filtrowania klienckiego", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-marza");

    const pole = await screen.findByTestId("pole-dni-rotacji");
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, "365");

    // Klucz zapytania niesie pełny adres w JEDNYM segmencie — inaczej `queryKey.join("/")`
    // wstawiłby ukośnik przed znakiem zapytania (`api.ts`, `useRotacjeNieaktywnych`).
    await waitFor(() => expect(zapytaniaRotacji).toContain("365"));
  });

  it("wpisana wartość przeżywa przejście na inną zakładkę i z powrotem", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-marza");

    const pole = await screen.findByTestId("pole-dni-rotacji");
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, "365");
    await waitFor(() => expect(zapytaniaRotacji).toContain("365"));

    // `Tabs.Content` bez `forceMount` ODMONTOWUJE nieaktywną zakładkę, więc stan trzymany
    // w samej sekcji wracałby tu do „60". Oryginał trzyma go w komponencie widoku
    // (`frontend-index.js:27805`) i my tak samo — ten test tego pilnuje.
    await uzytkownik.click(await screen.findByTestId("tab-dostepnosc"));
    await screen.findByTestId("tabela-sezonowosc");
    await uzytkownik.click(await screen.findByTestId("tab-marza"));

    expect(await screen.findByTestId("pole-dni-rotacji")).toHaveValue("365");
  });
});
