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
let dziedziczeniaWagi = 0;
let szacowanWagi = 0;

function zamockujApi(opcje: { odpowiedzPatcha?: () => Response } = {}) {
  patche = [];
  czyszczenia = [];
  usunieciaNieOpon = 0;
  dziedziczeniaWagi = 0;
  szacowanWagi = 0;
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
    http.post("*/api/products/dziedzicz-wage", () => {
      dziedziczeniaWagi += 1;
      return HttpResponse.json({
        ok: true,
        wszystkichKandydatow: 5,
        zaktualizowano: 2,
        pominietoOverride: 1,
        pominietoBrakDanych: 1,
        pominietoBrakDopasowania: 1,
      });
    }),
    http.post("*/api/products/oszacuj-wage", () => {
      szacowanWagi += 1;
      return HttpResponse.json({
        ok: true,
        wszystkichKandydatow: 4,
        zaktualizowano: 3,
        pominietoOverride: 0,
        pominietoBrakDanych: 0,
        pominietoBrakSredniej: 1,
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
     * STRAŻNIK DECYZJI (I14/14c, plan.md D3). Karta dostawcy ma select presetów częstotliwości
     * (wchłonięty `freq-injection.js`), a ten dialog ŚWIADOMIE ma samo surowe pole liczbowe.
     * To nie jest niespójność do „posprzątania":
     *  - dialog wysyła TYLKO pola zmienione, bo backend rozróżnia „nie ruszaj" od „wyczyść";
     *    select zawsze ma wartość, więc samo otwarcie zaczęłoby wysyłać częstotliwość;
     *  - dla `/api/admin/supplier-config` nie ma w oryginale ŻADNEGO React UI, więc nie ma
     *    czego odtwarzać ani z czym ujednolicać.
     * Ten test istnieje po to, żeby następna sesja nie dołożyła tu selectu z rozpędu.
     */
    it("ŚWIADOMIE nie ma selectu presetów — częstotliwość to surowe pole liczbowe", async () => {
      await otworzDialog();

      const pole = screen.getByTestId("input-admin-czestotliwosc");
      expect(pole).toHaveAttribute("type", "number");
      expect(screen.queryByTestId("select-admin-czestotliwosc")).not.toBeInTheDocument();
      // Jedyny select w dialogu to status — gdyby doszedł drugi, to znak, że ktoś ujednolicił.
      expect(screen.getByTestId("select-admin-status")).toBeInTheDocument();
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
    /**
     * Od 12e (D5, backlog #51) przycisk pyta przez `DialogPotwierdzenia`, nie przez natywny
     * `window.confirm` — w odróżnieniu od bliźniaczego „Usuń wszystko z katalogu" w zakładce
     * „Katalog", gdzie natywny dialog jest ŚWIADOMYM, opisanym wyjątkiem i zostaje.
     */
    it("nie wysyła żądania, gdy potwierdzenie odrzucono", async () => {
      await otworzZakladke("admin");

      await userEvent.click(await screen.findByTestId("button-usun-nieopony"));
      await userEvent.click(
        within(await screen.findByTestId("dialog-usun-nieopony")).getByTestId("button-anuluj"),
      );

      expect(usunieciaNieOpon).toBe(0);
    });

    it("pyta tekstem przeniesionym dosłownie z `confirm()`", async () => {
      await otworzZakladke("admin");

      await userEvent.click(await screen.findByTestId("button-usun-nieopony"));

      expect(
        await screen.findByText(
          "Usunąć z katalogu wszystkie pozycje, które nie są oponami? Operacji nie da się cofnąć.",
        ),
      ).toBeInTheDocument();
      expect(usunieciaNieOpon).toBe(0);
    });

    it("po potwierdzeniu usuwa nie-opony i pokazuje podsumowanie", async () => {
      await otworzZakladke("admin");

      await userEvent.click(await screen.findByTestId("button-usun-nieopony"));
      await userEvent.click(
        within(await screen.findByTestId("dialog-usun-nieopony")).getByTestId("button-potwierdz"),
      );

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

  /**
   * Przycisk „Dociągnij wagę" — ticket 156 (NOWA logika, nie port; nadbudowa nad ticketem 155).
   * Bez `window.confirm`: nie jest destrukcyjny.
   */
  describe("Przycisk „Dociągnij wagę”", () => {
    it("wywołuje endpoint bez potwierdzenia i pokazuje wynik w toaście", async () => {
      const potwierdzenie = vi.spyOn(window, "confirm");
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-dziedzicz-wage"));

      await waitFor(() => expect(dziedziczeniaWagi).toBe(1));
      expect(potwierdzenie).not.toHaveBeenCalled();
      expect(await screen.findByText("Waga dociągnięta")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Zaktualizowano 2 z 5 produktów (pominięto: 1 ręczna poprawka, 1 brak marki/rozmiaru, 1 brak pasującego produktu).",
        ),
      ).toBeInTheDocument();

      // Ticket 166: gdy zostają nieuzupełnione (5 kandydatów, 2 zaktualizowane), pod przyciskiem
      // zostaje trwały (nie tylko w znikającym toaście) link do przefiltrowanego katalogu.
      const link = await screen.findByTestId("link-brak-wagi");
      expect(link).toHaveAttribute("href", "/katalog?status=brak_waga");
    });

    it("nie pokazuje linku do braków, gdy wszystkie produkty zostały zaktualizowane", async () => {
      server.use(
        http.post("*/api/products/dziedzicz-wage", () =>
          HttpResponse.json({
            ok: true,
            wszystkichKandydatow: 3,
            zaktualizowano: 3,
            pominietoOverride: 0,
            pominietoBrakDanych: 0,
            pominietoBrakDopasowania: 0,
          }),
        ),
      );
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-dziedzicz-wage"));

      await screen.findByTestId("wynik-dziedziczenia-wagi");
      expect(screen.queryByTestId("link-brak-wagi")).not.toBeInTheDocument();
    });

    it("unieważnia zapytanie /api/products po udanym dociągnięciu", async () => {
      const uniewaznienia: unknown[] = [];
      vi.spyOn(queryClient, "invalidateQueries").mockImplementation((filtry) => {
        uniewaznienia.push((filtry as { queryKey?: unknown })?.queryKey);
        return Promise.resolve();
      });
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-dziedzicz-wage"));

      await waitFor(() => expect(dziedziczeniaWagi).toBe(1));
      await waitFor(() => expect(uniewaznienia).toEqual([["/api/products"]]));
    });

    it("pokazuje błąd, gdy backend odpowie niepowodzeniem", async () => {
      server.use(
        http.post("*/api/products/dziedzicz-wage", () =>
          HttpResponse.json({ error: "Baza niedostępna" }, { status: 500 }),
        ),
      );
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-dziedzicz-wage"));

      expect(await screen.findByText("Błąd dociągania wagi")).toBeInTheDocument();
      // Komunikat wyciągnięty z ciała odpowiedzi (`{error: "..."}"), nie surowy status+JSON.
      expect(screen.getByText("Baza niedostępna")).toBeInTheDocument();
    });

    /** Ticket 166, review fix: wynik poprzedniego SUKCESU nie może przeżyć kolejnego błędu. */
    it("kasuje wynik poprzedniego przebiegu, gdy kolejne wywołanie się nie powiedzie", async () => {
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-dziedzicz-wage"));
      await screen.findByTestId("link-brak-wagi");

      server.use(
        http.post("*/api/products/dziedzicz-wage", () =>
          HttpResponse.json({ error: "Baza niedostępna" }, { status: 500 }),
        ),
      );
      await userEvent.click(screen.getByTestId("button-dziedzicz-wage"));

      await screen.findByText("Błąd dociągania wagi");
      expect(screen.queryByTestId("link-brak-wagi")).not.toBeInTheDocument();
      expect(screen.queryByTestId("wynik-dziedziczenia-wagi")).not.toBeInTheDocument();
    });
  });

  /**
   * Przycisk „Oszacuj pozostałe wagi" — ticket 167 (NOWA logika, świadomie MNIEJ PEWNA niż
   * „Dociągnij wagę"). Bez `window.confirm`: nie jest destrukcyjny.
   */
  describe("Przycisk „Oszacuj pozostałe wagi”", () => {
    it("wywołuje endpoint bez potwierdzenia i pokazuje wynik w toaście oraz link do braków", async () => {
      const potwierdzenie = vi.spyOn(window, "confirm");
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-oszacuj-wage"));

      await waitFor(() => expect(szacowanWagi).toBe(1));
      expect(potwierdzenie).not.toHaveBeenCalled();
      expect(await screen.findByText("Waga oszacowana")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Oszacowano 3 z 4 produktów (pominięto: 0 ręczna poprawka, 0 brak rozmiaru, 1 brak jakiegokolwiek produktu tego rozmiaru z wagą).",
        ),
      ).toBeInTheDocument();

      const link = await screen.findByTestId("link-brak-wagi-szacowanie");
      expect(link).toHaveAttribute("href", "/katalog?status=brak_waga");
    });

    it("nie pokazuje linku do braków, gdy wszystkie produkty zostały oszacowane", async () => {
      server.use(
        http.post("*/api/products/oszacuj-wage", () =>
          HttpResponse.json({
            ok: true,
            wszystkichKandydatow: 2,
            zaktualizowano: 2,
            pominietoOverride: 0,
            pominietoBrakDanych: 0,
            pominietoBrakSredniej: 0,
          }),
        ),
      );
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-oszacuj-wage"));

      await screen.findByTestId("wynik-szacowania-wagi");
      expect(screen.queryByTestId("link-brak-wagi-szacowanie")).not.toBeInTheDocument();
    });

    it("pokazuje błąd, gdy backend odpowie niepowodzeniem", async () => {
      server.use(
        http.post("*/api/products/oszacuj-wage", () =>
          HttpResponse.json({ error: "Baza niedostępna" }, { status: 500 }),
        ),
      );
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-oszacuj-wage"));

      expect(await screen.findByText("Błąd szacowania wagi")).toBeInTheDocument();
      expect(screen.getByText("Baza niedostępna")).toBeInTheDocument();
    });

    it("unieważnia zapytanie /api/products po udanym oszacowaniu", async () => {
      const uniewaznienia: unknown[] = [];
      vi.spyOn(queryClient, "invalidateQueries").mockImplementation((filtry) => {
        uniewaznienia.push((filtry as { queryKey?: unknown })?.queryKey);
        return Promise.resolve();
      });
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-oszacuj-wage"));

      await waitFor(() => expect(szacowanWagi).toBe(1));
      await waitFor(() => expect(uniewaznienia).toEqual([["/api/products"]]));
    });
  });
  describe("Uzupełnianie zdjęć (ticket 203)", () => {
    const propozycja = (id: number, kod: string) => ({
      id,
      kod,
      dostawca: "MO1",
      nazwa: `Opona ${kod}`,
      marka: "BKT",
      model: "AGRIMAX RT 765",
      link: "https://foto.example/a.jpg",
      produktow: 3,
      wariantow: 1,
    });
    const PODGLAD = {
      ok: true,
      dry_run: true,
      wszystkichPustych: 4,
      pominietoPoprawka: 1,
      pominietoBrakDanych: 0,
      pominietoBrakDopasowania: 1,
      propozycje: [propozycja(11, "A1"), propozycja(12, "A2")],
    };

    it("najpierw pokazuje podgląd (bez zapisu), potem zapisuje tylko zaznaczone", async () => {
      const ciala: Record<string, unknown>[] = [];
      server.use(
        http.post("*/api/products/uzupelnij-zdjecia", async ({ request }) => {
          const cialo = (await request.json()) as Record<string, unknown>;
          ciala.push(cialo);
          return cialo.dry_run
            ? HttpResponse.json(PODGLAD)
            : HttpResponse.json({ ok: true, dry_run: false, zaktualizowano: 1, pominiete: 0 });
        }),
      );
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-podglad-zdjec"));
      await screen.findByTestId("propozycja-zdjecia-11");
      expect(ciala).toEqual([{ dry_run: true }]);
      expect(screen.getByTestId("podglad-zdjec-podsumowanie")).toHaveTextContent(
        "Produktów bez linku: 4. Propozycje: 2.",
      );
      expect(screen.getByTestId("button-zapisz-zdjecia")).toHaveTextContent("Zapisz wybrane (2)");
      // Pozycje bez linku (4) mają stały link do katalogu z filtrem „Brak zdjęcia".
      const link = screen.getByTestId("link-brak-zdjecia");
      expect(link).toHaveAttribute("href", "/katalog?status=brak_zdjecia");
      expect(link).toHaveTextContent("(4)");

      await userEvent.click(screen.getByTestId("wybor-zdjecia-12"));
      expect(screen.getByTestId("button-zapisz-zdjecia")).toHaveTextContent("Zapisz wybrane (1)");
      await userEvent.click(screen.getByTestId("button-zapisz-zdjecia"));

      await waitFor(() => expect(ciala).toEqual([{ dry_run: true }, { ids: [11] }]));
      expect(await screen.findByText("Zdjęcia uzupełnione")).toBeInTheDocument();
      expect(screen.queryByTestId("podglad-zdjec")).toBeNull();
    });

    it("pokazuje błąd podglądu z backendu", async () => {
      server.use(
        http.post("*/api/products/uzupelnij-zdjecia", () =>
          HttpResponse.json({ error: "Baza niedostępna" }, { status: 500 }),
        ),
      );
      await otworzZakladke("katalog");

      await userEvent.click(await screen.findByTestId("button-podglad-zdjec"));

      expect(await screen.findByText("Błąd podglądu zdjęć")).toBeInTheDocument();
      expect(screen.getByText("Baza niedostępna")).toBeInTheDocument();
    });
  });
});
