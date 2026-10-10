/** Widok `/partnerzy/:id` — konfiguracja partnera (ticket 222, PRT-5.2). MSW od zera: trasy `/api/partnerzy` są poza openapi. */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { liczbaZPola, type KrajPartnera, type SzczegolyPartnera } from "@/pages/partnerzy/api";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const FR: KrajPartnera = { id: 1, partnerId: 1, kraj: "FR", narzutProc: 12, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 43 };
const startowy = (): SzczegolyPartnera => ({
  id: 1, nazwa: "TyreWorld", aktywny: false, stanMin: 2, zaokraglanie: "grosz", harmonogramMinuty: 60, tolerancjaCenyProc: null, formatPliku: "csv",
  csvSeparator: ";", kanalFtp: false, kanalEmail: false, emailSkrzynka: null, zmieniono: "2026-10-10T10:00:00.000Z", magazyny: ["MO1"], wykluczenia: ["MO1_9"], kraje: [FR],
});

let partner: SzczegolyPartnera;
let zadania: { metoda: string; sciezka: string; cialo: unknown }[] = [];
let odrzuc: Record<string, { status: number; blad: string }> = {};

function zamockujApi() {
  const zapisz = (metoda: string, sciezka: string, cialo: unknown) => zadania.push({ metoda, sciezka, cialo });
  const sprobuj = (klucz: string) => (odrzuc[klucz] ? HttpResponse.json({ error: odrzuc[klucz]!.blad }, { status: odrzuc[klucz]!.status }) : null);
  const zmien = () => { partner = { ...partner, zmieniono: new Date().toISOString() }; };
  server.use(
    http.get("*/api/partnerzy/magazyny", () => HttpResponse.json({ magazyny: [{ magazyn: "MO1", liczbaPozycji: 120 }, { magazyn: "MO2", liczbaPozycji: 80 }] })),
    http.get("*/api/partnerzy/:id", ({ params }) => (Number(params.id) === 1 ? HttpResponse.json(partner) : HttpResponse.json({ error: "Nie ma takiego partnera." }, { status: 404 }))),
    http.put("*/api/partnerzy/:id/magazyny", async ({ request }) => {
      const cialo = (await request.json()) as { magazyny: string[] };
      zapisz("PUT", "/magazyny", cialo);
      partner = { ...partner, magazyny: cialo.magazyny }; zmien();
      return HttpResponse.json(partner);
    }),
    http.put("*/api/partnerzy/:id/wykluczenia", async ({ request }) => {
      const cialo = (await request.json()) as { kody: string[] };
      zapisz("PUT", "/wykluczenia", cialo);
      partner = { ...partner, wykluczenia: cialo.kody }; zmien();
      return HttpResponse.json(partner);
    }),
    http.put("*/api/partnerzy/:id/kraje/:kraj", async ({ request, params }) => {
      const cialo = (await request.json()) as Omit<KrajPartnera, "id" | "partnerId" | "kraj">;
      zapisz("PUT", `/kraje/${String(params.kraj)}`, cialo);
      const blad = sprobuj("kraj");
      if (blad) return blad;
      partner = { ...partner, kraje: [...partner.kraje.filter((k) => k.kraj !== params.kraj), { id: 9, partnerId: 1, kraj: String(params.kraj), ...cialo }] }; zmien();
      return HttpResponse.json(partner);
    }),
    http.delete("*/api/partnerzy/:id/kraje/:kraj", ({ params }) => {
      zapisz("DELETE", `/kraje/${String(params.kraj)}`, null);
      partner = { ...partner, kraje: partner.kraje.filter((k) => k.kraj !== params.kraj) }; zmien();
      return HttpResponse.json(partner);
    }),
    http.put("*/api/partnerzy/:id", async ({ request }) => {
      const cialo = (await request.json()) as Partial<SzczegolyPartnera>;
      zapisz("PUT", "/", cialo);
      const blad = sprobuj("ustawienia");
      if (blad) return blad;
      partner = { ...partner, ...cialo }; zmien();
      return HttpResponse.json(partner);
    }),
  );
}

async function otworz(sciezka = "/partnerzy/1") {
  window.history.pushState({}, "", sciezka);
  render(<App />);
}

beforeEach(() => {
  partner = startowy();
  zadania = [];
  odrzuc = {};
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(uzytkownikZFixtura()));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
  zamockujApi();
});

