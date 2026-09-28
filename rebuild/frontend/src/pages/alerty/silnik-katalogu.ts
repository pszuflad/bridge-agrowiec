/**
 * Silnik PSEUDO-ALERTÓW KATALOGOWYCH — karta P6.2 (ticket `77-FEATURE-pseudo-alerty-katalogowe`).
 *
 * Port 1:1 funkcji `v2()` (klasyfikator „opona / nie-opona") i `pv()` (silnik reguł) z ŻYWEGO
 * bundla produkcji w wersji PO łatkach z 04.09:
 *
 *     git show origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js
 *
 * ⚠ NIE z `mirror/` na develop (cofnięty do 25.08) i NIE z `deminified/frontend-index.js`
 * (13.08) — oba są sprzed łatek `tr_fix` i `ackalerts`, które przebudowały właśnie ten kod.
 * Rozkład łatek: `docs/tickets/47-CHORE-i13e-frontend-bridgeone/plan.md`, sekcje 3 i 4.
 *
 * Alerty LICZY PRZEGLĄDARKA z `GET /api/products` — jak w oryginale (decyzja 5 z 2026-09-21).
 * Serwer zna tylko ich statusy (`GET/PUT /api/alerty-katalogu/statusy`, decyzja 2).
 *
 * ⚠ „Marża" to tu `marzaPct` z API, czyli PROCENT NARZUTU (instrukcja I4 §1 pkt 4) — reguły
 * operują na nim wprost, bez przeliczania.
 */

/** Poziomy w kolejności wagi przy sortowaniu — `{krytyczny: 0, ostrzezenie: 1, info: 2}`. */
export type PoziomAlertuKatalogu = "krytyczny" | "ostrzezenie" | "info";

/** Pseudo-alert w kształcie obiektu, który produkuje `pv()`. */
export type AlertKatalogu = {
  /** Z ODCISKIEM WARTOŚCI (łatka `ackalerts` pkt 1) — zmiana wartości daje nowy `id`. */
  id: string;
  /** `-1` dla alertu dostawcy („Brak importu cennika"). */
  productId: number;
  poziom: PoziomAlertuKatalogu;
  typ: string;
  opis: string;
  dostawca: string | null | undefined;
  /** ISO 8601 (albo surowa `dataAktualizacji` produktu). */
  data: string;
  status: string;
};

/**
 * Pola produktu, które czyta silnik — podzbiór wiersza `GET /api/products`. Typ jest
 * strukturalny, żeby przyjmował `Produkt` z katalogu bez rzutowań.
 */
export type ProduktDoAlertow = {
  id: number;
  kod?: string | null;
  nazwa?: string | null;
  kategoria?: string | null;
  dostawca?: string | null;
  marzaPct?: unknown;
  cenaZakupu?: unknown;
  cenaSprzedazy?: unknown;
  dataAktualizacji?: unknown;
};

// ── Klasyfikator opona / nie-opona (`v2`) ────────────────────────────────────────────────

/**
 * `h2` — słowa, które przesądzają „to NIE opona". Wersja PO łatce `tr_fix` (04.09 14:18):
 * usunięto `"tr-"`, bo `\btr-\b` łapało `TR-135` w nazwach opon BKT (granica słowa wypada
 * między `-` a cyfrą) i opony lądowały na alercie „Nie-opona w katalogu".
 */
export const SLOWA_NIE_OPONA: readonly string[] = [
  "dętka", "detka", "tube", "inner tube", "ochraniacz", "flap", "tube flap", "obręcz", "obrecz",
  "felga", "felgi", "wheel", "rim", "wentyl", "valve", "zawór", "zawor", "łańcuch", "lancuch",
  "chain", "śruba", "sruba", "nakrętka", "nakretka", "płyn", "plyn", "smar", "klej", "sealant",
  "balast", "amortyzator", "tarcza", "łożysko", "lozysko", "bearing",
];

/** `y2` — słowa „to opona". */
export const SLOWA_OPONA: readonly string[] = [
  "opona", "opony", "tire", "tyre", "bieżnik", "bieznik", "tread", "radial", "diagonal",
];

