/**
 * Widok `/analityka` — blok 10a.
 *
 * Wszystkie cztery odpowiedzi pochodzą z `contract/fixtures/GET_analytics_*.json`, czyli
 * z nagrań żywej produkcji — z odjętym kluczem `_przyciete`, którego API nie zwraca
 * (patrz `test/msw/kontrakt.ts`). Dzięki temu test sprawdza widok przeciwko kształtowi,
 * który realnie oddaje backend, a nie przeciwko wyobrażeniu o nim.
 *
 * Zakres: że szkielet jest 1:1 z oryginałem (pięć zakładek, ich kolejność i etykiety,
 * domyślna „Dostawcy"); że nagłówek pokazuje banner historii i cztery kafle KPI; że sekcja
 * marż renderuje kolumny oryginału; że globalne filtry zawężają tabelę i mówią wprost,
 * których wymiarów ta sekcja nie stosuje.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Marze } from "@/pages/analityka/api";
import {
  TOKEN_TESTOWY,
  cyklZyciaDostawcowZFixtura,
  filtryZFixtura,
  kpiZFixtura,
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

/**
 * ⚠ DWA LIMITY, NIE JEDEN. `findByTestId(..., { timeout })` czeka najwyżej tyle, ile pozwala
 * `testTimeout` vitest — a ten stoi domyślnie na 5 s (`vitest.config.ts` go nie podnosi).
 * Samo podniesienie limitu zapytania byłoby więc ochroną pozorną: test padłby wcześniej na
 * „Test timed out in 5000ms". Podnosimy oba, plikowo (nie globalnie), bo dotyczy to wyłącznie
 * widoków ładowanych leniwie: chunk `/analityka` ciągnie Recharts i jego pierwszy import
 * w jsdomie trwa ~1,5 s, a pod obciążeniem równoległej pracy kilku agentów na tej samej
 * maszynie — dłużej. To koszt narzędzi, nie zachowanie aplikacji.
 */
vi.setConfig({ testTimeout: 20_000 });

const UZYTKOWNIK = uzytkownikZFixtura();
const FILTRY = filtryZFixtura();
const STATUS = statusAnalitykiZFixtura();
const KPI = kpiZFixtura();
const MARZE = marzeZFixtura();
const STABILNOSC = stabilnoscDostawcowZFixtura();
const CYKL_ZYCIA = cyklZyciaDostawcowZFixtura();
const STAN = stanDostawcowZFixtura();

/**
 * Trzy trasy dostawców też muszą tu być, choć ten plik ich nie bada: zakładka `dostawcy`
 * jest DOMYŚLNA, więc mountuje się przy każdym wejściu na `/analityka` i wypuszcza swoje
 * zapytania. Bez handlerów `onUnhandledRequest: "error"` wywaliłby każdy test w tym pliku.
 * Zawartość tej zakładki bada `analityka.dostawcy.test.tsx` (blok 10d).
 */
