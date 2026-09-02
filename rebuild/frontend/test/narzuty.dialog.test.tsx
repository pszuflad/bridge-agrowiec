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
  PROMOCJA_TESTOWA,
  TOKEN_TESTOWY,
  narzutyZFixtura,
  produktyZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const NARZUTY = narzutyZFixtura();
const PRODUKTY = produktyZFixtura();

/**
 * Pola wysyłane przy TWORZENIU — komplet z `POLA_EDYTOWALNE_NARZUTU`/`_PROMOCJI` (4a).
 * Oryginał: `Nb()` (`:9205-9214`) i `Cb()` (`:9320-9326`).
 */
const POLA_POST_NARZUTU = ["typ", "zakres", "warunki", "nazwa", "wartosc", "jednostka", "priorytet", "status"].sort();
const POLA_POST_PROMOCJI = ["nazwa", "rabatPct", "zasieg", "warunki", "priorytet", "start", "koniec", "status"].sort();

/**
 * ⚠ EDYCJA WYSYŁA MNIEJ. `Ag()` i `Eb()` przekazują `{...t}`, czyli dokładnie to, co podał
 * dialog (`:24621-24627`, `:24600-24608`) — bez `jednostka` i BEZ `status`. To nie jest
 * przeoczenie oryginału: pominięcie `status` sprawia, że zapis z formularza nie cofa
 * przełącznika aktywności z tabeli, a przy promocji nie nadpisuje statusu wyliczonego z dat.
 */
const POLA_PATCH_NARZUTU = ["typ", "zakres", "warunki", "nazwa", "wartosc", "priorytet"].sort();
const POLA_PATCH_PROMOCJI = ["nazwa", "rabatPct", "zasieg", "warunki", "priorytet", "start", "koniec"].sort();

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
    http.patch("*/api/markups/:id", async ({ request, params }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      wyslane.push({ metoda: "PATCH", sciezka: `/api/markups/${String(params.id)}`, cialo });
      return HttpResponse.json({ ...NARZUTY[0], ...cialo });
    }),
    http.patch("*/api/promotions/:id", async ({ request, params }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      wyslane.push({ metoda: "PATCH", sciezka: `/api/promotions/${String(params.id)}`, cialo });
      return HttpResponse.json({ id: Number(params.id), ...cialo });
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

/**
 * ⚠ DOMYŚLNE FORMULARZA (`:24216-24222`), na których stoją wszystkie testy niżej:
 * nowa reguła startuje z checkboxem „globalna" ODZNACZONYM i JEDNYM pustym warunkiem typu
 * `kategoria`, wartość ma domyślnie 15% (narzut) albo 10% (rabat), a daty są prefiled
 * na dziś i dziś+30 dni. Żeby zapisać regułę globalną, trzeba checkbox ZAZNACZYĆ.
 */
async function zaznaczGlobalna() {
  await userEvent.click(screen.getByTestId("checkbox-globalny"));
}

/** Wybiera wartość warunku ze słownika (typ `kategoria` jest domyślny dla nowego warunku). */
async function wybierzKategorie(nazwa: string) {
  await userEvent.click(screen.getByTestId("select-warunek-wartosc-0"));
  await userEvent.click(await screen.findByRole("option", { name: nazwa }));
}

async function wpiszWartosc(v: string) {
  await userEvent.clear(screen.getByTestId("input-markup-value"));
  await userEvent.type(screen.getByTestId("input-markup-value"), v);
}

describe("1. Domyślne nowej reguły — 1:1 z oryginałem", () => {
  it("checkbox „globalna\" jest ODZNACZONY, a warunek jeden i pusty", async () => {
    zamockujApi();
    await otworzDialogNarzutu();

    expect(screen.getByTestId("checkbox-globalny")).not.toBeChecked();
    expect(screen.getByTestId("select-warunek-typ-0")).toBeInTheDocument();
  });

  it("wartość domyślna to 15% dla narzutu i 10% dla rabatu", async () => {
    zamockujApi();
    await otworzDialogNarzutu();
    expect(screen.getByTestId("input-markup-value")).toHaveValue(15);
  });

  it("daty promocji są wypełnione z góry", async () => {
    zamockujApi();
    await otworzDialogPromocji();

    expect(screen.getByTestId("input-markup-value")).toHaveValue(10);
    expect(screen.getByTestId("input-promo-start")).not.toHaveValue("");
    expect(screen.getByTestId("input-promo-koniec")).not.toHaveValue("");
  });
});

describe("2. Kształt wysyłanego ciała — TWORZENIE", () => {
  it("⭐ narzut: DOKŁADNIE osiem pól z listy edytowalnej, ani jednego więcej", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();

    await userEvent.type(screen.getByTestId("input-markup-name"), "Globalna 6%");
    await zaznaczGlobalna();
    await wpiszWartosc("6");
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(Object.keys(wyslane[0]!.cialo).sort()).toEqual(POLA_POST_NARZUTU);
    // Pola ustawiane przez SERWER nie mogą wyjść z formularza.
    expect(wyslane[0]!.cialo).not.toHaveProperty("zmienilUzytkownikId");
    expect(wyslane[0]!.cialo).not.toHaveProperty("zmienionoData");
    expect(wyslane[0]!.cialo).not.toHaveProperty("id");
  });

  it("⭐ promocja: DOKŁADNIE osiem pól z listy edytowalnej", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await userEvent.type(screen.getByTestId("input-markup-name"), "Zima");
    await zaznaczGlobalna();
    await wpiszWartosc("5");
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(Object.keys(wyslane[0]!.cialo).sort()).toEqual(POLA_POST_PROMOCJI);
  });

  it("reguła globalna wysyła warunki jako STRING \"[]\" i typ „globalny\"", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();

    await zaznaczGlobalna();
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.cialo.warunki).toBe("[]");
    expect(wyslane[0]!.cialo.typ).toBe("globalny");
    expect(wyslane[0]!.cialo.zakres).toBe("");
  });

  /**
   * ⚠ ZASIĘG PROMOCJI GLOBALNEJ TO NAPIS „globalny", NIE PUSTY (`:24613`). Różnica jest
   * znacząca: `promocjaPasuje` odrzuca promocję z PUSTYM `zasieg`, więc pusty napis dałby
   * promocję, która nie obniża niczego.
   */
  it("⭐ promocja globalna wysyła zasieg „globalny\", nie pusty napis", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await zaznaczGlobalna();
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.cialo.zasieg).toBe("globalny");
  });

  it("warunki jadą jako string z JSON-em, a typ/zakres biorą się z PIERWSZEGO warunku", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();

    await wybierzKategorie("Rolnicze");
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    const warunki = wyslane[0]!.cialo.warunki;
    expect(typeof warunki).toBe("string");
    expect(JSON.parse(warunki as string)).toEqual([{ typ: "kategoria", wartosc: "Rolnicze" }]);
    // `Nb()` (`:9204-9207`) — `typ`/`zakres` z pierwszego warunku, nie „globalny".
    expect(wyslane[0]!.cialo.typ).toBe("kategoria");
    expect(wyslane[0]!.cialo.zakres).toBe("Rolnicze");
  });

  it("typ spoza słownika (produkt) daje pole tekstowe z podpowiedzią", async () => {
    zamockujApi();
    await otworzDialogNarzutu();

    await userEvent.click(screen.getByTestId("select-warunek-typ-0"));
    await userEvent.click(await screen.findByRole("option", { name: "Konkretny produkt (kod)" }));

    const pole = await screen.findByTestId("input-warunek-wartosc-0");
    expect(pole).toHaveAttribute("placeholder", "np. 10000085");
  });
});

