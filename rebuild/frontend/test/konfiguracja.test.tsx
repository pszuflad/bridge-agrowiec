/**
 * Widok `/konfiguracja` — szkielet sześciu zakładek i zakładka „Wgrywanie ręczne".
 *
 * Zakładka „Dostawcy" (3f-2) ma własny plik: `test/konfiguracja.dostawcy.test.tsx`.
 *
 * Mocki MSW karmione fixture'em `contract/fixtures/GET_suppliers.json`, tak jak w I2 i 3e:
 * lista dostawcy w selekcie ma mieć kształt, który realnie oddaje produkcja.
 *
 * Zakres: że sześć zakładek istnieje w kolejności oryginału, że każda z nich pokazuje swoją
 * zawartość (od I11 nie ma już żadnej zaślepki), że wybór pliku uruchamia detekcję,
 * że da się dostawcę nadpisać ręcznie,
 * że wysłanie idzie multipartem pod właściwy adres — i że NIEUDANY UPLOAD JEST WIDOCZNY
 * (gate 3f-1), a nie znika po cichu.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { ZAKLADKI_KONFIGURACJI } from "@/pages/konfiguracja/zakladki";
import {
  dostawcyZFixtura,
  konfiguracjaZFixtura,
  spedycjaZFixtura,
  TOKEN_TESTOWY,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const DOSTAWCY = dostawcyZFixtura();
const KONFIGURACJA = konfiguracjaZFixtura();
const SPEDYCJA = spedycjaZFixtura();

/** Żądania uploadu: adres + treść pola `plik` — na nich sprawdzamy multipart. */
let uploady: { url: string; trescPliku: string | null }[] = [];

const ODPOWIEDZ_OK = {
  ok: true,
  nazwaPliku: "bohnenkamp_2026.csv",
  liczbaProduktow: 120,
  doStagingu: 118,
  nowe: 100,
  zmienione: 15,
  wycofane: 3,
  bezZmian: 0,
  autoZatwierdzone: 2,
  odrzuconeNieOpony: 1,
  odrzuconeBrakDanych: 1,
  odrzuconeSmieciMO2: 0,
  podglad: [
    { kod: "10000085", nazwa: "Opona VF 650/65 R42", rozmiar: "650/65R42", cenaZakupu: 5704.79, stan: 10 },
  ],
};

