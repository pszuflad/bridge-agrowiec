/**
 * Zakładka „Dostawcy" (`/konfiguracja`) — blok 3f-2.
 *
 * Dane z fixture'a `contract/fixtures/GET_suppliers.json`, jak w I2, 3e i 3f-1: widok
 * sprawdzamy przeciwko kształtowi, który realnie oddaje produkcja.
 *
 * Zakres: że karta pokazuje URL, częstotliwość, sposób dostarczania, status i znacznik
 * ostatniej próby; że „Synchronizuj" woła właściwy adres; że AWARIA jest WIDOCZNA
 * (200 z `ok: false` to nie jest sukces); że zmiana częstotliwości leci PATCH-em po
 * NUMERYCZNYM `id` — czyli że `freq-injection.js` jest już niepotrzebny.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { formatujCzestotliwosc, PRESETY_CZESTOTLIWOSCI } from "@/pages/konfiguracja/dostawcy";
import { dostawcyZFixtura, TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const DOSTAWCY = dostawcyZFixtura() as unknown as {
  id: number;
  kod: string;
  nazwa: string;
  url: string | null;
  czestotliwoscMinuty: number | null;
  sposobDostarczania: string;
  status: string;
}[];

/** Pierwszy dostawca `url` z fixtura — na nim testujemy synchronizację. */
const Z_URL = DOSTAWCY.find((d) => d.sposobDostarczania === "url")!;
/** Pierwszy dostawca `mail` — nie ma mieć przycisku synchronizacji. */
const Z_MAILA = DOSTAWCY.find((d) => d.sposobDostarczania === "mail")!;

/** Pierwszy dostawca BEZ harmonogramu — na nim sprawdzamy wariant `czestotliwoscMinuty: null`. */
const BEZ_HARMONOGRAMU = DOSTAWCY.find((d) => d.czestotliwoscMinuty === null)!;

let synchronizacje: string[] = [];
let patche: { url: string; cialo: Record<string, unknown> }[] = [];
/** Żądania uploadu z karty: adres + nazwa pola i treść pliku — na nich sprawdzamy multipart. */
let uploady: { url: string; nazwaPola: string | null; trescPliku: string | null }[] = [];

/**
 * Kształt odpowiedzi 1:1 z `rebuild/backend/src/routes/suppliers.ts` — pola `nowe`/`zmienione`,
 * a NIE `nowych`/`zmian`, których trasa nigdy nie zwracała. To jest wyrocznia dla toasta.
 */
const ODPOWIEDZ_UPLOADU = {
  ok: true,
  nazwaPliku: "cennik.csv",
  liczbaProduktow: 657,
  doStagingu: 20,
  nowe: 12,
  zmienione: 8,
  wycofane: 3,
  bezZmian: 634,
  autoZatwierdzone: 5,
  podglad: [],
};

