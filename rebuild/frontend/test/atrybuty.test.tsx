/**
 * Widok `/atrybuty` — sesja 7b, słownik (kafle + panel wartości).
 *
 * Zakres: że ekran odtwarza EFEKT ZŁOŻONY produkcji (bazowy React + mostek w bundlu +
 * `pending-injection.js`), a nie sam bazowy widok — czyli kafle z licznikami i tagiem
 * `wbudowany`/`własny`, wejście w rodzaj, CRUD wartości, modal podglądu z komunikatem
 * „pokazano pierwsze 200” i komunikaty błędów spoza kontraktu (403/409/404).
 *
 * Kształty biorą się z `contract/fixtures/GET_atrybuty*.json` przez `test/msw/kontrakt.ts` —
 * zmiana fixtura ma wywalić te testy.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { OdpowiedzSlownika, ProduktUzycia, Wartosc } from "@/pages/atrybuty/api";
import { TOKEN_TESTOWY, slownikZFixtura, uzytkownikZFixtura } from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const FIXTURE = slownikZFixtura();

/**
 * Nagrane wartości to same `bieznik` (5 z 5144), więc do ćwiczenia list dokładamy wiersze
 * TEGO SAMEGO kształtu dla rodzaju `kategoria`, który jest w nagranych rodzajach.
 */
const WARTOSCI: Wartosc[] = [
  ...FIXTURE.wartosci,
  { id: 5001, rodzaj: "kategoria", wartosc: "Rolnicze" },
  { id: 5002, rodzaj: "kategoria", wartosc: "Ćwiartki" },
  { id: 5003, rodzaj: "kategoria", wartosc: "Zimowe" },
];

/** Rodzaj spoza listy rodzajów, ale z wartościami w bazie — „sierota” z oryginału (`:665`). */
const SIEROTA: Wartosc = { id: 5004, rodzaj: "sezon", wartosc: "Lato" };

function slownik(nadpisania: Partial<OdpowiedzSlownika> = {}): OdpowiedzSlownika {
  return { ok: true, rodzaje: FIXTURE.rodzaje, wartosci: WARTOSCI, ...nadpisania };
}

let zadania: { metoda: string; sciezka: string; cialo: unknown }[] = [];

