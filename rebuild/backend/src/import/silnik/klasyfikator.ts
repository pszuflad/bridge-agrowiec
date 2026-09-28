// Klasyfikator „czy to opona" — port `Zc()` wraz ze słownikami `qq`, `Mq`, `Fq`, `$q`
// (`deminified/backend-index.cjs:47056-47106`).
//
// Bramka wejściowa importu: pozycja uznana za nie-oponę nie tylko nie trafia do stagingu, ale
// jeszcze KASUJE odpowiadający jej produkt z katalogu (`tk()`, `:47689`). Dlatego kolejność
// testów jest tu istotna — pierwszy trafiony wygrywa i decyduje o treści `reason`, która ląduje
// w `szczegolyOdrzuconych` i wraca w odpowiedzi HTTP.

export interface OcenaOpony {
  isTire: boolean;
  reason: string;
  confidence: "wysoka" | "średnia" | "niska";
}

/** Rzeczy, które oponą nie są — port `qq` (`:47056`). Dopasowywane jako całe słowa. */
const SLOWA_NIE_OPONA = [
  "dętka",
  "detka",
  "tube",
  "inner tube",
  "ochraniacz",
  "flap",
  "tube flap",
  "obręcz",
  "obrecz",
  "felga",
  "felgi",
  "wheel",
  "rim",
  "wentyl",
  "valve",
  "zawór",
  "zawor",
  "łańcuch",
  "lancuch",
  "chain",
  "śruba",
  "sruba",
  "nakrętka",
  "nakretka",
  "płyn",
  "plyn",
  "smar",
  "klej",
  "sealant",
  "balast",
  "amortyzator",
  "tarcza",
  "łożysko",
  "lozysko",
  "bearing",
];

/** Słowa przemawiające za oponą — port `Mq` (`:47057`). */
const SLOWA_OPONA = [
  "opona",
  "opony",
  "tire",
  "tyre",
  "bieżnik",
  "bieznik",
  "tread",
  "radial",
  "diagonal",
];

/**
 * Zapisy rozmiaru opony — port `Fq` (`:47058`). Dwanaście wzorców, bo dostawcy zapisują rozmiar
 * na kilkanaście sposobów („480/70R28", „12.4-28", „6.50x16", „340 R 24", „18.4 R 38"…).
 */
/* eslint-disable no-useless-escape -- wzorce przepisane ZNAK W ZNAK z `Fq` (:47058).
   Kilka ucieczek (`[\-–]`) jest zbędnych dla silnika regexów, ale ich usunięcie rozjechałoby
   zapis z oryginałem i utrudniło porównanie przy następnej re-synchronizacji z mirrorem. */
const WZORCE_ROZMIARU = [
  /\b\d{1,2}\s*PR\s*(?:TL|TT)\b/i,
  /\bVF\d{1,3}(?:[.,]\d{1,2})?\s*R\s*\d{1,3}\b/i,
  /\b\d{1,2}\/\d{1,2}\s*-\s*\d{1,3}\b/,
  /\b\d{1,2}\s*-\s*\d{1,3}\b(?=\s+[A-Z])/,
  /\b\d{1,3}\s*-\s*\d{1,3}[.,]\d{1,2}\b/,
  /\b\d{2,3}(?:[.,]\d{1,2})?\s*[/\-x×]\s*\d{1,3}\s*(?:R|B|D|-|–)\s*\d{1,3}(?:[.,]\d)?[A-Z]?\b/,
  /\b\d{1,2}[.,]\d{1,2}\s*[-RBD]\s*\d{1,3}(?:[.,]\d)?[A-Z]?\b/,
  /\b\d{1,3}(?:[.,]\d)?\s*L\s*[-–R]\s*\d{1,3}(?:[.,]\d)?[A-Z]?\b/,
  /\b\d{1,2}[.,]\d{2}\s*[\-–]\s*\d{1,3}[A-Z]?\b/,
  /\b\d{1,3}\s*[x×]\s*\d{1,2}(?:[.,]\d{1,2})?\s*(?:[\-–]\s*\d{1,3})?\b/,
  /\b\d{2,3}\s*R\s*\d{1,3}(?:[.,]\d)?[A-Z]?\b/,
  /\b\d{2,3}\s*[\-–]\s*\d{1,2}\b(?=\s+(?:[A-Z]|\[|\d))/,
];
/* eslint-enable no-useless-escape */

/** Alternatywa wszystkich wzorców rozmiaru — port `$q` (`:47059`). */
const ROZMIAR_OPONY = new RegExp(WZORCE_ROZMIARU.map((w) => w.source).join("|"), "i");

const escapujDoRegexu = (slowo: string) => slowo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Czy pozycja jest oponą — port `Zc()` (`:47061`).
 *
 * @param nazwa nazwa pozycji z cennika
 * @param kategoria kategoria z cennika; sklejana z nazwą, więc słowo kluczowe w kategorii
 *   działa tak samo jak w nazwie
 */
export function czyOpona(nazwa: string | null, kategoria?: string | null): OcenaOpony {
  const tekst = `${nazwa || ""} ${kategoria || ""}`.toLowerCase();

  if (/bie[żz]nikowan/i.test(tekst)) {
    return {
      isTire: false,
      reason: "opona bieżnikowana - nie importujemy",
      confidence: "wysoka",
    };
  }

  if (
    /\b(koła|koło|kola|kolo|zawory|zawór|zawor|oring|oringi|o-ring|o-ringi|obręcz|obręcze|obrecz|obrecze|ochraniacz|ochraniacze)\b/i.test(
      tekst,
    )
  ) {
    return {
      isTire: false,
      reason: "akcesoria: koła/zawory/oringi/obręcze/ochraniacze - nie importujemy",
      confidence: "wysoka",
    };
  }

  // Druga alternatywa łapie „d?tka"/„d�tka" — dętkę z rozsypanym kodowaniem w pliku dostawcy.
  if (/\bd[^a-z0-9\s]?ę?e?tka\b/i.test(tekst) || /\bd[�?]tka\b/i.test(tekst)) {
    return {
      isTire: false,
      reason: "wykryto dętka (możliwe zepsute kodowanie)",
      confidence: "wysoka",
    };
  }

  for (const slowo of SLOWA_NIE_OPONA) {
    if (new RegExp(`\\b${escapujDoRegexu(slowo)}\\b`, "i").test(tekst)) {
      return {
        isTire: false,
        reason: `wykryto "${slowo}" w nazwie/kategorii`,
        confidence: "wysoka",
      };
    }
  }

  const maSlowoKluczowe = SLOWA_OPONA.some((slowo) => new RegExp(`\\b${slowo}\\b`, "i").test(tekst));
  const maRozmiar = ROZMIAR_OPONY.test(tekst);

  if (maSlowoKluczowe && maRozmiar) {
    return { isTire: true, reason: "słowo kluczowe + rozmiar opony", confidence: "wysoka" };
  }
  if (maSlowoKluczowe) {
    return { isTire: true, reason: "słowo kluczowe opona/tire", confidence: "średnia" };
  }
  if (maRozmiar) {
    return { isTire: true, reason: "rozmiar opony w nazwie", confidence: "średnia" };
  }
  if (kategoria && /opon|tire|tyre/i.test(kategoria)) {
    return { isTire: true, reason: "kategoria opon", confidence: "średnia" };
  }

  return {
    isTire: false,
    reason: "brak słów kluczowych i rozmiaru opony",
    confidence: "niska",
  };
}
