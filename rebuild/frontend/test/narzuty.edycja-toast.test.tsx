/**
 * Karta 14e, zadanie B — zgłoszenie Ani z `docs/instrukcja-testow-I4.md` §3.11:
 * „po edycji reguły pokazuje się komunikat «Reguła dodana»".
 *
 * Widok `/narzuty` montuje DWIE niezależne instancje `DialogReguly` na zasób:
 *   • „Dodaj" — zamontowana ZAWSZE, nigdy się nie odmontowuje, stan celowo bez resetu
 *     (`DialogReguly.tsx:337-344`, port `el()` — formularz pamięta ostatnie wpisy);
 *   • „Edytuj" — montowana WARUNKOWO (`TabelaNarzutow.tsx:77-81`, `TabelaPromocji.tsx:92-98`),
 *     `onClose` ją odmontowuje.
 * Treść toastu bierze się z `dodawanie = !edycja` (`DialogReguly.tsx:272-282`).
 *
 * Te testy pilnują trzech rzeczy naraz:
 *   1. że ołówek NIE wpada w tryb dodawania (tytuł, metoda HTTP, treść toastu),
 *   2. że zapis z edycji leci PATCH, więc NIE powstaje druga reguła — to jest realne
 *      pytanie ze zgłoszenia, nie sama etykieta komunikatu,
 *   3. że dialog „Dodaj" pamięta wpisy (zachowanie ORYGINAŁU, ma zostać) — i że edycja
 *      do niego NIE przecieka.
 *
 * Luka, którą ten plik zamyka: `narzuty.test.tsx` nie klika ołówka i nie sprawdza żadnego
 * toastu, a `narzuty.dialog.test.tsx` montuje dialog w izolacji, z pominięciem tabeli.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Narzut } from "@/pages/narzuty/api";
import {
  PROMOCJA_TESTOWA,
  TOKEN_TESTOWY,
  narzutyZFixtura,
  produktyZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const PRODUKTY = produktyZFixtura();

/** Reguła z nagrania produkcji: `typ: "globalny"`, `wartosc: 6`, `warunki: "[]"`. */
const NARZUT = narzutyZFixtura()[0]!;
/** Druga reguła — żeby dało się sprawdzić przejście edycji z wiersza na wiersz. */
const NARZUT_DRUGI: Narzut = {
  ...NARZUT,
  id: NARZUT.id + 1,
  nazwa: "Druga reguła",
  wartosc: 12,
  typ: "marka",
  zakres: "BKT",
  warunki: JSON.stringify([{ typ: "marka", wartosc: "BKT" }]),
};
const NARZUTY = [NARZUT, NARZUT_DRUGI];
const PROMOCJE = [PROMOCJA_TESTOWA];

/** Każde żądanie mutujące — metoda i ścieżka. To po tym poznajemy „dodane" od „zmienionego". */
let zadania: { metoda: string; sciezka: string; cialo: Record<string, unknown> }[] = [];

