/**
 * Format CSV eksportu katalogu — czyste funkcje z `pages/katalog/eksport.ts`.
 *
 * Porty: `Qy` (:23046), `OT` (:23052), `TT` (:22706-22731), odsiew i nazwy plików
 * (:23384-23422). Produkty bierzemy z `contract/fixtures/GET_products.json`, żeby
 * przypadki brzegowe liczyły się na realnych danych, a nie na wymyślonych.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  KOLUMNY_SHOPER,
  SEPARATOR_DOMYSLNY,
  dataDoNazwyPliku,
  escapujCsv,
  pobierzPlik,
  odsiejDoEksportu,
  parsujKolumnyShoper,
  wartoscKomorki,
  zbudujCsv,
  type KolumnaEksportu,
} from "@/pages/katalog/eksport";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import { produktyZFixtura } from "./msw/kontrakt";

const PRODUKTY = produktyZFixtura();
const WZORCOWY = PRODUKTY[0]!;

function produkt(nadpisania: Partial<Produkt>): Produkt {
  return { ...WZORCOWY, ...nadpisania };
}

describe("1. Domyślne kolumny formatu Shoper (port `TT`)", () => {
  it("ma dokładnie 13 par w kolejności oryginału", () => {
    expect(KOLUMNY_SHOPER.map((k) => `${k.key}:${k.label}`)).toEqual([
      "kodDostawcy:kod_dostawcy",
      "nazwa:nazwa",
      "marka:marka",
      "kategoria:kategoria",
      "dostawca:dostawca",
      "stan:stan",
      "cenaZakupu:cena_zakupu",
      "cenaSprzedazy:cena_sprzedazy",
      "marzaPct:marza_pct",
      "vat:vat",
      "ean:ean",
      "status:status",
      "linkZdjecia:link_zdjecia",
    ]);
  });
});

describe("2. Escaping (port `Qy`)", () => {
  it("nie cytuje wartości bez znaków specjalnych", () => {
    expect(escapujCsv("Opona 540/65R28")).toBe("Opona 540/65R28");
  });

  it("cytuje przy średniku, przecinku, cudzysłowie i nowej linii", () => {
    expect(escapujCsv("a;b")).toBe('"a;b"');
    expect(escapujCsv("a,b")).toBe('"a,b"');
    expect(escapujCsv("a\nb")).toBe('"a\nb"');
    expect(escapujCsv('cal 20"')).toBe('"cal 20"""');
  });

  it("null i undefined dają pusty string", () => {
    expect(escapujCsv(null)).toBe("");
    expect(escapujCsv(undefined)).toBe("");
  });
});

describe("3. Przypadki specjalne kolumn (port `OT`)", () => {
  it("stan -1 („na zamówienie”) wychodzi jako 0", () => {
    expect(wartoscKomorki(produkt({ stan: -1 } as Partial<Produkt>), "stan")).toBe("0");
    expect(wartoscKomorki(produkt({ stan: 7 } as Partial<Produkt>), "stan")).toBe("7");
  });

  it("kodDostawcy gubi prefiks dostawcy, gdy ten zgadza się z kodem", () => {
    const zPrefiksem = produkt({ kod: "MO1_ABC123", dostawca: "MO1" } as Partial<Produkt>);
    expect(wartoscKomorki(zPrefiksem, "kodDostawcy")).toBe("MO1ABC123");
  });

  it("kodDostawcy zostawia wartość, gdy prefiks NIE jest kodem dostawcy", () => {
    const obcyPrefiks = produkt({
      kod: "XX_ABC123",
      dostawca: "MO1",
      kodDostawcy: "ABC123",
    } as Partial<Produkt>);
    expect(wartoscKomorki(obcyPrefiks, "kodDostawcy")).toBe("ABC123");
  });

  it("ean zostawia same cyfry", () => {
    expect(wartoscKomorki(produkt({ ean: "59-012 345/6789" } as Partial<Produkt>), "ean")).toBe(
      "590123456789",
    );
  });

  it("konstrukcja i tlTt są rozwijane do pełnych nazw", () => {
    expect(wartoscKomorki(produkt({ konstrukcja: "R" } as Partial<Produkt>), "konstrukcja")).toBe(
      "Radialna",
    );
    for (const kod of ["D", "L", "B"]) {
      expect(
        wartoscKomorki(produkt({ konstrukcja: kod } as Partial<Produkt>), "konstrukcja"),
      ).toBe("Diagonalna");
    }
    // Nieznana wartość → pusto, nie surowy kod.
    expect(wartoscKomorki(produkt({ konstrukcja: "Z" } as Partial<Produkt>), "konstrukcja")).toBe(
      "",
    );

    // „TL (bezdętkowa)” ma nawias, ale nie ma `,` `;` `"` ani `\n`, więc NIE jest cytowane.
    expect(wartoscKomorki(produkt({ tlTt: "TL" } as Partial<Produkt>), "tlTt")).toBe(
      "TL (bezdętkowa)",
    );
    expect(wartoscKomorki(produkt({ tlTt: "TT" } as Partial<Produkt>), "tlTt")).toBe(
      "TT (dętkowa)",
    );
  });

  it("pr dostaje sufiks PR, a pusty zostaje pusty", () => {
    expect(wartoscKomorki(produkt({ pr: 12 } as Partial<Produkt>), "pr")).toBe("12PR");
    expect(wartoscKomorki(produkt({ pr: null } as Partial<Produkt>), "pr")).toBe("");
  });

  it("flagi sb/sf/hf/ls i zwykłe boolean-y dają „Tak” albo pusto", () => {
    expect(wartoscKomorki(produkt({ sb: true } as Partial<Produkt>), "sb")).toBe("Tak");
    expect(wartoscKomorki(produkt({ sb: false } as Partial<Produkt>), "sb")).toBe("");
    expect(wartoscKomorki(produkt({ ms: true } as Partial<Produkt>), "ms")).toBe("Tak");
    expect(wartoscKomorki(produkt({ ms: false } as Partial<Produkt>), "ms")).toBe("");
  });
});

describe("4. Budowa CSV (port `OT`)", () => {
  const kolumny: KolumnaEksportu[] = [
    { key: "nazwa", label: "nazwa" },
    { key: "dostawca", label: "dostawca" },
  ];

  it("pierwszy wiersz to etykiety kolumn", () => {
    const csv = zbudujCsv([], kolumny, ";");
    expect(csv).toBe("nazwa;dostawca");
  });

  it("wiersze łączy `\\n`, nie `\\r\\n`", () => {
    const csv = zbudujCsv(PRODUKTY.slice(0, 2), kolumny, ";");
    expect(csv).not.toContain("\r");
    expect(csv.split("\n")).toHaveLength(3);
  });

  it("separator wchodzi i do nagłówka, i do wierszy", () => {
    const csv = zbudujCsv(PRODUKTY.slice(0, 1), kolumny, "|");
    const [naglowek, wiersz] = csv.split("\n");
    expect(naglowek).toBe("nazwa|dostawca");
    expect(wiersz).toContain("|");
  });

  it("domyślny separator to średnik", () => {
    expect(SEPARATOR_DOMYSLNY).toBe(";");
    expect(zbudujCsv([], kolumny)).toBe("nazwa;dostawca");
  });
});

describe("5. Parsowanie `shoper.kolumny` z konfiguracji", () => {
  it("czyta pary klucz:naglowek i przycina spacje", () => {
    expect(parsujKolumnyShoper("nazwa: Nazwa produktu\nean:EAN")).toEqual([
      { key: "nazwa", label: "Nazwa produktu" },
      { key: "ean", label: "EAN" },
    ]);
  });

  it("etykieta może zawierać dwukropek — dzieli tylko PIERWSZY", () => {
    expect(parsujKolumnyShoper("nazwa:Produkt: pełna nazwa")).toEqual([
      { key: "nazwa", label: "Produkt: pełna nazwa" },
    ]);
  });

  it("pomija linie bez dwukropka", () => {
    expect(parsujKolumnyShoper("nazwa:Nazwa\nśmieć\n\nean:EAN")).toHaveLength(2);
  });
});

describe("6. Odsiew produktów", () => {
  it("wyrzuca pozycje z zerową ceną zakupu albo sprzedaży", () => {
    const wejscie = [
      produkt({ kod: "ok", cenaZakupu: 100, cenaSprzedazy: 150 } as Partial<Produkt>),
      produkt({ kod: "zeroZakup", cenaZakupu: 0, cenaSprzedazy: 150 } as Partial<Produkt>),
      produkt({ kod: "zeroSprzedaz", cenaZakupu: 100, cenaSprzedazy: 0 } as Partial<Produkt>),
    ];
    expect(odsiejDoEksportu(wejscie).map((p) => p.kod)).toEqual(["ok"]);
  });

  it("wyrzuca też null, undefined i nieliczbowe ceny", () => {
    const wejscie = [
      produkt({ kod: "null", cenaZakupu: null, cenaSprzedazy: 150 } as Partial<Produkt>),
      produkt({ kod: "brak", cenaSprzedazy: 150, cenaZakupu: undefined } as Partial<Produkt>),
      produkt({ kod: "tekst", cenaZakupu: "abc", cenaSprzedazy: 150 } as Partial<Produkt>),
    ];
    expect(odsiejDoEksportu(wejscie)).toHaveLength(0);
  });

  it("cena podana STRINGIEM przechodzi, jeśli jest niezerowa", () => {
    // Oryginał robi `Number(x)`, więc „100” jest poprawną ceną — wierność ma znaczenie,
    // bo staging bywa tekstowy (backlog #3).
    const wejscie = [
      produkt({ kod: "string", cenaZakupu: "100", cenaSprzedazy: "150" } as Partial<Produkt>),
    ];
    expect(odsiejDoEksportu(wejscie)).toHaveLength(1);
  });
});

describe("7. Nazwa pliku", () => {
  it("data w formacie RRRR-MM-DD", () => {
    expect(dataDoNazwyPliku(new Date("2026-09-04T22:13:00Z"))).toBe("2026-09-04");
  });

  /**
   * Same wzorce nazw — składane w `Katalog.tsx`, tu zamrożone jako kontrakt formatu.
   * Gałąź Shoperowa: `shoper_{dostawca|wszyscy}_{data}.csv`.
   * Gałąź wybranych kolumn: `katalog_{dostawca|wszyscy}_wybrane_{data}.csv`.
   */
  it("wzorce zgadzają się z oryginałem", () => {
    const data = dataDoNazwyPliku(new Date("2026-09-04T00:00:00Z"));
    expect(`shoper_wszyscy_${data}.csv`).toBe("shoper_wszyscy_2026-09-04.csv");
    expect(`shoper_MO3_${data}.csv`).toBe("shoper_MO3_2026-09-04.csv");
    expect(`katalog_wszyscy_wybrane_${data}.csv`).toBe(
      "katalog_wszyscy_wybrane_2026-09-04.csv",
    );
    expect(`katalog_MO3_wybrane_${data}.csv`).toBe("katalog_MO3_wybrane_2026-09-04.csv");
  });
});

