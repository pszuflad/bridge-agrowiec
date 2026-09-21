/**
 * ZWIJANIE POWTÓREK — logika, Iteracja 6.
 *
 * To jest test wymagany przez GATE ticketa: „widok ZWIJA powtórki (test na danych
 * z powtórkami)". Nagrany fixture `GET_alerts.json` ma pięć wierszy i ANI JEDNEJ
 * powtórki (pięciu różnych dostawców, ten sam typ i status), więc rozkład danych
 * odtwarzamy tutaj — z realnych liczb zmierzonych w `db/snapshot.db`: 339 alertów
 * „Błąd pobierania" przy 23 na dobę dla samego MO3.
 *
 * Kształt wiersza bierzemy z fixture'a, żeby test stał na tym, co produkcja realnie
 * zwraca, a nie na moim wyobrażeniu o nim.
 */
import { describe, expect, it } from "vitest";

import type { Alert } from "@/pages/alerty/api";
import {
  FILTR_NIEROZWIAZANE,
  FILTRY_POCZATKOWE,
  filtrujAlerty,
  pogrupujAlerty,
  sformatujOstatnia,
  wartosciFiltrow,
} from "@/pages/alerty/grupowanie";
import { akcjeStatusu, etykietaStatusu } from "@/pages/alerty/statusy";
import { alertyZFixtura } from "./msw/kontrakt";

const WZORCOWY = alertyZFixtura()[0]!;

/** Budowanie wiersza na kształcie z fixture'a — pola nadpisujemy tylko tam, gdzie trzeba. */
function alert(nadpisania: Partial<Alert> & { id: number }): Alert {
  return { ...WZORCOWY, ...nadpisania };
}

/**
 * Realistyczny zbiór z powtórkami: 23 nieudane pobrania MO3 w ciągu doby (rekord
 * z produkcji, 2026-08-08…10), 4 dla MO5 oraz jedna udana synchronizacja MO9.
 */
function zPowtorkami(): Alert[] {
  const bledy = (kod: string, ile: number, odGodziny: number, idOd: number) =>
    Array.from({ length: ile }, (_, i) =>
      alert({
        id: idOd + i,
        poziom: "ostrzezenie",
        typ: "Błąd pobierania",
        status: "nowy",
        dostawca: kod,
        opis: `${kod}: fetch failed`,
        data: `2026-08-09T${String(odGodziny + i).padStart(2, "0")}:15:00.000Z`,
      }),
    );

  return [
    ...bledy("MO3", 23, 0, 1000),
    ...bledy("MO5", 4, 5, 2000),
    alert({
      id: 3000,
      poziom: "info",
      typ: "Synchronizacja",
      status: "rozwiazany",
      dostawca: "MO9",
      data: "2026-08-09T15:45:00.000Z",
    }),
  ];
}

