// Ticket 207: zakładka „Nieobecne w imporcie” w Katalogu — lista, usuń z potwierdzeniem, przywróć jako aktywne.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { server } from "./msw/server";
import { TOKEN_TESTOWY, uzytkownikZFixtura } from "./msw/kontrakt";

const POZYCJE = [
  { id: 11, kod: "MO1_STARA", nazwa: "Opona STARA", dostawca: "MO1", marka: "BKT", rozmiar: "18X8.50-10", ean: "5901234123457", stan: 0, cenaZakupu: 100, wstrzymanoO: "2026-10-01T10:00:00.000Z", dniNieobecnosci: 9, powod: "Brak w aktualnym, kompletnym cenniku dostawcy" },
  { id: 12, kod: "MO7_NOKIAN", nazwa: "Nokian X", dostawca: "MO7", marka: "Nokian", rozmiar: "315/60R22.5", ean: null, stan: 0, cenaZakupu: 200, wstrzymanoO: "2026-10-09T10:00:00.000Z", dniNieobecnosci: 1, powod: "Brak w aktualnym, kompletnym cenniku dostawcy" },
];

let wywolania: { url: string; body: unknown }[] = [];

function zamockuj() {
  wywolania = [];
  server.use(
    http.get("*/api/products", () => HttpResponse.json([])),
    http.get("*/api/suppliers", () => HttpResponse.json([])),
    http.get("*/api/config", () => HttpResponse.json({})),
    http.get("*/api/atrybuty", () => HttpResponse.json({})),
    http.get("*/api/overrides", () => HttpResponse.json([])),
    http.get("*/api/nieobecne", () => HttpResponse.json({ progDniDomyslny: 7, progDniDostawcow: { MO7: 0, MO8: 0 }, items: POZYCJE })),
    http.post("*/api/nieobecne/usun", async ({ request }) => {
      wywolania.push({ url: request.url, body: await request.json() });
      return HttpResponse.json({ ok: true, usuniete: 1, kody: ["MO1_STARA"] });
    }),
    http.post("*/api/nieobecne/przywroc", async ({ request }) => {
      wywolania.push({ url: request.url, body: await request.json() });
      return HttpResponse.json({ ok: true, przywrocone: 1, kody: ["MO1_STARA"] });
    }),
  );
}

describe("Katalog — zakładka „Nieobecne w imporcie”", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(uzytkownikZFixtura()));
    sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
    _zresetujStanSesji();
    zamockuj();
  });

  async function otworz() {
    window.history.pushState({}, "", "/katalog");
    render(<App />);
    const zakladka = await screen.findByTestId("tab-nieobecne");
    const uzytkownik = userEvent.setup();
    await uzytkownik.click(zakladka);
    await screen.findByTestId("zakladka-nieobecne");
    return uzytkownik;
  }

  it("pokazuje licznik na zakładce i listę pozycji z liczbą dni", async () => {
    await otworz();
    expect(screen.getByTestId("tab-nieobecne")).toHaveTextContent("2");
    expect(await screen.findByTestId("wiersz-nieobecne-MO1_STARA")).toHaveTextContent("9");
    expect(screen.getByTestId("wiersz-nieobecne-MO7_NOKIAN")).toBeInTheDocument();
  });

  it("„Usuń” pyta z liczbą i po potwierdzeniu wysyła zaznaczone id", async () => {
    const uzytkownik = await otworz();
    await uzytkownik.click(await screen.findByLabelText("Zaznacz MO1_STARA"));

    await uzytkownik.click(screen.getByTestId("button-nieobecne-usun"));
    const dialog = await screen.findByTestId("dialog-nieobecne-usun");
    expect(dialog).toHaveTextContent(/Usunąć 1 pozycji/);
    expect(wywolania).toHaveLength(0);
    await uzytkownik.click(within(dialog).getByTestId("button-potwierdz"));

    await waitFor(() => expect(wywolania).toHaveLength(1));
    expect(wywolania[0]!.url).toContain("/api/nieobecne/usun");
    expect(wywolania[0]!.body).toEqual({ ids: [11] });
    expect(await screen.findByTestId("komunikat-nieobecne")).toHaveTextContent(/Usunięto pozycji: 1/);
  });

  it("„Przywróć jako aktywne” wysyła id do /api/nieobecne/przywroc", async () => {
    const uzytkownik = await otworz();
    await uzytkownik.click(await screen.findByTestId("checkbox-nieobecne-wszystkie"));

    await uzytkownik.click(screen.getByTestId("button-nieobecne-przywroc"));
    await uzytkownik.click(within(await screen.findByTestId("dialog-nieobecne-przywroc")).getByTestId("button-potwierdz"));

    await waitFor(() => expect(wywolania).toHaveLength(1));
    expect(wywolania[0]!.url).toContain("/api/nieobecne/przywroc");
    expect(wywolania[0]!.body).toEqual({ ids: [11, 12] });
  });
});
