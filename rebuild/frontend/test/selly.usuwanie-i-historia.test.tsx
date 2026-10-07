/**
 * Ticket 194 — karta „Usuwanie z Selly" i rozbudowana „Historia operacji" na `/selly`.
 *
 * Zakres: że stan Toru 3 jest zawsze widoczny (także gdy nic nie usuwa), że filtr grup woła API z `grupa`,
 * że szczegóły wpisu pokazują PRZYCZYNY błędów (kolejka do utworzenia ≠ odmowa zabezpieczenia ≠ inne),
 * oraz że uszkodzony JSON ze starych wpisów nie wywraca widoku.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { StatusUsuwania, WpisLogu } from "@/pages/selly/api";
import {
  TOKEN_TESTOWY,
  pingSellyZFixtura,
  statusCsvZFixtura,
  statusDostawcowZFixtura,
  statusUsuwaniaTestowy,
  stronaUsunietychTestowa,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();

let zapytaniaLogu: string[] = [];

const wpis = (id: number, nad: Partial<WpisLogu>): WpisLogu => ({
  id,
  operacja: "sync_delta",
  dostawca_kod: "MO5",
  liczba_ok: 0,
  liczba_blad: 0,
  liczba_skip: 0,
  szczegoly_json: null,
  uzytkownik_id: null,
  uzytkownik_imie: null,
  rozpoczeto: "2026-10-06 10:55:48",
  zakonczono: "2026-10-06 10:55:50",
  status: "zakonczono",
  ...nad,
});

function zamockuj(opcje: { status?: StatusUsuwania; log?: (grupa: string | null) => WpisLogu[] } = {}) {
  server.use(
    http.get("*/api/selly/usuwanie-status", () => HttpResponse.json(opcje.status ?? statusUsuwaniaTestowy())),
    http.get("*/api/selly/usuniete", () => HttpResponse.json(stronaUsunietychTestowa())),
    http.get("*/api/selly/ping", () => HttpResponse.json(pingSellyZFixtura())),
    http.get("*/api/selly/csv-status", () => HttpResponse.json(statusCsvZFixtura())),
    http.get("*/api/selly/status", () => HttpResponse.json({ items: statusDostawcowZFixtura() })),
    http.get("*/api/selly/log", ({ request }) => {
      zapytaniaLogu.push(new URL(request.url).search);
      const grupa = new URL(request.url).searchParams.get("grupa");
      return HttpResponse.json({ items: opcje.log ? opcje.log(grupa) : [] });
    }),
  );
}

async function otworzSelly() {
  window.history.pushState({}, "", "/selly");
  render(<App />);
  await screen.findByTestId("selly-tabela-status");
  await waitFor(() => expect(screen.queryAllByText("Ładowanie...")).toHaveLength(0));
}

beforeEach(() => {
  zapytaniaLogu = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
});

