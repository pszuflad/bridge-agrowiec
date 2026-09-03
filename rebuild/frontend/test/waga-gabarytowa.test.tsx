/**
 * Widok `/waga-gabarytowa` — Iteracja 9.
 *
 * ⚠ ŻADNEGO MSW W TYM PLIKU I TO JEST ASERCJA SAMA W SOBIE. Widok liczy lokalnie i NIE woła
 * backendu (plan.md D1); setup testów ma `onUnhandledRequest: "error"`, więc gdyby ktoś
 * kiedyś podpiął tu `fetch`, testy wywalą się na nieobsłużonym żądaniu — i dobrze,
 * bo to byłaby zmiana zachowania widoczna dla Ani.
 *
 * IndexedDB nie istnieje w jsdomie, a `magazynKV` po cichu to połyka i cofa widok do wartości
 * domyślnych — dokładnie jak oryginał w przeglądarce z zablokowanymi danymi witryny.
 * Dlatego testujemy tu zachowanie w sesji, bez atrapy magazynu.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { WagaGabarytowa } from "@/pages/WagaGabarytowa";

function pokaz() {
  return render(
    <ToastProvider>
      <WagaGabarytowa />
    </ToastProvider>,
  );
}

/** Nadpisuje pole formularza — inputy są kontrolowane, więc czyścimy przed wpisaniem. */
async function wpisz(uzytkownik: ReturnType<typeof userEvent.setup>, testid: string, tekst: string) {
  const pole = screen.getByTestId(testid);
  await uzytkownik.clear(pole);
  await uzytkownik.type(pole, tekst);
}

describe("widok wagi gabarytowej — kalkulator", () => {
  it("startuje z wymiarami 60/50/50 i pustym wynikiem", async () => {
    pokaz();

    expect(screen.getByTestId("input-dlugosc")).toHaveValue(60);
    expect(screen.getByTestId("input-szerokosc")).toHaveValue(50);
    expect(screen.getByTestId("input-wysokosc")).toHaveValue(50);
    expect(screen.getByTestId("input-waga-rzecz")).toHaveValue(null);
    expect(screen.getByText(/Wypełnij wymiary i kliknij/)).toBeInTheDocument();
  });

  /** Domyślna paczka u GEIS-a: 60 × 50 × 50 / 10 000 = 15 kg, objętość 0,1500 m³. */
  it("liczy wagę po kliknięciu i pokazuje rozbicie", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("15.00 kg");
    expect(screen.getByText("Waga gabarytowa (GEIS Polska)")).toBeInTheDocument();
    expect(screen.getByText("60 × 50 × 50 ÷ 10000")).toBeInTheDocument();
    expect(screen.getByText("0.1500 m³")).toBeInTheDocument();
  });

  it("zmiana przewoźnika przelicza wynik innym dzielnikiem", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.selectOptions(screen.getByTestId("select-przewoznik"), "dpd");
    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("25.00 kg");
  });

  it("waga rzeczywista większa od gabarytowej wygrywa w wadze do wyceny", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await wpisz(uzytkownik, "input-waga-rzecz", "22.5");
    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByTestId("text-waga-do-wyceny")).toHaveTextContent("22.50 kg");
    expect(screen.getByText(/Rzeczywista > gabarytowa/)).toBeInTheDocument();
  });

  it("bez wagi rzeczywistej nie pokazuje wagi do wyceny", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    await screen.findByTestId("text-wynik-waga");
    expect(screen.queryByTestId("text-waga-do-wyceny")).not.toBeInTheDocument();
  });

  it("niepoprawne wymiary dają komunikat zamiast wyniku", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await wpisz(uzytkownik, "input-dlugosc", "0");
    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByText("Niepoprawne wymiary")).toBeInTheDocument();
    expect(screen.queryByTestId("text-wynik-waga")).not.toBeInTheDocument();
  });
});

