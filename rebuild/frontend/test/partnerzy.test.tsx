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
let geis: unknown[] = [];

function zamockujApi({ dodawanie = "ok" as "ok" | "duplikat" } = {}) {
  server.use(
    http.get("*/api/partnerzy", () => HttpResponse.json({ partnerzy })),
    http.get("*/api/partnerzy/geis", () => HttpResponse.json({ kraje: geis })),
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
  geis = [];
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
    expect(await screen.findByTestId("row-partner-10")).toHaveTextContent("Nowy Partner");
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

describe("słowniki zamówień Selly", () => {
  it("pobiera dopiero po kliknięciu i pokazuje statusy, płatności i dostawy z dowolnymi kluczami", async () => {
    let zapytan = 0;
    zamockujApi();
    server.use(
      http.get("*/api/partnerzy/selly/slowniki-zamowien", () => {
        zapytan++;
        return HttpResponse.json({ statusy: [{ status_id: 3, name: "Nowe" }], platnosci: [{ payment_id: 7, name: "Przelew" }], dostawy: [] });
      }),
    );
    await otworz();
    const przycisk = await screen.findByTestId("button-slowniki-selly");
    expect(zapytan).toBe(0);
    await userEvent.setup().click(przycisk);
    const statusy = await screen.findByTestId("tabela-selly-statusy");
    expect(within(statusy).getByText("status_id")).toBeInTheDocument();
    expect(within(statusy).getByText("Nowe")).toBeInTheDocument();
    expect(within(screen.getByTestId("tabela-selly-platnosci")).getByText("Przelew")).toBeInTheDocument();
    expect(within(screen.getByTestId("tabela-selly-dostawy")).getByText("brak pozycji")).toBeInTheDocument();
    expect(zapytan).toBe(1);
  });

  it("błąd Selly pokazuje komunikat zamiast tabel", async () => {
    zamockujApi();
    server.use(http.get("*/api/partnerzy/selly/slowniki-zamowien", () => HttpResponse.json({ error: "[Selly] Integracja wyłączona" }, { status: 502 })));
    await otworz();
    await userEvent.setup().click(await screen.findByTestId("button-slowniki-selly"));
    expect(await screen.findByTestId("text-slowniki-selly-blad")).toHaveTextContent("Integracja wyłączona");
  });
});

describe("tabele GEIS", () => {
  it("pokazuje kraje z podsumowaniem, edycja wysyła PUT z parametrami i stawkami; błędny wiersz stawek blokuje zapis", async () => {
    geis = [{ kraj: "AT", wspGabarytowy: 200, kosztPakowania: 0, maks: [240, 240, 220], stawki: [[50, 57], [100, 61]] }];
    zamockujApi();
    server.use(
      http.put("*/api/partnerzy/geis/AT", async ({ request }) => {
        zadania.push({ metoda: "PUT", sciezka: "/geis/AT", cialo: (await request.json()) as Record<string, unknown> });
        return HttpResponse.json({ kraje: geis });
      }),
    );
    await otworz();
    const uzytkownik = userEvent.setup();
    expect(await screen.findByTestId("geis-AT")).toHaveTextContent("współczynnik 200");
    await uzytkownik.click(screen.getByTestId("button-geis-edytuj-AT"));
    const pole = screen.getByTestId("textarea-geis-stawki-AT");
    expect(pole).toHaveValue("50;57\n100;61");
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, "50;60,5{enter}100;70");
    await uzytkownik.click(screen.getByTestId("button-geis-zapisz-AT"));
    await waitFor(() => expect(zadania.at(-1)).toEqual({ metoda: "PUT", sciezka: "/geis/AT", cialo: { wspGabarytowy: 200, kosztPakowania: 0, maks: [240, 240, 220], stawki: [[50, 60.5], [100, 70]] } }));
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, "abc");
    await uzytkownik.click(screen.getByTestId("button-geis-zapisz-AT"));
    expect(await screen.findByText(/Wiersz 1: oczekiwane/)).toBeInTheDocument();
    expect(zadania.filter((z) => z.sciezka === "/geis/AT")).toHaveLength(1);
  });

  it("pusty stan zaprasza do importu", async () => {
    zamockujApi();
    await otworz();
    expect(await screen.findByTestId("text-geis-pusto")).toBeInTheDocument();
  });

  it("podgląd kosztu przesyłki: wybór partnera i kraju, wysyłka paczki, rozbicie kosztu; błąd z backendu pokazany", async () => {
    partnerzy = [partner()];
    const ciala: Record<string, unknown>[] = [];
    zamockujApi();
    server.use(
      http.get("*/api/partnerzy/1", () => HttpResponse.json({ ...partner(), kraje: [{ id: 1, partnerId: 1, kraj: "FR" }, { id: 2, partnerId: 1, kraj: "DE" }] })),
      http.post("*/api/partnerzy/geis/podglad-kosztu", async ({ request }) => {
        const c = (await request.json()) as Record<string, unknown>;
        ciala.push(c);
        if (c.kraj === "DE") return HttpResponse.json({ error: "Brak tabeli transportowej GEIS dla kraju DE." }, { status: 400 });
        return HttpResponse.json({ zrodlo: "geis", wagaRozliczeniowa: 100, wagaRzeczywista: 60, wagaGabarytowa: 100, progKg: 100, baza: 150, paliwoProc: 44, paliwoEur: 66, pakowanieGeisEur: 0, mytoEur: 9.92, pakowanieKrajuEur: 15, razemEur: 240.92 });
      }),
    );
    await otworz();
    const u = userEvent.setup();
    await u.selectOptions(await screen.findByTestId("select-przesylka-partner"), "1");
    await waitFor(() => expect(screen.getByTestId("select-przesylka-kraj")).not.toBeDisabled());
    await u.selectOptions(await screen.findByRole("option", { name: "FR" }).then(() => screen.getByTestId("select-przesylka-kraj")), "FR");
    await u.type(screen.getByTestId("input-przesylka-waga"), "60");
    await u.type(screen.getByTestId("input-przesylka-dlugosc"), "80");
    await u.click(screen.getByTestId("button-przesylka-policz"));
    expect(await screen.findByTestId("text-przesylka-razem")).toHaveTextContent("240.92 EUR");
    expect(screen.getByTestId("wynik-przesylki")).toHaveTextContent("Paliwo 44%: 66.00 EUR");
    expect(ciala[0]).toMatchObject({ partnerId: 1, kraj: "FR", waga: 60, dlugosc: 80, szerokosc: null });
    await u.selectOptions(screen.getByTestId("select-przesylka-kraj"), "DE");
    await u.click(screen.getByTestId("button-przesylka-policz"));
    expect(await screen.findByTestId("text-przesylka-blad")).toHaveTextContent("Brak tabeli transportowej GEIS dla kraju DE.");
    expect(screen.queryByTestId("wynik-przesylki")).not.toBeInTheDocument();
  });
});