describe("karta „Usuwanie z Selly”", () => {
  it("bez sierot: pokazuje, że Tor 3 DZIAŁA i nie ma czego usuwać (a nie pustkę)", async () => {
    zamockuj();
    await otworzSelly();

    const karta = await screen.findByTestId("selly-sekcja-usuwanie");
    await within(karta).findByTestId("selly-usuwanie-tresc");
    expect(within(karta).getByTestId("selly-usuwanie-wynik")).toHaveTextContent("Działa — nie ma czego usuwać");
    expect(within(karta).getByTestId("selly-usuwanie-kiedy")).toHaveTextContent("ostatni przebieg:");
    expect(within(karta).getByTestId("selly-usuwanie-sieroty")).toHaveTextContent("0");
    expect(within(karta).getByTestId("selly-usuwanie-doba")).toHaveTextContent("0 z limitu 200");
    expect(within(karta).getByTestId("selly-usuwanie-ostatnie")).toHaveTextContent("jeszcze nic nie usunięto");
    expect(within(karta).getByTestId("selly-usuwanie-proba")).toHaveTextContent("jest");
  });

  it("po usunięciu: licznik, limit i ostatnie usunięcie (kod, nazwa)", async () => {
    zamockuj({
      status: statusUsuwaniaTestowy({
        ostatni_przebieg: { kiedy: "2026-10-06T10:55:30.000Z", wynik: "usunieto", opis: "Usunięto 2 z 5 sierot", sieroty: 5, usuniete: 2 },
        sierot_teraz: 3,
        usuniec_24h: 2,
        ostatnie_usuniecie: { kiedy: "2026-10-06T10:55:31.000Z", kod: "MO1_STARY", nazwa: "Opona STARA" },
      }),
    });
    await otworzSelly();

    const karta = await screen.findByTestId("selly-sekcja-usuwanie");
    await within(karta).findByTestId("selly-usuwanie-tresc");
    expect(within(karta).getByTestId("selly-usuwanie-wynik")).toHaveTextContent("usunięto produkty");
    expect(within(karta).getByTestId("selly-usuwanie-sieroty")).toHaveTextContent("3");
    expect(within(karta).getByTestId("selly-usuwanie-doba")).toHaveTextContent("2 z limitu 200");
    expect(within(karta).getByTestId("selly-usuwanie-ostatnie")).toHaveTextContent("MO1_STARY — Opona STARA");
  });

  it("wyłączone: podaje powody (nie udaje, że działa)", async () => {
    zamockuj({
      status: statusUsuwaniaTestowy({
        wlaczone: false,
        powody_wylaczenia: ["harmonogram Selly wyłączony (SELLY_SCHEDULER) — nic nie uruchamia przebiegów"],
        ostatni_przebieg: null,
      }),
    });
    await otworzSelly();

    const karta = await screen.findByTestId("selly-sekcja-usuwanie");
    await within(karta).findByTestId("selly-usuwanie-tresc");
    expect(within(karta).getByTestId("selly-usuwanie-wynik")).toHaveTextContent("Wyłączone");
    expect(within(karta).getByTestId("selly-usuwanie-powody")).toHaveTextContent("SELLY_SCHEDULER");
  });

  it("włączone, ale jeszcze bez przebiegu po starcie serwera: „czeka na pierwszy przebieg”", async () => {
    zamockuj({ status: statusUsuwaniaTestowy({ ostatni_przebieg: null, proba_uprawnien: null }) });
    await otworzSelly();

    const karta = await screen.findByTestId("selly-sekcja-usuwanie");
    await within(karta).findByTestId("selly-usuwanie-tresc");
    expect(within(karta).getByTestId("selly-usuwanie-wynik")).toHaveTextContent("Czeka na pierwszy przebieg");
    expect(within(karta).getByTestId("selly-usuwanie-proba")).toHaveTextContent("jeszcze niesprawdzone");
  });

  it("brak uprawnień do usuwania w Selly jest widoczny (czerwona etykieta)", async () => {
    zamockuj({
      status: statusUsuwaniaTestowy({
        proba_uprawnien: "brak",
        ostatni_przebieg: { kiedy: "2026-10-06T10:55:30.000Z", wynik: "brak_uprawnien", opis: "API Selly nie ma prawa usuwania (DELETE → 401/403) — nic nie usuwam" },
      }),
    });
    await otworzSelly();

    const karta = await screen.findByTestId("selly-sekcja-usuwanie");
    await within(karta).findByTestId("selly-usuwanie-tresc");
    expect(within(karta).getByTestId("selly-usuwanie-wynik")).toHaveTextContent("Brak uprawnień do usuwania w Selly");
    expect(within(karta).getByTestId("selly-usuwanie-proba")).toHaveTextContent("brak");
  });
});

