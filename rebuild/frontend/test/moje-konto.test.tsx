/**
 * Widok `/moje-konto` — port `lM()` (`deminified/frontend-index.js:27624-27780`).
 *
 * Zakres: że dane konta idą z SESJI (a nie z osobnego żądania), że przycisk odblokowuje się
 * dopiero po spełnieniu wszystkich czterech warunków oryginału, że każdy komunikat inline
 * pokazuje się wtedy, kiedy powinien, że zapis leci `{oldPassword, newPassword}` i że BŁĄD
 * Z SERWERA JEST WIDOCZNY dosłownie (a nie w postaci „401: {…}").
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();

let zapisy: Record<string, unknown>[] = [];

function zamockujApi(odpowiedz: () => Response = () => HttpResponse.json({ ok: true })) {
  server.use(
    http.post("*/api/password/change", async ({ request }) => {
      zapisy.push((await request.json()) as Record<string, unknown>);
      return odpowiedz();
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzKonto() {
  window.history.pushState({}, "", "/moje-konto");
  render(<App />);
  return await screen.findByTestId("input-old-password");
}

/** Wypełnia trzy pola formularza w jednym kroku. */
async function wypelnij(stare: string, nowe: string, powtorz: string) {
  if (stare) await userEvent.type(screen.getByTestId("input-old-password"), stare);
  if (nowe) await userEvent.type(screen.getByTestId("input-new-password"), nowe);
  if (powtorz) await userEvent.type(screen.getByTestId("input-confirm-password"), powtorz);
}

describe("Widok /moje-konto", () => {
  beforeEach(() => {
    zapisy = [];
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  /**
   * ⚠ Karta „Dane konta" NIE wysyła żądania — czyta kontekst sesji, jak oryginał (`tk()`).
   * MSW stoi na `onUnhandledRequest: "error"`, więc gdyby ktoś dołożył tu fetch do
   * `/api/me`, ten test padłby na nieobsłużonym żądaniu. To jest asercja przez konstrukcję.
   */
  it("pokazuje dane konta z sesji, bez dodatkowego żądania", async () => {
    await otworzKonto();

    expect(screen.getByTestId("account-name")).toHaveTextContent(UZYTKOWNIK.imieNazwisko);
    expect(screen.getByTestId("account-email")).toHaveTextContent(UZYTKOWNIK.email);
  });

  it("przycisk jest zablokowany, dopóki formularz nie jest kompletny", async () => {
    await otworzKonto();
    const przycisk = screen.getByTestId("button-submit-change-password");

    expect(przycisk).toBeDisabled();

    await wypelnij("stare-haslo", "nowe-haslo-123", "nowe-haslo-123");
    expect(przycisk).toBeEnabled();
  });

  it("blokuje przycisk bez aktualnego hasła", async () => {
    await otworzKonto();

    await wypelnij("", "nowe-haslo-123", "nowe-haslo-123");

    expect(screen.getByTestId("button-submit-change-password")).toBeDisabled();
  });

  it("pokazuje „Za krótkie.” dla nowego hasła poniżej ośmiu znaków", async () => {
    await otworzKonto();

    await wypelnij("stare-haslo", "krotkie", "krotkie");

    expect(screen.getByText("Za krótkie.")).toBeInTheDocument();
    expect(screen.getByTestId("button-submit-change-password")).toBeDisabled();
  });

  it("pokazuje „Musi być inne niż aktualne.” dla hasła równego staremu", async () => {
    await otworzKonto();

    await wypelnij("dlugie-haslo-123", "dlugie-haslo-123", "dlugie-haslo-123");

    expect(screen.getByText("Musi być inne niż aktualne.")).toBeInTheDocument();
    expect(screen.getByTestId("button-submit-change-password")).toBeDisabled();
  });

  /**
   * ⚠ Kolejność komunikatów z oryginału (`:27738-27744`): „Musi być inne" pojawia się DOPIERO,
   * gdy hasło jest już dość długie. Dla krótkiego hasła równego staremu widać tylko „Za krótkie.”
   */
  it("nie pokazuje obu komunikatów naraz dla krótkiego hasła równego staremu", async () => {
    await otworzKonto();

    await wypelnij("krotkie", "krotkie", "krotkie");

    expect(screen.getByText("Za krótkie.")).toBeInTheDocument();
    expect(screen.queryByText("Musi być inne niż aktualne.")).toBeNull();
  });

  it("pokazuje „Hasła nie są identyczne.” przy rozjeździe powtórzenia", async () => {
    await otworzKonto();

    await wypelnij("stare-haslo", "nowe-haslo-123", "nowe-haslo-999");

    expect(screen.getByText("Hasła nie są identyczne.")).toBeInTheDocument();
    expect(screen.getByTestId("button-submit-change-password")).toBeDisabled();
  });

  it("wysyła {oldPassword, newPassword}, pokazuje toast i czyści pola", async () => {
    await otworzKonto();

    await wypelnij("stare-haslo", "nowe-haslo-123", "nowe-haslo-123");
    await userEvent.click(screen.getByTestId("button-submit-change-password"));

    await waitFor(() => expect(zapisy).toHaveLength(1));
    expect(zapisy[0]).toEqual({ oldPassword: "stare-haslo", newPassword: "nowe-haslo-123" });

    expect(await screen.findByText("Hasło zmienione")).toBeInTheDocument();
    expect(screen.getByText("Twoje hasło zostało zaktualizowane.")).toBeInTheDocument();

    expect(screen.getByTestId("input-old-password")).toHaveValue("");
    expect(screen.getByTestId("input-new-password")).toHaveValue("");
    expect(screen.getByTestId("input-confirm-password")).toHaveValue("");
  });

  /**
   * ⚠ Komunikat serwera musi wyjść DOSŁOWNIE. Gdyby widok użył `zadanie()` z `lib/api`,
   * `rzucGdyBlad` zamieniłby go w `Error('401: {"error":"…"}')` i Ania zobaczyłaby surowy
   * JSON ze statusem zamiast zdania po polsku.
   */
  it("pokazuje komunikat błędu z ciała odpowiedzi, bez statusu i JSON-a", async () => {
    zamockujApi(() =>
      HttpResponse.json(
        { error: "Aktualne hasło jest nieprawidłowe", code: "WRONG_OLD_PASSWORD" },
        { status: 401 },
      ),
    );
    await otworzKonto();

    await wypelnij("zle-haslo", "nowe-haslo-123", "nowe-haslo-123");
    await userEvent.click(screen.getByTestId("button-submit-change-password"));

    expect(await screen.findByText("Nie udało się zmienić hasła")).toBeInTheDocument();
    expect(screen.getByText("Aktualne hasło jest nieprawidłowe")).toBeInTheDocument();
    expect(screen.queryByText(/401:/)).toBeNull();
  });

  it("po nieudanym zapisie zostawia wpisane hasła w polach", async () => {
    zamockujApi(() => HttpResponse.json({ error: "Coś poszło nie tak" }, { status: 400 }));
    await otworzKonto();

    await wypelnij("stare-haslo", "nowe-haslo-123", "nowe-haslo-123");
    await userEvent.click(screen.getByTestId("button-submit-change-password"));

    await screen.findByText("Coś poszło nie tak");
    expect(screen.getByTestId("input-old-password")).toHaveValue("stare-haslo");
  });
});
