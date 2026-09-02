// Silnik cen — narzuty (`markups`) i promocje (`promotions`).
//
// Port pięciu pomocników `__bridge*` i `recalcPricesFromRules`
// (`deminified/backend-index.cjs:44572-44693`) oraz gałęzi cenowej importu (`:44884-44892`).
//
// GDZIE TO ŻYJE W PRODUKCJI — trzy miejsca, nie jedno:
//   1. `recalcPricesFromRules()` — po KAŻDEJ mutacji narzutu lub promocji, na całym katalogu;
//   2. gałąź w `acceptStaging` (`:44884-44892`) — przy zatwierdzeniu pozycji stagingu;
//   3. gałąź w `addProductsBulk` (`:44773-44783`) — bajt w bajt ta sama co (2).
// Punkty (2) i (3) to `zastosujRegulyCenowe()`; `addProductsBulk` nie istnieje jeszcze
// w odbudowie (Iteracja 12) i wtedy ma wywołać TĘ funkcję, w tym samym miejscu co oryginał.
//
// ⚠ (2)/(3) NIE SĄ tym samym co (1). Gałąź importu ustawia dodatkowo `status` i wchodzi tylko
// wtedy, gdy jakakolwiek reguła pasuje; `recalcPricesFromRules` `status` nie rusza i przelicza
// bezwarunkowo. Zlanie ich w jedno byłoby cichą zmianą zachowania.

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { markups, products, promotions } from "../db/schema.js";
import { uchwytSqlite } from "../import/silnik/bridge-ext.js";

export type Narzut = typeof markups.$inferSelect;
export type Promocja = typeof promotions.$inferSelect;

/**
 * Rekord, na którym pracuje silnik. Celowo luźny — w `acceptStaging` to składanka snapshotu
 * i wiersza stagingu (jeszcze nie wiersz `products`), a w `recalcPricesFromRules` prawdziwy
 * wiersz katalogu. Oryginał w obu miejscach czyta te same pola przez `p.<nazwa>`.
 */
export type RekordCenowy = Record<string, unknown>;

/** Pojedynczy warunek z kolumny `warunki` (JSON jako STRING). */
type Warunek = { typ?: unknown; wartosc?: unknown };

const tekst = (wartosc: unknown): string => String(wartosc ?? "").toLowerCase();

/**
 * Dopasowanie POJEDYNCZEGO warunku — port `__bridgeCondMatch` (`:44572`).
 *
 * ⚠ Dwie asymetrie oryginału, obie odtworzone: `dostawca` i `srednica` porównują się przez
 * RÓWNOŚĆ, a pozostałe przez `includes` — więc warunek `kategoria: "roln"` łapie „Rolnicze",
 * ale `dostawca: "MO"` nie łapie „MO5". Pusta `wartosc` oraz NIEZNANY `typ` dają `true`,
 * czyli reguła z literówką w `typ` pasuje do WSZYSTKIEGO, zamiast do niczego.
 */
export function dopasujWarunek(produkt: RekordCenowy, warunek: Warunek): boolean {
  const wartosc = String(warunek.wartosc ?? "").trim().toLowerCase();
  if (!wartosc) return true;

  switch (warunek.typ) {
    case "dostawca":
      return tekst(produkt.dostawca) === wartosc;
    case "kategoria":
      return tekst(produkt.kategoria).includes(wartosc);
    case "marka":
      return tekst(produkt.marka).includes(wartosc);
    case "produkt":
      return tekst(produkt.kod).includes(wartosc) || tekst(produkt.nazwa).includes(wartosc);
    case "konstrukcja":
      return tekst(produkt.konstrukcja).includes(wartosc);
    case "srednica":
      return tekst(produkt.srednica) === wartosc;
    case "vfIf":
    case "vf_if":
      return tekst(produkt.vfIf ?? produkt.vf_if).includes(wartosc);
    case "rozmiar":
      return tekst(produkt.rozmiar).includes(wartosc);
    case "bieznik":
      return tekst(produkt.bieznik).includes(wartosc);
    default:
      return true;
  }
}

