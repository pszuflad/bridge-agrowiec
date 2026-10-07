// Ticket 194: czytanie `szczegoly_json` z dziennika Selly i grupowanie operacji.
import { describe, expect, it } from "vitest";

import {
  analizujSzczegoly,
  czyToUsuwanie,
  formatujCzasLokalny,
  pasujeDoFiltru,
  rodzajBleduZKomunikatu,
} from "@/pages/selly/szczegoly-logu";

describe("grupowanie operacji", () => {
  it.each([
    ["sync_delete", true],
    ["probe_delete_ok", true],
    ["probe_delete_brak_uprawnien", true],
    ["sync_delta", false],
    ["sync_full", false],
    ["sync_supplier", false],
  ])("%s → usuwanie=%s", (operacja, oczekiwane) => {
    expect(czyToUsuwanie(operacja)).toBe(oczekiwane);
  });

  it("filtr: wszystko / synchronizacja / usuwanie", () => {
    expect(pasujeDoFiltru("sync_delete", "wszystko")).toBe(true);
    expect(pasujeDoFiltru("sync_delete", "usuwanie")).toBe(true);
    expect(pasujeDoFiltru("sync_delete", "synchronizacja")).toBe(false);
    expect(pasujeDoFiltru("sync_delta", "synchronizacja")).toBe(true);
    expect(pasujeDoFiltru("sync_delta", "usuwanie")).toBe(false);
  });
});

describe("rodzajBleduZKomunikatu — ta sama reguła co backend", () => {
  it("rozpoznaje kolejkę do utworzenia i odmowę zabezpieczenia", () => {
    expect(rodzajBleduZKomunikatu("produkt nie istnieje w Selly ale brak dictMaps do createProduct")).toBe("pending_create");
    expect(rodzajBleduZKomunikatu("Selly: wariant ma inny magazyn niż oferta Bridge — zapis zablokowany")).toBe("tozsamosc");
    expect(rodzajBleduZKomunikatu("[Selly] HTTP 429")).toBe("inne");
  });
});

describe("analizujSzczegoly", () => {
  it("brak szczegółów", () => {
    expect(analizujSzczegoly("sync_delta", null)).toEqual({ rodzaj: "brak" });
    expect(analizujSzczegoly("sync_delta", "")).toEqual({ rodzaj: "brak" });
  });

  it("uszkodzony (ucięty) JSON nie wywraca widoku", () => {
    const wynik = analizujSzczegoly("sync_delta", '{"stats":{"ok":1},"sample_errors":[{"kod":"A","error":"abc');
    expect(wynik.rodzaj).toBe("uszkodzone");
  });

  it("synchronizacja z podziałem na rodzaje (ticket 194)", () => {
    const wynik = analizujSzczegoly(
      "sync_delta",
      JSON.stringify({
        stats: { total: 31, ok: 9, err: 22, skip: 0 },
        kolizje: [{ dostawca: "MO5" }],
        bledy_wg_rodzaju: { pending_create: 20, tozsamosc: 1, inne: 1 },
        sample_errors: [{ kod: "MO5_1", error: "[Selly] HTTP 500", rodzaj: "inne" }],
      }),
    );
    expect(wynik).toMatchObject({
      rodzaj: "synchronizacja",
      stats: { total: 31, ok: 9, err: 22 },
      bledyWgRodzaju: { pending_create: 20, tozsamosc: 1, inne: 1 },
      kolizje: 1,
    });
    if (wynik.rodzaj === "synchronizacja") expect(wynik.probka[0]).toMatchObject({ kod: "MO5_1", rodzaj: "inne" });
  });

  it("starszy wpis bez rodzajów: rodzaj próbki wyliczany z komunikatu", () => {
    const wynik = analizujSzczegoly(
      "sync_delta",
      JSON.stringify({ stats: { total: 1, ok: 0, err: 1, skip: 0 }, sample_errors: [{ kod: "X", error: "produkt nie istnieje w Selly" }] }),
    );
    expect(wynik).toMatchObject({ rodzaj: "synchronizacja", bledyWgRodzaju: null });
    if (wynik.rodzaj === "synchronizacja") expect(wynik.probka[0]?.rodzaj).toBe("pending_create");
  });

  it("ręczny sync dostawcy (`errors`): próbka i liczby", () => {
    const wynik = analizujSzczegoly(
      "sync_supplier",
      JSON.stringify({ dostawca: "MO1", total: 5, created: 1, updated: 2, failed: 2, skipped: 0, errors: ["zły EAN", { kod: "K1", error: "HTTP 400" }] }),
    );
    expect(wynik).toMatchObject({ rodzaj: "synchronizacja", stats: { total: 5, ok: 3, err: 2, skip: 0 } });
    if (wynik.rodzaj === "synchronizacja") expect(wynik.probka.map((p) => p.kod)).toEqual(["—", "K1"]);
  });

  it("usuwanie: lista usuniętych i bezpiecznik", () => {
    const wynik = analizujSzczegoly(
      "sync_delete",
      JSON.stringify({
        sieroty: 3,
        wpisy: [{ kod: "MO1_A", nazwa: "Opona A", akcja: "usunieto_produkt" }, { kod: "MO1_B", akcja: "pominieto", powod: "brak potwierdzenia" }],
        ucieto_wpisow: 4,
      }),
    );
    expect(wynik).toMatchObject({ rodzaj: "usuwanie", sieroty: 3, uciete: 4, wstrzymano: null });
    if (wynik.rodzaj === "usuwanie") expect(wynik.wpisy[1]).toMatchObject({ kod: "MO1_B", powod: "brak potwierdzenia", nazwa: null });
  });

  it("próba uprawnień: opis", () => {
    expect(analizujSzczegoly("probe_delete_ok", JSON.stringify({ opis: "API Selly ma prawo usuwania" }))).toEqual({
      rodzaj: "opis",
      opis: "API Selly ma prawo usuwania",
    });
  });
});

describe("formatujCzasLokalny", () => {
  it("czas z SQLite (UTC bez strefy) i ISO z „Z” to ta sama chwila", () => {
    expect(formatujCzasLokalny("2026-10-06 10:56:06")).toBe(formatujCzasLokalny("2026-10-06T10:56:06.000Z"));
    expect(formatujCzasLokalny("2026-10-06 10:56:06")).toBe(
      new Date(Date.UTC(2026, 9, 6, 10, 56, 6)).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "medium" }),
    );
  });
  it("puste i nieczytelne wartości", () => {
    expect(formatujCzasLokalny(null)).toBe("—");
    expect(formatujCzasLokalny("nie-data")).toBe("nie-data");
  });
});
