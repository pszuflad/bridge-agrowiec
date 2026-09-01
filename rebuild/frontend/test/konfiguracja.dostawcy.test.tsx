/**
 * Zakładka „Dostawcy" (`/konfiguracja`) — blok 3f-2.
 *
 * Dane z fixture'a `contract/fixtures/GET_suppliers.json`, jak w I2, 3e i 3f-1: widok
 * sprawdzamy przeciwko kształtowi, który realnie oddaje produkcja.
 *
 * Zakres: że karta pokazuje URL, częstotliwość, sposób dostarczania, status i znacznik
 * ostatniej próby; że „Synchronizuj teraz" woła właściwy adres; że AWARIA jest WIDOCZNA
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

let synchronizacje: string[] = [];
let patche: { url: string; cialo: Record<string, unknown> }[] = [];

function zamockujApi(
  odpowiedzSync: () => Response = () => HttpResponse.json({ ok: true, liczbaProduktow: 657 }),
) {
  server.use(
    http.get("*/api/dostawcy", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    http.post("*/api/dostawcy/:kod/synchronizuj-teraz", ({ params }) => {
      synchronizacje.push(String(params.kod));
      return odpowiedzSync();
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

    it("„Synchronizuj teraz” jest TYLKO przy dostawcach `url` (jak w oryginale)", async () => {
      await otworzDostawcow();
      expect(screen.getByTestId(`button-sync-${Z_URL.kod}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`button-sync-${Z_MAILA.kod}`)).not.toBeInTheDocument();
    });
  });

  describe("„Synchronizuj teraz”", () => {
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

      await userEvent.clear(screen.getByTestId(`input-freq-${Z_URL.kod}`));
      await userEvent.click(screen.getByTestId(`button-save-${Z_URL.kod}`));

      await waitFor(() => expect(patche).toHaveLength(1));
      expect(patche[0]!.cialo.czestotliwoscMinuty).toBeNull();
    });

    it("odrzuca częstotliwość poniżej 1 minuty BEZ wysyłania żądania", async () => {
      const karta = await otworzDostawcow();
      await userEvent.click(within(karta).getByTestId(`button-edit-${Z_URL.kod}`));

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
});