describe("3. Kształt wysyłanego ciała — EDYCJA", () => {
  async function otworzEdycjeNarzutu() {
    window.history.pushState({}, "", "/narzuty");
    render(<App />);
    await userEvent.click(await screen.findByTestId(`button-edit-markup-${NARZUTY[0]!.id}`));
    return await screen.findByTestId("button-save-markup");
  }

  it("PATCH narzutu wysyła SZEŚĆ pól — bez `jednostka` i bez `status`", async () => {
    zamockujApi();
    const zapisz = await otworzEdycjeNarzutu();
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.metoda).toBe("PATCH");
    expect(Object.keys(wyslane[0]!.cialo).sort()).toEqual(POLA_PATCH_NARZUTU);
  });

  /**
   * ⭐ REGRESJA ZŁAPANA W REVIEW. Formularz nie ma pola priorytetu (w oryginale stoi pod
   * `display:none`, `:24468-24472`), ale MUSI odesłać wartość, którą reguła już ma
   * (`priorytet: C`, gdzie `C = t?.priorytet ?? 50`). Bez tego każdy zapis zbijałby
   * priorytet do 50 i po cichu zmieniał, KTÓRA reguła wygrywa dla produktu.
   */
  it("⭐ PATCH zachowuje priorytet reguły, zamiast zbijać go do 50", async () => {
    const zPriorytetem = { ...NARZUTY[0]!, priorytet: 99 };
    server.use(http.get("*/api/markups", () => HttpResponse.json([zPriorytetem])));
    zamockujApi();
    server.use(http.get("*/api/markups", () => HttpResponse.json([zPriorytetem])));

    const zapisz = await otworzEdycjeNarzutu();
    await userEvent.click(zapisz);

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.cialo.priorytet).toBe(99);
  });

  /**
   * ⚠ PATCH promocji NIE wysyła `status` (`Eb()`, `:9384-9387`). To ma znaczenie po 4b:
   * etykietę statusu liczymy z dat przy odczycie, a kolumna w bazie zostaje taka, jaka była —
   * gdyby formularz ją nadpisywał, edycja dat cicho włączałaby i wyłączała promocję.
   */
  it("⭐ PATCH promocji wysyła SIEDEM pól — bez `status`", async () => {
    zamockujApi([PROMOCJA_TESTOWA]);
    window.history.pushState({}, "", "/narzuty");
    render(<App />);
    await userEvent.click(await screen.findByTestId("tab-promocje"));
    await userEvent.click(
      await screen.findByTestId(`button-edit-promotion-${PROMOCJA_TESTOWA.id}`),
    );
    await userEvent.click(await screen.findByTestId("button-save-markup"));

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.metoda).toBe("PATCH");
    expect(Object.keys(wyslane[0]!.cialo).sort()).toEqual(POLA_PATCH_PROMOCJI);
    expect(wyslane[0]!.cialo).not.toHaveProperty("status");
  });

  it("edycja reguły z warunki:\"[]\" otwiera się z zaznaczoną „globalną\"", async () => {
    zamockujApi();
    await otworzEdycjeNarzutu();
    expect(screen.getByTestId("checkbox-globalny")).toBeChecked();
  });
});

