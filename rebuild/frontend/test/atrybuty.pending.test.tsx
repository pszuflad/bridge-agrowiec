/**
 * Widok `/atrybuty` — kolejka „Do akceptacji” (sesja 7b).
 *
 * NAJWAŻNIEJSZE, CZEGO TEN PLIK PILNUJE: że TRZY WARIANTY AKCEPTACJI trafiają pod WŁAŚCIWE
 * adresy i z właściwym ciałem. Różnią się one SKUTKAMI, nie kształtem odpowiedzi, więc pomyłka
 * jest niewidoczna w UI: `akceptuj` dopisuje wartość do słownika i nie rusza produktów,
 * `akceptuj-z-edycja` robi masowy `UPDATE products` ORAZ dopisuje do słownika, a
 * `akceptuj-jako-alias` przepisuje produkty i do słownika NIE dokłada nic (nie ma tabeli
 * aliasów — mapowanie nigdzie nie zostaje). Podmiana jednego na drugi po cichu przepisałaby
 * cały katalog albo nie zrobiła tego, czego oczekiwała użytkowniczka.
 *
 * Drugi cel: że „Wyczyść pending” mówi wprost, iż to SCHOWANIE, a nie odrzucenie — wartości
 * wracają przy kolejnym skanie.
 *
 * Dane z `contract/fixtures/GET_atrybuty_pending.json` (5 z 498 nagranych pozycji).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { PozycjaPending } from "@/pages/atrybuty/api";
import {
  TOKEN_TESTOWY,
  pendingZFixtura,
  slownikZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const KOLEJKA = pendingZFixtura();
const SLOWNIK = slownikZFixtura();

/** Pierwsza nagrana pozycja: `bieznik` / „AGRI STAR II”, 186 wystąpień, dwie sugestie. */
const PIERWSZA = KOLEJKA.items[0]!;

let zadania: { metoda: string; sciezka: string; cialo: unknown }[] = [];

