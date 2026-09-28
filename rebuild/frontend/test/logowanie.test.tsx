/**
 * Przepływ logowania od strony użytkownika: formularz → żądanie → shell.
 * Mock `/api/login` odpowiada kształtem z `contract/fixtures/GET_me.json`.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import { KLUCZE_STORAGE, zapiszToken } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";
import { handleryPulpitu } from "./msw/pulpit";

const UZYTKOWNIK = uzytkownikZFixtura();

beforeEach(() => {
  zapiszToken(null);
  _zresetujStanSesji();
  window.history.pushState({}, "", "/login");
  // Udane logowanie przenosi na `/`, a od bloku 10f jest tam Pulpit z pięcioma zapytaniami.
  server.use(...handleryPulpitu());
});

describe("ekran logowania", () => {
  it("pokazuje pola, checkbox i przycisk po polsku", () => {
    render(<App />);

    expect(screen.getByTestId("text-login-title")).toHaveTextContent("Zaloguj się");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Hasło")).toBeInTheDocument();
    expect(screen.getByLabelText("Zapamiętaj mnie")).not.toBeChecked();
    expect(screen.getByTestId("button-login")).toHaveTextContent("Zaloguj się");
  });

  it("przełącznik odsłania i chowa hasło", async () => {
    const uzytkownik = userEvent.setup();
    render(<App />);
    const pole = screen.getByTestId("input-password");

    expect(pole).toHaveAttribute("type", "password");
    await uzytkownik.click(screen.getByTestId("button-toggle-password"));
    expect(pole).toHaveAttribute("type", "text");
    await uzytkownik.click(screen.getByTestId("button-toggle-password"));
    expect(pole).toHaveAttribute("type", "password");
  });

  it("nie przenosi kont testowych z bundla ani martwej datalisty (odstępstwo O4)", () => {
    render(<App />);

    expect(screen.getByTestId("input-email")).not.toHaveAttribute("list");
    expect(document.querySelector("datalist")).toBeNull();
  });
});

describe("udane logowanie", () => {
  it("wysyła przycięty e-mail, zapisuje sesję i pokazuje shell", async () => {
    const uzytkownik = userEvent.setup();
    let wyslane: unknown;
    server.use(
      http.post("http://localhost:5173/api/login", async ({ request }) => {
        wyslane = await request.json();
        return HttpResponse.json({ ok: true, user: UZYTKOWNIK, token: TOKEN_TESTOWY });
      }),
    );

    render(<App />);
    await uzytkownik.type(screen.getByTestId("input-email"), "  marta@example.com  ");
    await uzytkownik.type(screen.getByTestId("input-password"), "tajne-haslo");
    await uzytkownik.click(screen.getByTestId("button-login"));

    // Po sukcesie trafiamy na pulpit, czyli w ramę z sidebarem.
    await waitFor(() => expect(screen.getByTestId("text-current-user")).toBeInTheDocument());

    expect(wyslane).toEqual({ email: "marta@example.com", password: "tajne-haslo" });
    expect(screen.getByTestId("text-current-user")).toHaveTextContent(UZYTKOWNIK.imieNazwisko);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Pulpit");
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBe(TOKEN_TESTOWY);
  });

  it("z zaznaczonym „Zapamiętaj mnie” sesja ląduje w localStorage", async () => {
    const uzytkownik = userEvent.setup();
    server.use(
      http.post("http://localhost:5173/api/login", () =>
        HttpResponse.json({ ok: true, user: UZYTKOWNIK, token: TOKEN_TESTOWY }),
      ),
    );

    render(<App />);
    await uzytkownik.type(screen.getByTestId("input-email"), UZYTKOWNIK.email);
    await uzytkownik.type(screen.getByTestId("input-password"), "tajne");
    await uzytkownik.click(screen.getByTestId("checkbox-remember-me"));
    await uzytkownik.click(screen.getByTestId("button-login"));

    await waitFor(() => expect(screen.getByTestId("text-current-user")).toBeInTheDocument());

    expect(localStorage.getItem(KLUCZE_STORAGE.token)).toBe(TOKEN_TESTOWY);
    expect(JSON.parse(localStorage.getItem(KLUCZE_STORAGE.uzytkownik) ?? "null")).toEqual(
      UZYTKOWNIK,
    );
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
  });
});

describe("nieudane logowanie", () => {
  it("pokazuje komunikat backendu i zostaje na ekranie logowania", async () => {
    const uzytkownik = userEvent.setup();
    server.use(
      http.post("http://localhost:5173/api/login", () =>
        HttpResponse.json({ error: "Nieprawidłowy email lub hasło" }, { status: 401 }),
      ),
    );

    render(<App />);
    await uzytkownik.type(screen.getByTestId("input-email"), UZYTKOWNIK.email);
    await uzytkownik.type(screen.getByTestId("input-password"), "zle-haslo");
    await uzytkownik.click(screen.getByTestId("button-login"));

    const blad = await screen.findByTestId("text-login-error");
    // UWAGA: to NIE jest goły komunikat backendu. Oryginał rzuca wyjątek w `rzucGdyBlad`
    // ZANIM `zaloguj()` sięgnie po pole `error` (frontend-index.js:9031-9038 + :9085-9097),
    // więc użytkownik widzi status i surowe ciało odpowiedzi. Odtwarzamy to 1:1 —
    // asercja na dokładny string, żeby nikt nie „poprawił" tego jako literówki.
    expect(blad).toHaveTextContent(
      '401: {"error":"Nieprawidłowy email lub hasło"}',
    );
    expect(screen.getByTestId("text-login-title")).toBeInTheDocument();
    expect(sessionStorage.getItem(KLUCZE_STORAGE.token)).toBeNull();
  });
});

describe("ochrona tras", () => {
  it("wejście na trasę bez sesji przekierowuje na /login", async () => {
    window.history.pushState({}, "", "/katalog");

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("text-login-title")).toBeInTheDocument());
    expect(window.location.pathname).toBe("/login");
  });
});
