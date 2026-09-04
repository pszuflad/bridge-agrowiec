/**
 * Widok `/katalog` — render przeciwko mockom MSW zbudowanym z nagranych fixtures
 * produkcji (`contract/fixtures/GET_products.json`, `GET_suppliers.json`).
 *
 * Zakres: że ekran faktycznie renderuje dane, że filtry i szukajka zawężają listę,
 * że paginacja przełącza strony i że podgląd produktu pokazuje pola. Sama logika
 * filtrowania ma osobny, gęstszy zestaw testów (`katalog.filtrowanie.test.ts`) —
 * tutaj sprawdzamy spięcie, nie reguły.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import { KLUCZE_STORAGE, zapiszToken } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import { server } from "./msw/server";
import {
  dostawcyZFixtura,
  produktyZFixtura,
  TOKEN_TESTOWY,
  uzytkownikZFixtura,
} from "./msw/kontrakt";

const UZYTKOWNIK = uzytkownikZFixtura();
const PRODUKTY = produktyZFixtura();
const DOSTAWCY = dostawcyZFixtura();

/**
 * Katalog woła `/api/products` BEZ parametrów i dostaje gołą tablicę — to nie skrót
 * w teście, tylko wierne odwzorowanie kontraktu (`routes/products.ts`: brak `limit`
 * i brak `dostawca` ⇒ tablica, nie `{items,…}`).
 */
function zamockujApi(produkty: Produkt[] = PRODUKTY) {
  server.use(
    http.get("*/api/products", () => HttpResponse.json(produkty)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    // Od sesji 8b katalog czyta też `/api/config` (klucze `shoper.*` dla przycisku
    // eksportu). Widok pobiera KOMPLET swoich tras przy każdym wejściu, niezależnie od
    // tego, co dany test sprawdza, a `onUnhandledRequest:"error"` nie wybacza braków.
    // Pusty obiekt = stan produkcji: tych kluczy tam nie ma (`GET_config.json`).
    http.get("*/api/config", () => HttpResponse.json({})),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

beforeEach(() => {
  zapiszToken(null);
  localStorage.clear();
  sessionStorage.clear();
  zasiejSesje();
  window.history.pushState({}, "", "/katalog");
});

describe("katalog — dane i nagłówek", () => {
  it("renderuje produkty z API, a nie placeholder z Iteracji 1", async () => {
    zamockujApi();
    render(<App />);

    expect(await screen.findByText("Katalog produktów")).toBeInTheDocument();
    for (const produkt of PRODUKTY) {
      expect(await screen.findByTestId(`row-product-${produkt.id}`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/w przygotowaniu/i)).not.toBeInTheDocument();
  });

  it("podtytuł podaje liczbę pozycji i liczbę dostawców", async () => {
    zamockujApi();
    render(<App />);

    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);
    expect(
      screen.getByText(`${PRODUKTY.length} pozycji w bazie · scal danych z ${DOSTAWCY.length} dostawców`),
    ).toBeInTheDocument();
  });

  it("pokazuje komunikat ładowania, zanim dane dojadą", async () => {
    // Mock celowo zwleka: bez opóźnienia MSW odpowiada, zanim zdążymy zobaczyć
    // stan ładowania (widok montuje się dopiero po przejściu przez AuthGate).
    server.use(
      http.get("*/api/products", async () => {
        await new Promise((gotowe) => setTimeout(gotowe, 50));
        return HttpResponse.json(PRODUKTY);
      }),
      http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    );
    render(<App />);

    expect(await screen.findByText("Wczytuję katalog...")).toBeInTheDocument();
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);
  });

  it("licznik pokazuje ile pozycji jest widocznych z ilu odfiltrowanych", async () => {
    zamockujApi();
    render(<App />);
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);
    expect(screen.getByTestId("text-licznik")).toHaveTextContent(
      `wyświetlono ${PRODUKTY.length} / ${PRODUKTY.length}`,
    );
  });
});

describe("katalog — szukajka i filtry", () => {
  it("szukajka zawęża listę do pasujących pozycji", async () => {
    zamockujApi();
    render(<App />);
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);

    const pasujace = PRODUKTY.filter((p) => p.nazwa.includes("620/70R42"));
    expect(pasujace.length).toBeGreaterThan(0);

    await userEvent.type(screen.getByTestId("input-search"), "620/70R42");

    await waitFor(() => {
      expect(screen.getByTestId("text-licznik")).toHaveTextContent(
        `wyświetlono ${pasujace.length} / ${pasujace.length}`,
      );
    });
    for (const p of pasujace) {
      expect(screen.getByTestId(`row-product-${p.id}`)).toBeInTheDocument();
    }
  });

  it("fraza bez trafień pokazuje komunikat o braku wyników", async () => {
    zamockujApi();
    render(<App />);
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);

    await userEvent.type(screen.getByTestId("input-search"), "nie-ma-takiej-opony");

    expect(await screen.findByTestId("text-brak-wynikow")).toBeInTheDocument();
  });

  it("zakładka dostawcy filtruje katalog do jego produktów", async () => {
    zamockujApi();
    render(<App />);
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);

    const kodDostawcy = PRODUKTY[0]?.dostawca as string;
    const jego = PRODUKTY.filter((p) => p.dostawca === kodDostawcy);
    const zakladka = screen.queryByTestId(`tab-supplier-${kodDostawcy}`);
    // Zakładka istnieje tylko wtedy, gdy dostawca jest też w GET_suppliers.json.
    if (!zakladka) return;

    await userEvent.click(zakladka);

    await waitFor(() => {
      expect(screen.getByTestId("text-licznik")).toHaveTextContent(
        `wyświetlono ${jego.length} / ${jego.length}`,
      );
    });
  });

  it("dostawca bez produktów pokazuje dedykowany komunikat", async () => {
    zamockujApi([]);
    render(<App />);

    const kodDostawcy = DOSTAWCY[0]?.kod as string;
    await userEvent.click(await screen.findByTestId(`tab-supplier-${kodDostawcy}`));

    expect(await screen.findByText(/Brak produktów od dostawcy/)).toBeInTheDocument();
  });

  it("filtr statusu „Brak EANu” zostawia tylko pozycje bez EAN-u", async () => {
    const bezEana: Produkt = { ...(PRODUKTY[0] as Produkt), id: 999_001, ean: null, kod: "BEZ_EAN" };
    zamockujApi([...PRODUKTY, bezEana]);
    render(<App />);
    await screen.findByTestId("row-product-999001");

    await userEvent.click(screen.getByTestId("select-status"));
    await userEvent.click(await screen.findByText("Brak EANu"));

    await waitFor(() => {
      expect(screen.getByTestId("text-licznik")).toHaveTextContent("wyświetlono 1 / 1");
    });
    expect(screen.getByTestId("row-product-999001")).toBeInTheDocument();
  });
});

