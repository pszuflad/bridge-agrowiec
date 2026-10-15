/** Konfiguracja partnera: pola obliczeniowe, kolumny pliku i podgląd (ticket 224, PRT-5.3). MSW od zera. */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { bledyPol, type SzczegolyPartnera, type WynikPodgladu } from "@/pages/partnerzy/api";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const startowy = (): SzczegolyPartnera => ({
  id: 1, nazwa: "TyreWorld", aktywny: false, stanMin: 2, zaokraglanie: "grosz", harmonogramMinuty: null, tolerancjaCenyProc: null, formatPliku: "csv", csvSeparator: ";",
  kanalFtp: false, kanalEmail: false, emailSkrzynka: null,nazwaPliku: null, zmieniono: "2026-10-10T10:00:00.000Z", magazyny: [], wykluczenia: [],
  kraje: [{ id: 1, partnerId: 1, kraj: "FR", narzutProc: 12, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 0, ostatniKurs: null }, { id: 2, partnerId: 1, kraj: "DE", narzutProc: 10, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 0, ostatniKurs: null }],
  kolumny: [{ id: 1, partnerId: 1, pozycja: 1, nazwaWPliku: "CatNumber", zrodloTyp: "katalog", zrodlo: "kod" }, { id: 2, partnerId: 1, pozycja: 2, nazwaWPliku: "FR euro nett", zrodloTyp: "cena", zrodlo: "FR" }],
  polaObliczeniowe: [{ id: 1, partnerId: 1, nazwa: "DAP", formula: "cena_FR + 10" }],
});

let partner: SzczegolyPartnera;
let zadania: { metoda: string; sciezka: string; cialo: unknown }[] = [];
let blad: { status: number; cialo: object } | null = null;
let podglad: { status: number; cialo: object } = { status: 200, cialo: {} };

function zamockujApi() {
  server.use(
    http.get("*/api/partnerzy/magazyny", () => HttpResponse.json({ magazyny: [] })),
    http.get("*/api/partnerzy/:id/zamowienia", () => HttpResponse.json({ zamowienia: [] })),
    http.get("*/api/partnerzy/:id/logi", () => HttpResponse.json({ logi: [] })),
    http.get("*/api/partnerzy/:id/error-log", () => HttpResponse.json({ bledy: [] })),
    http.get("*/api/partnerzy/:id", () => HttpResponse.json(partner)),
    http.put("*/api/partnerzy/:id/pola-obliczeniowe", async ({ request }) => {
      const cialo = (await request.json()) as { pola: { nazwa: string; formula: string }[] };
      zadania.push({ metoda: "PUT", sciezka: "/pola-obliczeniowe", cialo });
      if (blad) return HttpResponse.json(blad.cialo, { status: blad.status });
      partner = { ...partner, zmieniono: new Date().toISOString(), polaObliczeniowe: cialo.pola.map((p, i) => ({ id: i + 1, partnerId: 1, ...p })) };
      return HttpResponse.json(partner);
    }),
    http.put("*/api/partnerzy/:id/kolumny", async ({ request }) => {
      const cialo = (await request.json()) as { kolumny: { nazwaWPliku: string; zrodloTyp: "katalog" | "cena" | "pole"; zrodlo: string }[] };
      zadania.push({ metoda: "PUT", sciezka: "/kolumny", cialo });
      partner = { ...partner, zmieniono: new Date().toISOString(), kolumny: cialo.kolumny.map((k, i) => ({ id: i + 1, partnerId: 1, pozycja: i + 1, ...k })) };
      return HttpResponse.json(partner);
    }),
    http.get("*/api/partnerzy/:id/podglad/plik", ({ request }) => {
      const nazwa = new URL(request.url).searchParams.get("nazwa");
      zadania.push({ metoda: "GET", sciezka: `/podglad/plik?nazwa=${nazwa}`, cialo: null });
      return nazwa === "zepsuty.csv" ? HttpResponse.json({ error: "Pobranie pliku nie powiodło się." }, { status: 500 }) : new HttpResponse("CatNumber;FR euro nett\nA;100.00\nB;200.00\n", { headers: { "Content-Type": "text/csv; charset=utf-8" } });
    }),
    http.post("*/api/partnerzy/:id/podglad", () => {
      zadania.push({ metoda: "POST", sciezka: "/podglad", cialo: null });
      return HttpResponse.json(podglad.cialo, { status: podglad.status });
    }),
  );
}

async function otworz() {
  window.history.pushState({}, "", "/partnerzy/1");
  render(<App />);
  await screen.findByText("Partner: TyreWorld");
}

