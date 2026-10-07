/**
 * Ticket 195 — karta „Usunięte z Selly" na `/selly`: lista (najnowsze pierwsze), paginacja po 20, stan pusty,
 * błąd listy oraz przycisk „Pobierz CSV" (pobiera CAŁĄ historię z nazwą pliku z `Content-Disposition`).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type { UsunietaPozycja } from "@/pages/selly/api";
import {
  TOKEN_TESTOWY,
  pingSellyZFixtura,
  statusCsvZFixtura,
  statusDostawcowZFixtura,
  statusUsuwaniaTestowy,
  stronaUsunietychTestowa,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();

const pozycja = (id: number, nad: Partial<UsunietaPozycja> = {}): UsunietaPozycja => ({
  id,
  usunieto_at: "2026-10-07 10:15:00",
  przebieg_id: 7,
  kod: `MO1_${id}`,
  nazwa: `Opona ${id}`,
  ean: `5900000${String(id).padStart(6, "0")}`,
  dostawca: "MO1",
  kod_importu: `KI${id}`,
  selly_product_id: 500 + id,
  selly_variant_id: 600 + id,
  akcja: "usunieto_produkt",
  ...nad,
});

let zapytania: string[] = [];
let zapytaniaCsv = 0;
let klikniete: { download: string; href: string }[] = [];
let zapisaneBloby: Blob[] = [];

/** Historia w „bazie" testu: najnowsze pierwsze, `limit`/`offset` jak w backendzie. */
function zamockuj(historia: UsunietaPozycja[] | "blad") {
  server.use(
    http.get("*/api/selly/usuwanie-status", () => HttpResponse.json(statusUsuwaniaTestowy())),
    http.get("*/api/selly/ping", () => HttpResponse.json(pingSellyZFixtura())),
    http.get("*/api/selly/csv-status", () => HttpResponse.json(statusCsvZFixtura())),
    http.get("*/api/selly/status", () => HttpResponse.json({ items: statusDostawcowZFixtura() })),
    http.get("*/api/selly/log", () => HttpResponse.json({ items: [] })),
    http.get("*/api/selly/usuniete", ({ request }) => {
      zapytania.push(new URL(request.url).search);
      if (historia === "blad") return HttpResponse.json({ error: "baza padła" }, { status: 500 });
      const q = new URL(request.url).searchParams;
      const limit = Number(q.get("limit"));
      const offset = Number(q.get("offset"));
      return HttpResponse.json(
        stronaUsunietychTestowa({ items: historia.slice(offset, offset + limit), total: historia.length }),
      );
    }),
    http.get("*/api/selly/usuniete/csv", () => {
      zapytaniaCsv++;
      return new HttpResponse("\uFEFFid;kod\n1;MO1_1", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=selly-usuniete-2026-10-07.csv",
        },
      });
    }),
  );
}

async function otworzSelly() {
  window.history.pushState({}, "", "/selly");
  render(<App />);
  await screen.findByTestId("selly-tabela-status");
  return await screen.findByTestId("selly-sekcja-usuniete");
}

