/**
 * Zakładki strony `/alerty` (karta P6.2) — w adresie, żeby Pulpit mógł linkować wprost do
 * właściwej listy. Domyślna jest „Import" (bez parametru).
 */
export const ZAKLADKA_IMPORT = "import";
export const ZAKLADKA_KATALOG = "katalog";
export type Zakladka = typeof ZAKLADKA_IMPORT | typeof ZAKLADKA_KATALOG;

export function adresZakladki(zakladka: Zakladka): string {
  return zakladka === ZAKLADKA_KATALOG ? `/alerty?zakladka=${ZAKLADKA_KATALOG}` : "/alerty";
}
