// Generator EAN-ów uzupełniających — ticket 168-FEATURE-uzupelnianie-ean-999.
//
// ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT (produkcja nie ma tej reguły). Decyzja użytkownika, 2026-09-30.
//
// EAN-13 = prefiks `999` + 9-cyfrowy NUMER KOLEJNY (z zerami z lewej) + cyfra kontrolna.
// Numer pochodzi z licznika w tabeli `ean_pary`, a nie z losowania — losowe cyfry grożą
// kolizją między różnymi produktami (urodziny przy ~10⁹ numerów), a licznik nie. Cyfra
// kontrolna jest obowiązkowa: `validateEan` (`import/legacy/staging_policy.cjs`) odrzuca
// EAN-13 z błędną sumą, więc „999 + dowolne cyfry" nie przeszłoby walidacji importu.

import { poprawnaSumaKontrolnaEan13 } from "../import/silnik/ean.js";

export const PREFIKS_EAN = "999";
/** Liczba cyfr numeru kolejnego (13 − 3 prefiks − 1 cyfra kontrolna). */
const DLUGOSC_NUMERU = 9;
export const MAKS_NUMER = 10 ** DLUGOSC_NUMERU - 1;

/** Cyfra kontrolna EAN-13 dla dwunastu pierwszych cyfr. */
export function cyfraKontrolnaEan13(dwanascie: string): number {
  if (!/^\d{12}$/.test(dwanascie)) throw new Error(`Oczekiwano 12 cyfr, jest: „${dwanascie}”`);
  let suma = 0;
  for (let i = 0; i < 12; i += 1) {
    const cyfra = Number(dwanascie[i]);
    suma += i % 2 === 0 ? cyfra : cyfra * 3;
  }
  return (10 - (suma % 10)) % 10;
}

/** EAN-13 dla numeru kolejnego 1…999 999 999. */
export function eanZNumeru(numer: number): string {
  if (!Number.isInteger(numer) || numer < 1 || numer > MAKS_NUMER) {
    throw new Error(`Numer EAN poza zakresem 1…${MAKS_NUMER}: ${numer}`);
  }
  const dwanascie = PREFIKS_EAN + String(numer).padStart(DLUGOSC_NUMERU, "0");
  const ean = dwanascie + cyfraKontrolnaEan13(dwanascie);
  // Samokontrola względem walidatora importu — rozjazd tu oznacza błąd w generatorze.
  if (!poprawnaSumaKontrolnaEan13(ean)) throw new Error(`Wygenerowano niepoprawny EAN: ${ean}`);
  return ean;
}

/** Pusty EAN to NULL, `""` albo same białe znaki — tylko takie pola uzupełnia reguła. */
export function pustyEan(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}
