/**
 * Dane startowe spedycji i konfiguracji — port stałych `xR` i `vR`
 * (`deminified/backend-index.cjs:45571-45644`), zasiewanych przez `zw()` (`:45690-45724`)
 * przy pierwszym uruchomieniu na pustej bazie.
 *
 * Trzymamy je w `src/`, a nie w `test/`, bo to dane PRODUKTU, nie testów: seed
 * deweloperski i harness GATE mają korzystać z jednego źródła. Zgodność z produkcją jest
 * sprawdzalna wprost — `contract/fixtures/GET_config.json` to dokładnie `KONFIGURACJA_POCZATKOWA`,
 * a `GET_spedycja.json` to pierwsze pięć wierszy `SPEDYCJA_POCZATKOWA` (fixture przycięty
 * do 5 z 10, `_body_przyciete_z`).
 *
 * ⚠ Kolejność wierszy spedycji ma znaczenie: `GET /api/spedycja` nie sortuje niczego
 * (port `U.listSpedycja()`, `:45074`), więc kolejność w odpowiedzi wynika z kolejności
 * wstawiania. MO1…MO10, jak w oryginale.
 */

export type WierszSpedycjiPoczatkowy = {
  dostawcaKod: string;
  progNetto: number | null;
  kosztPonizej: number;
  kosztPowyzej: number;
  dodatkoweReguly: string;
};

/** Port `xR` (`:45571-45632`) — 10 wierszy, MO1…MO10. */
export const SPEDYCJA_POCZATKOWA: WierszSpedycjiPoczatkowy[] = [
  {
    dostawcaKod: "MO1",
    progNetto: 1100,
    kosztPonizej: 89,
    kosztPowyzej: 0,
    dodatkoweReguly: "Bohnenkamp: powyżej progu — gratis",
  },
  {
    dostawcaKod: "MO2",
    progNetto: 6000,
    kosztPonizej: 119,
    kosztPowyzej: 0,
    dodatkoweReguly: 'JMK: felgi 4-10" → 29 zł; paczka ≤ 80×60 → 119 zł; > 80×60 → 340 zł',
  },
  {
    dostawcaKod: "MO3",
    progNetto: null,
    kosztPonizej: 119,
    kosztPowyzej: 0,
    dodatkoweReguly: "Grasdorf: wg gabarytu: ≤120×80 → 119; ≤120×120 → 189; ≤185×120 → 299; > → 449 zł",
  },
  {
    dostawcaKod: "MO4",
    progNetto: null,
    kosztPonizej: 0,
    kosztPowyzej: 0,
    dodatkoweReguly: "Handlopex WR: gratis",
  },
  {
    dostawcaKod: "MO5",
    progNetto: null,
    kosztPonizej: 0,
    kosztPowyzej: 0,
    dodatkoweReguly: "Handlopex RZ: gratis",
  },
  {
    dostawcaKod: "MO6",
    progNetto: null,
    kosztPonizej: 119,
    kosztPowyzej: 0,
    dodatkoweReguly: "Agrowiec: wg gabarytu (jak Grasdorf)",
  },
  {
    dostawcaKod: "MO7",
    progNetto: null,
    kosztPonizej: 0,
    kosztPowyzej: 0,
    dodatkoweReguly: "Nokian: gratis",
  },
  {
    dostawcaKod: "MO8",
    progNetto: 1100,
    kosztPonizej: 49,
    kosztPowyzej: 0,
    dodatkoweReguly: "Trelleborg: powyżej progu — gratis",
  },
  {
    dostawcaKod: "MO9",
    progNetto: null,
    kosztPonizej: 0,
    kosztPowyzej: 0,
    dodatkoweReguly: "Agro-Rami: wymaga audytu",
  },
  {
    dostawcaKod: "MO10",
    progNetto: null,
    kosztPonizej: 0,
    kosztPowyzej: 0,
    dodatkoweReguly: "GRI: brak danych",
  },
];

/**
 * Port `vR` (`:45632-45644`) — 11 kluczy, same stringi.
 *
 * Puste wartości przy `ai_fallback.klucz_api`, `shoper.adres_sklepu` i `shoper.token_api`
 * to REALNE wartości seeda, a nie sanityzacja fixture'a ani maskowanie na odczycie —
 * oryginał nie maskuje niczego w `GET /api/config`.
 */
export const KONFIGURACJA_POCZATKOWA: Record<string, string> = {
  "waga_gab.szer_polpaleta": "55",
  "waga_gab.szer_paleta": "80",
  "waga_gab.wys_palety": "10",
  "waga_gab.wspolczynnik": "0.000167",
  "waga_gab.opis_wspolczynnik": "DPD 1/6000 (1 m³ = 167 kg)",
  "ai_fallback.klucz_api": "",
  "ai_fallback.model": "gpt-4o-mini",
  "ai_fallback.aktywny": "false",
  "shoper.adres_sklepu": "",
  "shoper.token_api": "",
  "shoper.format_eksportu": "ean;nazwa;producent;rozmiar;cena_netto;magazyn;vat",
};