function zamockujApi(dane: OdpowiedzSlownika = slownik()) {
  server.use(
    http.get("*/api/atrybuty", () => HttpResponse.json(dane)),
    http.get("*/api/atrybuty/pending", () => HttpResponse.json({ ok: true, count: 0, items: [] })),
    http.post("*/api/atrybuty/wartosci", async ({ request }) => {
      zadania.push({ metoda: "POST", sciezka: "/api/atrybuty/wartosci", cialo: await request.json() });
      return HttpResponse.json({ ok: true, wartosc: { id: 9001, rodzaj: "kategoria", wartosc: "Nowa" } });
    }),
    http.put("*/api/atrybuty/wartosci/:id", async ({ request, params }) => {
      zadania.push({
        metoda: "PUT",
        sciezka: `/api/atrybuty/wartosci/${String(params.id)}`,
        cialo: await request.json(),
      });
      return HttpResponse.json({ ok: true });
    }),
    http.delete("*/api/atrybuty/wartosci/:id", ({ params }) => {
      zadania.push({
        metoda: "DELETE",
        sciezka: `/api/atrybuty/wartosci/${String(params.id)}`,
        cialo: null,
      });
      return HttpResponse.json({ ok: true });
    }),
    http.post("*/api/atrybuty/rodzaje", async ({ request }) => {
      zadania.push({ metoda: "POST", sciezka: "/api/atrybuty/rodzaje", cialo: await request.json() });
      return HttpResponse.json({ ok: true, rodzaj: { value: "sezon", label: "Sezon", opis: null, core: 0 } });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzWidok() {
  window.history.pushState({}, "", "/atrybuty");
  render(<App />);
  return await screen.findByTestId("pasek-stanu-atrybuty");
}

async function wejdzWRodzaj(value: string) {
  await otworzWidok();
  await userEvent.click(await screen.findByTestId(`kafel-rodzaj-${value}`));
  return await screen.findByTestId("text-rodzaj-label");
}

beforeEach(() => {
  zadania = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("1. Kafle rodzajów", () => {
  it("pokazuje pasek stanu z liczbą rodzajów i wartości", async () => {
    zamockujApi();
    const pasek = await otworzWidok();

    expect(pasek).toHaveTextContent("● Zsynchronizowane z DB");
    // Pasek renderuje się od razu (z zerami), liczby dochodzą wraz z odpowiedzią słownika.
    await waitFor(() =>
      expect(pasek).toHaveTextContent(
        `${FIXTURE.rodzaje.length} rodzajów, ${WARTOSCI.length} wartości`,
      ),
    );
  });

  it("kafel niesie licznik wartości TEGO rodzaju i tag wbudowany/własny", async () => {
    zamockujApi();
    await otworzWidok();

    const kategoria = await screen.findByTestId("kafel-rodzaj-kategoria");
    expect(kategoria).toHaveTextContent("3"); // trzy wartości rodzaju `kategoria`
    // `core` przychodzi jako LICZBA 0/1, nie boolean — fixture ma `core: 1`.
    expect(kategoria).toHaveTextContent("wbudowany");
  });

  it("NIE MA kafla „Wszystkie atrybuty” — injection go w produkcji chowa (plan.md D3)", async () => {
    zamockujApi();
    await otworzWidok();

    expect(screen.queryByText("Wszystkie atrybuty")).not.toBeInTheDocument();
  });

  it("rodzaj obecny tylko w wartościach ląduje w sekcji „Sieroty w DB”", async () => {
    zamockujApi(slownik({ wartosci: [...WARTOSCI, SIEROTA] }));
    await otworzWidok();

    const sieroty = await screen.findByTestId("sekcja-sieroty");
    expect(sieroty).toHaveTextContent("sezon — 1");
  });

  it("błąd pobrania słownika daje pasek ostrzeżenia zamiast cichej pustki", async () => {
    // ⚠ Pusta lista i zepsute zapytanie wyglądają identycznie — stąd osobny pasek błędu
    // z tekstem „Lista może być niepełna lub pusta mimo danych w bazie”.
    server.use(
      http.get("*/api/atrybuty", () =>
        HttpResponse.json({ ok: false, error: "Błąd serwera" }, { status: 500 }),
      ),
      http.get("*/api/atrybuty/pending", () => HttpResponse.json({ ok: true, count: 0, items: [] })),
    );
    window.history.pushState({}, "", "/atrybuty");
    render(<App />);

    const pasek = await screen.findByTestId("pasek-blad-atrybuty");
    expect(pasek).toHaveTextContent("Błąd serwera");
    expect(pasek).toHaveTextContent("Lista może być niepełna lub pusta mimo danych w bazie.");
  });
});

describe("2. Panel wartości — CRUD", () => {
  it("wejście w kafel pokazuje wartości TEGO rodzaju, posortowane po polsku", async () => {
    zamockujApi();
    await wejdzWRodzaj("kategoria");

    const wiersze = screen.getAllByTestId(/^wiersz-wartosc-/);
    expect(wiersze.map((w) => w.textContent?.split("Podgląd")[0])).toEqual([
      "Ćwiartki",
      "Rolnicze",
      "Zimowe",
    ]);
  });

  it("dodanie wartości wysyła {rodzaj, wartosc}", async () => {
    zamockujApi();
    await wejdzWRodzaj("kategoria");

    await userEvent.type(screen.getByTestId("input-nowa-wartosc"), "Quady");
    await userEvent.click(screen.getByTestId("button-dodaj-wartosc"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({
      metoda: "POST",
      sciezka: "/api/atrybuty/wartosci",
      cialo: { rodzaj: "kategoria", wartosc: "Quady" },
    });
  });

  it("pusta wartość nie idzie do API — oryginał pokazuje toast „Wpisz wartość”", async () => {
    zamockujApi();
    await wejdzWRodzaj("kategoria");

    await userEvent.click(screen.getByTestId("button-dodaj-wartosc"));

    expect(await screen.findByText("Wpisz wartość")).toBeInTheDocument();
    expect(zadania).toHaveLength(0);
  });

  it("edycja idzie PUT-em z samą nową wartością", async () => {
    zamockujApi();
    await wejdzWRodzaj("kategoria");

    await userEvent.click(screen.getByTestId("button-edytuj-wartosc-5001"));
    const pole = await screen.findByTestId("input-dialog-tekstu");
    await userEvent.clear(pole);
    await userEvent.type(pole, "Rolnicze XL");
    await userEvent.click(screen.getByTestId("button-zapisz"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({
      metoda: "PUT",
      sciezka: "/api/atrybuty/wartosci/5001",
      cialo: { wartosc: "Rolnicze XL" },
    });
  });

  it("niezmieniona wartość NIE wysyła żądania (oryginał: `nowa === item.wartosc` → return)", async () => {
    zamockujApi();
    await wejdzWRodzaj("kategoria");

    await userEvent.click(screen.getByTestId("button-edytuj-wartosc-5001"));
    await screen.findByTestId("input-dialog-tekstu");
    await userEvent.click(screen.getByTestId("button-zapisz"));

    await waitFor(() =>
      expect(screen.queryByTestId("dialog-edytuj-wartosc")).not.toBeInTheDocument(),
    );
    expect(zadania).toHaveLength(0);
  });

  it("usunięcie pyta o potwierdzenie treścią z oryginału i dopiero wtedy woła DELETE", async () => {
    zamockujApi();
    await wejdzWRodzaj("kategoria");

    await userEvent.click(screen.getByTestId("button-usun-wartosc-5001"));
    const dialog = await screen.findByTestId("dialog-usun-wartosc");
    expect(dialog).toHaveTextContent('Usunąć wartość "Rolnicze" z rodzaju "kategoria"?');
    expect(zadania).toHaveLength(0);

    await userEvent.click(within(dialog).getByTestId("button-potwierdz"));
    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({ metoda: "DELETE", sciezka: "/api/atrybuty/wartosci/5001" });
  });

  it("szukajka zawęża listę i aktualizuje licznik „Wyświetlono”", async () => {
    zamockujApi();
    await wejdzWRodzaj("kategoria");

    await userEvent.type(screen.getByTestId("input-szukaj-wartosci"), "zim");

    await waitFor(() => expect(screen.getAllByTestId(/^wiersz-wartosc-/)).toHaveLength(1));
    expect(screen.getByTestId("text-licznik-wartosci")).toHaveTextContent("1");
  });

  it("NIE MA filtra „Źródło” — API nie zwraca `origin`, więc w produkcji jest martwy (D4)", async () => {
    zamockujApi();
    await wejdzWRodzaj("kategoria");

    expect(screen.queryByText("Wszystkie źródła")).not.toBeInTheDocument();
    expect(screen.queryByText("preset")).not.toBeInTheDocument();
  });
});

describe("3. Błędy spoza kontraktu (403/409/404) — komunikat serwera trafia do UI", () => {
  it("409 przy duplikacie wartości pokazuje treść z backendu", async () => {
    zamockujApi();
    server.use(
      http.post("*/api/atrybuty/wartosci", () =>
        HttpResponse.json(
          { ok: false, error: "Taka wartość już istnieje dla tego rodzaju" },
          { status: 409 },
        ),
      ),
    );
    await wejdzWRodzaj("kategoria");

    await userEvent.type(screen.getByTestId("input-nowa-wartosc"), "Rolnicze");
    await userEvent.click(screen.getByTestId("button-dodaj-wartosc"));

    expect(
      await screen.findByText("Błąd: Taka wartość już istnieje dla tego rodzaju"),
    ).toBeInTheDocument();
  });

  it("404 przy usuwaniu nieistniejącej wartości też dochodzi do użytkowniczki", async () => {
    zamockujApi();
    server.use(
      http.delete("*/api/atrybuty/wartosci/:id", () =>
        HttpResponse.json({ ok: false, error: "Nie znaleziono" }, { status: 404 }),
      ),
    );
    await wejdzWRodzaj("kategoria");

    await userEvent.click(screen.getByTestId("button-usun-wartosc-5001"));
    await userEvent.click(
      within(await screen.findByTestId("dialog-usun-wartosc")).getByTestId("button-potwierdz"),
    );

    expect(await screen.findByText("Błąd: Nie znaleziono")).toBeInTheDocument();
  });
});

describe("4. Modal „Produkty używające atrybutu”", () => {
  const produkt = (kod: string): ProduktUzycia => ({
    dostawca: "MO9",
    kod,
    nazwa: `Opona ${kod}`,
    marka: "BKT",
    rozmiar: "620/70R42",
    stan: 2,
  });

  it("pokazuje produkty i mówi wprost, że lista jest ucięta do 200 z N", async () => {
    zamockujApi();
    server.use(
      http.get("*/api/atrybuty/uzycie", () =>
        // `count` z osobnego COUNT(*) BEZ limitu, `products` ucięte do 200 — asymetria
        // odtworzona w 7a (`repos/atrybuty.ts:302-311`).
        HttpResponse.json({
          ok: true,
          count: 954,
          products: Array.from({ length: 200 }, (_, i) => produkt(`K${i}`)),
        }),
      ),
    );
    await wejdzWRodzaj("kategoria");

    await userEvent.click(screen.getByTestId("button-podglad-5001"));

    const licznik = await screen.findByTestId("text-liczba-produktow");
    expect(licznik).toHaveTextContent("Znaleziono 954 produkt(ów) (pokazano pierwsze 200)");
  });

  it("brak produktów daje komunikat, a nie pustą tabelę", async () => {
    zamockujApi();
    server.use(
      http.get("*/api/atrybuty/uzycie", () =>
        HttpResponse.json({ ok: true, count: 0, products: [] }),
      ),
    );
    await wejdzWRodzaj("kategoria");

    await userEvent.click(screen.getByTestId("button-podglad-5001"));

    expect(
      await screen.findByText("Żaden produkt w katalogu nie używa tej wartości atrybutu."),
    ).toBeInTheDocument();
  });

  it("wysyła OBA parametry — bez nich backend oddaje 400 (tak powstał fixture `_uzycie`)", async () => {
    zamockujApi();
    let zapytanie = "";
    server.use(
      http.get("*/api/atrybuty/uzycie", ({ request }) => {
        zapytanie = new URL(request.url).search;
        return HttpResponse.json({ ok: true, count: 1, products: [produkt("A1")] });
      }),
    );
    await wejdzWRodzaj("kategoria");

    await userEvent.click(screen.getByTestId("button-podglad-5001"));

    await waitFor(() => expect(zapytanie).toContain("rodzaj=kategoria"));
    expect(zapytanie).toContain("wartosc=Rolnicze");
  });
});

describe("5. Nagłówek i dodawanie rodzaju", () => {
  it("przycisk nosi napis „Dodaj wartość” — injection podmienia go w produkcji", async () => {
    zamockujApi();
    await otworzWidok();

    // Bazowy React mówi „Dodaj atrybut”, ale Ania widzi napis po podmianie (`:515-523`).
    expect(screen.getByTestId("button-add-attribute")).toHaveTextContent("Dodaj wartość");
  });

  it("„Nowy rodzaj” bez nazwy nie strzela do API", async () => {
    zamockujApi();
    await otworzWidok();

    await userEvent.click(screen.getByTestId("button-add-kind"));
    await userEvent.click(await screen.findByTestId("button-save-kind"));

    expect(await screen.findByText("Brak nazwy")).toBeInTheDocument();
    expect(zadania).toHaveLength(0);
  });

  it("„Nowy rodzaj” ZAPISUJE przez API — w oryginale ta ścieżka gubi dane po odświeżeniu", async () => {
    zamockujApi();
    await otworzWidok();

    await userEvent.click(screen.getByTestId("button-add-kind"));
    await userEvent.type(await screen.findByTestId("input-kind-label"), "Sezon");
    await userEvent.type(screen.getByTestId("input-kind-opis"), "Letnie, Zimowe");
    await userEvent.click(screen.getByTestId("button-save-kind"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({
      metoda: "POST",
      sciezka: "/api/atrybuty/rodzaje",
      cialo: { label: "Sezon", opis: "Letnie, Zimowe" },
    });
  });

  it("wpisanie NOWEGO rodzaju w „Dodaj wartość” zakłada go, a potem dodaje wartość", async () => {
    zamockujApi();
    await otworzWidok();

    await userEvent.click(screen.getByTestId("button-add-attribute"));
    const poleRodzaju = await screen.findByTestId("input-attr-kind");
    await userEvent.clear(poleRodzaju);
    await userEvent.type(poleRodzaju, "Sezon Zimowy");
    await userEvent.type(screen.getByTestId("input-attr-value"), "Lato");
    await userEvent.click(screen.getByTestId("button-save-attribute"));

    // Dwa żądania po kolei — 1:1 z `rg()` (`:27002-27008`), gdzie slug liczy front.
    await waitFor(() => expect(zadania).toHaveLength(2));
    expect(zadania[0]).toMatchObject({
      metoda: "POST",
      sciezka: "/api/atrybuty/rodzaje",
      cialo: { value: "sezon_zimowy", label: "Sezon Zimowy" },
    });
    expect(zadania[1]).toMatchObject({
      metoda: "POST",
      sciezka: "/api/atrybuty/wartosci",
      cialo: { rodzaj: "sezon_zimowy", wartosc: "Lato" },
    });
  });
});