function zamockujApi() {
  server.use(
    http.get("*/api/markups", () => HttpResponse.json(NARZUTY)),
    http.get("*/api/promotions", () => HttpResponse.json(PROMOCJE)),
    http.get("*/api/products", () => HttpResponse.json(PRODUKTY)),
    http.post("*/api/markups", async ({ request }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      zadania.push({ metoda: "POST", sciezka: "/api/markups", cialo });
      return HttpResponse.json({ ...NARZUT, ...cialo, id: 999 });
    }),
    http.patch("*/api/markups/:id", async ({ request, params }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      zadania.push({ metoda: "PATCH", sciezka: `/api/markups/${String(params.id)}`, cialo });
      return HttpResponse.json({ ...NARZUT, ...cialo });
    }),
    http.post("*/api/promotions", async ({ request }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      zadania.push({ metoda: "POST", sciezka: "/api/promotions", cialo });
      return HttpResponse.json({ ...PROMOCJA_TESTOWA, ...cialo, id: 999 });
    }),
    http.patch("*/api/promotions/:id", async ({ request, params }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      zadania.push({ metoda: "PATCH", sciezka: `/api/promotions/${String(params.id)}`, cialo });
      return HttpResponse.json({ ...PROMOCJA_TESTOWA, ...cialo });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzNarzuty() {
  window.history.pushState({}, "", "/narzuty");
  render(<App />);
  return await screen.findByTestId(`row-markup-${NARZUT.id}`);
}

/** Przejście na zakładkę promocji — obie tabele nie współistnieją w DOM (Radix bez `forceMount`). */
async function otworzPromocje(uzytkownik: ReturnType<typeof userEvent.setup>) {
  await uzytkownik.click(screen.getByTestId("tab-promocje"));
  return await screen.findByTestId(`row-promotion-${PROMOCJA_TESTOWA.id}`);
}

async function klikOlowek(uzytkownik: ReturnType<typeof userEvent.setup>, testid: string) {
  await uzytkownik.click(screen.getByTestId(testid));
  return await screen.findByRole("dialog");
}

beforeEach(() => {
  zadania = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
  zamockujApi();
});

describe("1. Ołówek otwiera EDYCJĘ, nie dodawanie", () => {
  it("dialog po kliknięciu ołówka ma tytuł „Edytuj regułę\"", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    const dialog = await klikOlowek(uzytkownik, `button-edit-markup-${NARZUT.id}`);

    expect(within(dialog).getByText("Edytuj regułę")).toBeInTheDocument();
    expect(within(dialog).queryByText("Nowa reguła cenowa")).not.toBeInTheDocument();
  });

  it("dialog edycji niesie wartości EDYTOWANEJ reguły, nie puste pola", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    const dialog = await klikOlowek(uzytkownik, `button-edit-markup-${NARZUT.id}`);

    expect(within(dialog).getByTestId("input-markup-name")).toHaveValue(NARZUT.nazwa);
    // pole wartości jest `type="number"` — jsdom oddaje liczbę, nie string
    expect(within(dialog).getByTestId("input-markup-value")).toHaveValue(Number(NARZUT.wartosc));
  });

  it("instancja edycji NIE renderuje przycisku „Dodaj regułę\"", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    const dialog = await klikOlowek(uzytkownik, `button-edit-markup-${NARZUT.id}`);

    expect(within(dialog).queryByTestId("button-add-markup")).not.toBeInTheDocument();
  });
});

describe("2. ⭐ Zapis po edycji NIE tworzy drugiej reguły", () => {
  it("narzut: zapis leci PATCH na id edytowanej reguły, bez żadnego POST", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    const dialog = await klikOlowek(uzytkownik, `button-edit-markup-${NARZUT.id}`);
    const wartosc = within(dialog).getByTestId("input-markup-value");
    await uzytkownik.clear(wartosc);
    await uzytkownik.type(wartosc, "9");
    await uzytkownik.click(within(dialog).getByTestId("button-save-markup"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]!.metoda).toBe("PATCH");
    expect(zadania[0]!.sciezka).toBe(`/api/markups/${NARZUT.id}`);
    expect(zadania.some((z) => z.metoda === "POST")).toBe(false);
  });

  it("promocja: zapis leci PATCH na id edytowanej promocji, bez żadnego POST", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();
    await otworzPromocje(uzytkownik);

    const dialog = await klikOlowek(
      uzytkownik,
      `button-edit-promotion-${PROMOCJA_TESTOWA.id}`,
    );
    const wartosc = within(dialog).getByTestId("input-markup-value");
    await uzytkownik.clear(wartosc);
    await uzytkownik.type(wartosc, "5");
    await uzytkownik.click(within(dialog).getByTestId("button-save-markup"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]!.metoda).toBe("PATCH");
    expect(zadania[0]!.sciezka).toBe(`/api/promotions/${PROMOCJA_TESTOWA.id}`);
    expect(zadania.some((z) => z.metoda === "POST")).toBe(false);
  });
});

