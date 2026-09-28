/**
 * Widok `/staging` — render przeciwko mockom MSW zbudowanym z nagranych fixtures produkcji
 * (`contract/fixtures/GET_staging_paged.json`, `GET_staging.json`).
 *
 * Zakres: że ekran renderuje dane, że filtr/szukajka/paginacja wysyłają właściwe parametry
 * do `/paged`, że trzy warianty akcji masowych wysyłają właściwe ciało, że podgląd różnic
 * dociąga pozycję po id — i że wiersz `wycofana`, który ma INNY kształt niż reszta,
 * nie wywraca podglądu.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { queryClient } from "@/lib/queryClient";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { server } from "./msw/server";
import { handleryStagingu } from "./msw/staging";
import { WYGLAD_TYPU } from "@/pages/staging/dane";
import {
  domyslneKolumny,
  KOLEJNOSC_KOLUMN,
  KOLUMNY_STAGINGU,
} from "@/pages/staging/kolumny";
import { stronaStaginguZFixtura, TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const UZYTKOWNIK = uzytkownikZFixtura();
const STRONA = stronaStaginguZFixtura();

/** Adresy, pod które poszły żądania — na nich sprawdzamy parametry filtrów. */
let zapytania: string[] = [];
/** Ciała żądań mutacji — na nich sprawdzamy `ids` vs `allFiltered`. */
let mutacje: { url: string; body: unknown }[] = [];

