/**
 * Algorytm sugerowania aliasów — `levenshtein` / `similarity` / `shouldSuggestAlias`
 * z `mirror/backend/pending_module.cjs:41-72`.
 *
 * To jest jedyne miejsce w tej domenie, gdzie liczy się LICZBA, a nie kształt: fixture
 * `GET_atrybuty_pending.json` pokazuje wyniki (`podobienstwo: 92`), ale nie dowodzi, jak
 * powstały. Wartości poniżej są policzone ręcznie ze wzoru oryginału
 * (`1 - dystans / max(dł. a, dł. b)`, potem `Math.round(× 100)`).
 *
 * ⚠ Dwa świadome odstępstwa od oryginału (decyzja Ani 2026-09-21, ticket 78): porównanie po
 * normalizacji wielkości liter i spacji (#42) oraz brak sugestii identycznej z pozycją (#40).
 * Przypadki bez różnic wielkości liter i spacji zostały zamrożone jak były — wzór się nie zmienił.
 */
import { describe, expect, it } from "vitest";

import {
  czySugerowacAlias,
  levenshtein,
  normalizujDoPorownania,
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

    it("pusty po normalizacji (same spacje) też daje zero", () => {
      expect(podobienstwo("   ", "BKT")).toBe(0);
    });

    /**
     * Świadome odstępstwo, #42, decyzja Ani 2026-09-21. W oryginale „BKT" i „bkt" miały
     * podobieństwo 0 (każdy znak się różni), więc taka para nigdy nie dostawała sugestii
     * aliasu. Teraz wielkość liter się nie liczy.
     */
    it("nie zależy od wielkości liter", () => {
      expect(podobienstwo("BKT", "bkt")).toBe(1);
      expect(podobienstwo("Farmax R75", "FARMAX R75")).toBe(1);
      // różnica wielkości liter nie dokłada się do dystansu: 1 podmiana na 14 znaków jak wyżej
      expect(Math.round(podobienstwo("agrimax factor", "AGRIMAX FAKTOR") * 100)).toBe(93);
    });

    /**
     * Świadome odstępstwo, #42. `toLowerCase()` w JS zrównuje polskie znaki, czego `LOWER()`
     * w SQLite (ASCII-only) by nie zrobił — dlatego normalizacja jest w JS.
     */
    it("zrównuje polskie znaki różniące się wielkością liter", () => {
      expect(normalizujDoPorownania("ĄĆĘŁŃÓŚŹŻ")).toBe("ąćęłńóśźż");
      expect(podobienstwo("CIĘŻAROWE", "ciężarowe")).toBe(1);
      expect(podobienstwo("Ą", "ą")).toBe(1);
    });

    /** Świadome odstępstwo, #42: skrajne spacje i wielokrotne spacje w środku się nie liczą. */
    it("ignoruje skrajne i wielokrotne spacje", () => {
      expect(normalizujDoPorownania("  MG638   napęd ")).toBe("mg638 napęd");
      expect(podobienstwo("MG638 NAPĘD", "MG638  napęd")).toBe(1);
      expect(podobienstwo(" BKT", "BKT ")).toBe(1);
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

    /** Świadome odstępstwo, #42: reguła „+" patrzy na postać znormalizowaną. */
    it("reguła plusów działa też przy różnej wielkości liter", () => {
      expect(czySugerowacAlias("abcdefghij+", "ABCDEFGHIJ")).toBe(false);
      expect(czySugerowacAlias("bkt+", "BKT")).toBe(false);
    });

    /**
     * Świadome odstępstwo, #40, decyzja Ani 2026-09-21. W oryginale napis IDENTYCZNY
     * z kanoniczną przechodził regułę (warunek `nowa !== kanoniczna` w `:70` wyklucza tylko
     * „różnica to same plusy"), stąd w nagraniu produkcji pozycje kolejki sugerujące SAME
     * SIEBIE ze `podobienstwo: 100`. Teraz identyczny napis nie jest aliasem.
     */
    it("nie sugeruje wartości identycznej z pozycją (self-match)", () => {
      expect(czySugerowacAlias("AGRI STAR II", "AGRI STAR II")).toBe(false);
      // samo podobieństwo nadal wynosi 100 — odpada dopiero reguła
      expect(Math.round(podobienstwo("AGRI STAR II", "AGRI STAR II") * 100)).toBe(100);
    });

    /**
     * Świadome odstępstwo, #42 — i granica z #40: napis różny SUROWO, ale równy po normalizacji,
     * JEST aliasem ze 100%. To dokładnie przypadek, o który prosiła Ania („w plikach przychodzi
     * różnie").
     */
    it("sugeruje alias różniący się tylko wielkością liter albo spacjami, z wynikiem 100", () => {
      expect(czySugerowacAlias("bkt", "BKT")).toBe(true);
      expect(czySugerowacAlias("rolnicze", "Rolnicze")).toBe(true);
      expect(czySugerowacAlias("MG638 NAPĘD", "MG638  napęd")).toBe(true);
      expect(Math.round(podobienstwo("bkt", "BKT") * 100)).toBe(100);
    });

    /** Wynik z nagrania produkcji: „AGRI STAR II" ↔ „AGRISTAR II" to 92 (`_pending`). */
    it("odtwarza wynik 92 z nagrania produkcji", () => {
      expect(Math.round(podobienstwo("AGRI STAR II", "AGRISTAR II") * 100)).toBe(92);
      expect(czySugerowacAlias("AGRI STAR II", "AGRISTAR II")).toBe(true);
    });
  });
});
