/**
 * Dialog dodawania i edycji reguły (`/narzuty`) — sesja 4b.
 *
 * NAJWAŻNIEJSZE, CZEGO TEN PLIK PILNUJE: że formularz wysyła WYŁĄCZNIE pola z list
 * edytowalnych backendu. Pole spoza listy nie da błędu — backend odsieje je po cichu
 * i zapisze resztę, a mimo to wpuści je do audytu (4a, decyzje D2/D3). Taka pomyłka jest
 * więc niewidoczna w działaniu i wychodzi dopiero z dziennika, dlatego pilnuje jej test,
 * a nie typ.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Promocja } from "@/pages/narzuty/api";
import { TYPY_WARUNKU } from "@/pages/narzuty/warunki";
import {
  TOKEN_TESTOWY,
  narzutyZFixtura,
  produktyZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const NARZUTY = narzutyZFixtura();
const PRODUKTY = produktyZFixtura();

/** Pola przyjmowane przez backend — `POLA_EDYTOWALNE_NARZUTU` / `_PROMOCJI` (4a). */
const POLA_NARZUTU = [
  "typ",
  "zakres",
  "warunki",
  "nazwa",
  "wartosc",
  "jednostka",
  "priorytet",
  "status",
].sort();
const POLA_PROMOCJI = [
  "nazwa",
  "rabatPct",
  "zasieg",
  "warunki",
  "priorytet",
  "start",
  "koniec",
  "status",
].sort();

let wyslane: { metoda: string; sciezka: string; cialo: Record<string, unknown> }[] = [];

