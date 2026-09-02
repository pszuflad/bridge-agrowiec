/**
 * Silnik cen po stronie klienta — zasila symulator i kontrolę „poniżej kosztu".
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D8, decyzja użytkownika). Oryginalny `Mb()`
 * (`frontend-index.js:9481-9506`) ROZJEŻDŻA SIĘ Z WŁASNYM BACKENDEM w trzech miejscach:
 *
 *  1. test „czy reguła jest specyficzna" sprawdza PRAWDZIWOŚĆ napisu `warunki`
 *     (`"globalny" !== n.typ || n.warunki`, `:9485`), a nie liczbę warunków po sparsowaniu.
 *     Reguła z `warunki: "[]"` — dokładnie ta z `contract/fixtures/GET_markups.json` —
 *     jest dla frontendu SPECYFICZNA, a dla backendu GLOBALNA. Przy dwóch regułach naraz
 *     obie strony wybiorą inną;
 *  2. brak domyślnych `priorytet ?? 50` i `vat ?? 23`, które backend ma;
 *  3. brak `Math.floor` — oryginał pokazywał surowy iloczyn.
 *
 * Symulator ma TŁUMACZYĆ cenę, która naprawdę siedzi w katalogu, a od tej samej logiki zależy
 * ostrzeżenie o sprzedaży poniżej kosztu przy regule dotykającej ~7 400 produktów. Błędne
 * wyjaśnienie jest gorsze niż jego brak, więc liczymy jak `rebuild/backend/src/repos/ceny.ts`.
 * Zgodności obu implementacji pilnuje `test/narzuty.ceny.test.ts`.
 */
import type { Narzut, Promocja } from "./api";
import { odczytajWarunki, type Warunek } from "./warunki";

/** Produkt w zakresie potrzebnym silnikowi — pola czytane przez `dopasujWarunek`. */
export type ProduktDoWyceny = {
  kod?: string | null;
  nazwa?: string | null;
  marka?: string | null;
  kategoria?: string | null;
  dostawca?: string | null;
  konstrukcja?: string | null;
  srednica?: number | string | null;
  vfIf?: string | null;
  rozmiar?: string | null;
  bieznik?: string | null;
  cenaZakupu?: number | null;
  vat?: number | null;
};

const tekst = (wartosc: unknown): string => String(wartosc ?? "").toLowerCase();

/**
 * Port `dopasujWarunek` z backendu (`repos/ceny.ts`, oryginał `__bridgeCondMatch` `:44572`).
 * Dwie asymetrie odtworzone: `dostawca` i `srednica` po RÓWNOŚCI, reszta przez zawieranie;
 * pusta wartość i nieznany typ dają `true`.
 */
export function dopasujWarunek(produkt: ProduktDoWyceny, warunek: Warunek): boolean {
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
      return tekst(produkt.vfIf).includes(wartosc);
    case "rozmiar":
      return tekst(produkt.rozmiar).includes(wartosc);
    case "bieznik":
      return tekst(produkt.bieznik).includes(wartosc);
    default:
      return true;
  }
}

/** Port `narzutPasuje`. Niepusta lista warunków to KONIUNKCJA i wygrywa nad `typ`/`zakres`. */
export function narzutPasuje(regula: Narzut, produkt: ProduktDoWyceny): boolean {
  if (regula.status !== "aktywny") return false;
  const warunki = odczytajWarunki(regula.warunki);
  if (warunki.length > 0) return warunki.every((w) => dopasujWarunek(produkt, w));
  if (regula.typ === "globalny") return true;
  return dopasujWarunek(produkt, { typ: regula.typ, wartosc: regula.zakres });
}

/**
 * Port `promocjaPasuje`. Dopasowanie po `zasieg` jest ODWRÓCONE — to zasięg zawiera markę
 * albo kategorię produktu. Daty `start`/`koniec` NIE SĄ czytane (backlog #19).
 */
export function promocjaPasuje(promocja: Promocja, produkt: ProduktDoWyceny): boolean {
  if (promocja.status !== "aktywna") return false;
  const warunki = odczytajWarunki(promocja.warunki);
  if (warunki.length > 0) return warunki.every((w) => dopasujWarunek(produkt, w));
  const zasieg = tekst(promocja.zasieg);
  if (!zasieg) return false;
  return zasieg.includes(tekst(produkt.marka)) || zasieg.includes(tekst(produkt.kategoria));
}

