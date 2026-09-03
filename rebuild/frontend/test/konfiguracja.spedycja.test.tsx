/**
 * Zakładka „Spedycja" (`/konfiguracja`) — Iteracja 11.
 *
 * Dane z `contract/fixtures/GET_spedycja.json` i `GET_suppliers.json`: widok sprawdzamy
 * przeciwko kształtowi, który realnie oddaje produkcja.
 *
 * Zakres: że tabela iteruje po DOSTAWCACH (dostawca bez limitu ma pusty wiersz, a nie
 * znika), że przycisk „Zapisz" pojawia się dopiero po zmianie, że zapis leci
 * `POST /api/spedycja` ze scalonym wierszem, że pusty próg jedzie jako `null` (a nie `0`
 * ani `""`), i że BŁĄD ZAPISU JEST WIDOCZNY.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import {
  dostawcyZFixtura,
  konfiguracjaZFixtura,
  spedycjaZFixtura,
  TOKEN_TESTOWY,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const KONFIGURACJA = konfiguracjaZFixtura();
const DOSTAWCY = dostawcyZFixtura() as unknown as { kod: string; nazwa: string }[];
const SPEDYCJA = spedycjaZFixtura();

/** Dostawca, który MA limit w nagraniu — na nim sprawdzamy wypełnienie pól. */
const Z_LIMITEM = SPEDYCJA.find((s) => s.progNetto !== null)!;
/** Dostawca z nagrania, który progu NIE ma — pole progu musi być puste. */
const BEZ_PROGU = SPEDYCJA.find((s) => s.progNetto === null)!;
/**
 * Dostawca z fixtura dostawców, dla którego nie ma ŻADNEGO wiersza spedycji — w nagraniu
 * jest to MO10 (`GET_suppliers.json` ma MO1, MO10, MO2–MO4; `GET_spedycja.json` MO1–MO5).
 * Ten rozjazd między fixture'ami jest tu użyteczny: pokazuje, że tabela iteruje po
 * dostawcach, a nie po limitach. `!` jest świadome — gdyby nagranie się zmieniło i taki
 * dostawca zniknął, test ma się wywalić, a nie po cichu przestać cokolwiek sprawdzać.
 */
const BEZ_LIMITU = DOSTAWCY.find((d) => !SPEDYCJA.some((s) => s.dostawcaKod === d.kod))!;

let zapisy: Record<string, unknown>[] = [];

