// Reguły narzutów partnera (karta PARTNERZY, ticket 247) — osobne od `markups` sklepu, ale ta sama zasada działania co „narzuty i promocje”.
//
// Dopasowanie warunków używa TEJ SAMEJ funkcji co sklep (`dopasujWarunek` z `repos/ceny.ts`: `dostawca` i `srednica` przez równość, reszta przez zawieranie bez
// rozróżniania wielkości liter; pusta wartość i nieznany typ = pasuje). Wybór (port `wybierzNarzut`): reguły malejąco po `priorytet`; pierwsza pasująca reguła
// SPECYFICZNA (niepusta lista warunków) wygrywa, globalna (pusta lista) jest tylko zapasowa — specyficzna o priorytecie 1 bije globalną o 99.
// RÓŻNICE od sklepu (świadome): (1) remis priorytetu rozstrzyga deterministycznie — reguła zawężona do kraju przed regułą „wszystkie kraje”, potem niższe `id`
// (sklep nie ma tu `ORDER BY` i wynik zależy od kolejności wierszy); (2) brak pasującej reguły = narzut kraju partnera (`partner_kraje.narzut_proc`).

import { dopasujWarunek, type RekordCenowy } from "../repos/ceny.js";

export type RegulaNarzutu = {
  id: number;
  kraj: string | null;
  nazwa: string;
  warunki: string;
  wartosc: number;
  priorytet: number;
  status: string;
};

export type WarunekReguly = { typ: string; wartosc: string };
/** Typy warunków — jak w sklepie (`frontend/src/pages/narzuty/warunki.ts`). */
export const TYPY_WARUNKOW = ["dostawca", "kategoria", "marka", "rozmiar", "bieznik", "produkt", "konstrukcja", "srednica", "vfIf"] as const;

export function warunkiReguly(surowe: string | null): WarunekReguly[] {
  if (!surowe) return [];
  try {
    const w: unknown = JSON.parse(surowe);
    return Array.isArray(w) ? (w as unknown[]).filter((x): x is WarunekReguly => typeof x === "object" && x !== null) : [];
  } catch {
    return [];
  }
}

export type PrzygotowanaRegula = { regula: RegulaNarzutu; warunki: WarunekReguly[] };

/** Sortuje reguły (priorytet malejąco; remis: kraj zawężony przed ogólnym, potem niższe id) i parsuje warunki RAZ — do wołania w pętli po pozycjach. */
export function przygotujReguly(reguly: readonly RegulaNarzutu[]): PrzygotowanaRegula[] {
  return [...reguly]
    .sort((a, b) => b.priorytet - a.priorytet || Number(b.kraj !== null) - Number(a.kraj !== null) || a.id - b.id)
    .map((regula) => ({ regula, warunki: warunkiReguly(regula.warunki) }));
}

/** Wybór z przygotowanych reguł: pierwsza pasująca z warunkami wygrywa, w przeciwnym razie pierwsza pasująca globalna, inaczej `null` (narzut kraju). */
export function wybierzZPrzygotowanych(przygotowane: readonly PrzygotowanaRegula[], kraj: string, pozycja: RekordCenowy): RegulaNarzutu | null {
  let globalna: RegulaNarzutu | null = null;
  for (const { regula, warunki } of przygotowane) {
    if (regula.status !== "aktywny") continue;
    if (regula.kraj !== null && regula.kraj !== kraj) continue;
    if (!warunki.every((w) => dopasujWarunek(pozycja, w))) continue;
    if (warunki.length > 0) return regula;
    if (!globalna) globalna = regula;
  }
  return globalna;
}

/** Wygodny wariant jednorazowy (testy); w pętli używaj `przygotujReguly` + `wybierzZPrzygotowanych`. */
export function wybierzRegule(reguly: readonly RegulaNarzutu[], kraj: string, pozycja: RekordCenowy): RegulaNarzutu | null {
  return wybierzZPrzygotowanych(przygotujReguly(reguly), kraj, pozycja);
}
