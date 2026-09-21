/**
 * Zakładka „Katalog” na `/alerty` — pseudo-alerty katalogowe (karta P6.2, ticket
 * `77-FEATURE-pseudo-alerty-katalogowe`).
 *
 * Zakres: zakładki i ich adres, że lista liczy się z `/api/products`, że domyślny filtr chowa
 * rozwiązane (łatka `ackalerts` pkt 4 — tak samo jak „Nierozwiązane” w zakładce „Import”),
 * że każda akcja idzie JEDNYM `PUT /api/alerty-katalogu/statusy` (decyzja 2 — status na
 * serwerze) i że „Zaakceptuj wszystko” obejmuje dokładnie to, co widać po filtrach.
 *
 * Reguły silnika sprawdza osobno `alerty.silnik-katalogu.test.ts`; tu produkty są dobrane tak,
 * żeby dały trzy przewidywalne alerty i ANI JEDNEGO alertu „Brak importu” (świeże daty).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { TOKEN_TESTOWY, produktyZFixtura, uzytkownikZFixtura } from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const WZORCOWY = produktyZFixtura()[0]!;

/** Wczoraj — żaden dostawca nie przekroczy progu 7 dni, więc „Brak importu” nie powstaje. */
const SWIEZO = () => new Date(Date.now() - 86_400_000).toISOString();

function produkty() {
  const baza = { ...WZORCOWY, dostawca: "MO9", dataAktualizacji: SWIEZO() };
  return [
    { ...baza, id: 1, kod: "P1", nazwa: "420/85R34 BKT AGRIMAX 147A8 TL", marzaPct: -3, cenaZakupu: 100, cenaSprzedazy: 97 },
    { ...baza, id: 2, kod: "P2", nazwa: "380/70R24 BKT AGRIMAX 125A8 TL", marzaPct: 2 },
    { ...baza, id: 3, kod: "P3", nazwa: "DĘTKA 18.4-38", kategoria: "Dętki", marzaPct: 30 },
    { ...baza, id: 4, kod: "P4", nazwa: "520/85R38 BKT AGRIMAX 155A8 TL", marzaPct: 30 },
  ];
}

const ID_UJEMNA = "1-marza-ujemna--3";
const ID_NISKA = "2-marza-niska-2";
const ID_NIE_OPONA = "3-nie-opona-DĘTKA 18.4-38|Dętki";

type Wpis = { id: string; status: string; kto: string | null; kiedy: string };
let puty: { ids: string[]; status: string }[] = [];

/** Atrapa Z PAMIĘCIĄ: PUT zmienia listę, którą oddaje następny GET — jak serwer. */
function zamockujApi(poczatkowe: Wpis[] = []) {
  let statusy = [...poczatkowe];
  server.use(
    http.get("*/api/products", () => HttpResponse.json(produkty())),
    http.get("*/api/alerts", () => HttpResponse.json([])),
    http.get("*/api/alerty-katalogu/statusy", () => HttpResponse.json(statusy)),
    http.put("*/api/alerty-katalogu/statusy", async ({ request }) => {
      const cialo = (await request.json()) as { ids: string[]; status: string };
      puty.push(cialo);
      statusy = statusy.filter((w) => !cialo.ids.includes(w.id));
      if (cialo.status !== "nowy") {
        statusy.push(
          ...cialo.ids.map((id) => ({ id, status: cialo.status, kto: "Ania", kiedy: new Date().toISOString() })),
        );
      }
      return HttpResponse.json({ ok: true, zmienione: cialo.ids.length });
    }),
  );
}

const wiersz = (id: string) => `row-catalog-alert-${id}`;

async function otworzKatalog() {
  window.history.pushState({}, "", "/alerty?zakladka=katalog");
  render(<App />);
  return await screen.findByTestId(wiersz(ID_UJEMNA));
}

beforeEach(() => {
  puty = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
});

