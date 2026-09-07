/**
 * Zakładki „Admin" i „Dziennik" (`/konfiguracja`) oraz przycisk „Usuń wszystko z katalogu"
 * w zakładce „Katalog" — Iteracja 12b.
 *
 * Dane z `contract/fixtures/GET_admin_supplier-config.json`, `GET_admin_suppliers-list.json`,
 * `GET_users.json` i `GET_audit-log.json`: widok sprawdzamy przeciwko kształtowi, który
 * realnie oddaje produkcja, a nie przeciwko naszemu wyobrażeniu o nim.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import type {
  DostawcaNaLiscie,
  KonfiguracjaDostawcy,
  UzytkownikNaLiscie,
  WpisAudytu,
} from "@/pages/konfiguracja/admin";
import {
  audytZFixtura,
  konfiguracjaDostawcowZFixtura,
  konfiguracjaZFixtura,
  listaDostawcowZFixtura,
  TOKEN_TESTOWY,
  uzytkownicyZFixtura,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const KONFIGURACJA = konfiguracjaZFixtura();
const KONFIG_DOSTAWCOW = konfiguracjaDostawcowZFixtura() as KonfiguracjaDostawcy[];
const LISTA_DOSTAWCOW = listaDostawcowZFixtura() as DostawcaNaLiscie[];
const UZYTKOWNICY = uzytkownicyZFixtura() as UzytkownikNaLiscie[];
const AUDYT = audytZFixtura() as WpisAudytu[];

/** Pierwszy dostawca z nagrania — na nim sprawdzamy wypełnienie wiersza i dialog. */
const DOSTAWCA = KONFIG_DOSTAWCOW[0]!;

let patche: { kod: string; cialo: Record<string, unknown> }[] = [];
let czyszczenia: Record<string, unknown>[] = [];
let usunieciaNieOpon = 0;

