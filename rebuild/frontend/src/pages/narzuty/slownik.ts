/**
 * Listy wyboru w dialogu reguł — port `el()` (`deminified/frontend-index.js:24203-24213`).
 *
 * ⚠ TO NIE JEST ULEPSZENIE, TYLKO WARUNEK PARYTETU. Oryginał czyta te listy z klucza Query
 * `["/api/attributes"]`, którego backend NIE MA: wypełnia go mostek wbudowany w bundle
 * (`:9960-10268`), robiąc `fetch("/panel/api/atrybuty")` i `setQueryData` (`:10140`, `:10186`).
 * Sesja 4b nie miała endpointu atrybutów, więc zbudowała obie listy z danych produktów
 * (ta sama degradacja co D3 w I2). Sesja 7b wyrzuca injection i mostek — gdyby dialog został
 * na starym kluczu, listy zrobiłyby się PUSTE. Stąd źródłem jest natywne `/api/atrybuty`.
 *
 * REGUŁA, KTÓRA MUSI ZOSTAĆ TAKA, JAKA JEST (`:24204-24211`):
 *  - **MARKI to SUMA** słownika atrybutów i marek z produktów (bez `"—"`),
 *  - **KATEGORIE WYŁĄCZNIE ze słownika** — dzięki temu da się założyć regułę na kategorię,
 *    której żaden produkt jeszcze nie ma,
 *  - **DOSTAWCY nie idą przez słownik w ogóle**: dialog ma osobne `useQuery(["/api/suppliers"])`
 *    (`d`, `:24193`), wartością opcji jest `kod`, etykietą `"kod · nazwa"`, a kolejność
 *    zostaje taka, jaką oddało API — bez dedupu i bez sortowania (`:24264-24269`).
 *
 * Odwrócenie reguły marek i kategorii jest niewidoczne na oko (obie listy „jakoś” się
 * wypełnią), dlatego pilnuje jej osobny test: `test/atrybuty.slownik.test.ts`.
 */
import type { Wartosc } from "@/pages/atrybuty/api";

/** Produkt w zakresie potrzebnym tym listom — szerszy typ katalogu tu nie jest potrzebny. */
export type ProduktZMarka = { marka?: string | null };

/** Dostawca z `GET /api/suppliers` — `contract/fixtures/GET_suppliers.json`. */
export type Dostawca = { id: number; kod: string; nazwa: string };

/** Opcja selecta: `wartosc` ląduje w warunku reguły, `etykieta` jest tylko dla oka. */
export type OpcjaWyboru = { wartosc: string; etykieta: string };

const porownaniePl = (a: string, b: string) => a.localeCompare(b, "pl");

/** Wartości jednego rodzaju, posortowane — odpowiednik `ty()` (`:10011-10013`). */
export function wartosciRodzaju(slownik: Wartosc[], rodzaj: string): string[] {
  return slownik
    .filter((pozycja) => pozycja.rodzaj === rodzaj)
    .map((pozycja) => pozycja.wartosc)
    .sort(porownaniePl);
}

/**
 * MARKI — suma słownika i katalogu.
 *
 * `"—"` to placeholder braku marki w produktach (`:24207`), więc nie wchodzi na listę.
 * `Set` odsiewa marki, które są i w słowniku, i w katalogu.
 */
export function markiDoWyboru(slownik: Wartosc[], produkty: ProduktZMarka[]): string[] {
  const zbior = new Set(
    slownik.filter((pozycja) => pozycja.rodzaj === "marka").map((pozycja) => pozycja.wartosc),
  );
  for (const produkt of produkty) {
    if (produkt.marka && produkt.marka !== "—") zbior.add(produkt.marka);
  }
  return [...zbior].sort(porownaniePl);
}

/**
 * KATEGORIE — wyłącznie słownik. Produkty NIE dokładają tu nic i to jest sedno różnicy
 * wobec marek: reguła może dotyczyć kategorii spoza katalogu.
 */
export function kategorieDoWyboru(slownik: Wartosc[]): string[] {
  return wartosciRodzaju(slownik, "kategoria");
}

/** DOSTAWCY — kolejność z API, wartością jest `kod` (tak dopasowuje silnik cen). */
export function dostawcyDoWyboru(dostawcy: Dostawca[]): OpcjaWyboru[] {
  return dostawcy.map((dostawca) => ({
    wartosc: dostawca.kod,
    etykieta: `${dostawca.kod} · ${dostawca.nazwa}`,
  }));
}

/**
 * Lista opcji dla dowolnego typu warunku obsługiwanego selectem.
 *
 * @returns `null`, gdy typ nie jest słownikowy — wtedy dialog rysuje zwykłe pole tekstowe.
 */
export function opcjeWarunku(
  typ: string,
  dane: { slownik: Wartosc[]; produkty: ProduktZMarka[]; dostawcy: Dostawca[] },
): OpcjaWyboru[] | null {
  if (typ === "dostawca") return dostawcyDoWyboru(dane.dostawcy);
  const proste = (wartosci: string[]) =>
    wartosci.map((wartosc) => ({ wartosc, etykieta: wartosc }));
  if (typ === "marka") return proste(markiDoWyboru(dane.slownik, dane.produkty));
  if (typ === "kategoria") return proste(kategorieDoWyboru(dane.slownik));
  // `konstrukcja` i `vfIf` mają w oryginale gotowe selecty zasilane `ty()` (`:24212-24213`,
  // render `:24286-24313`) — były nieosiągalne tylko dlatego, że lista TYPÓW miała sześć
  // pozycji. Sesja 4b dołożyła te typy (odstępstwo D4), więc dokładamy też ich listy.
  if (typ === "konstrukcja" || typ === "vfIf") {
    return proste(wartosciRodzaju(dane.slownik, typ));
  }
  return null;
}

/** Podpowiedź w pustym selectcie — 1:1 z oryginałem (`:24248`, `:24263`, `:24278`, `:24293`). */
export function placeholderWyboru(typ: string): string {
  if (typ === "kategoria") return "— wybierz kategorię —";
  if (typ === "dostawca") return "— wybierz dostawcę —";
  if (typ === "marka") return "— wybierz markę —";
  return "— wybierz —";
}
