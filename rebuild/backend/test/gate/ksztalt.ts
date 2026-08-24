/**
 * Porównanie KSZTAŁTU odpowiedzi z nagranym fixture'em (contract/fixtures/).
 *
 * Fixtures to „shape fixtures", nie archiwum danych: duże tablice przycięto do 5 elementów
 * (contract/README.md), a wartości zsanityzowano. Porównujemy więc strukturę, nie treść.
 *
 * Polityka (świadoma, opisana w plan.md → „Kontrakt i fixtures"):
 *  - brakujący albo nadmiarowy klucz  → RÓŻNICA (twardy błąd),
 *  - niezgodny typ dwóch wartości ≠ null → RÓŻNICA (twardy błąd),
 *  - fixture ma `null`               → akceptujemy dowolną wartość (kolumna nullable),
 *  - odpowiedź ma `null` tam, gdzie fixture miał wartość → OSTRZEŻENIE, nie błąd
 *    (w 5 nagranych wierszach kolumna akurat była wypełniona — to za mało, by uznać
 *    ją za NOT NULL i wywalać GATE),
 *  - klucze techniczne fixture'a (`_przyciete`, `_body_przyciete_z`) są pomijane.
 */

export type Roznica = { sciezka: string; opis: string };
export type WynikKsztaltu = { roznice: Roznica[]; ostrzezenia: Roznica[] };

const KLUCZ_TECHNICZNY = /^_/;

export function porownajKsztalt(aktualne: unknown, wzorzec: unknown): WynikKsztaltu {
  const wynik: WynikKsztaltu = { roznice: [], ostrzezenia: [] };
  porownaj(aktualne, wzorzec, "$", wynik);
  return wynik;
}

function porownaj(aktualne: unknown, wzorzec: unknown, sciezka: string, wynik: WynikKsztaltu): void {
  if (wzorzec === null) return; // fixture nie mówi nic o typie — kolumna nullable

  if (aktualne === null || aktualne === undefined) {
    wynik.ostrzezenia.push({
      sciezka,
      opis: `odpowiedź ma ${aktualne === null ? "null" : "brak wartości"}, fixture ma ${typNazwa(wzorzec)}`,
    });
    return;
  }

  const typWzorca = typNazwa(wzorzec);
  const typAktualnego = typNazwa(aktualne);
  if (typWzorca !== typAktualnego) {
    wynik.roznice.push({ sciezka, opis: `typ ${typAktualnego}, oczekiwano ${typWzorca}` });
    return;
  }

  if (typWzorca === "array") {
    const wzorcowa = wzorzec as unknown[];
    const aktualnaTab = aktualne as unknown[];
    if (wzorcowa.length === 0) return; // fixture nie pokazuje kształtu elementów
    const szablon = scalElementy(wzorcowa);
    aktualnaTab.forEach((element, i) => porownaj(element, szablon, `${sciezka}[${i}]`, wynik));
    return;
  }

  if (typWzorca === "object") {
    const wzorcowy = wzorzec as Record<string, unknown>;
    const aktualnyObj = aktualne as Record<string, unknown>;
    const kluczeWzorca = Object.keys(wzorcowy).filter((k) => !KLUCZ_TECHNICZNY.test(k));
    const kluczeAktualne = Object.keys(aktualnyObj);

    for (const klucz of kluczeWzorca) {
      if (!(klucz in aktualnyObj)) {
        wynik.roznice.push({ sciezka: `${sciezka}.${klucz}`, opis: "brak klucza w odpowiedzi" });
        continue;
      }
      porownaj(aktualnyObj[klucz], wzorcowy[klucz], `${sciezka}.${klucz}`, wynik);
    }
    for (const klucz of kluczeAktualne) {
      if (!kluczeWzorca.includes(klucz)) {
        wynik.roznice.push({
          sciezka: `${sciezka}.${klucz}`,
          opis: "klucz nadmiarowy — nie ma go w fixture",
        });
      }
    }
  }
  // typy proste (string/number/boolean) — zgodność typu już sprawdzona wyżej
}

/**
 * Scala 5 nagranych elementów tablicy w jeden szablon: bierze sumę kluczy, a dla
 * każdego z nich pierwszą wartość różną od null. Dzięki temu pole obecne tylko
 * w części nagranych wierszy nie generuje fałszywej różnicy.
 */
function scalElementy(elementy: unknown[]): unknown {
  const pierwszy = elementy[0];
  if (typNazwa(pierwszy) !== "object") return pierwszy;

  const szablon: Record<string, unknown> = {};
  for (const element of elementy) {
    if (typNazwa(element) !== "object") continue;
    for (const [klucz, wartosc] of Object.entries(element as Record<string, unknown>)) {
      if (!(klucz in szablon) || szablon[klucz] === null) szablon[klucz] = wartosc;
    }
  }
  return szablon;
}

function typNazwa(wartosc: unknown): string {
  if (wartosc === null) return "null";
  if (Array.isArray(wartosc)) return "array";
  return typeof wartosc;
}

export function opiszRoznice(roznice: Roznica[]): string {
  return roznice.map((r) => `  ${r.sciezka}: ${r.opis}`).join("\n");
}