beforeEach(() => {
  partner = startowy();
  zadania = [];
  blad = null;
  podglad = { status: 200, cialo: {} };
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(uzytkownikZFixtura()));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
  zamockujApi();
});

describe("pola obliczeniowe", () => {
  it("pokazuje zapisane pola i podpowiada zmienne, w tym ceny krajów partnera", async () => {
    await otworz();
    expect(screen.getByTestId("input-pole-nazwa-0")).toHaveValue("DAP");
    expect(screen.getByTestId("input-pole-formula-0")).toHaveValue("cena_FR + 10");
    expect(screen.getByText(/zakup, stan, waga, dlugosc, szerokosc_paczki, wysokosc, cena_FR, cena_DE/)).toBeInTheDocument();
  });

  it("dodaje, edytuje i zapisuje pola jedną operacją PUT", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-pole-dodaj"));
    await uzytkownik.type(screen.getByTestId("input-pole-nazwa-1"), "Za100");
    await uzytkownik.type(screen.getByTestId("input-pole-formula-1"), "zaokr(cena_DE * 1.1, 0)");
    await uzytkownik.click(screen.getByTestId("button-pola-zapisz"));
    await waitFor(() => expect(zadania).toEqual([{ metoda: "PUT", sciezka: "/pola-obliczeniowe", cialo: { pola: [{ nazwa: "DAP", formula: "cena_FR + 10" }, { nazwa: "Za100", formula: "zaokr(cena_DE * 1.1, 0)" }] } }]));
    expect(await screen.findByText("Zapisano pola obliczeniowe")).toBeInTheDocument();
  });

  it("błąd formuły z serwera pojawia się przy właściwym polu, z numerem znaku", async () => {
    blad = { status: 400, cialo: { error: "Formuły zawierają błędy.", bledy: [{ indeks: 0, nazwa: "DAP", komunikat: "Formuła kończy się za wcześnie.", pozycja: 7 }] } };
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-pola-zapisz"));
    expect(await screen.findByTestId("text-pole-blad-0")).toHaveTextContent("Formuła kończy się za wcześnie. (znak 8)");
    // edycja pola zdejmuje komunikat
    await uzytkownik.type(screen.getByTestId("input-pole-formula-0"), "x");
    expect(screen.queryByTestId("text-pole-blad-0")).not.toBeInTheDocument();
  });

  it("usuwa pole", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-pole-usun-0"));
    expect(screen.queryByTestId("row-pole-0")).not.toBeInTheDocument();
    await uzytkownik.click(screen.getByTestId("button-pola-zapisz"));
    await waitFor(() => expect(zadania[0]!.cialo).toEqual({ pola: [] }));
  });
});

describe("kolumny pliku", () => {
  it("pokazuje kolumny w kolejności i źródła", async () => {
    await otworz();
    expect(screen.getByTestId("input-kolumna-nazwa-0")).toHaveValue("CatNumber");
    expect(screen.getByTestId("select-kolumna-typ-0")).toHaveValue("katalog");
    expect(screen.getByTestId("select-kolumna-zrodlo-0")).toHaveValue("kod");
    expect(screen.getByTestId("select-kolumna-typ-1")).toHaveValue("cena");
    expect(screen.getByTestId("select-kolumna-zrodlo-1")).toHaveValue("FR");
  });

  it("przesuwa w górę i w dół, dodaje kolumnę i zapisuje w nowej kolejności", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-kolumna-gora-1"));
    await uzytkownik.click(screen.getByTestId("button-kolumna-dodaj"));
    await uzytkownik.type(screen.getByTestId("input-kolumna-nazwa-2"), "DAP");
    await uzytkownik.selectOptions(screen.getByTestId("select-kolumna-typ-2"), "pole");
    expect(screen.getByTestId("select-kolumna-zrodlo-2")).toHaveValue("DAP");
    await uzytkownik.click(screen.getByTestId("button-kolumny-zapisz"));
    await waitFor(() =>
      expect(zadania).toEqual([{ metoda: "PUT", sciezka: "/kolumny", cialo: { kolumny: [
        { nazwaWPliku: "FR euro nett", zrodloTyp: "cena", zrodlo: "FR" },
        { nazwaWPliku: "CatNumber", zrodloTyp: "katalog", zrodlo: "kod" },
        { nazwaWPliku: "DAP", zrodloTyp: "pole", zrodlo: "DAP" },
      ] } }]),
    );
  });

  it("pierwszy nie ma przycisku „w górę”, ostatni „w dół”", async () => {
    await otworz();
    expect(screen.getByTestId("button-kolumna-gora-0")).toBeDisabled();
    expect(screen.getByTestId("button-kolumna-dol-1")).toBeDisabled();
  });

  it("zmiana typu źródła ustawia pierwsze dostępne źródło; opcje cen to kraje partnera", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.selectOptions(screen.getByTestId("select-kolumna-typ-0"), "cena");
    const zrodlo = screen.getByTestId("select-kolumna-zrodlo-0");
    expect(zrodlo).toHaveValue("FR");
    expect(within(zrodlo).getAllByRole("option").map((o) => o.getAttribute("value"))).toEqual(["FR", "DE"]);
  });

  it("kolumna wskazująca nieistniejący kraj jest oznaczona", async () => {
    partner = { ...partner, kolumny: [{ id: 1, partnerId: 1, pozycja: 1, nazwaWPliku: "IT euro nett", zrodloTyp: "cena", zrodlo: "IT" }] };
    await otworz();
    expect(screen.getByTestId("text-kolumna-brak-0")).toHaveTextContent("źródło nie istnieje");
    expect(screen.getByTestId("select-kolumna-zrodlo-0")).toHaveValue("IT");
  });

  it("usuwa kolumnę; pusta lista pokazuje informację", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-kolumna-usun-1"));
    await uzytkownik.click(screen.getByTestId("button-kolumna-usun-0"));
    expect(screen.getByTestId("text-kolumny-pusto")).toBeInTheDocument();
  });
});