describe("1. Zwijanie powtórek", () => {
  it("28 alertów zwija się do 3 grup — lista nie jest surowa", () => {
    const alerty = zPowtorkami();
    expect(alerty).toHaveLength(28);

    const grupy = pogrupujAlerty(alerty);

    expect(grupy).toHaveLength(3);
    expect(grupy.reduce((suma, g) => suma + g.liczba, 0)).toBe(alerty.length);
  });

  it("grupa niesie licznik powtórzeń i znacznik OSTATNIEGO wystąpienia", () => {
    const grupy = pogrupujAlerty(zPowtorkami());
    const mo3 = grupy.find((g) => g.dostawca === "MO3" && g.typ === "Błąd pobierania")!;

    expect(mo3.liczba).toBe(23);
    // 23 wpisy co godzinę od 00:15 → najnowszy jest o 22:15, nie o 00:15.
    expect(mo3.ostatnia).toBe("2026-08-09T22:15:00.000Z");
    expect(mo3.wpisy).toHaveLength(23);
  });

  it("wpisy w grupie idą `data` MALEJĄCO, niezależnie od kolejności wejścia", () => {
    // Wejście celowo rosnąco — backend daje malejąco, ale nie opieramy się na tym ślepo.
    const grupy = pogrupujAlerty(zPowtorkami());
    for (const grupa of grupy) {
      const znaczniki = grupa.wpisy.map((w) => w.data);
      expect([...znaczniki].sort().reverse()).toEqual(znaczniki);
    }
  });

  it("grupy są posortowane po ostatnim wystąpieniu MALEJĄCO — najświeższy problem na górze", () => {
    const grupy = pogrupujAlerty(zPowtorkami());
    const ostatnie = grupy.map((g) => g.ostatnia);
    expect([...ostatnie].sort().reverse()).toEqual(ostatnie);
    // MO3 psuje się do 22:15, MO9 zsynchronizował się o 15:45, MO5 skończył o 08:15.
    expect(grupy.map((g) => `${String(g.dostawca)}/${g.typ}`)).toEqual([
      "MO3/Błąd pobierania",
      "MO9/Synchronizacja",
      "MO5/Błąd pobierania",
    ]);
  });

  /**
   * `status` jest CZĘŚCIĄ klucza: zamknięcie połowy powtórek musi być widać jako osobny
   * wiersz, inaczej praca Ani znika z ekranu bez śladu.
   */
  it("ten sam (dostawca, typ) w każdym z trzech statusów to osobna grupa", () => {
    const grupy = pogrupujAlerty([
      alert({ id: 1, dostawca: "MO3", typ: "Błąd pobierania", status: "nowy" }),
      alert({ id: 2, dostawca: "MO3", typ: "Błąd pobierania", status: "przejrzany" }),
      alert({ id: 3, dostawca: "MO3", typ: "Błąd pobierania", status: "rozwiazany" }),
      alert({ id: 4, dostawca: "MO3", typ: "Błąd pobierania", status: "przejrzany" }),
    ]);

    expect(grupy).toHaveLength(3);
    expect(grupy.map((g) => g.status).sort()).toEqual(["nowy", "przejrzany", "rozwiazany"]);
    expect(grupy.find((g) => g.status === "przejrzany")!.liczba).toBe(2);
  });

  it("różni dostawcy przy tym samym typie nie wpadają do jednej grupy", () => {
    const grupy = pogrupujAlerty([
      alert({ id: 1, dostawca: "MO3", typ: "Błąd pobierania", status: "nowy" }),
      alert({ id: 2, dostawca: "MO5", typ: "Błąd pobierania", status: "nowy" }),
    ]);
    expect(grupy).toHaveLength(2);
  });

  /** `alerts.dostawca` jest NULLABLE — alert spoza importu nie może wywalić grupowania. */
  it("alert bez dostawcy dostaje własną grupę i nie miesza się z innymi", () => {
    const grupy = pogrupujAlerty([
      alert({ id: 1, dostawca: null, typ: "Błąd HTTP", status: "nowy" }),
      alert({ id: 2, dostawca: null, typ: "Błąd HTTP", status: "nowy" }),
      alert({ id: 3, dostawca: "MO3", typ: "Błąd HTTP", status: "nowy" }),
    ]);

    expect(grupy).toHaveLength(2);
    expect(grupy.find((g) => g.dostawca === null)!.liczba).toBe(2);
  });

  /**
   * „Błąd pobierania" obejmuje TAKŻE błędy parsera (jeden `catch` w oryginale,
   * `backend-index.cjs:48100`, backlog #16). Grupa zbiorczo pokaże jedną liczbę dla dwóch
   * przyczyn — i to jest zamierzone; rozróżnienie żyje w `opis` pojedynczych wpisów,
   * czyli po rozwinięciu. Test pilnuje, żeby `opis` nie zniknął przy zwijaniu.
   */
  it("zwinięta grupa zachowuje `opis` każdego wpisu — dwie przyczyny w jednym typie", () => {
    const grupy = pogrupujAlerty([
      alert({ id: 1, typ: "Błąd pobierania", status: "nowy", dostawca: "MO3", opis: "MO3: fetch failed" }),
      alert({
        id: 2,
        typ: "Błąd pobierania",
        status: "nowy",
        dostawca: "MO3",
        opis: "MO3: parser XLSX — brak kolumny 'cena'",
      }),
    ]);

    expect(grupy).toHaveLength(1);
    expect(grupy[0]!.wpisy.map((w) => w.opis)).toEqual(
      expect.arrayContaining(["MO3: fetch failed", "MO3: parser XLSX — brak kolumny 'cena'"]),
    );
  });

  it("pusta lista daje zero grup, nie wywala się", () => {
    expect(pogrupujAlerty([])).toEqual([]);
  });
});

