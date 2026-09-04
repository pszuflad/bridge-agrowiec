/**
 * GATE sesji 8b — widok `/selly` konsumuje KSZTAŁTY, które produkcja realnie oddaje.
 *
 * Odpowiedzi MSW budujemy Z FIXTURES (`test/msw/kontrakt.ts`), nie z wyobraźni: zmiana
 * kształtu nagrania ma wywalić ten plik. Cztery pliki, bo tyle tras GET woła żywy panel:
 * `_ping`, `_csv-status`, `_status`, `_log`. Piąty nagrany (`_dictionaries`) jest poza
 * zakresem — trasa nie ma konsumenta w UI (decyzja D1).
 *
 * ⚠ Pułapka (b) z bloku 10a: pusta tablica po KTÓREJKOLWIEK stronie przechodzi porównanie
 * kształtu bez dowodu. Dlatego każdy test tabeli asertuje NIEPUSTĄ zawartość i konkretne
 * wartości z nagrania (`MO1`/`634`, `6898`, `2.38 MB`), a nie samo „wyrenderowało się”.
 */
import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import {
  TOKEN_TESTOWY,
  logSellyZFixtura,
  pingSellyZFixtura,
  statusCsvZFixtura,
  statusDostawcowZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const PING = pingSellyZFixtura();
const CSV = statusCsvZFixtura();
const DOSTAWCY = statusDostawcowZFixtura();
const LOG = logSellyZFixtura();

function zamockujSelly() {
  server.use(
    http.get("*/api/selly/ping", () => HttpResponse.json(PING)),
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
  return await screen.findByTestId("text-page-title");
}

beforeEach(() => {
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("GATE 8b — nagrania z produkcji są niepuste", () => {
  it("cztery fixture'y niosą dane, więc jest czym dowodzić kształtu", () => {
    expect(DOSTAWCY.length).toBeGreaterThan(0);
    expect(LOG.length).toBeGreaterThan(0);
    expect(PING.shop).toBeTruthy();
    expect(CSV.wiersze).toBeGreaterThan(0);
  });
});

describe("GATE 8b — widok konsumuje kształty z fixtures", () => {
  it("`/selly` jest wpięta w router (nie leci w NotFound)", async () => {
    zamockujSelly();
    const tytul = await otworzSelly();
    expect(tytul).toHaveTextContent("Integracja Selly.pl");
  });

  it("`GET_selly_ping` — sklep, prefiks tokenu i sonda VAT trafiają na ekran", async () => {
    zamockujSelly();
    await otworzSelly();

    const sekcja = await screen.findByTestId("selly-ping");
    expect(sekcja).toHaveTextContent(PING.shop);
    expect(sekcja).toHaveTextContent(PING.token_prefix);
    expect(sekcja).toHaveTextContent(PING.vat_probe);
    expect(sekcja).toHaveTextContent(String(PING.expires_in_seconds));
  });

  it("`GET_selly_csv-status` — liczba wierszy i rozmiar w formacie oryginału", async () => {
    zamockujSelly();
    await otworzSelly();

    const tabela = await screen.findByTestId("selly-tabela-csv");
    // 6898 → „6 898” (pl-PL, spacja niełamliwa) i 2.38 → „2.38 MB”.
    expect(tabela).toHaveTextContent((CSV.wiersze as number).toLocaleString("pl-PL"));
    expect(tabela).toHaveTextContent(`${CSV.rozmiar_mb} MB`);
    expect(tabela).toHaveTextContent(CSV.status);
  });

  it("`GET_selly_csv-status` — link do pliku jest NAWIGACJĄ, nie fetchem", async () => {
    zamockujSelly();
    await otworzSelly();

    const link = await screen.findByTestId("selly-link-csv");
    // Eksport działa na cookie `bridge_session`, nie na nagłówku Authorization —
    // zamiana na fetch + blob zmieniłaby sposób autoryzacji żądania.
    expect(link).toHaveAttribute("href", CSV.url as string);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("`GET_selly_status` — każdy nagrany dostawca ma wiersz z licznikami", async () => {
    zamockujSelly();
    await otworzSelly();

    const tabela = await screen.findByTestId("selly-tabela-status");
    const wiersze = within(tabela).getAllByRole("row");
    // Nagłówek + jeden wiersz na dostawcę.
    expect(wiersze).toHaveLength(DOSTAWCY.length + 1);

    const pierwszy = DOSTAWCY[0]!;
    expect(tabela).toHaveTextContent(pierwszy.dostawca);
    expect(tabela).toHaveTextContent(String(pierwszy.w_bridge));
  });

  it("`GET_selly_log` — wpisy z kluczami snake_case renderują się w tabeli", async () => {
    zamockujSelly();
    await otworzSelly();

    const tabela = await screen.findByTestId("selly-tabela-log");
    const wiersze = within(tabela).getAllByRole("row");
    expect(wiersze).toHaveLength(LOG.length + 1);

    const pierwszy = LOG[0]!;
    expect(tabela).toHaveTextContent(pierwszy.operacja);
    expect(tabela).toHaveTextContent(pierwszy.dostawca_kod as string);
    expect(tabela).toHaveTextContent(String(pierwszy.liczba_ok));
    // Data cięta ze stringa, nie parsowana — „2026-07-06 07:43:36”.
    expect(tabela).toHaveTextContent(pierwszy.rozpoczeto.slice(0, 19).replace("T", " "));
  });

  it("pole `_przyciete` z nagrania nie przecieka do widoku", async () => {
    zamockujSelly();
    await otworzSelly();

    const tabela = await screen.findByTestId("selly-tabela-status");
    expect(tabela).not.toHaveTextContent("_przyciete");
  });
});