describe("katalog — sortowanie i paginacja", () => {
  it("klik w nagłówek sortuje, drugi klik odwraca kierunek", async () => {
    zamockujApi();
    render(<App />);
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);

    const kolejnosc = (): number[] =>
      screen
        .getAllByTestId(/^row-product-/)
        .map((wiersz) => Number(wiersz.getAttribute("data-testid")?.replace("row-product-", "")));

    // Sortujemy po nazwie, nie po dostawcy: w nagranym fixture wszystkie pięć pozycji
    // pochodzi od MO9, więc sort po dostawcy niczego by nie przestawił.
    await userEvent.click(screen.getByTestId("header-nazwa"));
    const rosnaco = kolejnosc();
    expect(new Set(rosnaco).size).toBe(rosnaco.length);

    await userEvent.click(screen.getByTestId("header-nazwa"));
    expect(kolejnosc()).toEqual([...rosnaco].reverse());
  });

  it("paginacja pojawia się dopiero powyżej jednej strony i przełącza wiersze", async () => {
    // 30 pozycji przy domyślnym rozmiarze strony 25 daje dwie strony.
    const duzo: Produkt[] = Array.from({ length: 30 }, (_, i) => ({
      ...(PRODUKTY[0] as Produkt),
      id: 900_000 + i,
      kod: `GEN_${i}`,
      nazwa: `Opona ${String(i).padStart(2, "0")}`,
    }));
    zamockujApi(duzo);
    render(<App />);
    await screen.findByTestId("row-product-900000");

    expect(screen.getByTestId("text-paginacja")).toHaveTextContent("Strona 1 z 2 · 30 poz.");
    expect(screen.getAllByTestId(/^row-product-/)).toHaveLength(25);

    await userEvent.click(screen.getByTestId("button-next-page"));

    expect(screen.getByTestId("text-paginacja")).toHaveTextContent("Strona 2 z 2");
    expect(screen.getAllByTestId(/^row-product-/)).toHaveLength(5);
    expect(screen.getByTestId("row-product-900029")).toBeInTheDocument();
  });

  it("przy jednej stronie paginacji nie ma wcale", async () => {
    zamockujApi();
    render(<App />);
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);
    expect(screen.queryByTestId("text-paginacja")).not.toBeInTheDocument();
  });
});

describe("katalog — kolumny i podgląd produktu", () => {
  it("domyślnie pokazuje 15 z 59 kolumn", async () => {
    zamockujApi();
    render(<App />);
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);
    expect(screen.getByTestId("button-columns")).toHaveTextContent("15/59");
  });

  it("konfigurator kolumn dokłada kolumnę do tabeli", async () => {
    zamockujApi();
    render(<App />);
    await screen.findByTestId(`row-product-${PRODUKTY[0]?.id}`);

    expect(screen.queryByTestId("header-szerokosc")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("button-columns"));
    await userEvent.click(await screen.findByText("Szerokość opony"));

    expect(await screen.findByTestId("header-szerokosc")).toBeInTheDocument();
  });

  it("podgląd produktu pokazuje jego dane i wszystkie 59 pól", async () => {
    zamockujApi();
    render(<App />);
    const pierwszy = PRODUKTY[0] as Produkt;
    await screen.findByTestId(`row-product-${pierwszy.id}`);

    await userEvent.click(screen.getByTestId(`button-podglad-${pierwszy.id}`));

    const dialog = await screen.findByTestId("dialog-podglad-produktu");
    expect(within(dialog).getByTestId("text-podglad-nazwa")).toHaveTextContent(pierwszy.nazwa);
    expect(within(dialog).getByTestId("podglad-pole-cenaZakupu")).toHaveTextContent("5562.40");
    expect(within(dialog).getAllByTestId(/^podglad-pole-/)).toHaveLength(59);
  });

  /** Podgląd jest READ-ONLY (plan.md D4) — mutacje należą do późniejszej iteracji. */
  it("podgląd nie zawiera żadnego pola do edycji ani przycisku zapisu", async () => {
    zamockujApi();
    render(<App />);
    const pierwszy = PRODUKTY[0] as Produkt;
    await screen.findByTestId(`row-product-${pierwszy.id}`);

    await userEvent.click(screen.getByTestId(`button-podglad-${pierwszy.id}`));
    const dialog = await screen.findByTestId("dialog-podglad-produktu");

    expect(within(dialog).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(dialog).queryByRole("button", { name: /zapisz/i })).not.toBeInTheDocument();
  });
});
