// Rozbiór rozmiaru opony — port `bn()`, `YT()`, `JT()` i `ek()`
// (`deminified/backend-index.cjs:47121`, `:47126`, `:47212`, `:47233`).
//
// Warstwa silnika, nie parserów: parsery (port 3a, `legacy/parsers/tyre_params.cjs`) rozbierają
// rozmiar po swojemu przy wczytywaniu pliku, a te funkcje domykają braki na wejściu do stagingu.
// Uzupełniają WYŁĄCZNIE pola, których rekord jeszcze nie ma — patrz `znormalizujPozycje()`.

/** Wynik rozbioru rozmiaru — port stałej `hm` (`:47107`). */
export interface ParametryRozmiaru {
  szerokosc: number | null;
  profil: number | null;
  srednica: number | null;
  konstrukcja: string | null;
  indeksNosnosci: string | null;
  indeksPredkosci: string | null;
  pr: string | null;
  tlTt: string | null;
  vfIf: string | null;
  rozmiarNormalny: string | null;
}

const PUSTE_PARAMETRY: ParametryRozmiaru = {
  szerokosc: null,
  profil: null,
  srednica: null,
  konstrukcja: null,
  indeksNosnosci: null,
  indeksPredkosci: null,
  pr: null,
  tlTt: null,
  vfIf: null,
  rozmiarNormalny: null,
};

/** `parseFloat` tolerujący przecinek dziesiętny — port `bn()` (`:47121`). */
function liczba(wartosc: string): number | null {
  const wynik = parseFloat(wartosc.replace(",", "."));
  return Number.isFinite(wynik) ? wynik : null;
}

interface Indeksy {
  nosn: string;
  pred: string | null;
}

/** Rozbiór zapisu indeksów, np. „150/147" + „A8" albo „150A8". Domknięcie `o` z `:47180`. */
function rozbierzIndeksy(zapis: string | null): Indeksy | null {
  if (!zapis) return null;
  const oczyszczony = zapis.trim();

  const para = oczyszczony.match(
    /^(\d{2,3})\s*([A-Z]\d?)?\s*\/\s*(\d{2,3})\s*([A-Z]\d?)?\s*([A-Z]\d?)?$/,
  );
  if (para) {
    const [, nosnPrzod, predPrzod, nosnTyl, predTyl, predWspolny] = para;
    const pierwszy = predPrzod || predWspolny || null;
    const drugi = predTyl || predWspolny || null;
    return {
      nosn: `${nosnPrzod}/${nosnTyl}`,
      pred: pierwszy && drugi ? `${pierwszy}/${drugi}` : pierwszy || drugi || null,
    };
  }

  const pojedynczy = oczyszczony.match(/^(\d{2,3})\s*([A-Z]\d?)$/);
  return pojedynczy ? { nosn: pojedynczy[1]!, pred: pojedynczy[2]! } : null;
}

/**
 * Parametry techniczne z zapisu rozmiaru — port `YT()` (`:47126`).
 *
 * Rozpoznaje cztery układy rozmiaru (metryczny `480/70R28`, calowy `12.4R28`, `340R24`
 * i rozdzielony spacjami `480 70 R 28`), a na końcu odsiewa wartości spoza zakresu
 * fizycznie sensownego dla opony: szerokość poza 4–1100 i średnicę poza 5–60.
 */
