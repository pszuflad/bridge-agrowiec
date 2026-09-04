/**
 * Rama aplikacji — `deminified/frontend-index.js:16329-16456`.
 * Sidebar ma 10 POZYCJI nawigacji (router ma 12 tras: dochodzą `/login` i `/moje-konto`,
 * przy czym `/moje-konto` jest linkiem w stopce, a `/login` nie ma w żadnym menu).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import { KLUCZE_STORAGE, zapiszToken } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { POZYCJE_NAWIGACJI } from "@/components/nawigacja";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";
import { handleryPulpitu } from "./msw/pulpit";

const UZYTKOWNIK = uzytkownikZFixtura();

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
  window.history.pushState({}, "", "/");
  // Od bloku 10f `/` to Pulpit, który pobiera pięć tras. Ten plik sprawdza ramę aplikacji,
  // nie treść pulpitu, więc dostaje puste odpowiedzi — bez nich `onUnhandledRequest: "error"`
  // wywaliłby każdy test tego pliku.
  server.use(...handleryPulpitu());
});

describe("sidebar", () => {
  it("ma dokładnie 10 pozycji nawigacji w kolejności z oryginału", () => {
    render(<App />);
    const nawigacja = screen.getByRole("navigation");

    const etykiety = within(nawigacja)
      .getAllByRole("link")
      .map((link) => link.textContent);

    expect(etykiety).toEqual([
      "Pulpit",
      "Staging",
      "Katalog",
      "Narzuty i promocje",
      "Atrybuty",
      "Alerty",
      "Waga gabarytowa",
      "Analityka",
      "Historia",
      "Konfiguracja",
    ]);
    expect(POZYCJE_NAWIGACJI).toHaveLength(10);
  });

  it("„Moje konto” i „Wyloguj” są w stopce, poza listą nawigacji", () => {
    render(<App />);

    const nawigacja = screen.getByRole("navigation");
    expect(within(nawigacja).queryByTestId("link-moje-konto")).toBeNull();
    expect(screen.getByTestId("link-moje-konto")).toBeInTheDocument();
    expect(screen.getByTestId("button-logout")).toBeInTheDocument();
  });

  it("pokazuje inicjały, imię i e-mail zalogowanego użytkownika", () => {
    render(<App />);

    expect(screen.getByTestId("text-current-user")).toHaveTextContent(UZYTKOWNIK.imieNazwisko);
    expect(screen.getByText(UZYTKOWNIK.email)).toBeInTheDocument();
    // „Marta Bieguniak" -> „MB"
    const oczekiwaneInicjaly = UZYTKOWNIK.imieNazwisko
      .split(" ")
      .slice(0, 2)
      .map((czlon) => czlon[0])
      .join("")
      .toUpperCase();
    expect(screen.getByTestId("avatar-current-user")).toHaveTextContent(oczekiwaneInicjaly);
  });
});

describe("nawigacja", () => {
  it("kliknięcie pozycji przenosi na jej trasę", async () => {
    const uzytkownik = userEvent.setup();
    render(<App />);

    await uzytkownik.click(screen.getByTestId("link-nav-katalog"));

    await waitFor(() => expect(screen.getByTestId("text-page-title")).toHaveTextContent("Katalog"));
    expect(window.location.pathname).toBe("/katalog");
  });

  it("nieznana trasa pokazuje polski ekran 404 (odstępstwo O3)", async () => {
    window.history.pushState({}, "", "/nie-ma-takiej-strony");
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText(/nie znaleziono strony/i)).toBeInTheDocument(),
    );
  });
});

describe("tryb ciemny", () => {
  it("przełącznik zmienia klasę na <html> i zapisuje wybór (odstępstwo O2)", async () => {
    const uzytkownik = userEvent.setup();
    render(<App />);
    const przelacznik = screen.getByTestId("button-theme-toggle");

    // Stub matchMedia w test/setup.ts zwraca „nie pasuje", więc start jest jasny.
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(przelacznik).toHaveTextContent("Tryb ciemny");

    await uzytkownik.click(przelacznik);

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(przelacznik).toHaveTextContent("Tryb jasny");
    expect(localStorage.getItem("bridge_theme")).toBe("dark");
  });

  it("sama wizyta bez kliknięcia NIE utrwala preferencji systemowej", () => {
    render(<App />);

    // Gdyby zapis siedział w efekcie, pierwsze renderowanie zamroziłoby
    // `prefers-color-scheme` i aplikacja przestałaby za nim podążać.
    expect(localStorage.getItem("bridge_theme")).toBeNull();
  });
});

describe("wylogowanie", () => {
  it("woła /api/logout, czyści sesję i wraca na /login", async () => {
    const uzytkownik = userEvent.setup();
    let zawolane = false;
    server.use(
      http.post("http://localhost:5173/api/logout", () => {
        zawolane = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<App />);
    await uzytkownik.click(screen.getByTestId("button-logout"));

    await waitFor(() => expect(screen.getByTestId("text-login-title")).toBeInTheDocument());
    expect(zawolane).toBe(true);
    expect(sessionStorage.getItem(KLUCZE_STORAGE.uzytkownik)).toBeNull();
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
    expect(window.location.pathname).toBe("/login");
  });
});
