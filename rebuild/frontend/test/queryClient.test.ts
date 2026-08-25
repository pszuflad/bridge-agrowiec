/**
 * Konwencja „klucz zapytania = ścieżka" i obsługa 401 —
 * `deminified/frontend-index.js:9054-9079`. Na tym stoją wszystkie kolejne iteracje.
 */
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { zapiszToken } from "@/lib/api";
import { utworzQueryClient, zapytanieZwracajaceNullNa401 } from "@/lib/queryClient";
import { server } from "./msw/server";

beforeEach(() => {
  zapiszToken(null);
});

function wykonaj(queryKey: readonly unknown[]) {
  // Sygnatura queryFn TanStacka wymaga więcej pól, niż ta implementacja czyta.
  return zapytanieZwracajaceNullNa401({ queryKey } as never);
}

describe("zapytanieZwracajaceNullNa401", () => {
  it("skleja klucz w ścieżkę przez join(\"/\")", async () => {
    server.use(
      http.get("http://localhost:5173/api/staging/42", () => HttpResponse.json({ id: 42 })),
    );

    await expect(wykonaj(["/api/staging", 42])).resolves.toEqual({ id: 42 });
  });

  it("na 401 zwraca null zamiast rzucać", async () => {
    server.use(
      http.get("http://localhost:5173/api/staging", () =>
        HttpResponse.json({ error: "Nieautoryzowany" }, { status: 401 }),
      ),
    );

    await expect(wykonaj(["/api/staging"])).resolves.toBeNull();
  });

  it("inny błąd HTTP nadal rzuca", async () => {
    server.use(
      http.get(
        "http://localhost:5173/api/staging",
        () => new HttpResponse("padło", { status: 500 }),
      ),
    );

    await expect(wykonaj(["/api/staging"])).rejects.toThrow("500: padło");
  });

  it("dokłada Bearer, gdy token istnieje", async () => {
    zapiszToken("tajne");
    let autoryzacja: string | null | undefined;
    server.use(
      http.get("http://localhost:5173/api/me", ({ request }) => {
        autoryzacja = request.headers.get("authorization");
        return HttpResponse.json({ id: 1 });
      }),
    );

    await wykonaj(["/api/me"]);
    expect(autoryzacja).toBe("Bearer tajne");
  });

  it("zapytanie odczytowe też zawsze wysyła credentials:\"include\"", async () => {
    // Jak w `zadanie()`: MSW nie widzi `credentials`, więc podglądamy wywołanie `fetch`.
    const szpieg = vi.spyOn(globalThis, "fetch");
    server.use(http.get("http://localhost:5173/api/me", () => HttpResponse.json({ id: 1 })));

    await wykonaj(["/api/me"]);

    expect(szpieg).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({ credentials: "include" }),
    );
    szpieg.mockRestore();
  });
});

describe("domyślne opcje klienta", () => {
  it("odtwarzają ustawienia oryginału", () => {
    const opcje = utworzQueryClient().getDefaultOptions();

    expect(opcje.queries?.staleTime).toBe(Infinity);
    expect(opcje.queries?.retry).toBe(false);
    expect(opcje.queries?.refetchOnWindowFocus).toBe(false);
    expect(opcje.queries?.refetchInterval).toBe(false);
    expect(opcje.mutations?.retry).toBe(false);
  });
});