function zamockujApi(opcje: { odpowiedzPatcha?: () => Response } = {}) {
  patche = [];
  czyszczenia = [];
  usunieciaNieOpon = 0;
  server.use(
    http.get("*/api/config", () => HttpResponse.json(KONFIGURACJA)),
    http.get("*/api/admin/supplier-config", () =>
      HttpResponse.json({ ok: true, dostawcy: KONFIG_DOSTAWCOW }),
    ),
    http.get("*/api/admin/suppliers-list", () =>
      HttpResponse.json({ ok: true, dostawcy: LISTA_DOSTAWCOW }),
    ),
    http.get("*/api/users", () => HttpResponse.json(UZYTKOWNICY)),
    http.get("*/api/audit-log", () => HttpResponse.json(AUDYT)),
    http.patch("*/api/admin/supplier-config/:kod", async ({ params, request }) => {
      patche.push({
        kod: String(params.kod),
        cialo: (await request.json()) as Record<string, unknown>,
      });
      return opcje.odpowiedzPatcha?.() ?? HttpResponse.json({ ok: true });
    }),
    http.post("*/api/products/clear", async ({ request }) => {
      czyszczenia.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ ok: true });
    }),
    http.post("*/api/maintenance/usun-nieopony", () => {
      usunieciaNieOpon += 1;
      return HttpResponse.json({
        ok: true,
        usuniete: 3,
        perDostawca: { MO4: 1, MO5: 2 },
        przyklady: ["MO4/N1: Zawory komplet"],
      });
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzZakladke(nazwa: string) {
  window.history.pushState({}, "", "/konfiguracja");
  render(<App />);
  await screen.findByTestId(`tab-${nazwa}`);
  await userEvent.click(screen.getByTestId(`tab-${nazwa}`));
}

describe("Zakładka „Admin”", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  afterEach(() => vi.restoreAllMocks());

  it("listuje wszystkich dostawców z nagrania produkcji", async () => {
    await otworzZakladke("admin");

    await screen.findByTestId(`row-admin-${DOSTAWCA.kod}`);
    for (const dostawca of KONFIG_DOSTAWCOW) {
      expect(screen.getByTestId(`row-admin-${dostawca.kod}`)).toBeInTheDocument();
    }
  });

  it("scala konfigurację ze statystykami importu w jednym wierszu", async () => {
    await otworzZakladke("admin");

    const wiersz = await screen.findByTestId(`row-admin-${DOSTAWCA.kod}`);
    const statystyki = LISTA_DOSTAWCOW.find((d) => d.kod === DOSTAWCA.kod)!;

    expect(wiersz).toHaveTextContent(DOSTAWCA.nazwa);
    expect(within(wiersz).getByText(String(statystyki.liczbaProduktow))).toBeInTheDocument();
  });

  /**
   * ⚠ Flaga `urlEfektywnyZDb` jest jedyną rzeczą odróżniającą „adres ustawiony ręcznie"
   * od „adres z dispatchera", bo w obu przypadkach pole `url` jest wypełnione. Bez znacznika
   * w UI Ania nie wiedziałaby, czy wyczyszczenie pola cokolwiek zmieni.
   */
  it("oznacza adres pochodzący z fallbacku dispatchera", async () => {
    const zFallbackiem = KONFIG_DOSTAWCOW.find((d) => !d.urlEfektywnyZDb);
    const zBazy = KONFIG_DOSTAWCOW.find((d) => d.urlEfektywnyZDb);
    await otworzZakladke("admin");
    await screen.findByTestId(`row-admin-${DOSTAWCA.kod}`);

    if (zFallbackiem) {
      expect(screen.getByTestId(`admin-fallback-${zFallbackiem.kod}`)).toBeInTheDocument();
    }
    if (zBazy) {
      expect(screen.queryByTestId(`admin-fallback-${zBazy.kod}`)).toBeNull();
    }
  });

  it("pokazuje użytkowników z /api/users, bez śladu hasła", async () => {
    await otworzZakladke("admin");

    for (const uzytkownik of UZYTKOWNICY) {
      const wiersz = await screen.findByTestId(`row-admin-user-${uzytkownik.id}`);
      expect(wiersz).toHaveTextContent(uzytkownik.imieNazwisko);
      expect(wiersz).toHaveTextContent(uzytkownik.email);
    }
    expect(document.body.textContent).not.toMatch(/\$2[aby]\$/);
  });

  describe("dialog edycji dostawcy", () => {
    async function otworzDialog() {
      await otworzZakladke("admin");
      await screen.findByTestId(`row-admin-${DOSTAWCA.kod}`);
      await userEvent.click(screen.getByTestId(`button-admin-edytuj-${DOSTAWCA.kod}`));
      return await screen.findByTestId("input-admin-url");
    }

    it("startuje z zablokowanym zapisem, dopóki nic nie zmieniono", async () => {
      await otworzDialog();

      expect(screen.getByTestId("button-admin-zapisz")).toBeDisabled();
    });

    /**
     * ⚠ NAJWAŻNIEJSZA ASERCJA DIALOGU: wysyłamy TYLKO pola zmienione. Backend rozróżnia
     * „pole nieobecne" (nie ruszaj) od „pole null" (wyczyść) przez `hasOwnProperty`, więc
     * wysłanie kompletu nadpisałoby wartości, których nikt nie dotknął.
     */
    it("wysyła wyłącznie zmienione pole", async () => {
      await otworzDialog();

      await userEvent.clear(screen.getByTestId("input-admin-czestotliwosc"));
      await userEvent.type(screen.getByTestId("input-admin-czestotliwosc"), "120");
      await userEvent.click(screen.getByTestId("button-admin-zapisz"));

      await waitFor(() => expect(patche).toHaveLength(1));
      expect(patche[0]!.kod).toBe(DOSTAWCA.kod);
      expect(patche[0]!.cialo).toEqual({ czestotliwoscMinuty: 120 });
    });

    it("blokuje zapis przy adresie spoza http(s) i mówi dlaczego", async () => {
      await otworzDialog();

      await userEvent.clear(screen.getByTestId("input-admin-url"));
      await userEvent.type(screen.getByTestId("input-admin-url"), "ftp://zle.test/x.csv");

      expect(screen.getByTestId("blad-admin-url")).toBeInTheDocument();
      expect(screen.getByTestId("button-admin-zapisz")).toBeDisabled();
      expect(patche).toHaveLength(0);
    });

    it("blokuje zapis przy częstotliwości poza zakresem 5..10080", async () => {
      await otworzDialog();

      await userEvent.clear(screen.getByTestId("input-admin-czestotliwosc"));
      await userEvent.type(screen.getByTestId("input-admin-czestotliwosc"), "4");

      expect(screen.getByTestId("blad-admin-czestotliwosc")).toBeInTheDocument();
      expect(screen.getByTestId("button-admin-zapisz")).toBeDisabled();
    });

    it("pokazuje komunikat błędu z backendu", async () => {
      zamockujApi({
        odpowiedzPatcha: () =>
          HttpResponse.json({ error: "status: aktywny|wstrzymany|blad" }, { status: 400 }),
      });
      await otworzDialog();

      await userEvent.clear(screen.getByTestId("input-admin-czestotliwosc"));
      await userEvent.type(screen.getByTestId("input-admin-czestotliwosc"), "120");
      await userEvent.click(screen.getByTestId("button-admin-zapisz"));

      expect(await screen.findByTestId("blad-admin-zapis")).toHaveTextContent(
        "status: aktywny|wstrzymany|blad",
      );
    });
  });

  describe("utrzymanie katalogu", () => {
    it("nie wysyła żądania, gdy potwierdzenie odrzucono", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      await otworzZakladke("admin");

      await userEvent.click(await screen.findByTestId("button-usun-nieopony"));

      expect(usunieciaNieOpon).toBe(0);
    });

    it("po potwierdzeniu usuwa nie-opony i pokazuje podsumowanie", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await otworzZakladke("admin");

      await userEvent.click(await screen.findByTestId("button-usun-nieopony"));

      await waitFor(() => expect(usunieciaNieOpon).toBe(1));
      const wynik = await screen.findByTestId("wynik-usun-nieopony");
      expect(wynik).toHaveTextContent("3");
      expect(wynik).toHaveTextContent("MO4/N1: Zawory komplet");
    });
  });
});

