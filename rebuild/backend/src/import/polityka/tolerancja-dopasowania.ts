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

import { compatibility, norm, validateEan, type WynikEan } from "./helpery.js";
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

/**
 * Wiersz pliku w postaci, w jakiej wolno go porównać z kartą `p`.
 *
 * `bezDot` = TA SAMA POZYCJA (ten sam kod): DOT nie jest kryterium, wiersz porównujemy tak, jakby
 * miał DOT karty (decyzja użytkowniczki, 2026-10-01). Bez tego DOT-y pokrewne (`2026` ⊂ `2025,2026`)
 * liczą się jako zgodne, a rozłączne zostają różnicą — to dla INNEGO kodu (nowy symbol partii).
 */
function widok(
  d: Pozycja,
  p: Pozycja,
  poprawki: readonly PoprawkaKarty[] | undefined,
  bezDot = false,
): Pozycja {
  const z = zPoprawkami(d, poprawki);
  if (bezDot) return { ...z, dot: p.dot };
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

/** `compatibility(d, p).ok` dla TEJ SAMEJ pozycji (ten sam kod): DOT w ogóle nie jest porównywany. */
export function zgodnaBezDot(
  d: Pozycja,
  p: Pozycja,
  poprawki?: readonly PoprawkaKarty[],
): boolean {
  return compatibility(widok(d, p, poprawki, true), p).ok;
}

/**
 * `separateDotBatch(d, p)` dla INNEGO kodu (nowy symbol partii): pokrewne DOT nie są osobną partią,
 * rozłączne — tak, jak w produkcji (osobny produkt).
 */
export function osobnaPartia(
  d: Pozycja,
  p: Pozycja,
  poprawki?: readonly PoprawkaKarty[],
): boolean {
  return separateDotBatch(widok(d, p, poprawki), p);
}

/** `norm(d.dot) === norm(p.dot)` dla TEJ SAMEJ pozycji (ten sam kod) — DOT nie jest kryterium, więc zawsze zgodny. */
export function dotZgodny(
  _d: Pozycja,
  _p: Pozycja,
  _poprawki?: readonly PoprawkaKarty[],
): boolean {
  return true;
}

/**
 * Czy zmianę DOT z cennika zapisać na karcie OD RAZU (w cichej aktualizacji obok ceny i stanu), bez
 * zgłoszenia do akceptacji. Produkcja DOT-u nie aktualizowała — inny DOT zakładał nowy produkt.
 */
export function aktualizacjaDotWMiejscu(): boolean {
  return true;
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

/**
 * Czy wiersz cennika i karta `p` mają RÓŻNE symbole dostawcy (`kodDostawcy`) — wtedy to dwie osobne
 * pozycje, nawet gdy marka, model, rozmiar, indeksy, EAN i DOT są takie same lub pokrewne.
 *
 * Odstępstwo 2026-10-01 (decyzja użytkowniczki): symbol dostawcy identyfikuje partię. Wspólne są
 * wtedy tylko cechy opony, a data produkcji i warunki (cena, stan) mogą być inne — nowy symbol to
 * NOWA karta, nie „podobna opona, sprawdź”. Produkcja pytała o to przy każdej zgodnej parze
 * (np. Goodyear KMAX …MKD…/…MKS…, CEAT WINMILE-S …WES0/…WES1, CEAT z `SB`/bez).
 *
 * Gdy któryś symbol jest pusty (wiersz bez własnego kodu, stara karta) — NIE rozstrzygamy:
 * zostaje dotychczasowe dopasowanie. Ten sam symbol to zawsze ta sama pozycja (krok „kod dostawcy”).
 */
export function innySymbolDostawcy(
  d: Pozycja,
  p: Pozycja,
  kodKlucz: (v: unknown) => string,
): boolean {
  const kodPliku = kodKlucz(d.kodDostawcy);
  const kodKarty = kodKlucz(p.kodDostawcy);
  return kodPliku !== "" && kodKarty !== "" && kodPliku !== kodKarty;
}

/**
 * Błędny EAN z pliku, który użytkowniczka już rozstrzygnęła (`ean-bledny.ts`): poprawka `ean` karty
 * z `acknowledgedSourceValue` równym TEMU błędnemu numerowi → zamiast błędu liczy się EAN poprawki.
 * Gdy dostawca zmieni numer (inny napis), pytanie wraca.
 */
export function zastapBlednyEan(
  ev: WynikEan,
  poprawki: readonly PoprawkaKarty[] | undefined,
): WynikEan {
  if (!ev.error || !poprawki?.length) return ev;
  const potwierdzona = poprawki.find(
    (o) =>
      o.fieldName === "ean" &&
      o.overrideValue != null &&
      o.acknowledgedSourceValue != null &&
      String(o.acknowledgedSourceValue).trim() === ev.raw,
  );
  if (!potwierdzona) return ev;
  const poprawiony = validateEan(potwierdzona.overrideValue);
  return poprawiony.valid ? poprawiony : ev;
}

/**
 * Czy niejednoznaczne dopasowanie (`_matchIssue`) wstrzymuje karty-kandydatów i zeruje ich stan.
 * Produkcja: tak. Decyzja użytkowniczki (2026-10-01): NIE — pozycja czekająca w stagingu na decyzję
 * nie może zmieniać katalogu ani zerować stanu magazynowego (u dostawcy towar jest).
 */
export function wstrzymujeKandydatowPrzyNiejednoznacznosci(): boolean {
  return false;
}

/** Samo słowo „DOT” (opcjonalnie z rokiem) — oznaczenie dostawcy w nazwie, nie część modelu. */
const SLOWO_DOT_RE = /\s*\bDOT(?:\s*\d{2,4})?\b/gi;

/**
 * Model/bieżnik bez słowa „DOT” (np. `XL GRIP DOT` → `XL GRIP`, `TR 270 DOT` → `TR 270`).
 * Dostawca MO9 pisze „(DOT)” w nazwie; parser wycina z modelu tylko „DOT” z liczbą, więc samo „DOT”
 * zostawało w modelu i bieżniku (decyzja użytkowniczki, 2026-10-01: model BKT ma być `XL GRIP`).
 */
export function oczyscModelZDot(wartosc: unknown): unknown {
  if (typeof wartosc !== "string") return wartosc;
  const czysty = wartosc.replace(SLOWO_DOT_RE, "").replace(/\s+/g, " ").trim();
  return czysty || wartosc;
}

const doPorownaniaNazw = (nazwa: string): string =>
  nazwa.replace(SLOWO_DOT_RE, "").replace(/×/g, "x").replace(/\s+/g, " ").trim().toUpperCase();

/**
 * Nazwa z cennika, gdy od nazwy karty różni ją TYLKO słowo „DOT” (i zapis `×`/`x` w rozmiarze) —
 * zostaje nazwa karty („nazwa ma pozostać taka, jaka jest”). Każda inna różnica przechodzi bez zmian.
 */
export function zachowajNazweKarty(nazwa: unknown, nazwaKarty: unknown): unknown {
  if (typeof nazwa !== "string" || typeof nazwaKarty !== "string") return nazwa;
  return doPorownaniaNazw(nazwa) === doPorownaniaNazw(nazwaKarty) ? nazwaKarty : nazwa;
}
