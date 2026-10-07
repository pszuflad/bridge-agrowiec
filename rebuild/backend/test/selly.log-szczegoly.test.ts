// Ticket 194: szczegóły dziennika Selly — rodzaje błędów i serializacja, która nie psuje JSON-a.
import { describe, expect, it } from "vitest";

import { szczegolyDoZapisu, MAKS_ZNAKOW_SZCZEGOLOW } from "../src/selly/rest/log-szczegoly.js";
import { podsumujBledy, rodzajBledu } from "../src/selly/rest/sync-delta.js";

describe("rodzajBledu", () => {
  it.each([
    ["produkt nie istnieje w Selly ale brak dictMaps do createProduct", "pending_create"],
    ["brak dictMaps do createProduct", "pending_create"],
    ["Selly: produkt docelowy nie odpowiada ofercie Bridge — zapis zablokowany", "tozsamosc"],
    ["Selly: wariant ma inny magazyn niż oferta Bridge — zapis zablokowany", "tozsamosc"],
    ["[Selly] HTTP 429: Too Many Requests", "inne"],
    ["", "inne"],
  ])("%j → %s", (komunikat, oczekiwany) => {
    expect(rodzajBledu(komunikat)).toBe(oczekiwany);
  });
});

describe("podsumujBledy", () => {
  it("liczy WSZYSTKIE błędy, a próbka ma po 10 z rodzaju — najpierw te, które wymagają uwagi", () => {
    const bledy = [
      ...Array.from({ length: 25 }, (_, i) => ({ kod: `P${i}`, error: "produkt nie istnieje w Selly" })),
      ...Array.from({ length: 12 }, (_, i) => ({ kod: `T${i}`, error: "produkt docelowy ... zapis zablokowany" })),
      { kod: "X1", error: "[Selly] HTTP 500" },
    ];
    const { bledy_wg_rodzaju, sample_errors } = podsumujBledy(bledy);
    expect(bledy_wg_rodzaju).toEqual({ pending_create: 25, tozsamosc: 12, inne: 1 });
    expect(sample_errors).toHaveLength(1 + 10 + 10);
    expect(sample_errors[0]).toMatchObject({ kod: "X1", rodzaj: "inne" });
    expect(sample_errors[1]).toMatchObject({ rodzaj: "tozsamosc" });
    expect(sample_errors.at(-1)).toMatchObject({ rodzaj: "pending_create" });
  });
});

describe("szczegolyDoZapisu", () => {
  it("mały obiekt zapisuje bez zmian", () => {
    const d = { stats: { ok: 1 }, sample_errors: [{ kod: "A", error: "x" }] };
    expect(JSON.parse(szczegolyDoZapisu(d))).toEqual(d);
  });

  it("za długie szczegóły: skraca LISTĘ błędów, a wynik jest poprawnym JSON-em w limicie", () => {
    const d = {
      stats: { ok: 3, err: 40 },
      bledy_wg_rodzaju: { inne: 40 },
      sample_errors: Array.from({ length: 40 }, (_, i) => ({ kod: `K${i}`, error: "E".repeat(400), rodzaj: "inne" })),
    };
    const json = szczegolyDoZapisu(d);
    expect(json.length).toBeLessThanOrEqual(MAKS_ZNAKOW_SZCZEGOLOW);
    const wynik = JSON.parse(json) as typeof d & { ucieto_sample_errors: number };
    expect(wynik.stats).toEqual(d.stats);
    expect(wynik.sample_errors.length).toBeLessThan(40);
    expect(wynik.sample_errors.length + wynik.ucieto_sample_errors).toBe(40);
    // zachowana jest pierwsza (najważniejsza) próbka
    expect(wynik.sample_errors[0]).toEqual(d.sample_errors[0]);
  });

  it("gdy listy nie wystarczą: poprawny JSON ze znacznikiem `ucieto` zamiast obciętego tekstu", () => {
    const d = { stats: { ok: 1 }, bledy_wg_rodzaju: { inne: 1 }, inne_pole: "Z".repeat(20000) };
    const json = szczegolyDoZapisu(d);
    expect(json.length).toBeLessThanOrEqual(MAKS_ZNAKOW_SZCZEGOLOW);
    expect(JSON.parse(json)).toMatchObject({ ucieto: true, stats: { ok: 1 } });
  });
});