describe("2. Filtry", () => {
  /**
   * Decyzja D1 (`72-FEATURE-alerty-przejrzany-szukajka`): domyślnie NIEROZWIĄZANE. Gdyby
   * `przejrzany` był schowany, „Oznacz jako przejrzany" działałoby jak „Rozwiąż".
   */
  it("domyślny filtr pokazuje nierozwiązane — `nowy` i `przejrzany`, bez `rozwiazany`", () => {
    expect(FILTRY_POCZATKOWE.status).toBe(FILTR_NIEROZWIAZANE);

    const alerty = [
      ...zPowtorkami(),
      alert({ id: 4000, status: "przejrzany", dostawca: "MO3", typ: "Błąd pobierania" }),
    ];
    const widoczne = filtrujAlerty(alerty, FILTRY_POCZATKOWE);

    expect(widoczne).toHaveLength(28);
    expect(new Set(widoczne.map((a) => a.status))).toEqual(new Set(["nowy", "przejrzany"]));
  });

  /** Kolumna bez `CHECK` — nieznany status nie może zniknąć z listy roboczej. */
  it("status spoza znanych trzech liczy się jako nierozwiązany", () => {
    const widoczne = filtrujAlerty([alert({ id: 1, status: "dziwny" })], FILTRY_POCZATKOWE);
    expect(widoczne).toHaveLength(1);
  });

  it("filtry łączą się operatorem AND", () => {
    const widoczne = filtrujAlerty(zPowtorkami(), {
      status: "nowy",
      dostawca: "MO5",
      typ: "Błąd pobierania",
      fraza: "",
    });
    expect(widoczne).toHaveLength(4);
  });

  it("`null` w filtrze i pusta fraza nie zawężają niczego", () => {
    const alerty = zPowtorkami();
    expect(
      filtrujAlerty(alerty, { status: null, dostawca: null, typ: null, fraza: "  " }),
    ).toHaveLength(alerty.length);
  });

  it("wartości filtrów są wyliczane z danych, a nie zaszyte na sztywno", () => {
    const wartosci = wartosciFiltrow(zPowtorkami());

    expect(wartosci.statusy).toEqual(["nowy", "rozwiazany"]);
    expect(wartosci.dostawcy).toEqual(["MO3", "MO5", "MO9"]);
    expect(wartosci.typy).toEqual(["Błąd pobierania", "Synchronizacja"]);
  });

  it("dostawca `null` nie trafia na listę filtra — nie ma czym go nazwać", () => {
    const wartosci = wartosciFiltrow([
      alert({ id: 1, dostawca: null }),
      alert({ id: 2, dostawca: "MO3" }),
    ]);
    expect(wartosci.dostawcy).toEqual(["MO3"]);
  });

  it("nowy typ alertu z importu pojawia się w filtrze sam, bez zmiany kodu", () => {
    const wartosci = wartosciFiltrow([alert({ id: 1, typ: "Zupełnie nowy typ" })]);
    expect(wartosci.typy).toContain("Zupełnie nowy typ");
  });
});

