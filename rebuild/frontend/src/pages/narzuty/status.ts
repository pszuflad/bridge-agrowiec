/**
 * Statusy reguł cenowych.
 *
 * ⚠ TU MIESZKA NAJBARDZIEJ MYLĄCA RZECZ W CAŁYM TYM WIDOKU — i dlatego jest opisana długo.
 *
 * Produkcja liczy status promocji Z DAT przy KAŻDYM odczycie `/api/promotions`
 * (`_b()`, `frontend-index.js:9508-9514`, wołane z `queryFn` `:9568`; sama formuła to `Qd()`,
 * `:9309-9314`). Wynik idzie do wyświetlenia i do IndexedDB (`Gr()` → `un()`), ale **NIGDY
 * na serwer**. Kolumna `status` w bazie zostaje nietknięta — a to JEJ używa silnik cen
 * (`rebuild/backend/src/repos/ceny.ts`, `promocjaPasuje`), który dat nie czyta w ogóle
 * (`rebuild-backlog.md` #19).
 *
 * Skutek w produkcji: lista pokazuje „zakończona" przy promocji, którą backend NADAL stosuje
 * i która NADAL obniża ceny. Etykieta i zachowanie cen mówią co innego.
 *
 * Odtwarzamy to 1:1 (etykieta z dat, bez zapisu na serwer), ale dokładamy JEDNO: gdy etykieta
 * rozjeżdża się z kolumną `status`, wiersz dostaje widoczny znacznik (`rozbieznoscStatusu`).
 * To ten sam rodzaj poprawki co literówka niżej — dane i mechanika bez zmian, znika wyłącznie
 * niewidzialność defektu (plan.md D5, decyzja użytkownika).
 */
import type { Promocja } from "./api";

/** Status narzutu — przełączany klikiem w tabeli (`:24756-24775`). */
export const STATUS_NARZUTU_AKTYWNY = "aktywny";
export const STATUS_NARZUTU_NIEAKTYWNY = "nieaktywny";

/** Status promocji rozpoznawany przez silnik cen. Rodzaj ŻEŃSKI — inny niż przy narzucie. */
export const STATUS_PROMOCJI_AKTYWNA = "aktywna";

/**
 * Status wyliczony z dat — port `Qd()` (`:9309-9314`).
 *
 * ⚠ Zwracane napisy są BEZ POLSKICH ZNAKÓW (`zaplanowana`, `zakonczona`) — dokładnie tak,
 * jak produkuje je oryginał i jak siedzą w danych seed backendu (`backend-index.cjs:45687`).
 * Nie „poprawiać" ich na `zakończona`: to są wartości zapisywane do kolumny `status`
 * przy tworzeniu promocji, więc zmiana rozjechałaby nas z istniejącymi danymi.
 */
export function statusZDat(start: string, koniec: string, teraz = Date.now()): string {
  const od = new Date(start).getTime();
  const do_ = new Date(koniec).getTime();
  if (teraz < od) return "zaplanowana";
  if (teraz > do_) return "zakonczona";
  return STATUS_PROMOCJI_AKTYWNA;
}

/** Etykiety trzech stanów promocji. Klucz to wartość z `statusZDat` albo z kolumny `status`. */
export type StanPromocji = "aktywna" | "zaplanowana" | "zakonczona";

/**
 * Normalizacja statusu do jednego z trzech stanów.
 *
 * ⚠ TU NAPRAWIAMY LITERÓWKĘ ORYGINAŁU (plan.md D5). Badge w produkcji porównuje z
 * `"planowana"` (`:24825`, bez „za"), podczas gdy `Qd()` produkuje `"zaplanowana"` — więc
 * promocja zaplanowana wpada w gałąź `else` i **wyświetla się jako „zakończona"**. To czysty
 * defekt renderowania: żadna ścieżka w systemie nie zapisuje `"planowana"`.
 * Przyjmujemy oba napisy, żeby znieść też ewentualne stare dane.
 */
export function stanPromocji(status: string): StanPromocji {
  if (status === "aktywna") return "aktywna";
  if (status === "zaplanowana" || status === "planowana") return "zaplanowana";
  return "zakonczona";
}

/** Etykieta do wyświetlenia — z polskimi znakami, w odróżnieniu od wartości w bazie. */
export const ETYKIETY_STANU: Record<StanPromocji, string> = {
  aktywna: "aktywna",
  zaplanowana: "zaplanowana",
  zakonczona: "zakończona",
};

/** Promocja wzbogacona o to, co widok naprawdę pokazuje. */
export type PromocjaZeStanem = Promocja & {
  /** Stan wyliczony Z DAT — to jest etykieta na badge'u, jak w produkcji. */
  stanZDat: StanPromocji;
  /** Stan wynikający z kolumny `status` — to jest to, czym kieruje się silnik cen. */
  stanZBazy: StanPromocji;
  /**
   * Opis rozbieżności albo `null`. Niepusty znaczy, że etykieta i ceny mówią co innego —
   * i tylko wtedy widok pokazuje znacznik.
   */
  rozbieznosc: string | null;
};

/**
 * Nakłada na promocję stan z dat (port `_b()`) i wykrywa rozjazd z kolumną `status`.
 *
 * ⚠ NIE ZAPISUJEMY wyniku na serwer — produkcja też tego nie robi, a zapis byłby zmianą
 * danych, której nikt nie autoryzował, i wchodziłby w kompetencje backendu (backlog #19).
 */
export function zeStanem(promocja: Promocja, teraz = Date.now()): PromocjaZeStanem {
  const stanZDat = stanPromocji(statusZDat(promocja.start, promocja.koniec, teraz));
  const stanZBazy = stanPromocji(promocja.status);

  let rozbieznosc: string | null = null;
  if (stanZDat !== stanZBazy) {
    rozbieznosc =
      stanZBazy === "aktywna"
        ? `Wg dat ${ETYKIETY_STANU[stanZDat]}, ale w bazie ma status „aktywna" — NADAL obniża ceny.`
        : `Wg dat ${ETYKIETY_STANU[stanZDat]}, ale w bazie ma status „${promocja.status}" — NIE obniża cen.`;
  }

  return { ...promocja, stanZDat, stanZBazy, rozbieznosc };
}