describe("1. Zakładki Import / Katalog (decyzja 1)", () => {
  it("`/alerty` otwiera zakładkę „Import”; klik w „Katalog” przełącza i zapisuje ją w adresie", async () => {
    zamockujApi();
    window.history.pushState({}, "", "/alerty");
    render(<App />);

    const importu = await screen.findByTestId("tab-alerty-import");
    expect(importu).toHaveAttribute("data-state", "active");
    expect(screen.queryByTestId(wiersz(ID_UJEMNA))).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("tab-alerty-katalog"));
    expect(await screen.findByTestId(wiersz(ID_UJEMNA))).toBeInTheDocument();
    expect(window.location.search).toBe("?zakladka=katalog");

    await userEvent.click(screen.getByTestId("tab-alerty-import"));
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("`/alerty?zakladka=katalog` otwiera wprost zakładkę „Katalog” (link z Pulpitu)", async () => {
    zamockujApi();
    await otworzKatalog();
    expect(screen.getByTestId("tab-alerty-katalog")).toHaveAttribute("data-state", "active");
  });
});

describe("2. Lista liczona z katalogu", () => {
  it("trzy alerty: krytyczne przed ostrzeżeniem; podpis liczy `nowy` jak w oryginale", async () => {
    zamockujApi();
    await otworzKatalog();

    const wiersze = screen.getAllByTestId(/^row-catalog-alert-/);
    expect(wiersze.map((w) => w.getAttribute("data-testid"))).toEqual(
      expect.arrayContaining([wiersz(ID_UJEMNA), wiersz(ID_NIE_OPONA), wiersz(ID_NISKA)]),
    );
    expect(wiersze.at(-1)).toHaveAttribute("data-testid", wiersz(ID_NISKA));
    expect(screen.getByTestId("text-catalog-alerts-subtitle")).toHaveTextContent(
      "2 krytycznych · 1 ostrzeżeń · alerty wyliczane na żywo z katalogu",
    );
    expect(screen.getByTestId("text-catalog-alerts-count")).toHaveTextContent("3 alertów");

    const ujemna = screen.getByTestId(wiersz(ID_UJEMNA));
    expect(within(ujemna).getByText("Marża ujemna — sprzedaż pod kosztem")).toBeInTheDocument();
    expect(within(ujemna).getByText(/marża -3\.0%, zakup 100\.00 zł, sprzedaż 97\.00 zł/)).toBeInTheDocument();
    expect(within(ujemna).getByText("krytyczny")).toBeInTheDocument();
    expect(within(ujemna).getByText("· dostawca MO9")).toBeInTheDocument();
  });

  it("domyślny filtr „Nierozwiązane” chowa rozwiązane; „Rozwiązany” je pokazuje", async () => {
    zamockujApi([{ id: ID_NISKA, status: "rozwiazany", kto: "Ania", kiedy: "2026-09-21T08:00:00.000Z" }]);
    await otworzKatalog();

    expect(screen.getByTestId("select-status-alerts")).toHaveTextContent("Nierozwiązane");
    expect(screen.queryByTestId(wiersz(ID_NISKA))).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("select-status-alerts"));
    await userEvent.click(await screen.findByRole("option", { name: "Rozwiązany" }));
    expect(await screen.findByTestId(wiersz(ID_NISKA))).toBeInTheDocument();
    expect(screen.queryByTestId(wiersz(ID_UJEMNA))).not.toBeInTheDocument();
  });

  it("filtr poziomu zawęża listę", async () => {
    zamockujApi();
    await otworzKatalog();

    await userEvent.click(screen.getByTestId("select-level"));
    await userEvent.click(await screen.findByRole("option", { name: "Ostrzeżenie" }));
    await waitFor(() => expect(screen.getAllByTestId(/^row-catalog-alert-/)).toHaveLength(1));
    expect(screen.getByTestId(wiersz(ID_NISKA))).toBeInTheDocument();
  });
});

