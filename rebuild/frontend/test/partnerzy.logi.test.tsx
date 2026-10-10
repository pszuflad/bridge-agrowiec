/** Konfiguracja partnera: aktywność, „Generuj teraz”, logi i błędy (ticket 225, PRT-5.4). MSW od zera. */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { SzczegolyPartnera, WpisBledu, WpisLogu, WynikGenerowania } from "@/pages/partnerzy/api";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const startowy = (): SzczegolyPartnera => ({
  id: 1, nazwa: "TyreWorld", aktywny: false, stanMin: 2, zaokraglanie: "grosz", harmonogramMinuty: null, tolerancjaCenyProc: null, formatPliku: "csv", csvSeparator: ";",
  kanalFtp: false, kanalEmail: false, emailSkrzynka: null, zmieniono: "2026-10-10T10:00:00.000Z", magazyny: [], wykluczenia: [], kraje: [], kolumny: [], polaObliczeniowe: [],
});
const wpis = (id: number, opis: string): WpisLogu => ({ id, partnerId: 1, kiedy: "2026-10-10T12:00:00.000Z", operacja: "generowanie", opis, liczbaPozycji: 3000 });
const blad = (id: number, poziom: WpisBledu["poziom"], komunikat: string): WpisBledu => ({ id, partnerId: 1, kiedy: "2026-10-10T12:00:00.000Z", operacja: "generowanie", poziom, komunikat });

let partner: SzczegolyPartnera;
let logi: WpisLogu[];
let bledy: WpisBledu[];
let zapytaniaBledow: string[];
let zadania: { metoda: string; sciezka: string; cialo?: unknown }[];
let generowanie: { status: number; cialo: object };

function zamockujApi() {
  server.use(
    http.get("*/api/partnerzy/magazyny", () => HttpResponse.json({ magazyny: [] })),
    http.get("*/api/partnerzy/:id/zamowienia", () => HttpResponse.json({ zamowienia: [] })),
    http.get("*/api/partnerzy/:id/logi", () => HttpResponse.json({ logi })),
    http.get("*/api/partnerzy/:id/error-log", ({ request }) => {
      const poziom = new URL(request.url).searchParams.get("poziom");
      zapytaniaBledow.push(poziom ?? "wszystkie");
      return HttpResponse.json({ bledy: poziom ? bledy.filter((b) => b.poziom === poziom) : bledy });
    }),
    http.get("*/api/partnerzy/:id", () => HttpResponse.json(partner)),
    http.put("*/api/partnerzy/:id/aktywny", async ({ request }) => {
      const cialo = (await request.json()) as { aktywny: boolean };
      zadania.push({ metoda: "PUT", sciezka: "/aktywny", cialo });
      partner = { ...partner, aktywny: cialo.aktywny, zmieniono: new Date().toISOString() };
      return HttpResponse.json(partner);
    }),
    http.post("*/api/partnerzy/:id/generuj", () => {
      zadania.push({ metoda: "POST", sciezka: "/generuj" });
      if (generowanie.status === 200) logi = [wpis(99, "Wygenerowano 1 plik: tyreworld.csv (3000 pozycji)"), ...logi];
      return HttpResponse.json(generowanie.cialo, { status: generowanie.status });
    }),
  );
}

const WYNIK_OK: WynikGenerowania = {
  pliki: [{ nazwa: "tyreworld.csv", kraj: null, liczbaWierszy: 3000, pominiete: 4, zapisany: true }, { nazwa: "pusty.csv", kraj: "AT", liczbaWierszy: 0, pominiete: 0, zapisany: false }],
  bledy: ["a", "b"], ostrzezenia: ["c"], pozycjeWybrane: 3004,
};

async function otworz() {
  window.history.pushState({}, "", "/partnerzy/1");
  render(<App />);
  await screen.findByText("Partner: TyreWorld");
}

beforeEach(() => {
  partner = startowy();
  logi = [];
  bledy = [];
  zapytaniaBledow = [];
  zadania = [];
  generowanie = { status: 200, cialo: WYNIK_OK };
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(uzytkownikZFixtura()));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
  zamockujApi();
});

describe("logi operacji", () => {
  it("pusty log pokazuje informację", async () => {
    await otworz();
    expect(await screen.findByTestId("text-logi-pusto")).toBeInTheDocument();
    expect(await screen.findByTestId("text-bledy-pusto")).toBeInTheDocument();
  });

  it("pokazuje wpisy z czasem i opisem", async () => {
    logi = [wpis(2, "Wygenerowano 1 plik: a.csv (10 pozycji)"), wpis(1, "Generowanie nie zapisało żadnego pliku (błędów: 2)")];
    await otworz();
    const lista = await screen.findByTestId("lista-logow");
    expect(within(lista).getAllByRole("listitem").map((l) => l.textContent)).toEqual([
      expect.stringContaining("Wygenerowano 1 plik: a.csv (10 pozycji)"),
      expect.stringContaining("Generowanie nie zapisało żadnego pliku"),
    ]);
  });

  it("Odśwież pobiera logi od nowa", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByTestId("text-logi-pusto");
    logi = [wpis(5, "Nowy wpis")];
    await uzytkownik.click(screen.getByTestId("button-logi-odswiez"));
    expect(await screen.findByTestId("log-5")).toHaveTextContent("Nowy wpis");
  });

  it("błąd serwera logów jest widoczny, a reszta strony działa", async () => {
    server.use(http.get("*/api/partnerzy/:id/logi", () => HttpResponse.json({ error: "Awaria logów" }, { status: 500 })));
    await otworz();
    expect(await screen.findByTestId("text-logi-blad")).toHaveTextContent("Awaria logów");
    expect(screen.getByTestId("button-generuj-teraz")).toBeEnabled();
  });
});

