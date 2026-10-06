import { describe, expect, it } from "vitest";
import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki, type Krok } from "../src/kroki/runner.js";
import { pobierzUzytkownikaPoEmailu } from "../src/repos/users.js";

function baza() {
  const b = otworzBaze(":memory:");
  zastosujMigracje(b.sqlite);
  return b;
}

describe("kroki wdrożenia", () => {
  it("wykonuje krok raz, zapisuje go i przy kolejnym wdrożeniu pomija", async () => {
    const { sqlite, db } = baza();
    let ile = 0;
    const kroki: Krok[] = [
      { id: "a", opis: "a", uruchom: async () => `bieg ${++ile}` },
    ];

    const pierwszy = await uruchomKroki(sqlite, db, kroki, {});
    const drugi = await uruchomKroki(sqlite, db, kroki, {});

    expect(pierwszy.wykonane).toEqual(["a"]);
    expect(drugi).toMatchObject({ wykonane: [], juzWykonane: ["a"] });
    expect(ile).toBe(1);
    expect(
      sqlite.prepare("SELECT wynik FROM kroki_wdrozenia WHERE id='a'").get(),
    ).toEqual({ wynik: "bieg 1" });
  });

  it("brak wymaganego env pomija krok bez zapisu — wykona się po dopisaniu sekretu", async () => {
    const { sqlite, db } = baza();
    let ile = 0;
    const kroki: Krok[] = [
      {
        id: "b",
        opis: "b",
        wymagaEnv: ["SEKRET"],
        uruchom: async () => void ile++,
      },
    ];

    const bez = await uruchomKroki(sqlite, db, kroki, {});
    expect(bez.pominieteBrakEnv).toEqual([{ id: "b", brakuje: ["SEKRET"] }]);
    expect(ile).toBe(0);

    await uruchomKroki(sqlite, db, kroki, { SEKRET: "x" });
    expect(ile).toBe(1);
  });

  it("wyjątek przerywa bieg i nie zapisuje kroku (następne wdrożenie spróbuje znowu)", async () => {
    const { sqlite, db } = baza();
    const kroki: Krok[] = [
      {
        id: "c",
        opis: "c",
        uruchom: async () => {
          throw new Error("boom");
        },
      },
      { id: "d", opis: "d", uruchom: async () => {} },
    ];

    await expect(uruchomKroki(sqlite, db, kroki, {})).rejects.toThrow("boom");
    expect(
      sqlite.prepare("SELECT COUNT(*) AS n FROM kroki_wdrozenia").get(),
    ).toEqual({ n: 0 });
  });

  it("odrzuca powtórzone id", async () => {
    const { sqlite, db } = baza();
    const k: Krok = { id: "x", opis: "x", uruchom: async () => {} };
    await expect(uruchomKroki(sqlite, db, [k, k], {})).rejects.toThrow(
      "Powtórzony id",
    );
  });

  it("rejestr: id są unikalne, a krok kont zakłada konta tylko z HASLO_TYMCZASOWE i niczego nie nadpisuje", async () => {
    expect(new Set(KROKI_WDROZENIA.map((k) => k.id)).size).toBe(
      KROKI_WDROZENIA.length,
    );

    const { sqlite, db } = baza();
    await uruchomKroki(sqlite, db, KROKI_WDROZENIA, {});
    expect(
      pobierzUzytkownikaPoEmailu(db, "erwin.wojtysiak@agrowiec.eu"),
    ).toBeUndefined();

    await uruchomKroki(sqlite, db, KROKI_WDROZENIA, {
      HASLO_TYMCZASOWE: "Tymczasowe2026!",
    });
    expect(
      pobierzUzytkownikaPoEmailu(db, "erwin.wojtysiak@agrowiec.eu")
        ?.imieNazwisko,
    ).toBe("Erwin Wojtysiak");
    expect(
      pobierzUzytkownikaPoEmailu(db, "anna.naumowicz4@gmail.com")?.imieNazwisko,
    ).toBe("Anna Naumowicz");
  });
});
