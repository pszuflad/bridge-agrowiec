/**
 * Format CSV eksportu analityki — jednostkowo, bez serwera i bez bazy.
 *
 * Te asercje są jedynym świadectwem kształtu odpowiedzi `GET /api/analytics/export/{view}`:
 * trasa nie ma fixture'a (nagrywarka zapisywała wyłącznie JSON, `contract/README.md`),
 * a `contract/openapi.yaml:178-188` nie deklaruje dla niej żadnego `content`. Cały ciężar
 * niesie ten plik i `analityka.eksport.agregaty.test.ts`.
 *
 * Wzorzec do porównania: `mirror/backend/analytics_module.cjs:56-57`.
 */
import { describe, expect, it } from "vitest";

import { BOM, escapujKomorke, naCsv } from "../src/analityka/csv.js";

describe("escapujKomorke — port csvEscape (:56)", () => {
  it("puste pole dla null i undefined, nie napis „null”", () => {
    expect(escapujKomorke(null)).toBe("");
    expect(escapujKomorke(undefined)).toBe("");
  });

  it("liczby i zwykły tekst idą bez cudzysłowów", () => {
    expect(escapujKomorke(0)).toBe("0");
    expect(escapujKomorke(12.5)).toBe("12.5");
    expect(escapujKomorke("MO9_336320")).toBe("MO9_336320");
  });

  it("PRZECINEK nie jest separatorem — pola z przecinkiem zostają gołe", () => {
    expect(escapujKomorke("Agro-Rami, BKT")).toBe("Agro-Rami, BKT");
  });

  it("średnik wymusza cudzysłowy", () => {
    expect(escapujKomorke("a;b")).toBe('"a;b"');
  });

  it("cudzysłów jest podwajany wewnątrz cudzysłowów", () => {
    expect(escapujKomorke('opona 15" TL')).toBe('"opona 15"" TL"');
    expect(escapujKomorke('""')).toBe('""""""');
  });

  it("złamanie wiersza (\\n i \\r) wymusza cudzysłowy", () => {
    expect(escapujKomorke("a\nb")).toBe('"a\nb"');
    expect(escapujKomorke("a\r\nb")).toBe('"a\r\nb"');
  });
});

describe("naCsv — port toCsv (:57)", () => {
  it("pusta lista to SAM BOM — poprawny wynik, nie błąd (backlog #32)", () => {
    expect(naCsv([])).toBe(BOM);
    expect(naCsv([])).toBe("﻿");
    expect(naCsv([]).length).toBe(1);
  });

  it("BOM stoi na początku pliku z danymi", () => {
    expect(naCsv([{ a: 1 }]).startsWith("﻿")).toBe(true);
  });

  it("separatorem jest średnik, nie przecinek", () => {
    expect(naCsv([{ kod: "MO1_1", dostawca: "MO1" }])).toBe(`${BOM}kod;dostawca\nMO1_1;MO1`);
  });

  it("nagłówek to klucze PIERWSZEGO wiersza, w kolejności z SELECT-a", () => {
    const csv = naCsv([
      { kod: "A", nazwa: "pierwsza", marza_pct: 12 },
      { kod: "B", nazwa: "druga", marza_pct: 8 },
    ]);
    expect(csv.split("\n")[0]).toBe(`${BOM}kod;nazwa;marza_pct`);
  });

  it("wiersz o INNYCH kluczach gubi swoje pola — port dosłowny, nie suma kluczy", () => {
    const csv = naCsv([{ a: 1 }, { b: 2 } as unknown as Record<string, unknown>]);
    expect(csv).toBe(`${BOM}a\n1\n`);
  });

  it("wiersze rozdziela samo \\n, bez \\r", () => {
    const csv = naCsv([{ a: 1 }, { a: 2 }]);
    expect(csv).toBe(`${BOM}a\n1\n2`);
    expect(csv).not.toContain("\r");
  });

  it("escapowanie działa w komórkach, nie w nagłówku wartości", () => {
    const csv = naCsv([{ opis: 'MO3; błąd "HTTP"', dostawca: null }]);
    expect(csv).toBe(`${BOM}opis;dostawca\n"MO3; błąd ""HTTP""";`);
  });
});
