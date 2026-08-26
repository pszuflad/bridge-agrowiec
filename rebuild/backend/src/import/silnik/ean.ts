// Normalizacja EAN-u — port `mm()`, `zq()` i `ZT()`
// (`deminified/backend-index.cjs:46940`, `:46950`, `:46971`).
//
// To NIE jest ta sama funkcja co `normalizeEan()` z `legacy/common.cjs` (port 3a). Tamta żyje
// po stronie parserów, zwraca string albo null i nie ma pojęcia o statusach. Ta tutaj żyje
// w silniku importu i produkuje cztery kolumny `staging_items`: `ean_raw`, `ean_is_valid`,
// `ean_source_status`, `ean_candidates`.

import { identyfikatorTechniczny } from "./identyfikator.js";

/** Wartości kolumny `staging_items.ean_source_status` — trafiają do API i do UI (3e). */
export type StatusZrodlaEan =
  | "ok"
  | "multi_candidates"
  | "scientific_notation_uncertain"
  | "no_valid_candidate";

export interface InfoEan {
  eanRaw: string;
  ean: string | null;
  eanIsValid: boolean;
  eanSourceStatus: StatusZrodlaEan;
  eanCandidates: string[];
  eanValidationError: string | null;
}

/** Rozpoznanie zapisu naukowego (`Dq`, `:46970`) — np. „8,05997E+12" z Excela. */
const ZAPIS_NAUKOWY = /^[+-]?\d+(?:[.,]\d+)?[eE][+-]?\d+$/;

const ROZBIOR_ZAPISU_NAUKOWEGO = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/;

/** Suma kontrolna EAN-13 — port `mm()` (`:46940`). */
export function poprawnaSumaKontrolnaEan13(cyfry: string): boolean {
  if (!/^\d{13}$/.test(cyfry)) return false;
  let suma = 0;
  for (let i = 0; i < 12; i += 1) {
    const cyfra = parseInt(cyfry[i]!, 10);
    suma += i % 2 === 0 ? cyfra : cyfra * 3;
  }
  return (10 - (suma % 10)) % 10 === parseInt(cyfry[12]!, 10);
}

/** Rozwinięcie zapisu naukowego do zwykłego zapisu dziesiętnego — port `zq()` (`:46950`). */
export function rozwinNotacjeNaukowa(wartosc: string): string | null {
  const dopasowanie = wartosc.trim().replace(",", ".").match(ROZBIOR_ZAPISU_NAUKOWEGO);
  if (!dopasowanie) return null;

  const znak = dopasowanie[1];
  const calosc = dopasowanie[2]!;
  const ulamek = dopasowanie[3] ?? "";
  const wykladnik = parseInt(dopasowanie[4]!, 10);

  let cyfry = calosc + ulamek;
  let przecinek = calosc.length + wykladnik;

  if (przecinek <= 0) {
    cyfry = "0".repeat(-przecinek) + cyfry;
    przecinek = 0;
  } else if (przecinek > cyfry.length) {
    cyfry += "0".repeat(przecinek - cyfry.length);
  }

  const przedPrzecinkiem = cyfry.slice(0, przecinek) || "0";
  const poPrzecinku = cyfry.slice(przecinek);
  const minus = znak === "-" ? "-" : "";

  return /^0*$/.test(poPrzecinku)
    ? minus + przedPrzecinkiem.replace(/^0+(?=\d)/, "")
    : `${minus}${przedPrzecinkiem}.${poPrzecinku}`;
}

function pusteInfo(eanRaw: string): InfoEan {
  return {
    eanRaw,
    ean: null,
    eanIsValid: false,
    eanSourceStatus: "no_valid_candidate",
    eanCandidates: [],
    eanValidationError: null,
  };
}

/**
 * Normalizacja EAN-u — port `ZT()` (`:46971`).
 *
 * Ścieżki, dokładnie jak w oryginale:
 *   • puste pole                → `no_valid_candidate`, „puste pole EAN"
 *   • zapis naukowy             → rozwinięcie przez `rozwinNotacjeNaukowa()`;
 *                                 `scientific_notation_uncertain` NIEZALEŻNIE od sumy kontrolnej
 *   • dokładnie 13 cyfr         → suma kontrolna rozstrzyga `ok` / `no_valid_candidate`
 *   • więcej niż 13 cyfr        → przesuwane okno 13-cyfrowe; jeden kandydat → `ok`,
 *                                 kilku → `multi_candidates` (i `ean` zostaje NULLEM)
 *   • mniej niż 13 cyfr         → `no_valid_candidate`
 *
 * ⚠ ODTWORZONY BŁĄD PRODUKCJI (plan.md D3). W gałęzi zapisu naukowego oryginał liczy cyfry
 * znaczące przez `Lq(i)` — ale `Lq` jest w bundlu zadeklarowane DWA RAZY w jednym zakresie
 * i wygrywa późniejsza definicja, czyli generator identyfikatora sha1. Wywołany z jednym
 * argumentem zwraca `null`, więc warunek „mniej niż 13 cyfr znaczących" jest ZAWSZE prawdziwy,
 * a komunikat brzmi dosłownie „zapis naukowy ma tylko null cyfr znaczących — EAN niepewny".
 * Tak działa dzisiejsza produkcja (potwierdzone uruchomieniem oryginału na
 * `test/charakteryzacja/silnik/scenariusze.mjs → ean-notacja-naukowa`), a tekst jest widoczny
 * dla użytkownika w `staging_items.ostrzezenie`. Dlatego wołamy tę samą funkcję z jednym
 * argumentem zamiast wpisywać `null` na sztywno — mechanizm ma być widać tam, gdzie działa.
 * Zgłoszone do decyzji w `docs/rebuild-backlog.md`.
 */
