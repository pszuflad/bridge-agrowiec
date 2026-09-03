/**
 * Zakładki „Shoper", „AI Fallback" i „Katalog" (`/konfiguracja`) — Iteracja 11.
 *
 * Dane z `contract/fixtures/GET_config.json`: 11 kluczy nagranych z produkcji.
 *
 * Zakres: że pola startują wartościami z `/api/config`, że zapis idzie SERIĄ osobnych
 * `POST /api/config` (dwa dla Shopera, TRZY dla AI — z wyliczonym `ai_fallback.aktywny`),
 * że odznaka AKTYWNY/SYMULACJA patrzy na pole klucza, że „Przywróć domyślne" nic nie wysyła,
 * że BŁĄD ZAPISU JEST WIDOCZNY — i że zakładka „Katalog" NIE RUSZA SIECI.
 *
 * ⚠ CZEGO TE TESTY NIE POKRYWAJĄ: trwałości wyboru kolumn. Zakładka „Katalog" zapisuje go
 * do IndexedDB (`lib/magazynKV`), a jsdom IndexedDB nie ma — `odczytajKV` zwraca wtedy
 * `undefined`, bo magazyn ŚWIADOMIE połyka błędy (port zachowania oryginału: brak IndexedDB
 * ma cofnąć widok do wartości domyślnych, a nie go wywrócić). Doklejanie `fake-indexeddb`
 * tylko dla tej asercji testowałoby atrapę, nie nasz kod. Sprawdzamy więc to, co jest realnie
 * obserwowalne: stan zaznaczeń, licznik, komunikat i BRAK ruchu sieciowego. Sama ścieżka
 * odczytu przy nieobecnym IndexedDB jest pokryta — pierwszy test startuje właśnie w takim
 * stanie i oczekuje zestawu fabrycznego.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { KLUCZE_STORAGE } from "@/lib/api";
import { _zresetujStanSesji } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { KOLUMNY_DOMYSLNE } from "@/pages/katalog/kolumny";
import {
  dostawcyZFixtura,
  konfiguracjaZFixtura,
  spedycjaZFixtura,
  TOKEN_TESTOWY,
  uzytkownikZFixtura,
} from "./msw/kontrakt";
import { server } from "./msw/server";

const UZYTKOWNIK = uzytkownikZFixtura();
const DOSTAWCY = dostawcyZFixtura();
const SPEDYCJA = spedycjaZFixtura();
const KONFIGURACJA = konfiguracjaZFixtura();

let zapisy: { klucz: string; wartosc: string }[] = [];

function zamockujApi(
  odpowiedzZapisu: () => Response = () => HttpResponse.json({ ok: true }),
  { opoznienieConfigu = 0, config = KONFIGURACJA }: { opoznienieConfigu?: number; config?: Record<string, string> } = {},
) {
  server.use(
    http.get("*/api/dostawcy", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/suppliers", () => HttpResponse.json(DOSTAWCY)),
    http.get("*/api/spedycja", () => HttpResponse.json(SPEDYCJA)),
    http.get("*/api/config", async () => {
      if (opoznienieConfigu > 0) await delay(opoznienieConfigu);
      return HttpResponse.json(config);
    }),
    http.post("*/api/config", async ({ request }) => {
      zapisy.push((await request.json()) as { klucz: string; wartosc: string });
      return odpowiedzZapisu();
    }),
  );
}

function zasiejSesje() {
  sessionStorage.setItem(KLUCZE_STORAGE.uzytkownik, JSON.stringify(UZYTKOWNIK));
  sessionStorage.setItem(KLUCZE_STORAGE.token, TOKEN_TESTOWY);
  _zresetujStanSesji();
}

async function otworzZakladke(wartosc: string) {
  window.history.pushState({}, "", "/konfiguracja");
  render(<App />);
  await screen.findByTestId(`tab-${wartosc}`);
  await userEvent.click(screen.getByTestId(`tab-${wartosc}`));
}

beforeEach(() => {
  zapisy = [];
  sessionStorage.clear();
  localStorage.clear();
  queryClient.clear();
  zasiejSesje();
  zamockujApi();
});

