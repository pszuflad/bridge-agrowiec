import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { queryClient } from "@/lib/queryClient";
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

  // Radix (Select, DropdownMenu) używa Pointer Events API i `scrollIntoView`,
  // których jsdom nie implementuje. Bez tych trzech zaślepek komponent rzuca przy
  // otwieraniu listy. To luka jsdoma, nie zachowanie aplikacji — tak samo jak
  // `matchMedia` wyżej.
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
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
  // `queryClient` jest singletonem modułowym ze `staleTime: Infinity` (wiernie oryginałowi,
  // lib/queryClient.ts). Bez czyszczenia cache przecieka między testami: kolejny render
  // dostaje dane poprzedniego bez żadnego żądania, więc mock ustawiony przez `server.use`
  // nigdy nie dochodzi do głosu.
  queryClient.clear();
  localStorage.clear();
  sessionStorage.clear();
});

afterAll(() => {
  server.close();
});