/** `warunki` z kolumny TEXT. Uszkodzony JSON to pusta lista — oryginał połyka błąd parsowania. */
function warunkiZKolumny(surowe: string | null): Warunek[] {
  if (!surowe) return [];
  try {
    const rozpakowane: unknown = JSON.parse(surowe);
    return Array.isArray(rozpakowane) ? (rozpakowane as Warunek[]) : [];
  } catch {
    return [];
  }
}

/** Czy `warunki` niosą realną listę — od tego zależy „specyficzność" reguły (`:44643`). */
function maWarunki(surowe: string | null): boolean {
  return warunkiZKolumny(surowe).length > 0;
}

/**
 * Czy narzut pasuje do produktu — port `__bridgeMarkupMatches` (`:44599`).
 *
 * Kolejność jest istotna: niepusta lista `warunki` (KONIUNKCJA — `every`) wygrywa nad
 * `typ`/`zakres`, a `typ === "globalny"` pasuje bezwarunkowo. Reguła bez warunków i bez
 * `typ === "globalny"` sprowadza się do jednego warunku `{typ, wartosc: zakres}`.
 */
export function narzutPasuje(regula: Narzut, produkt: RekordCenowy): boolean {
  if (regula.status !== "aktywny") return false;

  const warunki = warunkiZKolumny(regula.warunki);
  if (warunki.length > 0) return warunki.every((w) => dopasujWarunek(produkt, w));
  if (regula.typ === "globalny") return true;

  return dopasujWarunek(produkt, { typ: regula.typ, wartosc: regula.zakres });
}

/**
 * Czy promocja pasuje do produktu — port `__bridgePromoMatches` (`:44615`).
 *
 * ⚠ DATY `start` I `koniec` NIE SĄ CZYTANE — ani tutaj, ani nigdzie indziej w silniku.
 * O zastosowaniu promocji decyduje wyłącznie `status === "aktywna"` i dopasowanie, więc
 * WYGASŁA PROMOCJA NADAL OBNIŻA CENY. To defekt produkcji, odtworzony 1:1 decyzją
 * użytkownika (plan.md D4, `rebuild-backlog.md`) — naprawa wymagałaby wyjątku
 * w charakteryzacji importu, czyli osłabienia najmocniejszej siatki, jaką mamy.
 *
 * ⚠ Druga osobliwość: dopasowanie po `zasieg` jest ODWRÓCONE — to `zasieg` musi ZAWIERAĆ
 * markę lub kategorię produktu, a nie odwrotnie. Dzięki temu `zasieg: "BKT,MICHELIN"` działa
 * jak lista, ale `zasieg: "BKT"` łapie też produkt marki „BK".
 */
export function promocjaPasuje(promocja: Promocja, produkt: RekordCenowy): boolean {
  if (promocja.status !== "aktywna") return false;

  const warunki = warunkiZKolumny(promocja.warunki);
  if (warunki.length > 0) return warunki.every((w) => dopasujWarunek(produkt, w));

  const zasieg = tekst(promocja.zasieg);
  if (!zasieg) return false;
  return zasieg.includes(tekst(produkt.marka)) || zasieg.includes(tekst(produkt.kategoria));
}

/**
 * Wybór narzutu — port `__bridgePickMarkup` (`:44632`).
 *
 * ⚠ TO NIE JEST ZWYKŁE „NAJWYŻSZY PRIORYTET WYGRYWA". Po posortowaniu malejąco po
 * `priorytet` pierwsza pasująca reguła SPECYFICZNA (`typ !== "globalny"` albo z niepustymi
 * `warunki`) kończy szukanie, a globalna jest tylko zapamiętywana jako zapasowa — i to
 * PIERWSZA napotkana, więc globalna o wyższym priorytecie przykrywa globalną o niższym.
 * Skutek: specyficzna reguła o priorytecie 1 bije globalną o priorytecie 99.
 */