describe("wejście na konfigurację", () => {
  it("pokazuje nazwę partnera, status i wszystkie sekcje", async () => {
    await otworz();
    expect(await screen.findByText("Partner: TyreWorld")).toBeInTheDocument();
    expect(screen.getByTestId("badge-partner-szczegoly-status")).toHaveTextContent("Nieaktywny");
    expect(screen.getByTestId("input-ustawienia-nazwa")).toHaveValue("TyreWorld");
    expect(screen.getByTestId("input-ustawienia-harmonogram")).toHaveValue("60");
    expect(await screen.findByTestId("checkbox-magazyn-MO2")).not.toBeChecked();
    expect(screen.getByTestId("checkbox-magazyn-MO1")).toBeChecked();
    expect(screen.getByTestId("textarea-wykluczenia")).toHaveValue("MO1_9");
    expect(screen.getByTestId("row-kraj-FR")).toBeInTheDocument();
  });

  it("nieistniejący partner: komunikat błędu serwera", async () => {
    await otworz("/partnerzy/99");
    expect(await screen.findByTestId("text-partner-blad")).toHaveTextContent("Nie ma takiego partnera.");
  });

  it("z listy prowadzi link „Konfiguruj”", async () => {
    server.use(
      http.get("*/api/partnerzy", () => HttpResponse.json({ partnerzy: [{ id: 1, nazwa: "TyreWorld", aktywny: false, stanMin: 2, zaokraglanie: "grosz", harmonogramMinuty: null, formatPliku: "csv", liczbaMagazynow: 1, liczbaWykluczen: 0, liczbaKrajow: 1 }] })),
      http.get("*/api/partnerzy/:id/logi", () => HttpResponse.json({ logi: [] })),
    );
    await otworz("/partnerzy");
    expect(await screen.findByTestId("link-partner-konfiguruj-1")).toHaveAttribute("href", "/partnerzy/1");
  });
});

describe("ustawienia", () => {
  it("zapisuje zmienione pola jako jedno PUT, z liczbami i null dla pustych", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByText("Partner: TyreWorld");
    await uzytkownik.clear(screen.getByTestId("input-ustawienia-stan-min"));
    await uzytkownik.type(screen.getByTestId("input-ustawienia-stan-min"), "5");
    await uzytkownik.clear(screen.getByTestId("input-ustawienia-harmonogram"));
    await uzytkownik.type(screen.getByTestId("input-ustawienia-tolerancja"), "1,5");
    await uzytkownik.selectOptions(screen.getByTestId("select-ustawienia-zaokraglanie"), "gora10");
    await uzytkownik.selectOptions(screen.getByTestId("select-ustawienia-format"), "xml");
    await uzytkownik.click(screen.getByTestId("checkbox-ustawienia-ftp"));
    await uzytkownik.click(screen.getByTestId("button-ustawienia-zapisz"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toEqual({
      metoda: "PUT", sciezka: "/",
      cialo: { nazwa: "TyreWorld", stanMin: 5, zaokraglanie: "gora10", harmonogramMinuty: null, tolerancjaCenyProc: 1.5, formatPliku: "xml", csvSeparator: ";", kanalFtp: true, kanalEmail: false, emailSkrzynka: null },
    });
    expect(await screen.findByText("Zapisano ustawienia partnera")).toBeInTheDocument();
  });

  it("walidacja po stronie klienta nie wysyła żądania", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByText("Partner: TyreWorld");
    await uzytkownik.clear(screen.getByTestId("input-ustawienia-stan-min"));
    await uzytkownik.type(screen.getByTestId("input-ustawienia-stan-min"), "-3");
    await uzytkownik.click(screen.getByTestId("button-ustawienia-zapisz"));
    expect(await screen.findByText("Stan minimalny musi być liczbą całkowitą ≥ 0.")).toBeInTheDocument();
    expect(zadania).toEqual([]);
  });

  it("błąd serwera (zajęta nazwa) pokazuje komunikat", async () => {
    odrzuc = { ustawienia: { status: 409, blad: "Partner o tej nazwie już istnieje." } };
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByText("Partner: TyreWorld");
    await uzytkownik.click(screen.getByTestId("button-ustawienia-zapisz"));
    expect(await screen.findByText("Partner o tej nazwie już istnieje.")).toBeInTheDocument();
  });
});

