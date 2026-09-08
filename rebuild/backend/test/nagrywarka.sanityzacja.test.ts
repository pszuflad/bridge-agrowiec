/**
 * Sanityzacja nagrywarki fixtures (`tools/record-write-fixtures.cjs`).
 *
 * ⚠ TE TESTY ISTNIEJĄ Z KONKRETNEGO POWODU. Pierwszy bieg nagrywarki w sesji 12d zapisał do
 * `contract/fixtures/POST_login.json` PRAWDZIWY token JWT: maskowanie chodziło po WARTOŚCIACH
 * zagnieżdżonych, a klucz stojący na najwyższym poziomie ciała (dokładnie tam siedzi `token`
 * w odpowiedzi logowania) nie był w ogóle sprawdzany. Kontrakt wymaga „zero JWT/Bearer"
 * (`contract/README.md`), więc ta funkcja jest granicą bezpieczeństwa, nie kosmetyką —
 * i od tego ticketu ma testy zamiast dobrej wiary.
 *
 * Drugi test w tym pliku patrzy na WYNIK, nie na funkcję: skanuje wszystkie nagrania w repo
 * pod kątem sekretów. Łapie też nagrania dołożone ręcznie albo innym narzędziem.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { KATALOG_FIXTURES, katalogRepo } from "./gate/repo.js";

const wymagaj = createRequire(import.meta.url);
const nagrywarka = wymagaj(
  join(katalogRepo(), "tools", "record-write-fixtures.cjs"),
) as {
  zamaskuj: (w: unknown) => unknown;
  przytnij: (w: unknown) => { wartosc: unknown; przycieteZ: number | null };
  KLUCZE_WRAZLIWE: Set<string>;
  LIMIT_TABLICY: number;
};

const { zamaskuj, przytnij, KLUCZE_WRAZLIWE, LIMIT_TABLICY } = nagrywarka;

describe("nagrywarka — maskowanie sekretów", () => {
  it("maskuje klucz wrażliwy na NAJWYŻSZYM poziomie ciała (regres z 12d)", () => {
    const { wartosc } = przytnij({ ok: true, token: "eyJhbGciOiJIUzI1NiJ9.abc.def" });
    expect(wartosc).toEqual({ ok: true, token: "***" });
  });

  it("maskuje w zagnieżdżeniu i w tablicach", () => {
    expect(zamaskuj({ a: { b: { password: "tajne" } } })).toEqual({ a: { b: { password: "***" } } });
    expect(zamaskuj([{ token: "x" }, { token: "y" }])).toEqual([{ token: "***" }, { token: "***" }]);
  });

  it("maskuje każdy zadeklarowany klucz wrażliwy, niezależnie od miejsca", () => {
    for (const klucz of KLUCZE_WRAZLIWE) {
      expect(przytnij({ [klucz]: "wartosc" }).wartosc, `górny poziom: ${klucz}`).toEqual({
        [klucz]: "***",
      });
      expect(przytnij({ zagniezdzone: { [klucz]: "wartosc" } }).wartosc, `zagnieżdżone: ${klucz}`)
        .toEqual({ zagniezdzone: { [klucz]: "***" } });
    }
  });

  it("nie rusza wartości niewrażliwych ani nie-stringów", () => {
    expect(zamaskuj({ email: "a@b.c", id: 7, token: 42 })).toEqual({
      email: "a@b.c",
      id: 7,
      token: 42,
    });
  });
});

describe("nagrywarka — przycinanie i adnotacje", () => {
  const dlugaLista = Array.from({ length: 9 }, (_, i) => ({ id: i }));

  it("goła tablica: przycięta do limitu, licznik obok body", () => {
    const { wartosc, przycieteZ } = przytnij(dlugaLista);
    expect(wartosc).toHaveLength(LIMIT_TABLICY);
    expect(przycieteZ).toBe(9);
  });

  it("tablica w obiekcie: adnotacja `_przyciete` WEWNĄTRZ body, jak w istniejących nagraniach", () => {
    const { wartosc, przycieteZ } = przytnij({ rows: dlugaLista, total: 9 });
    const wynik = wartosc as { rows: unknown[]; _przyciete: Record<string, number> };
    expect(wynik.rows).toHaveLength(LIMIT_TABLICY);
    expect(wynik._przyciete).toEqual({ rows: 9 });
    expect(przycieteZ).toBeNull();
  });

  it("krótkiej tablicy w obiekcie nie tyka i nie dokłada adnotacji", () => {
    const { wartosc } = przytnij({ rows: [{ id: 1 }] });
    expect(wartosc).toEqual({ rows: [{ id: 1 }] });
  });

  /**
   * Regres: adnotacja `_body_przyciete_z` wychodziła dla KAŻDEJ gołej tablicy, także
   * nieprzyciętej — trzyelementowa odpowiedź dostawała „przycięte z 3", czyli informację,
   * że nagranie jest niepełne, choć było kompletne.
   */
  it("goła tablica mieszcząca się w limicie nie dostaje adnotacji przycięcia", () => {
    const { wartosc, przycieteZ } = przytnij([{ id: 1 }, { id: 2 }]);
    expect(wartosc).toHaveLength(2);
    expect(przycieteZ).toBeNull();
  });

  it("maskuje TAKŻE wewnątrz przyciętych tablic", () => {
    const { wartosc } = przytnij({
      rows: Array.from({ length: 9 }, () => ({ token: "eyJtajne" })),
    });
    const rows = (wartosc as { rows: Array<{ token: string }> }).rows;
    expect(rows.every((r) => r.token === "***")).toBe(true);
  });
});