function zamockujApi(
  strona: Record<string, unknown> = STRONA,
  szczegol: Record<string, unknown> | null = null,
) {
  // Handlery są WSPÓLNE (`test/msw/staging.ts`) — razem z czterema trasami polityki
  // Staging v2, których ten plik nie używa, ale które widok potrafi zawołać. Bez nich
  // `onUnhandledRequest: "error"` nie wywaliłby testu, tylko po cichu zamienił zapytanie
  // w błąd (CLAUDE.md, pułapka MSW).
  server.use(
    ...handleryStagingu({
      strona,
      szczegol,
      naZapytanie: (url) => zapytania.push(url),
      naMutacje: (wpis) => mutacje.push(wpis),
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzStaging() {
  window.history.pushState({}, "", "/staging");
  render(<App />);
  await screen.findByTestId("input-search-staging");
}

/** Ostatni adres `/paged` — po nim sprawdzamy, co widok wysłał do backendu. */
const ostatnieZapytanie = () => new URL(zapytania[zapytania.length - 1]!);

describe("Widok /staging", () => {
  beforeEach(() => {
    zapytania = [];
    mutacje = [];
    sessionStorage.clear();
    localStorage.clear();
    // `queryClient` jest SINGLETONEM modułowym ze `staleTime: Infinity` (wiernie wobec
    // oryginału), więc bez czyszczenia kolejny test dostałby dane poprzedniego pod tym
    // samym kluczem — a kluczem jest tu pełny adres z parametrami.
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  it("renderuje pozycje z fixture'a wraz z kolumnami i odznaką typu", async () => {
    await otworzStaging();

    const pierwsza = STRONA.items[0] as Record<string, unknown>;
    expect(await screen.findByText(String(pierwsza.kod))).toBeInTheDocument();

    /*
      Nagłówki 1:1 z oryginałem — sprawdzamy CAŁĄ LISTĘ W KOLEJNOŚCI, nie pojedyncze
      wystąpienia. Enhancer kolumn mapował je pozycyjnie (`POS_KEYS`, `fe.js:29156`), więc
      przestawienie dwóch kolumn miejscami jest realnym błędem, a nie kosmetyką — i taki
      właśnie błąd (`Magazyn` za `Cena sprzedaży`) siedział w odbudowie do 14b.

      ⚠ „Stan", „Cena zakupu" i „Cena sprzedaży" NIE SĄ tu wymienione, bo domyślnie są
      UKRYTE: w `STAGING_COLS` jako jedyne kolumny tabeli nie mają `def:true`. To zachowanie
      produkcji, osobny test niżej pilnuje, że nie zniknęło.
    */
    const naglowki = screen.getAllByRole("columnheader").map((th) => th.textContent?.trim());
    expect(naglowki).toEqual([
      "",
      "Typ",
      "Kod",
      "Nazwa",
      "Dostawca",
      "Magazyn",
      "Zmiana",
      "Powód",
      "Akcje",
    ]);

    /*
      Druga kotwica, w drugą stronę. Powyższa lista trzyma tabelę przy ORYGINALE (jest
      przepisana z `fe.js:20790-20826`), a ta trzyma ją przy stałej `KOLEJNOSC_KOLUMN`,
      którą `kolumny.ts` reklamuje jako źródło prawdy dla kolejności. Bez tej asercji stała
      byłaby martwym komentarzem, a JSX i `POS_KEYS` mogłyby się rozjechać niezauważone.
    */
    const domyslne = domyslneKolumny();
    const etykieta = (klucz: string) =>
      klucz === "checkbox"
        ? ""
        : KOLUMNY_STAGINGU.find((k) => k.klucz === klucz)!.etykieta;
    expect(naglowki).toEqual(
      KOLEJNOSC_KOLUMN.filter((klucz) => domyslne[klucz]).map(etykieta),
    );

    // Etykieta bierze się z mapy z oryginału, nie z surowej wartości pola. Oczekiwanie
    // wyprowadzamy z FIXTURE'A, żeby test nie zakładał, co produkcja akurat nagrała.
    const typWFixture = String((STRONA.items[0] as Record<string, unknown>).typZmiany);
    expect(WYGLAD_TYPU[typWFixture], `brak etykiety dla typu ${typWFixture}`).toBeDefined();
    expect(screen.getAllByText(WYGLAD_TYPU[typWFixture]!.etykieta).length).toBeGreaterThan(0);
  });

  it("pierwsze żądanie idzie z domyślnymi parametrami (strona 1, 25, NOWE produkty)", async () => {
    await otworzStaging();

    await waitFor(() => expect(zapytania.length).toBeGreaterThan(0));
    const url = ostatnieZapytanie();
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("25");
    // ⭐ „nowa", nie „all" — oryginał startuje `useState("nowa")` (`fe.js:20617`).
    expect(url.searchParams.get("typZmiany")).toBe("nowa");
    expect(url.searchParams.get("search")).toBe("");

    expect(screen.getByTestId("select-filter-type").textContent).toContain("Nowe produkty");
  });

  it("szukajka trafia do parametru `search`", async () => {
    const uzytkownik = userEvent.setup();
    await otworzStaging();

    await uzytkownik.type(screen.getByTestId("input-search-staging"), "BKT");

    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("search")).toBe("BKT"));
  });

  it("zmiana rozmiaru strony trafia do `limit` i wraca na stronę 1", async () => {
    const uzytkownik = userEvent.setup();
    await otworzStaging();

    await uzytkownik.click(screen.getByTestId("button-next-page"));
    await waitFor(() => expect(ostatnieZapytanie().searchParams.get("page")).toBe("2"));

    await uzytkownik.click(screen.getByTestId("button-page-size-100"));

    await waitFor(() => {
      const url = ostatnieZapytanie();
      expect(url.searchParams.get("limit")).toBe("100");
      expect(url.searchParams.get("page"), "zmiana rozmiaru strony cofa na pierwszą").toBe("1");
    });
  });

  describe("Akcje masowe — trzy warianty, trzy różne ciała żądania", () => {
    it("„zaznaczone” wysyła `ids` tylko z zaznaczonych wierszy", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`checkbox-staging-${pierwsza.id}`));
      await uzytkownik.click(screen.getByTestId("button-accept-checked"));

      await waitFor(() => expect(mutacje).toHaveLength(1));
      expect(mutacje[0]!.url).toContain("/api/staging/accept");
      expect(mutacje[0]!.body).toEqual({ ids: [pierwsza.id] });
    });

    it("„widoczne” wysyła `ids` wszystkich wierszy bieżącej strony", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      await screen.findByTestId("checkbox-select-all");

      await uzytkownik.click(screen.getByTestId("button-accept-selected"));

      await waitFor(() => expect(mutacje).toHaveLength(1));
      const ids = (mutacje[0]!.body as { ids: number[] }).ids;
      expect(ids).toHaveLength(STRONA.items.length);
    });

    it("„wszystkie” wysyła `allFiltered` z bieżącym filtrem, a nie listę id", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      // Od 12e (D5) akcje masowe pytają przez `DialogPotwierdzenia`, nie przez natywny
      // `window.confirm` — nie ma już czego podmieniać w globalu, klikamy przycisk w dialogu.
      await uzytkownik.click(screen.getByTestId("button-reject-all"));
      await uzytkownik.click(
        within(await screen.findByTestId("dialog-odrzuc-wszystkie")).getByTestId(
          "button-potwierdz",
        ),
      );

      await waitFor(() => expect(mutacje).toHaveLength(1));
      expect(mutacje[0]!.url).toContain("/api/staging/reject");
      // Zakres przycisku idzie za FILTREM, a filtr startuje na „nowa" — czyli domyślnie
      // akcja masowa dotyczy nowych produktów, nie całego stagingu.
      expect(mutacje[0]!.body).toEqual({ allFiltered: true, typZmiany: "nowa" });
    });

    it("„akceptuj wszystkie” też wysyła `allFiltered`, z aktualnym filtrem typu", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      // Filtr ustawiony na coś innego niż domyślne — ma trafić do ciała żądania.
      await uzytkownik.click(screen.getByTestId("select-filter-type"));
      await uzytkownik.click(await screen.findByRole("option", { name: "Braki w cenniku" }));
      await uzytkownik.click(screen.getByTestId("button-accept-all"));
      await uzytkownik.click(
        within(await screen.findByTestId("dialog-akceptuj-wszystkie")).getByTestId(
          "button-potwierdz",
        ),
      );

      await waitFor(() => expect(mutacje).toHaveLength(1));
      expect(mutacje[0]!.url).toContain("/api/staging/accept");
      expect(mutacje[0]!.body).toEqual({ allFiltered: true, typZmiany: "wycofana" });
    });

    it("odmowa w oknie potwierdzenia NIE wysyła żądania", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-accept-all"));
      await uzytkownik.click(
        within(await screen.findByTestId("dialog-akceptuj-wszystkie")).getByTestId("button-anuluj"),
      );

      expect(mutacje).toHaveLength(0);
    });

    it("bez potwierdzenia dialog tylko się otwiera — samo kliknięcie nic nie wysyła", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-reject-all"));

      // Pytanie jest DOSŁOWNIE takie, jakie stało w `confirm()` do 12e — parytet treści.
      expect(await screen.findByText(/Odrzucić wszystkie pasujące pozycje \(\d+\)\?/)).toBeInTheDocument();
      expect(mutacje).toHaveLength(0);
    });

    it("zaznaczenie „wszystkie widoczne” zaznacza i odznacza cały zestaw", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const zaznaczWszystkie = await screen.findByTestId("checkbox-select-all");
      await uzytkownik.click(zaznaczWszystkie);
      expect(
        screen.getByTestId("button-accept-checked").textContent,
      ).toContain(String(STRONA.items.length));

      /*
        Po odznaczeniu przycisk ZNIKA, a nie pokazuje „(0)" — oryginał renderuje warianty
        „zaznaczone" warunkowo (`n.size > 0 && …`, `fe.js:20741`). Odbudowa trzymała je
        zawsze, tylko wyszarzone; wyrównane w 14b.
      */
      await uzytkownik.click(zaznaczWszystkie);
      expect(screen.queryByTestId("button-accept-checked")).not.toBeInTheDocument();
      expect(screen.queryByTestId("button-reject-checked")).not.toBeInTheDocument();
    });
  });

  describe("Podgląd różnic", () => {
    it("dociąga pozycję po id, bo `/paged` nie zwraca `snapshotJson`", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`button-details-${pierwsza.id}`));

      const dialog = await screen.findByTestId("dialog-staging");
      // Snapshot pochodzi z `GET /api/staging/{id}` — na liście go nie było.
      await waitFor(() =>
        expect(within(dialog).getByTestId("szczegoly-snapshot")).toBeInTheDocument(),
      );
      expect(within(dialog).getByTestId("szczegoly-powod")).toBeInTheDocument();
    });

    /**
     * ⚠ NAJWAŻNIEJSZY TEST TEGO PLIKU. Wiersz `wycofana` ma inny kształt niż reszta:
     * `snapshotJson` jest `null`, pola `ean*` też, `cenaZakupuNowa` i `zmianaPct` są `null`,
     * a `stanNowy` to zawsze 0. Podgląd, który zakłada obecność snapshotu, wywraca się
     * dokładnie tutaj — a `wycofana` to 149 wierszy na realnych cennikach.
     */
    it("wiersz `wycofana` renderuje się i otwiera BEZ wywrócenia podglądu", async () => {
      const wycofana = {
        ...(STRONA.items[0] as Record<string, unknown>),
        id: 999001,
        typZmiany: "wycofana",
        stanNowy: 0,
        cenaZakupuNowa: null,
        zmianaPct: null,
        eanRaw: null,
        eanIsValid: null,
        eanSourceStatus: null,
        powod: "Brak w cenniku — pozycja wycofana",
      };
      zamockujApi({ ...STRONA, items: [wycofana] }, { ...wycofana, snapshotJson: null });

      const uzytkownik = userEvent.setup();
      await otworzStaging();

      expect(await screen.findByText("Brak w cenniku")).toBeInTheDocument();
      await uzytkownik.click(await screen.findByTestId("button-details-999001"));

      const dialog = await screen.findByTestId("dialog-staging");
      await waitFor(() =>
        expect(within(dialog).getByTestId("szczegoly-wycofana")).toBeInTheDocument(),
      );
      // Dla wycofania nie ma czego edytować — przycisk zapisu nie powstaje.
      expect(within(dialog).queryByTestId("button-save-details")).not.toBeInTheDocument();
    });
  });

  /**
   * „Braki w cenniku" — CAŁY zakres tej funkcji w produkcji (karta I15.11, ticket 142).
   *
   * ⭐ PO CO TE ASERCJE ISTNIEJĄ. Łatka #103 zmieniła w żywym bundlu
   * (`index-PRICEFMT1783512500.js` @ `88fa31c`) dokładnie CZTERY napisy i nic poza nimi:
   * opcję filtra, dwie odznaki (`wycofana`, `zniknal`) i człon podsumowania importu (ten
   * ostatni sprawdza `konfiguracja.test.tsx`). Odbudowa niosła etykiety ze STAREGO
   * deminifikatu z 2026-08-13 i przez to mówiła „Wycofane"/„Wycofana".
   *
   * ⚠ Fixtures stagingu pochodzą sprzed #103, więc GATE na fixtures NIE złapie powrotu
   * starej etykiety. Te asercje na dosłowny tekst są jedyną siatką bezpieczeństwa.
   */
  describe("„Braki w cenniku” — etykiety z żywego bundla 88fa31c", () => {
    it("filtr „Typ sprawy” oferuje „Braki w cenniku”, a nie dawne „Wycofane”", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("select-filter-type"));

      expect(await screen.findByRole("option", { name: "Braki w cenniku" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Wycofane" })).not.toBeInTheDocument();
    });

    /**
     * `zniknal` to wartość ZASZŁA — nasz silnik jej nie produkuje, ale oryginał trzyma dla
     * niej osobny wpis w `XP`, a stare dane stagingu mogą ją nieść. Bez wpisu w mapie
     * odznaka spadłaby na fallback i pokazała surowe „zniknal”.
     */
    it.each(["wycofana", "zniknal"])(
      "wiersz `%s` dostaje odznakę „Brak w cenniku”",
      async (typZmiany) => {
        const wiersz = {
          ...(STRONA.items[0] as Record<string, unknown>),
          id: 999002,
          typZmiany,
          stanNowy: 0,
          cenaZakupuNowa: null,
          zmianaPct: null,
        };
        zamockujApi({ ...STRONA, items: [wiersz] }, { ...wiersz, snapshotJson: null });

        await otworzStaging();

        expect(await screen.findByText("Brak w cenniku")).toBeInTheDocument();
        expect(screen.queryByText("Wycofana")).not.toBeInTheDocument();
        // Fallback odznaki pokazuje surową wartość — sprawdzamy, że do niego NIE doszło.
        expect(screen.queryByText(typZmiany)).not.toBeInTheDocument();
      },
    );

    it("obie odznaki niosą tę samą treść i klasę co oryginał", () => {
      for (const typ of ["wycofana", "zniknal"]) {
        expect(WYGLAD_TYPU[typ], `brak wpisu odznaki dla ${typ}`).toEqual({
          etykieta: "Brak w cenniku",
          klasa: "bg-red-600 hover:bg-red-600 text-white",
        });
      }
    });
  });

  describe("Edycja — jedyna ścieżka tworząca poprawki Marty", () => {
    it("wysyła `PUT` tylko ze zmienionymi polami i z `_reason`", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`button-details-${pierwsza.id}`));
      const dialog = await screen.findByTestId("dialog-staging");

      await uzytkownik.type(within(dialog).getByTestId("input-kategoria"), "Przemysłowe");
      await uzytkownik.type(within(dialog).getByTestId("input-reason"), "decyzja Marty");
      await uzytkownik.click(within(dialog).getByTestId("button-save-details"));

      await waitFor(() => expect(mutacje).toHaveLength(1));
      expect(mutacje[0]!.url).toContain(`/api/staging/${pierwsza.id}`);
      expect(mutacje[0]!.body).toEqual({
        kategoria: "Przemysłowe",
        _reason: "decyzja Marty",
      });
    });

    it("przycisk zapisu jest nieaktywny, dopóki nic nie zmieniono", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`button-details-${pierwsza.id}`));
      const dialog = await screen.findByTestId("dialog-staging");

      expect(within(dialog).getByTestId("button-save-details")).toBeDisabled();
    });
  });

  describe("Stany brzegowe", () => {
    it("pusty wynik pokazuje komunikat z oryginału", async () => {
      zamockujApi({ items: [], total: 0, page: 1, pageSize: 25, pages: 0 });
      await otworzStaging();

      expect(await screen.findByText("Brak elementów do wyświetlenia")).toBeInTheDocument();
    });

    it("błąd pobrania pokazuje komunikat, a nie pustą tabelę", async () => {
      server.use(
        http.get("*/api/staging/paged", () => HttpResponse.json({ error: "boom" }, { status: 500 })),
      );
      await otworzStaging();

      expect(
        await screen.findByText("Nie udało się pobrać pozycji stagingu."),
      ).toBeInTheDocument();
    });
  });

  describe("Pasek narzędzi", () => {
    it("placeholder szukajki wymienia wszystkie cztery pola, po których szuka backend", async () => {
      await otworzStaging();

      /*
        Dosłowny tekst oryginału (`fe.js:20714`), z trzema kropkami ASCII. Backend naprawdę
        przeszukuje cztery pola (`rebuild/backend/src/repos/staging.ts:114-117`), a odbudowa
        obiecywała dwa — stąd uwaga Ani, że szukajka „nie znajduje po dostawcy".
      */
      expect(screen.getByTestId("input-search-staging")).toHaveAttribute(
        "placeholder",
        "Szukaj po kodzie, nazwie, dostawcy lub EAN...",
      );
    });

    it("licznik zmian odmienia rzeczownik tak jak oryginał", async () => {
      zamockujApi({ ...STRONA, total: 1 });
      await otworzStaging();

      expect((await screen.findByTestId("licznik-zmian")).textContent).toBe("1 zmiana");
    });

    it("„zaznaczone” pojawia się dopiero po zaznaczeniu wiersza", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      expect(screen.queryByTestId("button-accept-checked")).not.toBeInTheDocument();
      expect(screen.queryByTestId("button-reject-checked")).not.toBeInTheDocument();

      const pierwsza = STRONA.items[0] as { id: number };
      await uzytkownik.click(await screen.findByTestId(`checkbox-staging-${pierwsza.id}`));

      expect(screen.getByTestId("button-accept-checked")).toBeInTheDocument();
      expect(screen.getByTestId("button-reject-checked")).toBeInTheDocument();
    });

    it("przestawienie filtra na „Wszystkie” rozszerza zakres akcji masowej", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("select-filter-type"));
      await uzytkownik.click(await screen.findByRole("option", { name: "Wszystkie" }));
      await uzytkownik.click(screen.getByTestId("button-accept-all"));
      await uzytkownik.click(
        within(await screen.findByTestId("dialog-akceptuj-wszystkie")).getByTestId(
          "button-potwierdz",
        ),
      );

      await waitFor(() => expect(mutacje).toHaveLength(1));
      expect(mutacje[0]!.body).toEqual({ allFiltered: true, typZmiany: "all" });
    });
  });

  describe("Konfigurator kolumn", () => {
    /** Otwiera popover „Kolumny" i oddaje go do dalszych asercji. */
    async function otworzKolumny(uzytkownik: ReturnType<typeof userEvent.setup>) {
      await uzytkownik.click(screen.getByTestId("button-staging-columns"));
      return screen.findByTestId("popover-staging-columns");
    }

    it("domyślnie ukrywa „Stan”, „Cena zakupu” i „Cena sprzedaży”", async () => {
      await otworzStaging();
      await screen.findByTestId("checkbox-select-all");

      /*
        W `STAGING_COLS` te trzy kolumny jako jedyne kolumny tabeli nie mają `def:true`
        (`fe.js:28834-28841`), a `loadPrefs()` liczy domyślną widoczność jako
        `!!(c.locked || c.def)`. Produkcja startuje więc bez nich — to nie jest zgubiona
        kolumna, tylko odtworzone zachowanie enhancera.
      */
      for (const ukryta of ["Stan", "Cena zakupu", "Cena sprzedaży"]) {
        expect(
          screen.queryByRole("columnheader", { name: ukryta }),
          `${ukryta} ma być domyślnie ukryta`,
        ).not.toBeInTheDocument();
      }
    });

    it("odznaczenie kolumny usuwa ją z tabeli i zapisuje wybór w pamięci", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      await screen.findByTestId("checkbox-select-all");

      expect(screen.getByRole("columnheader", { name: "Dostawca" })).toBeInTheDocument();

      const popover = await otworzKolumny(uzytkownik);
      await uzytkownik.click(within(popover).getByTestId("kolumna-staging-dostawca"));

      await waitFor(() =>
        expect(screen.queryByRole("columnheader", { name: "Dostawca" })).not.toBeInTheDocument(),
      );

      const zapisane = JSON.parse(localStorage.getItem("bridge_staging_cols_v2")!) as Record<
        string,
        boolean
      >;
      expect(zapisane.dostawca).toBe(false);
      expect(zapisane.nazwa).toBe(true);
    });

    it("wybór zapisany wcześniej w pamięci obowiązuje od pierwszego renderu", async () => {
      localStorage.setItem(
        "bridge_staging_cols_v2",
        JSON.stringify({ checkbox: true, typ: true, kod: true, akcje: true, stan: true }),
      );
      await otworzStaging();
      await screen.findByTestId("checkbox-select-all");

      /*
        Klucz zapisany wcześniej bierzemy W CAŁOŚCI, bez scalania z domyślnymi — tak jak
        `loadPrefs()` w oryginale (`if (raw) return JSON.parse(raw)`). Dlatego „Nazwa",
        której w zapisie nie ma, jest ukryta, a „Stan", którego domyślnie NIE MA, jest widoczny.
      */
      expect(screen.getByRole("columnheader", { name: "Stan" })).toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Nazwa" })).not.toBeInTheDocument();
    });

    it("uszkodzony wpis w pamięci cofa do domyślnych, zamiast wywracać widok", async () => {
      /*
        `null` i `[]` to POPRAWNY JSON, więc nie wpadają w `catch` — w oryginale `loadPrefs()`
        oddaje je dalej, a `visible[c.key]` rzuca `TypeError`, który łapie zewnętrzny
        `try/catch` enhancera (`fe.js:29350-29352`): konfigurator milczy, strona stoi.
        U nas ten sam wyjątek poleciałby z renderu i bez `ErrorBoundary` zabrałby całą
        aplikację — dlatego `wczytajKolumny()` sprawdza kształt. Ten test pilnuje, że
        obserwowalny skutek jest taki jak w produkcji: widok działa.
      */
      for (const smiec of ["null", "[]", "{niepoprawny json"]) {
        localStorage.setItem("bridge_staging_cols_v2", smiec);
        queryClient.clear();
        window.history.pushState({}, "", "/staging");
        const widok = render(<App />);
        expect(await screen.findByRole("columnheader", { name: "Nazwa" })).toBeInTheDocument();
        widok.unmount();
      }
    });

    it("kolumny zablokowane nie mają przełącznika i przeżywają skrót „Żadna”", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      await screen.findByTestId("checkbox-select-all");

      const popover = await otworzKolumny(uzytkownik);
      expect(within(popover).queryByTestId("kolumna-staging-checkbox")).not.toBeInTheDocument();
      expect(within(popover).queryByTestId("kolumna-staging-akcje")).not.toBeInTheDocument();

      await uzytkownik.click(within(popover).getByRole("button", { name: "Żadna" }));

      await waitFor(() =>
        expect(screen.queryByRole("columnheader", { name: "Typ" })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("columnheader", { name: "Akcje" })).toBeInTheDocument();
      expect(screen.getByTestId("checkbox-select-all")).toBeInTheDocument();
    });

    it("skrót „Domyślne” przywraca stan sprzed zmian, z ukrytymi cenami włącznie", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      await screen.findByTestId("checkbox-select-all");

      const popover = await otworzKolumny(uzytkownik);
      await uzytkownik.click(within(popover).getByRole("button", { name: "Wszystkie" }));
      await waitFor(() =>
        expect(screen.getByRole("columnheader", { name: "Cena zakupu" })).toBeInTheDocument(),
      );

      await uzytkownik.click(within(popover).getByRole("button", { name: "Domyślne" }));

      await waitFor(() =>
        expect(
          screen.queryByRole("columnheader", { name: "Cena zakupu" }),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("columnheader", { name: "Magazyn" })).toBeInTheDocument();
    });

    it("przełącznik z sekcji „Dodatkowe” zapisuje się, ale NIE zmienia tabeli", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      await screen.findByTestId("checkbox-select-all");

      const ileKolumn = screen.getAllByRole("columnheader").length;

      const popover = await otworzKolumny(uzytkownik);
      expect(
        within(popover).getByText("Te kolumny nie są jeszcze wyświetlane w tabeli stagingu."),
      ).toBeInTheDocument();
      await uzytkownik.click(within(popover).getByTestId("kolumna-staging-ex_ean"));

      /*
        ⭐ TO JEST DOWÓD WIERNOŚCI, nie przeoczenie. `applyCss()` w oryginale zaczyna od
        `if (c.extra) return` (`fe.js:29134`), więc 49 przełączników tej sekcji zapisuje się
        do pamięci i nie robi nic więcej. Gdyby kiedyś ktoś je „naprawił", ten test upadnie
        i zmusi do świadomej decyzji.
      */
      await waitFor(() =>
        expect(
          JSON.parse(localStorage.getItem("bridge_staging_cols_v2")!).ex_ean,
        ).toBe(true),
      );
      expect(screen.getAllByRole("columnheader")).toHaveLength(ileKolumn);
    });
  });
});