describe("8. Pobranie pliku (port `IT`)", () => {
  /**
   * Podmieniamy `Blob` na rejestrator zamiast czytać go asynchronicznie: jsdom bywa
   * niekompletny w API plikowym, a interesuje nas dokładnie to, CO trafia do konstruktora
   * — czyli czy BOM naprawdę idzie na początek treści.
   */
  const oryginalnyBlob = globalThis.Blob;
  const oryginalneKlikniecie = HTMLAnchorElement.prototype.click;
  let czesci: unknown[][] = [];
  let typy: (string | undefined)[] = [];
  let ostatniaPobrana = "";
  let bylaWDom = false;

  beforeEach(() => {
    ostatniaPobrana = "";
    bylaWDom = false;
    HTMLAnchorElement.prototype.click = function przechwycone(this: HTMLAnchorElement) {
      ostatniaPobrana = this.download;
      bylaWDom = document.body.contains(this);
    };
  });

  function podmienBlob() {
    czesci = [];
    typy = [];
    class BlobRejestrujacy {
      constructor(fragmenty: unknown[], opcje?: { type?: string }) {
        czesci.push(fragmenty);
        typy.push(opcje?.type);
      }
    }
    globalThis.Blob = BlobRejestrujacy as unknown as typeof Blob;
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:test"),
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
  }

  afterEach(() => {
    globalThis.Blob = oryginalnyBlob;
    HTMLAnchorElement.prototype.click = oryginalneKlikniecie;
    vi.useRealTimers();
  });

  it("dokleja BOM na początku i ustawia typ `text/csv;charset=utf-8`", () => {
    podmienBlob();
    pobierzPlik("plik.csv", "nazwa;ean");

    expect(czesci).toHaveLength(1);
    // BOM (U+FEFF) sklejony z treścią JAKO PIERWSZY fragment — bez niego Excel psuje
    // polskie znaki.
    expect(czesci[0]).toEqual(["\ufeffnazwa;ean"]);
    expect(typy[0]).toBe("text/csv;charset=utf-8");
  });

  it("klika kotwicę z atrybutem `download` i sprząta po sobie", () => {
    podmienBlob();
    vi.useFakeTimers();

    pobierzPlik("katalog_MO3_wybrane_2026-09-04.csv", "a;b");

    expect(ostatniaPobrana).toBe("katalog_MO3_wybrane_2026-09-04.csv");
    // Kotwica musi być w DOM w chwili kliknięcia…
    expect(bylaWDom).toBe(true);
    // …i zniknąć zaraz po nim.
    expect(document.querySelector("a[download]")).toBeNull();

    // URL zwalniany dopiero po sekundzie (`setTimeout` w `IT`).
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