describe("widok wagi gabarytowej — edytor przewoźników", () => {
  it("pokazuje sześciu domyślnych przewoźników z przykładem dla paczki 60×50×50", () => {
    pokaz();

    expect(screen.getByText("GEIS Polska")).toBeInTheDocument();
    expect(screen.getByText("DHL Parcel")).toBeInTheDocument();
    // 150 000 / 4 000 = 37,50 kg — kolumna „Przykład" dla GLS.
    expect(screen.getByText("37.50 kg")).toBeInTheDocument();
  });

  it("pola edycji pojawiają się dopiero po wejściu w tryb edycji", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    expect(screen.queryByTestId("input-nazwa-geis")).not.toBeInTheDocument();
    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));

    expect(screen.getByTestId("input-nazwa-geis")).toBeInTheDocument();
    expect(screen.getByTestId("input-dzielnik-geis")).toBeInTheDocument();
    expect(screen.getByText("Gotowe")).toBeInTheDocument();
  });

  it("dodaje własnego przewoźnika i pozwala nim liczyć", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.type(screen.getByTestId("input-nowy-nazwa"), "Pocztex");
    await uzytkownik.type(screen.getByTestId("input-nowy-dzielnik"), "3000");
    await uzytkownik.click(screen.getByTestId("button-dodaj-przewoznika"));

    // W trybie edycji nazwy są inputami, nie tekstem — nowy wiersz poznajemy po polu nazwy.
    const nowaNazwa = await screen.findByDisplayValue("Pocztex");
    expect(nowaNazwa).toBeInTheDocument();
    expect(screen.getByText("50.00 kg")).toBeInTheDocument(); // kolumna „Przykład": 150 000 / 3 000

    // 60 × 50 × 50 / 3 000 = 50 kg
    await uzytkownik.selectOptions(
      screen.getByTestId("select-przewoznik"),
      screen.getByRole("option", { name: /Pocztex/ }),
    );
    await uzytkownik.click(screen.getByTestId("button-oblicz"));

    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("50.00 kg");
  });

  it("odmawia dodania przewoźnika bez nazwy albo z niedodatnim dzielnikiem", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.type(screen.getByTestId("input-nowy-dzielnik"), "3000");
    await uzytkownik.click(screen.getByTestId("button-dodaj-przewoznika"));

    expect(await screen.findByText("Brak danych")).toBeInTheDocument();
  });

  it("usuwa przewoźnika z listy", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    expect(screen.getByRole("option", { name: /DHL Parcel/ })).toBeInTheDocument();

    await uzytkownik.click(screen.getByTestId("button-usun-dhl"));

    await waitFor(() =>
      expect(screen.queryByTestId("button-usun-dhl")).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("option", { name: /DHL Parcel/ })).not.toBeInTheDocument();
  });

  /**
   * Usunięcie AKTUALNIE WYBRANEGO przewoźnika przenosi wybór na pierwszego z pozostałych —
   * bez tego kalkulator zostałby bez dzielnika (`:26881-26885`).
   */
  it("usunięcie wybranego przewoźnika przenosi wybór na kolejnego", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.click(screen.getByTestId("button-usun-geis"));

    await waitFor(() => expect(screen.getByTestId("select-przewoznik")).toHaveValue("dpd"));

    await uzytkownik.click(screen.getByTestId("button-oblicz"));
    expect(await screen.findByTestId("text-wynik-waga")).toHaveTextContent("25.00 kg");
  });

  /** Ostatni przewoźnik musi zostać — inaczej nie ma czym dzielić. */
  it("nie pozwala usunąć ostatniego przewoźnika", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    for (const id of ["dhl", "ups", "inpost", "gls", "dpd"]) {
      await uzytkownik.click(screen.getByTestId(`button-usun-${id}`));
    }
    await uzytkownik.click(screen.getByTestId("button-usun-geis"));

    expect(await screen.findByText("Nie można usunąć")).toBeInTheDocument();
    expect(screen.getByDisplayValue("GEIS Polska")).toBeInTheDocument();
    expect(screen.getByTestId("select-przewoznik")).toHaveValue("geis");
  });

  it("„Przywróć domyślne” cofa listę i wybór po zmianach", async () => {
    const uzytkownik = userEvent.setup();
    pokaz();

    await uzytkownik.click(screen.getByTestId("button-edycja-przewoznikow"));
    await uzytkownik.selectOptions(screen.getByTestId("select-przewoznik"), "dpd");
    await uzytkownik.click(screen.getByTestId("button-usun-dhl"));
    await waitFor(() =>
      expect(screen.queryByTestId("button-usun-dhl")).not.toBeInTheDocument(),
    );

    await uzytkownik.click(screen.getByTestId("button-przywroc-domyslne"));

    // Wraca i lista (skasowany DHL), i wybór (z DPD z powrotem na GEIS-a).
    expect(await screen.findByTestId("button-usun-dhl")).toBeInTheDocument();
    expect(screen.getByTestId("select-przewoznik")).toHaveValue("geis");
  });
});
