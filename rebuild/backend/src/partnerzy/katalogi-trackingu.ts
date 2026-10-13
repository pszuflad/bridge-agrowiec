// Katalogi trackingu partnerów wyprowadzone z już ustawionych katalogów zamówień (ticket 257) — dla kroku wdrożenia `2026-10-13-partnerzy-katalogi-trackingu`.
//
// Ścieżki serwera plików partnerów NIE są wpisane w repozytorium (jest publiczne, a nazwy katalogów partnerów to część zabezpieczenia): krok czyta
// `PARTNERZY_KATALOGI_ZAMOWIEN` z `.env` produkcji i buduje z niego `PARTNERZY_KATALOGI_TRACKINGU` wg układu katalogów partnerów
// (odczyt serwera 2026-10-12): Adtyres `…/customer/orders` → obok `…/customer/trackings`; TyreWorld katalog zamówień `…/imports/tyreworld` → podkatalog `tracking`.
// Wyprowadzony katalog trafia do wyniku tylko wtedy, gdy ISTNIEJE na serwerze (nie wskazujemy ścieżek donikąd).

import { statSync } from "node:fs";

import { parsujKatalogiPublikacji } from "./publikacja.js";

const istnieje = (sciezka: string): boolean => {
  try {
    return statSync(sciezka).isDirectory();
  } catch {
    return false;
  }
};

export type WynikWyprowadzenia = { wartosc: string | null; pominiete: string[] };

/** `Adtyres=…;TyreWorld=…` dla partnerów, których katalog trackingu da się wyprowadzić i istnieje; inaczej `wartosc = null`. Niepoprawne wejście → błąd z opisem. */
export function wyprowadzKatalogiTrackingu(zamowien: string | undefined, czyIstnieje: (sciezka: string) => boolean = istnieje): WynikWyprowadzenia {
  const wynik: WynikWyprowadzenia = { wartosc: null, pominiete: [] };
  const katalogi = parsujKatalogiPublikacji(zamowien, "PARTNERZY_KATALOGI_ZAMOWIEN");
  const wpisy: string[] = [];
  const sprobuj = (nazwa: string, klucz: string, wyprowadz: (s: string) => string | null): void => {
    const zrodlo = katalogi.get(klucz);
    if (!zrodlo) return void wynik.pominiete.push(`${nazwa}: brak wpisu w PARTNERZY_KATALOGI_ZAMOWIEN`);
    const cel = wyprowadz(zrodlo.replace(/\/+$/, ""));
    if (!cel) return void wynik.pominiete.push(`${nazwa}: katalog zamówień ma nietypowy układ — nie da się wyprowadzić katalogu trackingu`);
    if (!czyIstnieje(cel)) return void wynik.pominiete.push(`${nazwa}: katalog trackingu nie istnieje na serwerze`);
    wpisy.push(`${nazwa}=${cel}`);
  };
  sprobuj("Adtyres", "adtyres", (s) => (s.endsWith("/orders") ? `${s.slice(0, -"/orders".length)}/trackings` : null));
  sprobuj("TyreWorld", "tyreworld", (s) => `${s}/tracking`);
  wynik.wartosc = wpisy.length ? wpisy.join(";") : null;
  return wynik;
}
