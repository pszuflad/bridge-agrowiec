/**
 * Algorytm sugerowania aliasów — `levenshtein` / `similarity` / `shouldSuggestAlias`
 * z `mirror/backend/pending_module.cjs:41-72`.
 *
 * To jest jedyne miejsce w tej domenie, gdzie liczy się LICZBA, a nie kształt: fixture
 * `GET_atrybuty_pending.json` pokazuje wyniki (`podobienstwo: 92`), ale nie dowodzi, jak
 * powstały. Wartości poniżej są policzone ręcznie ze wzoru oryginału
 * (`1 - dystans / max(dł. a, dł. b)`, potem `Math.round(× 100)`).
 */
import { describe, expect, it } from "vitest";

import {
  czySugerowacAlias,
  levenshtein,
  podobienstwo,
} from "../src/repos/atrybuty-pending.js";

describe("podobieństwo wartości atrybutów", () => {
  describe("levenshtein", () => {
    it("liczy podstawowe operacje edycyjne", () => {
      expect(levenshtein("", "")).toBe(0);
      expect(levenshtein("", "abc")).toBe(3);
      expect(levenshtein("abc", "")).toBe(3);
      expect(levenshtein("abc", "abc")).toBe(0);
      expect(levenshtein("abc", "abd")).toBe(1); // podmiana
      expect(levenshtein("abc", "ab")).toBe(1); // usunięcie
      expect(levenshtein("ab", "abc")).toBe(1); // wstawienie
      expect(levenshtein("kitten", "sitting")).toBe(3); // klasyczny przykład
    });

    it("jest symetryczny", () => {
      expect(levenshtein("AGRIMAX", "AGRIMAKS")).toBe(levenshtein("AGRIMAKS", "AGRIMAX"));
    });
  });

  describe("podobieństwo", () => {
    it("normalizuje dystans długością dłuższego napisu", () => {
      expect(podobienstwo("BKT", "BKT")).toBe(1);
      // 1 podmiana na 14 znaków → 13/14 = 0,9285…
      expect(podobienstwo("AGRIMAX FACTOR", "AGRIMAX FAKTOR")).toBeCloseTo(13 / 14, 10);
      expect(Math.round(podobienstwo("AGRIMAX FACTOR", "AGRIMAX FAKTOR") * 100)).toBe(93);
      // 1 usunięcie na 8 znaków → 7/8 = 0,875, czyli PONIŻEJ progu 0,9
      expect(podobienstwo("ALLIANCE", "ALIANCE")).toBeCloseTo(7 / 8, 10);
    });

    it("pusty napis daje zero", () => {
      expect(podobienstwo("", "BKT")).toBe(0);
      expect(podobienstwo("BKT", "")).toBe(0);
    });

    /**
     * ⚠ BRAK NORMALIZACJI WIELKOŚCI LITER I SPACJI jest w oryginale. „BKT" i „bkt" mają
     * podobieństwo 0, bo każdy znak się różni — więc taka para nigdy nie dostanie sugestii
     * aliasu, choć dla człowieka to ta sama marka. Zastane zachowanie, nie nasz błąd.
     */
    it("nie normalizuje wielkości liter", () => {
      expect(podobienstwo("BKT", "bkt")).toBe(0);
      expect(czySugerowacAlias("BKT", "bkt")).toBe(false);
    });
  });

  describe("reguła sugerowania aliasu", () => {
    it("próg to 0,9 — poniżej nie sugeruje", () => {
      expect(czySugerowacAlias("AGRIMAX FACTOR", "AGRIMAX FAKTOR")).toBe(true); // 0,93
      expect(czySugerowacAlias("ALLIANCE", "ALIANCE")).toBe(false); // 0,875
      expect(czySugerowacAlias("BKT", "MITAS")).toBe(false);
    });

    /**
     * Wyjątek na „+" jest merytoryczny: „150A8+" to inny indeks niż „150A8", więc
     * podpowiadanie aliasu skleiłoby dwa różne produkty (`:64`, `:70`).
     */
    it("nie sugeruje, gdy jedyną różnicą są plusy", () => {
      expect(czySugerowacAlias("175/70R13 82T+", "175/70R13 82T")).toBe(false);
      expect(czySugerowacAlias("ABCDEFGHIJ+", "ABCDEFGHIJ")).toBe(false);
      // Różnica poza plusem — reguła znów przepuszcza (2 operacje na 21 znaków = 0,905).
      expect(czySugerowacAlias("ABCDEFGHIJKLMNOPQRSU+", "ABCDEFGHIJKLMNOPQRST")).toBe(true);
    });

    /**
     * ⚠ Napis IDENTYCZNY z kanoniczną przechodzi regułę (warunek `nowa !== kanoniczna`
     * w `:70` wyklucza tylko przypadek „różnica to same plusy"). Stąd w nagraniu produkcji
     * pozycje kolejki sugerujące SAME SIEBIE ze `podobienstwo: 100` — wartość zdążyła
     * trafić do słownika seedem, a skan nie usuwa nieaktualnych pozycji.
     */
    it("dla wartości identycznej z katalogową sugeruje ją z wynikiem 100", () => {
      expect(czySugerowacAlias("AGRI STAR II", "AGRI STAR II")).toBe(true);
      expect(Math.round(podobienstwo("AGRI STAR II", "AGRI STAR II") * 100)).toBe(100);
    });

    /** Wynik z nagrania produkcji: „AGRI STAR II" ↔ „AGRISTAR II" to 92 (`_pending`). */
    it("odtwarza wynik 92 z nagrania produkcji", () => {
      expect(Math.round(podobienstwo("AGRI STAR II", "AGRISTAR II") * 100)).toBe(92);
      expect(czySugerowacAlias("AGRI STAR II", "AGRISTAR II")).toBe(true);
    });
  });
});
