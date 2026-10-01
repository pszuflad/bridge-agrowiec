// Tolerancja dopasowania pozycji cennika do karty w katalogu — dwie poprawki fałszywych
// „Oznaczenie wskazuje inną oponę".
//
// ⚠ ODSTĘPSTWO OD PRODUKCJI — ŚWIADOMA DECYZJA UŻYTKOWNICZKI (2026-10-01). Oryginał
// porównuje SUROWY wiersz pliku z kartą katalogu (`compatibility()`, `separateDotBatch()`,
// `norm(d.dot) === norm(p.dot)`). Dwie rzeczy robią z tego fałszywe alarmy:
//
//  1. RĘCZNE POPRAWKI. Karta ma poprawkę pola (np. `model`: `TF-03` → `TF03`, w
//     `manual_overrides` z `acknowledgedSourceValue = TF-03`), a plik dostawcy co import podaje
//     `TF-03`. Poprawki nakłada się dopiero PO dopasowaniu (`nalozPoprawki`), więc przy
//     dopasowaniu model „różni się" i pozycja wraca do stagingu — za każdym importem.
//     Tu porównujemy z wartością po poprawce, ale TYLKO gdy plik nadal podaje to samo, co
//     wtedy, gdy poprawkę zatwierdzono (`acknowledgedSourceValue`). Gdy dostawca zmienił
//     wartość jeszcze raz, poprawka nie przesłania prawdziwej zmiany.
//  2. POKREWNE DOT. Karta ma `2025,2026`, plik podaje `2026` (albo odwrotnie; MO3: `23` i `2023`).
//     To ta sama karta w innym stanie magazynu, nie osobna partia. DOT-y są „pokrewne", gdy zbiór
//     lat jednego zawiera się w zbiorze drugiego. Rozłączne lub częściowo nakładające się
//     (`2024,2025` vs `2025,2026`) zostają osobnymi partiami — jak w produkcji.
//
// Wszystko to wpływa WYŁĄCZNIE na decyzję „czy to ta karta"; sama karta i zapisywane dane
// przechodzą dalej bez zmian.

import { compatibility, norm } from "./helpery.js";
import { separateDotBatch } from "./podstawy.js";

type Pozycja = Record<string, unknown>;

export type PoprawkaKarty = {
  fieldName: string;
  overrideValue: string | null;
  acknowledgedSourceValue: string | null;
};

/** Pola, które biorą udział w `compatibility()`/`separateDotBatch()`. */
const POLA_PORZEDNIE = [
  "marka",
  "model",
  "rozmiar",
  "indeksNosnosci",
  "indeksPredkosci",
  "pr",
  "tlTt",
  "vfIf",
  "konstrukcja",
  "dot",
] as const;

/** Zbiór lat z zapisu DOT; dwucyfrowy rok to rok 20xx; reszta (tekst) zostaje wprost. */
function zbiorDot(wartosc: unknown): Set<string> {
  const wynik = new Set<string>();
  for (const kawalek of String(wartosc ?? "").split(/[,;]/)) {
    const t = norm(kawalek);
    if (!t) continue;
    wynik.add(/^\d{2}$/.test(t) ? `20${t}` : t);
  }
  return wynik;
}

/** Czy dwa zapisy DOT dotyczą tej samej karty: równe albo jeden zbiór lat zawiera się w drugim. */
export function dotyPokrewne(a: unknown, b: unknown): boolean {
  const x = zbiorDot(a);
  const y = zbiorDot(b);
  if (!x.size || !y.size) return norm(a) === norm(b);
  const [mniejszy, wiekszy] = x.size <= y.size ? [x, y] : [y, x];
  return [...mniejszy].every((rok) => wiekszy.has(rok));
}

/** Wiersz pliku z podstawionymi poprawkami karty — tylko tam, gdzie plik nadal mówi to samo. */
function zPoprawkami(d: Pozycja, poprawki: readonly PoprawkaKarty[] | undefined): Pozycja {
  if (!poprawki?.length) return d;
  let wynik: Pozycja | null = null;
  for (const o of poprawki) {
    if (!(POLA_PORZEDNIE as readonly string[]).includes(o.fieldName)) continue;
    if (!o.acknowledgedSourceValue || o.overrideValue == null) continue;
    if (norm(d[o.fieldName]) !== norm(o.acknowledgedSourceValue)) continue;
    wynik ??= { ...d };
    wynik[o.fieldName] = o.overrideValue;
  }
  return wynik ?? d;
}

/** Wiersz pliku w postaci, w jakiej wolno go porównać z kartą `p`. */
function widok(
  d: Pozycja,
  p: Pozycja,
  poprawki: readonly PoprawkaKarty[] | undefined,
): Pozycja {
  const z = zPoprawkami(d, poprawki);
  return dotyPokrewne(z.dot, p.dot) && norm(z.dot) !== norm(p.dot) ? { ...z, dot: p.dot } : z;
}

/** `compatibility(d, p).ok` — po poprawkach karty i z pokrewnymi DOT. */
export function zgodna(
  d: Pozycja,
  p: Pozycja,
  poprawki?: readonly PoprawkaKarty[],
): boolean {
  return compatibility(widok(d, p, poprawki), p).ok;
}

/** `separateDotBatch(d, p)` — pokrewne DOT NIE są osobną partią. */
export function osobnaPartia(
  d: Pozycja,
  p: Pozycja,
  poprawki?: readonly PoprawkaKarty[],
): boolean {
  return separateDotBatch(widok(d, p, poprawki), p);
}

/** `norm(d.dot) === norm(p.dot)` — z pokrewnymi DOT. */
export function dotZgodny(
  d: Pozycja,
  p: Pozycja,
  poprawki?: readonly PoprawkaKarty[],
): boolean {
  return dotyPokrewne(zPoprawkami(d, poprawki).dot, p.dot);
}

/**
 * Czy `p` jest kartą, którą SAM system założył dla tego wiersza cennika (osobna partia DOT z kodem
 * zastępczym `…_AUTO_…`, bo kod z pliku zajmowała inna karta).
 *
 * Bez tego ten sam wiersz przy KAŻDYM kolejnym imporcie pytał „podobna opona pod innym kodem" —
 * o kartę, którą wczoraj sam zaakceptowano — a w oknie pokazywał jako kandydata kartę z kodem
 * z pliku (inną partię). Warunki: kod zastępczy + ten sam kod dostawcy w pliku i na karcie.
 * Zgodność cech (marka/model/rozmiar/DOT…) sprawdza wołający przez `zgodna()`.
 */
export function kartaWlasnejPartii(
  d: Pozycja,
  p: Pozycja,
  kodKlucz: (v: unknown) => string,
): boolean {
  if (!String(p.kod ?? "").includes("_AUTO_")) return false;
  const kodPliku = kodKlucz(d.kodDostawcy);
  return kodPliku !== "" && kodPliku === kodKlucz(p.kodDostawcy);
}
