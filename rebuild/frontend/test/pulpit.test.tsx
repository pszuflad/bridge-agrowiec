/**
 * Widok Pulpitu `/` — blok 10f (ostatni placeholder Iteracji 10).
 *
 * Dane idą z `contract/fixtures/` przez loadery w `test/msw/kontrakt.ts`, więc test pracuje
 * na kształtach, które produkcja realnie zwraca.
 *
 * ⚠ CO TEN PLIK PILNUJE:
 *  1. kafel „Ostatni eksport CSV" pokazuje PRAWDZIWĄ datę z `GET /api/history/paged` —
 *     świadome odstępstwo, #34, decyzja Ani 2026-09-21 (w produkcji kafel jest martwy; do
 *     ticketu 96 ten plik to zamrażał jako decyzję D3);
 *  2. brak wpisów w Historii (dzisiejszy staging bez eksportów) i błąd zapytania NIE wywracają
 *     Pulpitu — widok renderuje się w całości;
 *  3. karty „Najnowsze powiadomienia" NIE MA WCALE, gdy nie ma alertów do pokazania
 *     (`o.length > 0 && …` w oryginale), zamiast pustej karty z komunikatem.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Alert } from "@/pages/alerty/api";
import { policzAlertyKatalogu } from "@/pages/alerty/silnik-katalogu";
import {
  TOKEN_TESTOWY,
  alertyZFixtura,
  dostawcyZFixtura,
  produktyZFixtura,
  stronaHistoriiZFixtura,
  stronaStaginguZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const PRODUKTY = produktyZFixtura();
const DOSTAWCY = dostawcyZFixtura();
/** `GET /api/staging` bez parametrów oddaje GOŁĄ TABLICĘ — bierzemy same `items` nagrania. */
const STAGING = stronaStaginguZFixtura().items;

/**
 * Produkty z fixture'a (MO9, `dataAktualizacji` 2026-08-04) dają pseudo-alert katalogowy
 * „Brak importu cennika" (P6.2), a jego `id` zależy od DZISIEJSZEJ daty (liczba dni jest
 * odciskiem). Testy sekcji o alertach importu dostają go więc domyślnie jako ROZWIĄZANY —
 * identyfikatory liczy sam silnik, więc nie zależą od dnia uruchomienia. Testy sekcji
 * „Katalog" (blok 6) podają statusy wprost.
 */
function katalogowePrzykryte(): Record<string, unknown>[] {
  return policzAlertyKatalogu(PRODUKTY, new Map()).map((a) => ({
    id: a.id,
    status: "rozwiazany",
    kto: null,
    kiedy: "2026-09-21T00:00:00.000Z",
  }));
}

/**
 * Wpis Historii danego typu — kształt wzięty z nagrania `GET_history_paged.json` (tam same
 * edycje), nadpisany polami eksportu/importu. `kiedy` jest starsze niż tydzień, więc
 * `sformatujWzglednie` daje samą datę — test nie zależy od godziny uruchomienia.
 */
function wpisHistorii(pola: Record<string, unknown>): Record<string, unknown> {
  return { ...stronaHistoriiZFixtura().items[0]!, kodProduktu: null, zmienionePola: [], ...pola };
}

const EKSPORT = wpisHistorii({
  id: 901,
  typ: "eksport",
  kiedy: "2026-07-27T10:27:14.329Z",
  dostawca: "MO3",
  liczbaPozycji: 42,
  format: "csv",
  uwagi: "Format: csv",
});

const IMPORT = wpisHistorii({
  id: 902,
  typ: "import",
  kiedy: "2026-07-20T10:00:00.000Z",
  dostawca: "MO1",
  liczbaPozycji: 1500,
  format: null,
  uwagi: "Plik: cennik.xlsx",
});

/** Data, jaką kafel narysuje dla wpisu starszego niż tydzień (`toLocaleDateString("pl-PL")`). */
function dataKafla(kiedy: unknown): string {
  return new Date(String(kiedy)).toLocaleDateString("pl-PL");
}

type Historia = { eksport: Record<string, unknown>[]; import: Record<string, unknown>[] } | "blad";

type Opcje = {
  alerty?: Alert[];
  historia?: Historia;
  statusyKatalogu?: Record<string, unknown>[];
};

