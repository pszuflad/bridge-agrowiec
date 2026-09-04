/**
 * Blokada środowiskowa integracji Selly (`src/selly/tryb.ts`, ticket 34).
 *
 * Najważniejszy test w tym pliku to NIE żaden z testów blokowania, tylko
 * **test kompletności** w sekcji 1: pilnuje, że lista metod zapisujących pokrywa się
 * z faktycznym interfejsem `KlientSelly`. Bez niego dopisanie w przyszłości nowej metody
 * zapisu po cichu ominęłoby blokadę — a to jedyny sposób, w jaki ta ochrona może zawieść
 * niezauważenie.
 */
import { describe, expect, it, vi } from "vitest";

import type { KlientSelly } from "../src/selly/klient.js";
import {
  BlokadaSelly,
  METODY_ODCZYTU,
  METODY_ZAPISUJACE,
  opakujKlientaTrybem,
} from "../src/selly/tryb.js";

/**
 * Atrapa notująca, co realnie zostało wywołane.
 *
 * Każda metoda zwraca obietnicę — blokada ma zadziałać ZANIM którakolwiek się wykona,
 * więc pusta lista wywołań jest tu dowodem, a nie brakiem asercji.
 */
function atrapaKlienta(): { klient: KlientSelly; wywolania: string[] } {
  const wywolania: string[] = [];
  const metoda = (nazwa: string) =>
    vi.fn(async () => {
      wywolania.push(nazwa);
      return {} as never;
    });

  const klient = {
    ping: metoda("ping"),
    listProducers: metoda("listProducers"),
    listCategories: metoda("listCategories"),
    listVatRates: metoda("listVatRates"),
    listWarehouses: metoda("listWarehouses"),
    createProducer: metoda("createProducer"),
    createCategory: metoda("createCategory"),
    createProduct: metoda("createProduct"),
    updateProduct: metoda("updateProduct"),
    upsertProductWarehouse: metoda("upsertProductWarehouse"),
    setProductMultiCat: metoda("setProductMultiCat"),
  } as unknown as KlientSelly;

  return { klient, wywolania };
}