function zamockujApi(odpowiedzUploadu?: () => Response) {
  server.use(
    http.get("*/api/dostawcy", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    // Od I11 zakładki spedycja/shoper/ai realnie pobierają dane, więc szkielet ekranu
    // potrzebuje tych mocków — bez nich `onUnhandledRequest: "error"` wywala test.
    http.get("*/api/config", () => HttpResponse.json(KONFIGURACJA)),
    http.get("*/api/spedycja", () => HttpResponse.json(SPEDYCJA)),
    http.post("*/api/dostawcy/:kod/upload", async ({ request }) => {
      const dane = await request.formData();
      /*
       * Sprawdzamy TREŚĆ pola `plik`, nie jego nazwę: jsdom gubi `filename` przy
       * przejściu FormData przez warstwę fetch (pole przychodzi jako „blob"), więc
       * asercja na nazwie testowałaby środowisko, a nie nasz kod. Że backend widzi
       * właściwą nazwę, dowodzą test `dostawcy.upload.test.ts` (echo `nazwaPliku`)
       * i test integracyjny przez żywy serwer.
       */
      const plik = dane.get("plik") as { text?: () => Promise<string> } | null;
      uploady.push({
        url: request.url,
        trescPliku: typeof plik?.text === "function" ? await plik.text() : null,
      });
      return odpowiedzUploadu ? odpowiedzUploadu() : HttpResponse.json(ODPOWIEDZ_OK);
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

/**
 * Otwiera `/konfiguracja` i PRZECHODZI na zakładkę „wgrywanie".
 *
 * Ekran otwiera się na „dostawcy" — tak jak oryginał (`:26298`). Do 3f-2 domyślną była
 * „wgrywanie", bo była jedyną wypełnioną; teraz trzeba na nią kliknąć.
 */
async function otworzKonfiguracje() {
  window.history.pushState({}, "", "/konfiguracja");
  render(<App />);
  await screen.findByTestId("tab-wgrywanie");
  await userEvent.click(screen.getByTestId("tab-wgrywanie"));
  await screen.findByTestId("zakladka-wgrywanie");
}

/** Plik CSV o nagłówkach Bohnenkampa — nazwa pasuje do wzorca MO1. */
function plikMO1(nazwa = "bohnenkamp_2026.csv"): File {
  return new File(["10000085;8906117626978;CEAT;Opona VF 650\n"], nazwa, { type: "text/csv" });
}

describe("Widok /konfiguracja", () => {
  beforeEach(() => {
    uploady = [];
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  describe("szkielet zakładek", () => {
    it("ma sześć zakładek w kolejności oryginału", async () => {
      await otworzKonfiguracje();

      const etykiety = ["Dostawcy", "Wgrywanie ręczne", "Spedycja", "Shoper", "Katalog", "AI Fallback"];
      for (const [i, z] of ZAKLADKI_KONFIGURACJI.entries()) {
        const zakladka = screen.getByTestId(`tab-${z.wartosc}`);
        expect(zakladka).toBeInTheDocument();
        expect(zakladka).toHaveTextContent(etykiety[i]!);
      }
    });

    it("otwiera się na „dostawcy” — jak oryginał (`:26298`)", async () => {
      window.history.pushState({}, "", "/konfiguracja");
      render(<App />);

      // Karta pierwszego dostawcy z fixtura jest widoczna BEZ klikania w zakładkę.
      await screen.findByTestId(`supplier-config-${DOSTAWCY[0]!.kod}`);
      expect(screen.queryByTestId("zakladka-wgrywanie")).not.toBeInTheDocument();
    });

    // Po I11 nie ma już zaślepek — każda z sześciu zakładek pokazuje własną kartę.
    // Test pilnuje, żeby dołożenie siódmej zakładki bez zawartości nie przeszło niezauważone.
    it.each([
      ["spedycja", "Limity spedycyjne per dostawca"],
      ["shoper", "Eksport CSV do Shoper"],
      ["katalog", "Domyślne kolumny katalogu"],
      ["ai", "AI Fallback (OpenAI ChatGPT)"],
    ])("zakładka %s pokazuje kartę „%s”", async (wartosc, naglowek) => {
      await otworzKonfiguracje();
      await userEvent.click(screen.getByTestId(`tab-${wartosc}`));

      expect(await screen.findByText(naglowek)).toBeInTheDocument();
      expect(screen.queryByTestId(`zaslepka-${wartosc}`)).not.toBeInTheDocument();
    });
  });

  describe("detekcja dostawcy przy wyborze pliku", () => {
    it("rozpoznaje MO1 po nazwie pliku i pokazuje powód", async () => {
      await otworzKonfiguracje();

      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());

      const powod = await screen.findByTestId("powod-detekcji");
      expect(powod).toHaveTextContent("MO1");
      expect(powod).toHaveTextContent("wysoka pewność");
      expect(powod).toHaveTextContent("Nazwa pliku pasuje");
    });

    it("nierozpoznany plik prosi o ręczny wybór i blokuje wysyłkę", async () => {
      await otworzKonfiguracje();

      await userEvent.upload(
        screen.getByTestId("input-pliki"),
        new File(["alfa;beta;gamma\n"], "cokolwiek.csv", { type: "text/csv" }),
      );

      const powod = await screen.findByTestId("powod-detekcji");
      expect(powod).toHaveTextContent("wybierz dostawcę ręcznie");
      expect(screen.getByTestId("button-wyslij")).toBeDisabled();
    });

    /**
     * XLSX jest tu ŚWIADOMYM ODSTĘPSTWEM od oryginału, który go odrzucał komunikatem
     * „Format XLSX nie jest jeszcze obsługiwany. Zapisz jako CSV." — bez tego MO8 i MO10
     * (oba jeżdżą na XLSX i oba przychodzą mailem) byłyby przez tę zakładkę niewgrywalne.
     */
    it("przyjmuje XLSX i rozpoznaje go po nazwie pliku (MO8)", async () => {
      await otworzKonfiguracje();

      await userEvent.upload(
        screen.getByTestId("input-pliki"),
        new File([new Uint8Array([80, 75, 3, 4])], "trelleborg_2026.xlsx"),
      );

      const powod = await screen.findByTestId("powod-detekcji");
      expect(powod).toHaveTextContent("MO8");
      expect(screen.queryByTestId("bledy-wczytania")).not.toBeInTheDocument();
      expect(screen.getByTestId("button-wyslij")).toBeEnabled();
    });

    it("pozwala nadpisać wykrytego dostawcę wyborem z listy", async () => {
      await otworzKonfiguracje();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");

      const kodInny = String(DOSTAWCY.find((d) => d.kod !== "MO1")!.kod);
      await userEvent.click(screen.getByLabelText("Dostawca dla bohnenkamp_2026.csv"));
      await userEvent.click(await screen.findByRole("option", { name: new RegExp(kodInny) }));

      await waitFor(() =>
        expect(screen.getByTestId("powod-detekcji")).toHaveTextContent("wybrane ręcznie"),
      );
      expect(screen.getByTestId("powod-detekcji")).toHaveTextContent(`Wymuszone z UI (${kodInny})`);
    });
  });

  describe("wysłanie pliku", () => {
    it("wysyła ORYGINALNY plik multipartem pod adres wykrytego dostawcy", async () => {
      await otworzKonfiguracje();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");

      await userEvent.click(screen.getByTestId("button-wyslij"));

      await waitFor(() => expect(uploady).toHaveLength(1));
      expect(uploady[0]!.url).toContain("/api/dostawcy/MO1/upload");
      // Plik idzie w stanie NIEZMIENIONYM — przeglądarka go nie przepisuje.
      expect(uploady[0]!.trescPliku).toBe("10000085;8906117626978;CEAT;Opona VF 650\n");
    });

    it("pokazuje statystyki i podgląd 5 rekordów z odpowiedzi backendu", async () => {
      await otworzKonfiguracje();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");
      await userEvent.click(screen.getByTestId("button-wyslij"));

      const wynik = await screen.findByTestId("wynik-uploadu");
      expect(wynik).toHaveTextContent("Wczytano 120 pozycji");
      expect(wynik).toHaveTextContent("do stagingu: 118");
      expect(wynik).toHaveTextContent("auto-zatwierdzone: 2");
      // Podgląd pochodzi z backendu — z portu parserów, nie z parsowania w przeglądarce.
      expect(within(wynik).getByText("Opona VF 650/65 R42")).toBeInTheDocument();
    });
  });

  /**
   * GATE 3f-1: bez fallbacku `Wc()` nieudany parse MUSI być widoczny. Komunikat backendu
   * ma trafić na ekran w całości — „500" bez powodu nie mówi Ani, co poprawić w pliku.
   */
  describe("nieudany upload jest widoczny, nie cichy (GATE)", () => {
    beforeEach(() => {
      zamockujApi(() =>
        HttpResponse.json(
          { error: "Nieznany dostawca: MO1. Obsługiwani: MO2, MO3" },
          { status: 500 },
        ),
      );
    });

    it("pokazuje komunikat błędu z backendu przy pozycji", async () => {
      await otworzKonfiguracje();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");

      await userEvent.click(screen.getByTestId("button-wyslij"));

      const blad = await screen.findByTestId("blad-uploadu");
      expect(blad).toHaveTextContent("Nie udało się wgrać");
      expect(blad).toHaveTextContent("Nieznany dostawca: MO1");
      // Pozycja NIE może zniknąć ani udawać sukcesu.
      expect(screen.queryByTestId("wynik-uploadu")).not.toBeInTheDocument();
    });
  });
});