beforeEach(() => {
  zapytania = [];
  zapytaniaCsv = 0;
  klikniete = [];
  zapisaneBloby = [];
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        zapisaneBloby.push(blob);
        return "blob:usuniete-test";
      },
      revokeObjectURL: () => undefined,
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    klikniete.push({ download: this.download, href: this.getAttribute("href") ?? "" });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("karta „Usunięte z Selly”", () => {
  it("pusta historia: komunikat zamiast pustej tabeli", async () => {
    zamockuj([]);
    const karta = await otworzSelly();

    expect(await within(karta).findByTestId("selly-usuniete-puste")).toHaveTextContent("Jeszcze nic nie usunięto z Selly.");
    expect(within(karta).queryByTestId("selly-tabela-usuniete")).toBeNull();
  });

  it("pokazuje wiersze z datą, kodem, nazwą, EAN-em, dostawcą, akcją i identyfikatorami Selly", async () => {
    zamockuj([
      pozycja(2, { akcja: "usunieto_wariant" }),
      pozycja(1, { akcja: "juz_nie_istnial", nazwa: null, ean: null, selly_variant_id: null }),
    ]);
    const karta = await otworzSelly();

    const wiersze = await within(karta).findAllByTestId("selly-usuniete-wiersz");
    expect(wiersze).toHaveLength(2);
    expect(wiersze[0]).toHaveTextContent("MO1_2");
    expect(wiersze[0]).toHaveTextContent("Opona 2");
    expect(wiersze[0]).toHaveTextContent("5900000000002");
    expect(wiersze[0]).toHaveTextContent("MO1");
    expect(wiersze[0]).toHaveTextContent("Usunięto wariant");
    expect(wiersze[0]).toHaveTextContent("502 / 602");
    // pozycja bez nazwy/EAN-u/wariantu: kreski, a nie „null"
    expect(wiersze[1]).toHaveTextContent("Już nie istniał");
    expect(wiersze[1]).toHaveTextContent("501");
    expect(wiersze[1]).not.toHaveTextContent("null");
    expect(wiersze[1]!.querySelectorAll("td")[2]).toHaveTextContent("—");
    expect(within(karta).getByTestId("selly-usuniete-zakres")).toHaveTextContent("1–2 z 2");
  });

  it("paginacja po 20: Następne/Poprzednie wołają API z offsetem, a przyciski blokują się na końcach", async () => {
    const historia = Array.from({ length: 25 }, (_, i) => pozycja(25 - i)); // najnowsze (id 25) pierwsze
    zamockuj(historia);
    const karta = await otworzSelly();

    await within(karta).findAllByTestId("selly-usuniete-wiersz");
    expect(within(karta).getAllByTestId("selly-usuniete-wiersz")).toHaveLength(20);
    expect(within(karta).getByTestId("selly-usuniete-zakres")).toHaveTextContent("1–20 z 25");
    expect(within(karta).getByTestId("selly-usuniete-poprzednie")).toBeDisabled();
    expect(zapytania).toContain("?limit=20&offset=0");

    await userEvent.click(within(karta).getByTestId("selly-usuniete-nastepne"));
    await waitFor(() => expect(within(karta).getByTestId("selly-usuniete-zakres")).toHaveTextContent("21–25 z 25"));
    expect(zapytania).toContain("?limit=20&offset=20");
    expect(within(karta).getAllByTestId("selly-usuniete-wiersz")).toHaveLength(5);
    expect(within(karta).getByTestId("selly-usuniete-nastepne")).toBeDisabled();

    await userEvent.click(within(karta).getByTestId("selly-usuniete-poprzednie"));
    await waitFor(() => expect(within(karta).getByTestId("selly-usuniete-zakres")).toHaveTextContent("1–20 z 25"));
  });

  it("błąd listy jest pokazany w karcie (nie wywraca widoku)", async () => {
    zamockuj("blad");
    const karta = await otworzSelly();

    await waitFor(() => expect(within(karta).getByRole("status", { name: "Błąd" })).toBeInTheDocument());
    expect(within(karta).queryByTestId("selly-tabela-usuniete")).toBeNull();
  });

  it("„Pobierz CSV” woła trasę eksportu i zapisuje plik pod nazwą z Content-Disposition", async () => {
    zamockuj([pozycja(1)]);
    const karta = await otworzSelly();
    await within(karta).findAllByTestId("selly-usuniete-wiersz");

    await userEvent.click(within(karta).getByTestId("selly-button-pobierz-usuniete-csv"));

    await waitFor(() => expect(klikniete).toHaveLength(1));
    expect(zapytaniaCsv).toBe(1);
    expect(klikniete[0]).toEqual({ download: "selly-usuniete-2026-10-07.csv", href: "blob:usuniete-test" });
    // `Blob.text()` zdejmuje BOM przy dekodowaniu, więc sprawdzamy surowe bajty: plik ma zostać nietknięty (BOM + treść).
    const bajty = new Uint8Array(await zapisaneBloby[0]!.arrayBuffer());
    expect([...bajty.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bajty)).toBe("\uFEFFid;kod\n1;MO1_1");
  });

  it("błąd pobrania CSV jest widoczny w karcie, a plik się nie zapisuje", async () => {
    zamockuj([pozycja(1)]);
    server.use(http.get("*/api/selly/usuniete/csv", () => HttpResponse.json({ error: "brak miejsca" }, { status: 500 })));
    const karta = await otworzSelly();
    await within(karta).findAllByTestId("selly-usuniete-wiersz");

    await userEvent.click(within(karta).getByTestId("selly-button-pobierz-usuniete-csv"));

    await waitFor(() => expect(within(karta).getByText(/brak miejsca|500/)).toBeInTheDocument());
    expect(klikniete).toHaveLength(0);
  });
});