function zamockujApi(odpowiedzZapisu: () => Response = () => HttpResponse.json({ ok: true })) {
  server.use(
    http.get("*/api/dostawcy", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/config", () => HttpResponse.json(KONFIGURACJA)),
    http.get("*/api/spedycja", () => HttpResponse.json(SPEDYCJA)),
    http.post("*/api/spedycja", async ({ request }) => {
      zapisy.push((await request.json()) as Record<string, unknown>);
      return odpowiedzZapisu();
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzSpedycje() {
  window.history.pushState({}, "", "/konfiguracja");
  render(<App />);
  // Ekran otwiera się na „dostawcy" (`defaultValue`, jak oryginał) — trzeba kliknąć.
  await screen.findByTestId("tab-spedycja");
  await userEvent.click(screen.getByTestId("tab-spedycja"));
  return await screen.findByTestId(`row-sped-${Z_LIMITEM.dostawcaKod}`);
}

describe("Zakładka „Spedycja”", () => {
  beforeEach(() => {
    zapisy = [];
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  describe("tabela", () => {
    it("pokazuje wiersz dla KAŻDEGO dostawcy, także bez limitu w spedycji", async () => {
      await otworzSpedycje();

      for (const d of DOSTAWCY) {
        expect(screen.getByTestId(`row-sped-${d.kod}`)).toBeInTheDocument();
      }
    });

    it("wypełnia pola wartościami z nagrania produkcji", async () => {
      const wiersz = await otworzSpedycje();
      const wWierszu = within(wiersz);

      expect(wWierszu.getByTestId(`input-sped-prog-${Z_LIMITEM.dostawcaKod}`)).toHaveValue(
        Z_LIMITEM.progNetto,
      );
      expect(wWierszu.getByTestId(`input-sped-pon-${Z_LIMITEM.dostawcaKod}`)).toHaveValue(
        Z_LIMITEM.kosztPonizej,
      );
      expect(wWierszu.getByTestId(`input-sped-reguly-${Z_LIMITEM.dostawcaKod}`)).toHaveValue(
        Z_LIMITEM.dodatkoweReguly,
      );
    });

    it("dostawca bez progu ma PUSTE pole progu, nie zero", async () => {
      // `progNetto: null` znaczy „brak progu". Pokazanie tam `0` mówiłoby coś innego:
      // że próg jest i wynosi zero złotych.
      await otworzSpedycje();

      expect(screen.getByTestId(`input-sped-prog-${BEZ_PROGU.dostawcaKod}`)).toHaveValue(null);
    });

    it("dostawca bez żadnego wiersza spedycji ma cały wiersz pusty", async () => {
      expect(BEZ_LIMITU).toBeDefined();
      await otworzSpedycje();

      expect(screen.getByTestId(`input-sped-prog-${BEZ_LIMITU.kod}`)).toHaveValue(null);
      expect(screen.getByTestId(`input-sped-reguly-${BEZ_LIMITU.kod}`)).toHaveValue("");
    });
  });

  describe("zapis", () => {
    it("przycisk „Zapisz” pojawia się dopiero po zmianie w wierszu", async () => {
      await otworzSpedycje();

      expect(
        screen.queryByTestId(`button-sped-save-${Z_LIMITEM.dostawcaKod}`),
      ).not.toBeInTheDocument();

      await userEvent.type(
        screen.getByTestId(`input-sped-reguly-${Z_LIMITEM.dostawcaKod}`),
        " test",
      );

      expect(screen.getByTestId(`button-sped-save-${Z_LIMITEM.dostawcaKod}`)).toBeInTheDocument();
      // …i tylko w TYM wierszu.
      expect(
        screen.queryByTestId(`button-sped-save-${BEZ_PROGU.dostawcaKod}`),
      ).not.toBeInTheDocument();
    });

    it("wysyła POST /api/spedycja ze scalonym wierszem i kodem dostawcy", async () => {
      await otworzSpedycje();

      const prog = screen.getByTestId(`input-sped-prog-${Z_LIMITEM.dostawcaKod}`);
      await userEvent.clear(prog);
      await userEvent.type(prog, "2500");
      await userEvent.click(screen.getByTestId(`button-sped-save-${Z_LIMITEM.dostawcaKod}`));

      await waitFor(() => expect(zapisy).toHaveLength(1));
      expect(zapisy[0]).toEqual({
        dostawcaKod: Z_LIMITEM.dostawcaKod,
        progNetto: 2500,
        // Pola nietknięte lecą z wartościami z backendu — upsert nie ma ich wyzerować.
        kosztPonizej: Z_LIMITEM.kosztPonizej,
        kosztPowyzej: Z_LIMITEM.kosztPowyzej,
        dodatkoweReguly: Z_LIMITEM.dodatkoweReguly,
      });
      // `id` to tożsamość wiersza — nie ma prawa wyjść z przeglądarki.
      expect(zapisy[0]).not.toHaveProperty("id");
    });

    it("wyczyszczony próg jedzie jako null, nie 0 ani pusty tekst", async () => {
      await otworzSpedycje();

      await userEvent.clear(screen.getByTestId(`input-sped-prog-${Z_LIMITEM.dostawcaKod}`));
      await userEvent.click(screen.getByTestId(`button-sped-save-${Z_LIMITEM.dostawcaKod}`));

      await waitFor(() => expect(zapisy).toHaveLength(1));
      expect(zapisy[0]!.progNetto).toBeNull();
    });

    it("po udanym zapisie przycisk znika, a komunikat potwierdza dostawcę", async () => {
      await otworzSpedycje();

      await userEvent.type(
        screen.getByTestId(`input-sped-reguly-${Z_LIMITEM.dostawcaKod}`),
        " x",
      );
      await userEvent.click(screen.getByTestId(`button-sped-save-${Z_LIMITEM.dostawcaKod}`));

      expect(await screen.findByTestId("komunikat-spedycja")).toHaveTextContent(
        Z_LIMITEM.dostawcaKod,
      );
      await waitFor(() =>
        expect(
          screen.queryByTestId(`button-sped-save-${Z_LIMITEM.dostawcaKod}`),
        ).not.toBeInTheDocument(),
      );
    });

    it("BŁĄD ZAPISU JEST WIDOCZNY, a zmiana zostaje w polu", async () => {
      // Bez tego nieudany zapis wyglądałby jak udany — a limity spedycyjne wchodzą
      // wprost w cenę, którą Ania podaje klientowi.
      zamockujApi(() => new HttpResponse("Baza tylko do odczytu", { status: 500 }));
      await otworzSpedycje();

      await userEvent.type(
        screen.getByTestId(`input-sped-reguly-${Z_LIMITEM.dostawcaKod}`),
        " x",
      );
      await userEvent.click(screen.getByTestId(`button-sped-save-${Z_LIMITEM.dostawcaKod}`));

      const komunikat = await screen.findByTestId("komunikat-spedycja");
      expect(komunikat).toHaveTextContent(/Błąd zapisu/);
      // Zmiana nie może wyparować — inaczej Ania straciłaby to, co wpisała.
      expect(screen.getByTestId(`button-sped-save-${Z_LIMITEM.dostawcaKod}`)).toBeInTheDocument();
    });
  });
});
