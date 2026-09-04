/**
 * Zachowanie panelu `/selly` — sesja 8b.
 *
 * Zakres: że panel ma PIĘĆ sekcji żywego oryginału, że ciała żądań zgadzają się
 * z `selly-injection.js` co do pola, i że dwa świadome odstępstwa działają:
 *  - D3 — potwierdzenie przed PEŁNYM syncem, z OBU wejść (przycisk sekcji i „Sync”
 *    w wierszu tabeli mapowania); dry-run leci bez pytania,
 *  - D5 — lista dostawców pochodzi z `GET /api/selly/status`, a nie z zahardkodowanej
 *    listy `MO1…MO10`.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

let syncy: Record<string, unknown>[] = [];
let generowania: number;

function zamockujSelly(nadpisania: { status?: typeof DOSTAWCY } = {}) {
  server.use(
    http.get("*/api/selly/ping", () => HttpResponse.json(PING)),
    http.get("*/api/selly/csv-status", () => HttpResponse.json(CSV)),
    http.get("*/api/selly/status", () =>
      HttpResponse.json({ items: nadpisania.status ?? DOSTAWCY }),
    ),
    http.get("*/api/selly/log", () => HttpResponse.json({ items: LOG })),
    http.post("*/api/selly/generate-csv", () => {
      generowania += 1;
      return HttpResponse.json({ ok: true, wiersze: 6898, rozmiar_mb: 2.38, czas_ms: 12400 });
    }),
    http.post("*/api/selly/sync-supplier", async ({ request }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      syncy.push(cialo);
      return HttpResponse.json({
        dostawca: cialo.dostawca,
        total: 5,
        created: 2,
        updated: 3,
        failed: 0,
        skipped: 0,
        dry_run: cialo.dry_run,
        errors: [],
      });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

/**
 * Czeka, aż zapytania panelu się rozstrzygną.
 *
 * ⚠ Sama obecność `selly-tabela-status` NIE wystarczy: tabela istnieje w DOM już podczas
 * ładowania (z wierszem „Ładowanie...”), więc asercje o dostawcach trafiały w stan sprzed
 * odpowiedzi. Czekamy więc na ZNIKNIĘCIE wierszy ładowania — działa tak samo dla `/status`
 * z danymi i dla pustego.
 */
async function otworzSelly() {
  window.history.pushState({}, "", "/selly");
  render(<App />);
  await screen.findByTestId("selly-tabela-status");
  await waitFor(() => expect(screen.queryAllByText("Ładowanie...")).toHaveLength(0));
}

beforeEach(() => {
  syncy = [];
  generowania = 0;
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("1. Panel ma pięć sekcji żywego oryginału", () => {
  it("renderuje wszystkie karty z ich nagłówkami", async () => {
    zamockujSelly();
    await otworzSelly();

    expect(screen.getByTestId("selly-sekcja-polaczenie")).toHaveTextContent(
      "Status połączenia",
    );
    expect(screen.getByTestId("selly-sekcja-csv")).toHaveTextContent(
      "Codzienna synchronizacja CSV",
    );
    expect(screen.getByTestId("selly-sekcja-mapowanie")).toHaveTextContent(
      "Mapowanie dostawców",
    );
    expect(screen.getByTestId("selly-sekcja-sync")).toHaveTextContent("Sync dostawcy");
    expect(screen.getByTestId("selly-sekcja-log")).toHaveTextContent("Historia operacji");
  });

  it("nie pokazuje UI dla czterech tras bez konsumenta (decyzja D1)", async () => {
    zamockujSelly();
    await otworzSelly();

    // Gdyby ktoś dorobił im ekran, `onUnhandledRequest:"error"` i tak wywaliłby test —
    // ale sprawdzamy też wprost, że nie ma po nich śladu w UI.
    expect(screen.queryByText(/słownik/i)).toBeNull();
    expect(screen.queryByText(/producen/i)).toBeNull();
  });
});

describe("2. Sync dostawcy — ciała żądań 1:1 z oryginałem", () => {
  it("dry-run wysyła limit 5 i NIE pyta o potwierdzenie", async () => {
    const uzytkownik = userEvent.setup();
    zamockujSelly();
    await otworzSelly();

    await uzytkownik.click(screen.getByTestId("selly-button-dryrun"));

    await waitFor(() => expect(syncy).toHaveLength(1));
    expect(syncy[0]).toEqual({
      dostawca: "MO1",
      dry_run: true,
      limit: 5,
      only_updated: false,
    });
    expect(screen.queryByTestId("selly-dialog-potwierdzenia")).toBeNull();
  });

  it("dry-run respektuje checkbox „tylko zmienione”", async () => {
    const uzytkownik = userEvent.setup();
    zamockujSelly();
    await otworzSelly();

    await uzytkownik.click(screen.getByTestId("selly-checkbox-tylko-zmienione"));
    await uzytkownik.click(screen.getByTestId("selly-button-dryrun"));

    await waitFor(() => expect(syncy).toHaveLength(1));
    expect(syncy[0]?.only_updated).toBe(true);
  });

  it("pełny sync wysyła limit z formularza i dry_run:false", async () => {
    const uzytkownik = userEvent.setup();
    zamockujSelly();
    await otworzSelly();

    const limit = screen.getByTestId("selly-input-limit");
    await uzytkownik.clear(limit);
    await uzytkownik.type(limit, "25");

    await uzytkownik.click(screen.getByTestId("selly-button-wyslij"));
    await uzytkownik.click(await screen.findByTestId("selly-potwierdz"));

    await waitFor(() => expect(syncy).toHaveLength(1));
    expect(syncy[0]).toEqual({
      dostawca: "MO1",
      dry_run: false,
      limit: 25,
      only_updated: false,
    });
  });

  it("pokazuje podsumowanie wyniku z odznaką DRY-RUN", async () => {
    const uzytkownik = userEvent.setup();
    zamockujSelly();
    await otworzSelly();

    await uzytkownik.click(screen.getByTestId("selly-button-dryrun"));

    const wynik = await screen.findByTestId("selly-wynik-sync");
    expect(wynik).toHaveTextContent("DRY-RUN");
    // OK = created + updated = 2 + 3.
    expect(wynik).toHaveTextContent("5");
  });
});

describe("3. Potwierdzenie przed pełnym syncem (odstępstwo D3)", () => {
  it("„Wyślij do Selly” NIE wysyła nic, dopóki nie potwierdzisz", async () => {
    const uzytkownik = userEvent.setup();
    zamockujSelly();
    await otworzSelly();

    await uzytkownik.click(screen.getByTestId("selly-button-wyslij"));

    const dialog = await screen.findByTestId("selly-dialog-potwierdzenia");
    expect(dialog).toHaveTextContent("tworzy i modyfikuje produkty w żywym sklepie");
    expect(syncy).toHaveLength(0);
  });

  it("anulowanie zamyka dialog i nie wysyła żądania", async () => {
    const uzytkownik = userEvent.setup();
    zamockujSelly();
    await otworzSelly();

    await uzytkownik.click(screen.getByTestId("selly-button-wyslij"));
    await uzytkownik.click(await screen.findByTestId("selly-anuluj"));

    await waitFor(() =>
      expect(screen.queryByTestId("selly-dialog-potwierdzenia")).toBeNull(),
    );
    expect(syncy).toHaveLength(0);
  });

  it("przycisk „Sync” w wierszu tabeli TEŻ przechodzi przez potwierdzenie", async () => {
    const uzytkownik = userEvent.setup();
    zamockujSelly();
    await otworzSelly();

    // W oryginale (`selly-injection.js:641-644`) ten przycisk odpalał pełny sync
    // natychmiast, bez żadnego pytania — to jest właśnie to, co D3 zmienia.
    await uzytkownik.click(screen.getByTestId("selly-button-sync-MO2"));
    expect(syncy).toHaveLength(0);

    await uzytkownik.click(await screen.findByTestId("selly-potwierdz"));

    await waitFor(() => expect(syncy).toHaveLength(1));
    expect(syncy[0]?.dostawca).toBe("MO2");
    expect(syncy[0]?.dry_run).toBe(false);
  });

  it("generowanie CSV pyta tekstem z oryginału i wysyła dopiero po potwierdzeniu", async () => {
    const uzytkownik = userEvent.setup();
    zamockujSelly();
    await otworzSelly();

    await uzytkownik.click(screen.getByTestId("selly-button-generuj-csv"));

    const dialog = await screen.findByTestId("selly-dialog-potwierdzenia");
    expect(dialog).toHaveTextContent(
      "Wygenerować plik CSV teraz? Zastąpi bieżący plik pobierany przez Selly.",
    );
    expect(generowania).toBe(0);

    await uzytkownik.click(screen.getByTestId("selly-potwierdz"));
    await waitFor(() => expect(generowania).toBe(1));
    expect(await screen.findByTestId("selly-wynik-generowania")).toHaveTextContent(
      "Wygenerowano",
    );
  });
});

describe("4. Lista dostawców z /status (odstępstwo D5)", () => {
  it("select ma dokładnie dostawców zwróconych przez `/status`, posortowanych numerycznie", async () => {
    zamockujSelly();
    await otworzSelly();

    const select = screen.getByTestId("selly-select-dostawca");
    const opcje = within(select)
      .getAllByRole("option")
      .map((opcja) => opcja.textContent);

    // Fixture ma MO1, MO10, MO2, MO3, MO4 — sort tekstowy dałby tę właśnie kolejność,
    // a numeryczny przesuwa MO10 na koniec.
    expect(opcje).toEqual(["MO1", "MO2", "MO3", "MO4", "MO10"]);
  });

  it("pusty `/status` wyłącza select i oba przyciski sync", async () => {
    zamockujSelly({ status: [] });
    await otworzSelly();

    expect(screen.getByTestId("selly-select-dostawca")).toBeDisabled();
    expect(screen.getByTestId("selly-button-dryrun")).toBeDisabled();
    expect(screen.getByTestId("selly-button-wyslij")).toBeDisabled();
  });
});

describe("5. Odświeżanie", () => {
  it("po pełnym syncu przeładowuje status i log (jak oryginał)", async () => {
    const uzytkownik = userEvent.setup();
    let pobraniaStatusu = 0;
    let pobraniaLogu = 0;

    server.use(
      http.get("*/api/selly/ping", () => HttpResponse.json(PING)),
      http.get("*/api/selly/csv-status", () => HttpResponse.json(CSV)),
      http.get("*/api/selly/status", () => {
        pobraniaStatusu += 1;
        return HttpResponse.json({ items: DOSTAWCY });
      }),
      http.get("*/api/selly/log", () => {
        pobraniaLogu += 1;
        return HttpResponse.json({ items: LOG });
      }),
      http.post("*/api/selly/sync-supplier", () => HttpResponse.json({ total: 0 })),
    );

    await otworzSelly();
    await waitFor(() => expect(pobraniaLogu).toBe(1));

    await uzytkownik.click(screen.getByTestId("selly-button-wyslij"));
    await uzytkownik.click(await screen.findByTestId("selly-potwierdz"));

    await waitFor(() => expect(pobraniaStatusu).toBeGreaterThan(1));
    await waitFor(() => expect(pobraniaLogu).toBeGreaterThan(1));
  });
});
