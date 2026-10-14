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

const FR: KrajPartnera = { id: 1, partnerId: 1, kraj: "FR", narzutProc: 12, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 43, ostatniKurs: null };
const startowy = (): SzczegolyPartnera => ({
  id: 1, nazwa: "TyreWorld", aktywny: false, stanMin: 2, zaokraglanie: "grosz", harmonogramMinuty: 60, tolerancjaCenyProc: null, formatPliku: "csv",
  csvSeparator: ";", kanalFtp: false, kanalEmail: false, emailSkrzynka: null,nazwaPliku: null, zmieniono: "2026-10-10T10:00:00.000Z", magazyny: ["MO1"], wykluczenia: ["MO1_9"], kraje: [FR], kolumny: [], polaObliczeniowe: [],
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
    http.get("*/api/partnerzy/:id/zamowienia", () => HttpResponse.json({ zamowienia: [] })),
    http.get("*/api/partnerzy/:id/logi", () => HttpResponse.json({ logi: [] })),
    http.get("*/api/partnerzy/:id/error-log", () => HttpResponse.json({ bledy: [] })),
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
    http.put("*/api/partnerzy/:id/kraje/:kraj/faktura", async ({ request, params }) => {
      const cialo = await request.json();
      zapisz("PUT", `/kraje/${String(params.kraj)}/faktura`, cialo);
      partner = { ...partner, kraje: partner.kraje.map((k) => (k.kraj === params.kraj ? { ...k, ...(cialo as object) } : k)) }; zmien();
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
      cialo: { nazwa: "TyreWorld", stanMin: 5, zaokraglanie: "gora10", harmonogramMinuty: null, tolerancjaCenyProc: 1.5, formatPliku: "xml", csvSeparator: ";", kanalFtp: true, kanalEmail: false, emailSkrzynka: null, nazwaPliku: null,
        fakturaNazwa: null, fakturaNip: null, fakturaUlica: null, fakturaKod: null, fakturaMiasto: null, fakturaKraj: null,
        sellyStatusId: null, kontaktEmail: null, kontaktTelefon: null },
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
    expect(zadania[0]).toEqual({ metoda: "PUT", sciezka: "/kraje/DE", cialo: { narzutProc: 10.5, kursZrodlo: "reczny", kursReczny: 4.3, kosztyDodatkowe: 0, mytoEur: 0, pakowanieEur: 0, paliwoProc: null } });
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
    await waitFor(() => expect(zadania).toEqual([{ metoda: "PUT", sciezka: "/kraje/FR", cialo: { narzutProc: 15, kursZrodlo: "nbp", kursReczny: null, kosztyDodatkowe: 43, mytoEur: 0, pakowanieEur: 0, paliwoProc: null } }]));
  });

  it("panel nie ma pola przesyłki bazowej (przesyłka z tabel GEIS), a pokazuje używany kurs", async () => {
    await otworz();
    await screen.findByTestId("input-kraj-narzut-FR");
    expect(screen.queryByTestId("input-kraj-przesylka-FR")).not.toBeInTheDocument();
    expect(screen.getByTestId("kurs-uzywany-FR")).toHaveTextContent("NBP — jeszcze nie użyto");
  });

  it("tabela krajów pokazuje pełną nazwę kraju obok kodu (także dla nowego kraju w trakcie wpisywania) i wyjaśnienie, kiedy NBP publikuje kurs", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    expect(await screen.findByTestId("nazwa-kraju-FR")).toHaveTextContent("Francja");
    expect(screen.getByTestId("nazwa-kraju-nowy")).toBeEmptyDOMElement();
    await uzytkownik.type(screen.getByTestId("input-kraj-nowy-kod"), "pl");
    expect(screen.getByTestId("nazwa-kraju-nowy")).toHaveTextContent("Polska");
    expect(screen.getByTestId("kurs-nbp-wyjasnienie")).toHaveTextContent("11:45–12:15");
  });

  it("tabela krajów pokazuje aktualny kurs NBP (wartość i data tabeli), także przy kraju, który jeszcze go nie użył; „Odśwież kurs” pobiera na nowo", async () => {
    const uzytkownik = userEvent.setup();
    let zapytan = 0;
    await otworz();
    server.use(http.get("*/api/partnerzy/kurs-nbp", () => (zapytan++, HttpResponse.json({ kurs: 4.2431, zrodlo: "nbp", dataTabeli: "2026-10-13", ostrzezenie: null }))));
    expect(await screen.findByTestId("kurs-nbp-wartosc")).toHaveTextContent("1 EUR = 4.2431 PLN");
    expect(screen.getByTestId("kurs-nbp-teraz")).toHaveTextContent("tabela z 2026-10-13");
    expect(screen.getByTestId("kurs-uzywany-FR")).toHaveTextContent("NBP teraz: 4.2431 (tabela z 2026-10-13) · jeszcze nie użyto w pliku");
    const dotad = zapytan;
    await uzytkownik.click(screen.getByTestId("button-kurs-nbp-odswiez"));
    await waitFor(() => expect(zapytan).toBe(dotad + 1));
  });

  it("kurs NBP z ostrzeżeniem (NBP nie odpowiada) pokazuje je i oznacza kurs jako zapisany; błąd pobrania ma komunikat", async () => {
    await otworz();
    server.use(http.get("*/api/partnerzy/kurs-nbp", () => HttpResponse.json({ kurs: 4.3, zrodlo: "nbp-zapisany", dataTabeli: "2026-10-10", ostrzezenie: "NBP nie odpowiada (timeout) — użyto ostatniego zapisanego kursu 4.3." })));
    expect(await screen.findByTestId("kurs-nbp-ostrzezenie")).toHaveTextContent("NBP nie odpowiada");
    expect(screen.getByTestId("kurs-uzywany-FR")).toHaveTextContent("zapisany — NBP nie odpowiada");
  });

  it("błąd pobrania kursu NBP: komunikat zamiast kursu, tabela nadal działa", async () => {
    await otworz();
    server.use(http.get("*/api/partnerzy/kurs-nbp", () => HttpResponse.json({ error: "NBP nie odpowiada (timeout) i nie ma żadnego zapisanego kursu." }, { status: 502 })));
    expect(await screen.findByTestId("kurs-nbp-blad")).toHaveTextContent("nie ma żadnego zapisanego kursu");
    expect(screen.getByTestId("input-kraj-narzut-FR")).toBeInTheDocument();
  });

  it("dane do faktury partnera trafiają w PUT (kraj wielkimi literami, puste → null)", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi();
    await otworz();
    await uzytkownik.type(await screen.findByTestId("input-ustawienia-faktura-nazwa"), "Firma Test");
    await uzytkownik.type(screen.getByTestId("input-ustawienia-faktura-kraj"), "ad");
    await uzytkownik.click(screen.getByTestId("button-ustawienia-zapisz"));
    await waitFor(() => expect(zadania[0]?.cialo).toMatchObject({ fakturaNazwa: "Firma Test", fakturaKraj: "AD", fakturaNip: null }));
  });

  it("dane do faktury wg kraju: osobny zapis dla kraju (PUT …/kraje/FR/faktura), kraj małymi → wielkimi, sama nazwa nie jest wymagana, ale pola bez nazwy blokują", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi();
    await otworz();
    await uzytkownik.type(await screen.findByTestId("input-faktura-fakturaNip-FR"), "FR123");
    await uzytkownik.click(screen.getByTestId("button-faktura-zapisz-FR"));
    expect(await screen.findByText("Podaj nazwę firmy albo wyczyść wszystkie pola (puste = dane domyślne partnera).")).toBeInTheDocument();
    expect(zadania.some((z) => z.sciezka.includes("faktura"))).toBe(false);
    await uzytkownik.type(screen.getByTestId("input-faktura-fakturaNazwa-FR"), "Adtyres France");
    await uzytkownik.type(screen.getByTestId("input-faktura-fakturaKraj-FR"), "fr");
    await uzytkownik.click(screen.getByTestId("button-faktura-zapisz-FR"));
    await waitFor(() => expect(zadania.find((z) => z.sciezka.includes("/faktura"))?.cialo).toEqual({
      fakturaNazwa: "Adtyres France", fakturaNip: "FR123", fakturaUlica: null, fakturaKod: null, fakturaMiasto: null, fakturaKraj: "FR",
    }));
  });

  it("Selly i kontakt: status jako liczba, e-mail i telefon w PUT (puste → null); VAT/płatność/dostawa NIE są wysyłane; błędne wartości blokują zapis", async () => {
    const uzytkownik = userEvent.setup();
    zamockujApi();
    await otworz();
    await uzytkownik.type(await screen.findByTestId("input-ustawienia-selly-status"), "3");
    await uzytkownik.type(screen.getByTestId("input-ustawienia-kontakt-email"), "bill@partner.example");
    await uzytkownik.click(screen.getByTestId("button-ustawienia-zapisz"));
    await waitFor(() => expect(zadania[0]?.cialo).toMatchObject({ sellyStatusId: 3, kontaktEmail: "bill@partner.example", kontaktTelefon: null }));
    const cialo = zadania[0]?.cialo as Record<string, unknown>;
    for (const k of ["sellyVatId", "sellyPaymentId", "sellyDeliveryId"]) expect(cialo).not.toHaveProperty(k);
    const dotad = zadania.length;
    await uzytkownik.clear(screen.getByTestId("input-ustawienia-kontakt-email"));
    await uzytkownik.type(screen.getByTestId("input-ustawienia-kontakt-email"), "to-nie-email");
    await uzytkownik.click(screen.getByTestId("button-ustawienia-zapisz"));
    expect(await screen.findByText("Kontakt: e-mail musi być poprawnym adresem (albo puste).")).toBeInTheDocument();
    expect(zadania.length).toBe(dotad);
    await uzytkownik.clear(screen.getByTestId("input-ustawienia-kontakt-email"));
    await uzytkownik.clear(screen.getByTestId("input-ustawienia-selly-status"));
    await uzytkownik.type(screen.getByTestId("input-ustawienia-selly-status"), "abc");
    await uzytkownik.click(screen.getByTestId("button-ustawienia-zapisz"));
    expect(await screen.findByText("Identyfikator statusu Selly musi być liczbą całkowitą (albo puste).")).toBeInTheDocument();
    expect(zadania.length).toBe(dotad);
  });

  it("paliwo, myto i pakowanie kraju trafiają w PUT; nowy kraj ma domyślne zera", async () => {
    const uzytkownik = userEvent.setup();
    await otworz();
    const paliwo = await screen.findByTestId("input-kraj-paliwo-FR");
    await uzytkownik.type(paliwo, "44");
    const myto = screen.getByTestId("input-kraj-myto-FR");
    await uzytkownik.clear(myto);
    await uzytkownik.type(myto, "9.92");
    await uzytkownik.type(screen.getByTestId("input-kraj-pakowanie-FR"), "{selectall}15");
    await uzytkownik.click(screen.getByTestId("button-kraj-zapisz-FR"));
    await waitFor(() => expect(zadania[0]?.cialo).toMatchObject({ paliwoProc: 44, mytoEur: 9.92, pakowanieEur: 15 }));
    expect(screen.getByTestId("input-kraj-pakowanie-nowy")).toHaveValue("0");
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

describe("reguły narzutów partnera", () => {
  type R = { id: number; kraj: string | null; nazwa: string; warunki: { typ: string; wartosc: string }[]; wartosc: number; priorytet: number; status: string };
  let reguly: R[] = [];
  let wyslane: { metoda: string; sciezka: string; cialo: unknown }[] = [];

  beforeEach(() => {
    reguly = [{ id: 1, kraj: null, nazwa: "Domyślna", warunki: [], wartosc: 8, priorytet: 50, status: "aktywny" }];
    wyslane = [];
    zamockujApi();
    server.use(
      http.get("*/api/partnerzy/1/narzuty", () => HttpResponse.json({ reguly })),
      http.post("*/api/partnerzy/1/narzuty", async ({ request }) => {
        const cialo = (await request.json()) as Omit<R, "id">;
        wyslane.push({ metoda: "POST", sciezka: "/narzuty", cialo });
        reguly = [...reguly, { id: 2, ...cialo }];
        return HttpResponse.json(reguly.at(-1), { status: 201 });
      }),
      http.patch("*/api/partnerzy/1/narzuty/:rid", async ({ request, params }) => {
        const cialo = (await request.json()) as Partial<R>;
        wyslane.push({ metoda: "PATCH", sciezka: `/narzuty/${String(params.rid)}`, cialo });
        reguly = reguly.map((r) => (r.id === Number(params.rid) ? { ...r, ...cialo } : r));
        return HttpResponse.json(reguly[0]);
      }),
      http.delete("*/api/partnerzy/1/narzuty/:rid", ({ params }) => {
        wyslane.push({ metoda: "DELETE", sciezka: `/narzuty/${String(params.rid)}`, cialo: null });
        reguly = reguly.filter((r) => r.id !== Number(params.rid));
        return HttpResponse.json({ ok: true });
      }),
    );
  });

  it("pokazuje reguły z opisem warunków i krajem; dodanie reguły z warunkiem wysyła POST; walidacja blokuje puste pola", async () => {
    const u = userEvent.setup();
    await otworz();
    expect(await screen.findByTestId("row-regula-1")).toHaveTextContent("wszystkie opony (globalna)");
    await u.click(screen.getByTestId("button-regula-dodaj"));
    await u.click(screen.getByTestId("button-regula-zapisz"));
    expect(await screen.findByText("Nazwa reguły jest wymagana.")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
    await u.type(screen.getByTestId("input-regula-nazwa"), "Mitas w DE");
    await u.type(screen.getByTestId("input-regula-wartosc"), "12,5");
    await u.selectOptions(screen.getByTestId("select-regula-kraj"), "FR");
    await u.click(screen.getByTestId("button-warunek-dodaj"));
    await u.click(screen.getByTestId("button-regula-zapisz"));
    expect(await screen.findByText("Każdy warunek musi mieć wartość (albo go usuń).")).toBeInTheDocument();
    await u.type(screen.getByTestId("input-warunek-wartosc-0"), "mitas");
    await u.click(screen.getByTestId("button-regula-zapisz"));
    await waitFor(() => expect(wyslane).toEqual([{ metoda: "POST", sciezka: "/narzuty", cialo: { nazwa: "Mitas w DE", wartosc: 12.5, kraj: "FR", priorytet: 50, status: "aktywny", warunki: [{ typ: "marka", wartosc: "mitas" }] } }]));
    expect(await screen.findByTestId("row-regula-2")).toHaveTextContent("Marka: mitas");
  });

  it("edycja wysyła PATCH ze zmienionym priorytetem; usunięcie wymaga potwierdzenia", async () => {
    const u = userEvent.setup();
    await otworz();
    await u.click(await screen.findByTestId("button-regula-edytuj-1"));
    const priorytet = screen.getByTestId("input-regula-priorytet");
    await u.clear(priorytet);
    await u.type(priorytet, "90");
    await u.click(screen.getByTestId("button-regula-zapisz"));
    await waitFor(() => expect(wyslane[0]).toMatchObject({ metoda: "PATCH", sciezka: "/narzuty/1", cialo: { priorytet: 90, wartosc: 8, kraj: null } }));
    await u.click(await screen.findByTestId("button-regula-usun-1"));
    expect(wyslane).toHaveLength(1);
    await u.click(await screen.findByRole("button", { name: "Usuń" }));
    await waitFor(() => expect(wyslane.at(-1)).toMatchObject({ metoda: "DELETE", sciezka: "/narzuty/1" }));
    expect(await screen.findByTestId("text-reguly-pusto")).toBeInTheDocument();
  });
});
