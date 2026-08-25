import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => {
  // jsdom nie implementuje `matchMedia`, a `ThemeProvider` (jak oryginał) pyta o
  // `prefers-color-scheme`. Domyślnie odpowiadamy „nie pasuje" = motyw jasny.
  if (!window.matchMedia) {
    window.matchMedia = ((zapytanie: string) => ({
      matches: false,
      media: zapytanie,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }

  server.listen({ onUnhandledRequest: "error" });

  // jsdom nie dostarcza `fetch`, więc w testach działa `fetch` z Node — a ten nie
  // rozwiązuje ścieżek względnych. Aplikacja woła `/api/...` (tak jak w przeglądarce),
  // dlatego doklejamy bazę z `window.location`. Nakładka MUSI powstać PO `server.listen()`,
  // żeby MSW dostawał już adres bezwzględny.
  const fetchPodSpodem = globalThis.fetch;
  globalThis.fetch = ((zasob: RequestInfo | URL, opcje?: RequestInit) => {
    if (typeof zasob === "string" && zasob.startsWith("/")) {
      return fetchPodSpodem(new URL(zasob, window.location.origin).toString(), opcje);
    }
    return fetchPodSpodem(zasob, opcje);
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
});

afterAll(() => {
  server.close();
});
