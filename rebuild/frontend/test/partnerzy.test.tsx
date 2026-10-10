/**
 * Widok `/partnerzy` (ticket 221, PRT-5.1) — lista partnerów B2B, dodawanie i aktywacja.
 * NOWA funkcjonalność: handlery MSW są pisane od zera (backend: `rebuild/backend/src/routes/partnerzy.ts`).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { komunikatBledu, opisHarmonogramu, type PartnerNaLiscie, type WpisLogu } from "@/pages/partnerzy/api";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const partner = (nad: Partial<PartnerNaLiscie> = {}): PartnerNaLiscie => ({
  id: 1, nazwa: "TyreWorld", aktywny: false, stanMin: 2, zaokraglanie: "grosz", harmonogramMinuty: 60, formatPliku: "csv",
  liczbaMagazynow: 2, liczbaWykluczen: 0, liczbaKrajow: 6, ...nad,
});
const wpisLogu = (nad: Partial<WpisLogu> = {}): WpisLogu => ({
  id: 1, partnerId: 1, kiedy: "2026-10-10T12:00:00.000Z", operacja: "generowanie", opis: "Wygenerowano 1 plik: tyreworld.csv (3000 pozycji)", liczbaPozycji: 3000, ...nad,
});

let partnerzy: PartnerNaLiscie[] = [];
let logi: Record<number, WpisLogu[]> = {};
let zadania: { metoda: string; sciezka: string; cialo: Record<string, unknown> }[] = [];

function zamockujApi({ dodawanie = "ok" as "ok" | "duplikat" } = {}) {
  server.use(
    http.get("*/api/partnerzy", () => HttpResponse.json({ partnerzy })),
    http.get("*/api/partnerzy/:id/logi", ({ params }) => HttpResponse.json({ logi: logi[Number(params.id)] ?? [] })),
    http.post("*/api/partnerzy", async ({ request }) => {
      const cialo = (await request.json()) as { nazwa: string };
      zadania.push({ metoda: "POST", sciezka: "/api/partnerzy", cialo });
      if (dodawanie === "duplikat") return HttpResponse.json({ error: "Partner o tej nazwie już istnieje." }, { status: 409 });
      partnerzy = [...partnerzy, partner({ id: 10 + partnerzy.length, nazwa: cialo.nazwa, harmonogramMinuty: null, liczbaMagazynow: 0, liczbaKrajow: 0 })];
      return HttpResponse.json({ id: 10 }, { status: 201 });
    }),
    http.put("*/api/partnerzy/:id/aktywny", async ({ request, params }) => {
      const cialo = (await request.json()) as { aktywny: boolean };
      zadania.push({ metoda: "PUT", sciezka: `/api/partnerzy/${String(params.id)}/aktywny`, cialo });
      partnerzy = partnerzy.map((p) => (p.id === Number(params.id) ? { ...p, aktywny: cialo.aktywny } : p));
      return HttpResponse.json({ id: Number(params.id) });
    }),
  );
}

async function otworz() {
  window.history.pushState({}, "", "/partnerzy");
  render(<App />);
  await screen.findByTestId("text-page-title");
}

beforeEach(() => {
  partnerzy = [];
  logi = {};
  zadania = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(uzytkownikZFixtura()));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
});

describe("lista partnerów", () => {
  it("pusty stan zaprasza do dodania pierwszego partnera", async () => {
    zamockujApi();
    await otworz();
    expect(await screen.findByTestId("text-partnerzy-pusto")).toHaveTextContent("Nie ma jeszcze żadnego partnera");
  });

  it("pokazuje partnerów ze statusem, harmonogramem, liczbami i ostatnim generowaniem", async () => {
    partnerzy = [partner(), partner({ id: 2, nazwa: "Adtyres", aktywny: true, harmonogramMinuty: null, liczbaMagazynow: 1, liczbaKrajow: 1, liczbaWykluczen: 3 })];
    logi = { 1: [wpisLogu()] };
    zamockujApi();
    await otworz();

    const w1 = await screen.findByTestId("row-partner-1");
    expect(within(w1).getByText("TyreWorld")).toBeInTheDocument();
    expect(within(w1).getByTestId("badge-partner-status-1")).toHaveTextContent("Nieaktywny");
    expect(within(w1).getByText("co 1 h")).toBeInTheDocument();
    expect(within(w1).getByText("2 mag. · 6 krajów")).toBeInTheDocument();
    expect(await within(w1).findByTestId("text-partner-ostatnie-1")).toHaveTextContent("Wygenerowano 1 plik: tyreworld.csv (3000 pozycji)");

    const w2 = screen.getByTestId("row-partner-2");
    expect(within(w2).getByTestId("badge-partner-status-2")).toHaveTextContent("Aktywny");
    expect(within(w2).getByText("1 mag. · 1 kraj · 3 wykl.")).toBeInTheDocument();
    expect(await within(w2).findByText("jeszcze nie generowano")).toBeInTheDocument();
  });

  it("błąd serwera listy pokazuje komunikat, nie pusty stan", async () => {
    server.use(http.get("*/api/partnerzy", () => HttpResponse.json({ error: "Awaria bazy" }, { status: 500 })));
    await otworz();
    expect(await screen.findByTestId("text-partnerzy-blad")).toHaveTextContent("Awaria bazy");
    expect(screen.queryByTestId("text-partnerzy-pusto")).not.toBeInTheDocument();
  });

  it("pozycja „Partnerzy” w sidebarze prowadzi na /partnerzy", async () => {
    zamockujApi();
    await otworz();
    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "Partnerzy" })).toHaveAttribute("href", "/partnerzy");
  });
});