describe("błędy i ostrzeżenia", () => {
  it("lista z odznaką poziomu i filtrem wysyłanym do serwera", async () => {
    bledy = [blad(3, "ostrzezenie", "waga szacowana"), blad(2, "blad", "Brak wagi pozycji")];
    const uzytkownik = userEvent.setup();
    await otworz();
    const lista = await screen.findByTestId("lista-bledow");
    expect(within(lista).getByTestId("blad-3")).toHaveTextContent("ostrzeżenie");
    expect(within(lista).getByTestId("blad-2")).toHaveTextContent("błąd");

    await uzytkownik.selectOptions(screen.getByTestId("select-bledy-poziom"), "blad");
    await waitFor(() => expect(screen.queryByTestId("blad-3")).not.toBeInTheDocument());
    expect(screen.getByTestId("blad-2")).toBeInTheDocument();
    expect(zapytaniaBledow).toContain("blad");

    await uzytkownik.selectOptions(screen.getByTestId("select-bledy-poziom"), "ostrzezenie");
    expect(await screen.findByTestId("blad-3")).toBeInTheDocument();
    expect(screen.queryByTestId("blad-2")).not.toBeInTheDocument();
  });
});

describe("generuj teraz", () => {
  it("pokazuje wynik per plik, toast z podsumowaniem i odświeża logi", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByTestId("text-logi-pusto");
    await uzytkownik.click(screen.getByTestId("button-generuj-teraz"));

    const wynik = await screen.findByTestId("wynik-generowania");
    expect(within(wynik).getByTestId("wynik-plik-tyreworld.csv")).toHaveTextContent("zapisano (3000 pozycji, pominięto 4)");
    expect(within(wynik).getByTestId("wynik-plik-pusty.csv")).toHaveTextContent("NIE zapisano — poprzedni cennik zostaje");
    expect(await screen.findByText("Plików: 1, błędów: 2, ostrzeżeń: 1.")).toBeInTheDocument();
    expect(await screen.findByTestId("log-99")).toHaveTextContent("Wygenerowano 1 plik: tyreworld.csv");
    expect(zadania).toEqual([{ metoda: "POST", sciezka: "/generuj" }]);
  });

  it("brak zapisanych plików to komunikat o niepowodzeniu", async () => {
    generowanie = { status: 200, cialo: { pliki: [], bledy: ["Partner nie ma żadnego kraju — nie ma czego generować."], ostrzezenia: [], pozycjeWybrane: 0 } };
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-generuj-teraz"));
    expect(await screen.findByText("Nie zapisano żadnego pliku")).toBeInTheDocument();
    expect(await screen.findByText("Nie powstał żaden plik — szczegóły w błędach poniżej.")).toBeInTheDocument();
  });

  it("409 (generowanie już trwa) i 503 pokazują komunikat serwera", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    generowanie = { status: 409, cialo: { error: "Generowanie dla partnera 1 już trwa." } };
    await uzytkownik.click(screen.getByTestId("button-generuj-teraz"));
    expect(await screen.findByText("Generowanie dla partnera 1 już trwa.")).toBeInTheDocument();
    generowanie = { status: 503, cialo: { error: "Generowanie plików partnerów nie jest skonfigurowane na tym serwerze." } };
    await uzytkownik.click(screen.getByTestId("button-generuj-teraz"));
    expect(await screen.findByText(/nie jest skonfigurowane na tym serwerze/)).toBeInTheDocument();
  });
});

describe("aktywność na stronie szczegółów", () => {
  it("Aktywuj → PUT {aktywny:true}, status się zmienia; potem Dezaktywuj", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    expect(screen.getByTestId("badge-partner-szczegoly-status")).toHaveTextContent("Nieaktywny");
    await uzytkownik.click(screen.getByTestId("button-szczegoly-aktywnosc"));
    await waitFor(() => expect(screen.getByTestId("badge-partner-szczegoly-status")).toHaveTextContent("Aktywny"));
    expect(zadania.at(-1)).toEqual({ metoda: "PUT", sciezka: "/aktywny", cialo: { aktywny: true } });
    await uzytkownik.click(screen.getByTestId("button-szczegoly-aktywnosc"));
    await waitFor(() => expect(screen.getByTestId("badge-partner-szczegoly-status")).toHaveTextContent("Nieaktywny"));
    expect(zadania.at(-1)!.cialo).toEqual({ aktywny: false });
  });
});