describe("3. Statusy przez serwer — wspólne przyciski z P6.1", () => {
  it("„Oznacz jako przejrzany” → jeden PUT; alert zostaje na liście jako `przejrzany`", async () => {
    zamockujApi();
    const karta = await otworzKatalog();

    await userEvent.click(within(karta).getByRole("button", { name: "Oznacz jako przejrzany" }));
    await waitFor(() => expect(puty).toEqual([{ ids: [ID_UJEMNA], status: "przejrzany" }]));

    const poZmianie = await screen.findByTestId(wiersz(ID_UJEMNA));
    await waitFor(() => expect(within(poZmianie).getByText("przejrzany")).toBeInTheDocument());
    expect(within(poZmianie).queryByRole("button", { name: "Oznacz jako przejrzany" })).toBeNull();
    expect(within(poZmianie).getByRole("button", { name: "Otwórz ponownie" })).toBeInTheDocument();
  });

  it("„Rozwiąż” → alert znika z domyślnego widoku", async () => {
    zamockujApi();
    const karta = await otworzKatalog();

    await userEvent.click(within(karta).getByRole("button", { name: "Rozwiąż" }));
    await waitFor(() => expect(puty).toEqual([{ ids: [ID_UJEMNA], status: "rozwiazany" }]));
    await waitFor(() => expect(screen.queryByTestId(wiersz(ID_UJEMNA))).not.toBeInTheDocument());
  });

  it("„Otwórz ponownie” wysyła `nowy` (serwer kasuje wpis)", async () => {
    zamockujApi([{ id: ID_NISKA, status: "przejrzany", kto: "Ania", kiedy: "2026-09-21T08:00:00.000Z" }]);
    await otworzKatalog();

    const niska = screen.getByTestId(wiersz(ID_NISKA));
    await userEvent.click(within(niska).getByRole("button", { name: "Otwórz ponownie" }));
    await waitFor(() => expect(puty).toEqual([{ ids: [ID_NISKA], status: "nowy" }]));
  });
});

describe("4. „Zaakceptuj wszystko”", () => {
  it("rozwiązuje WSZYSTKIE widoczne jednym PUT-em i czyści domyślny widok", async () => {
    zamockujApi([{ id: ID_NISKA, status: "przejrzany", kto: "Ania", kiedy: "2026-09-21T08:00:00.000Z" }]);
    await otworzKatalog();

    await userEvent.click(screen.getByTestId("button-accept-all-alerts"));
    await waitFor(() => expect(puty).toHaveLength(1));
    expect(puty[0]!.status).toBe("rozwiazany");
    expect([...puty[0]!.ids].sort()).toEqual([ID_NIE_OPONA, ID_NISKA, ID_UJEMNA].sort());

    expect(await screen.findByText("Brak alertów spełniających filtr.")).toBeInTheDocument();
  });

  it("obejmuje tylko to, co widać po filtrze poziomu", async () => {
    zamockujApi();
    await otworzKatalog();

    await userEvent.click(screen.getByTestId("select-level"));
    await userEvent.click(await screen.findByRole("option", { name: "Krytyczny" }));
    await waitFor(() => expect(screen.getAllByTestId(/^row-catalog-alert-/)).toHaveLength(2));

    await userEvent.click(screen.getByTestId("button-accept-all-alerts"));
    await waitFor(() => expect(puty).toHaveLength(1));
    expect([...puty[0]!.ids].sort()).toEqual([ID_NIE_OPONA, ID_UJEMNA].sort());
  });

  it("przy pustej liście nic nie wysyła", async () => {
    zamockujApi([
      { id: ID_UJEMNA, status: "rozwiazany", kto: null, kiedy: "2026-09-21T08:00:00.000Z" },
      { id: ID_NISKA, status: "rozwiazany", kto: null, kiedy: "2026-09-21T08:00:00.000Z" },
      { id: ID_NIE_OPONA, status: "rozwiazany", kto: null, kiedy: "2026-09-21T08:00:00.000Z" },
    ]);
    window.history.pushState({}, "", "/alerty?zakladka=katalog");
    render(<App />);
    await screen.findByText("Brak alertów spełniających filtr.");

    await userEvent.click(screen.getByTestId("button-accept-all-alerts"));
    expect(puty).toEqual([]);
  });
});
