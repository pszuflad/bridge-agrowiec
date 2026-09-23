/**
 * Odświeżanie dostępności (`src/selly/dostepnosc.ts`, port
 * `origin/main:mirror/backend/availability_sync.cjs`; karta I15.10, ticket 119).
 *
 * ⚠ Moduł steruje operacjami, które zmieniają cudzy sklep — tu generator CSV i `syncDelta`
 * są WSTRZYKNIĘTE jako atrapy, więc żaden test nie dotyka sieci ani nie pisze pliku CSV.
 * Sprawdzamy semantykę KOLEJKI, nie działanie generatora (ten ma własne testy).
 */
import { describe, expect, it, vi } from "vitest";

import { stworzSynchronizacjeDostepnosci, ustawDomyslnaSynchronizacjeDostepnosci, zadajOdswiezenie } from "../src/selly/dostepnosc.js";
import type { Baza } from "../src/db/index.js";
import type { Discovery } from "../src/selly/rest/discovery.js";
import type { SciezkiCsvSelly } from "../src/selly/generator-csv.js";

const SCIEZKI: SciezkiCsvSelly = { katalog: "/nieistotne", plik: "selly.csv", url: "https://przyklad/selly.csv" };

/** Zapis przebiegu: `csv` albo `delta:<dostawca>` — kolejność zdarzeń jest tu istotna. */
type Slad = string[];

function stworz(opcje: { przyCsv?: () => void; przyDelcie?: (dostawca: string) => void } = {}) {
  const slad: Slad = [];
  const instancja = stworzSynchronizacjeDostepnosci({
    db: {} as Baza,
    discovery: {} as Discovery,
    sciezkiCsv: SCIEZKI,
    generujCsv: () => {
      slad.push("csv");
      opcje.przyCsv?.();
      return { wiersze: 0 };
    },
    synchronizujDelte: async (_db, _discovery, dostawca) => {
      slad.push(`delta:${dostawca}`);
      opcje.przyDelcie?.(dostawca);
      return {};
    },
  });
  return { instancja, slad };
}

describe("dostępność — kolejkowanie odświeżeń", () => {
  it("dwa zgłoszenia pod rząd → JEDEN bieg generatora i po jednej delcie na dostawcę", async () => {
    const { instancja, slad } = stworz();

    instancja.zadajOdswiezenie("MO9");
    instancja.zadajOdswiezenie("MO2");
    await instancja.poczekajNaKoniec();

    // Jedna partia: CSV raz, potem delty sekwencyjnie.
    expect(slad).toEqual(["csv", "delta:MO9", "delta:MO2"]);
  });

  it("to samo zgłoszenie dwa razy → dostawca odpytany raz (zbiór, nie lista)", async () => {
    const { instancja, slad } = stworz();

    instancja.zadajOdswiezenie("MO9");
    instancja.zadajOdswiezenie("MO9");
    await instancja.poczekajNaKoniec();

    expect(slad).toEqual(["csv", "delta:MO9"]);
  });

  it("zgłoszenie W TRAKCIE biegu NIE ginie — trafia do kolejnego obrotu pętli", async () => {
    let dorzucono = false;
    const { instancja, slad } = stworz({
      przyDelcie: (dostawca) => {
        if (dostawca === "MO9" && !dorzucono) {
          dorzucono = true;
          instancja.zadajOdswiezenie("MO2");
        }
      },
    });

    instancja.zadajOdswiezenie("MO9");
    await instancja.poczekajNaKoniec();

    // Druga partia to osobny obrót: własny generator CSV i własna delta.
    expect(slad).toEqual(["csv", "delta:MO9", "csv", "delta:MO2"]);
  });

  it("zgłoszenie w trakcie biegu nie uruchamia DRUGIEGO biegu równolegle", async () => {
    let dorzucono = false;
    const { instancja, slad } = stworz({
      przyDelcie: (dostawca) => {
        if (dostawca === "MO9" && !dorzucono) {
          dorzucono = true;
          // Dwa zgłoszenia w trakcie biegu → mają dać JEDEN dodatkowy obrót, nie dwa.
          instancja.zadajOdswiezenie("MO9");
          instancja.zadajOdswiezenie("MO9");
        }
      },
    });

    instancja.zadajOdswiezenie("MO9");
    await instancja.poczekajNaKoniec();

    // Dwa dorzucenia tego samego dostawcy → dokładnie jeden dodatkowy obrót.
    expect(slad).toEqual(["csv", "delta:MO9", "csv", "delta:MO9"]);
  });

  it("`zadajOdswiezenie` wraca synchronicznie — nie czeka na generator ani na deltę", () => {
    const { instancja, slad } = stworz();

    instancja.zadajOdswiezenie("MO9");

    // Praca jest zaplanowana przez `setImmediate`, więc w tym samym tiku nic się nie wydarzyło.
    expect(slad).toEqual([]);
  });
});

