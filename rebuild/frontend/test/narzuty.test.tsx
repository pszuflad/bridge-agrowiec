/**
 * Widok `/narzuty` — sesja 4b.
 *
 * Dane narzutów z `contract/fixtures/GET_markups.json`, czyli z nagrania produkcji.
 * Promocje budujemy z `PROMOCJA_TESTOWA`, bo ich fixture jest PUSTĄ TABLICĄ — ograniczenie
 * nazwane w `test/msw/kontrakt.ts` i w plan.md.
 *
 * Zakres: że obie tabele renderują to, co przychodzi z API; że sort idzie po `id` malejąco;
 * że klik w status wysyła PATCH z odwróconą wartością; że **badge „zaplanowana" nie udaje
 * „zakończonej"** (odstępstwo — literówka oryginału naprawiona); oraz dwa odstępstwa dołożone
 * w 14f: **usuwanie PYTA o potwierdzenie i podaje liczbę dotkniętych produktów**, a **znacznik
 * rozbieżności statusu ZNIKNĄŁ** (statusy zamiata backend, więc rozjazd nie ma jak powstać).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { Narzut, Promocja } from "@/pages/narzuty/api";
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
/** Reguła z fixture'a: `typ: "globalny"`, `wartosc: 6`, `warunki: "[]"`, `status: "aktywny"`. */
const NARZUT = NARZUTY[0]!;

let patche: { sciezka: string; cialo: Record<string, unknown> }[] = [];
let skasowane: string[] = [];

