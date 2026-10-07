/**
 * Ostatni znany stan Toru 3 (usuwanie z Selly) — ticket 194.
 *
 * ⚠ Po co: przebieg Toru 3, który nie ma czego usuwać, jest CICHY (żadnego wpisu w `selly_sync_log`, żeby nie
 * zaśmiecać dziennika co 15 minut). Z samego dziennika nie dało się więc odróżnić „nic do usunięcia” od „Tor 3
 * nie działa” (wyłączony, brak uprawnień w Selly, wstrzymany bezpiecznikiem). Ten stan żyje w pamięci procesu
 * i jest oddawany przez `GET /api/selly/usuwanie-status`; po restarcie jest pusty do najbliższego przebiegu
 * (HH:10/25/40/55), dlatego panel pokazuje wtedy „czeka na pierwszy przebieg”.
 */

export type WynikTor3 =
  | "brak_sierot" // przebieg poszedł, nie ma czego usuwać
  | "usunieto" // coś usunięto (wariant, produkt albo samo mapowanie)
  | "pominieto" // są sieroty, ale żadna nie przeszła kontroli tożsamości — nic nie usunięto
  | "wstrzymano" // bezpiecznik (pusty katalog albo za dużo sierot)
  | "limit_dobowy" // wyczerpany limit usunięć na dobę
  | "brak_uprawnien" // API Selly nie ma prawa DELETE
  | "proba_nieokreslona" // próba uprawnień nie dała jednoznacznej odpowiedzi
  | "wylaczone" // wyłączone konfiguracją (SELLY_USUWANIE albo tryb inny niż pełny)
  | "blad"; // przebieg zakończył się błędem

export type StanTor3 = {
  /** ISO UTC chwili zapisu stanu. */
  kiedy: string;
  wynik: WynikTor3;
  opis: string;
  sieroty?: number;
  usuniete?: number;
  pominiete?: number;
  bledy?: number;
};

let ostatni: StanTor3 | null = null;

export function zapiszStanTor3(stan: Omit<StanTor3, "kiedy">): void {
  ostatni = { kiedy: new Date().toISOString(), ...stan };
}

export function odczytajStanTor3(): StanTor3 | null {
  return ostatni;
}

/** Tylko do testów. */
export function zresetujStanTor3(): void {
  ostatni = null;
}
