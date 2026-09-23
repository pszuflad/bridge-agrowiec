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
 *
 * Od I14 (karta 14a) zakładka ma kształt oryginału `JT()` (`:26147-26200`): wgrywanie zbiorcze
 * jest MODALEM za `button-multi-upload`, a nie inline'em, doszła siatka kafli
 * `upload-tile-{kod}` z wymuszonym dostawcą, a komunikaty idą toastem zamiast list inline.
 * Testy pilnują także, żeby nie wrócił licznik „Wgraj (N)" w etykiecie przycisku importu —
 * po udanym imporcie pokazywał „Wgraj (0)" i czytał się jako „wgrało zero".
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

/**
 * Otwiera zakładkę i MODAL wgrywania zbiorczego.
 *
 * Od I14 wybór pliku żyje wyłącznie w dialogu za `button-multi-upload` (`:26157`), więc
 * każdy test dotykający plików musi najpierw ten dialog otworzyć.
 */
async function otworzDialogZbiorczy() {
  await otworzKonfiguracje();
  await userEvent.click(screen.getByTestId("button-multi-upload"));
  await screen.findByRole("dialog");
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
    /**
     * ⚠ SZEŚĆ PIERWSZYCH zakładek jest 1:1 z oryginałem (`:26299-26338`) — ich nazwy
     * i KOLEJNOŚĆ są tu asercją wierności. Dwie ostatnie („Admin", „Dziennik") dołożyła
     * Iteracja 12b jako świadome odstępstwo (plan.md D1/D3), więc sprawdzamy je osobno:
     * mają istnieć, ale NIE MOGĄ wcisnąć się między zakładki produkcyjne.
     */
    it("ma sześć zakładek oryginału w jego kolejności, przed zakładkami odbudowy", async () => {
      await otworzKonfiguracje();

      const etykiety = ["Dostawcy", "Wgrywanie ręczne", "Spedycja", "Shoper", "Katalog", "AI Fallback"];
      for (const [i, etykieta] of etykiety.entries()) {
        const z = ZAKLADKI_KONFIGURACJI[i]!;
        const zakladka = screen.getByTestId(`tab-${z.wartosc}`);
        expect(zakladka).toBeInTheDocument();
        expect(zakladka).toHaveTextContent(etykieta);
      }
    });

    it("ma zakładki „Admin” i „Dziennik” dołożone w I12b, na końcu listy", async () => {
      await otworzKonfiguracje();

      expect(ZAKLADKI_KONFIGURACJI.map((z) => z.wartosc).slice(6)).toEqual(["admin", "dziennik"]);
      expect(screen.getByTestId("tab-admin")).toHaveTextContent("Admin");
      expect(screen.getByTestId("tab-dziennik")).toHaveTextContent("Dziennik");
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

  /**
   * Sekcja zakładki 1:1 z `JT()` (`:26147-26200`): dwie karty, z których pierwsza ma sam
   * przycisk otwierający modal, a druga siatkę kafli per dostawca. Do I14 wgrywanie zbiorcze
   * było inline'em — testy pilnują, żeby nie wróciło.
   */
  describe("sekcja „Wgrywanie ręczne” ma kształt oryginału", () => {
    it("ma przycisk „Wgraj pliki”, a NIE inline'owy wybór pliku", async () => {
      await otworzKonfiguracje();

      expect(screen.getByTestId("button-multi-upload")).toHaveTextContent("Wgraj pliki");
      // Wybór pliku żyje wyłącznie w modalu — dopóki nikt go nie otworzył, nie ma go w DOM.
      expect(screen.queryByTestId("input-pliki")).not.toBeInTheDocument();
      expect(screen.queryByTestId("button-wyslij")).not.toBeInTheDocument();
    });

    /**
     * Oryginał renderuje WSZYSTKICH dostawców z listy, bez filtrowania i bez sortowania
     * (`:26180`), i nie ma gałęzi dla listy pustej. Decyzja 14a/D5: zostaje 1:1 — dostawcę
     * wyłączonego z importu odrzuca backend, front nie dubluje tej reguły.
     */
    it("ma kafel dla każdego dostawcy z kodem, nazwą i e-mailem", async () => {
      await otworzKonfiguracje();

      expect(screen.getByText("Wgrywanie pojedyncze (z wymuszonym dostawcą)")).toBeInTheDocument();
      for (const d of DOSTAWCY) {
        const kafel = screen.getByTestId(`upload-tile-${d.kod}`);
        expect(kafel).toHaveTextContent(String(d.kod));
        expect(kafel).toHaveTextContent(String(d.nazwa));
        if (d.email) expect(kafel).toHaveTextContent(String(d.email));
        expect(within(kafel).getByRole("button", { name: /Wgraj plik/ })).toBeInTheDocument();
      }
    });
  });

  describe("detekcja dostawcy przy wyborze pliku", () => {
    it("rozpoznaje MO1 po nazwie pliku i pokazuje powód", async () => {
      await otworzDialogZbiorczy();

      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());

      const powod = await screen.findByTestId("powod-detekcji");
      expect(powod).toHaveTextContent("MO1");
      expect(powod).toHaveTextContent("wysoka pewność");
      expect(powod).toHaveTextContent("Nazwa pliku pasuje");
    });

    it("nierozpoznany plik prosi o ręczny wybór i blokuje import", async () => {
      await otworzDialogZbiorczy();

      await userEvent.upload(
        screen.getByTestId("input-pliki"),
        new File(["alfa;beta;gamma\n"], "cokolwiek.csv", { type: "text/csv" }),
      );

      const powod = await screen.findByTestId("powod-detekcji");
      expect(powod).toHaveTextContent("wybierz dostawcę ręcznie");
      expect(screen.getByTestId("button-importuj")).toBeDisabled();
    });

    /**
     * XLSX jest tu ŚWIADOMYM ODSTĘPSTWEM od oryginału, który go odrzucał komunikatem
     * „Format XLSX nie jest jeszcze obsługiwany. Zapisz jako CSV." — bez tego MO8 i MO10
     * (oba jeżdżą na XLSX i oba przychodzą mailem) byłyby przez tę zakładkę niewgrywalne.
     */
    it("przyjmuje XLSX i rozpoznaje go po nazwie pliku (MO8)", async () => {
      await otworzDialogZbiorczy();

      await userEvent.upload(
        screen.getByTestId("input-pliki"),
        new File([new Uint8Array([80, 75, 3, 4])], "trelleborg_2026.xlsx"),
      );

      const powod = await screen.findByTestId("powod-detekcji");
      expect(powod).toHaveTextContent("MO8");
      expect(screen.queryByTestId("toast-destructive")).not.toBeInTheDocument();
      expect(screen.getByTestId("button-importuj")).toBeEnabled();
    });

    it("pozwala nadpisać wykrytego dostawcę wyborem z listy", async () => {
      await otworzDialogZbiorczy();
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

    /**
     * Do I14 błąd wczytania lądował na liście inline `bledy-wczytania`, bo odbudowa nie miała
     * jeszcze Toastera. Oryginał robi to toastem `destructive` (`:18876`), a plik NIE trafia
     * na listę — pozostałe wczytują się normalnie.
     */
    it("nieczytelny plik daje toast „Błąd pliku …”, a czytelny obok wczytuje się dalej", async () => {
      await otworzDialogZbiorczy();

      const zepsuty = new File(["cokolwiek\n"], "zepsuty.csv", { type: "text/csv" });
      Object.defineProperty(zepsuty, "slice", {
        value: () => {
          throw new Error("Nie udało się odczytać pliku");
        },
      });

      await userEvent.upload(screen.getByTestId("input-pliki"), [zepsuty, plikMO1()]);

      const toast = await screen.findByTestId("toast-destructive");
      expect(toast).toHaveTextContent("Błąd pliku zepsuty.csv");
      expect(toast).toHaveTextContent("Nie udało się odczytać pliku");
      // Zepsuty nie wchodzi na listę, czytelny wchodzi.
      expect(screen.queryByTestId("pozycja-zepsuty.csv")).not.toBeInTheDocument();
      expect(screen.getByTestId("pozycja-bohnenkamp_2026.csv")).toBeInTheDocument();
    });
  });

  describe("import", () => {
    it("wysyła ORYGINALNY plik multipartem pod adres wykrytego dostawcy", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");

      await userEvent.click(screen.getByTestId("button-importuj"));

      await waitFor(() => expect(uploady).toHaveLength(1));
      expect(uploady[0]!.url).toContain("/api/dostawcy/MO1/upload");
      // Plik idzie w stanie NIEZMIENIONYM — przeglądarka go nie przepisuje.
      expect(uploady[0]!.trescPliku).toBe("10000085;8906117626978;CEAT;Opona VF 650\n");
    });

    /**
     * ⚠ PUNKT 4 KARTY 14a. Wcześniej przycisk miał etykietę „Wgraj (N)”, gdzie N liczyło
     * pozycje JESZCZE niewysłane — po udanym imporcie spadało do zera i czytało się jako
     * „wgrało zero”. Oryginał licznika nie ma (`:19171`), a przycisk wyłącza wyłącznie
     * warunkiem „żaden plik nie ma rozpoznanego dostawcy” (`:19161`).
     */
    it("przycisk akcji to „Importuj do staging” BEZ licznika", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");

      const przycisk = screen.getByTestId("button-importuj");
      expect(przycisk).toHaveTextContent("Importuj do staging");
      expect(przycisk).toBeEnabled();
      expect(przycisk.textContent).not.toMatch(/\(\d+\)/);
    });

    /**
     * Toast zbiorczy — `:19142-19153`. Opis skleja TYLKO niezerowe człony separatorem „ • ”,
     * a „Pozycji w plikach” idzie zawsze. `bezZmian` w `ODPOWIEDZ_OK` jest zerem, więc tego
     * członu być NIE MOŻE; `odrzuconeBrakDanych` oryginał sumuje, ale nigdy nie wyświetla.
     */
    it("po imporcie pokazuje toast z tytułem i niezerowymi członami", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");
      await userEvent.click(screen.getByTestId("button-importuj"));

      const toast = await screen.findByTestId("toast-default");
      expect(toast).toHaveTextContent("118 pozycji czeka na akceptację");
      expect(toast).toHaveTextContent(
        "Pozycji w plikach: 120 • Do akceptacji w stagingu: 118 • Nowe: 100 • Zmienione: 15 • Braki w cenniku: 3 • Odrzucone (nie opony): 1",
      );
      expect(toast).not.toHaveTextContent("Bez zmian");
      expect(toast).not.toHaveTextContent("Brak danych");
    });

    it("po udanym imporcie zamyka dialog, czyści listę i pokazuje wynik z podglądem pod kaflami", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");
      await userEvent.click(screen.getByTestId("button-importuj"));

      // Dialog znika (`i(!1)`, `:19154`) razem z listą plików (`w()`, `:19155`).
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.queryByTestId("pozycja-bohnenkamp_2026.csv")).not.toBeInTheDocument();

      // Podgląd pochodzi z ODPOWIEDZI backendu (3f-1) i dlatego renderuje się poza dialogiem (D4).
      const wynik = await screen.findByTestId("wynik-uploadu");
      expect(wynik).toHaveTextContent("Wczytano 120 pozycji");
      expect(wynik).toHaveTextContent("do stagingu: 118");
      expect(wynik).toHaveTextContent("auto-zatwierdzone: 2");
      expect(within(wynik).getByText("Opona VF 650/65 R42")).toBeInTheDocument();
    });

    /**
     * Kafel wymusza dostawcę na wczytanym pliku (`:18868`) — plik o nazwie pasującej do MO1
     * ma polecieć pod kod z kafla, a nie pod wykryty.
     */
    it("kafel wgrywa pod WYMUSZONEGO dostawcę, nie pod wykrytego", async () => {
      await otworzKonfiguracje();
      const kafel = screen.getByTestId("upload-tile-MO3");
      await userEvent.click(within(kafel).getByRole("button", { name: /Wgraj plik/ }));
      await screen.findByRole("dialog");

      expect(screen.getByText("Wczytaj plik cennika — MO3")).toBeInTheDocument();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());

      const powod = await screen.findByTestId("powod-detekcji");
      expect(powod).toHaveTextContent("Wymuszone z UI (MO3)");

      await userEvent.click(screen.getByTestId("button-importuj"));
      await waitFor(() => expect(uploady).toHaveLength(1));
      expect(uploady[0]!.url).toContain("/api/dostawcy/MO3/upload");
    });

    /**
     * „Pominięte pliki" to JEDYNY licznik liczony po stronie klienta i jedyna gałąź `continue`
     * w pętli (`:19136-19138`, `:19150`) — plik bez rozpoznanego dostawcy nie jest wysyłany,
     * ale musi być policzony.
     */
    it("liczy pliki bez rozpoznanego dostawcy jako „Pominięte pliki”", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), [
        plikMO1(),
        new File(["alfa;beta;gamma\n"], "cokolwiek.csv", { type: "text/csv" }),
      ]);
      await waitFor(() => expect(screen.getByTestId("pozycja-cokolwiek.csv")).toBeInTheDocument());

      await userEvent.click(screen.getByTestId("button-importuj"));

      const toast = await screen.findByTestId("toast-default");
      expect(toast).toHaveTextContent("Pominięte pliki: 1");
      // Pominięty plik NIE jest wysyłany — leci tylko rozpoznany.
      expect(uploady).toHaveLength(1);
      expect(uploady[0]!.url).toContain("/api/dostawcy/MO1/upload");
    });
  });

  /**
   * Import częściowo udany: pierwszy plik przechodzi, drugi wywala pętlę (D7). Sprawdzamy to,
   * czego nie widać w scenariuszu jednoplikowym — że wynik udanego pliku NIE ginie i że
   * sekcja pod kaflami pokazuje TĘ próbę, a nie poprzednią.
   */
  describe("import częściowo udany", () => {
    beforeEach(() => {
      let wywolanie = 0;
      zamockujApi(() => {
        wywolanie += 1;
        return wywolanie === 1
          ? HttpResponse.json(ODPOWIEDZ_OK)
          : HttpResponse.json({ error: "Parser padł na wierszu 7" }, { status: 500 });
      });
    });

    it("pokazuje wynik udanego pliku i zostawia dialog otwarty na błędzie", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), [
        plikMO1("bohnenkamp_2026.csv"),
        plikMO1("bohnenkamp_2027.csv"),
      ]);
      await waitFor(() =>
        expect(screen.getByTestId("pozycja-bohnenkamp_2027.csv")).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByTestId("button-importuj"));

      const toast = await screen.findByTestId("toast-destructive");
      expect(toast).toHaveTextContent("Błąd importu");
      expect(toast).toHaveTextContent("Parser padł na wierszu 7");

      // Oba pliki poszły — błąd był na drugim, nie na pierwszym.
      await waitFor(() => expect(uploady).toHaveLength(2));
      // Wynik pierwszego pliku NIE ginie.
      const wynik = await screen.findByTestId("wynik-uploadu");
      expect(wynik).toHaveTextContent("bohnenkamp_2026.csv");
      expect(wynik).toHaveTextContent("Wczytano 120 pozycji");
      // Dialog zostaje otwarty z niewyczyszczoną listą (D7).
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("pozycja-bohnenkamp_2026.csv")).toBeInTheDocument();
    });
  });

  describe("toast przy imporcie bez pozycji do akceptacji", () => {
    beforeEach(() => {
      zamockujApi(() =>
        HttpResponse.json({
          ...ODPOWIEDZ_OK,
          doStagingu: 0,
          nowe: 0,
          zmienione: 0,
          wycofane: 0,
          odrzuconeNieOpony: 0,
          bezZmian: 120,
        }),
      );
    });

    it("ma tytuł „Import zakończony” i pomija wszystkie zerowe człony", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");
      await userEvent.click(screen.getByTestId("button-importuj"));

      const toast = await screen.findByTestId("toast-default");
      expect(toast).toHaveTextContent("Import zakończony");
      expect(toast).toHaveTextContent("Pozycji w plikach: 120 • Bez zmian: 120");
      expect(toast).not.toHaveTextContent("Do akceptacji w stagingu");
      expect(toast).not.toHaveTextContent("Nowe:");
    });
  });

  /**
   * GATE 3f-1: bez fallbacku `Wc()` nieudany parse MUSI być widoczny. Komunikat backendu
   * ma trafić na ekran w całości — „500" bez powodu nie mówi Ani, co poprawić w pliku.
   * Od I14 idzie toastem, a dialog ZOSTAJE otwarty z niewyczyszczoną listą (`:19156-19159`,
   * decyzja 14a/D7), żeby było widać, na którym pliku import stanął.
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

    it("pokazuje komunikat błędu z backendu i zostawia dialog otwarty", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), plikMO1());
      await screen.findByTestId("powod-detekcji");

      await userEvent.click(screen.getByTestId("button-importuj"));

      const toast = await screen.findByTestId("toast-destructive");
      expect(toast).toHaveTextContent("Błąd importu");
      expect(toast).toHaveTextContent("Nieznany dostawca: MO1");

      // Dialog i lista zostają — import nie może udawać sukcesu ani gubić pliku.
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("pozycja-bohnenkamp_2026.csv")).toBeInTheDocument();
      expect(screen.queryByTestId("wynik-uploadu")).not.toBeInTheDocument();
    });

    it("urywa pętlę na pierwszym błędzie — kolejne pliki nie są wysyłane", async () => {
      await otworzDialogZbiorczy();
      await userEvent.upload(screen.getByTestId("input-pliki"), [
        plikMO1("bohnenkamp_2026.csv"),
        plikMO1("bohnenkamp_2027.csv"),
      ]);
      await waitFor(() =>
        expect(screen.getByTestId("pozycja-bohnenkamp_2027.csv")).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByTestId("button-importuj"));
      await screen.findByTestId("toast-destructive");

      // 1:1 z oryginałem (`:19140`): `sP` rzuca, więc drugi plik w ogóle nie leci.
      expect(uploady).toHaveLength(1);
    });
  });
});
