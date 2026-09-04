/**
 * Ścieżka „Selly nieskonfigurowane” — odstępstwo D4 sesji 8b.
 *
 * Bez sekretów `SELLY_*` sześć tras rozmawiających z API Selly.pl oddaje **500**
 * z komunikatem `[Selly] Brak konfiguracji: …`. To zachowanie 1:1 z produkcją
 * (plan 8a, D6), NIE awaria do naprawienia w backendzie.
 *
 * Oryginalny panel wyrzuca w tym miejscu surowy `JSON.stringify` odpowiedzi. Odbudowa
 * rozpoznaje TEN JEDEN komunikat i pokazuje czytelny stan — ale każdy inny błąd nadal
 * leci surowo. Kontrtest niżej pilnuje, żeby rozpoznawanie nie zrobiło się zachłanne:
 * dopasowanie po treści komunikatu jest kruche z natury, więc musi mieć obie strony.
 */
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { czyBrakKonfiguracjiSelly } from "@/pages/selly/api";
import {
  TOKEN_TESTOWY,
  logSellyZFixtura,
  statusCsvZFixtura,
  statusDostawcowZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const CSV = statusCsvZFixtura();
const DOSTAWCY = statusDostawcowZFixtura();
const LOG = logSellyZFixtura();

/** Dosłowny komunikat backendu 8a przy komplecie brakujących sekretów. */
const KOMUNIKAT_BRAKU =
  "[Selly] Brak konfiguracji: SELLY_SHOP_URL / SELLY_CLIENT_ID / SELLY_CLIENT_SECRET";

/**
 * `ping` jest jedyną z czterech tras GET panelu, która rozmawia z Selly — pozostałe trzy
 * (`csv-status`, `status`, `log`) czytają lokalny SQLite/plik i działają bez sekretów.
 * Dlatego tylko ona dostaje tu 500.
 */
function zamockujBezKonfiguracji(trescBledu: string) {
  server.use(
    http.get("*/api/selly/ping", () =>
      HttpResponse.text(trescBledu, { status: 500 }),
    ),
    http.get("*/api/selly/csv-status", () => HttpResponse.json(CSV)),
    http.get("*/api/selly/status", () => HttpResponse.json({ items: DOSTAWCY })),
    http.get("*/api/selly/log", () => HttpResponse.json({ items: LOG })),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzSelly() {
  window.history.pushState({}, "", "/selly");
  render(<App />);
  await screen.findByTestId("selly-sekcja-polaczenie");
}

beforeEach(() => {
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("rozpoznawanie komunikatu", () => {
  it("łapie komunikat backendu niezależnie od listy brakujących zmiennych", () => {
    // `rzucGdyBlad` skleja `"<status>: <treść>"`, więc prefiks siedzi w ŚRODKU tekstu.
    expect(czyBrakKonfiguracjiSelly(new Error(`500: ${KOMUNIKAT_BRAKU}`))).toBe(true);
    expect(
      czyBrakKonfiguracjiSelly(new Error("500: [Selly] Brak konfiguracji: SELLY_CLIENT_ID")),
    ).toBe(true);
  });

  it("NIE łapie innych błędów", () => {
    expect(czyBrakKonfiguracjiSelly(new Error("500: [Selly] HTTP 401 z API"))).toBe(false);
    expect(czyBrakKonfiguracjiSelly(new Error("503: Service Unavailable"))).toBe(false);
    expect(czyBrakKonfiguracjiSelly("[Selly] Brak konfiguracji: X")).toBe(false);
    expect(czyBrakKonfiguracjiSelly(null)).toBe(false);
  });
});

describe("panel przy braku sekretów SELLY_*", () => {
  it("pokazuje „Selly nieskonfigurowane” zamiast surowego 500", async () => {
    zamockujBezKonfiguracji(KOMUNIKAT_BRAKU);
    await otworzSelly();

    const komunikat = await screen.findByTestId("selly-nieskonfigurowane");
    expect(komunikat).toHaveTextContent("Selly nieskonfigurowane");
    expect(komunikat).toHaveTextContent("SELLY_SHOP_URL");
    // Surowa treść błędu NIE ma się pojawić w tej gałęzi.
    expect(screen.queryByTestId("selly-blad")).toBeNull();
  });

  it("sekcje lokalne działają dalej — brak sekretów ich nie dotyczy", async () => {
    zamockujBezKonfiguracji(KOMUNIKAT_BRAKU);
    await otworzSelly();

    // `csv-status`, `status` i `log` czytają lokalny SQLite/plik, więc panel nie jest
    // „cały zepsuty” — to rozróżnienie jest właśnie powodem, dla którego D4 ma sens.
    const tabela = await screen.findByTestId("selly-tabela-csv");
    expect(tabela).toHaveTextContent((CSV.wiersze as number).toLocaleString("pl-PL"));
    expect(await screen.findByTestId("selly-tabela-status")).toHaveTextContent("MO1");
  });
});

describe("panel przy INNYM błędzie serwera", () => {
  it("pokazuje surową treść, jak oryginał (kontrtest do D4)", async () => {
    zamockujBezKonfiguracji("[Selly] HTTP 401 z API — token odrzucony");
    await otworzSelly();

    const blad = await screen.findByTestId("selly-blad");
    expect(blad).toHaveTextContent("HTTP 401 z API");
    expect(screen.queryByTestId("selly-nieskonfigurowane")).toBeNull();
  });
});