export function wybierzNarzut(reguly: Narzut[], produkt: RekordCenowy): Narzut | null {
  let wybrana: Narzut | null = null;
  const posortowane = [...reguly].sort((a, b) => (b.priorytet ?? 50) - (a.priorytet ?? 50));

  for (const regula of posortowane) {
    if (!narzutPasuje(regula, produkt)) continue;
    const specyficzna = regula.typ !== "globalny" || maWarunki(regula.warunki);
    if (specyficzna) return regula;
    if (!wybrana) wybrana = regula;
  }

  return wybrana;
}

/** Wybór promocji — port `__bridgePickPromo` (`:44652`). Tu priorytet decyduje wprost. */
export function wybierzPromocje(promocje: Promocja[], produkt: RekordCenowy): Promocja | null {
  const pasujace = promocje
    .filter((p) => promocjaPasuje(p, produkt))
    .sort((a, b) => (b.priorytet ?? 50) - (a.priorytet ?? 50));
  return pasujace[0] ?? null;
}

/**
 * Formuła ceny sprzedaży — jedno miejsce dla wszystkich trzech ścieżek.
 *
 * `floor`, nie `round`: oryginał w OBU miejscach ucina w dół (`:44686`, `:44782`, `:44891`).
 * VAT bierze się z produktu, a `?? 23` jest domyślną stawką, nie stałą.
 */
function cenaSprzedazyZRegul(zakup: number, narzutPct: number, rabatPct: number, vatPct: number) {
  return Math.floor(zakup * (1 + narzutPct / 100) * (1 - rabatPct / 100) * (1 + vatPct / 100));
}

/** Marża zapisywana obok ceny — to PROCENT NARZUTU, nie policzona marża (`round(x*10)/10`). */
function marzaZNarzutu(narzutPct: number): number {
  return Math.round(narzutPct * 10) / 10;
}

/**
 * Gałąź cenowa IMPORTU — port `:44884-44892` (`acceptStaging`), identyczna z `:44773-44783`
 * (`addProductsBulk`). Mutuje `rekord` w miejscu: `cenaSprzedazy`, `marzaPct`, `status`.
 *
 * ⚠ Wchodzi TYLKO wtedy, gdy pasuje narzut LUB promocja (`if (__mm || __pp)`). Bez reguł
 * w tabelach cała gałąź jest bezczynna — i właśnie dlatego Iteracja 3 mogła jej nie portować.
 *
 * ⚠ NADPISUJE `cenaSprzedazy` przyniesioną przez pozycję stagingu (`cenaSprzedazyNowa`).
 * Reguła cenowa wygrywa z ceną wpisaną ręcznie przez człowieka — zaskakujące, ale tak liczy
 * produkcja; charakteryzacja ma na to osobny scenariusz.
 *
 * ⚠ ZAOKRĄGLENIE STATUSU: warunek `status` sprawdza CENĘ SPRZEDAŻY PO `floor`, więc bardzo
 * mała cena zakupu (np. 0,5 gr przy zerowym narzucie) daje `cenaSprzedazy = 0`, a przez to
 * `status: "wstrzymany"` — mimo dodatniej ceny zakupu.
 *
 * @param rekord budowany wiersz produktu — MUTOWANY
 * @returns czy reguły faktycznie weszły (do testów i diagnostyki; oryginał nic nie zwraca)
 */
export function zastosujRegulyCenowe(
  rekord: RekordCenowy,
  narzuty: Narzut[],
  promocje: Promocja[],
): boolean {
  const narzut = wybierzNarzut(narzuty, rekord);
  const promocja = wybierzPromocje(promocje, rekord);
  if (!narzut && !promocja) return false;

  const narzutPct = Number(narzut?.wartosc ?? 0);
  const rabatPct = Number(promocja?.rabatPct ?? 0);
  const vatPct = Number(rekord.vat ?? 23);
  const zakup = Number(rekord.cenaZakupu);

  rekord.cenaSprzedazy = cenaSprzedazyZRegul(zakup, narzutPct, rabatPct, vatPct);
  rekord.marzaPct = marzaZNarzutu(narzutPct);
  rekord.status = Number(rekord.cenaSprzedazy) === 0 || zakup === 0 ? "wstrzymany" : "aktywny";
  return true;
}