describe("podgląd", () => {
  const WYNIK: WynikPodgladu = {
    pliki: [{ nazwa: "tyreworld.csv", kraj: null, tekst: "CatNumber;FR euro nett\nA;100.00\n", liczbaWierszy: 1 }],
    bledy: ["Błąd kalkulacji X (FR): Brak wagi pozycji."],
    ostrzezenia: ["Y: waga szacowana (mniej pewna)."],
    pozycjeWybrane: 3000,
  };

  it("pokazuje tekst plików, błędy i ostrzeżenia", async () => {
    podglad = { status: 200, cialo: WYNIK };
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-podglad"));
    const plik = await screen.findByTestId("podglad-plik-tyreworld.csv");
    expect(plik.querySelector("pre")).toHaveTextContent("CatNumber;FR euro nett A;100.00");
    expect(screen.getByText("Pozycji do eksportu: 3000.")).toBeInTheDocument();
    expect(screen.getByTestId("lista-podglad-bledy")).toHaveTextContent("Brak wagi pozycji");
    expect(screen.getByTestId("lista-podglad-ostrzezenia")).toHaveTextContent("waga szacowana");
  });

  it("„Pobierz cały plik” pobiera kompletny plik z serwera przez kotwicę z nazwą pliku (ticket 260)", async () => {
    podglad = { status: 200, cialo: WYNIK };
    const utworzone: Blob[] = [];
    const stary = { u: URL.createObjectURL, r: URL.revokeObjectURL };
    URL.createObjectURL = (b: Blob | MediaSource) => (utworzone.push(b as Blob), "blob:test");
    URL.revokeObjectURL = () => undefined;
    const nazwy: string[] = [];
    const klik = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { nazwy.push(this.download); });
    try {
      const uzytkownik = userEvent.setup();
      await otworz();
      await uzytkownik.click(screen.getByTestId("button-podglad"));
      await uzytkownik.click(await screen.findByTestId("button-pobierz-tyreworld.csv"));
      await waitFor(() => expect(nazwy).toEqual(["tyreworld.csv"]));
      expect(zadania.some((z) => z.sciezka === "/podglad/plik?nazwa=tyreworld.csv")).toBe(true);
      expect(await utworzone[0]!.text()).toBe("CatNumber;FR euro nett\nA;100.00\nB;200.00\n");
    } finally {
      klik.mockRestore();
      URL.createObjectURL = stary.u;
      URL.revokeObjectURL = stary.r;
    }
  });

  it("błąd pobrania pliku pokazuje komunikat", async () => {
    podglad = { status: 200, cialo: { ...WYNIK, pliki: [{ nazwa: "zepsuty.csv", kraj: null, tekst: "x", liczbaWierszy: 1 }] } };
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-podglad"));
    await uzytkownik.click(await screen.findByTestId("button-pobierz-zepsuty.csv"));
    expect(await screen.findByTestId("text-pobierz-blad")).toHaveTextContent("Pobranie pliku nie powiodło się.");
  });

  it("bez plików (błąd konfiguracji) pokazuje wyjaśnienie i błędy", async () => {
    podglad = { status: 200, cialo: { pliki: [], bledy: ["Partner nie ma skonfigurowanych kolumn pliku."], ostrzezenia: [], pozycjeWybrane: 0 } };
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-podglad"));
    expect(await screen.findByTestId("text-podglad-brak-plikow")).toBeInTheDocument();
    expect(screen.getByTestId("lista-podglad-bledy")).toHaveTextContent("nie ma skonfigurowanych kolumn");
  });

  it("długie listy błędów są skracane do 20 z informacją o reszcie", async () => {
    podglad = { status: 200, cialo: { ...WYNIK, bledy: Array.from({ length: 25 }, (_, i) => `błąd ${i}`) } };
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-podglad"));
    const lista = await screen.findByTestId("lista-podglad-bledy");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(20);
    expect(lista).toHaveTextContent("… i 5 kolejnych.");
  });

  it("błąd serwera (503) pokazuje komunikat", async () => {
    podglad = { status: 503, cialo: { error: "Podgląd plików partnerów nie jest skonfigurowany na tym serwerze." } };
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(screen.getByTestId("button-podglad"));
    expect(await screen.findByTestId("text-podglad-blad")).toHaveTextContent("nie jest skonfigurowany");
  });
});