function zamockujApi(promocje: Promocja[] = [], narzuty: Narzut[] = NARZUTY) {
  server.use(
    http.get("*/api/markups", () => HttpResponse.json(narzuty)),
    http.get("*/api/promotions", () => HttpResponse.json(promocje)),
    http.get("*/api/products", () => HttpResponse.json(PRODUKTY)),
    http.patch("*/api/markups/:id", async ({ request, params }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      patche.push({ sciezka: `markups/${String(params.id)}`, cialo });
      return HttpResponse.json({ ...narzuty[0], ...cialo });
    }),
    http.delete("*/api/markups/:id", ({ params }) => {
      skasowane.push(`markups/${String(params.id)}`);
      return HttpResponse.json({ ok: true });
    }),
    http.delete("*/api/promotions/:id", ({ params }) => {
      skasowane.push(`promotions/${String(params.id)}`);
      return HttpResponse.json({ ok: true });
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

beforeEach(() => {
  patche = [];
  skasowane = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  zasiejSesje();
});

describe("1. Układ strony", () => {
  it("otwiera się na zakładce „Narzuty\" i pokazuje obie zakładki", async () => {
    zamockujApi();
    await otworzNarzuty();

    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Narzuty i promocje");
    expect(screen.getByTestId("tab-narzuty")).toBeInTheDocument();
    expect(screen.getByTestId("tab-promocje")).toBeInTheDocument();
  });

  it("zakładka „Narzuty\" niesie także symulator ceny", async () => {
    zamockujApi();
    await otworzNarzuty();
    expect(screen.getByTestId("input-simulator-search")).toBeInTheDocument();
  });

  it("`/narzuty` nie jest już widokiem w przygotowaniu", async () => {
    zamockujApi();
    await otworzNarzuty();
    expect(screen.queryByText(/w przygotowaniu/i)).not.toBeInTheDocument();
  });
});

describe("2. Tabela narzutów", () => {
  it("pokazuje regułę z fixture'a: nazwę, narzut i status", async () => {
    zamockujApi();
    const wiersz = await otworzNarzuty();

    expect(within(wiersz).getByText(String(NARZUT.nazwa))).toBeInTheDocument();
    expect(within(wiersz).getByText(`+${NARZUT.wartosc}%`)).toBeInTheDocument();
    expect(within(wiersz).getByTestId(`toggle-status-${NARZUT.id}`)).toHaveTextContent("aktywny");
  });

  /** `warunki: "[]"` to pusta lista, więc reguła jest globalna — mimo niepustego napisu. */
  it("reguła z warunki:\"[]\" dostaje odznakę GLOBALNY", async () => {
    zamockujApi();
    const wiersz = await otworzNarzuty();
    expect(within(wiersz).getByText("GLOBALNY")).toBeInTheDocument();
  });

  it("warunki renderują się jako odznaki „typ: wartosc\"", async () => {
    const zWarunkami: Narzut = {
      ...NARZUT,
      id: 77,
      warunki: JSON.stringify([{ typ: "dostawca", wartosc: "MO5" }]),
    };
    zamockujApi([], [zWarunkami]);
    window.history.pushState({}, "", "/narzuty");
    render(<App />);

    const wiersz = await screen.findByTestId("row-markup-77");
    expect(within(wiersz).getByText("dostawca: MO5")).toBeInTheDocument();
    expect(within(wiersz).queryByText("GLOBALNY")).not.toBeInTheDocument();
  });

  it("sortuje po id MALEJĄCO", async () => {
    zamockujApi([], [
      { ...NARZUT, id: 1, nazwa: "Starsza" },
      { ...NARZUT, id: 2, nazwa: "Nowsza" },
    ]);
    window.history.pushState({}, "", "/narzuty");
    render(<App />);
    await screen.findByTestId("row-markup-2");

    const wiersze = screen.getAllByTestId(/^row-markup-/);
    expect(wiersze[0]).toHaveAttribute("data-testid", "row-markup-2");
    expect(wiersze[1]).toHaveAttribute("data-testid", "row-markup-1");
  });

  it("pusta lista pokazuje zachętę zamiast pustej tabeli", async () => {
    zamockujApi([], []);
    window.history.pushState({}, "", "/narzuty");
    render(<App />);
    expect(
      await screen.findByText("Brak reguł narzutów. Dodaj pierwszą regułę powyżej."),
    ).toBeInTheDocument();
  });

  it("klik w status wysyła PATCH z odwróconą wartością", async () => {
    zamockujApi();
    await otworzNarzuty();

    await userEvent.click(screen.getByTestId(`toggle-status-${NARZUT.id}`));

    await waitFor(() => expect(patche).toHaveLength(1));
    expect(patche[0]!.sciezka).toBe(`markups/${NARZUT.id}`);
    expect(patche[0]!.cialo).toEqual({ status: "nieaktywny" });
  });

  /**
   * ⚠ ODSTĘPSTWO ŚWIADOME (14f, zadanie 5; decyzja Ani §3.6 instrukcji I4). Oryginał kasuje
   * od razu — do 14f ten test pilnował dokładnie tego („usuwanie NIE pyta"). Od 14f pyta,
   * bo usunięcie reguły przelicza ceny całego katalogu i nie da się tego cofnąć.
   */
  it("⭐ usuwanie PYTA o potwierdzenie — sam klik jeszcze nie kasuje", async () => {
    zamockujApi();
    await otworzNarzuty();

    await userEvent.click(screen.getByTestId(`button-delete-markup-${NARZUT.id}`));

    expect(await screen.findByTestId("dialog-usun-narzut")).toBeInTheDocument();
    expect(skasowane).toEqual([]);
  });

  it("⭐ potwierdzenie podaje, ilu produktów dotyczy zmiana", async () => {
    zamockujApi();
    await otworzNarzuty();

    await userEvent.click(screen.getByTestId(`button-delete-markup-${NARZUT.id}`));

    // Reguła z fixture'a jest globalna (+6%) i jako jedyna wycenia cały katalog z fixture'a.
    const opis = await screen.findByTestId("liczba-produktow-narzutu");
    await waitFor(() =>
      expect(opis).toHaveTextContent(`Zmiana dotyczy ${PRODUKTY.length} produktów`),
    );
  });

  it("⭐ „Anuluj\" w potwierdzeniu NIE kasuje reguły", async () => {
    zamockujApi();
    await otworzNarzuty();

    await userEvent.click(screen.getByTestId(`button-delete-markup-${NARZUT.id}`));
    await screen.findByTestId("dialog-usun-narzut");
    await userEvent.click(screen.getByTestId("button-anuluj"));

    expect(skasowane).toEqual([]);
  });

  it("⭐ „Potwierdź\" kasuje regułę", async () => {
    zamockujApi();
    await otworzNarzuty();

    await userEvent.click(screen.getByTestId(`button-delete-markup-${NARZUT.id}`));
    await screen.findByTestId("dialog-usun-narzut");
    await userEvent.click(screen.getByTestId("button-potwierdz"));

    await waitFor(() => expect(skasowane).toEqual([`markups/${NARZUT.id}`]));
  });
});

describe("3. Tabela promocji", () => {
  async function otworzPromocje(promocje: Promocja[]) {
    zamockujApi(promocje);
    window.history.pushState({}, "", "/narzuty");
    render(<App />);
    await screen.findByTestId("tab-promocje");
    await userEvent.click(screen.getByTestId("tab-promocje"));
  }

  it("pusta lista pokazuje zachętę", async () => {
    await otworzPromocje([]);
    expect(
      await screen.findByText("Brak promocji. Dodaj pierwszą promocję powyżej."),
    ).toBeInTheDocument();
  });

  it("pokazuje rabat, daty i nazwę", async () => {
    await otworzPromocje([PROMOCJA_TESTOWA]);
    const wiersz = await screen.findByTestId(`row-promotion-${PROMOCJA_TESTOWA.id}`);

    expect(within(wiersz).getByText(PROMOCJA_TESTOWA.nazwa)).toBeInTheDocument();
    expect(within(wiersz).getByText(`−${PROMOCJA_TESTOWA.rabatPct}%`)).toBeInTheDocument();
  });

  /**
   * ⭐ NAPRAWIONA LITERÓWKA ORYGINAŁU (plan.md D5). `Qd()` produkuje `"zaplanowana"`,
   * a badge w produkcji porównuje z `"planowana"` (`:24825`) — więc promocja zaplanowana
   * wyświetlała się jako „zakończona". Ten test pilnuje, żeby poprawka nie zniknęła.
   */
  it("⭐ promocja z przyszłą datą startu pokazuje „zaplanowana\", nie „zakończona\"", async () => {
    const przyszla: Promocja = {
      ...PROMOCJA_TESTOWA,
      start: "2099-01-01T00:00:00.000Z",
      koniec: "2099-12-31T00:00:00.000Z",
      status: "zaplanowana",
    };
    await otworzPromocje([przyszla]);
    const wiersz = await screen.findByTestId(`row-promotion-${przyszla.id}`);

    expect(within(wiersz).getByText("zaplanowana")).toBeInTheDocument();
    expect(within(wiersz).queryByText("zakończona")).not.toBeInTheDocument();
  });

  /**
   * ⭐ ZNACZNIK ROZBIEŻNOŚCI ZNIKNĄŁ W 14f — i ten test pilnuje, że NIE WRÓCIŁ przypadkiem.
   *
   * Do 14f wiersz wygasłej promocji ze statusem „aktywna" dostawał pomarańczowe ostrzeżenie
   * „NADAL obniża ceny" (D5 z 4b), bo etykieta szła z dat, a ceny z kolumny `status`, której
   * nic nie przeliczało. Od 14f statusy zamiata backendowy wygaszacz tą samą regułą, z której
   * liczy się etykieta, więc taki rozjazd nie ma jak powstać — znacznik został usunięty
   * świadomie, jako martwy kod. Wiersz nadal się pokazuje, z odznaką „zakończona" z dat.
   */
  it("⭐ wygasła promocja NIE pokazuje już znacznika rozbieżności (usunięty w 14f)", async () => {
    const wygasla: Promocja = {
      ...PROMOCJA_TESTOWA,
      start: "2020-01-01T00:00:00.000Z",
      koniec: "2020-03-31T00:00:00.000Z",
      // Stan „sprzed wygaszacza" — celowo niespójny z datami. Widok ma go NIE komentować.
      status: "aktywna",
    };
    await otworzPromocje([wygasla]);
    const wiersz = await screen.findByTestId(`row-promotion-${wygasla.id}`);

    expect(screen.queryByTestId(`rozbieznosc-statusu-${wygasla.id}`)).not.toBeInTheDocument();
    expect(wiersz).not.toHaveTextContent(/NADAL obniża ceny/);
    // Etykieta dalej liczy się z dat (port `_b()`), więc odznaka mówi „zakończona".
    expect(within(wiersz).getByText("zakończona")).toBeInTheDocument();
  });

  it("promocja trwająca też nie ma żadnego znacznika", async () => {
    const teraz = Date.now();
    const trwajaca: Promocja = {
      ...PROMOCJA_TESTOWA,
      start: new Date(teraz - 86_400_000).toISOString(),
      koniec: new Date(teraz + 86_400_000).toISOString(),
      status: "aktywna",
    };
    await otworzPromocje([trwajaca]);
    await screen.findByTestId(`row-promotion-${trwajaca.id}`);

    expect(screen.queryByTestId(`rozbieznosc-statusu-${trwajaca.id}`)).not.toBeInTheDocument();
  });

  it("⭐ usuwanie promocji PYTA o potwierdzenie, z liczbą produktów", async () => {
    await otworzPromocje([PROMOCJA_TESTOWA]);
    await screen.findByTestId(`row-promotion-${PROMOCJA_TESTOWA.id}`);

    await userEvent.click(
      screen.getByTestId(`button-delete-promotion-${PROMOCJA_TESTOWA.id}`),
    );

    expect(await screen.findByTestId("dialog-usun-promocje")).toBeInTheDocument();
    expect(screen.getByTestId("liczba-produktow-promocji")).toBeInTheDocument();
    expect(skasowane).toEqual([]);

    await userEvent.click(screen.getByTestId("button-potwierdz"));
    await waitFor(() =>
      expect(skasowane).toEqual([`promotions/${PROMOCJA_TESTOWA.id}`]),
    );
  });

  /**
   * Nagłówek tabeli nie ma zdania o automatycznym statusie — oryginał go nie ma, a po 14f
   * informacja o rządzących datach siedzi w dialogu reguły, nie nad tabelą.
   */
  it("nagłówek nie twierdzi, że status zmienia się automatycznie", async () => {
    await otworzPromocje([]);
    expect(screen.queryByText(/Status zmienia się automatycznie wg dat/)).not.toBeInTheDocument();
  });
});

describe("4. Symulator ceny", () => {
  /**
   * Symulator tłumaczy, DLACZEGO produkt ma taką cenę. Fixture ma regułę globalną +6%,
   * a pierwszy produkt zakup 5562,4 zł przy VAT 23% ⇒ floor(5562,4 × 1,06 × 1,23) = 7252.
   * Ta sama liczba siedzi w `contract/fixtures/GET_products.json` jako `cenaSprzedazy` —
   * czyli symulator odtwarza to, co backend realnie policzył. Gdyby liczył jak `Mb()`
   * z oryginału (plan.md D8), rozjechałby się przy drugiej regule w tabeli.
   */
  it("⭐ rozbicie ceny zgadza się z cenaSprzedazy z fixture'a produktów", async () => {
    zamockujApi();
    await otworzNarzuty();

    const produkt = PRODUKTY[0]!;
    await userEvent.type(screen.getByTestId("input-simulator-search"), String(produkt.kod));
    await userEvent.click(await screen.findByTestId(`simulator-result-${produkt.id}`));

    const cena = await screen.findByTestId("symulator-cena");
    expect(cena).toHaveTextContent(`${Number(produkt.cenaSprzedazy).toFixed(2)} zł`);
  });

  it("pusta fraza nie pokazuje listy, a brak trafień mówi to wprost", async () => {
    zamockujApi();
    await otworzNarzuty();

    expect(screen.queryByText(/Brak wyników/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByTestId("input-simulator-search"), "nieistniejacafraza");
    expect(await screen.findByText(/Brak wyników dla/)).toBeInTheDocument();
  });

  it("„Zmień\" wraca do wyszukiwarki", async () => {
    zamockujApi();
    await otworzNarzuty();

    const produkt = PRODUKTY[0]!;
    await userEvent.type(screen.getByTestId("input-simulator-search"), String(produkt.kod));
    await userEvent.click(await screen.findByTestId(`simulator-result-${produkt.id}`));
    await userEvent.click(await screen.findByTestId("button-simulator-clear"));

    expect(await screen.findByTestId("input-simulator-search")).toBeInTheDocument();
  });
});