describe("dostępność — błędy tylko logowane", () => {
  it("błąd generatora nie wycieka; kolejny bieg znów działa", async () => {
    const konsola = vi.spyOn(console, "error").mockImplementation(() => {});
    let pierwszy = true;
    const { instancja, slad } = stworz({
      przyCsv: () => {
        if (pierwszy) {
          pierwszy = false;
          throw new Error("generator padł");
        }
      },
    });

    instancja.zadajOdswiezenie("MO9");
    await expect(instancja.poczekajNaKoniec()).resolves.toBeUndefined();

    expect(slad).toEqual(["csv"]); // delta nie doszła do skutku
    expect(konsola).toHaveBeenCalledWith(expect.stringContaining("ponowi okresowa synchronizacja"));

    // Moduł nie został zakleszczony przez błąd — `wTrakcie` wróciło do false.
    instancja.zadajOdswiezenie("MO2");
    await instancja.poczekajNaKoniec();
    expect(slad).toEqual(["csv", "csv", "delta:MO2"]);
    konsola.mockRestore();
  });

  it("błąd delty nie wycieka i nie blokuje kolejnych zgłoszeń", async () => {
    const konsola = vi.spyOn(console, "error").mockImplementation(() => {});
    const { instancja, slad } = stworz({
      przyDelcie: (dostawca) => {
        if (dostawca === "MO9") throw new Error("Selly padło");
      },
    });

    instancja.zadajOdswiezenie("MO9");
    await instancja.poczekajNaKoniec();
    expect(konsola).toHaveBeenCalled();

    instancja.zadajOdswiezenie("MO2");
    await instancja.poczekajNaKoniec();
    expect(slad).toEqual(["csv", "delta:MO9", "csv", "delta:MO2"]);
    konsola.mockRestore();
  });

  it("błąd w środku partii GUBI niedokończonych dostawców — ponawia dopiero cykl okresowy", async () => {
    const konsola = vi.spyOn(console, "error").mockImplementation(() => {});
    let padnij = true;
    const { instancja, slad } = stworz({
      przyDelcie: (dostawca) => {
        if (dostawca === "MO9" && padnij) {
          padnij = false;
          throw new Error("Selly padło");
        }
      },
    });

    instancja.zadajOdswiezenie("MO9");
    instancja.zadajOdswiezenie("MO2");
    await instancja.poczekajNaKoniec();

    // Pętla CZYŚCI `oczekujace` PRZED przetwarzaniem partii, więc po wyjątku na MO9 nie ma już
    // śladu po MO2 — restart z `finally` nie ma czego wznowić. MO2 NIE zostanie odświeżony
    // w tym biegu; nadrabia to dopiero okresowa synchronizacja (komentarz oryginału:
    // „periodic sync will retry”). Zachowanie wierne `availability_sync.cjs` — nie naprawiamy.
    expect(slad).toEqual(["csv", "delta:MO9"]);
    konsola.mockRestore();
  });
});

describe("dostępność — punkt wejścia dla karty I15.4", () => {
  it("bez skonfigurowanej instancji `zadajOdswiezenie` nie robi NIC", () => {
    ustawDomyslnaSynchronizacjeDostepnosci(null);
    // Odpowiednik bramki `staging_policy.cjs:131-134`: kopia testowa nie rusza sklepu.
    expect(() => zadajOdswiezenie("MO9")).not.toThrow();
  });

  it("po zamontowaniu instancji zgłoszenie do niej dociera", async () => {
    const { instancja, slad } = stworz();
    ustawDomyslnaSynchronizacjeDostepnosci(instancja);

    zadajOdswiezenie("MO9");
    await instancja.poczekajNaKoniec();

    expect(slad).toEqual(["csv", "delta:MO9"]);
    ustawDomyslnaSynchronizacjeDostepnosci(null);
  });
});
