/**
 * Okno „Rozstrzygnij” / „Sprawdź kartę” i okno „Nie zapisano zmian” (Staging v2, backlog #99).
 *
 * ⭐ TO JEST GATE TEGO TICKETA. Dla czterech tras polityki `contract/fixtures/` NIE MA nic
 * i nie miało czego nagrać (ustalenie D129.5 karty I15.4c) — nagrania obejmują wyłącznie
 * odczyt listy. Dowodem wierności są więc asercje na DOSŁOWNĄ treść okna, porównaną znak
 * w znak z `mirror/frontend/assets/staging-policy-injection.js` @ `88fa31c`, oraz na ciała
 * żądań wysyłanych do tras z `contract/openapi.yaml`.
 *
 * Każdy tekst sprawdzany niżej stoi w oryginale — jeśli test przestanie przechodzić po
 * „poprawieniu stylistyki”, to znaczy, że ktoś zmienił instrukcję, którą Ania czyta przy
 * konkretnej oponie, a nie że test jest zbyt drobiazgowy.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { server } from "./msw/server";
import {
  handleryStagingu,
  przegladBlednegoEan,
  przegladDopasowania,
  przegladSprzecznychWierszy,
  przegladStarejKarty,
  type OpcjeHandlerowStagingu,
  type ZapisMutacji,
} from "./msw/staging";
import { stronaStaginguZFixtura, TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const UZYTKOWNIK = uzytkownikZFixtura();

/** Cztery frazy, po których oryginał rozpoznaje zgłoszenie do ręcznej decyzji (`:145`). */
const FRAZY = {
  dopasowanie: "Kilka zgodnych produktów z tym EAN. Wybierz właściwą oponę.",
  cechy: "Oznaczenie wskazuje inną oponę. Sprawdź dopasowanie.",
  blednyEan:
    "Błędny EAN „4251438404205_D”: numer zawiera znaki inne niż cyfry. Numer nie zostanie zapisany.",
  plik: "Kilka różnych pozycji dostawcy wskazuje tę samą oponę. Wymaga sprawdzenia pliku.",
  staraKarta:
    "Brak starego kodu, ale zgodne cechy są w bieżącej ofercie pod innym oznaczeniem. Sprawdź starą kartę.",
} as const;

let mutacje: ZapisMutacji[] = [];
let zapytania: string[] = [];

/**
 * Strona `/paged` zbudowana z fixture'a, z podmienionym `powod` PIERWSZEJ pozycji.
 *
 * Fixture produkcji nie zawiera zgłoszenia do rozstrzygnięcia (nagrano zwykłe zmiany), więc
 * `powod` podmieniamy — ale resztę pozycji bierzemy z nagrania, żeby kształt wiersza pozostał
 * kontraktowy. Druga pozycja zostaje BEZ frazy: na niej sprawdzamy, że przycisku nie ma.
 */