/** `g2` — wzorce rozmiaru opony, sklejane w jeden regex `x2` z flagą `i`. */
const WZORCE_ROZMIARU: readonly RegExp[] = [
  /\b\d{2,3}(?:[.,]\d{1,2})?\s*[/\-x×]\s*\d{1,3}\s*(?:R|-|–)\s*\d{1,3}(?:[.,]\d)?[A-Z]?\b/,
  /\b\d{1,2}[.,]\d{1,2}\s*[-R]\s*\d{1,3}(?:[.,]\d)?[A-Z]?\b/,
  /\b\d{1,2}[.,]\d{2}\s*[-–]\s*\d{1,3}[A-Z]?\b/,
  /\b\d{1,3}\s*[x×]\s*\d{1,2}(?:[.,]\d{1,2})?\s*(?:[-–]\s*\d{1,3})?\b/,
  /\b\d{2,3}\s*R\s*\d{1,3}(?:[.,]\d)?[A-Z]?\b/,
  /\b\d{2,3}\s*[-–]\s*\d{1,2}\b(?=\s+(?:[A-Z]|\[|\d))/,
];
const REGEX_ROZMIARU = new RegExp(WZORCE_ROZMIARU.map((r) => r.source).join("|"), "i");

/**
 * Regexy słów budowane raz, nie przy każdym produkcie — oryginał tworzy `new RegExp` w pętli
 * dla każdego z ~7400 produktów; wynik jest identyczny, różni się tylko koszt.
 * Uwaga: `\b` w JS jest granicą słowa ASCII, więc przy słowach z polskim znakiem na brzegu
 * (np. `dętka`, `łańcuch`) działa inaczej, niż sugeruje zapis — tak samo jak w oryginale,
 * i dlatego obok stoi osobny regex na „dętkę".
 */
const REGEXY_NIE_OPONA = SLOWA_NIE_OPONA.map((slowo) => ({
  slowo,
  regex: new RegExp(`\\b${slowo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
}));
const REGEXY_OPONA = SLOWA_OPONA.map((slowo) => new RegExp(`\\b${slowo}\\b`, "i"));

export type OcenaOpony = {
  isTire: boolean;
  reason: string;
  confidence: "wysoka" | "średnia" | "niska";
};

/**
 * Port `v2(nazwa, kategoria)`. Kolejność sprawdzeń jest częścią zachowania: najpierw „dętka"
 * (także z zepsutym kodowaniem), potem słowa dyskwalifikujące, na końcu słowa/rozmiar opony.
 *
 * ⚠ TO NIE JEST backendowy `czyOpona` (`backend/src/import/silnik/klasyfikator.ts`, port `Zc()`
 * z importu) — inna funkcja oryginału, inne słowniki. Nie scalać.
 */
export function klasyfikujOpone(
  nazwa: string | null | undefined,
  kategoria: string | null | undefined,
): OcenaOpony {
  const tekst = `${nazwa || ""} ${kategoria || ""}`.toLowerCase();
  if (/\bd[^a-z0-9\s]?\u0119?e?tka\b/i.test(tekst) || /\bd[\uFFFD?]tka\b/i.test(tekst)) {
    return { isTire: false, reason: "wykryto dętka (możliwe zepsute kodowanie)", confidence: "wysoka" };
  }
  for (const { slowo, regex } of REGEXY_NIE_OPONA) {
    if (regex.test(tekst)) {
      return { isTire: false, reason: `wykryto "${slowo}" w nazwie/kategorii`, confidence: "wysoka" };
    }
  }
  const maSlowo = REGEXY_OPONA.some((regex) => regex.test(tekst));
  const maRozmiar = REGEX_ROZMIARU.test(tekst);
  if (maSlowo && maRozmiar) {
    return { isTire: true, reason: "słowo kluczowe + rozmiar opony", confidence: "wysoka" };
  }
  if (maSlowo) return { isTire: true, reason: "słowo kluczowe opona/tire", confidence: "średnia" };
  if (maRozmiar) return { isTire: true, reason: "rozmiar opony w nazwie", confidence: "średnia" };
  if (kategoria && /opon|tire|tyre/i.test(kategoria)) {
    return { isTire: true, reason: "kategoria opon", confidence: "średnia" };
  }
  return { isTire: false, reason: "brak słów kluczowych i rozmiaru opony", confidence: "niska" };
}

// ── Silnik reguł (`pv`) ──────────────────────────────────────────────────────────────────

/**
 * `w2` — dostawcy pomijani przez regułę „Brak importu cennika". W produkcji to Nokian (MO7)
 * i Trelleborg (MO8), których cenniki przychodzą rzadko z natury. Przeniesione 1:1.
 */
export const WYKLUCZENI_Z_BRAKU_IMPORTU: ReadonlySet<string> = new Set(["MO7", "MO8"]);
/** `Ey` / `Py` — progi dni bez importu. */
export const PROG_OSTRZEZENIA_DNI = 7;
export const PROG_KRYTYCZNY_DNI = 30;

const DOBA_MS = 864e5;
const WAGA_POZIOMU: Record<PoziomAlertuKatalogu, number> = { krytyczny: 0, ostrzezenie: 1, info: 2 };

/** `x?.toFixed(2)` oryginału — dla braku wartości wstawia do opisu dosłowne „undefined". */
function dwaMiejsca(wartosc: unknown): string {
  return String(typeof wartosc === "number" ? wartosc.toFixed(2) : undefined);
}

/**
 * Port `pv(produkty, statusy)`. `statusy` = zapisane statusy (`id → status`); alert bez wpisu
 * ma status „nowy". `teraz` jest parametrem wyłącznie po to, żeby progi dni dało się testować.
 *
 * Cztery AKTYWNE reguły:
 *  1. „Marża ujemna — sprzedaż pod kosztem" — `marzaPct < 0`, krytyczny;
 *  2. „Bardzo niska marża" — `else if marzaPct < 5`, ostrzeżenie;
 *  3. „Nie-opona w katalogu — błąd parsera" — `klasyfikujOpone`: `!isTire && confidence ===
 *     "wysoka"`, krytyczny;
 *  4. „Brak importu cennika" — dni od NAJNOWSZEJ `dataAktualizacji` produktów dostawcy
 *     (nie z `/api/suppliers`!): `>= 30` krytyczny, `>= 7` ostrzeżenie; `productId = -1`.
 *
 * Dwie reguły są w oryginale wyłączone `if (false)` — „Brak stanu magazynowego" i „Znaki
 * w rozmiarze sklejone z nazwą" — i tu ich NIE MA.
 *
 * ⚠ Liczba dni jest w `id` alertu dostawcy, więc jego status „resetuje się" co dobę — skutek
 * łatki `ackalerts` pkt 1, przeniesiony świadomie.
 */
export function policzAlertyKatalogu(
  produkty: readonly ProduktDoAlertow[],
  statusy: ReadonlyMap<string, string>,
  teraz: number = Date.now(),
): AlertKatalogu[] {
  const alerty: AlertKatalogu[] = [];
  const status = (id: string) => statusy.get(id) || "nowy";
  const terazIso = new Date(teraz).toISOString();

  for (const p of produkty) {
    const etykieta = `${p.kod || "-"} · ${(p.nazwa || "").slice(0, 60)}`;
    const data = (p.dataAktualizacji as string | null | undefined) || terazIso;
    const marza = p.marzaPct;

    if (typeof marza === "number" && marza < 0) {
      const id = `${p.id}-marza-ujemna-${Math.round(marza * 10) / 10}`;
      alerty.push({
        id,
        productId: p.id,
        poziom: "krytyczny",
        typ: "Marża ujemna — sprzedaż pod kosztem",
        opis: `${etykieta} (marża ${marza.toFixed(1)}%, zakup ${dwaMiejsca(p.cenaZakupu)} zł, sprzedaż ${dwaMiejsca(p.cenaSprzedazy)} zł)`,
        dostawca: p.dostawca,
        data,
        status: status(id),
      });
    } else if (typeof marza === "number" && marza < 5) {
      const id = `${p.id}-marza-niska-${Math.round(marza * 10) / 10}`;
      alerty.push({
        id,
        productId: p.id,
        poziom: "ostrzezenie",
        typ: "Bardzo niska marża",
        opis: `${etykieta} (marża ${marza.toFixed(1)}%)`,
        dostawca: p.dostawca,
        data,
        status: status(id),
      });
    }

    const ocena = klasyfikujOpone(p.nazwa || "", p.kategoria);
    if (!ocena.isTire && ocena.confidence === "wysoka") {
      const id = `${p.id}-nie-opona-${(p.nazwa || "") + "|" + (p.kategoria || "")}`;
      alerty.push({
        id,
        productId: p.id,
        poziom: "krytyczny",
        typ: "Nie-opona w katalogu — błąd parsera",
        opis: `${etykieta} (${ocena.reason})`,
        dostawca: p.dostawca,
        data,
        status: status(id),
      });
    }
  }

  // Najnowsza aktualizacja per dostawca. Produkt bez daty liczy się jako 0, a dostawca, który
  // ma same zera (albo daty nie do sparsowania — `NaN > x` jest fałszem), do mapy nie trafia.
  const ostatniImport = new Map<string, number>();
  for (const p of produkty) {
    if (!p.dostawca) continue;
    const czas = p.dataAktualizacji ? new Date(p.dataAktualizacji as string).getTime() : 0;
    if (czas > (ostatniImport.get(p.dostawca) || 0)) ostatniImport.set(p.dostawca, czas);
  }
  for (const [dostawca, czas] of ostatniImport) {
    if (WYKLUCZENI_Z_BRAKU_IMPORTU.has(dostawca) || !czas) continue;
    const dni = Math.floor((teraz - czas) / DOBA_MS);
    if (dni < PROG_OSTRZEZENIA_DNI) continue;
    const krytyczny = dni >= PROG_KRYTYCZNY_DNI;
    const id = `dostawca-${dostawca}-brak-importu-${dni}`;
    alerty.push({
      id,
      productId: -1,
      poziom: krytyczny ? "krytyczny" : "ostrzezenie",
      typ: "Brak importu cennika",
      opis: krytyczny
        ? `Dostawca ${dostawca}: ostatni import ${dni} dni temu (próg krytyczny: 30 dni)`
        : `Dostawca ${dostawca}: ostatni import ${dni} dni temu (próg ostrzeżenia: 7 dni)`,
      dostawca,
      data: new Date(czas).toISOString(),
      status: status(id),
    });
  }

  return alerty.sort(porownajAlerty);
}

/** Sortowanie `pv()`/`HT()`: waga poziomu, potem data MALEJĄCO. */
export function porownajAlerty(a: AlertKatalogu, b: AlertKatalogu): number {
  return WAGA_POZIOMU[a.poziom] !== WAGA_POZIOMU[b.poziom]
    ? WAGA_POZIOMU[a.poziom] - WAGA_POZIOMU[b.poziom]
    : new Date(b.data).getTime() - new Date(a.data).getTime();
}