export function normalizujEan(surowy: unknown): InfoEan {
  const eanRaw = surowy == null ? "" : String(surowy);
  const podstawa = pusteInfo(eanRaw);
  const oczyszczony = eanRaw.trim();

  if (!oczyszczony) {
    return { ...podstawa, eanValidationError: "puste pole EAN" };
  }

  if (ZAPIS_NAUKOWY.test(oczyszczony)) {
    // `let a = Lq(i)` z `:46984`. Wywołanie jednoargumentowe — patrz uwaga o cieniowaniu wyżej:
    // trafia w generator sha1 i zawsze zwraca `null`, więc `a < 13` jest zawsze prawdziwe.
    const cyfrZnaczacych = identyfikatorTechniczny(oczyszczony);
    const zaMaloCyfrZnaczacych = (cyfrZnaczacych as unknown as number) < 13;
    const rozwiniety = rozwinNotacjeNaukowa(oczyszczony);

    if (rozwiniety && /^\d{13}$/.test(rozwiniety)) {
      const poprawny = poprawnaSumaKontrolnaEan13(rozwiniety);
      return {
        ...podstawa,
        ean: rozwiniety,
        eanIsValid: poprawny,
        eanSourceStatus: "scientific_notation_uncertain",
        eanCandidates: [rozwiniety],
        eanValidationError: zaMaloCyfrZnaczacych
          ? `zapis naukowy ma tylko ${cyfrZnaczacych} cyfr znaczących — EAN niepewny`
          : poprawny
            ? null
            : "rozwinięty zapis naukowy ma niepoprawną cyfrę kontrolną",
      };
    }

    return {
      ...podstawa,
      eanSourceStatus: "scientific_notation_uncertain",
      eanCandidates: rozwiniety ? [rozwiniety] : [],
      eanValidationError: "zapis naukowy nie daje 13 cyfr",
    };
  }

  const cyfry = oczyszczony.replace(/\D/g, "");

  if (cyfry.length === 0) {
    return { ...podstawa, eanValidationError: "brak cyfr w polu EAN" };
  }

  if (cyfry.length === 13) {
    const poprawny = poprawnaSumaKontrolnaEan13(cyfry);
    return {
      ...podstawa,
      ean: poprawny ? cyfry : null,
      eanIsValid: poprawny,
      eanSourceStatus: poprawny ? "ok" : "no_valid_candidate",
      eanCandidates: poprawny ? [cyfry] : [],
      eanValidationError: poprawny ? null : "13 cyfr, ale niepoprawna cyfra kontrolna",
    };
  }

  if (cyfry.length > 13) {
    const kandydaci: string[] = [];
    for (let i = 0; i + 13 <= cyfry.length; i += 1) {
      const okno = cyfry.slice(i, i + 13);
      if (poprawnaSumaKontrolnaEan13(okno) && !kandydaci.includes(okno)) kandydaci.push(okno);
    }

    if (kandydaci.length === 1) {
      return {
        ...podstawa,
        ean: kandydaci[0]!,
        eanIsValid: true,
        eanSourceStatus: "ok",
        eanCandidates: kandydaci,
        eanValidationError: null,
      };
    }

    if (kandydaci.length > 1) {
      return {
        ...podstawa,
        ean: null,
        eanIsValid: false,
        eanSourceStatus: "multi_candidates",
        eanCandidates: kandydaci,
        eanValidationError: `znaleziono ${kandydaci.length} poprawnych kandydatów EAN`,
      };
    }

    return {
      ...podstawa,
      eanSourceStatus: "no_valid_candidate",
      eanCandidates: [],
      eanValidationError: `${cyfry.length} cyfr, żadne 13-cyfrowe okno nie ma poprawnej sumy kontrolnej`,
    };
  }

  return {
    ...podstawa,
    eanSourceStatus: "no_valid_candidate",
    eanValidationError: `tylko ${cyfry.length} cyfr — za mało na EAN-13`,
  };
}