function zamockujApi({
  alerty = alertyZFixtura(),
  historia = { eksport: [EKSPORT], import: [IMPORT] },
  statusyKatalogu = katalogowePrzykryte(),
}: Opcje = {}) {
  server.use(
    http.get("*/api/products", () => HttpResponse.json(PRODUKTY)),
    http.get("*/api/staging", () => HttpResponse.json(STAGING)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    // Handler pilnuje adresu: kafel ma pytać o JEDEN najnowszy wpis danego typu. Inny adres
    // dostaje 400, więc pomyłka w parametrach wywali asercję na treść, a nie przejdzie cicho.
    http.get("*/api/history/paged", ({ request }) => {
      const q = new URL(request.url).searchParams;
      const typ = q.get("typ");
      if ((typ !== "eksport" && typ !== "import") || q.get("limit") !== "1" || q.get("page") !== "1") {
        return HttpResponse.json({ error: "nieoczekiwany adres" }, { status: 400 });
      }
      if (historia === "blad") return HttpResponse.json({ error: "boom" }, { status: 500 });
      const items = historia[typ];
      return HttpResponse.json({ items, total: items.length, pages: 1, page: 1, limit: 1 });
    }),
    http.get("*/api/alerts", () => HttpResponse.json(alerty)),
    http.get("*/api/alerty-katalogu/statusy", () => HttpResponse.json(statusyKatalogu)),
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
   * Świadome odstępstwo, #34, decyzja Ani 2026-09-21 — do ticketu 96 ten test zamrażał kafel
   * jako trwale martwy („—" mimo danych, decyzja D3). Teraz ma pokazywać datę eksportu.
   */
  it("kafel „Ostatni eksport CSV” pokazuje datę i podpis ostatniego eksportu (#34)", async () => {
    zamockujApi();
    await otworzPulpit();

    await waitFor(() =>
      expect(screen.getByTestId("kpi-export-value").textContent).toBe(dataKafla(EKSPORT.kiedy)),
    );
    expect(screen.getByText("MO3 — 42 produktów")).toBeTruthy();
    // Import jest, ale przy istniejącym eksporcie do podpisu nie wchodzi — kolejność z `N2`.
    expect(screen.queryByText(/Ostatni import/)).toBeNull();
  });

  /**
   * `staleTime: Infinity` klienta trzymałby odpowiedź z pierwszego wejścia — eksport zrobiony
   * w katalogu nie pojawiłby się po powrocie na Pulpit. `refetchOnMount: "always"` (D5).
   */
  it("powrót na Pulpit pobiera świeży stan — eksport zrobiony w międzyczasie jest widoczny", async () => {
    zamockujApi({ historia: { eksport: [], import: [] } });
    await otworzPulpit();
    await waitFor(() => expect(screen.getByText("Brak eksportów ani importów")).toBeTruthy());
    cleanup();

    zamockujApi();
    await otworzPulpit();
    await waitFor(() => expect(screen.getByText("MO3 — 42 produktów")).toBeTruthy());
  });

  it("tylko import → „—” i „Ostatni import: <data>”", async () => {
    zamockujApi({ historia: { eksport: [], import: [IMPORT] } });
    await otworzPulpit();

    await waitFor(() =>
      expect(screen.getByText(`Ostatni import: ${dataKafla(IMPORT.kiedy)}`)).toBeTruthy(),
    );
    expect(screen.getByTestId("kpi-export-value").textContent).toBe("—");
  });
});

describe("3. Historia bez eksportów i importów albo z błędem nie wywraca Pulpitu", () => {
  it("brak wpisów obu typów → dotychczasowy pusty stan, widok w całości", async () => {
    zamockujApi({ historia: { eksport: [], import: [] } });
    await otworzPulpit();

    await waitFor(() => expect(screen.getByText("Brak eksportów ani importów")).toBeTruthy());
    expect(screen.getByTestId("kpi-export-value").textContent).toBe("—");
    expect(screen.getByTestId("kpi-products")).toBeTruthy();
    expect(screen.getByTestId("tabela-dostawcow-pulpit")).toBeTruthy();
    expect(screen.queryByText(/błąd/i)).toBeNull();
  });

  it("500 z `/api/history/paged` → podpis o błędzie, reszta Pulpitu stoi", async () => {
    zamockujApi({ historia: "blad" });
    await otworzPulpit();

    await waitFor(() =>
      expect(screen.getByText("Nie udało się pobrać historii")).toBeTruthy(),
    );
    expect(screen.getByTestId("kpi-export-value").textContent).toBe("—");
    expect(screen.queryByText("Brak eksportów ani importów")).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("kpi-products-value").textContent).toBe(String(PRODUKTY.length)),
    );
    expect(screen.getByTestId("tabela-dostawcow-pulpit")).toBeTruthy();
  });

  it("Pulpit nie woła już gołego `GET /api/history`", async () => {
    const adresy: string[] = [];
    server.events.on("request:start", ({ request }) => {
      adresy.push(new URL(request.url).pathname);
    });
    zamockujApi();
    await otworzPulpit();
    await waitFor(() => expect(screen.getByText("MO3 — 42 produktów")).toBeTruthy());
    server.events.removeAllListeners("request:start");

    expect(adresy).toContain("/api/history/paged");
    expect(adresy).not.toContain("/api/history");
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

/**
 * Karta P6.2 (decyzja 3 z 2026-09-21): Pulpit pokazuje OBA źródła alertów — import
 * i pseudo-alerty katalogowe liczone z `/api/products` — z podziałem na dwie sekcje.
 * Produkty z fixture'a dają dokładnie jeden pseudo-alert: „Brak importu cennika" dla MO9
 * (krytyczny, bo 2026-08-04 jest dawniej niż 30 dni przed dzisiejszą datą uruchomienia).
 */
describe("6. Pulpit a pseudo-alerty katalogowe (P6.2)", () => {
  const ALERT_IMPORTU: Alert = {
    id: 11,
    poziom: "ostrzezenie",
    typ: "Błąd pobierania",
    opis: "timeout",
    dostawca: "MO2",
    status: "nowy",
    data: "2026-09-02T10:00:00.000Z",
  };
  const idKatalogowego = () => policzAlertyKatalogu(PRODUKTY, new Map())[0]!.id;

  it("wyliczony pseudo-alert jest dokładnie jeden i dotyczy MO9 (założenie tego bloku)", () => {
    const alerty = policzAlertyKatalogu(PRODUKTY, new Map());
    expect(alerty.map((a) => [a.typ, a.poziom, a.dostawca])).toEqual([
      ["Brak importu cennika", "krytyczny", "MO9"],
    ]);
  });

  it("kafel sumuje `nowy` z obu źródeł; „krytycznych” liczone łącznie", async () => {
    zamockujApi({ alerty: [ALERT_IMPORTU], statusyKatalogu: [] });
    await otworzPulpit();

    await waitFor(() => expect(screen.getByTestId("kpi-alerts-value").textContent).toBe("2"));
    expect(screen.getByText("1 krytycznych")).toBeTruthy();
  });

  it("karta ma dwie sekcje; wiersze linkują do właściwej zakładki /alerty", async () => {
    zamockujApi({ alerty: [ALERT_IMPORTU], statusyKatalogu: [] });
    await otworzPulpit();

    const karta = await screen.findByTestId("card-recent-alerts");
    const importu = within(karta).getByTestId("section-recent-alerts-import");
    const katalogu = within(karta).getByTestId("section-recent-alerts-katalog");
    expect(within(importu).getByText("Import")).toBeTruthy();
    expect(within(katalogu).getByText("Katalog")).toBeTruthy();

    const wierszImportu = within(importu).getByTestId(`row-dashboard-alert-${ALERT_IMPORTU.id}`);
    const wierszKatalogu = within(katalogu).getByTestId(`row-dashboard-catalog-alert-${idKatalogowego()}`);
    expect(wierszImportu.closest("a")!.getAttribute("href")).toBe("/alerty");
    expect(wierszKatalogu.closest("a")!.getAttribute("href")).toBe("/alerty?zakladka=katalog");
    expect(within(wierszKatalogu).getByText("Brak importu cennika")).toBeTruthy();
    expect(screen.getByText("2 aktywnych alertów łącznie")).toBeTruthy();
  });

  it("gdy są TYLKO pseudo-alerty, karta jest, a sekcji importu nie ma", async () => {
    zamockujApi({ alerty: [], statusyKatalogu: [] });
    await otworzPulpit();

    const karta = await screen.findByTestId("card-recent-alerts");
    expect(within(karta).queryByTestId("section-recent-alerts-import")).toBeNull();
    expect(within(karta).getByTestId("section-recent-alerts-katalog")).toBeTruthy();
  });

  it("przejrzany pseudo-alert znika z Pulpitu (łatka ackalerts pkt 2)", async () => {
    zamockujApi({
      alerty: [],
      statusyKatalogu: [{ id: idKatalogowego(), status: "przejrzany", kto: null, kiedy: "2026-09-21T10:00:00.000Z" }],
    });
    await otworzPulpit();

    await waitFor(() => expect(screen.getByTestId("kpi-alerts-value").textContent).toBe("0"));
    expect(screen.queryByTestId("card-recent-alerts")).toBeNull();
  });

  it("gdy statusy padną, sekcja „Katalog” mówi to wprost zamiast udawać zero alertów", async () => {
    zamockujApi({ alerty: [] });
    server.use(
      http.get("*/api/alerty-katalogu/statusy", () => new HttpResponse("Baza zablokowana", { status: 500 })),
    );
    await otworzPulpit();

    const katalogu = await screen.findByTestId("section-recent-alerts-katalog");
    expect(within(katalogu).getByRole("alert")).toHaveTextContent("Nie udało się policzyć alertów katalogu.");
  });

  it("zmiana statusu odświeża Pulpit przez unieważnienie zapytania (łatka ackalerts pkt 3)", async () => {
    zamockujApi({ alerty: [], statusyKatalogu: [] });
    await otworzPulpit();
    await waitFor(() => expect(screen.getByTestId("kpi-alerts-value").textContent).toBe("1"));

    server.use(
      http.get("*/api/alerty-katalogu/statusy", () =>
        HttpResponse.json([{ id: idKatalogowego(), status: "rozwiazany", kto: "Ania", kiedy: "2026-09-21T10:00:00.000Z" }]),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ["/api/alerty-katalogu/statusy"] });

    await waitFor(() => expect(screen.getByTestId("kpi-alerts-value").textContent).toBe("0"));
  });
});
