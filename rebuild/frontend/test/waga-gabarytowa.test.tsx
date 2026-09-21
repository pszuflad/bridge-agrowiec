/**
 * Widok `/waga-gabarytowa` — Iteracja 9, po karcie P9.1 (ticket 76).
 *
 * Lista przewoźników przychodzi z serwera (`GET`/`PUT /api/waga-gabarytowa/przewoznicy`,
 * backlog #27), a kalkulator paletowy woła `POST /api/waga-gabarytowa/oblicz` (backlog #28).
 * Serwer udaje MSW z listą w pamięci — `PUT` ją podmienia, `GET` ją oddaje, więc test widzi
 * to samo, co drugi użytkownik po odświeżeniu. `onUnhandledRequest: "error"` (setup) pilnuje,
 * że widok nie woła niczego poza tymi trzema trasami.
 *
 * `magazynKV` jest podmieniony na słownik w pamięci: jsdom nie ma IndexedDB, a tu musimy
 * (a) podać zapamiętany wybór przewoźnika i (b) udowodnić, że stara lista z IndexedDB
 * (klucz `waga-gabarytowa-przewoznicy`) NIE jest już czytana.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { utworzQueryClient } from "@/lib/queryClient";
import { WagaGabarytowa } from "@/pages/WagaGabarytowa";
import { PRZEWOZNICY_DOMYSLNI, type Przewoznik } from "@/pages/waga-gabarytowa/przewoznicy";
import { server } from "./msw/server";

const magazyn = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/magazynKV", () => ({
  odczytajKV: (klucz: string) => Promise.resolve(magazyn.get(klucz)),
  zapiszKV: (klucz: string, wartosc: unknown) => {
    magazyn.set(klucz, wartosc);
    return Promise.resolve();
  },
}));

const SCIEZKA = "*/api/waga-gabarytowa/przewoznicy";

/** Seed serwera w kształcie odpowiedzi (`domyslny` zawsze obecny). */
const SEED: Przewoznik[] = PRZEWOZNICY_DOMYSLNI.map((p) => ({ domyslny: false, ...p }));

let listaNaSerwerze: Przewoznik[];
let zapisy: Przewoznik[][];
let obliczenia: unknown[];

beforeEach(() => {
  magazyn.clear();
  listaNaSerwerze = structuredClone(SEED);
  zapisy = [];
  obliczenia = [];
  server.use(
    http.get(SCIEZKA, () => HttpResponse.json(listaNaSerwerze)),
    http.put(SCIEZKA, async ({ request }) => {
      const lista = (await request.json()) as Przewoznik[];
      zapisy.push(lista);
      listaNaSerwerze = lista.map((p) => ({ domyslny: false, ...p }));
      return HttpResponse.json(listaNaSerwerze);
    }),
    http.post("*/api/waga-gabarytowa/oblicz", async ({ request }) => {
      obliczenia.push(await request.json());
      return HttpResponse.json({
        wagaGabarytowa: 33.4,
        szerokoscEfektywna: 80,
        wysokoscZPaleta: 25,
        wspolczynnik: 0.000167,
        opis: "Szerokość 70 cm > 55 cm, ≤ 80 cm (paleta) → zaokrąglone do 80 cm",
      });
    }),
  );
});

let klient = utworzQueryClient();

