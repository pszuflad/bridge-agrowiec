/**
 * Opis formularza edycji produktu — reguły, które da się sprawdzić bez renderowania.
 *
 * Najważniejszy test w tym pliku to `KLUCZE_PAYLOADU` kontra `POLA_EDYTOWALNE_PRODUKTU`
 * z backendu (sesja 12a). Te dwie listy muszą być identyczne: pole nadmiarowe po stronie
 * frontu backend po cichu odrzuci (Ania zobaczy „Zapisano zmiany" i nic się nie zapisze),
 * a pole brakujące oznacza kolumnę, której nikt już nie może ręcznie poprawić.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  flagaNaOpcje,
  KLUCZE_PAYLOADU,
  opcjaNaFlage,
  opcjeSlownika,
  parsujLiczbe,
  POLA_EDYCJI,
  PUSTA_OPCJA,
} from "@/pages/katalog/poleEdycji";

const korzenRepo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Lista pól edytowalnych czytana PROSTO ze źródła backendu.
 *
 * Front nie importuje kodu backendu (osobne buildy, osobne `tsconfig`), więc jedyny
 * sposób na powiązanie obu list bez ich duplikowania to odczyt pliku. Gdy 12d albo
 * późniejsza sesja doda lub odejmie pole po stronie backendu, ten test zapali się od razu.
 */
function polaEdytowalneBackendu(): string[] {
  const sciezka = resolve(korzenRepo, "rebuild/backend/src/repos/products.ts");
  const zrodlo = readFileSync(sciezka, "utf8");
  const start = zrodlo.indexOf("export const POLA_EDYTOWALNE_PRODUKTU = [");
  expect(start, "nie znaleziono POLA_EDYTOWALNE_PRODUKTU w repos/products.ts").toBeGreaterThan(-1);
  const koniec = zrodlo.indexOf("] as const", start);
  const blok = zrodlo.slice(start, koniec);
  return [...blok.matchAll(/^\s*"([a-zA-Z0-9]+)",/gm)].map((trafienie) => trafienie[1] as string);
}

describe("pola edycji — zgodność z backendem 12a", () => {
  it("wysyłane klucze są DOKŁADNIE listą pól edytowalnych backendu", () => {
    const backend = polaEdytowalneBackendu();

    expect(backend).toHaveLength(42);
    expect([...KLUCZE_PAYLOADU].sort()).toEqual([...backend].sort());
  });

  it("`dostawca` jest w formularzu, ale NIE w payloadzie (pole disabled)", () => {
    // Dialog produkcji renderuje dostawcę wyłącznie do odczytu (`:24048`). Zmiana
    // osierociłaby `manual_overrides`, które kluczują się po `supplierKod`.
    expect(POLA_EDYCJI.some((pole) => pole.klucz === "dostawca")).toBe(true);
    expect(KLUCZE_PAYLOADU).not.toContain("dostawca");
  });

  it("pole scalone „Bieznik/model” wnosi DWA klucze payloadu", () => {
    expect(KLUCZE_PAYLOADU).toContain("model");
    expect(KLUCZE_PAYLOADU).toContain("bieznik");
    // Jedna pozycja w siatce, dwa klucze na wyjściu — stąd 42 pola dają 42 klucze
    // mimo wypadnięcia `dostawcy`.
    expect(POLA_EDYCJI.filter((pole) => pole.kontrolka.typ === "scalone")).toHaveLength(1);
  });

  it("nie wystawia kolumn wyliczanych ani własnych odbudowy", () => {
    // Reguła stała z backlogu #14: kolumny liczone przez import i kolumny dołożone przez
    // odbudowę nigdy nie wchodzą na listę pól edytowalnych.
    for (const zakazane of ["id", "kod", "dataAktualizacji", "uwagaCena", "marzaPct", "magazyn"]) {
      expect(KLUCZE_PAYLOADU).not.toContain(zakazane);
    }
  });

  it("kolejność pól jest kolejnością oryginału, nie alfabetem", () => {
    const etykiety = POLA_EDYCJI.map((pole) => pole.etykieta);
    expect(etykiety.slice(0, 5)).toEqual([
      "Nazwa",
      "Producent",
      "Kategoria",
      "Dostawca",
      "Kod dostawcy",
    ]);
    // Etykiety są dosłownie z oryginału — bez polskich znaków. To nie literówki.
    expect(etykiety).toContain("Cena sprzedazy");
    expect(etykiety).toContain("Szerokosc");
    expect(etykiety).toContain("Opor toczenia");
  });

  it("siatka dzieli się na nagłówek i parametry techniczne", () => {
    expect(POLA_EDYCJI.filter((pole) => pole.sekcja === "naglowek")).toHaveLength(12);
    expect(POLA_EDYCJI.filter((pole) => pole.sekcja === "techniczne")).toHaveLength(30);
  });
});