describe("2a. Wyszukiwarka po treści (backlog #90)", () => {
  const BEZ_FILTROW = { status: null, dostawca: null, typ: null, fraza: "" };

  /** Dwie przyczyny w jednym typie „Błąd pobierania" (backlog #16) — po to jest wyszukiwarka. */
  function dwiePrzyczyny(): Alert[] {
    return [
      alert({ id: 1, dostawca: "MO3", typ: "Błąd pobierania", status: "nowy", opis: "MO3: fetch failed" }),
      alert({ id: 2, dostawca: "MO3", typ: "Błąd pobierania", status: "nowy", opis: "MO3: fetch failed" }),
      alert({
        id: 3,
        dostawca: "MO3",
        typ: "Błąd pobierania",
        status: "nowy",
        opis: "MO3: Parser XLSX — brak kolumny 'cena'",
      }),
      alert({ id: 4, dostawca: "MO5", typ: "Błąd HTTP", status: "nowy", opis: "MO5: HTTP 503" }),
    ];
  }

  it("zawęża po `opis` bez rozróżniania wielkości liter", () => {
    const widoczne = filtrujAlerty(dwiePrzyczyny(), { ...BEZ_FILTROW, fraza: "parser" });
    expect(widoczne.map((a) => a.id)).toEqual([3]);
  });

  it("każde słowo frazy musi wystąpić w treści (AND po słowach, nie po całej frazie)", () => {
    const alerty = dwiePrzyczyny();
    expect(filtrujAlerty(alerty, { ...BEZ_FILTROW, fraza: "xlsx cena" })).toHaveLength(1);
    expect(filtrujAlerty(alerty, { ...BEZ_FILTROW, fraza: "xlsx 503" })).toHaveLength(0);
  });

  it("polskie znaki porównują się poprawnie także przy wielkich literach", () => {
    const alerty = [alert({ id: 1, opis: "MO4: BŁĄD połączenia" })];
    expect(filtrujAlerty(alerty, { ...BEZ_FILTROW, fraza: "błąd" })).toHaveLength(1);
  });

  /** Decyzja D4: dostawca i typ mają własne filtry — fraza ich nie przeszukuje. */
  it("przeszukuje wyłącznie treść — nie dostawcę i nie typ", () => {
    const alerty = [alert({ id: 1, dostawca: "MO3", typ: "Błąd pobierania", opis: "fetch failed" })];
    expect(filtrujAlerty(alerty, { ...BEZ_FILTROW, fraza: "MO3" })).toHaveLength(0);
    expect(filtrujAlerty(alerty, { ...BEZ_FILTROW, fraza: "pobierania" })).toHaveLength(0);
  });

  it("łączy się z pozostałymi filtrami operatorem AND", () => {
    const widoczne = filtrujAlerty(dwiePrzyczyny(), {
      status: "nowy",
      dostawca: "MO5",
      typ: null,
      fraza: "fetch",
    });
    expect(widoczne).toHaveLength(0);
  });

  /**
   * Decyzja D3: trafienie filtruje WPISY, grupa składa się z samych trafień. Licznik „N×"
   * mówi, ile wpisów pasuje, a akcja na grupie obejmuje tylko je — błędy parsera da się
   * zamknąć, nie ruszając awarii sieci z tej samej grupy.
   */
  it("grupa zostaje przy jednym trafieniu, a jej licznik liczy tylko trafienia", () => {
    const grupy = pogrupujAlerty(
      filtrujAlerty(dwiePrzyczyny(), { ...BEZ_FILTROW, fraza: "parser" }),
    );

    expect(grupy).toHaveLength(1);
    expect(grupy[0]!.klucz).toBe("MO3|Błąd pobierania|nowy");
    expect(grupy[0]!.liczba).toBe(1);
    expect(grupy[0]!.wpisy.map((w) => w.id)).toEqual([3]);
  });
});

describe("2b. Statusy i akcje (wspólne z P6.2)", () => {
  const cele = (status: string) => akcjeStatusu(status).map((a) => `${a.cel}:${a.etykieta}`);

  it("`nowy` → „Oznacz jako przejrzany” i „Rozwiąż”", () => {
    expect(cele("nowy")).toEqual(["przejrzany:Oznacz jako przejrzany", "rozwiazany:Rozwiąż"]);
  });

  it("`przejrzany` → „Rozwiąż” i „Otwórz ponownie”", () => {
    expect(cele("przejrzany")).toEqual(["rozwiazany:Rozwiąż", "nowy:Otwórz ponownie"]);
  });

  it("`rozwiazany` → tylko „Otwórz ponownie”", () => {
    expect(cele("rozwiazany")).toEqual(["nowy:Otwórz ponownie"]);
  });

  it("status nieznany da się i rozwiązać, i otworzyć ponownie", () => {
    expect(cele("dziwny")).toEqual(["rozwiazany:Rozwiąż", "nowy:Otwórz ponownie"]);
  });

  it("etykiety filtra jak w oryginale; nieznany status pod surową nazwą", () => {
    expect(["nowy", "przejrzany", "rozwiazany", "dziwny"].map(etykietaStatusu)).toEqual([
      "Nowy",
      "Przejrzany",
      "Rozwiązany",
      "dziwny",
    ]);
  });
});

describe("3. Znacznik „ostatnio”", () => {
  it("dzisiejszy alert pokazuje samą godzinę", () => {
    const teraz = new Date("2026-08-09T20:00:00.000Z");
    const kiedy = new Date("2026-08-09T14:45:00.000Z");

    const wynik = sformatujOstatnia(kiedy.toISOString(), teraz);

    expect(wynik).toMatch(/^\d{2}:\d{2}$/);
  });

  /** Alert sprzed tygodnia z samą godziną wyglądałby jak świeży — a to cała treść ekranu. */
  it("wczorajszy alert pokazuje PEŁNĄ datę, nie samą godzinę", () => {
    const teraz = new Date("2026-08-09T20:00:00.000Z");
    const wynik = sformatujOstatnia("2026-08-08T14:45:00.000Z", teraz);

    expect(wynik).not.toMatch(/^\d{2}:\d{2}$/);
    expect(wynik).toContain("08");
  });

  it("nieparsowalny znacznik jest oddawany bez zmian, zamiast dawać „Invalid Date”", () => {
    expect(sformatujOstatnia("to nie jest data")).toBe("to nie jest data");
  });
});