export function parametryZRozmiaru(rozmiar: string | null | undefined): ParametryRozmiaru {
  if (!rozmiar) return PUSTE_PARAMETRY;
  const zapis = String(rozmiar).trim();
  if (!zapis) return PUSTE_PARAMETRY;

  const wynik: ParametryRozmiaru = { ...PUSTE_PARAMETRY };

  const wzmocnienie = zapis.match(/\b(VF|IF|CFO)\b/i);
  if (wzmocnienie) wynik.vfIf = wzmocnienie[1]!.toUpperCase();

  const tlTt = zapis.match(/\b(TL|TT)\b/i);
  if (tlTt) wynik.tlTt = tlTt[1]!.toUpperCase();

  const plyRating = zapis.match(/(\d{1,3})\s*PR\b/i);
  if (plyRating) wynik.pr = plyRating[1]!;

  const metryczny = zapis.match(
    /(\d{2,3}(?:[.,]\d+)?)\s*\/\s*(\d{1,3})\s*([RDB-])\s*(\d{1,3}(?:[.,]\d+)?)/i,
  );

  if (metryczny) {
    wynik.szerokosc = liczba(metryczny[1]!);
    wynik.profil = liczba(metryczny[2]!);
    const znacznik = metryczny[3]!.toUpperCase();
    wynik.konstrukcja = znacznik === "R" ? "R" : znacznik === "B" ? "B" : "D";
    wynik.srednica = liczba(metryczny[4]!);
    const separator = wynik.konstrukcja === "R" ? "R" : wynik.konstrukcja === "B" ? "B" : "-";
    wynik.rozmiarNormalny = `${wynik.szerokosc}/${wynik.profil}${separator}${wynik.srednica}`;
  } else {
    const calowy = zapis.match(/(\d{1,3}[.,]\d{1,2})\s*([R-])\s*(\d{1,3}(?:[.,]\d+)?)/i);
    if (calowy) {
      wynik.szerokosc = liczba(calowy[1]!);
      wynik.konstrukcja = calowy[2]!.toUpperCase() === "R" ? "R" : "D";
      wynik.srednica = liczba(calowy[3]!);
      const separator = wynik.konstrukcja === "R" ? "R" : "-";
      wynik.rozmiarNormalny = `${calowy[1]!.replace(",", ".")}${separator}${wynik.srednica}`;
    } else if (/^\s*\d{1,3}\s*R\s*\d{1,3}(?:[.,]\d+)?/i.test(zapis)) {
      const bezProfilu = zapis.match(/(\d{1,3})\s*(R)\s*(\d{1,3}(?:[.,]\d+)?)/i);
      if (bezProfilu) {
        wynik.szerokosc = liczba(bezProfilu[1]!);
        wynik.konstrukcja = "R";
        wynik.srednica = liczba(bezProfilu[3]!);
        wynik.rozmiarNormalny = `${bezProfilu[1]}R${bezProfilu[3]!.replace(",", ".")}`;
      }
    } else {
      const zeSpacjami = zapis.match(/(\d{2,3})\s+(\d{1,3})\s+([RDB-])\s+(\d{1,3}(?:[.,]\d+)?)/i);
      if (zeSpacjami) {
        wynik.szerokosc = liczba(zeSpacjami[1]!);
        wynik.profil = liczba(zeSpacjami[2]!);
        const znacznik = zeSpacjami[3]!.toUpperCase();
        wynik.konstrukcja = znacznik === "R" ? "R" : znacznik === "B" ? "B" : "D";
        wynik.srednica = liczba(zeSpacjami[4]!);
      }
    }
  }

  // Indeksy: najpierw zapis w nawiasach kwadratowych, potem para „150/147 A8", na końcu „150A8".
  let indeksy: Indeksy | null = null;

  const wNawiasach = zapis.match(/\[([^\]]+)\]\s*([A-Z]\d?)?/);
  if (wNawiasach) {
    const wnetrze = wNawiasach[1]!.trim();
    const predkosc = wNawiasach[2] || "";
    indeksy = rozbierzIndeksy(wnetrze + (predkosc ? ` ${predkosc}` : ""));
  }

  if (!indeksy) {
    const para = zapis.match(/\b(\d{2,3})\s*([A-Z]\d?)?\s*\/\s*(\d{2,3})\s*([A-Z]\d?)\b/);
    if (para) {
      const [, nosnPrzod, predPrzod, nosnTyl, predTyl] = para;
      indeksy = {
        nosn: `${nosnPrzod}/${nosnTyl}`,
        pred: predPrzod ? `${predPrzod}/${predTyl}` : predTyl!,
      };
    }
  }

  if (!indeksy) {
    const sklejony = zapis.match(/\b(\d{2,3})([A-Z]\d?)\b/);
    if (sklejony) {
      const poczatek = zapis.indexOf(sklejony[0]);
      const dalej = zapis.slice(poczatek + sklejony[0].length, poczatek + sklejony[0].length + 4);
      // „6PR" i „28.5" wyglądają jak indeks, ale nim nie są.
      if (!/^PR/i.test(dalej) && !/^\.\d/.test(dalej)) {
        indeksy = { nosn: sklejony[1]!, pred: sklejony[2]! };
      }
    }
  }

  if (indeksy) {
    wynik.indeksNosnosci = indeksy.nosn;
    wynik.indeksPredkosci = indeksy.pred;
  }

  if (wynik.szerokosc !== null && (wynik.szerokosc < 4 || wynik.szerokosc > 1100)) {
    wynik.szerokosc = null;
  }
  if (wynik.srednica !== null && (wynik.srednica < 5 || wynik.srednica > 60)) {
    wynik.srednica = null;
  }

  return wynik;
}