describe("Zakładka „AI Fallback”", () => {
  it("wypełnia pola wartościami z /api/config", async () => {
    await otworzZakladke("ai");

    const model = await screen.findByTestId("input-openai-model");
    expect(model).toHaveValue(KONFIGURACJA["ai_fallback.model"]);
    expect(screen.getByTestId("input-openai-key")).toHaveValue(
      KONFIGURACJA["ai_fallback.klucz_api"],
    );
  });

  it("pokazuje SYMULACJĘ przy pustym kluczu i AKTYWNY po wpisaniu", async () => {
    // Odznaka patrzy na POLE, nie na zapisany `ai_fallback.aktywny` — 1:1 z oryginałem.
    // W nagraniu klucz jest pusty, więc start to zawsze „SYMULACJA".
    await otworzZakladke("ai");
    expect(await screen.findByText("SYMULACJA")).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("input-openai-key"), "sk-proj-abc");

    expect(screen.getByText("AKTYWNY")).toBeInTheDocument();
    expect(screen.queryByText("SYMULACJA")).not.toBeInTheDocument();
  });

  it("zapis wysyła TRZY osobne POST-y, w tym wyliczony `ai_fallback.aktywny`", async () => {
    await otworzZakladke("ai");
    await userEvent.type(await screen.findByTestId("input-openai-key"), "sk-proj-abc");
    await userEvent.click(screen.getByTestId("button-save-ai"));

    await waitFor(() => expect(zapisy).toHaveLength(3));
    expect(zapisy).toEqual([
      { klucz: "ai_fallback.klucz_api", wartosc: "sk-proj-abc" },
      { klucz: "ai_fallback.model", wartosc: KONFIGURACJA["ai_fallback.model"] },
      // Wyprowadzone z klucza — nie ma dla tego osobnego pola w formularzu (`:26000`).
      { klucz: "ai_fallback.aktywny", wartosc: "true" },
    ]);
  });

  it("wyczyszczony klucz zapisuje `ai_fallback.aktywny` jako „false”", async () => {
    await otworzZakladke("ai");
    await userEvent.click(await screen.findByTestId("button-save-ai"));

    await waitFor(() => expect(zapisy).toHaveLength(3));
    expect(zapisy[2]).toEqual({ klucz: "ai_fallback.aktywny", wartosc: "false" });
  });

  it("BŁĄD ZAPISU JEST WIDOCZNY", async () => {
    zamockujApi(() => new HttpResponse("Nieznany klucz konfiguracji", { status: 400 }));
    await otworzZakladke("ai");
    await userEvent.click(await screen.findByTestId("button-save-ai"));

    expect(await screen.findByTestId("komunikat-ai")).toHaveTextContent(/Błąd zapisu/);
  });
});

/**
 * REGRESJA — pierwsze wejście w zakładkę, gdy config NIE JEST jeszcze w cache'u.
 *
 * `useState` bierze wartość początkową wyłącznie przy pierwszym renderze, więc gdyby
 * formularz montował się razem z zapytaniem, pola zamarzłyby na wartościach domyślnych,
 * a „Zapisz" nadpisałby prawdziwą konfigurację. Mock BEZ opóźnienia tego nie wykrywa
 * i nie wykrył: w nagraniu `ai_fallback.model` to akurat `"gpt-4o-mini"`, a `klucz_api`
 * jest puste — czyli dokładnie wartości domyślne formularza. Dlatego opóźniamy odpowiedź
 * ORAZ podstawiamy wartości JAWNIE różne od domyślnych.
 */
describe("pierwsze wejście w zakładkę (config spoza cache'u)", () => {
  const CONFIG_NIEDOMYSLNY = {
    ...KONFIGURACJA,
    "ai_fallback.klucz_api": "sk-proj-zapisany-wczesniej",
    "ai_fallback.model": "gpt-4o",
    "shoper.kolumny": "ean:EAN\nnazwa:Nazwa",
    "shoper.separator": "|",
  };

  it("AI: pola pokazują wartości z serwera, a nie domyślne", async () => {
    zamockujApi(undefined, { opoznienieConfigu: 50, config: CONFIG_NIEDOMYSLNY });
    await otworzZakladke("ai");

    // `findBy*` czeka — o to właśnie chodzi: formularz ma się pojawić PO odpowiedzi.
    expect(await screen.findByTestId("input-openai-model")).toHaveValue("gpt-4o");
    expect(screen.getByTestId("input-openai-key")).toHaveValue("sk-proj-zapisany-wczesniej");
  });

  it("AI: zapis BEZ edycji odsyła wartości z serwera, nie pustkę", async () => {
    // Sedno usterki: Ania wchodzi w zakładkę i klika „Zapisz", niczego nie zmieniając.
    // Zapis nie ma prawa skasować klucza API, który już tam był.
    zamockujApi(undefined, { opoznienieConfigu: 50, config: CONFIG_NIEDOMYSLNY });
    await otworzZakladke("ai");
    await screen.findByTestId("input-openai-model");

    await userEvent.click(screen.getByTestId("button-save-ai"));

    await waitFor(() => expect(zapisy).toHaveLength(3));
    expect(zapisy).toEqual([
      { klucz: "ai_fallback.klucz_api", wartosc: "sk-proj-zapisany-wczesniej" },
      { klucz: "ai_fallback.model", wartosc: "gpt-4o" },
      { klucz: "ai_fallback.aktywny", wartosc: "true" },
    ]);
  });

  it("Shoper: mapowanie i separator pochodzą z serwera, gdy są zapisane", async () => {
    zamockujApi(undefined, { opoznienieConfigu: 50, config: CONFIG_NIEDOMYSLNY });
    await otworzZakladke("shoper");

    const kolumny = await screen.findByTestId<HTMLTextAreaElement>("input-shoper-kolumny");
    expect(kolumny.value).toBe("ean:EAN\nnazwa:Nazwa");
    expect(screen.getByTestId("input-shoper-separator")).toHaveValue("|");
  });
});