function zamockujApi(
  odpowiedzSync: () => Response = () => HttpResponse.json({ ok: true, liczbaProduktow: 657 }),
  odpowiedzUpload: () => Response = () => HttpResponse.json(ODPOWIEDZ_UPLOADU),
  dostawcy: unknown[] = DOSTAWCY,
) {
  server.use(
    http.get("*/api/dostawcy", () => HttpResponse.json(dostawcy)),
    http.get("*/api/suppliers", () => HttpResponse.json(dostawcy)),
    http.post("*/api/dostawcy/:kod/synchronizuj-teraz", ({ params }) => {
      synchronizacje.push(String(params.kod));
      return odpowiedzSync();
    }),
    http.post("*/api/dostawcy/:kod/upload", async ({ request }) => {
      // `formData()` rozbiera multipart — gdyby karta wysłała JSON-a, ten odczyt by padł.
      // To jest właściwa asercja, mocniejsza niż samo sprawdzenie adresu.
      const dane = await request.formData();
      /*
       * Treść czytamy przez kaczkę (`.text`), a nie przez `instanceof File`: jsdom gubi
       * `filename` przy przejściu FormData przez warstwę fetch i pole przychodzi jako „blob",
       * więc `instanceof File` testowałoby środowisko, a nie nasz kod. Ten sam wybór i to samo
       * uzasadnienie co w `konfiguracja.test.tsx`.
       */
      const plik = dane.get("plik") as { text?: () => Promise<string> } | null;
      uploady.push({
        url: request.url,
        nazwaPola: plik === null ? null : "plik",
        trescPliku: typeof plik?.text === "function" ? await plik.text() : null,
      });
      return odpowiedzUpload();
    }),
    http.patch("*/api/dostawcy/:id", async ({ request, params }) => {
      const cialo = (await request.json()) as Record<string, unknown>;
      patche.push({ url: String(params.id), cialo });
      const zrodlo = DOSTAWCY.find((d) => String(d.id) === String(params.id))!;
      return HttpResponse.json({ ...zrodlo, ...cialo });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

/** Ekran otwiera się na „dostawcy" (`defaultValue`, jak oryginał) — bez klikania w zakładkę. */
async function otworzDostawcow() {
  window.history.pushState({}, "", "/konfiguracja");
  render(<App />);
  return await screen.findByTestId(`supplier-config-${Z_URL.kod}`);
}

describe("Zakładka „Dostawcy”", () => {
  beforeEach(() => {
    synchronizacje = [];
    patche = [];
    uploady = [];
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  describe("lista", () => {
    it("pokazuje kartę każdego dostawcy z fixtura", async () => {
      await otworzDostawcow();
      for (const d of DOSTAWCY) {
        expect(screen.getByTestId(`supplier-config-${d.kod}`)).toBeInTheDocument();
      }
    });

    it("karta ma URL, sposób dostarczania, częstotliwość, status i znacznik ostatniej próby", async () => {
      const karta = await otworzDostawcow();
      const wKarcie = within(karta);

      expect(wKarcie.getByText(Z_URL.nazwa)).toBeInTheDocument();
      expect(wKarcie.getByRole("link", { name: Z_URL.url! })).toHaveAttribute("href", Z_URL.url);
      expect(wKarcie.getByText(Z_URL.sposobDostarczania)).toBeInTheDocument();
      expect(wKarcie.getByTestId(`freq-${Z_URL.kod}`)).toHaveTextContent(
        `co ${formatujCzestotliwosc(Z_URL.czestotliwoscMinuty!)}`,
      );
      // `ostatniaSync` mówi „kiedy próbowaliśmy", bo backend ustawia ją także po awarii.
      expect(wKarcie.getByTestId(`sync-${Z_URL.kod}`)).toHaveTextContent("ostatnia próba:");
    });

    it("„Synchronizuj” jest TYLKO przy dostawcach `url` (jak w oryginale)", async () => {
      await otworzDostawcow();
      expect(screen.getByTestId(`button-sync-${Z_URL.kod}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`button-sync-${Z_MAILA.kod}`)).not.toBeInTheDocument();
    });
  });

  describe("„Synchronizuj”", () => {
    it("woła trasę właściwego dostawcy i pokazuje wynik", async () => {
      await otworzDostawcow();

      await userEvent.click(screen.getByTestId(`button-sync-${Z_URL.kod}`));

      await waitFor(() => expect(synchronizacje).toEqual([Z_URL.kod]));
      expect(await screen.findByTestId(`komunikat-${Z_URL.kod}`)).toHaveTextContent(
        "Pobrano 657 produktów",
      );
    });

    it("GATE: awaria (200 z `ok: false`) JEST WIDOCZNA, a nie cicha", async () => {
      zamockujApi(() => HttpResponse.json({ ok: false, error: "HTTP 500" }));
      await otworzDostawcow();

      await userEvent.click(screen.getByTestId(`button-sync-${Z_URL.kod}`));

      const komunikat = await screen.findByTestId(`komunikat-${Z_URL.kod}`);
      expect(komunikat).toHaveTextContent("Błąd synchronizacji: HTTP 500");
      // Kod HTTP był 200 — gdyby widok patrzył tylko na niego, awaria zniknęłaby bez śladu.
    });
  });

  describe("edycja pól — wchłonięty `freq-injection.js`", () => {
    it("presety częstotliwości są te same co w skrypcie Ani", async () => {
      const karta = await otworzDostawcow();
      await userEvent.click(within(karta).getByTestId(`button-edit-${Z_URL.kod}`));

      const select = await screen.findByTestId(`select-freq-${Z_URL.kod}`);
      const wartosci = Array.from(select.querySelectorAll("option")).map((o) => o.value);
      expect(wartosci).toEqual([...PRESETY_CZESTOTLIWOSCI.map(String), "inna"]);
    });

    it("GATE: zmiana częstotliwości leci PATCH-em po NUMERYCZNYM `id`", async () => {
      const karta = await otworzDostawcow();
      await userEvent.click(within(karta).getByTestId(`button-edit-${Z_URL.kod}`));

      await userEvent.selectOptions(screen.getByTestId(`select-freq-${Z_URL.kod}`), "240");
      await userEvent.click(screen.getByTestId(`button-save-${Z_URL.kod}`));

      await waitFor(() => expect(patche).toHaveLength(1));
      // Skrypt trzymał własną mapę kod → id, bo pracował na DOM-ie. Tu id jest w rekordzie.
      expect(patche[0]!.url).toBe(String(Z_URL.id));
      expect(patche[0]!.cialo.czestotliwoscMinuty).toBe(240);
    });

    it("pozwala wpisać wartość spoza presetów", async () => {
      const karta = await otworzDostawcow();
      await userEvent.click(within(karta).getByTestId(`button-edit-${Z_URL.kod}`));

      // Pole minut jest za furtką „Inna wartość" — jak w `freq-injection.js:138-147`.
      await userEvent.selectOptions(screen.getByTestId(`select-freq-${Z_URL.kod}`), "inna");
      const pole = screen.getByTestId(`input-freq-${Z_URL.kod}`);
      await userEvent.clear(pole);
      await userEvent.type(pole, "45");
      await userEvent.click(screen.getByTestId(`button-save-${Z_URL.kod}`));

      await waitFor(() => expect(patche).toHaveLength(1));
      expect(patche[0]!.cialo.czestotliwoscMinuty).toBe(45);
    });

    it("puste pole częstotliwości = brak harmonogramu (`null`), a nie 0", async () => {
      const karta = await otworzDostawcow();
      await userEvent.click(within(karta).getByTestId(`button-edit-${Z_URL.kod}`));

      await userEvent.selectOptions(screen.getByTestId(`select-freq-${Z_URL.kod}`), "inna");
      await userEvent.clear(screen.getByTestId(`input-freq-${Z_URL.kod}`));
      await userEvent.click(screen.getByTestId(`button-save-${Z_URL.kod}`));

      await waitFor(() => expect(patche).toHaveLength(1));
      expect(patche[0]!.cialo.czestotliwoscMinuty).toBeNull();
    });

    it("odrzuca częstotliwość poniżej 1 minuty BEZ wysyłania żądania", async () => {
      const karta = await otworzDostawcow();
      await userEvent.click(within(karta).getByTestId(`button-edit-${Z_URL.kod}`));

      await userEvent.selectOptions(screen.getByTestId(`select-freq-${Z_URL.kod}`), "inna");
      const pole = screen.getByTestId(`input-freq-${Z_URL.kod}`);
      await userEvent.clear(pole);
      await userEvent.type(pole, "0");
      await userEvent.click(screen.getByTestId(`button-save-${Z_URL.kod}`));

      expect(await screen.findByTestId(`komunikat-${Z_URL.kod}`)).toHaveTextContent(
        "Częstotliwość musi być liczbą minut ≥ 1",
      );
      expect(patche).toHaveLength(0);
    });

    it("zapisuje też URL, sposób dostarczania i status", async () => {
      const karta = await otworzDostawcow();
      await userEvent.click(within(karta).getByTestId(`button-edit-${Z_URL.kod}`));

      const pole = screen.getByTestId(`input-url-${Z_URL.kod}`);
      await userEvent.clear(pole);
      await userEvent.type(pole, "https://nowy.test/cennik.csv");
      await userEvent.selectOptions(screen.getByTestId(`select-sposob-${Z_URL.kod}`), "mail");
      await userEvent.selectOptions(screen.getByTestId(`select-status-${Z_URL.kod}`), "wstrzymany");
      await userEvent.click(screen.getByTestId(`button-save-${Z_URL.kod}`));

      await waitFor(() => expect(patche).toHaveLength(1));
      expect(patche[0]!.cialo).toMatchObject({
        url: "https://nowy.test/cennik.csv",
        sposobDostarczania: "mail",
        status: "wstrzymany",
      });
    });

    /**
     * Uwaga Ani z §10 testów I3: „w nowym jest wartość w minutach, w starym lista wyboru".
     * Oryginał (`freq-injection.js:138-147`) trzyma pole minut schowane i odsłania je dopiero
     * opcją „custom" — i to jest reguła, do której wracamy.
     */
    it("pole minut jest UKRYTE przy presecie i odsłania się dopiero po „Inna wartość”", async () => {
      const karta = await otworzDostawcow();
      await userEvent.click(within(karta).getByTestId(`button-edit-${Z_URL.kod}`));

      // MO2 ma 60 minut, czyli preset — select pokazuje preset, pola minut nie ma.
      expect(screen.getByTestId(`select-freq-${Z_URL.kod}`)).toHaveValue(
        String(Z_URL.czestotliwoscMinuty),
      );
      expect(screen.queryByTestId(`input-freq-${Z_URL.kod}`)).not.toBeInTheDocument();

      await userEvent.selectOptions(screen.getByTestId(`select-freq-${Z_URL.kod}`), "inna");
      expect(screen.getByTestId(`input-freq-${Z_URL.kod}`)).toBeInTheDocument();

      // Powrót na preset chowa pole z powrotem.
      await userEvent.selectOptions(screen.getByTestId(`select-freq-${Z_URL.kod}`), "240");
      expect(screen.queryByTestId(`input-freq-${Z_URL.kod}`)).not.toBeInTheDocument();
    });

    /**
     * GATE odstępstwa D5. Oryginał dla `czestotliwoscMinuty: null` nie ustawiał `select.value`
     * wcale, więc select zostawał na pierwszej opcji („5 min"). Tu formularz zapisuje CZTERY pola
     * naraz, więc taka wartość początkowa po cichu włączyłaby dostawcy polling co 5 minut przy
     * zapisie czegokolwiek innego. Ten test pilnuje, żeby nikt tego nie „poprawił" z powrotem.
     */
    it("GATE: dostawca BEZ harmonogramu startuje na „Inna wartość” i zapis nie włącza mu pollingu", async () => {
      await otworzDostawcow();
      const karta = screen.getByTestId(`supplier-config-${BEZ_HARMONOGRAMU.kod}`);
      await userEvent.click(within(karta).getByTestId(`button-edit-${BEZ_HARMONOGRAMU.kod}`));

      expect(screen.getByTestId(`select-freq-${BEZ_HARMONOGRAMU.kod}`)).toHaveValue("inna");
      expect(screen.getByTestId(`input-freq-${BEZ_HARMONOGRAMU.kod}`)).toHaveValue(null);

      // Zapis BEZ dotykania częstotliwości — zmieniamy wyłącznie status.
      await userEvent.selectOptions(
        screen.getByTestId(`select-status-${BEZ_HARMONOGRAMU.kod}`),
        "wstrzymany",
      );
      await userEvent.click(screen.getByTestId(`button-save-${BEZ_HARMONOGRAMU.kod}`));

      await waitFor(() => expect(patche).toHaveLength(1));
      expect(patche[0]!.cialo.status).toBe("wstrzymany");
      expect(patche[0]!.cialo.czestotliwoscMinuty).toBeNull();
    });

    it("„Zmień” otwiera i zamyka formularz", async () => {
      const karta = await otworzDostawcow();
      const przycisk = within(karta).getByTestId(`button-edit-${Z_URL.kod}`);

      await userEvent.click(przycisk);
      expect(screen.getByTestId(`edycja-${Z_URL.kod}`)).toBeInTheDocument();

      await userEvent.click(przycisk);
      await waitFor(() =>
        expect(screen.queryByTestId(`edycja-${Z_URL.kod}`)).not.toBeInTheDocument(),
      );
    });
  });

  /**
   * Przycisk „Wgraj plik" na karcie — uwaga Ani z §5 testów I3 („tam, gdzie są dostawcy
   * z wgrywaniem ręcznym, obok powinien być przycisk"). Port `:25756-25802`, zweryfikowany
   * w ŻYWYM bundlu produkcji, nie tylko w deminifikacie z 13.08.
   *
   * ⚠ To jest ścieżka Z KARTY dostawcy, osobna od dialogu zakładki „Wgrywanie ręczne".
   */
  describe("„Wgraj plik” na karcie dostawcy", () => {
    const plik = () =>
      new File(["10000085;8906117626978;CEAT;Opona VF 650\n"], "cennik.csv", { type: "text/csv" });

    it("jest przy dostawcach `mail` i `upload`, a NIE ma go przy `url`", async () => {
      await otworzDostawcow();

      expect(screen.getByTestId(`button-upload-${Z_MAILA.kod}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`button-upload-${Z_URL.kod}`)).not.toBeInTheDocument();
      // Odwrotnie niż synchronizacja, która jest wyłącznie przy `url`.
      expect(screen.queryByTestId(`button-sync-${Z_MAILA.kod}`)).not.toBeInTheDocument();
    });

    /** Fixture nie ma dostawcy `upload`, a warunek oryginału obejmuje OBA sposoby dostarczania. */
    it("jest też przy dostawcy `upload` (wariant nieobecny w fixturze)", async () => {
      zamockujApi(undefined, undefined, [{ ...Z_MAILA, sposobDostarczania: "upload" }]);
      window.history.pushState({}, "", "/konfiguracja");
      render(<App />);

      expect(
        await screen.findByTestId(`button-upload-${Z_MAILA.kod}`),
      ).toBeInTheDocument();
    });

    it("ukryte pole pliku przyjmuje tylko CSV/XML/XLSX, jak oryginał", async () => {
      await otworzDostawcow();
      expect(screen.getByTestId(`input-file-${Z_MAILA.kod}`)).toHaveAttribute(
        "accept",
        ".csv,.xml,.xlsx",
      );
    });

    it("GATE: wysyła multipart z polem `plik` na trasę WŁAŚCIWEGO dostawcy", async () => {
      await otworzDostawcow();

      await userEvent.upload(screen.getByTestId(`input-file-${Z_MAILA.kod}`), plik());

      await waitFor(() => expect(uploady).toHaveLength(1));
      expect(uploady[0]!.url).toContain(`/api/dostawcy/${Z_MAILA.kod}/upload`);
      // Gdyby karta wysłała JSON-a zamiast FormData, `formData()` w handlerze by padło,
      // a nazwa pola nie byłaby `plik` — backend czyta dokładnie tę nazwę.
      expect(uploady[0]!.nazwaPola).toBe("plik");
      expect(uploady[0]!.trescPliku).toBe("10000085;8906117626978;CEAT;Opona VF 650\n");
    });

    /**
     * GATE odstępstwa D1. Oryginał składa ten opis z `o.nowych` i `o.zmian`, a trasa zwraca
     * `nowe` i `zmienione` — produkcja do dziś pokazuje „undefined nowych, undefined zmian".
     * Ten test pilnuje, żeby odbudowa czytała pola, które REALNIE przychodzą.
     */
    it("GATE: toast „Plik wczytany” czyta realne pola odpowiedzi, bez „undefined”", async () => {
      await otworzDostawcow();

      await userEvent.upload(screen.getByTestId(`input-file-${Z_MAILA.kod}`), plik());

      // Szukamy W TOAŚCIE, nie na całym ekranie: karty dostawców też piszą „N produktów".
      const toast = await screen.findByTestId("toast-default");
      expect(within(toast).getByText("Plik wczytany")).toBeInTheDocument();
      expect(toast).toHaveTextContent("657 produktów, 12 nowych, 8 zmienionych");
      expect(toast).not.toHaveTextContent("undefined");
    });

    it("nieudany upload JEST WIDOCZNY — toast błędu z powodem z ciała odpowiedzi", async () => {
      zamockujApi(undefined, () =>
        HttpResponse.json({ error: "Parser MO1 wywrócił się na linii 12" }, { status: 500 }),
      );
      await otworzDostawcow();

      await userEvent.upload(screen.getByTestId(`input-file-${Z_MAILA.kod}`), plik());

      const toast = await screen.findByTestId("toast-destructive");
      expect(within(toast).getByText("Błąd")).toBeInTheDocument();
      // Powód siedzi w ciele — bez tego Ania zobaczyłaby samo „500".
      expect(toast).toHaveTextContent("Parser MO1 wywrócił się na linii 12");
    });

    /**
     * Odstępstwo D6. Oryginał NIE czyści inputa, więc wgranie tego samego pliku drugi raz
     * z rzędu nie wywołuje `onChange` i przycisk wygląda na zepsuty — a Ania realnie poprawia
     * plik u dostawcy i wgrywa go ponownie pod tą samą nazwą.
     */
    it("czyści pole pliku, więc TEN SAM plik da się wgrać drugi raz", async () => {
      await otworzDostawcow();
      const pole = screen.getByTestId(`input-file-${Z_MAILA.kod}`) as HTMLInputElement;

      await userEvent.upload(pole, plik());
      await waitFor(() => expect(uploady).toHaveLength(1));
      expect(pole.value).toBe("");

      await userEvent.upload(pole, plik());
      await waitFor(() => expect(uploady).toHaveLength(2));
    });
  });
});
