/**
 * Przyciski „CSV” w widoku `/analityka` — blok 10f.
 *
 * Sprawdzamy dwie rzeczy, których nie sprawdzi żaden test backendu:
 *  1. że przycisk stoi w KAŻDEJ z dziesięciu kart, które mają go w oryginale — i tylko tam;
 *  2. że klik prowadzi do NAWIGACJI pod goły adres eksportu, bez query stringu.
 *
 * ⚠ PUNKT 2 JEST TU NAJWAŻNIEJSZY. Oryginał robi `window.location.href = …`
 * (`frontend-index.js:27938-27940`), więc żądanie nie niesie nagłówka `Authorization`
 * i uwierzytelnia się samym cookie'em `bridge_session`. Gdyby ktoś przepisał to na `fetch`,
 * ten test zapali — a bez niego zmiana przeszłaby cicho i padła dopiero na stagingu.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { adresEksportu } from "@/pages/analityka/eksport";
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

// Ten sam powód co w testach 10d/10e: chunk `/analityka` ciągnie Recharts.
vi.setConfig({ testTimeout: 20_000 });

const UZYTKOWNIK = uzytkownikZFixtura();

/** Zakładka → widoki eksportu, które mają w niej przycisk (kolejność kart z oryginału). */
const KARTY_Z_CSV = {
  "tab-dostawcy": ["suppliers-stability", "suppliers-lifecycle", "suppliers-stock"],
  "tab-ean": ["ean-comparison", "unique"],
  "tab-ceny": ["prices-last"],
  "tab-dostepnosc": ["availability-products", "sell-through"],
  "tab-marza": ["margins", "rotation-inactive"],
} as const;

function zamockujApi() {
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
    http.get("*/api/analytics/prices/last-import", () => HttpResponse.json({ rows: [] })),
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
      HttpResponse.json(dostepnoscProduktowZFixtura()),
    ),
    http.get("*/api/analytics/availability/sell-through", () =>
      HttpResponse.json(tempoSchodzeniaZFixtura()),
    ),
    http.get("*/api/analytics/seasonality/monthly", () => HttpResponse.json(sezonowoscZFixtura())),
    http.get("*/api/analytics/lifecycle/models", () => HttpResponse.json(cyklZyciaModeliZFixtura())),
    http.get("*/api/analytics/rotation/inactive", () => HttpResponse.json(rotacjaZFixtura())),
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
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
});

describe("adresEksportu — port M() (:27938-27940)", () => {
  it("buduje goły adres, BEZ query stringu z filtrami", () => {
    expect(adresEksportu("margins")).toBe("/api/analytics/export/margins");
    expect(adresEksportu("rotation-inactive")).toBe("/api/analytics/export/rotation-inactive");
    // Oryginał nie dokleja ani filtrów globalnych, ani `?days` — eksport to inny zbiór wierszy.
    expect(adresEksportu("rotation-inactive")).not.toContain("?");
  });
});

describe("przycisk „CSV” stoi w każdej karcie, która ma go w oryginale", () => {
  for (const [zakladka, widoki] of Object.entries(KARTY_Z_CSV)) {
    it(`${zakladka}: ${widoki.join(", ")}`, async () => {
      zamockujApi();
      await otworzZakladke(zakladka);

      for (const widok of widoki) {
        const przycisk = await screen.findByTestId(`csv-${widok}`);
        expect(przycisk.textContent, widok).toBe("CSV");
      }
    });
  }

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

describe("klik to NAWIGACJA przeglądarki, nie fetch", () => {
  it("ustawia window.location.href na adres eksportu", async () => {
    zamockujApi();
    const uzytkownik = await otworzZakladke("tab-marza");

    // `window.location` w jsdomie jest tylko do odczytu — podmieniamy sam obiekt na atrapę,
    // żeby dało się sprawdzić, co dostał `href`, bez prawdziwej nawigacji.
    const oryginalna = window.location;
    const atrapa = { ...oryginalna, href: "" } as unknown as Location;
    Object.defineProperty(window, "location", { value: atrapa, writable: true });

    try {
      await uzytkownik.click(await screen.findByTestId("csv-margins"));
      expect(atrapa.href).toBe("/api/analytics/export/margins");
    } finally {
      Object.defineProperty(window, "location", { value: oryginalna, writable: true });
    }
  });
});