describe("opcje selectów słownikowych — port pomocnika `p` (:23966)", () => {
  const wartosci = [
    { rodzaj: "marka", wartosc: "Michelin" },
    { rodzaj: "marka", wartosc: "Łaska Opona" },
    { rodzaj: "marka", wartosc: "Alliance" },
    { rodzaj: "marka", wartosc: "" },
    { rodzaj: "kategoria", wartosc: "Rolnicze" },
  ];

  it("filtruje po rodzaju i odsiewa puste wartości", () => {
    expect(opcjeSlownika(wartosci, "marka")).toEqual(["Alliance", "Łaska Opona", "Michelin"]);
    expect(opcjeSlownika(wartosci, "kategoria")).toEqual(["Rolnicze"]);
  });

  it("sortuje po polsku — „Ł” idzie po „L”, a nie na koniec alfabetu", () => {
    // Bez `localeCompare(…, "pl")` „Łaska Opona" wypadłaby ZA „Michelin”.
    const posortowane = opcjeSlownika(wartosci, "marka");
    expect(posortowane.indexOf("Łaska Opona")).toBeLessThan(posortowane.indexOf("Michelin"));
  });

  it("brak słownika daje pustą listę, a nie wyjątek", () => {
    expect(opcjeSlownika(undefined, "marka")).toEqual([]);
    expect(opcjeSlownika([], "marka")).toEqual([]);
  });

  it("rodzaje słownikowe indeksów są snake_case, a pola camelCase", () => {
    // Nie da się wyprowadzić jednego z drugiego — stąd jawny `rodzajSlownika` w opisie pola.
    const nosnosc = POLA_EDYCJI.find((pole) => pole.klucz === "indeksNosnosci");
    expect(nosnosc?.kontrolka).toMatchObject({ rodzajSlownika: "indeks_nosnosci" });
  });
});

describe("parser pól liczbowych — port :24070-24075", () => {
  it("pusty string daje null, nie zero", () => {
    expect(parsujLiczbe("")).toBeNull();
  });

  it("wartość nieparsowalna daje null, nie NaN", () => {
    expect(parsujLiczbe("abc")).toBeNull();
    expect(parsujLiczbe("abc", true)).toBeNull();
  });

  it("parseFloat kontra parseInt", () => {
    expect(parsujLiczbe("10.5")).toBe(10.5);
    expect(parsujLiczbe("10.5", true)).toBe(10);
  });

  it("`szerokosc` jest polem liczbowym — zastane zachowanie produkcji (D3)", () => {
    // Kanon trzyma tę kolumnę jako TEXT (migracja 003), więc ręczna edycja gubi zera
    // końcowe: „10.00" zapisze się jako 10. Port 1:1 z `:24076-24079`, świadomie.
    const szerokosc = POLA_EDYCJI.find((pole) => pole.klucz === "szerokosc");
    expect(szerokosc?.kontrolka).toMatchObject({ typ: "liczba", step: "0.01" });
    expect(parsujLiczbe("10.00")).toBe(10);
  });
});

describe("flagi tri-state — port :24000-24018", () => {
  it("true/false/nieznane mapują się na trzy opcje", () => {
    expect(flagaNaOpcje(true)).toBe("true");
    expect(flagaNaOpcje(false)).toBe("false");
    expect(flagaNaOpcje(null)).toBe(PUSTA_OPCJA);
    expect(flagaNaOpcje(undefined)).toBe(PUSTA_OPCJA);
    // Oryginał testuje TOŻSAMOŚĆ z `true`/`false`, więc 1 i 0 z bazy trafiają w „-".
    expect(flagaNaOpcje(1)).toBe(PUSTA_OPCJA);
  });

  it("wybór opcji wraca na wartość logiczną albo null", () => {
    expect(opcjaNaFlage("true")).toBe(true);
    expect(opcjaNaFlage("false")).toBe(false);
    expect(opcjaNaFlage(PUSTA_OPCJA)).toBeNull();
  });
});

describe("selecty stałe", () => {
  it("„-” w konstrukcji jest REALNĄ wartością, nie placeholderem", () => {
    const konstrukcja = POLA_EDYCJI.find((pole) => pole.klucz === "konstrukcja");
    expect(konstrukcja?.kontrolka).toMatchObject({ opcje: ["R", "D", "B", "-"] });
    // Placeholder to osobny sentinel — gdyby „-" nim było, opona diagonalna bez
    // oznaczenia nie dałaby się ustawić.
    expect(PUSTA_OPCJA).not.toBe("-");
  });

  it("status ma dokładnie dwie wartości oryginału", () => {
    const status = POLA_EDYCJI.find((pole) => pole.klucz === "status");
    expect(status?.kontrolka).toMatchObject({ opcje: ["aktywny", "wstrzymany"] });
  });
});
