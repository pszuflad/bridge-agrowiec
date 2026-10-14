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
  kanalFtp: false, kanalEmail, emailSkrzynka: kanalEmail ? "zamowienia@example.test" : null,nazwaPliku: null, zmieniono: "2026-10-10T10:00:00.000Z", magazyny: [], wykluczenia: [], kraje: [], kolumny: [], polaObliczeniowe: [],
});
const naLiscie = (id: number, numer: string): ZamowienieNaLiscie => ({
  id, numerPartnera: numer, numerWlasny: null, status: "przyjete", bladImportu: null, dataZamowienia: "2024-02-02 11:27:11", waluta: "EUR", krajDostawy: "AT", pobrano: "2026-10-10T12:00:00.000Z", liczbaPozycji: 2,
});
const szczegoly = (id: number, numer: string): SzczegolyZamowienia => ({
  id, partnerId: 1, numerPartnera: numer, numerWlasny: null, status: "przyjete", bladImportu: null, mozeWalidowac: true, dataZamowienia: "2024-02-02 11:27:11", dataDostawy: "2024-02-02", waluta: "EUR", kosztDostawy: 0,
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
    http.get("*/api/partnerzy/:id/zamowienia/:zid/przesylki", () => HttpResponse.json({ przesylki: [], katalogSkonfigurowany: false })),
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

  it("pusty stan mówi, że kanał e-mail jest wyłączony; wyłączony przycisk ma podpowiedź (title)", async () => {
    kanalEmail = false;
    await otworz();
    expect(await screen.findByTestId("text-zamowienia-pusto")).toHaveTextContent("Kanał e-mail tego partnera jest wyłączony");
    expect(screen.getByTestId("opakowanie-odbierz")).toHaveAttribute("title", expect.stringContaining("kanału e-mail"));
  });

  it("przycisk „Sprawdź ponownie” zależy od pola mozeWalidowac z serwera (nie od listy statusów w panelu)", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [naLiscie(1, "A01")];
    szczegolyNadpisanie = { status: "wyslane", mozeWalidowac: false };
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    await screen.findByTestId("szczegoly-zamowienia-1");
    expect(screen.queryByTestId("button-zwaliduj-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-zamowienie-1")).toHaveAttribute("aria-controls", "szczegoly-zamowienia-1");
  });

  it("długi opis błędu w toaście jest przycięty, całość zostaje w ramce przy zamówieniu", async () => {
    const uzytkownik = userEvent.setup();
    const dlugi = `poz. 1: ${"bardzo długi powód ".repeat(40)}KONIEC`;
    zamowienia = [naLiscie(1, "A01")];
    walidacja = { status: 200, cialo: { ...szczegoly(1, "A01"), status: "blad_importu", bladImportu: dlugi, mozeWalidowac: true }, wywolania: 0 };
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    await uzytkownik.click(await screen.findByTestId("button-zwaliduj-1"));
    expect(await screen.findByText("Zamówienie nadal ma błędy")).toBeInTheDocument();
    expect(screen.queryByText(/KONIEC/)).not.toBeInTheDocument();
    expect(screen.getByText(/bardzo długi powód.*…$/)).toBeInTheDocument();
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

  it("„Podgląd do Selly” pobiera podgląd dopiero po kliknięciu: dopasowania, zamawiający i blokady", async () => {
    const uzytkownik = userEvent.setup();
    let zapytan = 0;
    server.use(
      http.get("*/api/partnerzy/1/zamowienia/1/podglad-selly", () => {
        zapytan++;
        return HttpResponse.json({
          zamawiajacy: { nazwa: "Adtyres SL", nip: "ATU1", ulica: null, kod: null, miasto: null, kraj: "AD" },
          dostawa: {}, waluta: "EUR", kosztDostawy: null,
          pozycje: [
            { lp: 1, kodPartnera: "011200284", nazwaPartnera: null, ilosc: 2, cena: 202, dopasowanie: { kod: "K1", nazwa: "OPONA", ean: "1", dostawca: "MO1", stan: 5, status: "aktywny", sellyProductId: 1, sellyVariantId: 2 } },
            { lp: 2, kodPartnera: "X", nazwaPartnera: null, ilosc: 1, cena: null, dopasowanie: null },
          ],
          blokady: ["Brak danych do faktury partnera: ulica (uzupełnij w ustawieniach partnera).", "Pozycje bez dopasowania w katalogu: 1 — do ręcznej weryfikacji."],
          ostrzezenia: [], zadanie: null, tworzenieWlaczone: true, kurs: null,
        });
      }),
    );
    zamowienia = [naLiscie(1, "A01")];
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    const przycisk = await screen.findByTestId("button-podglad-selly-1");
    expect(zapytan).toBe(0);
    await uzytkownik.click(przycisk);
    expect(await screen.findByTestId("podglad-zamawiajacy-1")).toHaveTextContent("Adtyres SL, NIP ATU1, AD");
    expect(screen.getByTestId("podglad-pozycja-1-1")).toHaveTextContent("→ K1 (OPONA, MO1)");
    expect(screen.getByTestId("podglad-pozycja-1-2")).toHaveTextContent("do ręcznej weryfikacji");
    expect(screen.getByTestId("podglad-blokady-1")).toHaveTextContent("Brak danych do faktury");
    expect(screen.queryByTestId("podglad-gotowe-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-selly-utworz-1")).toBeDisabled(); // blokady podglądu
  });

  const podgladGotowy = (tworzenieWlaczone: boolean) => ({
    zamawiajacy: { nazwa: "Adtyres SL", nip: "ATU1", ulica: "Calle 1", kod: "AD500", miasto: "Andorra", kraj: "AD" },
    dostawa: {}, waluta: "EUR", kosztDostawy: null,
    pozycje: [{ lp: 1, kodPartnera: "A", nazwaPartnera: null, ilosc: 1, cena: 10, dopasowanie: { kod: "K1", nazwa: "OPONA", ean: "1", dostawca: "MO1", stan: 5, status: "aktywny", sellyProductId: 1, sellyVariantId: 2 } }],
    blokady: [], ostrzezenia: ["Zamówienie nie zawiera pełnego adresu dostawy (brak: ulica)."], zadanie: { status_id: 3, products: [] }, tworzenieWlaczone, kurs: { kurs: 4.25, data: "2026-10-12" },
  });

  it("„Utwórz w Selly”: dwa kliknięcia (przycisk + potwierdzenie), jedno żądanie POST, ciało i ostrzeżenia widoczne", async () => {
    const uzytkownik = userEvent.setup();
    let wyslane = 0;
    server.use(
      http.get("*/api/partnerzy/1/zamowienia/1/podglad-selly", () => HttpResponse.json(podgladGotowy(true))),
      http.post("*/api/partnerzy/1/zamowienia/1/utworz-w-selly", () => (wyslane++, HttpResponse.json({ numerWlasny: "10/2026", idSelly: 100 }))),
    );
    zamowienia = [naLiscie(1, "A01")];
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    await uzytkownik.click(await screen.findByTestId("button-podglad-selly-1"));
    expect(await screen.findByTestId("podglad-gotowe-1")).toBeInTheDocument();
    expect(screen.getByTestId("podglad-ostrzezenia-1")).toHaveTextContent("pełnego adresu dostawy");
    expect(screen.getByTestId("podglad-zadanie-1")).toHaveTextContent('"status_id": 3');
    await uzytkownik.click(screen.getByTestId("button-selly-utworz-1"));
    expect(wyslane).toBe(0); // dopiero potwierdzenie wysyła
    await uzytkownik.click(await screen.findByTestId("button-selly-potwierdz-1"));
    expect(await screen.findByText("Zamówienie utworzone w Selly")).toBeInTheDocument();
    expect(wyslane).toBe(1);
  });

  it("zamówienie zablokowane w „wysylanie”: podgląd pokazuje kurs i przycisk „zwolnij”, który woła serwer", async () => {
    const uzytkownik = userEvent.setup();
    let zwolniono = 0;
    server.use(
      http.get("*/api/partnerzy/1/zamowienia/1/podglad-selly", () => HttpResponse.json({ ...podgladGotowy(true), zadanie: null, blokady: ["Zamówienie jest w trakcie wysyłania do Selly albo poprzednia próba nie dała jednoznacznej odpowiedzi — sprawdź w Selly, a potem „Zwolnij”."] })),
      http.post("*/api/partnerzy/1/zamowienia/1/zwolnij-wysylanie", () => (zwolniono++, HttpResponse.json({ ok: true }))),
    );
    zamowienia = [naLiscie(1, "A01")];
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    await uzytkownik.click(await screen.findByTestId("button-podglad-selly-1"));
    expect(await screen.findByTestId("podglad-kurs-1")).toHaveTextContent("po kursie 4.25 (tabela NBP z 2026-10-12)");
    expect(screen.getByTestId("button-selly-utworz-1")).toBeDisabled();
    await uzytkownik.click(screen.getByTestId("button-selly-zwolnij-1"));
    expect(await screen.findByText("Zamówienie zwolnione")).toBeInTheDocument();
    expect(zwolniono).toBe(1);
  });

  it("„Utwórz w Selly” jest nieaktywne, gdy serwer ma wyłączoną flagę, i mówi dlaczego", async () => {
    const uzytkownik = userEvent.setup();
    server.use(http.get("*/api/partnerzy/1/zamowienia/1/podglad-selly", () => HttpResponse.json(podgladGotowy(false))));
    zamowienia = [naLiscie(1, "A01")];
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    await uzytkownik.click(await screen.findByTestId("button-podglad-selly-1"));
    expect(await screen.findByTestId("button-selly-utworz-1")).toBeDisabled();
    expect(screen.getByTestId("podglad-wylaczone-1")).toHaveTextContent("PARTNERZY_SELLY_ZAMOWIENIA");
  });

  it("odmowa Selly pokazuje komunikat serwera i nie zostawia zamówienia „w toku”", async () => {
    const uzytkownik = userEvent.setup();
    server.use(
      http.get("*/api/partnerzy/1/zamowienia/1/podglad-selly", () => HttpResponse.json(podgladGotowy(true))),
      http.post("*/api/partnerzy/1/zamowienia/1/utworz-w-selly", () => HttpResponse.json({ error: "Selly odrzuciło zamówienie: 422" }, { status: 502 })),
    );
    zamowienia = [naLiscie(1, "A01")];
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    await uzytkownik.click(await screen.findByTestId("button-podglad-selly-1"));
    await uzytkownik.click(await screen.findByTestId("button-selly-utworz-1"));
    await uzytkownik.click(await screen.findByTestId("button-selly-potwierdz-1"));
    expect(await screen.findByText("Nie utworzono zamówienia w Selly")).toBeInTheDocument();
    expect(await screen.findByText(/Selly odrzuciło zamówienie: 422/)).toBeInTheDocument();
    expect(await screen.findByTestId("button-selly-utworz-1")).toBeInTheDocument(); // wróciło do stanu przed potwierdzeniem
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

  it("po błędzie „Sprawdź ponownie” (np. 409) szczegóły zamówienia są pobierane od nowa, żeby przycisk nie był nieaktualny", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [naLiscie(1, "A01")];
    walidacja = { status: 409, cialo: { error: "Zamówienie ma status „wyslane” i nie podlega ponownej walidacji." }, wywolania: 0 };
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    const przycisk = await screen.findByTestId("button-zwaliduj-1");
    const przed = zapytaniaSzczegolow.length;
    await uzytkownik.click(przycisk);
    expect(await screen.findByText("Nie udało się sprawdzić zamówienia")).toBeInTheDocument();
    await waitFor(() => expect(zapytaniaSzczegolow.length).toBeGreaterThan(przed));
  });

  it("adres dostawy z formatu TyreWorld (niemieckie klucze) ma polskie etykiety; uwaga klienta widoczna, puste pola pomijane", async () => {
    const uzytkownik = userEvent.setup();
    zamowienia = [naLiscie(1, "2026-100000001")];
    szczegolyNadpisanie = {
      dostawa: { name: "Max Mustermann", strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", lkz: "DE", land: "", telefon: "+49 000", neutralversand: "true", bemerkung: "Bitte anrufen" },
    };
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
    const dostawa = await screen.findByTestId("dostawa-1");
    for (const etykieta of ["Odbiorca", "Ulica", "Kod pocztowy", "Miejscowość", "Kraj (kod)", "Telefon", "Wysyłka neutralna", "Uwaga klienta"]) expect(dostawa).toHaveTextContent(etykieta);
    expect(dostawa).not.toHaveTextContent("strasse");
    expect(within(dostawa).queryByText(/^Kraj$/)).not.toBeInTheDocument(); // puste `land` nie tworzy wiersza „Kraj” (jest tylko „Kraj (kod)”)
  });

  describe("tracking: numer listu przewozowego (ticket 256)", () => {
    const przesylka = (nad: Record<string, unknown> = {}) => ({
      id: 7, zamowienieId: 1, przewoznik: "GEIS", numerPrzesylki: "PL123", typ: "delivery", wyslano: "2026-10-13T13:30:00+02:00",
      pozycje: [{ pozycjaId: 1, ilosc: 2 }], plikNazwa: "tracking_A01_20261013-133000_7.csv", plikStatus: "zapisany", plikBlad: null, ...nad,
    });

    it("wpisanie numeru listu: ilości domyślnie = wszystko niewysłane; POST zawiera przewoźnika, numer, typ i ilości; sukces pokazuje komunikat i listę przesyłek", async () => {
      const uzytkownik = userEvent.setup();
      let lista: object[] = [];
      let wyslane: Record<string, unknown> | null = null;
      server.use(
        http.get("*/api/partnerzy/1/zamowienia/1/przesylki", () => HttpResponse.json({ przesylki: lista, katalogSkonfigurowany: true })),
        http.post("*/api/partnerzy/1/zamowienia/1/przesylki", async ({ request }) => {
          wyslane = (await request.json()) as Record<string, unknown>;
          lista = [przesylka()];
          return HttpResponse.json({ przesylki: lista, plik: "zapisany" });
        }),
      );
      zamowienia = [naLiscie(1, "A01")];
      await otworz();
      await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
      expect(await screen.findByTestId("input-ilosc-1-1")).toHaveValue("2");
      expect(screen.getByTestId("input-ilosc-1-2")).toHaveValue("1");
      expect(screen.getByTestId("button-dodaj-przesylke-1")).toBeDisabled(); // bez przewoźnika i numeru
      await uzytkownik.type(screen.getByTestId("input-przewoznik-1"), "GEIS");
      await uzytkownik.type(screen.getByTestId("input-numer-listu-1"), "PL123");
      await uzytkownik.clear(screen.getByTestId("input-ilosc-1-2"));
      await uzytkownik.type(screen.getByTestId("input-ilosc-1-2"), "0"); // druga pozycja nie jedzie w tej paczce
      await uzytkownik.click(screen.getByTestId("button-dodaj-przesylke-1"));
      expect(await screen.findByText("Numer listu zapisany")).toBeInTheDocument();
      expect(wyslane).toEqual({ przewoznik: "GEIS", numerPrzesylki: "PL123", typ: "delivery", pozycje: [{ pozycjaId: 1, ilosc: 2 }] });
      expect(await screen.findByTestId("przesylka-7")).toHaveTextContent("PL123");
      expect(screen.getByTestId("status-pliku-7")).toHaveTextContent("plik zapisany u partnera");
    });

    it("błąd serwera przy zapisie (np. za dużo sztuk) pokazuje komunikat; ilość nienumeryczna blokuje żądanie", async () => {
      const uzytkownik = userEvent.setup();
      let posty = 0;
      server.use(http.post("*/api/partnerzy/1/zamowienia/1/przesylki", () => (posty++, HttpResponse.json({ error: "Pozycja 1: zamówiono 2, wysłano już 2" }, { status: 409 }))));
      zamowienia = [naLiscie(1, "A01")];
      await otworz();
      await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
      await uzytkownik.type(await screen.findByTestId("input-przewoznik-1"), "GEIS");
      await uzytkownik.type(screen.getByTestId("input-numer-listu-1"), "PL1");
      await uzytkownik.clear(screen.getByTestId("input-ilosc-1-1"));
      await uzytkownik.type(screen.getByTestId("input-ilosc-1-1"), "abc");
      await uzytkownik.click(screen.getByTestId("button-dodaj-przesylke-1"));
      expect(await screen.findByText(/Ilości w przesyłce muszą być liczbami całkowitymi/)).toBeInTheDocument();
      expect(posty).toBe(0);
      await uzytkownik.clear(screen.getByTestId("input-ilosc-1-1"));
      await uzytkownik.type(screen.getByTestId("input-ilosc-1-1"), "2");
      await uzytkownik.click(screen.getByTestId("button-dodaj-przesylke-1"));
      expect(await screen.findByText(/wysłano już 2/)).toBeInTheDocument();
      expect(posty).toBe(1);
    });

    it("przesyłka z błędem zapisu pliku: czerwony status, powód i „Ponów zapis pliku”; „Pokaż plik” pokazuje treść CSV", async () => {
      const uzytkownik = userEvent.setup();
      let ponowione = 0;
      server.use(
        http.get("*/api/partnerzy/1/zamowienia/1/przesylki", () => HttpResponse.json({ przesylki: [przesylka({ plikStatus: "blad", plikBlad: "Zapis pliku trackingu do /x nie powiódł się: ENOENT" })], katalogSkonfigurowany: true })),
        http.get("*/api/partnerzy/1/zamowienia/1/przesylki/7/plik", () => HttpResponse.json({ nazwa: "tracking_A01.csv", tresc: "order_id;platform_order_id\nZAM-1;A01\n" })),
        http.post("*/api/partnerzy/1/zamowienia/1/przesylki/7/ponow", () => (ponowione++, HttpResponse.json({ przesylki: [przesylka()], plik: "zapisany" }))),
      );
      zamowienia = [naLiscie(1, "A01")];
      await otworz();
      await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
      expect(await screen.findByTestId("status-pliku-7")).toHaveTextContent("błąd zapisu pliku");
      expect(screen.getByTestId("blad-pliku-7")).toHaveTextContent("ENOENT");
      await uzytkownik.click(screen.getByTestId("button-plik-7"));
      expect(await screen.findByTestId("plik-przesylki-7")).toHaveTextContent("ZAM-1;A01");
      await uzytkownik.click(screen.getByTestId("button-ponow-7"));
      expect(await screen.findByText("Plik trackingu zapisany ponownie")).toBeInTheDocument();
      expect(ponowione).toBe(1);
    });

    it("zamówienie niezatwierdzone (status „nowe”): formularz niedostępny, jest wyjaśnienie", async () => {
      const uzytkownik = userEvent.setup();
      szczegolyNadpisanie = { status: "nowe" };
      zamowienia = [naLiscie(1, "A01")];
      await otworz();
      await uzytkownik.click(await screen.findByTestId("button-zamowienie-1"));
      expect(await screen.findByTestId("przesylki-niedostepne-1")).toHaveTextContent("dopiero do zamówienia przyjętego");
      expect(screen.queryByTestId("button-dodaj-przesylke-1")).not.toBeInTheDocument();
    });
  });
});