describe("magazyny i wykluczenia", () => {
  it("zapisuje wybrane magazyny", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(await screen.findByTestId("checkbox-magazyn-MO2"));
    await uzytkownik.click(screen.getByTestId("checkbox-magazyn-MO1"));
    await uzytkownik.click(screen.getByTestId("button-magazyny-zapisz"));
    await waitFor(() => expect(zadania).toEqual([{ metoda: "PUT", sciezka: "/magazyny", cialo: { magazyny: ["MO2"] } }]));
  });

  it("magazyn partnera spoza katalogu zostaje na liście z adnotacją", async () => {
    partner = { ...partner, magazyny: ["MO1", "STARY"] };
    await otworz();
    expect(await screen.findByTestId("checkbox-magazyn-STARY")).toBeChecked();
    await screen.findByText("(120)"); // lista magazynów katalogu wczytana — dopiero wtedy adnotacje są wiarygodne
    expect(within(screen.getByTestId("lista-magazynow")).getAllByText("(brak w katalogu)")).toHaveLength(1);
  });

  it("wykluczenia: kody z wierszy, przecinków i średników bez duplikatów i pustych", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    const pole = await screen.findByTestId("textarea-wykluczenia");
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, "A1,B2;A1{enter}{enter}C3 ");
    await uzytkownik.click(screen.getByTestId("button-wykluczenia-zapisz"));
    await waitFor(() => expect(zadania).toEqual([{ metoda: "PUT", sciezka: "/wykluczenia", cialo: { kody: ["A1", "B2", "C3"] } }]));
  });
});

describe("kraje", () => {
  it("dodaje nowy kraj z ręcznym kursem; kod jest normalizowany do wielkich liter", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByTestId("row-kraj-FR");
    await uzytkownik.type(screen.getByTestId("input-kraj-nowy-kod"), "de");
    await uzytkownik.clear(screen.getByTestId("input-kraj-narzut-nowy"));
    await uzytkownik.type(screen.getByTestId("input-kraj-narzut-nowy"), "10,5");
    await uzytkownik.selectOptions(screen.getByTestId("select-kraj-zrodlo-nowy"), "reczny");
    await uzytkownik.type(screen.getByTestId("input-kraj-kurs-nowy"), "4,3");
    await uzytkownik.click(screen.getByTestId("button-kraj-zapisz-nowy"));
    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toEqual({ metoda: "PUT", sciezka: "/kraje/DE", cialo: { narzutProc: 10.5, kursZrodlo: "reczny", kursReczny: 4.3, kosztyDodatkowe: 0 } });
    expect(await screen.findByTestId("row-kraj-DE")).toBeInTheDocument();
  });

  it("edycja istniejącego kraju wysyła PUT z nowymi wartościami", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    const narzut = await screen.findByTestId("input-kraj-narzut-FR");
    expect(narzut).toHaveValue("12");
    await uzytkownik.clear(narzut);
    await uzytkownik.type(narzut, "15");
    await uzytkownik.click(screen.getByTestId("button-kraj-zapisz-FR"));
    await waitFor(() => expect(zadania).toEqual([{ metoda: "PUT", sciezka: "/kraje/FR", cialo: { narzutProc: 15, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 43 } }]));
  });

  it("walidacja: zły kod kraju i kurs ręczny bez wartości nie wysyłają żądania", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await screen.findByTestId("row-kraj-FR");
    await uzytkownik.type(screen.getByTestId("input-kraj-nowy-kod"), "F");
    await uzytkownik.click(screen.getByTestId("button-kraj-zapisz-nowy"));
    expect(await screen.findByText("Kraj to dwuliterowy kod, np. FR.")).toBeInTheDocument();
    await uzytkownik.type(screen.getByTestId("input-kraj-nowy-kod"), "R");
    await uzytkownik.selectOptions(screen.getByTestId("select-kraj-zrodlo-nowy"), "reczny");
    await uzytkownik.click(screen.getByTestId("button-kraj-zapisz-nowy"));
    expect(await screen.findByText("Kurs ręczny wymaga wartości większej od zera.")).toBeInTheDocument();
    expect(zadania).toEqual([]);
  });

  it("usuwanie pyta o potwierdzenie; po zatwierdzeniu leci DELETE", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    await uzytkownik.click(await screen.findByTestId("button-kraj-usun-FR"));
    expect(zadania).toEqual([]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Ustawienia tego kraju/)).toBeInTheDocument();
    await uzytkownik.click(within(dialog).getByRole("button", { name: "Usuń" }));
    await waitFor(() => expect(zadania).toEqual([{ metoda: "DELETE", sciezka: "/kraje/FR", cialo: null }]));
    await waitFor(() => expect(screen.queryByTestId("row-kraj-FR")).not.toBeInTheDocument());
  });
});

describe("liczbaZPola", () => {
  it("przecinek i kropka, pusty → null, śmieci → NaN", () => {
    expect(liczbaZPola("1,5")).toBe(1.5);
    expect(liczbaZPola(" 2.25 ")).toBe(2.25);
    expect(liczbaZPola("")).toBeNull();
    expect(Number.isNaN(liczbaZPola("abc"))).toBe(true);
  });
});
