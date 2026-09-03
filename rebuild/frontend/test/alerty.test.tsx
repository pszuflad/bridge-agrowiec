/**
 * Widok `/alerty` — Iteracja 6.
 *
 * Zakres: że lista jest ZWINIĘTA (a nie surowa), że rozwinięcie pokazuje pojedyncze wpisy,
 * że domyślny filtr chowa szum „Synchronizacja", i że zmiana statusu idzie PRZEZ API
 * (decyzja D3) — na grupie jako N PATCH-y, na wpisie jako jeden.
 *
 * Kształt wiersza bierzemy z `contract/fixtures/GET_alerts.json`; rozkład powtórek
 * budujemy sami, bo nagranie ma pięć wierszy bez ani jednej powtórki (nota przy
 * `alertyZFixtura` w `test/msw/kontrakt.ts`).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Alert } from "@/pages/alerty/api";
import { TOKEN_TESTOWY, alertyZFixtura, uzytkownikZFixtura } from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const WZORCOWY = alertyZFixtura()[0]!;

function alert(nadpisania: Partial<Alert> & { id: number }): Alert {
  return { ...WZORCOWY, ...nadpisania };
}

/** Klucz grupy w `data-testid` — musi zgadzać się z `kluczGrupy` w `grupowanie.ts`. */
const KLUCZ_MO3 = "MO3|Błąd pobierania|nowy";

/**
 * 23 nieudane pobrania MO3 (rekord z produkcji), jedno MO5 i jedna udana synchronizacja
 * MO9 — czyli dokładnie sytuacja, w której surowa lista przestaje być czytelna.
 */
function alertyZPowtorkami(): Alert[] {
  const mo3 = Array.from({ length: 23 }, (_, i) =>
    alert({
      id: 100 + i,
      poziom: "ostrzezenie",
      typ: "Błąd pobierania",
      status: "nowy",
      dostawca: "MO3",
      opis: `MO3: nieudana próba numer ${i + 1}`,
      data: `2026-08-09T${String(i).padStart(2, "0")}:15:00.000Z`,
    }),
  );

  return [
    ...mo3,
    alert({
      id: 200,
      poziom: "ostrzezenie",
      typ: "Błąd HTTP",
      status: "nowy",
      dostawca: "MO5",
      opis: "MO5: HTTP 503",
      data: "2026-08-09T23:00:00.000Z",
    }),
    alert({
      id: 300,
      poziom: "info",
      typ: "Synchronizacja",
      status: "rozwiazany",
      dostawca: "MO9",
      opis: "MO9: pobrano 925 produktów",
      data: "2026-08-09T23:30:00.000Z",
    }),
  ];
}

let patche: { id: string; cialo: Record<string, unknown> }[] = [];

