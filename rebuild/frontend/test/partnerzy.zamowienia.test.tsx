/** Zamówienia odebrane od partnera na stronie partnera: lista i szczegóły, tylko odczyt (ticket 230, PRT-7.6a). MSW od zera. */
import { render, screen, waitFor, within } from "@testing-library/react";
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
  kanalFtp: false, kanalEmail, emailSkrzynka: kanalEmail ? "zamowienia@example.test" : null, zmieniono: "2026-10-10T10:00:00.000Z", magazyny: [], wykluczenia: [], kraje: [], kolumny: [], polaObliczeniowe: [],
});
const naLiscie = (id: number, numer: string): ZamowienieNaLiscie => ({
  id, numerPartnera: numer, numerWlasny: null, status: "przyjete", bladImportu: null, dataZamowienia: "2024-02-02 11:27:11", waluta: "EUR", krajDostawy: "AT", pobrano: "2026-10-10T12:00:00.000Z", liczbaPozycji: 2,
});
const szczegoly = (id: number, numer: string): SzczegolyZamowienia => ({
  id, partnerId: 1, numerPartnera: numer, numerWlasny: null, status: "przyjete", bladImportu: null, dataZamowienia: "2024-02-02 11:27:11", dataDostawy: "2024-02-02", waluta: "EUR", kosztDostawy: 0,
  krajDostawy: "AT", pobrano: "2026-10-10T12:00:00.000Z", faktura: {}, dostawa: { CUSTOMERNAME: "Jan Kowalski", COUNTRY: "AT", PHONE: "" },
  pozycje: [
    { id: 1, lp: 1, kod: "011200284", nazwa: "Ceat Farmax R70", ilosc: 2, cenaSprzedazy: 202, blad: null },
    { id: 2, lp: 2, kod: "0102 00001", nazwa: null, ilosc: 1, cenaSprzedazy: null, blad: null },
  ],
});

let zamowienia: ZamowienieNaLiscie[];
let odbior: { status: number; cialo: object; wywolania: number };
let kanalEmail: boolean;
let szczegolyNadpisanie: Partial<SzczegolyZamowienia> | null;
let walidacja: { status: number; cialo: object; wywolania: number };
let zapytaniaSzczegolow: number[];