/** Wzorzec rozmiaru wycinanego z nazwy — port `Bq` (`:47211`). */
const ROZMIAR_W_NAZWIE = /\b(VF|IF|CFO)?\s*(\d{3})\s*\/\s*(\d{2,3})\s*[RB-]\s*(\d{1,2}(?:\.\d)?)\b/i;

/**
 * Wycina rozmiar z nazwy i zwraca nazwę bez niego — port `JT()` (`:47212`).
 *
 * Używane tylko wtedy, gdy rekord nie ma własnego pola `rozmiar`.
 */
export function wytnijRozmiarZNazwy(nazwa: string | null | undefined): {
  rozmiar: string | null;
  nazwaBezRozmiaru: string;
} {
  if (!nazwa) return { rozmiar: null, nazwaBezRozmiaru: "" };

  const zapis = String(nazwa);
  const dopasowanie = zapis.match(ROZMIAR_W_NAZWIE);
  if (!dopasowanie) return { rozmiar: null, nazwaBezRozmiaru: zapis.trim() };

  const wzmocnienie = dopasowanie[1] ? dopasowanie[1].toUpperCase() : "";
  const znaleziony = dopasowanie[0];
  const konstrukcja = znaleziony.includes("R") || znaleziony.includes("r")
    ? "R"
    : znaleziony.includes("B") || znaleziony.includes("b")
      ? "B"
      : "-";

  return {
    rozmiar: `${wzmocnienie}${dopasowanie[2]}/${dopasowanie[3]}${konstrukcja}${dopasowanie[4]}`,
    nazwaBezRozmiaru: zapis.replace(znaleziony, " ").replace(/\s{2,}/g, " ").trim(),
  };
}

/** Wymiary wyliczone z rozmiaru metrycznego — port `ek()` (`:47233`). */
export function wymiaryZRozmiaru(rozmiar: string | null | undefined): {
  szerokosc: number | null;
  wysokoscBoku: number | null;
  srednicaZewnMm: number | null;
} {
  const puste = { szerokosc: null, wysokoscBoku: null, srednicaZewnMm: null };
  if (!rozmiar) return puste;

  const dopasowanie = String(rozmiar).match(/(\d{2,3})\s*\/\s*(\d{2,3})\s*[RB-]\s*(\d{1,2}(?:[.,]\d)?)/i);
  if (!dopasowanie) return puste;

  const szerokosc = parseFloat(dopasowanie[1]!);
  const profil = parseFloat(dopasowanie[2]!);
  const srednicaCale = parseFloat(dopasowanie[3]!.replace(",", "."));
  if (!Number.isFinite(szerokosc) || !Number.isFinite(profil) || !Number.isFinite(srednicaCale)) {
    return puste;
  }

  const wysokoscBoku = Math.round(szerokosc * (profil / 100) * 100) / 100;
  return {
    szerokosc,
    wysokoscBoku,
    srednicaZewnMm: Math.round((srednicaCale * 25.4 + 2 * wysokoscBoku) * 100) / 100,
  };
}
