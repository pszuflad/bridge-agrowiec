/**
 * `/katalog` — przepływy mutacji produktu (sesja 12c).
 *
 * Cztery rzeczy, których pilnuje ten plik i których nie sprawdzi żaden test jednostkowy:
 *  1. `PATCH` niesie WYŁĄCZNIE pola dotknięte przez użytkownika (trasa zapisuje
 *     `manual_overrides` per klucz w ciele — pole nadmiarowe zamraża wartość przed importem);
 *  2. przełącznik statusu jest jedną pozycją działającą w OBIE strony;
 *  3. usunięcie wymaga potwierdzenia, a anulowanie nie wysyła niczego;
 *  4. invalidowane są dokładnie te klucze, co w oryginale (plus `["/api/history"]` z D2) —
 *     i ANI JEDEN więcej. Asercja negatywna jest tu celowa: prompt tej sesji sugerował
 *     dołożenie `["/api/alerts"]`/`["/api/analytics"]`, a oryginał tego nie robi.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE, zapiszToken } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Override } from "@/pages/katalog/api";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import { server } from "./msw/server";
import {
  dostawcyZFixtura,
  overridesZFixtura,
  produktyZFixtura,
  TOKEN_TESTOWY,
  uzytkownikZFixtura,
} from "./msw/kontrakt";

const UZYTKOWNIK = uzytkownikZFixtura();
const PRODUKTY = produktyZFixtura();
const DOSTAWCY = dostawcyZFixtura();
const PIERWSZY = PRODUKTY[0] as Produkt;

type Patch = { id: string; cialo: Record<string, unknown> };

let patche: Patch[] = [];
let skasowaneProdukty: string[] = [];
let skasowaneOverrides: string[] = [];
let zapytaniaOverrides: { dostawca: string | null; kod: string | null }[] = [];

const SLOWNIK = {
  ok: true,
  rodzaje: [],
  wartosci: [
    { rodzaj: "marka", wartosc: "BKT" },
    { rodzaj: "marka", wartosc: "Michelin" },
    { rodzaj: "kategoria", wartosc: "Rolnicze" },
    { rodzaj: "kategoria", wartosc: "Leśne" },
  ],
};

function zamockujApi(opcje: { produkty?: Produkt[]; overrides?: Override[] } = {}) {
  const produkty = opcje.produkty ?? PRODUKTY;
  const overrides = opcje.overrides ?? [];

  server.use(
    http.get("*/api/products", () => HttpResponse.json(produkty)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/config", () => HttpResponse.json({})),
    http.get("*/api/atrybuty", () => HttpResponse.json(SLOWNIK)),
    http.get("*/api/overrides", ({ request }) => {
      const parametry = new URL(request.url).searchParams;
      zapytaniaOverrides.push({
        dostawca: parametry.get("dostawca"),
        kod: parametry.get("kod"),
      });
      return HttpResponse.json(overrides);
    }),
    http.delete("*/api/overrides/:id", ({ params }) => {
      skasowaneOverrides.push(String(params.id));
      return HttpResponse.json({ ok: true });
    }),
    http.patch("*/api/products/:id", async ({ request, params }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      patche.push({ id: String(params.id), cialo });
      // Trasa oddaje PEŁNY produkt po zapisie, nie `{ok:true}` (12a, `wKontrakcie`).
      const zrodlo = produkty.find((p) => String(p.id) === String(params.id)) ?? PIERWSZY;
      return HttpResponse.json({ ...zrodlo, ...cialo });
    }),
    http.delete("*/api/products/:id", ({ params }) => {
      skasowaneProdukty.push(String(params.id));
      return HttpResponse.json({ ok: true });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzKatalog() {
  window.history.pushState({}, "", "/katalog");
  render(<App />);
  await screen.findByTestId(`row-product-${PIERWSZY.id}`);
}

async function otworzMenu(produkt: Produkt = PIERWSZY) {
  await userEvent.click(screen.getByTestId(`button-actions-${produkt.id}`));
}

async function otworzDialogEdycji(produkt: Produkt = PIERWSZY) {
  await otworzMenu(produkt);
  await userEvent.click(await screen.findByTestId(`button-edit-${produkt.id}`));
  return await screen.findByTestId("dialog-edycja-produktu");
}

beforeEach(() => {
  patche = [];
  skasowaneProdukty = [];
  skasowaneOverrides = [];
  zapytaniaOverrides = [];
  queryClient.clear();
  zapiszToken(null);
  localStorage.clear();
  sessionStorage.clear();
  zasiejSesje();
});

describe("1. Menu „Akcje” — kształt 1:1 z oryginałem", () => {
  it("ma cztery pozycje w kolejności oryginału", async () => {
    zamockujApi();
    await otworzKatalog();
    await otworzMenu();

    const pozycje = await screen.findAllByRole("menuitem");
    expect(pozycje.map((p) => p.textContent)).toEqual([
      "Edytuj",
      "Historia",
      "Wstrzymaj",
      "Usuń",
    ]);
  });

  it("„Historia” jest wyłączona — produkcja nigdy nie podpięła tego wejścia", async () => {
    zamockujApi();
    await otworzKatalog();
    await otworzMenu();

    const historia = await screen.findByRole("menuitem", { name: "Historia" });
    expect(historia).toHaveAttribute("aria-disabled", "true");
  });
});

describe("2. Edycja produktu (PATCH)", () => {
  it("wysyła WYŁĄCZNIE pola dotknięte przez użytkownika", async () => {
    zamockujApi();
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();

    const nazwa = within(dialog).getByLabelText("Nazwa");
    await userEvent.clear(nazwa);
    await userEvent.type(nazwa, "Opona testowa");
    await userEvent.click(within(dialog).getByTestId("button-save-edit"));

    await waitFor(() => expect(patche).toHaveLength(1));
    expect(patche[0]?.id).toBe(String(PIERWSZY.id));
    // Klucz jeden — nie cały produkt. To jest sedno portu: trasa zakłada
    // `manual_overrides` dla KAŻDEGO klucza w ciele.
    expect(Object.keys(patche[0]?.cialo ?? {})).toEqual(["nazwa"]);
    expect(patche[0]?.cialo.nazwa).toBe("Opona testowa");
  });

  it("nie wysyła `dostawcy` — pole jest wyłączone", async () => {
    zamockujApi();
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();

    expect(within(dialog).getByLabelText("Dostawca")).toBeDisabled();
  });

  it("pole „Bieznik/model” zapisuje OBA klucze naraz", async () => {
    zamockujApi();
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();

    const bieznik = within(dialog).getByLabelText("Bieznik/model");
    await userEvent.clear(bieznik);
    await userEvent.type(bieznik, "NOWY WZOR");
    await userEvent.click(within(dialog).getByTestId("button-save-edit"));

    await waitFor(() => expect(patche).toHaveLength(1));
    expect(patche[0]?.cialo).toEqual({ model: "NOWY WZOR", bieznik: "NOWY WZOR" });
  });

  it("pole liczbowe wyczyszczone do pustego daje null, nie NaN", async () => {
    zamockujApi();
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();

    await userEvent.clear(within(dialog).getByLabelText("Cena zakupu"));
    await userEvent.click(within(dialog).getByTestId("button-save-edit"));

    await waitFor(() => expect(patche).toHaveLength(1));
    expect(patche[0]?.cialo).toEqual({ cenaZakupu: null });
  });

  it("select słownikowy podaje wartości ze słownika, posortowane po polsku", async () => {
    zamockujApi();
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();

    await userEvent.click(within(dialog).getByLabelText("Producent"));
    const opcje = await screen.findAllByRole("option");
    // Pierwsza pozycja to „-" (brak wartości), potem słownik.
    expect(opcje.map((o) => o.textContent)).toEqual(["-", "BKT", "Michelin"]);
  });

  it("po zapisie dialog się zamyka i leci toast oryginału", async () => {
    zamockujApi();
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();

    await userEvent.type(within(dialog).getByLabelText("DOT"), "2624");
    await userEvent.click(within(dialog).getByTestId("button-save-edit"));

    expect(await screen.findByText("Zapisano zmiany")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("dialog-edycja-produktu")).not.toBeInTheDocument(),
    );
  });
});

describe("3. Wstrzymanie i aktywacja (jedna pozycja, dwie strony)", () => {
  it("produkt aktywny → „Wstrzymaj” wysyła status wstrzymany", async () => {
    zamockujApi();
    await otworzKatalog();
    await otworzMenu();

    await userEvent.click(await screen.findByRole("menuitem", { name: "Wstrzymaj" }));

    await waitFor(() => expect(patche).toHaveLength(1));
    expect(patche[0]?.cialo).toEqual({ status: "wstrzymany" });
    expect(await screen.findByText("Wstrzymano")).toBeInTheDocument();
  });

  it("produkt wstrzymany → „Aktywuj” wysyła status aktywny", async () => {
    const wstrzymany: Produkt = { ...PIERWSZY, status: "wstrzymany" };
    zamockujApi({ produkty: [wstrzymany] });
    await otworzKatalog();
    await otworzMenu(wstrzymany);

    // Ta sama pozycja menu, odwrócona etykieta — w oryginale nie ma dwóch osobnych akcji.
    expect(screen.queryByRole("menuitem", { name: "Wstrzymaj" })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Aktywuj" }));

    await waitFor(() => expect(patche).toHaveLength(1));
    expect(patche[0]?.cialo).toEqual({ status: "aktywny" });
    expect(await screen.findByText("Aktywowano")).toBeInTheDocument();
  });
});

describe("4. Usuwanie (DELETE + potwierdzenie)", () => {
  it("pyta o potwierdzenie tekstem oryginału", async () => {
    zamockujApi();
    await otworzKatalog();
    await otworzMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Usuń" }));

    const dialog = await screen.findByTestId("dialog-usun-produkt");
    // Treść DOSŁOWNIE z `window.confirm` oryginału (`:23805`) — zmienia się nośnik (D1),
    // nie pytanie.
    expect(within(dialog).getByText(`Usunąć ${PIERWSZY.kod}?`)).toBeInTheDocument();
  });

  it("anulowanie NIE wysyła żądania", async () => {
    zamockujApi();
    await otworzKatalog();
    await otworzMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Usuń" }));

    const dialog = await screen.findByTestId("dialog-usun-produkt");
    await userEvent.click(within(dialog).getByTestId("button-anuluj"));

    await waitFor(() =>
      expect(screen.queryByTestId("dialog-usun-produkt")).not.toBeInTheDocument(),
    );
    expect(skasowaneProdukty).toEqual([]);
  });

  it("potwierdzenie wysyła DELETE i pokazuje toast", async () => {
    zamockujApi();
    await otworzKatalog();
    await otworzMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Usuń" }));

    const dialog = await screen.findByTestId("dialog-usun-produkt");
    await userEvent.click(within(dialog).getByTestId("button-potwierdz"));

    await waitFor(() => expect(skasowaneProdukty).toEqual([String(PIERWSZY.id)]));
    expect(await screen.findByText("Usunięto produkt")).toBeInTheDocument();
  });
});

describe("5. Override'y", () => {
  it("pyta o override'y dokładnie tego produktu", async () => {
    zamockujApi();
    await otworzKatalog();
    await otworzDialogEdycji();

    await waitFor(() => expect(zapytaniaOverrides.length).toBeGreaterThan(0));
    expect(zapytaniaOverrides[0]).toEqual({
      dostawca: PIERWSZY.dostawca,
      kod: PIERWSZY.kod,
    });
  });

  it("znacznik „override” stoi przy polach, które mają poprawkę — i tylko przy nich", async () => {
    // Dane z nagrania produkcji: `fieldName` w camelCase (`kategoria`, `labelSnow`).
    const overrides = overridesZFixtura().slice(0, 2);
    expect(overrides.map((o) => o.fieldName)).toEqual(["kategoria", "labelSnow"]);
    zamockujApi({ overrides });
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();

    expect(await within(dialog).findByTestId("button-override-kategoria")).toBeInTheDocument();
    expect(within(dialog).getByTestId("button-override-labelSnow")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("button-override-nazwa")).not.toBeInTheDocument();
  });

  it("kliknięcie znacznika kasuje override", async () => {
    const overrides = overridesZFixtura().slice(0, 1);
    zamockujApi({ overrides });
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();

    await userEvent.click(await within(dialog).findByTestId("button-override-kategoria"));

    await waitFor(() => expect(skasowaneOverrides).toEqual([String(overrides[0]?.id)]));
  });
});

describe("6. Invalidacje po mutacji", () => {
  /** Zbiera klucze przekazane do `invalidateQueries` w trakcie jednego przepływu. */
  function nasluchujInvalidacji() {
    const klucze: string[] = [];
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation((filtry) => {
      const klucz = (filtry as { queryKey?: unknown[] } | undefined)?.queryKey;
      if (Array.isArray(klucz)) klucze.push(String(klucz[0]));
      return Promise.resolve();
    });
    return klucze;
  }

  it("edycja unieważnia produkty i historię — i nic więcej", async () => {
    zamockujApi();
    await otworzKatalog();
    const dialog = await otworzDialogEdycji();
    const klucze = nasluchujInvalidacji();

    await userEvent.type(within(dialog).getByLabelText("DOT"), "2624");
    await userEvent.click(within(dialog).getByTestId("button-save-edit"));

    await waitFor(() => expect(klucze).toContain("/api/products"));
    // D2: historia ma realnego pisarza od 12a, a klient ma `staleTime: Infinity`.
    expect(klucze).toContain("/api/history");
    // Oryginał (`Og`, `:9149`) NIE rusza tych kluczy — asercja negatywna pilnuje,
    // żeby ktoś ich nie dołożył „dla porządku".
    expect(klucze).not.toContain("/api/alerts");
    expect(klucze).not.toContain("/api/analytics");
  });

  it("usunięcie unieważnia te same klucze", async () => {
    zamockujApi();
    await otworzKatalog();
    await otworzMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Usuń" }));
    const klucze = nasluchujInvalidacji();

    await userEvent.click(
      within(await screen.findByTestId("dialog-usun-produkt")).getByTestId("button-potwierdz"),
    );

    await waitFor(() => expect(klucze).toContain("/api/products"));
    expect(klucze).toContain("/api/history");
    expect(klucze).not.toContain("/api/alerts");
    expect(klucze).not.toContain("/api/analytics");
  });
});