function pokaz() {
  klient = utworzQueryClient();
  return render(
    <QueryClientProvider client={klient}>
      <ToastProvider>
        <WagaGabarytowa />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Render + czekanie, aż lista wróci z serwera (tabela pojawia się dopiero z danymi). */
async function pokazZLista() {
  const widok = pokaz();
  await screen.findByTestId("button-edycja-przewoznikow");
  return widok;
}

/** Nadpisuje pole formularza — inputy są kontrolowane, więc czyścimy przed wpisaniem. */
async function wpisz(uzytkownik: ReturnType<typeof userEvent.setup>, testid: string, tekst: string) {
  const pole = screen.getByTestId(testid);
  await uzytkownik.clear(pole);
  await uzytkownik.type(pole, tekst);
}

describe("widok wagi gabarytowej — kalkulator wolumetryczny", () => {
  it("startuje z wymiarami 60/50/50 i pustym wynikiem", async () => {
    await pokazZLista();

    expect(screen.getByTestId("input-dlugosc")).toHaveValue(60);
    expect(screen.getByTestId("input-szerokosc")).toHaveValue(50);
    expect(screen.getByTestId("input-wysokosc")).toHaveValue(50);
    expect(screen.queryByTestId("text-wynik-waga")).not.toBeInTheDocument();
  });

  it("liczy wagę po kliknięciu i pokazuje rozbicie", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    // 60 × 50 × 50 / 10 000 (GEIS) = 15 kg
    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("15.00 kg");
    expect(screen.getByText("60 × 50 × 50 ÷ 10000")).toBeInTheDocument();
    expect(screen.getByText("0.1500 m³")).toBeInTheDocument();
  });

  it("zmiana przewoźnika przelicza wynik innym dzielnikiem", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.selectOptions(screen.getByTestId("select-przewoznik"), "gls");
    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("37.50 kg");
  });

  it("waga rzeczywista większa od gabarytowej wygrywa w wadze do wyceny", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await wpisz(uzytkownik, "input-waga-rzecz", "20");
    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByTestId("text-waga-do-wyceny")).toHaveTextContent("20.00 kg");
    expect(screen.getByText("Rzeczywista > gabarytowa → liczy się rzeczywista")).toBeInTheDocument();
  });

  it("bez wagi rzeczywistej nie pokazuje wagi do wyceny", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    await screen.findByTestId("text-wynik-waga");
    expect(screen.queryByTestId("text-waga-do-wyceny")).not.toBeInTheDocument();
  });

  it("niepoprawne wymiary dają komunikat zamiast wyniku", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await wpisz(uzytkownik, "input-dlugosc", "0");
    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByText("Niepoprawne wymiary")).toBeInTheDocument();
    expect(screen.queryByTestId("text-wynik-waga")).not.toBeInTheDocument();
  });
});

