/**
 * Rekord podglądu — kształt po `adapter.recordsToSurowe()` z portu parserów (3a).
 * Backend odsyła pierwsze 5 takich rekordów w polu `podglad`.
 *
 * Pola opcjonalne, bo adapter wypełnia je per dostawca i większość bywa `null`.
 */
export type RekordPodgladu = {
  kod?: string | null;
  ean?: string | null;
  nazwa?: string | null;
  marka?: string | null;
  rozmiar?: string | null;
  cenaZakupu?: number | null;
  stan?: number | null;
};