function zamockujApi() {
  server.use(
    http.get("*/api/partnerzy/magazyny", () => HttpResponse.json({ magazyny: [] })),
    http.get("*/api/partnerzy/:id/logi", () => HttpResponse.json({ logi: [] })),
    http.get("*/api/partnerzy/:id/error-log", () => HttpResponse.json({ bledy: [] })),
    http.get("*/api/partnerzy/:id/zamowienia/:zid", ({ params }) => {
      zapytaniaSzczegolow.push(Number(params.zid));
      const z = zamowienia.find((x) => x.id === Number(params.zid));
      return z ? HttpResponse.json({ ...szczegoly(z.id, z.numerPartnera), ...szczegolyNadpisanie }) : HttpResponse.json({ error: "Nie ma takiego zamówienia tego partnera." }, { status: 404 });
    }),
    http.post("*/api/partnerzy/:id/zamowienia/:zid/waliduj", () => {
      walidacja.wywolania++;
      return HttpResponse.json(walidacja.cialo, { status: walidacja.status });
    }),
    http.get("*/api/partnerzy/:id/zamowienia", () => HttpResponse.json({ zamowienia })),
    http.post("*/api/partnerzy/:id/zamowienia/odbierz", () => {
      odbior.wywolania++;
      if (odbior.status === 200) zamowienia = [naLiscie(9, "NOWE9"), ...zamowienia];
      return HttpResponse.json(odbior.cialo, { status: odbior.status });
    }),
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
  kanalEmail = true;
  szczegolyNadpisanie = null;
  walidacja = { status: 200, cialo: szczegoly(1, "A01"), wywolania: 0 };
  odbior = { status: 200, cialo: { polaczono: true, powod: null, wiadomosci: 1, nowe: 1, duplikaty: 0, bledy: 0 }, wywolania: 0 };
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
    expect(wiersze.map((w) => w.textContent)).toEqual([expect.stringMatching(/A02.*przyjęte.*AT · 2 poz\./), expect.stringMatching(/A01.*przyjęte.*AT · 2 poz\./)]);
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
    expect(screen.getByTestId("dostawa-1")).toHaveTextContent("Odbiorca");
    expect(screen.getByTestId("dostawa-1")).not.toHaveTextContent("Telefon"); // puste pola pomijane
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

  it("pełna strona wyników (limit) pokazuje informację o obciętej liście", async () => {
    zamowienia = Array.from({ length: 50 }, (_, i) => naLiscie(i + 1, `A${i + 1}`));
    await otworz();
    expect(await screen.findByTestId("text-zamowienia-obcieta")).toHaveTextContent("50 najnowszych");
  });

  it("Odśwież pobiera od nowa także szczegóły rozwiniętego zamówienia", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [naLiscie(1, "A01")];
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    await screen.findByTestId("szczegoly-zamowienia-1");
    const przed = zapytaniaSzczegolow.length;
    await uzytkownik.click(screen.getByTestId("button-zamowienia-odswiez"));
    await waitFor(() => expect(zapytaniaSzczegolow.length).toBeGreaterThan(przed));
  });

  it("„Odbierz teraz” odbiera pocztę, odświeża listę i pokazuje wynik", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByTestId("text-zamowienia-pusto");
    await uzytkownik.click(screen.getByTestId("button-zamowienia-odbierz"));
    expect(await screen.findByTestId("zamowienie-9")).toHaveTextContent("NOWE9");
    expect(odbior.wywolania).toBe(1);
    expect(await screen.findByText("Odebrano pocztę")).toBeInTheDocument();
  });

  it("brak połączenia: pokazuje powód z serwera (bez sekretów) i nie udaje sukcesu", async () => {
    const uzytkownik = userEvent.setup();
    odbior = { status: 200, cialo: { polaczono: false, powod: "Odbiór e-mail pominięty: brak PARTNERZY_IMAP_HOST w konfiguracji serwera.", wiadomosci: 0, nowe: 0, duplikaty: 0, bledy: 0 }, wywolania: 0 };
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienia-odbierz"));
    expect(await screen.findByText("Nie odebrano zamówień")).toBeInTheDocument();
    expect(await screen.findByText(/brak PARTNERZY_IMAP_HOST/)).toBeInTheDocument();
  });

  it("błąd serwera przy odbiorze (np. 409 — odbiór trwa) jest widoczny", async () => {
    const uzytkownik = userEvent.setup();
    odbior = { status: 409, cialo: { error: "Odbiór zamówień dla tego partnera już trwa — spróbuj za chwilę." }, wywolania: 0 };
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienia-odbierz"));
    expect(await screen.findByText("Odbiór zamówień nie powiódł się")).toBeInTheDocument();
    expect(await screen.findByText(/już trwa/)).toBeInTheDocument();
  });

  it("bez kanału e-mail przycisk jest wyłączony i jest podpowiedź", async () => {
    kanalEmail = false;
    await otworz();
    expect(await screen.findByTestId("button-zamowienia-odbierz")).toBeDisabled();
    expect(screen.getByTestId("text-zamowienia-kanal")).toBeInTheDocument();
  });

  it("odbiór przerwany po połączeniu (powód przy polaczono:true) nie jest pokazany jako sukces", async () => {
    const uzytkownik = userEvent.setup();
    odbior = { status: 200, cialo: { polaczono: true, powod: "Odbiór przerwany: SEARCH failed", wiadomosci: 0, nowe: 0, duplikaty: 0, bledy: 1 }, wywolania: 0 };
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienia-odbierz"));
    expect(await screen.findByText("Odbiór przerwany")).toBeInTheDocument();
    expect(screen.queryByText("Odebrano pocztę")).not.toBeInTheDocument();
  });

  const zBledem = (): Partial<SzczegolyZamowienia> => ({
    status: "blad_importu",
    bladImportu: "poz. 2 (0102 00001): nieznany kod",
    pozycje: [
      { id: 1, lp: 1, kod: "011200284", nazwa: "Ceat Farmax R70", ilosc: 2, cenaSprzedazy: 202, blad: null },
      { id: 2, lp: 2, kod: "0102 00001", nazwa: null, ilosc: 1, cenaSprzedazy: null, blad: "nieznany kod" },
    ],
  });

  it("zamówienie z błędem importu: czerwony status, opis zbiorczy, powód przy pozycji i informacja o braku powiadomienia partnera", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [{ ...naLiscie(1, "A01"), status: "blad_importu", bladImportu: "poz. 2 (0102 00001): nieznany kod" }];
    szczegolyNadpisanie = zBledem();
    await otworz();
    expect(await screen.findByTestId("status-zamowienia-1")).toHaveTextContent("błąd importu");
    await uzytkownik.click(screen.getByTestId("button-zamowienie-1"));
    const blad = await screen.findByTestId("blad-importu-1");
    expect(blad).toHaveTextContent("nieznany kod");
    expect(blad).toHaveTextContent("nie wysyła partnerowi automatycznego powiadomienia");
    expect(screen.getByTestId("pozycja-blad-1-2")).toHaveTextContent("nieznany kod");
    expect(screen.getByTestId("pozycja-blad-1-1")).toBeEmptyDOMElement();
  });

  it("„Sprawdź ponownie” woła walidację i pokazuje wynik; zamówienie w porządku nie ma ramki błędu", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [naLiscie(1, "A01")];
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    expect(screen.queryByTestId("blad-importu-1")).not.toBeInTheDocument();
    await uzytkownik.click(await screen.findByTestId("button-zwaliduj-1"));
    expect(await screen.findByText("Zamówienie w porządku")).toBeInTheDocument();
    expect(walidacja.wywolania).toBe(1);
  });

  it("ponowna walidacja nadal z błędami pokazuje opis błędów; błąd serwera jest widoczny", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [naLiscie(1, "A01")];
    walidacja = { status: 200, cialo: { ...szczegoly(1, "A01"), ...zBledem() }, wywolania: 0 };
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    await uzytkownik.click(await screen.findByTestId("button-zwaliduj-1"));
    expect(await screen.findByText("Zamówienie nadal ma błędy")).toBeInTheDocument();
    walidacja = { status: 404, cialo: { error: "Nie ma takiego zamówienia tego partnera." }, wywolania: 0 };
    await uzytkownik.click(screen.getByTestId("button-zwaliduj-1"));
    expect(await screen.findByText("Nie udało się sprawdzić zamówienia")).toBeInTheDocument();
  });
});