describe("„Historia operacji” — filtr, więcej wpisów, szczegóły", () => {
  it("domyślnie pobiera 100 wpisów bez filtra grupy; filtr „Usuwanie z Selly” woła API z `grupa=usuwanie`", async () => {
    const uzytkownik = userEvent.setup();
    zamockuj({
      log: (grupa) =>
        grupa === "usuwanie"
          ? [wpis(900, { operacja: "sync_delete", dostawca_kod: "ALL", liczba_ok: 2 })]
          : [wpis(1, {}), wpis(2, { dostawca_kod: "MO4" })],
    });
    await otworzSelly();
    await waitFor(() => expect(zapytaniaLogu).toContain("?limit=100"));

    await uzytkownik.click(screen.getByTestId("selly-log-filtr-usuwanie"));

    await waitFor(() => expect(zapytaniaLogu).toContain("?limit=100&grupa=usuwanie"));
    const tabela = screen.getByTestId("selly-tabela-log");
    await within(tabela).findByText("sync_delete");
    expect(within(tabela).queryByText("sync_delta")).toBeNull();
  });

  it("pusty filtr usuwania tłumaczy, czemu nie ma wpisów (cichy przebieg) i odsyła do karty stanu", async () => {
    const uzytkownik = userEvent.setup();
    zamockuj({ log: (grupa) => (grupa === "usuwanie" ? [] : [wpis(1, {})]) });
    await otworzSelly();

    await uzytkownik.click(screen.getByTestId("selly-log-filtr-usuwanie"));

    expect(await screen.findByTestId("selly-log-pusty")).toHaveTextContent("nie zostawia wpisu");
  });

  it("„Pokaż więcej” odsłania starsze wpisy po 25", async () => {
    const uzytkownik = userEvent.setup();
    zamockuj({ log: () => Array.from({ length: 60 }, (_, i) => wpis(i + 1, { dostawca_kod: `MO${i}` })) });
    await otworzSelly();

    const tabela = screen.getByTestId("selly-tabela-log");
    await waitFor(() => expect(within(tabela).queryAllByTestId(/selly-log-wiersz-/)).toHaveLength(25));
    await uzytkownik.click(screen.getByTestId("selly-log-wiecej"));
    expect(within(tabela).queryAllByTestId(/selly-log-wiersz-/)).toHaveLength(50);
    await uzytkownik.click(screen.getByTestId("selly-log-wiecej"));
    expect(within(tabela).queryAllByTestId(/selly-log-wiersz-/)).toHaveLength(60);
    expect(screen.queryByTestId("selly-log-wiecej")).toBeNull();
  });

  it("szczegóły błędów synchronizacji: rodzaje z wyjaśnieniem i próbka z komunikatami", async () => {
    const uzytkownik = userEvent.setup();
    zamockuj({
      log: () => [
        wpis(7, {
          liczba_ok: 9,
          liczba_blad: 22,
          szczegoly_json: JSON.stringify({
            stats: { total: 31, ok: 9, err: 22, skip: 0 },
            kolizje: [],
            bledy_wg_rodzaju: { pending_create: 20, tozsamosc: 1, inne: 1 },
            sample_errors: [
              { kod: "MO5_X1", error: "[Selly] HTTP 500", rodzaj: "inne" },
              { kod: "MO5_X2", error: "Selly: wariant ma inny magazyn niż oferta Bridge — zapis zablokowany", rodzaj: "tozsamosc" },
              { kod: "MO5_X3", error: "produkt nie istnieje w Selly ale brak dictMaps do createProduct", rodzaj: "pending_create" },
            ],
          }),
        }),
      ],
    });
    await otworzSelly();

    await uzytkownik.click(await screen.findByTestId("selly-log-szczegoly-7"));

    const rozwiniecie = await screen.findByTestId("selly-log-rozwiniecie-7");
    const rodzaje = within(rozwiniecie).getByTestId("selly-log-rodzaje");
    expect(rodzaje).toHaveTextContent("Czekają na utworzenie w Selly: 20");
    expect(rodzaje).toHaveTextContent("To kolejka, nie awaria");
    expect(rodzaje).toHaveTextContent("Zapis zablokowany zabezpieczeniem: 1");
    expect(rodzaje).toHaveTextContent("Inne błędy: 1");
    const probka = within(rozwiniecie).getByTestId("selly-log-probka");
    expect(probka).toHaveTextContent("MO5_X1");
    expect(probka).toHaveTextContent("[Selly] HTTP 500");
    expect(within(rozwiniecie).getByText(/Przykładowe błędy \(3 z 22\)/)).toBeInTheDocument();

    // Ponowne kliknięcie zwija.
    await uzytkownik.click(screen.getByTestId("selly-log-szczegoly-7"));
    expect(screen.queryByTestId("selly-log-rozwiniecie-7")).toBeNull();
  });

  it("szczegóły usunięcia: kod, nazwa i akcja każdego produktu", async () => {
    const uzytkownik = userEvent.setup();
    zamockuj({
      log: () => [
        wpis(8, {
          operacja: "sync_delete",
          dostawca_kod: "ALL",
          liczba_ok: 1,
          szczegoly_json: JSON.stringify({
            sieroty: 1,
            wpisy: [{ kod: "MO1_STARY", nazwa: "Opona STARA", akcja: "usunieto_produkt" }],
          }),
        }),
      ],
    });
    await otworzSelly();

    await uzytkownik.click(await screen.findByTestId("selly-log-szczegoly-8"));

    const usuwanie = await screen.findByTestId("selly-log-usuwanie");
    expect(usuwanie).toHaveTextContent("MO1_STARY — Opona STARA: usunięto produkt");
  });

  it("stary, ucięty JSON: komunikat zamiast wyjątku, reszta strony działa", async () => {
    const uzytkownik = userEvent.setup();
    zamockuj({
      log: () => [wpis(9, { liczba_blad: 3, szczegoly_json: '{"stats":{"ok":1},"sample_errors":[{"kod":"A","error":"abc' })],
    });
    await otworzSelly();

    await uzytkownik.click(await screen.findByTestId("selly-log-szczegoly-9"));

    expect(await screen.findByTestId("selly-log-rozwiniecie-9")).toHaveTextContent("niekompletne");
    expect(screen.getByTestId("selly-sekcja-usuwanie")).toBeInTheDocument();
  });

  it("godzina jest w czasie lokalnym; `title` niesie surowe UTC", async () => {
    zamockuj({ log: () => [wpis(10, { rozpoczeto: "2026-10-06 10:56:06" })] });
    await otworzSelly();

    const komorka = (await screen.findByTestId("selly-log-wiersz-10")).querySelector("td");
    expect(komorka).toHaveAttribute("title", "UTC: 2026-10-06 10:56:06");
    expect(komorka?.textContent).toBe(
      new Date(Date.UTC(2026, 9, 6, 10, 56, 6)).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "medium" }),
    );
  });
});