describe("4. Walidacje", () => {
  it("brak warunków przy odznaczonej globalnej blokuje zapis", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();
    await userEvent.click(zapisz);

    expect(await screen.findByText("Brak warunków")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
  });

  it("wartość ujemna blokuje zapis", async () => {
    zamockujApi();
    const zapisz = await otworzDialogNarzutu();

    await zaznaczGlobalna();
    await wpiszWartosc("-5");
    await userEvent.click(zapisz);

    expect(await screen.findByText("Nieprawidłowa wartość")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
  });

  it("koniec przed startem blokuje zapis promocji", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await zaznaczGlobalna();
    await userEvent.clear(screen.getByTestId("input-promo-start"));
    await userEvent.type(screen.getByTestId("input-promo-start"), "2026-06-01");
    await userEvent.clear(screen.getByTestId("input-promo-koniec"));
    await userEvent.type(screen.getByTestId("input-promo-koniec"), "2026-01-01");
    await userEvent.click(zapisz);

    expect(await screen.findByText("Niepoprawne daty")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
  });
});

describe("5. Odstępstwa świadome", () => {
  /** plan.md D4 — oryginał wystawiał sześć typów, silnik rozumie dziewięć. */
  it("⭐ builder ma dziewięć typów warunku, w tym trzy dołożone w 4b", () => {
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

describe("6. Ostrzeżenie „poniżej kosztu\" (plan.md D6)", () => {
  /**
   * Oryginał ma DWA ostrzeżenia liczone tą samą metodą: czerwony pasek NA ŻYWO w formularzu
   * (`:24473-24513`) i potwierdzenie przy zapisie (`:24563-24597`, u nas dialogiem zamiast
   * `window.confirm`). Promocja globalna obejmuje w tym rachunku WSZYSTKIE produkty,
   * a fixture niesie realne ceny (zakup 560–5562 zł), więc rabat 90% musi je zepchnąć pod koszt.
   */
  it("⭐ pasek NA ŻYWO pojawia się jeszcze przed kliknięciem „Zapisz\"", async () => {
    zamockujApi();
    await otworzDialogPromocji();

    await zaznaczGlobalna();
    await wpiszWartosc("90");

    expect(await screen.findByTestId("ostrzezenie-ponizej-kosztu")).toHaveTextContent(
      /PONIŻEJ ceny zakupu/,
    );
    expect(wyslane).toHaveLength(0);
  });

  it("pasek znika przy umiarkowanym rabacie", async () => {
    zamockujApi();
    await otworzDialogPromocji();

    await zaznaczGlobalna();
    await wpiszWartosc("1");

    await waitFor(() =>
      expect(screen.queryByTestId("ostrzezenie-ponizej-kosztu")).not.toBeInTheDocument(),
    );
  });

  it("⭐ zapis pokazuje dialog potwierdzenia ZAMIAST wysyłać", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await userEvent.type(screen.getByTestId("input-markup-name"), "Zabójcza");
    await zaznaczGlobalna();
    await wpiszWartosc("90");
    await userEvent.click(zapisz);

    expect(await screen.findByTestId("dialog-ponizej-kosztu")).toBeInTheDocument();
    expect(wyslane).toHaveLength(0);
  });

  it("anulowanie NIE wysyła żądania", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await zaznaczGlobalna();
    await wpiszWartosc("90");
    await userEvent.click(zapisz);
    await userEvent.click(await screen.findByTestId("button-anuluj-ponizej-kosztu"));

    expect(wyslane).toHaveLength(0);
  });

  it("potwierdzenie wysyła promocję mimo ostrzeżenia", async () => {
    zamockujApi();
    const zapisz = await otworzDialogPromocji();

    await zaznaczGlobalna();
    await wpiszWartosc("90");
    await userEvent.click(zapisz);
    await userEvent.click(await screen.findByTestId("button-potwierdz-ponizej-kosztu"));

    await waitFor(() => expect(wyslane).toHaveLength(1));
    expect(wyslane[0]!.cialo.rabatPct).toBe(90);
  });

  it("ostrzeżenie nie dotyczy narzutów — tylko promocji, jak w oryginale", async () => {
    zamockujApi();
    await otworzDialogNarzutu();

    await zaznaczGlobalna();
    await wpiszWartosc("0");

    expect(screen.queryByTestId("ostrzezenie-ponizej-kosztu")).not.toBeInTheDocument();
  });
});