function zamockujApi(items: PozycjaPending[] = KOLEJKA.items) {
  server.use(
    http.get("*/api/atrybuty", () => HttpResponse.json(SLOWNIK)),
    http.get("*/api/atrybuty/pending", () =>
      HttpResponse.json({ ok: true, count: items.length, items }),
    ),
    http.get("*/api/atrybuty/uzycie", () =>
      HttpResponse.json({ ok: true, count: 186, products: [] }),
    ),
    http.post("*/api/atrybuty/pending/:id/:akcja", async ({ request, params }) => {
      const cialo = request.body ? await request.json() : null;
      zadania.push({
        metoda: "POST",
        sciezka: `/api/atrybuty/pending/${String(params.id)}/${String(params.akcja)}`,
        cialo,
      });
      return HttpResponse.json({
        ok: true,
        akcja: String(params.akcja),
        z: PIERWSZA.wartosc,
        na: "X",
        produktow_zaktualizowano: 186,
      });
    }),
    http.delete("*/api/atrybuty/pending", ({ request }) => {
      const rodzaj = new URL(request.url).searchParams.get("rodzaj");
      zadania.push({ metoda: "DELETE", sciezka: "/api/atrybuty/pending", cialo: { rodzaj } });
      return HttpResponse.json({ ok: true, usunieto: 7, rodzaj });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

/** Wchodzi na `/atrybuty` i przełącza się na panel kolejki przyciskiem z badge'em. */
async function otworzKolejke() {
  window.history.pushState({}, "", "/atrybuty");
  render(<App />);
  await userEvent.click(await screen.findByTestId("button-do-akceptacji"));
  return await screen.findByTestId("select-filtr-pending");
}

beforeEach(() => {
  zadania = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("1. Lista kolejki", () => {
  it("badge przy przycisku pokazuje liczbę pozycji", async () => {
    zamockujApi();
    window.history.pushState({}, "", "/atrybuty");
    render(<App />);

    const przycisk = await screen.findByTestId("button-do-akceptacji");
    await waitFor(() => expect(przycisk).toHaveTextContent(String(KOLEJKA.items.length)));
  });

  it("renderuje WSZYSTKIE pozycje naraz — bez paginacji, jak oryginał (plan.md D6)", async () => {
    zamockujApi();
    await otworzKolejke();

    expect(screen.getAllByTestId(/^wiersz-pending-/)).toHaveLength(KOLEJKA.items.length);
    expect(screen.getByTestId("text-licznik-pending")).toHaveTextContent(
      `Wyświetlono: ${KOLEJKA.items.length} z ${KOLEJKA.items.length}`,
    );
  });

  it("sugerowane aliasy pokazują wartość i procent podobieństwa", async () => {
    zamockujApi();
    await otworzKolejke();

    const wiersz = screen.getByTestId(`wiersz-pending-${PIERWSZA.id}`);
    for (const sugestia of PIERWSZA.sugerowane_aliasy) {
      expect(wiersz).toHaveTextContent(`${sugestia.wartosc} (${sugestia.podobienstwo}%)`);
    }
    // ⚠ Fixture ma self-match „AGRI STAR II” z podobieństwem 100 — skutek seedu słownika
    // `bieznik` z `products.model` (backlog #40, ⬜ do decyzji). Pokazujemy jak jest.
    expect(PIERWSZA.sugerowane_aliasy[0]?.podobienstwo).toBe(100);
  });

  it("pozycja bez sugestii mówi „brak podobnych”", async () => {
    zamockujApi([{ ...PIERWSZA, id: 777, sugerowane_aliasy: [] }]);
    await otworzKolejke();

    expect(screen.getByTestId("wiersz-pending-777")).toHaveTextContent("brak podobnych");
  });

  it("filtr rodzaju i szukajka zawężają listę", async () => {
    const items: PozycjaPending[] = [
      { ...PIERWSZA, id: 1, rodzaj: "marka", wartosc: "Alliance" },
      { ...PIERWSZA, id: 2, rodzaj: "marka", wartosc: "Michelin" },
      { ...PIERWSZA, id: 3, rodzaj: "bieznik", wartosc: "AGRO" },
    ];
    zamockujApi(items);
    const filtr = await otworzKolejke();

    await userEvent.selectOptions(filtr, "marka");
    expect(screen.getAllByTestId(/^wiersz-pending-/)).toHaveLength(2);
    expect(screen.getByTestId("text-licznik-pending")).toHaveTextContent("Wyświetlono: 2 z 3");

    await userEvent.type(screen.getByTestId("input-szukaj-pending"), "mich");
    await waitFor(() => expect(screen.getAllByTestId(/^wiersz-pending-/)).toHaveLength(1));
  });

  it("pusta kolejka mówi „Brak wartości do akceptacji”", async () => {
    zamockujApi([]);
    await otworzKolejke();

    expect(screen.getByTestId("text-pusta-kolejka")).toBeInTheDocument();
  });
});

describe("2. Trzy warianty akceptacji — adres i ciało", () => {
  it("„Akceptuj” idzie BEZ ciała — wartość ląduje w słowniku, produkty nietknięte", async () => {
    zamockujApi();
    await otworzKolejke();

    await userEvent.click(screen.getByTestId(`button-akceptuj-${PIERWSZA.id}`));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]!.sciezka).toBe(`/api/atrybuty/pending/${PIERWSZA.id}/akceptuj`);
    expect(zadania[0]!.cialo).toBeNull();
  });

  it("„Edytuj” wysyła {nowa_wartosc} na akceptuj-z-edycja", async () => {
    zamockujApi();
    await otworzKolejke();

    await userEvent.click(screen.getByTestId(`button-edytuj-pending-${PIERWSZA.id}`));
    const pole = await screen.findByTestId("input-dialog-tekstu");
    await userEvent.clear(pole);
    await userEvent.type(pole, "AGRISTAR II");
    await userEvent.click(screen.getByTestId("button-zapisz"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({
      sciezka: `/api/atrybuty/pending/${PIERWSZA.id}/akceptuj-z-edycja`,
      cialo: { nowa_wartosc: "AGRISTAR II" },
    });
  });

  it("chip aliasu wysyła {kanoniczna_wartosc} na akceptuj-jako-alias", async () => {
    zamockujApi();
    await otworzKolejke();

    const sugestia = PIERWSZA.sugerowane_aliasy[1] ?? PIERWSZA.sugerowane_aliasy[0]!;
    await userEvent.click(
      screen.getByTestId(`chip-alias-${PIERWSZA.id}-${sugestia.wartosc}`),
    );

    const dialog = await screen.findByTestId("dialog-akceptuj-alias");
    expect(dialog).toHaveTextContent(
      `Zmapować "${PIERWSZA.wartosc}" jako alias dla "${sugestia.wartosc}"?`,
    );
    await userEvent.click(within(dialog).getByTestId("button-potwierdz"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({
      sciezka: `/api/atrybuty/pending/${PIERWSZA.id}/akceptuj-jako-alias`,
      cialo: { kanoniczna_wartosc: sugestia.wartosc },
    });
  });

  it("„Odrzuć” wysyła {powod}, a powód MOŻE być pusty (oryginał: `prompt(...) || \"\"`)", async () => {
    zamockujApi();
    await otworzKolejke();

    await userEvent.click(screen.getByTestId(`button-odrzuc-${PIERWSZA.id}`));
    await screen.findByTestId("input-dialog-tekstu");
    await userEvent.click(screen.getByTestId("button-zapisz"));

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({
      sciezka: `/api/atrybuty/pending/${PIERWSZA.id}/odrzuc`,
      cialo: { powod: "" },
    });
  });
});

describe("3. Ostrzeżenie przed masowym UPDATE (plan.md D7)", () => {
  it("dialog edycji mówi, ilu produktów dotknie zmiana i że nie ma jej w audycie", async () => {
    zamockujApi();
    await otworzKolejke();

    await userEvent.click(screen.getByTestId(`button-edytuj-pending-${PIERWSZA.id}`));

    const ostrzezenie = await screen.findByTestId("ostrzezenie-skala-zmiany");
    await waitFor(() => expect(ostrzezenie).toHaveTextContent("186"));
    expect(ostrzezenie).toHaveTextContent("nie trafiają do audytu");
  });

  it("dialog aliasu ostrzega dodatkowo, że do słownika nie wchodzi nic", async () => {
    zamockujApi();
    await otworzKolejke();

    const sugestia = PIERWSZA.sugerowane_aliasy[0]!;
    await userEvent.click(screen.getByTestId(`chip-alias-${PIERWSZA.id}-${sugestia.wartosc}`));

    const dialog = await screen.findByTestId("dialog-akceptuj-alias");
    expect(dialog).toHaveTextContent("mapowanie nie jest nigdzie zapisywane");
  });

  it("toast po akcji masowej podaje liczbę przepisanych produktów", async () => {
    zamockujApi();
    await otworzKolejke();

    await userEvent.click(screen.getByTestId(`button-edytuj-pending-${PIERWSZA.id}`));
    const pole = await screen.findByTestId("input-dialog-tekstu");
    await userEvent.clear(pole);
    await userEvent.type(pole, "AGRISTAR II");
    await userEvent.click(screen.getByTestId("button-zapisz"));

    expect(await screen.findByText("Zaktualizowano produktów: 186")).toBeInTheDocument();
  });
});

describe("4. Czyszczenie kolejki — „schowaj”, nie „odrzuć”", () => {
  it("potwierdzenie mówi WPROST, że wartości wrócą przy kolejnym imporcie", async () => {
    zamockujApi();
    await otworzKolejke();

    await userEvent.click(screen.getByTestId("button-wyczysc-wszystkie"));

    const dialog = await screen.findByTestId("dialog-wyczysc-pending");
    expect(dialog).toHaveTextContent(
      `Wyczyścić WSZYSTKIE ${KOLEJKA.items.length} pozycji z listy pending?`,
    );
    expect(dialog).toHaveTextContent("to nie jest trwałe odrzucenie");
    expect(dialog).toHaveTextContent("wrócą tutaj do ponownej akceptacji");
    // Nic nie poszło do API, dopóki nie potwierdzono.
    expect(zadania).toHaveLength(0);
  });

  it("„Wyczyść wszystkie” woła DELETE bez parametru rodzaju", async () => {
    zamockujApi();
    await otworzKolejke();

    await userEvent.click(screen.getByTestId("button-wyczysc-wszystkie"));
    await userEvent.click(
      within(await screen.findByTestId("dialog-wyczysc-pending")).getByTestId("button-potwierdz"),
    );

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({
      metoda: "DELETE",
      sciezka: "/api/atrybuty/pending",
      cialo: { rodzaj: null },
    });
  });

  it("„Wyczyść pending: <rodzaj>” jest ZABLOKOWANY, dopóki nie wybrano rodzaju", async () => {
    zamockujApi();
    await otworzKolejke();

    const przycisk = screen.getByTestId("button-wyczysc-rodzaj");
    expect(przycisk).toBeDisabled();
    expect(przycisk).toHaveTextContent("Wyczyść pending: —");
  });

  it("po wybraniu rodzaju czyszczenie zawęża się parametrem ?rodzaj=", async () => {
    zamockujApi();
    const filtr = await otworzKolejke();

    await userEvent.selectOptions(filtr, PIERWSZA.rodzaj);
    await userEvent.click(screen.getByTestId("button-wyczysc-rodzaj"));
    await userEvent.click(
      within(await screen.findByTestId("dialog-wyczysc-pending")).getByTestId("button-potwierdz"),
    );

    await waitFor(() => expect(zadania).toHaveLength(1));
    expect(zadania[0]).toMatchObject({
      metoda: "DELETE",
      cialo: { rodzaj: PIERWSZA.rodzaj },
    });
  });
});

describe("5. Błędy akcji", () => {
  it("400 „kanoniczna nie istnieje w katalogu” dochodzi do użytkowniczki", async () => {
    zamockujApi();
    server.use(
      http.post("*/api/atrybuty/pending/:id/akceptuj-jako-alias", () =>
        HttpResponse.json(
          { ok: false, error: 'Kanoniczna "AGRISTAR II" nie istnieje w katalogu bieznik' },
          { status: 400 },
        ),
      ),
    );
    await otworzKolejke();

    const sugestia = PIERWSZA.sugerowane_aliasy[0]!;
    await userEvent.click(screen.getByTestId(`chip-alias-${PIERWSZA.id}-${sugestia.wartosc}`));
    await userEvent.click(
      within(await screen.findByTestId("dialog-akceptuj-alias")).getByTestId("button-potwierdz"),
    );

    expect(
      await screen.findByText(
        'Błąd: Kanoniczna "AGRISTAR II" nie istnieje w katalogu bieznik',
      ),
    ).toBeInTheDocument();
  });

  it("404 na akceptacji znikniętej pozycji nie wywraca widoku", async () => {
    zamockujApi();
    server.use(
      http.post("*/api/atrybuty/pending/:id/akceptuj", () =>
        HttpResponse.json({ ok: false, error: "Pozycja pending nie istnieje" }, { status: 404 }),
      ),
    );
    await otworzKolejke();

    await userEvent.click(screen.getByTestId(`button-akceptuj-${PIERWSZA.id}`));

    expect(await screen.findByText("Błąd: Pozycja pending nie istnieje")).toBeInTheDocument();
    expect(screen.getByTestId(`wiersz-pending-${PIERWSZA.id}`)).toBeInTheDocument();
  });
});