describe("3. ⭐ Komunikat po edycji — sedno zgłoszenia §3.11", () => {
  it("narzut: toast mówi „Reguła zaktualizowana\", NIE „Reguła dodana\"", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    const dialog = await klikOlowek(uzytkownik, `button-edit-markup-${NARZUT.id}`);
    const wartosc = within(dialog).getByTestId("input-markup-value");
    await uzytkownik.clear(wartosc);
    await uzytkownik.type(wartosc, "9");
    await uzytkownik.click(within(dialog).getByTestId("button-save-markup"));

    const toast = await screen.findByTestId("toast-default");
    expect(toast).toHaveTextContent("Reguła zaktualizowana");
    expect(toast).not.toHaveTextContent("Reguła dodana");
  });

  it("promocja: toast mówi „Promocja zaktualizowana\", NIE „Promocja dodana\"", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();
    await otworzPromocje(uzytkownik);

    const dialog = await klikOlowek(
      uzytkownik,
      `button-edit-promotion-${PROMOCJA_TESTOWA.id}`,
    );
    const wartosc = within(dialog).getByTestId("input-markup-value");
    await uzytkownik.clear(wartosc);
    await uzytkownik.type(wartosc, "5");
    await uzytkownik.click(within(dialog).getByTestId("button-save-markup"));

    const toast = await screen.findByTestId("toast-default");
    expect(toast).toHaveTextContent("Promocja zaktualizowana");
    expect(toast).not.toHaveTextContent("Promocja dodana");
  });

  it("dla odróżnienia: DODANIE reguły daje „Reguła dodana\" i leci POST", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    await uzytkownik.click(screen.getByTestId("button-add-markup"));
    const dialog = await screen.findByRole("dialog");
    await uzytkownik.type(within(dialog).getByTestId("input-markup-name"), "Nowa z testu");
    // bez warunku ani „reguły globalnej" zapis odbija się o walidację „Brak warunków"
    // (`DialogReguly.tsx:306-310`, port `:24549`) — zaznaczamy globalną, jak w §3.1 instrukcji
    await uzytkownik.click(within(dialog).getByTestId("checkbox-globalny"));
    await uzytkownik.clear(within(dialog).getByTestId("input-markup-value"));
    await uzytkownik.type(within(dialog).getByTestId("input-markup-value"), "7");
    await uzytkownik.click(within(dialog).getByTestId("button-save-markup"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]!.metoda).toBe("POST");
    expect(await screen.findByTestId("toast-default")).toHaveTextContent("Reguła dodana");
  });
});

describe("4. Przejście edycji z wiersza na wiersz", () => {
  it("ołówek przy DRUGIEJ regule pokazuje jej dane, bez resztki po pierwszej", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    const pierwszy = await klikOlowek(uzytkownik, `button-edit-markup-${NARZUT.id}`);
    expect(within(pierwszy).getByTestId("input-markup-name")).toHaveValue(NARZUT.nazwa);
    await uzytkownik.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const drugi = await klikOlowek(uzytkownik, `button-edit-markup-${NARZUT_DRUGI.id}`);
    expect(within(drugi).getByTestId("input-markup-name")).toHaveValue(NARZUT_DRUGI.nazwa);
    expect(within(drugi).getByTestId("input-markup-value")).toHaveValue(
      Number(NARZUT_DRUGI.wartosc),
    );
  });
});

describe("5. Formularz DODAWANIA pamięta wpisy — zachowanie oryginału, nie usterka", () => {
  it("wpisy w „Dodaj regułę\" przeżywają zamknięcie dialogu", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    await uzytkownik.click(screen.getByTestId("button-add-markup"));
    const pierwsze = await screen.findByRole("dialog");
    await uzytkownik.type(within(pierwsze).getByTestId("input-markup-name"), "Zapamiętana");
    await uzytkownik.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await uzytkownik.click(screen.getByTestId("button-add-markup"));
    const drugie = await screen.findByRole("dialog");
    expect(within(drugie).getByTestId("input-markup-name")).toHaveValue("Zapamiętana");
  });

  it("⭐ edycja NIE przecieka do formularza dodawania", async () => {
    const uzytkownik = userEvent.setup();
    await otworzNarzuty();

    const edycja = await klikOlowek(uzytkownik, `button-edit-markup-${NARZUT.id}`);
    const nazwa = within(edycja).getByTestId("input-markup-name");
    await uzytkownik.clear(nazwa);
    await uzytkownik.type(nazwa, "Zmieniona w edycji");
    await uzytkownik.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await uzytkownik.click(screen.getByTestId("button-add-markup"));
    const dodawanie = await screen.findByRole("dialog");
    expect(within(dodawanie).getByText("Nowa reguła cenowa")).toBeInTheDocument();
    expect(within(dodawanie).getByTestId("input-markup-name")).not.toHaveValue(
      "Zmieniona w edycji",
    );
  });
});