function zamockujApi(promocje: Promocja[] = []) {
  server.use(
    http.get("*/api/markups", () => HttpResponse.json(NARZUTY)),
    http.get("*/api/promotions", () => HttpResponse.json(promocje)),
    http.get("*/api/products", () => HttpResponse.json(PRODUKTY)),
    http.post("*/api/markups", async ({ request }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      wyslane.push({ metoda: "POST", sciezka: "/api/markups", cialo });
      return HttpResponse.json({ id: 99, ...cialo });
    }),
    http.post("*/api/promotions", async ({ request }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      wyslane.push({ metoda: "POST", sciezka: "/api/promotions", cialo });
      return HttpResponse.json({ id: 99, ...cialo });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzDialogNarzutu() {
  window.history.pushState({}, "", "/narzuty");
  render(<App />);
  await userEvent.click(await screen.findByTestId("button-add-markup"));
  return await screen.findByTestId("button-save-markup");
}

async function otworzDialogPromocji() {
  window.history.pushState({}, "", "/narzuty");
  render(<App />);
  await userEvent.click(await screen.findByTestId("tab-promocje"));
  await userEvent.click(await screen.findByTestId("button-add-promotion"));
  return await screen.findByTestId("button-save-markup");
}

beforeEach(() => {
  wyslane = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("1. Kształt wysyłanego ciała", () => {
  it("⭐ narzut: wysyła DOKŁADNIE osiem pól z listy edytowalnej, ani jednego więcej", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();

    await userEvent.type(screen.getByTestId("input-markup-name"), "Globalna 6%");
    await userEvent.clear(screen.getByTestId("input-markup-value"));
    await userEvent.type(screen.getByTestId("input-markup-value"), "6");
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(Object.keys(wyslane[0]!.cialo).sort()).toEqual(POLA_NARZUTU);
    // Pola ustawiane przez SERWER nie mogą wyjść z formularza.
    expect(wyslane[0]!.cialo).not.toHaveProperty("zmienilUzytkownikId");
    expect(wyslane[0]!.cialo).not.toHaveProperty("zmienionoData");
    expect(wyslane[0]!.cialo).not.toHaveProperty("id");
  });

  it("⭐ promocja: wysyła DOKŁADNIE osiem pól z listy edytowalnej", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await userEvent.type(screen.getByTestId("input-markup-name"), "Zima");
    await userEvent.clear(screen.getByTestId("input-markup-value"));
    await userEvent.type(screen.getByTestId("input-markup-value"), "5");
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(Object.keys(wyslane[0]!.cialo).sort()).toEqual(POLA_PROMOCJI);
  });

  it("reguła globalna wysyła warunki jako STRING \"[]\", nie tablicę", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.cialo.warunki).toBe("[]");
    expect(wyslane[0]!.cialo.typ).toBe("globalny");
  });

  /**
   * Nowo dodany warunek ma typ `dostawca`, a ten wybiera wartość z LISTY zbudowanej
   * z katalogu (`:24247`) — nie z pola tekstowego. Dlatego test klika w Select.
   */
  it("warunki jadą jako string z JSON-em, a typ/zakres biorą się z PIERWSZEGO warunku", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();

    await userEvent.click(screen.getByTestId("checkbox-globalny"));
    await userEvent.click(screen.getByTestId("button-add-warunek"));
    await userEvent.click(screen.getByTestId("select-warunek-wartosc-0"));
    await userEvent.click(await screen.findByRole("option", { name: "MO9" }));
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    const warunki = wyslane[0]!.cialo.warunki;
    expect(typeof warunki).toBe("string");
    expect(JSON.parse(warunki as string)).toEqual([{ typ: "dostawca", wartosc: "MO9" }]);
    // `Nb()` (`:9204-9207`) — `typ`/`zakres` z pierwszego warunku, nie „globalny".
    expect(wyslane[0]!.cialo.typ).toBe("dostawca");
    expect(wyslane[0]!.cialo.zakres).toBe("MO9");
  });

  /** Wartość dla typów spoza słownika wpisuje się ręcznie — tam jest zwykły input. */
  it("typ spoza słownika (produkt) daje pole tekstowe z podpowiedzią", async () => {
    zamockujApi();
    await otworzDialogNarzutu();

    await userEvent.click(screen.getByTestId("checkbox-globalny"));
    await userEvent.click(screen.getByTestId("button-add-warunek"));
    await userEvent.click(screen.getByTestId("select-warunek-typ-0"));
    await userEvent.click(await screen.findByRole("option", { name: "Konkretny produkt (kod)" }));

    const pole = await screen.findByTestId("input-warunek-wartosc-0");
    expect(pole).toHaveAttribute("placeholder", "np. 10000085");
  });
});

describe("2. Walidacje", () => {
  it("brak warunków przy odznaczonej globalnej blokuje zapis", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();

    await userEvent.click(screen.getByTestId("checkbox-globalny"));
    await userEvent.click(zapisz);

    expect(await screen.findByText("Brak warunków")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
  });

  it("wartość ujemna blokuje zapis", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();

    await userEvent.clear(screen.getByTestId("input-markup-value"));
    await userEvent.type(screen.getByTestId("input-markup-value"), "-5");
    await userEvent.click(zapisz);

    expect(await screen.findByText("Nieprawidłowa wartość")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
  });

  it("koniec przed startem blokuje zapis promocji", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await userEvent.type(screen.getByTestId("input-promo-start"), "2026-06-01");
    await userEvent.type(screen.getByTestId("input-promo-koniec"), "2026-01-01");
    await userEvent.click(zapisz);

    expect(await screen.findByText("Niepoprawne daty")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
  });
});

describe("3. Odstępstwa świadome", () => {
  /** plan.md D4 — oryginał wystawiał sześć typów, silnik rozumie dziewięć. */
  it("⭐ builder ma dziewięć typów warunku, w tym trzy dołożone w 4b", async () => {
    expect(TYPY_WARUNKU).toHaveLength(9);
    const wartosci = TYPY_WARUNKU.map((t) => t.value);
    expect(wartosci).toContain("konstrukcja");
    expect(wartosci).toContain("srednica");
    expect(wartosci).toContain("vfIf");
  });

  /** plan.md D4 — silnik nie czyta dat, więc formularz mówi o tym wprost. */
  it("⭐ pola dat promocji mają notę, że o działaniu decyduje status", async () => {
    zamockujApi();
    await otworzDialogPromocji();

    const nota = await screen.findByTestId("nota-daty-promocji");
    expect(nota).toHaveTextContent(/decyduje status/);
  });

  it("nota o datach NIE pojawia się w trybie narzutu", async () => {
    zamockujApi();
    await otworzDialogNarzutu();
    expect(screen.queryByTestId("nota-daty-promocji")).not.toBeInTheDocument();
  });
});

describe("4. Kontrola „poniżej kosztu\" (plan.md D6)", () => {
  /**
   * ⚠ PUŁAPKA, KTÓRĄ TRZEBA TU OBEJŚĆ — I KTÓRA JEST ZACHOWANIEM PRODUKCJI: promocja
   * „globalna" NIE PASUJE DO NICZEGO. `promocjaPasuje` wymaga albo niepustych `warunki`,
   * albo niepustego `zasieg`, a checkbox „globalna" zeruje jedno i drugie. Dlatego testy
   * niżej najpierw dodają warunek po dostawcy. Osobny test na dole pilnuje samej pułapki.
   */
  async function dodajWarunekDostawcy(kod: string) {
    await userEvent.click(screen.getByTestId("checkbox-globalny"));
    await userEvent.click(screen.getByTestId("button-add-warunek"));
    await userEvent.click(screen.getByTestId("select-warunek-wartosc-0"));
    await userEvent.click(await screen.findByRole("option", { name: kod }));
  }

  /**
   * Fixture produktów niesie realne ceny zakupu (MO9, zakup 560–5562 zł), więc rabat 90%
   * musi zepchnąć je pod koszt. Oryginał pytał przez `window.confirm` (`:24598`) — u nas
   * ten sam sens, własnym dialogiem.
   */
  it("⭐ rabat spychający produkty pod koszt pokazuje dialog ZAMIAST zapisywać", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await userEvent.type(screen.getByTestId("input-markup-name"), "Zabójcza");
    await dodajWarunekDostawcy("MO9");
    await userEvent.clear(screen.getByTestId("input-markup-value"));
    await userEvent.type(screen.getByTestId("input-markup-value"), "90");
    await userEvent.click(zapisz);

    expect(await screen.findByTestId("dialog-ponizej-kosztu")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
  });

  it("anulowanie NIE wysyła żądania", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await dodajWarunekDostawcy("MO9");
    await userEvent.clear(screen.getByTestId("input-markup-value"));
    await userEvent.type(screen.getByTestId("input-markup-value"), "90");
    await userEvent.click(zapisz);
    await userEvent.click(await screen.findByTestId("button-anuluj-ponizej-kosztu"));

    expect(wyslane).toHaveLength(0);
  });

  it("potwierdzenie wysyła promocję mimo ostrzeżenia", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await dodajWarunekDostawcy("MO9");
    await userEvent.clear(screen.getByTestId("input-markup-value"));
    await userEvent.type(screen.getByTestId("input-markup-value"), "90");
    await userEvent.click(zapisz);
    await userEvent.click(await screen.findByTestId("button-potwierdz-ponizej-kosztu"));

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.cialo.rabatPct).toBe(90);
    // `zasieg` sklejany z warunków — `Cb()` (`:9322`).
    expect(wyslane[0]!.cialo.zasieg).toBe("dostawca:MO9");
  });

  it("umiarkowany rabat nie wywołuje ostrzeżenia", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await dodajWarunekDostawcy("MO9");
    await userEvent.clear(screen.getByTestId("input-markup-value"));
    await userEvent.type(screen.getByTestId("input-markup-value"), "5");
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(screen.queryByTestId("dialog-ponizej-kosztu")).not.toBeInTheDocument();
  });

  /**
   * ⚠ PORT 1:1 PUŁAPKI PRODUKCJI. Promocja zapisana z zaznaczonym „globalna" ma pusty
   * `zasieg` i puste `warunki`, a `promocjaPasuje` odrzuca właśnie takie — więc promocja
   * nie obniża NICZEGO. Oryginał zachowuje się identycznie (`Cb()` `:9322` + `Tb()` `:9477`)
   * i tak samo o tym milczy. Test jest tu po to, żeby ta cisza była udokumentowana,
   * a nie przypadkowa; opis trafia do backlogu.
   */
  it("⚠ promocja „globalna\" nie pasuje do niczego — więc nie ma czego ostrzegać", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await userEvent.clear(screen.getByTestId("input-markup-value"));
    await userEvent.type(screen.getByTestId("input-markup-value"), "90");
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.cialo.zasieg).toBe("");
    expect(wyslane[0]!.cialo.warunki).toBe("[]");
    expect(screen.queryByTestId("dialog-ponizej-kosztu")).not.toBeInTheDocument();
  });
});