describe("Zakładka „Dziennik”", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  it("listuje wpisy audytu z nagrania produkcji", async () => {
    await otworzZakladke("dziennik");

    for (const wpis of AUDYT) {
      expect(await screen.findByTestId(`row-audyt-${wpis.id}`)).toBeInTheDocument();
    }
  });

  /**
   * ⚠ To jest odpowiednik tego, co wywaliło widok historii w I5: wiersz bez szczegółów
   * i z encją, której nie ma w `suppliers`. Ma się wyrenderować, a nie wywrócić widok.
   */
  it("renderuje wiersz z NULL w szczegółach i encją spoza suppliers", async () => {
    server.use(
      http.get("*/api/audit-log", () =>
        HttpResponse.json([
          {
            id: 9001,
            uzytkownikId: 1,
            uzytkownikImie: "Marta Bieguniak",
            akcja: "synchronizacja_reczna",
            encjaTyp: "dostawca",
            encjaId: "MO99",
            szczegolyJson: null,
            kiedy: "2026-08-18T08:00:00.000Z",
          },
          {
            id: 9002,
            uzytkownikId: 1,
            uzytkownikImie: "Marta Bieguniak",
            akcja: "czyszczenie_katalogu",
            encjaTyp: "produkt",
            encjaId: "wszystkie",
            szczegolyJson: "to nie jest JSON {{{",
            kiedy: "2026-08-19T08:00:00.000Z",
          },
        ]),
      ),
    );
    await otworzZakladke("dziennik");

    const zNullem = await screen.findByTestId("row-audyt-9001");
    expect(zNullem).toHaveTextContent("synchronizacja_reczna");
    expect(zNullem).toHaveTextContent("MO99");
    expect(screen.getByTestId("szczegoly-audyt-9001")).toHaveTextContent("");
    expect(screen.getByTestId("szczegoly-audyt-9002")).toHaveTextContent("");
  });

  it("filtruje po akcji i aktualizuje licznik", async () => {
    await otworzZakladke("dziennik");
    await screen.findByTestId(`row-audyt-${AUDYT[0]!.id}`);

    expect(screen.getByTestId("dziennik-licznik")).toHaveTextContent(
      `${AUDYT.length} z ${AUDYT.length}`,
    );

    await userEvent.type(screen.getByTestId("input-dziennik-szukaj"), "nie-ma-takiego-wpisu");

    await waitFor(() =>
      expect(screen.getByTestId("dziennik-licznik")).toHaveTextContent(`0 z ${AUDYT.length}`),
    );
    expect(screen.getByTestId("dziennik-pusty")).toBeInTheDocument();
  });
});