function zamockujApi(alerty: Alert[] = alertyZPowtorkami()) {
  server.use(
    http.get("*/api/alerts", () => HttpResponse.json(alerty)),
    http.patch("*/api/alerts/:id", async ({ request, params }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      patche.push({ id: String(params.id), cialo });
      return HttpResponse.json({ ok: true });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzAlerty() {
  window.history.pushState({}, "", "/alerty");
  render(<App />);
  return await screen.findByTestId(`group-alert-${KLUCZ_MO3}`);
}

beforeEach(() => {
  patche = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("1. Widok jest wpięty", () => {
  it("`/alerty` nie jest już widokiem w przygotowaniu", async () => {
    zamockujApi();
    await otworzAlerty();

    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Alerty");
    expect(screen.queryByText(/w przygotowaniu/i)).not.toBeInTheDocument();
  });
});

describe("2. Zwijanie powtórek — sedno iteracji", () => {
  /**
   * NAJWAŻNIEJSZY TEST TEGO WIDOKU. 24 alerty ze statusem `nowy` mają dać DWA wiersze,
   * a nie 24. Gdyby lista renderowała się surowo, ten test padnie.
   */
  it("24 alerty pokazują się jako 2 grupy, nie 24 wiersze", async () => {
    zamockujApi();
    await otworzAlerty();

    const grupy = screen.getAllByTestId(/^group-alert-/);
    expect(grupy).toHaveLength(2);
    expect(screen.getByTestId("text-alert-summary")).toHaveTextContent("2 grupy / 24 alerty");
  });

  it("grupa powtórek pokazuje licznik i czas ostatniego wystąpienia", async () => {
    zamockujApi();
    const grupa = await otworzAlerty();

    expect(within(grupa).getByTestId(`badge-count-${KLUCZ_MO3}`)).toHaveTextContent("23×");
    expect(within(grupa).getByText(/ostatnio/)).toBeInTheDocument();
  });

  it("przed rozwinięciem treść pojedynczych wpisów NIE jest w DOM", async () => {
    zamockujApi();
    await otworzAlerty();

    expect(screen.queryByText("MO3: nieudana próba numer 1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("row-alert-100")).not.toBeInTheDocument();
  });

  it("klik w grupę rozwija ją do pojedynczych wierszy", async () => {
    zamockujApi();
    await otworzAlerty();

    await userEvent.click(screen.getByTestId(`button-expand-${KLUCZ_MO3}`));

    expect(await screen.findByTestId("row-alert-100")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^row-alert-/)).toHaveLength(23);
    expect(screen.getByText("MO3: nieudana próba numer 1")).toBeInTheDocument();
  });

  /** Jeden wpis nie ma czego rozwijać — pokazuje `opis` od razu, bez strzałki. */
  it("grupa jednoelementowa nie ma przycisku rozwijania i pokazuje opis od razu", async () => {
    zamockujApi();
    await otworzAlerty();

    const pojedyncza = screen.getByTestId("group-alert-MO5|Błąd HTTP|nowy");
    expect(within(pojedyncza).queryByTestId(/^button-expand-/)).not.toBeInTheDocument();
    expect(within(pojedyncza).getByText("MO5: HTTP 503")).toBeInTheDocument();
  });
});

describe("3. Filtry", () => {
  /** 2127 wpisów „Synchronizacja"/rozwiazany w produkcji — bez tego ekran jest szumem. */
  it("po wejściu widać tylko status `nowy` — „Synchronizacja\" jest schowana", async () => {
    zamockujApi();
    await otworzAlerty();

    expect(screen.queryByTestId("group-alert-MO9|Synchronizacja|rozwiazany")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-alert-summary")).toHaveTextContent("24 alerty");
  });

  it("zdjęcie filtra statusu odsłania alerty rozwiązane", async () => {
    zamockujApi();
    await otworzAlerty();

    await userEvent.click(screen.getByTestId("select-alert-status"));
    await userEvent.click(await screen.findByRole("option", { name: "Wszystkie statusy" }));

    expect(
      await screen.findByTestId("group-alert-MO9|Synchronizacja|rozwiazany"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("text-alert-summary")).toHaveTextContent("25 alertów");
  });

  it("filtr dostawcy zawęża listę grup", async () => {
    zamockujApi();
    await otworzAlerty();

    await userEvent.click(screen.getByTestId("select-alert-supplier"));
    await userEvent.click(await screen.findByRole("option", { name: "MO5" }));

    await waitFor(() => expect(screen.getAllByTestId(/^group-alert-/)).toHaveLength(1));
    expect(screen.getByTestId("group-alert-MO5|Błąd HTTP|nowy")).toBeInTheDocument();
  });
});

describe("4. Zmiana statusu idzie przez API (decyzja D3)", () => {
  it("akcja na grupie wysyła PATCH dla KAŻDEGO alertu tej grupy", async () => {
    zamockujApi();
    await otworzAlerty();

    await userEvent.click(screen.getByTestId(`button-toggle-${KLUCZ_MO3}`));

    await waitFor(() => expect(patche).toHaveLength(23));
    expect(patche.every((p) => p.cialo.status === "rozwiazany")).toBe(true);
    expect(new Set(patche.map((p) => p.id)).size).toBe(23);
  });

  it("akcja na pojedynczym wpisie wysyła dokładnie jeden PATCH", async () => {
    zamockujApi();
    await otworzAlerty();

    await userEvent.click(screen.getByTestId(`button-expand-${KLUCZ_MO3}`));
    await userEvent.click(await screen.findByTestId("button-toggle-alert-100"));

    await waitFor(() => expect(patche).toHaveLength(1));
    expect(patche[0]).toEqual({ id: "100", cialo: { status: "rozwiazany" } });
  });

  /** Przełącznik działa w OBIE strony — alert zamknięty przez pomyłkę da się otworzyć. */
  it("alert rozwiązany wraca do statusu `nowy`", async () => {
    zamockujApi();
    await otworzAlerty();

    await userEvent.click(screen.getByTestId("select-alert-status"));
    await userEvent.click(await screen.findByRole("option", { name: "Wszystkie statusy" }));

    const grupa = await screen.findByTestId("group-alert-MO9|Synchronizacja|rozwiazany");
    await userEvent.click(within(grupa).getByRole("button", { name: /Otwórz ponownie/ }));

    await waitFor(() => expect(patche).toHaveLength(1));
    expect(patche[0]).toEqual({ id: "300", cialo: { status: "nowy" } });
  });

  it("nieudany PATCH nie udaje sukcesu — pokazuje komunikat", async () => {
    server.use(
      http.get("*/api/alerts", () => HttpResponse.json(alertyZPowtorkami())),
      http.patch("*/api/alerts/:id", () => new HttpResponse("Baza zablokowana", { status: 500 })),
    );
    await otworzAlerty();

    await userEvent.click(screen.getByTestId("group-alert-MO5|Błąd HTTP|nowy").querySelector("button")!);

    expect(await screen.findByText(/Nie udało się zmienić statusu/)).toBeInTheDocument();
  });
});