/**
 * Kontrola WYNIKU, nie narzędzia. Fixtures są w repo na zawsze i są publicznym opisem API —
 * sekret, który tu wejdzie, zostaje w historii gita. Ten test nie zakłada, że wszystkie
 * nagrania powstały nagrywarką.
 */
describe("contract/fixtures — brak sekretów w nagraniach", () => {
  const pliki = readdirSync(KATALOG_FIXTURES()).filter((f) => f.endsWith(".json"));

  it("żaden fixture nie niesie tokenu JWT ani nagłówka Bearer", () => {
    const winne: string[] = [];
    for (const plik of pliki) {
      const tresc = readFileSync(join(KATALOG_FIXTURES(), plik), "utf8");
      // JWT zaczyna się od zakodowanego base64 `{"alg":`; `Bearer ` łapie nagłówki.
      if (/eyJhbGciOi|Bearer\s+[A-Za-z0-9._-]{10,}/.test(tresc)) winne.push(plik);
    }
    expect(winne, `Fixtures z sekretem: ${winne.join(", ")}`).toEqual([]);
  });

  it("pola hasłowe i tokeny są zamaskowane, nie wpisane", () => {
    const winne: string[] = [];
    const sprawdz = (wezel: unknown, plik: string, sciezka: string): void => {
      if (Array.isArray(wezel)) {
        wezel.forEach((w, i) => sprawdz(w, plik, `${sciezka}[${i}]`));
        return;
      }
      if (!wezel || typeof wezel !== "object") return;
      for (const [klucz, wartosc] of Object.entries(wezel as Record<string, unknown>)) {
        if (KLUCZE_WRAZLIWE.has(klucz) && typeof wartosc === "string" && wartosc !== "***") {
          winne.push(`${plik} ${sciezka}.${klucz}`);
        }
        sprawdz(wartosc, plik, `${sciezka}.${klucz}`);
      }
    };
    for (const plik of pliki) {
      sprawdz(JSON.parse(readFileSync(join(KATALOG_FIXTURES(), plik), "utf8")), plik, "$");
    }
    expect(winne, `Niezamaskowane pola wrażliwe: ${winne.join(", ")}`).toEqual([]);
  });
});
