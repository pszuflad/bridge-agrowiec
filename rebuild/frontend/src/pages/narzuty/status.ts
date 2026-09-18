/**
 * Statusy reguł cenowych.
 *
 * Produkcja liczy status promocji Z DAT przy KAŻDYM odczycie `/api/promotions`
 * (`_b()`, `frontend-index.js:9508-9514`, wołane z `queryFn` `:9568`; sama formuła to `Qd()`,
 * `:9309-9314`). Wynik idzie do wyświetlenia i do IndexedDB (`Gr()` → `un()`), ale NIGDY
 * na serwer. Odtwarzamy to 1:1 — etykieta na liście liczy się z dat, bez zapisu.
 *
 * ⚠ CO ZMIENIŁA KARTA 14f (i dlaczego nie ma tu już znacznika rozbieżności).
 * Do 14f kolumna `status` w bazie nie miała nic wspólnego z datami: zapisywała się RAZ, przy
 * tworzeniu, i nic jej nigdy nie przeliczało — a to JEJ używa silnik cen. Lista pokazywała więc
 * „zakończona" przy promocji, którą backend NADAL stosował (backlog #19), i dlatego wiersz
 * dostawał pomarańczowy znacznik `rozbieznosc` (decyzja D5 z sesji 4b), żeby defekt przestał
 * być niewidzialny.
 *
 * Od 14f statusy przelicza backendowy wygaszacz (`promocje/wygaszacz.ts`, port TEJ SAMEJ
 * reguły `statusZDat` niżej), więc kolumna `status` i etykieta z dat ZGADZAJĄ SIĘ ZE SOBĄ.
 * Znacznik nie miałby się już jak zapalić — został usunięty ŚWIADOMIE, jako martwy kod,
 * a nie przypadkiem przy okazji. Gdyby kiedyś wrócił rozjazd, wróci razem z nim.
 *
 * ⚠ `statusZDat` MUSI zostać zgodne z portem backendowym znak w znak. Rozjazd którejkolwiek
 * strony przywróciłby dokładnie ten defekt, który 14f likwiduje. Pilnuje tego
 * `rebuild/backend/test/wygaszacz.test.ts`.
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
};

/**
 * Nakłada na promocję stan wyliczony z dat — port `_b()` (`:9508-9514`).
 *
 * ⚠ NIE ZAPISUJEMY wyniku na serwer — produkcja też tego nie robi, a od 14f nie ma po co:
 * `status` w bazie liczy z tych samych dat backendowy wygaszacz, więc etykieta i kolumna
 * zgadzają się bez udziału klienta.
 *
 * Liczymy etykietę z DAT, a nie z kolumny `status`, i to jest świadome z dwóch powodów:
 * tak robi produkcja (1:1), a do tego między przebiegami wygaszacza (domyślnie 5 min) kolumna
 * może o kilka minut zostawać w tyle — data jest wtedy bliższa prawdy niż zapisany status.
 */
export function zeStanem(promocja: Promocja, teraz = Date.now()): PromocjaZeStanem {
  return { ...promocja, stanZDat: stanPromocji(statusZDat(promocja.start, promocja.koniec, teraz)) };
}