function zamockujApi(marze: Marze = MARZE) {
  server.use(
    http.get("*/api/analytics/filters", () => HttpResponse.json(FILTRY)),
    http.get("*/api/analytics/status", () => HttpResponse.json(STATUS)),
    http.get("*/api/analytics/kpi", () => HttpResponse.json(KPI)),
    http.get("*/api/analytics/margins", () => HttpResponse.json(marze)),
    // Widok pobiera KOMPLET tras przy każdym wejściu, niezależnie od aktywnej zakładki,
    // więc bez tych handlerów `onUnhandledRequest: "error"` wywala test.
    // Trzy trasy dostawców (blok 10d):
    http.get("*/api/analytics/suppliers/stability", () => HttpResponse.json(STABILNOSC)),
    http.get("*/api/analytics/suppliers/lifecycle", () => HttpResponse.json(CYKL_ZYCIA)),
    http.get("*/api/analytics/suppliers/stock", () => HttpResponse.json(STAN)),
    // Cztery trasy EAN (blok 10c):
    http.get("*/api/analytics/ean/comparison", () => HttpResponse.json(porownanieEanZFixtura())),
    http.get("*/api/analytics/ean/unique", () => HttpResponse.json(unikalneEanZFixtura())),
    http.get("*/api/analytics/ean/coverage", () => HttpResponse.json(pokrycieEanZFixtura())),
    http.get("*/api/analytics/ean/supplier-rank", () => HttpResponse.json(rankingEanZFixtura())),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzAnalityke() {
  window.history.pushState({}, "", "/analityka");
  render(<App />);
  // Trasa jest ładowana leniwie (osobny chunk z Recharts), więc czekamy na tytuł strony.
  // Limit dłuższy niż domyślna sekunda — mieści się w podniesionym `testTimeout` wyżej.
  return await screen.findByTestId("text-page-title", undefined, { timeout: 15_000 });
}

/** Przejście na zakładkę „Marża i rotacja" — jedyną wypełnioną w bloku 10a. */
async function otworzZakladkeMarz() {
  const uzytkownik = userEvent.setup();
  await otworzAnalityke();
  await uzytkownik.click(await screen.findByTestId("tab-marza"));
  return uzytkownik;
}

beforeEach(() => {
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("1. Szkielet strony — 1:1 z oryginałem", () => {
  it("pokazuje tytuł i podtytuł z produkcji", async () => {
    zamockujApi();
    const tytul = await otworzAnalityke();

    expect(tytul).toHaveTextContent("Analityka");
    expect(
      screen.getByText("Dostawcy, porównanie EAN, ceny w czasie, dostępność, marża i rotacja"),
    ).toBeInTheDocument();
  });

  it("ma pięć zakładek w kolejności i z etykietami oryginału", async () => {
    zamockujApi();
    await otworzAnalityke();

    // `deminified/frontend-index.js:28034-28046` — kolejność jest częścią odbudowy,
    // bo bloki 10b–10e mają wstawiać treść w gotowe miejsca, a nie przestawiać zakładki.
    const etykiety = ["Dostawcy", "EAN i ceny", "Ceny w czasie", "Dostępność", "Marża i rotacja"];
    const zakladki = screen.getAllByRole("tab").map((z) => z.textContent);
    expect(zakladki).toEqual(etykiety);
  });

  it("otwiera się na zakładce „Dostawcy\", nie na marżach", async () => {
    zamockujApi();
    await otworzAnalityke();

    // `useState("dostawcy")` (`:27805`). Prompt bloku zakładał „Marże" jako domyślną —
    // oryginał mówi inaczej i to on rozstrzyga.
    expect(screen.getByTestId("tab-dostawcy")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("tab-marza")).toHaveAttribute("data-state", "inactive");
  });

  it("`/analityka` nie jest już widokiem w przygotowaniu", async () => {
    zamockujApi();
    await otworzAnalityke();
    expect(screen.queryByText(/Dashboardy EAN, cen, dostawców/)).not.toBeInTheDocument();
  });
});

describe("2. Nagłówek — banner historii i cztery kafle KPI", () => {
  it("pokazuje komunikat o zasięgu historii cen w brzmieniu oryginału", async () => {
    zamockujApi();
    await otworzAnalityke();

    // `:27922` — „Historia cen: N snapshotów od <znacznik ISO surowo>".
    const banner = await screen.findByTestId("banner-historia");
    expect(banner).toHaveTextContent(`Historia cen: ${STATUS.snapshots} snapshotów od`);
    expect(banner).toHaveTextContent(String(STATUS.od));
  });

  it("pokazuje komunikat o pustej historii, gdy `hasHistory` jest fałszem", async () => {
    zamockujApi();
    // Nadpisanie MUSI iść po `zamockujApi()` — MSW bierze ostatnio zarejestrowany handler.
    server.use(
      http.get("*/api/analytics/status", () =>
        HttpResponse.json({ hasHistory: false, snapshots: 0, od: null, do: null }),
      ),
    );
    await otworzAnalityke();

    expect(await screen.findByTestId("banner-historia")).toHaveTextContent(
      "Historia cen dopiero zacznie się zbierać po wdrożeniu",
    );
  });

  it("liczy cztery kafle z `GET /api/analytics/kpi` — odstępstwo O-10a-1", async () => {
    zamockujApi();
    await otworzAnalityke();

    expect(await screen.findByTestId("kpi-produkty")).toHaveTextContent(
      KPI.produkty.toLocaleString("pl-PL"),
    );
    expect(screen.getByTestId("kpi-dostawcy")).toHaveTextContent(String(KPI.dostawcy));
    expect(screen.getByTestId("kpi-marza")).toHaveTextContent(`${String(KPI.avgMarza)}%`);
    expect(screen.getByTestId("kpi-staging")).toHaveTextContent(
      KPI.stagingPending.toLocaleString("pl-PL"),
    );
  });

  it("pokazuje „—\" zamiast procentu, gdy średnia marża jest nullem (pusty katalog)", async () => {
    zamockujApi();
    server.use(
      http.get("*/api/analytics/kpi", () =>
        HttpResponse.json({ produkty: 0, dostawcy: 0, avgMarza: null, stagingPending: 0 }),
      ),
    );
    await otworzAnalityke();

    expect(await screen.findByTestId("kpi-marza")).toHaveTextContent("—");
  });
});

describe("3. Sekcja marż — dashboard-wzorzec", () => {
  it("renderuje siedem kolumn oryginału", async () => {
    zamockujApi();
    await otworzZakladkeMarz();

    const tabela = await screen.findByTestId("tabela-marze");
    const naglowki = within(tabela)
      .getAllByRole("columnheader")
      .map((k) => k.textContent);
    // `:28526-28558` — nazwy i kolejność 1:1.
    expect(naglowki).toEqual([
      "Dostawca",
      "Kategoria",
      "Marka",
      "Produkty",
      "Śr. marża",
      "Min",
      "Max",
    ]);
  });

  it("pokazuje wiersze z nagrania produkcji", async () => {
    zamockujApi();
    await otworzZakladkeMarz();

    const tabela = await screen.findByTestId("tabela-marze");
    const pierwszy = MARZE.rows[0]!;
    expect(within(tabela).getAllByRole("row")).toHaveLength(MARZE.rows.length + 1);
    expect(tabela).toHaveTextContent(pierwszy.dostawca);
    expect(tabela).toHaveTextContent(pierwszy.marka);
  });

  it("nie renderuje list `low`/`high`, choć przychodzą w odpowiedzi", async () => {
    // Produkcyjny frontend pobiera je i ignoruje — odtwarzamy to zachowanie.
    zamockujApi({
      ...MARZE,
      low: [
        {
          kod: "NISKA1",
          nazwa: "Opona o niskiej marży",
          dostawca: "MO1",
          cenaZakupu: 100,
          cenaSprzedazy: 102,
          marzaPct: 2,
        },
      ],
    });
    await otworzZakladkeMarz();

    await screen.findByTestId("tabela-marze");
    expect(screen.queryByText("NISKA1")).not.toBeInTheDocument();
  });

  it("renderuje najwyżej 300 wierszy i mówi, ile ucięto", async () => {
    // Limit jest z oryginału (`frontend-index.js:27953` — `e.slice(0, 300)`) i zostaje.
    // Stopka jest naszym dodatkiem: przy filtrach klienckich cichy limit wyglądałby
    // na zepsuty filtr (patrz raport.md, „Odstępstwa od planu" #3).
    const duzo: Marze["rows"] = Array.from({ length: 305 }, (_, i) => ({
      dostawca: `MO${i}`,
      kategoria: "Rolnicze",
      marka: `MARKA${i}`,
      produkty: 1,
      avgMarza: i,
      minMarza: i,
      maxMarza: i,
    }));
    zamockujApi({ rows: duzo, low: [], high: [] });
    await otworzZakladkeMarz();

    const tabela = await screen.findByTestId("tabela-marze");
    // 300 wierszy danych + wiersz nagłówka.
    expect(within(tabela).getAllByRole("row")).toHaveLength(301);
    expect(tabela).toHaveTextContent("Pokazano 300 z 305 wierszy");
    // Wiersz 301. istnieje w danych, ale nie trafia do DOM-u.
    expect(within(tabela).queryByText("MARKA300")).not.toBeInTheDocument();
  });

  it("nie pokazuje stopki o ucięciu, gdy wierszy jest mniej niż limit", async () => {
    zamockujApi();
    await otworzZakladkeMarz();

    const tabela = await screen.findByTestId("tabela-marze");
    expect(tabela).not.toHaveTextContent("Pokazano");
  });

  it("pokazuje komunikat pustej tabeli w brzmieniu oryginału", async () => {
    zamockujApi({ rows: [], low: [], high: [] });
    await otworzZakladkeMarz();

    expect(await screen.findByText("Brak danych")).toBeInTheDocument();
  });
});

describe("4. Filtry globalne", () => {
  it("renderuje sześć wyszukiwalnych kontrolek", async () => {
    zamockujApi();
    await otworzAnalityke();

    for (const wymiar of [
      "dostawcy",
      "marki",
      "modele",
      "rozmiary",
      "indeksyNosnosci",
      "indeksyPredkosci",
    ]) {
      expect(await screen.findByTestId(`filtr-${wymiar}`)).toBeInTheDocument();
    }
  });

  it("zawęża tabelę marż po wybranym dostawcy i mówi, ile grup ukryto", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladkeMarz();
    await screen.findByTestId("tabela-marze");

    await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
    // Fixture ma pięć grup marż, wszystkie od „MO1"; lista dostawców niesie też MO10 i MO2.
    await uzytkownik.click(await screen.findByRole("option", { name: "MO2" }));

    await waitFor(() => {
      const tabela = screen.getByTestId("tabela-marze");
      expect(within(tabela).getByText("Brak danych")).toBeInTheDocument();
    });
    expect(screen.getByTestId("marze-licznik-filtra")).toHaveTextContent(
      `Filtry ukryły ${MARZE.rows.length} z ${MARZE.rows.length} grup.`,
    );
  });

  it("mówi wprost, których wymiarów sekcja marż nie stosuje", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladkeMarz();
    await screen.findByTestId("tabela-marze");

    // Odpowiedź `margins` grupuje po dostawcy, kategorii i marce — modelu w wierszu NIE MA,
    // więc filtr po modelu nie ma na czym zadziałać. Widok ma to powiedzieć, a nie
    // po cichu zwrócić pustą tabelę.
    await uzytkownik.click(screen.getByTestId("filtr-modele"));
    await uzytkownik.click(await screen.findByRole("option", { name: "1000" }));

    expect(await screen.findByTestId("marze-pominiete")).toHaveTextContent("Modele");
  });

  it("wyszukiwarka zawęża listę opcji", async () => {
    zamockujApi();
    const uzytkownik = userEvent.setup();
    await otworzAnalityke();

    await uzytkownik.click(await screen.findByTestId("filtr-dostawcy"));
    expect(await screen.findByRole("option", { name: "MO10" })).toBeInTheDocument();

    await uzytkownik.type(screen.getByTestId("filtr-dostawcy-szukaj"), "MO10");
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
    });
    expect(screen.getByRole("option", { name: "MO10" })).toBeInTheDocument();
  });

  it("„Wyczyść filtry\" wraca do pełnej tabeli", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladkeMarz();
    await screen.findByTestId("tabela-marze");

    await uzytkownik.click(screen.getByTestId("filtr-dostawcy"));
    await uzytkownik.click(await screen.findByRole("option", { name: "MO2" }));
    await screen.findByTestId("marze-licznik-filtra");

    await uzytkownik.keyboard("{Escape}");
    await uzytkownik.click(screen.getByTestId("filtry-wyczysc"));

    await waitFor(() => {
      expect(screen.queryByTestId("marze-licznik-filtra")).not.toBeInTheDocument();
    });
    expect(within(screen.getByTestId("tabela-marze")).getAllByRole("row")).toHaveLength(
      MARZE.rows.length + 1,
    );
  });
});