/** Wywołuje metodę po nazwie — pozwala przelecieć całą listę bez pisania jej dwa razy. */
async function wywolaj(klient: KlientSelly, nazwa: string): Promise<unknown> {
  const fn = (klient as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[nazwa];
  return await fn!.call(klient);
}

describe("1. ⭐ Kompletność listy metod — strażnik całej blokady", () => {
  it("odczyt + zapis pokrywa DOKŁADNIE interfejs KlientSelly", () => {
    const { klient } = atrapaKlienta();
    const wInterfejsie = Object.keys(klient).sort();
    const wListach = [...METODY_ODCZYTU, ...METODY_ZAPISUJACE].sort();

    // Gdyby ten test padł, to znaczy, że ktoś dodał metodę do `KlientSelly` i NIE
    // zdecydował, czy jest zapisem. Domyślnie ominęłaby blokadę w trybie `tylko-odczyt`.
    expect(wListach).toEqual(wInterfejsie);
  });

  it("żadna metoda nie jest jednocześnie odczytem i zapisem", () => {
    const wspolne = METODY_ODCZYTU.filter((m) =>
      (METODY_ZAPISUJACE as readonly string[]).includes(m),
    );
    expect(wspolne).toEqual([]);
  });

  it("lista zapisów zawiera wszystkie metody create/update/upsert/set", () => {
    // Heurystyka nazewnicza jako druga para oczu: metoda o takim przedrostku, która NIE jest
    // na liście zapisów, to prawie na pewno przeoczenie.
    const { klient } = atrapaKlienta();
    const podejrzane = Object.keys(klient).filter((m) =>
      /^(create|update|upsert|set|delete|remove)/.test(m),
    );
    for (const nazwa of podejrzane) {
      expect(METODY_ZAPISUJACE as readonly string[]).toContain(nazwa);
    }
  });
});

describe("2. Tryb `pelny` — zachowanie 1:1 z produkcją", () => {
  it("zwraca TEN SAM obiekt, bez obwoluty", () => {
    const { klient } = atrapaKlienta();
    // Produkcja nie ma płacić ani jednego dodatkowego wywołania za mechanizm,
    // którego nie używa.
    expect(opakujKlientaTrybem(klient, "pelny")).toBe(klient);
  });

  it("wszystkie metody przechodzą", async () => {
    const { klient, wywolania } = atrapaKlienta();
    const opakowany = opakujKlientaTrybem(klient, "pelny");

    for (const nazwa of [...METODY_ODCZYTU, ...METODY_ZAPISUJACE]) {
      await wywolaj(opakowany, nazwa);
    }
    expect(wywolania).toHaveLength(METODY_ODCZYTU.length + METODY_ZAPISUJACE.length);
  });
});

describe("3. Tryb `wylaczony` — nic nie wychodzi do Selly", () => {
  it("KAŻDA metoda rzuca, także odczytowa", async () => {
    const { klient, wywolania } = atrapaKlienta();
    const opakowany = opakujKlientaTrybem(klient, "wylaczony");

    for (const nazwa of [...METODY_ODCZYTU, ...METODY_ZAPISUJACE]) {
      await expect(wywolaj(opakowany, nazwa)).rejects.toBeInstanceOf(BlokadaSelly);
    }
    // Dowód, że blokada działa PRZED wywołaniem, a nie po.
    expect(wywolania).toEqual([]);
  });

  it("komunikat niesie nazwę i wartość zmiennej", async () => {
    const { klient } = atrapaKlienta();
    const opakowany = opakujKlientaTrybem(klient, "wylaczony");

    await expect(wywolaj(opakowany, "ping")).rejects.toThrow(/SELLY_TRYB=wylaczony/);
    await expect(wywolaj(opakowany, "ping")).rejects.toThrow(/^\[Selly\]/);
  });
});

describe("4. Tryb `tylko-odczyt` — testy tak, zapisy nie", () => {
  it("wszystkie odczyty przechodzą", async () => {
    const { klient, wywolania } = atrapaKlienta();
    const opakowany = opakujKlientaTrybem(klient, "tylko-odczyt");

    for (const nazwa of METODY_ODCZYTU) {
      await wywolaj(opakowany, nazwa);
    }
    expect(wywolania).toEqual([...METODY_ODCZYTU]);
  });

  it("KAŻDY zapis rzuca i nie dociera do klienta", async () => {
    const { klient, wywolania } = atrapaKlienta();
    const opakowany = opakujKlientaTrybem(klient, "tylko-odczyt");

    for (const nazwa of METODY_ZAPISUJACE) {
      await expect(wywolaj(opakowany, nazwa)).rejects.toBeInstanceOf(BlokadaSelly);
    }
    expect(wywolania).toEqual([]);
  });

  it("komunikat mówi o ZAPISIE, nie o wyłączonej integracji", async () => {
    const { klient } = atrapaKlienta();
    const opakowany = opakujKlientaTrybem(klient, "tylko-odczyt");

    await expect(wywolaj(opakowany, "createProduct")).rejects.toThrow(
      /Zapis do Selly zablokowany/,
    );
    await expect(wywolaj(opakowany, "createProduct")).rejects.toThrow(
      /SELLY_TRYB=tylko-odczyt/,
    );
  });
});

describe("5. Błąd jest odróżnialny od braku konfiguracji", () => {
  it("niesie klasę i tryb, nie tylko tekst", async () => {
    const { klient } = atrapaKlienta();
    const opakowany = opakujKlientaTrybem(klient, "tylko-odczyt");

    // Brak sekretów i blokada środowiskowa to dwa różne stany i dwie różne naprawy
    // („uzupełnij sekrety" vs „to środowisko ma zakaz") — muszą być rozróżnialne w logu.
    await expect(wywolaj(opakowany, "createProduct")).rejects.toSatisfy(
      (e: unknown) => e instanceof BlokadaSelly && e.tryb === "tylko-odczyt",
    );
  });
});

describe("6. Obwoluta nie psuje niefunkcyjnych pól", () => {
  it("przepuszcza właściwości, które nie są metodami", () => {
    const klient = {
      ping: vi.fn(),
      wersja: "v3",
    } as unknown as KlientSelly;

    const opakowany = opakujKlientaTrybem(klient, "wylaczony") as unknown as {
      wersja: string;
    };
    expect(opakowany.wersja).toBe("v3");
  });
});