/**
 * Port `wybierzNarzut`. Pierwsza pasująca reguła SPECYFICZNA kończy szukanie; globalna jest
 * tylko zapasowa. Specyficzność liczona po SPARSOWANEJ liście warunków — to jest ta różnica
 * wobec `Mb()`, dla której powstało odstępstwo D8.
 */
export function wybierzNarzut(reguly: Narzut[], produkt: ProduktDoWyceny): Narzut | null {
  let wybrana: Narzut | null = null;
  const posortowane = [...reguly].sort((a, b) => (b.priorytet ?? 50) - (a.priorytet ?? 50));

  for (const regula of posortowane) {
    if (!narzutPasuje(regula, produkt)) continue;
    const specyficzna = regula.typ !== "globalny" || odczytajWarunki(regula.warunki).length > 0;
    if (specyficzna) return regula;
    if (!wybrana) wybrana = regula;
  }
  return wybrana;
}

/** Port `wybierzPromocje` — tu priorytet decyduje wprost, bez reguły specyficzności. */
export function wybierzPromocje(promocje: Promocja[], produkt: ProduktDoWyceny): Promocja | null {
  return (
    [...promocje]
      .filter((p) => promocjaPasuje(p, produkt))
      .sort((a, b) => (b.priorytet ?? 50) - (a.priorytet ?? 50))[0] ?? null
  );
}

/** Rozbicie ceny krok po kroku — to, co pokazuje symulator. */
export type RozbicieCeny = {
  zakup: number;
  narzutPct: number;
  wybranyNarzut: Narzut | null;
  rabatPct: number;
  wybranaPromocja: Promocja | null;
  vatPct: number;
  poNarzucie: number;
  poRabacie: number;
  /** Cena końcowa PO zaokrągleniu w dół — ta, która trafia do katalogu. */
  cenaSprzedazy: number;
  /** `marzaPct` zapisywana obok ceny: to PROCENT NARZUTU, nie policzona marża. */
  marzaPct: number;
};

/** Formuła 1:1 z backendem, łącznie z `Math.floor` na samym końcu. */
export function policzCene(
  produkt: ProduktDoWyceny,
  narzuty: Narzut[],
  promocje: Promocja[],
): RozbicieCeny {
  const narzut = wybierzNarzut(narzuty, produkt);
  const promocja = wybierzPromocje(promocje, produkt);

  const narzutPct = Number(narzut?.wartosc ?? 0);
  const rabatPct = Number(promocja?.rabatPct ?? 0);
  const vatPct = Number(produkt.vat ?? 23);
  const zakup = Number(produkt.cenaZakupu ?? 0);

  const poNarzucie = zakup * (1 + narzutPct / 100);
  const poRabacie = poNarzucie * (1 - rabatPct / 100);

  return {
    zakup,
    narzutPct,
    wybranyNarzut: narzut,
    rabatPct,
    wybranaPromocja: promocja,
    vatPct,
    poNarzucie,
    poRabacie,
    cenaSprzedazy: Math.floor(poRabacie * (1 + vatPct / 100)),
    marzaPct: Math.round(narzutPct * 10) / 10,
  };
}

/**
 * Produkty, które po zapisie reguły zejdą z ceną sprzedaży PONIŻEJ ceny zakupu.
 *
 * Port zabezpieczenia z `el()` (`:24598`): oryginał liczy to przed zapisem promocji
 * i pyta o potwierdzenie. Nas interesuje ta sama lista — u nas trafia do dialogu (D6).
 * Produkty bez dodatniej ceny zakupu pomijamy: gałąź cenowa i tak ich nie dotyczy.
 */
export function produktyPonizejKosztu(
  produkty: ProduktDoWyceny[],
  narzuty: Narzut[],
  promocje: Promocja[],
): { produkt: ProduktDoWyceny; cenaSprzedazy: number }[] {
  const wynik: { produkt: ProduktDoWyceny; cenaSprzedazy: number }[] = [];
  for (const produkt of produkty) {
    const zakup = Number(produkt.cenaZakupu ?? 0);
    if (zakup <= 0) continue;
    const { cenaSprzedazy } = policzCene(produkt, narzuty, promocje);
    if (cenaSprzedazy < zakup) wynik.push({ produkt, cenaSprzedazy });
  }
  return wynik;
}
