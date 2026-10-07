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

  it("krok źródeł cenników: stare adresy → plik://, MO2/MO3 bez zmian, drugi bieg nic nie zmienia", async () => {
    const { mkdtempSync, mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { suppliers } = await import("../src/db/schema.js");
    const root = mkdtempSync(join(tmpdir(), "zrodla-"));
    for (const k of ["MO1_a", "MO2_b", "MO4_c", "MO9_d"]) mkdirSync(join(root, k));
    const { sqlite, db } = baza();
    try {
      const wiersz = (kod: string, url: string | null) =>
        ({ kod, nazwa: kod, formatPliku: "csv", sposobDostarczania: "url", url, status: "aktywny" }) as const;
      db.insert(suppliers)
        .values([
          wiersz("MO1", "https://agroopony.eu/imports/bohnenkamp.csv"),
          wiersz("MO2", "https://agroopony.eu/imports/jmk.csv"),
          wiersz("MO3", "https://sklep.kolarolnicze.pl/a.csv"),
          wiersz("MO4", "https://agroopony.eu/imports/acc_ftp3/x.csv"),
          wiersz("MO9", null),
        ])
        .run();
      const krok = KROKI_WDROZENIA.find((k) => k.id === "2026-10-07-zrodla-cennikow-foldery")!;
      await krok.uruchom({ db, sqlite, env: { IMPORTY_KATALOG: root } } as never);
      const url = (kod: string) =>
        (sqlite.prepare("SELECT url FROM suppliers WHERE kod=?").get(kod) as { url: string | null }).url;
      expect(url("MO1")).toBe(`plik://${join(root, "MO1_a")}`);
      expect(url("MO9")).toBe(`plik://${join(root, "MO9_d")}`);
      expect(url("MO4")).toBe(`plik://${join(root, "MO4_c")}`);
      expect(url("MO2")).toBe("https://agroopony.eu/imports/jmk.csv");
      expect(url("MO3")).toBe("https://sklep.kolarolnicze.pl/a.csv");
      expect(await krok.uruchom({ db, sqlite, env: { IMPORTY_KATALOG: root } } as never)).toBe("bez zmian");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("krok źródeł: stan produkcji po tickecie 194 — MO9 `imports/agrorami.csv` → folder, MO4/MO5 jawne pliki bez zmian", async () => {
    const { mkdtempSync, mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { suppliers } = await import("../src/db/schema.js");
    const base = mkdtempSync(join(tmpdir(), "zrodla194-"));
    const root = join(base, "selly-agroopony");
    mkdirSync(root);
    for (const k of ["MO4_c", "MO5_d", "MO9_e"]) mkdirSync(join(root, k));
    const { sqlite, db } = baza();
    try {
      const wiersz = (kod: string, url: string | null) =>
        ({ kod, nazwa: kod, formatPliku: "csv", sposobDostarczania: "url", url, status: "aktywny" }) as const;
      const mo4 = join(root, "MO4_c", "agrowiec_wr.csv");
      const mo5 = join(root, "MO5_d", "agrowiec_mw.csv");
      db.insert(suppliers)
        .values([wiersz("MO4", mo4), wiersz("MO5", mo5), wiersz("MO9", join(base, "agrorami.csv"))])
        .run();
      const krok = KROKI_WDROZENIA.find((k) => k.id === "2026-10-07-zrodla-cennikow-foldery")!;
      await krok.uruchom({ db, sqlite, env: { IMPORTY_KATALOG: root } } as never);
      const url = (kod: string) =>
        (sqlite.prepare("SELECT url FROM suppliers WHERE kod=?").get(kod) as { url: string | null }).url;
      expect(url("MO9")).toBe(`plik://${join(root, "MO9_e")}`);
      expect(url("MO4")).toBe(mo4);
      expect(url("MO5")).toBe(mo5); // `agrowiec_suma.csv` nie wygrywa „najnowszego pliku”
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("krok źródeł: brak katalogu/folderu → ODŁOŻONY, nie zapisany jako wykonany", async () => {
    const { suppliers } = await import("../src/db/schema.js");
    const { sqlite, db } = baza();
    db.insert(suppliers)
      .values([{ kod: "MO1", nazwa: "MO1", formatPliku: "csv", sposobDostarczania: "url", url: null, status: "aktywny" }])
      .run();
    const krok = KROKI_WDROZENIA.find((k) => k.id === "2026-10-07-zrodla-cennikow-foldery")!;
    const w = await uruchomKroki(sqlite, db, [krok], { IMPORTY_KATALOG: "/nie/ma/takiego" });
    expect(w.wykonane).toEqual([]);
    expect(w.odlozone).toHaveLength(1);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM kroki_wdrozenia").get()).toEqual({ n: 0 });
  });
});