describe("widok wagi gabarytowej — wspólna lista przewoźników", () => {
  it("lista przychodzi z API, a stara lista z IndexedDB nie jest czytana", async () => {
    // Lokalna lista sprzed P9.1 — gdyby widok ją czytał, pokazałby „Stary lokalny".
    magazyn.set("waga-gabarytowa-przewoznicy", [
      { id: "stary", nazwa: "Stary lokalny", dzielnik: 1234 },
    ]);
    listaNaSerwerze = [
      { id: "geis", nazwa: "GEIS Polska", dzielnik: 10000, domyslny: true },
      { id: "custom_1", nazwa: "Pocztex", dzielnik: 3000, domyslny: false },
    ];

    await pokazZLista();

    expect(screen.getByText("Pocztex")).toBeInTheDocument();
    expect(screen.queryByText("Stary lokalny")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    // Klucz nie jest też nadpisywany — zostaje w przeglądarce nieruszony.
    expect(magazyn.get("waga-gabarytowa-przewoznicy")).toEqual([
      { id: "stary", nazwa: "Stary lokalny", dzielnik: 1234 },
    ]);
  });

  it("pokazuje sześciu przewoźników z serwera z przykładem dla paczki 60×50×50", async () => {
    await pokazZLista();

    expect(screen.getByText("GEIS Polska")).toBeInTheDocument();
    expect(screen.getByText("DHL Parcel")).toBeInTheDocument();
    // 150 000 / 4 000 = 37,50 kg — kolumna „Przykład" dla GLS.
    expect(screen.getByText("37.50 kg")).toBeInTheDocument();
    expect(screen.getByText(/Lista jest wspólna/)).toBeInTheDocument();
  });

  it("gdy odczyt się nie uda, pokazuje komunikat zamiast tabeli i blokuje liczenie", async () => {
    server.use(http.get(SCIEZKA, () => new HttpResponse("awaria", { status: 500 })));
    pokaz();

    expect(screen.getByTestId("text-stan-przewoznikow")).toHaveTextContent("Wczytywanie");
    await waitFor(() =>
      expect(screen.getByTestId("text-stan-przewoznikow")).toHaveTextContent(
        "Nie udało się wczytać listy przewoźników",
      ),
    );
    expect(screen.getByTestId("button-oblicz")).toBeDisabled();
  });

  it("pola edycji pojawiają się dopiero po wejściu w tryb edycji", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    expect(screen.queryByTestId("input-nazwa-geis")).not.toBeInTheDocument();
    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));

    expect(screen.getByTestId("input-nazwa-geis")).toBeInTheDocument();
    expect(screen.getByTestId("input-dzielnik-geis")).toBeInTheDocument();
    expect(screen.getByText("Gotowe")).toBeInTheDocument();
  });

  it("dodaje własnego przewoźnika na serwerze i pozwala nim liczyć", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.type(screen.getByTestId("input-nowy-nazwa"), "Pocztex");
    await uzytkownik.type(screen.getByTestId("input-nowy-dzielnik"), "3000");
    await uzytkownik.click(screen.getByTestId("button-dodaj-przewoznika"));

    await waitFor(() => expect(zapisy).toHaveLength(1));
    expect(zapisy[0]).toHaveLength(7);
    expect(zapisy[0]?.[6]).toMatchObject({ nazwa: "Pocztex", dzielnik: 3000 });
    expect(zapisy[0]?.[6]?.id).toMatch(/^custom_\d+$/);

    expect(await screen.findByDisplayValue("Pocztex")).toBeInTheDocument();
    expect(screen.getByText("50.00 kg")).toBeInTheDocument(); // kolumna „Przykład": 150 000 / 3 000
    expect(screen.getByTestId("input-nowy-nazwa")).toHaveValue("");

    await uzytkownik.selectOptions(
      screen.getByTestId("select-przewoznik"),
      screen.getByRole("option", { name: /Pocztex/ }),
    );
    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("50.00 kg");
  });

  it("odmawia dodania przewoźnika bez nazwy albo z niedodatnim dzielnikiem, bez zapisu", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.type(screen.getByTestId("input-nowy-dzielnik"), "3000");
    await uzytkownik.click(screen.getByTestId("button-dodaj-przewoznika"));

    expect(await screen.findByText("Brak danych")).toBeInTheDocument();
    expect(zapisy).toHaveLength(0);
  });

  it("zmiana dzielnika zapisuje się dopiero po opuszczeniu pola", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await wpisz(uzytkownik, "input-dzielnik-dpd", "5500");
    expect(zapisy).toHaveLength(0);

    await uzytkownik.tab();

    await waitFor(() => expect(zapisy).toHaveLength(1));
    expect(zapisy[0]?.find((p) => p.id === "dpd")?.dzielnik).toBe(5500);
    expect(listaNaSerwerze.find((p) => p.id === "dpd")?.dzielnik).toBe(5500);
  });

  /**
   * Dwie szybkie edycje z rzędu, zanim pierwszy zapis wróci z serwera (review, rundy 1 i 2).
   * Serwer podmienia całą listę i wygrywa ostatni zapis, więc:
   *  - drugi PUT rusza dopiero PO odpowiedzi na pierwszy — inaczej odpowiedzi w odwrotnej
   *    kolejności utrwaliłyby na serwerze starszą listę;
   *  - druga lista zawiera już pierwszą zmianę;
   *  - odpowiedź pierwszego zapisu (bez zmiany GLS) nie cofa na ekranie drugiej zmiany.
   * Każdy PUT jest wstrzymany osobno, a moment „drugi PUT ruszył" jest sygnałem, że odpowiedź
   * pierwszego została już w pełni obsłużona — bez czekania na zegar.
   */
  it("szybkie edycje z rzędu zapisują się po kolei i nie cofają się nawzajem", async () => {
    const zwolnienia: Array<() => void> = [];
    let wLocie = 0;
    let najwiecejNaRaz = 0;
    server.use(
      http.put(SCIEZKA, async ({ request }) => {
        wLocie += 1;
        najwiecejNaRaz = Math.max(najwiecejNaRaz, wLocie);
        const lista = (await request.json()) as Przewoznik[];
        zapisy.push(lista);
        await new Promise<void>((resolve) => zwolnienia.push(resolve));
        listaNaSerwerze = lista.map((p) => ({ domyslny: false, ...p }));
        wLocie -= 1;
        return HttpResponse.json(listaNaSerwerze);
      }),
    );
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await wpisz(uzytkownik, "input-dzielnik-dpd", "5500");
    await wpisz(uzytkownik, "input-dzielnik-gls", "4500"); // klik w GLS = blur DPD → pierwszy PUT
    await uzytkownik.tab(); // blur GLS → drugi zapis czeka w kolejce

    // Oba zapisy zlecone; puszczony jest tylko pierwszy.
    await waitFor(() => expect(klient.isMutating()).toBe(2));
    await waitFor(() => expect(zwolnienia).toHaveLength(1));
    expect(zapisy).toHaveLength(1);
    expect(screen.getByTestId("input-dzielnik-gls")).toHaveValue(4500);

    // Wraca pierwsza odpowiedź (bez zmiany GLS) — dopiero teraz rusza drugi PUT.
    zwolnienia[0]?.();
    await waitFor(() => expect(zwolnienia).toHaveLength(2));
    expect(screen.getByTestId("input-dzielnik-gls")).toHaveValue(4500);
    expect(screen.getByTestId("input-dzielnik-dpd")).toHaveValue(5500);

    const drugi = zapisy[1] ?? [];
    expect(drugi.find((p) => p.id === "dpd")?.dzielnik).toBe(5500);
    expect(drugi.find((p) => p.id === "gls")?.dzielnik).toBe(4500);

    zwolnienia[1]?.();
    await waitFor(() => expect(klient.isMutating()).toBe(0));
    expect(najwiecejNaRaz).toBe(1);
    expect(listaNaSerwerze.find((p) => p.id === "gls")?.dzielnik).toBe(4500);
    expect(listaNaSerwerze.find((p) => p.id === "dpd")?.dzielnik).toBe(5500);
    expect(screen.getByTestId("input-dzielnik-gls")).toHaveValue(4500);
  });

  it("zmiana nazwy zapisuje się po opuszczeniu pola", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await wpisz(uzytkownik, "input-nazwa-gls", "GLS Polska");
    await uzytkownik.tab();

    await waitFor(() => expect(zapisy).toHaveLength(1));
    expect(zapisy[0]?.find((p) => p.id === "gls")?.nazwa).toBe("GLS Polska");
  });

  it("pusta nazwa i zły dzielnik wracają do poprzedniej wartości bez zapisu", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.clear(screen.getByTestId("input-nazwa-dpd"));
    await uzytkownik.tab();
    expect(await screen.findByText("Brak nazwy")).toBeInTheDocument();
    expect(screen.getByTestId("input-nazwa-dpd")).toHaveValue("DPD");

    await wpisz(uzytkownik, "input-dzielnik-dpd", "0");
    await uzytkownik.tab();
    expect(await screen.findByText("Niepoprawny dzielnik")).toBeInTheDocument();
    expect(screen.getByTestId("input-dzielnik-dpd")).toHaveValue(6000);

    expect(zapisy).toHaveLength(0);
  });

  it("usunięcie pyta o potwierdzenie i dopiero po nim zapisuje", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.click(screen.getByTestId("button-usun-dhl"));

    const dialog = await screen.findByTestId("dialog-usun-przewoznika");
    expect(dialog).toHaveTextContent("„DHL Parcel\"");
    expect(dialog).toHaveTextContent("Lista jest wspólna");
    expect(zapisy).toHaveLength(0);
    expect(screen.getByTestId("button-usun-dhl")).toBeInTheDocument();

    await uzytkownik.click(within(dialog).getByTestId("button-potwierdz"));

    await waitFor(() =>
      expect(screen.queryByTestId("button-usun-dhl")).not.toBeInTheDocument(),
    );
    expect(zapisy).toHaveLength(1);
    expect(zapisy[0]?.map((p) => p.id)).toEqual(["geis", "dpd", "gls", "inpost", "ups"]);
    expect(screen.queryByRole("option", { name: /DHL Parcel/ })).not.toBeInTheDocument();
  });

  it("anulowanie usunięcia niczego nie zmienia", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.click(screen.getByTestId("button-usun-dhl"));
    await uzytkownik.click(
      within(await screen.findByTestId("dialog-usun-przewoznika")).getByTestId("button-anuluj"),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("dialog-usun-przewoznika")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("button-usun-dhl")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /DHL Parcel/ })).toBeInTheDocument();
    expect(zapisy).toHaveLength(0);
  });

  /**
   * Usunięcie AKTUALNIE WYBRANEGO przewoźnika przenosi wybór na pierwszego z pozostałych —
   * bez tego kalkulator zostałby bez dzielnika (`:26881-26885`).
   */
  it("usunięcie wybranego przewoźnika przenosi wybór na kolejnego", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.click(screen.getByTestId("button-usun-geis"));
    await uzytkownik.click(
      within(await screen.findByTestId("dialog-usun-przewoznika")).getByTestId("button-potwierdz"),
    );

    await waitFor(() => expect(screen.getByTestId("select-przewoznik")).toHaveValue("dpd"));

    await uzytkownik.click(screen.getByTestId("button-oblicz"));
    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("25.00 kg");
  });

  /** Ostatni przewoźnik musi zostać — inaczej nie ma czym dzielić. Blokada PRZED pytaniem. */
  it("nie pozwala usunąć ostatniego przewoźnika i nawet o to nie pyta", async () => {
    const uzytkownik = userEvent.setup();
    listaNaSerwerze = [{ id: "geis", nazwa: "GEIS Polska", dzielnik: 10000, domyslny: true }];
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.click(screen.getByTestId("button-usun-geis"));

    expect(await screen.findByText("Nie można usunąć")).toBeInTheDocument();
    expect(screen.queryByTestId("dialog-usun-przewoznika")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("GEIS Polska")).toBeInTheDocument();
    expect(screen.getByTestId("select-przewoznik")).toHaveValue("geis");
    expect(zapisy).toHaveLength(0);
  });

  it("„Przywróć domyślne” pyta, że zmienia listę całej firmie, i dopiero wtedy zapisuje", async () => {
    const uzytkownik = userEvent.setup();
    listaNaSerwerze = [
      { id: "dpd", nazwa: "DPD", dzielnik: 5500, domyslny: false },
      { id: "custom_1", nazwa: "Pocztex", dzielnik: 3000, domyslny: false },
    ];
    await pokazZLista();
    await uzytkownik.selectOptions(screen.getByTestId("select-przewoznik"), "custom_1");

    await uzytkownik.click(screen.getByTestId("button-przywroc-domyslne"));
    const dialog = await screen.findByTestId("dialog-przywroc-domyslne");
    expect(dialog).toHaveTextContent("dla całej firmy");
    expect(zapisy).toHaveLength(0);

    await uzytkownik.click(within(dialog).getByTestId("button-potwierdz"));

    expect(await screen.findByText("Przywrócono")).toBeInTheDocument();
    expect(zapisy).toEqual([PRZEWOZNICY_DOMYSLNI]);
    expect(screen.getByText("DHL Parcel")).toBeInTheDocument();
    expect(screen.getByTestId("select-przewoznik")).toHaveValue("geis");
  });

  it("anulowanie „Przywróć domyślne” niczego nie zmienia", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-przywroc-domyslne"));
    await uzytkownik.click(
      within(await screen.findByTestId("dialog-przywroc-domyslne")).getByTestId("button-anuluj"),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("dialog-przywroc-domyslne")).not.toBeInTheDocument(),
    );
    expect(zapisy).toHaveLength(0);
    expect(screen.queryByText("Przywrócono")).not.toBeInTheDocument();
  });

  it("wybrany przewoźnik usunięty przez kogoś innego → wybór przechodzi na pierwszego z listy", async () => {
    // Ta przeglądarka pamięta UPS, ale ktoś inny zdążył go usunąć z listy na serwerze.
    magazyn.set("waga-gabarytowa-wybrany", "ups");
    listaNaSerwerze = SEED.filter((p) => p.id !== "ups");
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await waitFor(() => expect(screen.getByTestId("select-przewoznik")).toHaveValue("geis"));
    await waitFor(() => expect(magazyn.get("waga-gabarytowa-wybrany")).toBe("geis"));

    await uzytkownik.click(screen.getByTestId("button-oblicz"));
    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("15.00 kg");
    expect(zapisy).toHaveLength(0);
  });

  it("zapamiętany wybór, który nadal jest na liście, zostaje", async () => {
    magazyn.set("waga-gabarytowa-wybrany", "gls");
    await pokazZLista();

    await waitFor(() => expect(screen.getByTestId("select-przewoznik")).toHaveValue("gls"));
  });

  it("błąd zapisu pokazuje komunikat i przywraca listę z serwera", async () => {
    server.use(http.put(SCIEZKA, () => HttpResponse.json({ error: "awaria" }, { status: 400 })));
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.click(screen.getByTestId("button-usun-dhl"));
    await uzytkownik.click(
      within(await screen.findByTestId("dialog-usun-przewoznika")).getByTestId("button-potwierdz"),
    );

    expect(await screen.findByText("Nie zapisano listy przewoźników")).toBeInTheDocument();
    expect(await screen.findByTestId("button-usun-dhl")).toBeInTheDocument();
  });
});

