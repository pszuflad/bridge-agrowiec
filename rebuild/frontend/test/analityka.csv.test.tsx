/**
 * Generator CSV kart analityki (`pages/analityka/csv.ts`) — karta P10.3, backlog #91.
 *
 * Format ma być ten sam co eksport serwerowy (`backend/src/analityka/csv.ts`): `;`, `\n`,
 * reguła cudzysłowów, BOM. Świadomie inne (decyzje 2026-09-22): nagłówek z etykiet tabeli,
 * przecinek dziesiętny, wartość pola zamiast tekstu z ekranu.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  escapujKomorkeCsv,
  wartoscKomorkiCsv,
  zbudujCsvTabeli,
  type KolumnaCsv,
} from "@/pages/analityka/csv";
import { PrzyciskCsv } from "@/pages/analityka/eksport";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type Wiersz = {
  dostawca: string;
  nazwa: string | null;
  avgMarza: number | null;
  dostepnoscPct: number | null;
};

const KOLUMNY: KolumnaCsv<Wiersz>[] = [
  { key: "dostawca", label: "Dostawca" },
  { key: "nazwa", label: "Nazwa" },
  { key: "avgMarza", label: "Śr. marża" },
  { key: "dostepnoscPct", label: "Dostępność" },
];

describe("wartoscKomorkiCsv — reguła wartości", () => {
  it("liczby: całkowita bez zmian, dziesiętna z PRZECINKIEM, bez separatora tysięcy", () => {
    expect(wartoscKomorkiCsv(6)).toBe("6");
    expect(wartoscKomorkiCsv(0)).toBe("0");
    expect(wartoscKomorkiCsv(12.5)).toBe("12,5");
    expect(wartoscKomorkiCsv(-3.75)).toBe("-3,75");
    // Pełna precyzja pola — tabela zaokrągla do 2 miejsc tylko do wyświetlenia.
    expect(wartoscKomorkiCsv(1234567.891)).toBe("1234567,891");
  });

  it("NaN i nieskończoność → pusta komórka", () => {
    expect(wartoscKomorkiCsv(Number.NaN)).toBe("");
    expect(wartoscKomorkiCsv(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("brak wartości (null, undefined, pusty napis) → pusta komórka, nie „—”", () => {
    expect(wartoscKomorkiCsv(null)).toBe("");
    expect(wartoscKomorkiCsv(undefined)).toBe("");
    expect(wartoscKomorkiCsv("")).toBe("");
  });

  it("napisy bez zmian — kody z zerami, EAN, znacznik ISO, polskie znaki", () => {
    expect(wartoscKomorkiCsv("0440000005139")).toBe("0440000005139");
    expect(wartoscKomorkiCsv("2026-08-17T14:44:40.244Z")).toBe("2026-08-17T14:44:40.244Z");
    expect(wartoscKomorkiCsv("Ciężarowe ŻÓŁĆ")).toBe("Ciężarowe ŻÓŁĆ");
  });
});

describe("escapujKomorkeCsv — reguła serwera (`csvEscape`)", () => {
  it("cudzysłów wokół pola ze średnikiem, cudzysłowem, \\n albo \\r; wewnętrzny \" podwojony", () => {
    expect(escapujKomorkeCsv("a;b")).toBe('"a;b"');
    expect(escapujKomorkeCsv('opona 20" TL')).toBe('"opona 20"" TL"');
    expect(escapujKomorkeCsv("linia1\nlinia2")).toBe('"linia1\nlinia2"');
    expect(escapujKomorkeCsv("a\rb")).toBe('"a\rb"');
  });

  it("przecinek NIE wymusza cudzysłowu — separatorem jest średnik (jak na serwerze)", () => {
    expect(escapujKomorkeCsv("12,5")).toBe("12,5");
    expect(escapujKomorkeCsv("zwykły tekst")).toBe("zwykły tekst");
  });
});

describe("zbudujCsvTabeli", () => {
  const WIERSZE: Wiersz[] = [
    { dostawca: "MO1", nazwa: "Ciężarowe; BKT", avgMarza: 12.5, dostepnoscPct: 87.5 },
    { dostawca: "MO2", nazwa: null, avgMarza: null, dostepnoscPct: 100 },
  ];

  it("nagłówek z ETYKIET w kolejności kolumn, wiersze z pól spod `key`, `;` i samo `\\n`", () => {
    expect(zbudujCsvTabeli(WIERSZE, KOLUMNY)).toBe(
      [
        "Dostawca;Nazwa;Śr. marża;Dostępność",
        'MO1;"Ciężarowe; BKT";12,5;87,5',
        "MO2;;;100",
      ].join("\n"),
    );
  });

  it("nie ma `\\r\\n` ani BOM-u (BOM dokłada `pobierzPlik`)", () => {
    const csv = zbudujCsvTabeli(WIERSZE, KOLUMNY);
    expect(csv).not.toContain("\r");
    expect(csv.startsWith("\ufeff")).toBe(false);
  });

  it("kolumna z `render` w tabeli daje w pliku surowe pole — liczbę, nie „87,5%”", () => {
    const zRenderem = [
      { ...KOLUMNY[3]!, render: () => "87,5%" },
    ] as unknown as KolumnaCsv<Wiersz>[];
    expect(zbudujCsvTabeli([WIERSZE[0]!], zRenderem)).toBe("Dostępność\n87,5");
  });

  it("pusta lista → sam nagłówek (pusta tabela to też „to, co widać”)", () => {
    expect(zbudujCsvTabeli([], KOLUMNY)).toBe("Dostawca;Nazwa;Śr. marża;Dostępność");
  });

  it("bez limitu wierszy — 1000 wierszy wejścia to 1000 wierszy pliku", () => {
    const duzo = Array.from({ length: 1000 }, (_, i) => ({
      dostawca: `MO${i}`,
      nazwa: "x",
      avgMarza: i,
      dostepnoscPct: null,
    }));
    expect(zbudujCsvTabeli(duzo, KOLUMNY).split("\n")).toHaveLength(1001);
  });
});

describe("PrzyciskCsv → pobierzPlik: BOM, typ MIME, nazwa `<view>.csv`", () => {
  /**
   * Prawdziwe `pobierzPlik` z katalogu, z podmienionym `Blob` — ten sam zabieg co
   * w `katalog.eksport.test.ts`: jsdom bywa niekompletny w API plikowym, a interesuje nas,
   * CO trafia do konstruktora.
   */
  const oryginalnyBlob = globalThis.Blob;
  const oryginalneKlikniecie = HTMLAnchorElement.prototype.click;

  afterEach(() => {
    globalThis.Blob = oryginalnyBlob;
    HTMLAnchorElement.prototype.click = oryginalneKlikniecie;
  });

  it("zapisuje treść z BOM-em jako `text/csv;charset=utf-8` pod nazwą `margins.csv`", async () => {
    const czesci: unknown[][] = [];
    const typy: (string | undefined)[] = [];
    globalThis.Blob = class {
      constructor(fragmenty: unknown[], opcje?: { type?: string }) {
        czesci.push(fragmenty);
        typy.push(opcje?.type);
      }
    } as unknown as typeof Blob;
    Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:t"), configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    let nazwa = "";
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      nazwa = this.download;
    };

    render(
      <PrzyciskCsv
        widok="margins"
        wiersze={[{ dostawca: "MO1", nazwa: "Łódź", avgMarza: 1.5, dostepnoscPct: null }]}
        kolumny={KOLUMNY}
      />,
    );
    await userEvent.setup().click(screen.getByTestId("csv-margins"));

    expect(nazwa).toBe("margins.csv");
    expect(typy).toEqual(["text/csv;charset=utf-8"]);
    expect(czesci).toEqual([
      ["\ufeffDostawca;Nazwa;Śr. marża;Dostępność\nMO1;Łódź;1,5;"],
    ]);
  });

  it("podczas wczytywania przycisk jest nieaktywny", () => {
    render(<PrzyciskCsv widok="margins" wiersze={[]} kolumny={KOLUMNY} wczytywanie />);
    expect(screen.getByTestId("csv-margins")).toBeDisabled();
  });
});