function stronaZFraza(fraza: string, ostrzezenie: string | null = null) {
  const bazowa = stronaStaginguZFixtura();
  const [pierwsza, druga, ...reszta] = bazowa.items;
  return {
    ...bazowa,
    items: [
      { ...pierwsza, id: 710_001, powod: fraza, ostrzezenie },
      ...(druga ? [{ ...druga, id: 710_002, powod: "nazwa: A → B", ostrzezenie: null }] : []),
      ...reszta,
    ],
  } as unknown as Record<string, unknown>;
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

function zamockuj(opcje: OpcjeHandlerowStagingu = {}) {
  server.use(
    ...handleryStagingu({
      naMutacje: (wpis) => mutacje.push(wpis),
      naZapytanie: (url) => zapytania.push(url),
      ...opcje,
    }),
  );
}

async function otworzStaging() {
  window.history.pushState({}, "", "/staging");
  render(<App />);
  await screen.findByTestId("input-search-staging");
  await screen.findByTestId("checkbox-select-all");
}

/** Klika przycisk rozstrzygnięcia pierwszej pozycji i zwraca otwarte okno. */
async function otworzOkno(uzytkownik: ReturnType<typeof userEvent.setup>) {
  await uzytkownik.click(await screen.findByTestId("button-rozstrzygnij-710001"));
  return screen.findByTestId("dialog-rozstrzygniecie");
}

describe("Staging — okno „Rozstrzygnij”", () => {
  beforeEach(() => {
    mutacje = [];
    zapytania = [];
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
  });

  describe("Przycisk w kolumnie „Akcje”", () => {
    it.each([
      ["dopasowanie", FRAZY.dopasowanie, "Rozstrzygnij"],
      ["cechy", FRAZY.cechy, "Rozstrzygnij"],
      ["sprzeczny plik", FRAZY.plik, "Rozstrzygnij"],
      ["stara karta", FRAZY.staraKarta, "Sprawdź kartę"],
    ])("fraza „%s” daje przycisk „%s”", async (_nazwa, fraza, etykieta) => {
      zamockuj({ strona: stronaZFraza(fraza) });
      await otworzStaging();

      const przycisk = await screen.findByTestId("button-rozstrzygnij-710001");
      expect(przycisk).toHaveTextContent(etykieta);
    });

    it("pozycja bez żadnej z czterech fraz NIE dostaje przycisku", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.dopasowanie) });
      await otworzStaging();

      await screen.findByTestId("button-rozstrzygnij-710001");
      expect(screen.queryByTestId("button-rozstrzygnij-710002")).not.toBeInTheDocument();
    });

    it("fraza w `ostrzezenie` też daje przycisk — oryginał czytał CAŁY wiersz", async () => {
      zamockuj({ strona: stronaZFraza("Zmiana danych", FRAZY.plik) });
      await otworzStaging();

      expect(await screen.findByTestId("button-rozstrzygnij-710001")).toHaveTextContent(
        "Rozstrzygnij",
      );
    });

    it("ukrycie kolumny „Powód” NIE chowa przycisku (odstępstwo D2)", async () => {
      /*
        ⭐ TU JEST CAŁA RÓŻNICA WOBEC ORYGINAŁU. Skrypt wstrzykiwany testował
        `row.textContent`, więc schowanie kolumny „Powód” usuwało frazę z DOM-u i przycisk
        znikał — niezamierzony efekt uboczny nakładki, nie funkcja. Port czyta pole danych.
      */
      const uzytkownik = userEvent.setup();
      zamockuj({ strona: stronaZFraza(FRAZY.dopasowanie) });
      await otworzStaging();
      await screen.findByTestId("button-rozstrzygnij-710001");

      await uzytkownik.click(screen.getByTestId("button-staging-columns"));
      const popover = await screen.findByTestId("popover-staging-columns");
      await uzytkownik.click(within(popover).getByTestId("kolumna-staging-powod"));

      await waitFor(() =>
        expect(screen.queryByRole("columnheader", { name: "Powód" })).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId("button-rozstrzygnij-710001")).toBeInTheDocument();
    });
  });

  describe("Gałąź „błędny EAN od dostawcy” (`POST …/resolve-ean`) — NOWE, 2026-10-01", () => {
    it("pozycja z błędnym EAN-em ma przycisk „Rozstrzygnij” (wcześniej tylko „Szczegóły”)", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.blednyEan), przeglad: przegladBlednegoEan() });
      await otworzStaging();
      expect(await screen.findByTestId("button-rozstrzygnij-710001")).toHaveTextContent("Rozstrzygnij");
    });

    it("pokazuje numer od dostawcy i EAN karty; „Zostaw EAN z katalogu” wysyła `{decision:\"keep\"}`", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.blednyEan), przeglad: przegladBlednegoEan() });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("tytul-rozstrzygniecia")).toHaveTextContent("Błędny EAN w cenniku");
      expect(within(okno).getByTestId("galaz-ean")).toHaveTextContent("Dostawca podał EAN „4251438404205_D”");
      expect(within(okno).getByTestId("ean-karty")).toHaveTextContent("4251438404205");

      await uzytkownik.click(within(okno).getByTestId("button-ean-zostaw"));

      await waitFor(() => expect(mutacje.some((m) => m.url.includes("/resolve-ean"))).toBe(true));
      const zapis = mutacje.find((m) => m.url.includes("/resolve-ean"))!;
      expect(zapis.url).toContain("/api/staging/710001/resolve-ean");
      expect(zapis.body).toEqual({ decision: "keep" });
    });

    it("bez poprawnego EAN-u na karcie nie ma „Zostaw”; „Zapisz z tym EAN” czeka na wpisany numer", async () => {
      zamockuj({
        strona: stronaZFraza(FRAZY.blednyEan),
        przeglad: przegladBlednegoEan({ eanKarty: null }),
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).queryByTestId("button-ean-zostaw")).toBeNull();
      expect(within(okno).getByTestId("ean-karty-brak")).toBeInTheDocument();
      const zapisz = within(okno).getByTestId("button-ean-wpisz");
      expect(zapisz).toBeDisabled();

      await uzytkownik.type(within(okno).getByTestId("pole-ean-poprawny"), "5901234123457");
      expect(zapisz).toBeEnabled();
      await uzytkownik.click(zapisz);

      await waitFor(() => expect(mutacje.some((m) => m.url.includes("/resolve-ean"))).toBe(true));
      expect(mutacje.find((m) => m.url.includes("/resolve-ean"))!.body).toEqual({
        decision: "set",
        ean: "5901234123457",
      });
    });
  });

  describe("Gałąź „niejednoznaczne dopasowanie” (`POST …/resolve`)", () => {
    beforeEach(() => {
      zamockuj({ strona: stronaZFraza(FRAZY.dopasowanie), przeglad: przegladDopasowania() });
    });

    it("pokazuje tytuł, opis sprawy i instrukcję DOSŁOWNIE z oryginału", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("tytul-rozstrzygniecia")).toHaveTextContent(
        "Sprawdź dopasowanie opony",
      );
      expect(within(okno).getByText("480/70R34 BKT AGRIMAX RT 765")).toBeInTheDocument();
      expect(
        within(okno).getByText(
          "Pozycja z oferty: BKT · AGRIMAX RT 765 · 480/70R34 · DOT 2124 · EAN 8903094020614",
        ),
      ).toBeInTheDocument();
      // NOWE (2026-09-30): zamiast samego hasła importera — zdania, co jest nie tak.
      const wyjasnienie = within(okno).getByTestId("wyjasnienie");
      expect(wyjasnienie).toHaveTextContent("Dlaczego to zgłoszenie czeka na decyzję");
      expect(wyjasnienie).toHaveTextContent("pasuje do kilku produktów w katalogu: MO5_A, MO5_B");
      expect(within(okno).queryByTestId("opis-sprawy")).toBeNull();
      // Zdanie „NIE zatwierdza…” było nieprawdą po zmianie: zapis idzie od razu do katalogu.
      expect(within(okno).queryByText(/NIE zatwierdza/)).toBeNull();
      expect(
        within(okno).getByText(/„Zapisz w katalogu” zapisuje od razu, bez osobnej akceptacji w stagingu/),
      ).toBeInTheDocument();
    });

    it("zmiany można zapisać BEZ przewijania do listy wyboru — przyciskiem w stopce", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      await uzytkownik.click(within(okno).getByTestId("button-wlasne-parametry"));
      const nazwa = within(okno).getByTestId("pole-wlasne-nazwa");
      await uzytkownik.type(nazwa, " X");

      expect(within(okno).getByTestId("podpowiedz-wyboru")).toBeInTheDocument();
      // Dwa kandydaci → tylko „osobny produkt” (wybór jednej z kart zostaje na liście radio).
      expect(within(okno).queryByTestId("button-zapisz-istniejacy")).toBeNull();
      await uzytkownik.click(within(okno).getByTestId("button-zapisz-nowy"));

      await waitFor(() => expect(mutacje.some((m) => m.url.includes("/resolve"))).toBe(true));
      expect(mutacje.find((m) => m.url.includes("/resolve"))!.body).toEqual({
        action: "new",
        corrections: { nazwa: "480/70R34 BKT AGRIMAX RT 765 X" },
      });
    });

    it("przy JEDNEJ karcie jest też „Zapisz na istniejącej karcie” — wysyła `link` z poprawkami", async () => {
      const [pierwszy] = przegladDopasowania().candidates;
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        przeglad: { ...przegladDopasowania(), candidates: [pierwszy!] },
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      await uzytkownik.click(within(okno).getByTestId("button-wlasne-parametry"));
      const model = within(okno).getByTestId("pole-wlasne-model");
      await uzytkownik.clear(model);
      await uzytkownik.type(model, "AGRIMAX RT 765 NOWY");
      await uzytkownik.click(within(okno).getByTestId("button-zapisz-istniejacy"));

      await waitFor(() => expect(mutacje.some((m) => m.url.includes("/resolve"))).toBe(true));
      expect(mutacje.find((m) => m.url.includes("/resolve"))!.body).toEqual({
        action: "link",
        targetCode: "MO5_A",
        corrections: { model: "AGRIMAX RT 765 NOWY" },
      });
    });

    it("po zaznaczeniu wyboru przyciski „gdzie zapisać” znikają, a zostaje „Zapisz w katalogu”", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      await uzytkownik.click(within(okno).getByTestId("radio-dopasowanie-nowy"));

      expect(within(okno).queryByTestId("button-zapisz-nowy")).toBeNull();
      expect(within(okno).queryByTestId("podpowiedz-wyboru")).toBeNull();
      expect(within(okno).getByTestId("button-zapisz-wybor")).toBeEnabled();
    });

    it("bez wyjaśnienia z serwera wraca do hasła importera", async () => {
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        przeglad: { ...przegladDopasowania(), wyjasnienie: [] },
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("opis-sprawy")).toHaveTextContent(FRAZY.dopasowanie);
      expect(within(okno).queryByTestId("wyjasnienie")).toBeNull();
    });

    it("każdy kandydat ma link do swojej pozycji w katalogu (szukajka po kodzie)", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("link-katalog-MO5_A")).toHaveAttribute(
        "href",
        "/katalog?szukaj=MO5_A",
      );
      expect(within(okno).getByTestId("link-katalog-MO5_B")).toHaveAttribute(
        "href",
        "/katalog?szukaj=MO5_B",
      );
    });

    it("własne parametry: pola z propozycją importu, w żądaniu tylko to, co zmieniono", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).queryByTestId("wlasne-parametry")).toBeNull();
      await uzytkownik.click(within(okno).getByTestId("button-wlasne-parametry"));
      const nazwa = within(okno).getByTestId("pole-wlasne-nazwa");
      expect(nazwa).toHaveValue("480/70R34 BKT AGRIMAX RT 765");

      await uzytkownik.clear(nazwa);
      await uzytkownik.type(nazwa, "BKT AGRIMAX RT 765 480/70R34");
      await uzytkownik.click(within(okno).getByTestId("radio-dopasowanie-nowy"));
      await uzytkownik.click(within(okno).getByTestId("button-zapisz-wybor"));

      await waitFor(() => expect(mutacje.some((m) => m.url.includes("/resolve"))).toBe(true));
      expect(mutacje.find((m) => m.url.includes("/resolve"))!.body).toEqual({
        action: "new",
        corrections: { nazwa: "BKT AGRIMAX RT 765 480/70R34" },
      });
    });

    it("otwarte, ale niezmienione własne parametry nie wysyłają `corrections`", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      await uzytkownik.click(within(okno).getByTestId("button-wlasne-parametry"));
      await uzytkownik.click(within(okno).getByTestId("radio-dopasowanie-MO5_A"));
      await uzytkownik.click(within(okno).getByTestId("button-zapisz-wybor"));

      await waitFor(() => expect(mutacje.some((m) => m.url.includes("/resolve"))).toBe(true));
      expect(mutacje.find((m) => m.url.includes("/resolve"))!.body).toEqual({
        action: "link",
        targetCode: "MO5_A",
      });
    });

    it("listuje kandydatów w formacie oryginału, z dopiskiem „(inny EAN)”", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(
        within(okno).getByText(
          "MO5_A: 480/70R34 BKT AGRIMAX RT 765 · 480/70R34 · DOT 2124 · EAN 8903094020614",
        ),
      ).toBeInTheDocument();
      expect(
        within(okno).getByText(
          "MO5_B: 480/70R34 BKT AGRIMAX RT 765 (inna partia) · 480/70R34 · DOT 1923 · EAN 8903094020621 (inny EAN)",
        ),
      ).toBeInTheDocument();
      expect(
        within(okno).getByText("To osobna opona. Przygotuj ją jako nowy produkt."),
      ).toBeInTheDocument();
    });

    it("po zaznaczeniu produktu „Zapisz w katalogu” wysyła `{action:\"link\", targetCode}`", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      // Bez wyboru nie ma głównego przycisku — decyzję podejmuje się przyciskami w stopce.
      expect(within(okno).queryByTestId("button-zapisz-wybor")).toBeNull();

      await uzytkownik.click(within(okno).getByTestId("radio-dopasowanie-MO5_A"));
      const zapisz = within(okno).getByTestId("button-zapisz-wybor");
      expect(zapisz).toBeEnabled();
      await uzytkownik.click(zapisz);

      await waitFor(() => expect(mutacje.some((m) => m.url.includes("/resolve"))).toBe(true));
      const zapis = mutacje.find((m) => m.url.includes("/resolve"))!;
      expect(zapis.url).toContain("/api/staging/710001/resolve");
      expect(zapis.body).toEqual({ action: "link", targetCode: "MO5_A" });
    });

    it("„To osobna opona” wysyła `{action:\"new\"}` BEZ `targetCode`", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      await uzytkownik.click(within(okno).getByTestId("radio-dopasowanie-nowy"));
      await uzytkownik.click(within(okno).getByTestId("button-zapisz-wybor"));

      await waitFor(() => expect(mutacje.some((m) => m.url.includes("/resolve"))).toBe(true));
      /*
        Oryginał podaje `targetCode: undefined`, a `JSON.stringify` wycina wtedy klucz
        (`:131`). Backend sprawdza `produktPoKodzie(String(targetCode))`, więc wysłanie
        `null` dałoby próbę dopasowania do produktu o kodzie „null”.
      */
      expect(mutacje.find((m) => m.url.includes("/resolve"))!.body).toEqual({ action: "new" });
    });

    it("po sukcesie zamyka okno i odświeża listę (odstępstwo D3 — bez `location.reload()`)", async () => {
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);
      const ileZapytanPrzed = zapytania.length;

      await uzytkownik.click(within(okno).getByTestId("radio-dopasowanie-nowy"));
      await uzytkownik.click(within(okno).getByTestId("button-zapisz-wybor"));

      await waitFor(() =>
        expect(screen.queryByTestId("dialog-rozstrzygniecie")).not.toBeInTheDocument(),
      );
      await waitFor(() => expect(zapytania.length).toBeGreaterThan(ileZapytanPrzed));
    });

    it("`eanIssue` dokłada ostrzeżenie o poprawie EAN-u", async () => {
      // Późniejszy `server.use` ma pierwszeństwo — nadpisujemy `review` z `beforeEach`.
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        przeglad: przegladDopasowania({ eanIssue: "zapis naukowy" }),
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("ostrzezenie-ean")).toHaveTextContent(
        "EAN z oferty jest błędny — wpisz poprawny w polu EAN (Popraw dane z oferty), inaczej zapis zostanie zatrzymany.",
      );
    });
  });

  describe("Gałąź „stara karta” (`POST …/choose-absence-card`)", () => {
    it("zmienia tytuł okna i pokazuje obie karty z oceną EAN i DOT", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.staraKarta), przeglad: przegladStarejKarty() });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("tytul-rozstrzygniecia")).toHaveTextContent(
        "Porównaj starą kartę z obecną ofertą",
      );
      expect(
        within(okno).getByText(
          "Wybierz jedną kartę tylko wtedy, gdy DOT w obu kartach i w aktualnej ofercie jest taki sam. Druga karta zostanie wstrzymana. Opony z różnym DOT pozostają osobnymi produktami.",
        ),
      ).toBeInTheDocument();

      const stara = within(okno).getByTestId("karta-stara");
      expect(stara).toHaveTextContent("Stara karta w katalogu");
      expect(stara).toHaveTextContent("MO5_STARY · 480/70R34 BKT AGRIMAX RT 765");
      expect(stara).toHaveTextContent("Stan: wstrzymana, niedostępna w sprzedaży");

      const kandydat = within(okno).getByTestId("karta-kandydat-MO5_NOWY");
      expect(kandydat).toHaveTextContent("Pozycja w obecnej ofercie");
      expect(kandydat).toHaveTextContent("EAN 8903094020614 · DOT w ofercie: 2124");
      expect(kandydat).toHaveTextContent("DOT w karcie katalogowej: 2124");
      expect(kandydat).toHaveTextContent("EAN: taki sam; DOT: zgodny");
      expect(kandydat).toHaveTextContent("Stan w katalogu: dostępna");
    });

    it("przy zgodnym DOT pokazuje notatkę o natychmiastowym skutku wyboru", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.staraKarta), przeglad: przegladStarejKarty() });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("notatka-wyboru")).toHaveTextContent(
        "Wybór działa od razu w katalogu: wybrana karta przejmuje potwierdzoną ofertę, a druga zostaje wstrzymana ze stanem zero. Nie tworzy to kolejnego zgłoszenia.",
      );
    });

    it("wybór karty pyta o potwierdzenie i wysyła `{selectedCode, candidateVersion}`", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.staraKarta), przeglad: przegladStarejKarty() });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      const zapisz = within(okno).getByTestId("button-zapisz-wybor-karty");
      expect(zapisz).toBeDisabled();

      await uzytkownik.click(within(okno).getByTestId("radio-karta-MO5_NOWY"));
      expect(zapisz).toBeEnabled();
      await uzytkownik.click(zapisz);

      /*
        ODSTĘPSTWO ŚWIADOME (D5): oryginał pyta natywnym `window.confirm()` (`:111`).
        Treść pytania przenosimy DOSŁOWNIE, nośnikiem jest `DialogPotwierdzenia` —
        ten sam wzorzec co D2 z 7b i D5 z 12e.
      */
      const potwierdzenie = await screen.findByTestId("dialog-potwierdz-wybor-karty");
      expect(potwierdzenie).toHaveTextContent(
        "Zostawić w katalogu kartę MO5_NOWY? Druga karta zostanie wstrzymana, a jej stan wyzerowany.",
      );
      await uzytkownik.click(within(potwierdzenie).getByTestId("button-potwierdz"));

      await waitFor(() =>
        expect(mutacje.some((m) => m.url.includes("/choose-absence-card"))).toBe(true),
      );
      const zapis = mutacje.find((m) => m.url.includes("/choose-absence-card"))!;
      expect(zapis.body).toEqual({ selectedCode: "MO5_NOWY", candidateVersion: "v-nowy" });
    });

    it("wskazanie STAREJ karty niesie odcisk jedynego zgodnego kandydata", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.staraKarta), przeglad: przegladStarejKarty() });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      await uzytkownik.click(within(okno).getByTestId("radio-karta-MO5_STARY"));
      await uzytkownik.click(within(okno).getByTestId("button-zapisz-wybor-karty"));
      const potwierdzenie = await screen.findByTestId("dialog-potwierdz-wybor-karty");
      await uzytkownik.click(within(potwierdzenie).getByTestId("button-potwierdz"));

      await waitFor(() =>
        expect(mutacje.some((m) => m.url.includes("/choose-absence-card"))).toBe(true),
      );
      // `candidateVersion` to odcisk KANDYDATA, nawet gdy wskazano starą kartę (`:112`).
      expect(mutacje.find((m) => m.url.includes("/choose-absence-card"))!.body).toEqual({
        selectedCode: "MO5_STARY",
        candidateVersion: "v-nowy",
      });
    });

    it("różny DOT: żadnego wyboru nie da się dokonać, a notatka to tłumaczy", async () => {
      const kandydat = przegladStarejKarty().candidates[0]!;
      zamockuj({
        strona: stronaZFraza(FRAZY.staraKarta),
        przeglad: przegladStarejKarty({
          candidates: [
            { ...kandydat, dot: "1923", catalogDot: "1923", selectable: false, sameDot: false },
          ],
        }),
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("notatka-wyboru")).toHaveTextContent(
        "Różny DOT oznacza inną oponę. W tym przypadku nie wybieraj jednej karty: system powinien pozostawić je osobno i usunąć błędne zgłoszenie po następnym odczycie oferty.",
      );
      expect(within(okno).getByTestId("karta-kandydat-MO5_NOWY")).toHaveTextContent(
        "DOT: RÓŻNY — nie łączyć",
      );
      expect(within(okno).getByTestId("radio-karta-MO5_NOWY")).toBeDisabled();
      expect(within(okno).getByTestId("radio-karta-MO5_STARY")).toBeDisabled();
      expect(within(okno).getByTestId("button-zapisz-wybor-karty")).toBeDisabled();
    });

    it("brak świeżego odczytu: notatka każe wczytać cennik, stara karta niedostępna", async () => {
      const kandydat = przegladStarejKarty().candidates[0]!;
      zamockuj({
        strona: stronaZFraza(FRAZY.staraKarta),
        przeglad: przegladStarejKarty({
          candidates: [
            {
              ...kandydat,
              sourceKey: null,
              stan: null,
              cenaZakupu: null,
              status: "wstrzymany",
              catalogStan: 0,
            },
          ],
        }),
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("notatka-wyboru")).toHaveTextContent(
        "Przed wyborem starej karty wczytaj ponownie cennik, żeby potwierdzić bieżącą cenę i liczbę opon.",
      );
      expect(within(okno).getByTestId("radio-karta-MO5_STARY")).toBeDisabled();
      expect(within(okno).getByTestId("radio-karta-MO5_NOWY")).toBeDisabled();
    });

    it("NIE MA przycisku „Pozostaw starą wstrzymaną i zamknij sprawę” (D1)", async () => {
      /*
        Produkcja usunęła ten przycisk łatką `20260923_dotchoice` (23.09 12:31) — dowód:
        `git diff 58d9d1d 88fa31c -- mirror/frontend/assets/staging-policy-injection.js`.
        Trasa `close-absence-review` zostaje w backendzie nieużywana. Test pilnuje, żeby
        nikt jej nie „przywrócił” z nieaktualnego opisu karty.
      */
      zamockuj({ strona: stronaZFraza(FRAZY.staraKarta), przeglad: przegladStarejKarty() });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(
        within(okno).queryByText(/Pozostaw starą wstrzymaną i zamknij sprawę/),
      ).not.toBeInTheDocument();
      expect(mutacje.some((m) => m.url.includes("/close-absence-review"))).toBe(false);
    });
  });

  describe("Gałąź „sprzeczne wiersze w jednym pliku” (odstępstwo: połącz / rozdziel)", () => {
    it("pokazuje różnice, oba wiersze i dwa przyciski decyzji", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.plik), przeglad: przegladSprzecznychWierszy() });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(
        within(okno).getByText(
          "W bieżącym pliku są dwa wiersze przypisane do jednej karty, ale ich dane się różnią. To NIE oznacza automatycznie, że EAN jest inny.",
        ),
      ).toBeInTheDocument();
      const roznice = within(okno).getAllByTestId("roznica-pola").map((e) => e.textContent);
      expect(roznice).toEqual([
        "EAN: 8903094020614 → 8903094020621",
        "Cena zakupu: 1850 → 1910",
        "Stan: 13 → 1",
      ]);

      const pierwszy = within(okno).getByTestId("karta-wiersz-pierwszy");
      expect(pierwszy).toHaveTextContent("Pierwszy wiersz");
      expect(pierwszy).toHaveTextContent("Kod w pliku: 520196");
      expect(pierwszy).toHaveTextContent("EAN: 8903094020614 · DOT: 2124");
      expect(pierwszy).toHaveTextContent("Cena zakupu: 1850 · Stan: 13");

      const drugi = within(okno).getByTestId("karta-wiersz-drugi");
      expect(drugi).toHaveTextContent("Drugi wiersz");
      expect(drugi).toHaveTextContent("Kod w pliku: 520197");
      expect(drugi).toHaveTextContent("Cena zakupu: 1910 · Stan: 1");

      expect(within(okno).getByText(/Produkt trafia od razu do katalogu\./)).toBeInTheDocument();
      expect(within(okno).getByTestId("button-polacz-wiersze")).toHaveTextContent(
        "Połącz w jeden produkt",
      );
      expect(within(okno).getByTestId("button-rozdziel-wiersze")).toHaveTextContent(
        "Rozdziel na dwa osobne produkty",
      );
      expect(within(okno).queryByTestId("button-zapisz-wybor")).not.toBeInTheDocument();
      expect(within(okno).getByTestId("button-zamknij-rozstrzygniecie")).toBeInTheDocument();
    });

    it.each([
      ["button-polacz-wiersze", "merge"],
      ["button-rozdziel-wiersze", "split"],
    ])("%s wysyła `{decision: %s}` i zamyka okno", async (przycisk, decyzja) => {
      zamockuj({ strona: stronaZFraza(FRAZY.plik), przeglad: przegladSprzecznychWierszy() });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      await uzytkownik.click(within(okno).getByTestId(przycisk));

      await waitFor(() =>
        expect(mutacje.some((m) => m.url.includes("/resolve-source-conflict"))).toBe(true),
      );
      const zapis = mutacje.find((m) => m.url.includes("/resolve-source-conflict"))!;
      expect(zapis.url).toContain("/api/staging/710001/resolve-source-conflict");
      expect(zapis.body).toEqual({ decision: decyzja });
      await waitFor(() =>
        expect(screen.queryByTestId("dialog-rozstrzygniecie")).not.toBeInTheDocument(),
      );
    });

    it("starsze zgłoszenie bez porównania wierszy mówi, żeby wczytać cennik", async () => {
      zamockuj({
        strona: stronaZFraza(FRAZY.plik),
        przeglad: przegladSprzecznychWierszy({ sourceConflict: null }),
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(within(okno).getByTestId("brak-porownania-wierszy")).toHaveTextContent(
        "To starsze zgłoszenie nie zawiera porównania wierszy. Wczytaj ponownie aktualny cennik, aby zobaczyć dokładne różnice.",
      );
      expect(within(okno).queryByTestId("button-polacz-wiersze")).not.toBeInTheDocument();
      expect(within(okno).queryByTestId("button-rozdziel-wiersze")).not.toBeInTheDocument();
    });
  });

  describe("Błędy", () => {
    it("blokada zapisu decyzji pokazuje komunikat W OKNIE i odblokowuje przyciski", async () => {
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        przeglad: przegladDopasowania(),
        bladRozstrzygniecia: {
          status: 409,
          cialo: { message: "Wybierz produkt z listy kandydatów tego dostawcy." },
        },
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      await uzytkownik.click(within(okno).getByTestId("radio-dopasowanie-MO5_A"));
      await uzytkownik.click(within(okno).getByTestId("button-zapisz-wybor"));

      expect(await within(okno).findByTestId("blad-decyzji")).toHaveTextContent(
        "Wybierz produkt z listy kandydatów tego dostawcy.",
      );
      // Okno zostaje otwarte — oryginał nie pokazuje tu „Nie zapisano zmian” (`:132`).
      expect(screen.getByTestId("dialog-rozstrzygniecie")).toBeInTheDocument();
      expect(screen.queryByTestId("dialog-blokada-akceptacji")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(within(okno).getByTestId("button-zapisz-wybor")).toBeEnabled(),
      );
    });

    it("błąd wczytania `review` pokazuje treść z serwera zamiast zawartości okna", async () => {
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        bladPrzegladu: {
          status: 404,
          cialo: { message: "Zgłoszenie zostało zastąpione. Odśwież staging." },
        },
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();
      const okno = await otworzOkno(uzytkownik);

      expect(await within(okno).findByTestId("blad-wczytania")).toHaveTextContent(
        "Zgłoszenie zostało zastąpione. Odśwież staging.",
      );
      expect(within(okno).queryByTestId("opis-sprawy")).not.toBeInTheDocument();
    });
  });

  describe("Okno „Nie zapisano zmian” (blokada akceptacji)", () => {
    /** Wszystkie sześć komunikatów `checkAcceptance` — `import/polityka/blokady.ts`. */
    const BLOKADY = [
      "Zgłoszenie zostało już zastąpione lub usunięte. Odśwież staging.",
      "Ta stara karta wymaga porównania z bieżącą ofertą. Nie można automatycznie zmienić jej w inną oponę ani wstrzymać.",
      "Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik.",
      "To zgłoszenie pochodzi ze starego importu. Odśwież cennik przed akceptacją.",
      "Najpierw rozstrzygnij dopasowanie opony przyciskiem „Rozstrzygnij”.",
      "Produkt zmienił się po utworzeniu zgłoszenia. Wczytaj aktualny cennik; stare dane nie zostały zapisane.",
    ];

    it.each(BLOKADY)("pokazuje komunikat 409 DOSŁOWNIE: %s", async (komunikat) => {
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        bladAkceptacji: { status: 409, cialo: { message: komunikat } },
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-accept-selected"));

      const okno = await screen.findByTestId("dialog-blokada-akceptacji");
      expect(okno).toHaveTextContent("Nie zapisano zmian");
      expect(within(okno).getByTestId("tresc-blokady")).toHaveTextContent(komunikat);
      expect(within(okno).getByTestId("button-zamknij-blokade")).toBeInTheDocument();
    });

    it("409 bez `message` daje tekst zapasowy z oryginału", async () => {
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        bladAkceptacji: { status: 409, cialo: {} },
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-accept-selected"));

      expect(await screen.findByTestId("tresc-blokady")).toHaveTextContent(
        "Odśwież staging i spróbuj ponownie.",
      );
    });

    it("czyta też `error`, gdy ciało ma tamten kształt", async () => {
      // Trasy polityki oddają `{message}`, ale `staging-mutacje.ts` w innych ścieżkach
      // używa `{error}` — oryginał czyta `v.message || v.error` i tak zostaje.
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        bladAkceptacji: { status: 500, cialo: { error: "Coś się zepsuło po stronie serwera" } },
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-accept-selected"));

      expect(await screen.findByTestId("tresc-blokady")).toHaveTextContent(
        "Coś się zepsuło po stronie serwera",
      );
    });

    it("„Akceptuj wszystkie” też trafia do okna blokady", async () => {
      zamockuj({
        strona: stronaZFraza(FRAZY.dopasowanie),
        bladAkceptacji: { status: 409, cialo: { message: BLOKADY[4] } },
      });
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-accept-all"));
      const potwierdzenie = await screen.findByTestId("dialog-akceptuj-wszystkie");
      await uzytkownik.click(within(potwierdzenie).getByTestId("button-potwierdz"));

      expect(await screen.findByTestId("tresc-blokady")).toHaveTextContent(BLOKADY[4]!);
    });

    it("błąd ODRZUCANIA zostaje w pasku, nie otwiera okna (jak w produkcji)", async () => {
      zamockuj({ strona: stronaZFraza(FRAZY.dopasowanie) });
      // Nadpisujemy WYŁĄCZNIE `reject` — nakładka oryginału filtruje po URL-u `accept`
      // (`:35`), więc odrzucanie ma zostać przy dotychczasowym pasku komunikatu.
      server.use(
        http.post("*/api/staging/reject", () =>
          HttpResponse.json({ error: "nie udało się" }, { status: 500 }),
        ),
      );
      const uzytkownik = userEvent.setup();
      await otworzStaging();

      await uzytkownik.click(screen.getByTestId("button-reject-selected"));

      await waitFor(() =>
        expect(screen.getByTestId("komunikat-akcji")).toHaveTextContent(/^Błąd:/),
      );
      expect(screen.queryByTestId("dialog-blokada-akceptacji")).not.toBeInTheDocument();
    });
  });
});