describe("widok wagi gabarytowej — kalkulator paletowy", () => {
  it("woła /oblicz z liczbami i pokazuje pełny wynik serwera", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    const karta = screen.getByTestId("card-kalkulator-paletowy");
    expect(karta).toHaveTextContent("inny wzór");
    await wpisz(uzytkownik, "input-paleta-szerokosc", "70");
    await wpisz(uzytkownik, "input-paleta-dlugosc", "100");
    await wpisz(uzytkownik, "input-paleta-wysokosc", "15");
    await uzytkownik.click(screen.getByTestId("button-oblicz-paletowo"));

    expect(await screen.findByTestId("text-wynik-paletowy")).toHaveTextContent("33.4 kg");
    expect(obliczenia).toEqual([{ szerokosc: 70, dlugosc: 100, wysokosc: 15 }]);
    expect(screen.getByTestId("text-paleta-szerokosc")).toHaveTextContent("80 cm");
    expect(screen.getByTestId("text-paleta-wysokosc")).toHaveTextContent("25 cm");
    expect(screen.getByText("0.000167")).toBeInTheDocument();
    expect(screen.getByTestId("text-paleta-opis")).toHaveTextContent(
      "Szerokość 70 cm > 55 cm, ≤ 80 cm (paleta) → zaokrąglone do 80 cm",
    );
    // Wynik wolumetryczny nie jest ruszany — to osobny kalkulator.
    expect(screen.queryByTestId("text-wynik-waga")).not.toBeInTheDocument();
  });

  it("puste pole albo liczba ujemna dają komunikat bez wołania serwera", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await wpisz(uzytkownik, "input-paleta-szerokosc", "70");
    await wpisz(uzytkownik, "input-paleta-dlugosc", "-1");
    await wpisz(uzytkownik, "input-paleta-wysokosc", "15");
    await uzytkownik.click(screen.getByTestId("button-oblicz-paletowo"));
    expect(await screen.findByText("Niepoprawne wymiary")).toBeInTheDocument();

    await uzytkownik.clear(screen.getByTestId("input-paleta-dlugosc"));
    await uzytkownik.click(screen.getByTestId("button-oblicz-paletowo"));

    expect(obliczenia).toHaveLength(0);
    expect(screen.queryByTestId("text-wynik-paletowy")).not.toBeInTheDocument();
  });

  it("zero jest poprawnym wymiarem — serwer policzy go jak oryginał", async () => {
    const uzytkownik = userEvent.setup();
    await pokazZLista();

    await wpisz(uzytkownik, "input-paleta-szerokosc", "0");
    await wpisz(uzytkownik, "input-paleta-dlugosc", "0");
    await wpisz(uzytkownik, "input-paleta-wysokosc", "0");
    await uzytkownik.click(screen.getByTestId("button-oblicz-paletowo"));

    await waitFor(() => expect(obliczenia).toEqual([{ szerokosc: 0, dlugosc: 0, wysokosc: 0 }]));
  });
});