describe("Zakładka „Shoper”", () => {
  it("startuje od mapowania domyślnego, bo produkcja nie ma zapisanych kluczy", async () => {
    // `shoper.kolumny` i `shoper.separator` NIE MA w `GET_config.json` — nikt ich w produkcji
    // nie zapisał. Karta musi wtedy pokazać komplet domyślny, a nie puste pole.
    expect(KONFIGURACJA).not.toHaveProperty("shoper.kolumny");
    await otworzZakladke("shoper");

    const kolumny = await screen.findByTestId<HTMLTextAreaElement>("input-shoper-kolumny");
    expect(kolumny.value).toContain("kod:kod_produktu");
    expect(kolumny.value).toContain("rozmiar:rozmiar");
    expect(screen.getByTestId("input-shoper-separator")).toHaveValue(";");
    expect(screen.getByText(/^12 kolumn\./)).toBeInTheDocument();
  });

  it("licznik kolumn liczy WYŁĄCZNIE linie z dwukropkiem", async () => {
    await otworzZakladke("shoper");
    const kolumny = await screen.findByTestId("input-shoper-kolumny");

    // Linia bez dwukropka nie jest mapowaniem — nie ma prawa podbić licznika.
    await userEvent.type(kolumny, "\nsmieciowa linia bez dwukropka");
    expect(screen.getByText(/^12 kolumn\./)).toBeInTheDocument();

    await userEvent.type(kolumny, "\nprofil:Profil");
    expect(screen.getByText(/^13 kolumn\./)).toBeInTheDocument();
  });

  it("zapis wysyła DWA osobne POST-y", async () => {
    await otworzZakladke("shoper");
    await userEvent.clear(await screen.findByTestId("input-shoper-separator"));
    await userEvent.type(screen.getByTestId("input-shoper-separator"), ",");
    await userEvent.click(screen.getByTestId("button-save-shoper"));

    await waitFor(() => expect(zapisy).toHaveLength(2));
    expect(zapisy.map((z) => z.klucz)).toEqual(["shoper.kolumny", "shoper.separator"]);
    expect(zapisy[1]!.wartosc).toBe(",");
  });

  it("„Przywróć domyślne” resetuje pola i NIE wysyła nic", async () => {
    // Oryginał też tylko przestawia stan lokalny (`:26268-26271`) — zapis wymaga kliknięcia
    // „Zapisz konfigurację". Wysyłka stąd byłaby zmianą zachowania.
    await otworzZakladke("shoper");
    await userEvent.clear(await screen.findByTestId("input-shoper-separator"));
    await userEvent.type(screen.getByTestId("input-shoper-separator"), "|");

    await userEvent.click(screen.getByTestId("button-restore-shoper"));

    expect(screen.getByTestId("input-shoper-separator")).toHaveValue(";");
    expect(zapisy).toHaveLength(0);
  });
});

describe("Zakładka „Katalog”", () => {
  it("startuje od zestawu fabrycznego i pokazuje licznik zaznaczonych", async () => {
    await otworzZakladke("katalog");

    expect(await screen.findByTestId("licznik-kolumn")).toHaveTextContent(
      String(KOLUMNY_DOMYSLNE.length),
    );
  });

  it("zaznaczenie kolumny podbija licznik, a zapis NIE rusza sieci", async () => {
    // Cała zakładka jest lokalna. `onUnhandledRequest: "error"` w MSW wywaliłby test, gdyby
    // poszło stąd jakiekolwiek żądanie; licznik `zapisy` dodatkowo pilnuje `/api/config`.
    await otworzZakladke("katalog");
    await screen.findByTestId("licznik-kolumn");

    await userEvent.click(screen.getByTestId("row-kolumna-vat"));
    expect(screen.getByTestId("licznik-kolumn")).toHaveTextContent(
      String(KOLUMNY_DOMYSLNE.length + 1),
    );

    await userEvent.click(screen.getByTestId("button-save-default-cols"));

    expect(await screen.findByTestId("komunikat-katalog")).toHaveTextContent(
      String(KOLUMNY_DOMYSLNE.length + 1),
    );
    expect(zapisy).toHaveLength(0);
  });

  it("„Przywróć fabryczne” wraca do zestawu domyślnego", async () => {
    await otworzZakladke("katalog");
    await screen.findByTestId("licznik-kolumn");

    await userEvent.click(screen.getByTestId("row-kolumna-vat"));
    expect(screen.getByTestId("licznik-kolumn")).toHaveTextContent(
      String(KOLUMNY_DOMYSLNE.length + 1),
    );

    await userEvent.click(screen.getByTestId("button-restore-default-cols"));

    expect(screen.getByTestId("licznik-kolumn")).toHaveTextContent(String(KOLUMNY_DOMYSLNE.length));
    expect(await screen.findByTestId("komunikat-katalog")).toHaveTextContent(
      `Przywrócono fabryczne: ${KOLUMNY_DOMYSLNE.length}`,
    );
  });
});