/** Wynik masowego przeliczenia — kształt 1:1 z oryginałem (`:44692`). */
export type WynikPrzeliczenia = { checked: number; updated: number };

/**
 * Masowe przeliczenie cen — port `recalcPricesFromRules` (`:44658`).
 *
 * Wołane po KAŻDEJ mutacji narzutu lub promocji, BEZ filtra id, czyli na całym katalogu
 * (~7 400 pozycji). Synchronicznie, w handlerze HTTP — tak działa produkcja i tego nie
 * zmieniamy; parametr `idProduktow` istnieje w oryginale, ale nikt go tam nie podaje.
 *
 * ⚠ NIE USTAWIA `status` — inaczej niż gałąź importu. Produkt, któremu reguła zbije cenę
 * do zera, zostaje „aktywny" aż do najbliższego importu. Odtworzone świadomie.
 *
 * ⚠ PRÓG ZAPISU (`> 0.005` dla ceny, `> 0.05` dla marży) nie jest optymalizacją, tylko
 * częścią zachowania: `Number(null)` daje 0, więc produkt z pustą `cenaSprzedazy` i regułą
 * dającą dokładnie 0 NIE dostanie UPDATE-u, a wynik zgłosi `updated: 0`.
 */
export function przeliczCenyZRegul(db: Baza, idProduktow?: number[]): WynikPrzeliczenia {
  const narzuty = db.select().from(markups).all();
  const promocje = db.select().from(promotions).all();

  const katalog =
    idProduktow && idProduktow.length > 0
      ? idProduktow
          .map((id) => db.select().from(products).where(eq(products.id, id)).get())
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
      : db.select().from(products).all();

  const zmiany: { id: number; cenaSprzedazy: number; marzaPct: number }[] = [];

  for (const produkt of katalog) {
    const zakup = Number(produkt.cenaZakupu) || 0;
    if (zakup <= 0) continue;

    const rekord = produkt as unknown as RekordCenowy;
    const narzut = wybierzNarzut(narzuty, rekord);
    const promocja = wybierzPromocje(promocje, rekord);

    const narzutPct = Number(narzut?.wartosc ?? 0);
    const rabatPct = Number(promocja?.rabatPct ?? 0);
    const vatPct = Number(produkt.vat ?? 23);

    const cenaSprzedazy = cenaSprzedazyZRegul(zakup, narzutPct, rabatPct, vatPct);
    const marzaPct = marzaZNarzutu(narzutPct);

    if (
      Math.abs(Number(produkt.cenaSprzedazy) - cenaSprzedazy) > 0.005 ||
      Math.abs(Number(produkt.marzaPct) - marzaPct) > 0.05
    ) {
      zmiany.push({ id: produkt.id, cenaSprzedazy, marzaPct });
    }
  }

  if (zmiany.length > 0) {
    // Surowy better-sqlite3 i jedna transakcja — dosłownie jak oryginał (`:44688-44691`).
    // Przy całym katalogu to różnica między jednym a tysiącami commitów.
    const sqlite = uchwytSqlite(db);
    const zapytanie = sqlite.prepare(
      "UPDATE products SET cena_sprzedazy=?, marza_pct=? WHERE id=?",
    );
    const transakcja = sqlite.transaction((wiersze: typeof zmiany) => {
      for (const w of wiersze) zapytanie.run(w.cenaSprzedazy, w.marzaPct, w.id);
    });
    transakcja(zmiany);
  }

  return { checked: katalog.length, updated: zmiany.length };
}