describe("bledyPol", () => {
  it("wyciąga bledy[] z odpowiedzi 400, a dla innych błędów oddaje pustą listę", () => {
    expect(bledyPol(new Error('400: {"error":"x","bledy":[{"indeks":1,"nazwa":"A","komunikat":"k","pozycja":3}]}'))).toEqual([{ indeks: 1, nazwa: "A", komunikat: "k", pozycja: 3 }]);
    expect(bledyPol(new Error('409: {"error":"x"}'))).toEqual([]);
    expect(bledyPol(new Error("sieć"))).toEqual([]);
  });
});

describe("symulacja ceny (ticket 273)", () => {
  const WYNIK = {
    kraj: "DE", formula: "zakup * (1 + narzut) / kurs_EUR + przesylka_eur + koszty_dodatkowe", pozycjeWybrane: 120,
    kurs: { kurs: 4.2, zrodlo: "nbp", dataTabeli: "2026-10-13", ostrzezenie: null }, ostrzezenia: [],
    wiersze: [
      {
        kod: "A", numerPartnera: "123-MO1", nazwa: "Opona A", dostawca: "MO1", stan: 5, zakupPln: 1000, narzutProc: 8, zrodloNarzutu: "kraj", waga: 56, wymiary: "80×60×85 cm",
        przesylka: { wagaRozliczeniowa: 102, progKg: 200, stawkaEur: 30, paliwoProc: 10, paliwoEur: 3, pakowanieGeisEur: 1, mytoEur: 2, pakowanieKrajuEur: 0.5, razemEur: 36.5 },
        kosztyDodatkoweEur: 0, cenaEur: 293.64, blad: null,
      },
      { kod: "B", numerPartnera: null, nazwa: "Opona B", dostawca: "MO1", stan: 3, zakupPln: 500, narzutProc: 8, zrodloNarzutu: "kraj", waga: null, wymiary: null, przesylka: null, kosztyDodatkoweEur: 0, cenaEur: null, blad: "Błąd kalkulacji transportu (DE): Brak wagi pozycji." },
    ],
  };

  it("pokazuje rozbicie ceny prawdziwych pozycji, a pozycję bez ceny z powodem; wysyła kraj, kody i limit", async () => {
    let cialo: unknown = null;
    server.use(
      http.post("*/api/partnerzy/:id/symulacja-ceny", async ({ request }) => {
        cialo = await request.json();
        return HttpResponse.json(WYNIK);
      }),
    );
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.selectOptions(await screen.findByTestId("select-symulacja-kraj"), "DE");
    await uzytkownik.type(screen.getByTestId("input-symulacja-kody"), "A, B");
    await uzytkownik.click(screen.getByTestId("button-symulacja"));
    expect(await screen.findByTestId("symulacja-cena-A")).toHaveTextContent("293,64");
    expect(screen.getByTestId("symulacja-naglowek")).toHaveTextContent("kurs EUR 4,2");
    const wierszA = screen.getByTestId("symulacja-wiersz-A");
    expect(wierszA).toHaveTextContent("od ceny zakupu (kraj)");
    expect(wierszA).toHaveTextContent("próg 200 kg, stawka 30,00; paliwo 10 % (3,00)");
    expect(screen.getByTestId("symulacja-blad-B")).toHaveTextContent("Brak wagi pozycji");
    expect(cialo).toEqual({ kraj: "DE", kody: ["A", "B"], limit: 10 });
  });

  it("błąd serwera pokazuje komunikat", async () => {
    server.use(http.post("*/api/partnerzy/:id/symulacja-ceny", () => HttpResponse.json({ error: "Partner nie ma kraju FR." }, { status: 404 })));
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-symulacja"));
    expect(await screen.findByTestId("text-symulacja-blad")).toHaveTextContent("Partner nie ma kraju FR.");
  });
});
