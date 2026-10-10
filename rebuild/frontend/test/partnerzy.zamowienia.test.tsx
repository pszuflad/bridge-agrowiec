/** Zamówienia odebrane od partnera na stronie partnera: lista i szczegóły, tylko odczyt (ticket 230, PRT-7.6a). MSW od zera. */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { SzczegolyPartnera, SzczegolyZamowienia, ZamowienieNaLiscie } from "@/pages/partnerzy/api";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const partner = (): SzczegolyPartnera => ({
  id: 1, nazwa: "TyreWorld", aktywny: false, stanMin: 2, zaokraglanie: "grosz", harmonogramMinuty: null, tolerancjaCenyProc: null, formatPliku: "csv", csvSeparator: ";",
  kanalFtp: false, kanalEmail: true, emailSkrzynka: "zamowienia@example.test", zmieniono: "2026-10-10T10:00:00.000Z", magazyny: [], wykluczenia: [], kraje: [], kolumny: [], polaObliczeniowe: [],
});
const naLiscie = (id: number, numer: string): ZamowienieNaLiscie => ({
  id, numerPartnera: numer, numerWlasny: null, status: "nowe", dataZamowienia: "2024-02-02 11:27:11", waluta: "EUR", krajDostawy: "AT", pobrano: "2026-10-10T12:00:00.000Z", liczbaPozycji: 2,
});
const szczegoly = (id: number, numer: string): SzczegolyZamowienia => ({
  id, partnerId: 1, numerPartnera: numer, numerWlasny: null, status: "nowe", dataZamowienia: "2024-02-02 11:27:11", dataDostawy: "2024-02-02", waluta: "EUR", kosztDostawy: 0,
  krajDostawy: "AT", pobrano: "2026-10-10T12:00:00.000Z", faktura: {}, dostawa: { CUSTOMERNAME: "Jan Kowalski", COUNTRY: "AT", PHONE: "" },
  pozycje: [
    { id: 1, lp: 1, kod: "011200284", nazwa: "Ceat Farmax R70", ilosc: 2, cenaSprzedazy: 202 },
    { id: 2, lp: 2, kod: "0102 00001", nazwa: null, ilosc: 1, cenaSprzedazy: null },
  ],
});

let zamowienia: ZamowienieNaLiscie[];
let zapytaniaSzczegolow: number[];

function zamockujApi() {
  server.use(
    http.get("*/api/partnerzy/magazyny", () => HttpResponse.json({ magazyny: [] })),
    http.get("*/api/partnerzy/:id/logi", () => HttpResponse.json({ logi: [] })),
    http.get("*/api/partnerzy/:id/error-log", () => HttpResponse.json({ bledy: [] })),
    http.get("*/api/partnerzy/:id/zamowienia/:zid", ({ params }) => {
      zapytaniaSzczegolow.push(Number(params.zid));
      const z = zamowienia.find((x) => x.id === Number(params.zid));
      return z ? HttpResponse.json(szczegoly(z.id, z.numerPartnera)) : HttpResponse.json({ error: "Nie ma takiego zamówienia tego partnera." }, { status: 404 });
    }),
    http.get("*/api/partnerzy/:id/zamowienia", () => HttpResponse.json({ zamowienia })),
    http.get("*/api/partnerzy/:id", () => HttpResponse.json(partner())),
  );
}

async function otworz() {
  window.history.pushState({}, "", "/partnerzy/1");
  render(<App />);
  await screen.findByText("Partner: TyreWorld");
}

beforeEach(() => {
  zamowienia = [];
  zapytaniaSzczegolow = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(uzytkownikZFixtura()));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
  zamockujApi();
});

describe("zamówienia partnera", () => {
  it("pusta lista pokazuje informację", async () => {
    await otworz();
    expect(await screen.findByTestId("text-zamowienia-pusto")).toBeInTheDocument();
  });

  it("pokazuje listę: numer partnera, status, kraj i liczbę pozycji", async () => {
    zamowienia = [naLiscie(2, "A02"), naLiscie(1, "A01")];
    await otworz();
    const lista = await screen.findByTestId("lista-zamowien");
    const wiersze = within(lista).getAllByRole("listitem");
    expect(wiersze.map((w) => w.textContent)).toEqual([expect.stringMatching(/A02.*nowe.*AT · 2 poz\./), expect.stringMatching(/A01.*nowe.*AT · 2 poz\./)]);
    expect(zapytaniaSzczegolow).toEqual([]); // szczegóły dopiero po rozwinięciu
  });

  it("rozwinięcie pokazuje pozycje i dane dostawy; ponowne kliknięcie zwija", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [naLiscie(1, "A01")];
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    const szczegolyWidok = await screen.findByTestId("szczegoly-zamowienia-1");
    expect(within(szczegolyWidok).getByTestId("pozycja-1-1")).toHaveTextContent("011200284");
    expect(within(szczegolyWidok).getByTestId("pozycja-1-1")).toHaveTextContent("Ceat Farmax R70");
    expect(within(szczegolyWidok).getByTestId("pozycja-1-2")).toHaveTextContent("0102 00001");
    expect(within(screen.getByTestId("dostawa-1")).getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.getByTestId("dostawa-1")).not.toHaveTextContent("PHONE"); // puste pola pomijane
    await uzytkownik.click(screen.getByTestId("button-zamowienie-1"));
    expect(screen.queryByTestId("szczegoly-zamowienia-1")).not.toBeInTheDocument();
  });

  it("błąd listy jest widoczny, a reszta strony działa", async () => {
    server.use(http.get("*/api/partnerzy/:id/zamowienia", () => HttpResponse.json({ error: "Awaria zamówień" }, { status: 500 })));
    await otworz();
    expect(await screen.findByTestId("text-zamowienia-blad")).toHaveTextContent("Awaria zamówień");
    expect(screen.getByTestId("button-logi-odswiez")).toBeInTheDocument();
  });

  it("błąd szczegółów jest widoczny przy zamówieniu", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [naLiscie(1, "A01")];
    server.use(http.get("*/api/partnerzy/:id/zamowienia/:zid", () => HttpResponse.json({ error: "Zamówienie zniknęło" }, { status: 404 })));
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    expect(await screen.findByTestId("text-zamowienie-blad")).toHaveTextContent("Zamówienie zniknęło");
  });

  it("Odśwież pobiera listę od nowa", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByTestId("text-zamowienia-pusto");
    zamowienia = [naLiscie(5, "NOWE5")];
    await uzytkownik.click(screen.getByTestId("button-zamowienia-odswiez"));
    expect(await screen.findByTestId("zamowienie-5")).toHaveTextContent("NOWE5");
  });
});