describe("Przycisk „Usuń wszystko z katalogu” (zakładka Katalog)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    zasiejSesje();
    zamockujApi();
  });

  afterEach(() => vi.restoreAllMocks());

  it("nie wysyła żądania, gdy window.confirm zwróci false", async () => {
    const potwierdzenie = vi.spyOn(window, "confirm").mockReturnValue(false);
    await otworzZakladke("katalog");

    await userEvent.click(await screen.findByTestId("button-clear-products-work"));

    expect(potwierdzenie).toHaveBeenCalledWith(
      "Usunąć wszystko z katalogu? Ta operacja usuwa wszystkie produkty i służy tylko do testów parsera.",
    );
    expect(czyszczenia).toHaveLength(0);
  });

  it("po potwierdzeniu wysyła {potwierdzenie:'WYCZYSC'} i pokazuje toast", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await otworzZakladke("katalog");

    await userEvent.click(await screen.findByTestId("button-clear-products-work"));

    await waitFor(() => expect(czyszczenia).toHaveLength(1));
    expect(czyszczenia[0]).toEqual({ potwierdzenie: "WYCZYSC" });
    expect(await screen.findByText("Katalog wyczyszczony")).toBeInTheDocument();
  });

  /**
   * ⚠ TRZY KLUCZE, NIE JEDEN (`:26117-26125`). Alerty i analityka liczą się z katalogu, więc
   * bez ich unieważnienia Ania po wyczyszczeniu widziałaby alerty o produktach, których
   * już nie ma. Ten test pilnuje kompletu — sam toast niczego by o tym nie powiedział.
   */
  it("unieważnia dokładnie trzy klucze zapytań po udanym czyszczeniu", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const uniewaznienia: unknown[] = [];
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation((filtry) => {
      uniewaznienia.push((filtry as { queryKey?: unknown })?.queryKey);
      return Promise.resolve();
    });
    await otworzZakladke("katalog");

    await userEvent.click(await screen.findByTestId("button-clear-products-work"));

    await waitFor(() => expect(czyszczenia).toHaveLength(1));
    await waitFor(() => expect(uniewaznienia).toHaveLength(3));
    expect(uniewaznienia).toEqual([["/api/products"], ["/api/alerts"], ["/api/analytics"]]);
  });

  it("pokazuje błąd z ciała odpowiedzi", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    server.use(
      http.post("*/api/products/clear", () =>
        HttpResponse.json({ error: "Wymagane potwierdzenie" }, { status: 400 }),
      ),
    );
    await otworzZakladke("katalog");

    await userEvent.click(await screen.findByTestId("button-clear-products-work"));

    expect(await screen.findByText("Błąd czyszczenia")).toBeInTheDocument();
    expect(screen.getByText("Wymagane potwierdzenie")).toBeInTheDocument();
  });
});