describe("dodawanie partnera", () => {
  it("wysyła nazwę po przycięciu i odświeża listę; przycisk jest nieaktywny dla pustej nazwy", async () => {
    zamockujApi();
    const uzytkownik = userEvent.setup();
    await otworz();
    const przycisk = await screen.findByTestId("button-partner-dodaj");
    expect(przycisk).toBeDisabled();

    await uzytkownik.type(screen.getByTestId("input-partner-nazwa"), "  Nowy Partner ");
    await uzytkownik.click(przycisk);

    await waitFor(() => expect(zadania).toEqual([{ metoda: "POST", sciezka: "/api/partnerzy", cialo: { nazwa: "Nowy Partner" } }]));
    expect(await screen.findByText("Nowy Partner")).toBeInTheDocument();
    expect(screen.getByTestId("input-partner-nazwa")).toHaveValue("");
    expect(await screen.findByText(/Dodano partnera/)).toBeInTheDocument();
  });

  it("zajęta nazwa: toast z komunikatem serwera, pole zostaje wypełnione", async () => {
    zamockujApi({ dodawanie: "duplikat" });
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.type(await screen.findByTestId("input-partner-nazwa"), "TyreWorld");
    await uzytkownik.click(screen.getByTestId("button-partner-dodaj"));
    expect(await screen.findByText("Partner o tej nazwie już istnieje.")).toBeInTheDocument();
    expect(screen.getByTestId("input-partner-nazwa")).toHaveValue("TyreWorld");
  });
});

describe("aktywacja", () => {
  it("Aktywuj → PUT {aktywny:true}, status zmienia się; Dezaktywuj → {aktywny:false}; partner nie znika", async () => {
    partnerzy = [partner()];
    zamockujApi();
    const uzytkownik = userEvent.setup();
    await otworz();

    await uzytkownik.click(await screen.findByTestId("button-partner-aktywnosc-1"));
    await waitFor(() => expect(screen.getByTestId("badge-partner-status-1")).toHaveTextContent("Aktywny"));
    expect(zadania.at(-1)).toEqual({ metoda: "PUT", sciezka: "/api/partnerzy/1/aktywny", cialo: { aktywny: true } });

    await uzytkownik.click(screen.getByTestId("button-partner-aktywnosc-1"));
    await waitFor(() => expect(screen.getByTestId("badge-partner-status-1")).toHaveTextContent("Nieaktywny"));
    expect(zadania.at(-1)!.cialo).toEqual({ aktywny: false });
    expect(screen.getByTestId("row-partner-1")).toBeInTheDocument();
  });
});

describe("pomocnicze", () => {
  it("opisHarmonogramu", () => {
    expect(opisHarmonogramu(null)).toBe("—");
    expect(opisHarmonogramu(30)).toBe("co 30 min");
    expect(opisHarmonogramu(120)).toBe("co 2 h");
    expect(opisHarmonogramu(1440)).toBe("co 1 dzień");
    expect(opisHarmonogramu(2880)).toBe("co 2 dni");
  });

  it("komunikatBledu wyciąga pole error z odpowiedzi serwera", () => {
    expect(komunikatBledu(new Error('409: {"error":"Zajęta."}'))).toBe("Zajęta.");
    expect(komunikatBledu(new Error("500: awaria"))).toBe("awaria");
    expect(komunikatBledu(new Error("sieć padła"))).toBe("sieć padła");
  });
});
