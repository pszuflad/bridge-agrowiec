/** Ticket 257: krok wdrożenia wpisujący PARTNERZY_KATALOGI_TRACKINGU do .env produkcji (wyprowadzone z katalogów zamówień, bez ścieżek w repo). */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { zastosujMigracje } from "../src/db/migrate.js";
import { otworzBaze } from "../src/db/index.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { wyprowadzKatalogiTrackingu } from "../src/partnerzy/katalogi-trackingu.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("wyprowadzKatalogiTrackingu", () => {
  const wszystkie = () => true;
  it("Adtyres: …/orders → …/trackings; TyreWorld: katalog zamówień + /tracking; nazwy partnerów bez rozróżniania wielkości liter", () => {
    const w = wyprowadzKatalogiTrackingu("adtyres=/srv/a/customer/orders/;TYREWORLD=/srv/t/imports/tw", wszystkie);
    expect(w.wartosc).toBe("Adtyres=/srv/a/customer/trackings;TyreWorld=/srv/t/imports/tw/tracking");
    expect(w.pominiete).toEqual([]);
  });
  it("pomija partnera bez wpisu, z nietypowym układem albo z nieistniejącym katalogiem trackingu — z powodem bez ścieżek", () => {
    const w = wyprowadzKatalogiTrackingu("Adtyres=/srv/a/inny-uklad", wszystkie);
    expect(w.wartosc).toBeNull();
    expect(w.pominiete).toEqual(["Adtyres: katalog zamówień ma nietypowy układ — nie da się wyprowadzić katalogu trackingu", "TyreWorld: brak wpisu w PARTNERZY_KATALOGI_ZAMOWIEN"]);
    const brak = wyprowadzKatalogiTrackingu("Adtyres=/srv/a/customer/orders;TyreWorld=/srv/t", (s) => s.endsWith("/tracking"));
    expect(brak.wartosc).toBe("TyreWorld=/srv/t/tracking");
    expect(brak.pominiete).toEqual(["Adtyres: katalog trackingu nie istnieje na serwerze"]);
  });
  it("brak zmiennej → nic do wpisania; niepoprawna wartość rzuca błąd", () => {
    expect(wyprowadzKatalogiTrackingu(undefined, wszystkie).wartosc).toBeNull();
    expect(() => wyprowadzKatalogiTrackingu("Adtyres=wzgledna/sciezka", wszystkie)).toThrow(/PARTNERZY_KATALOGI_ZAMOWIEN/);
  });
});

describe("krok wdrożenia 2026-10-13-partnerzy-katalogi-trackingu", () => {
  let tmp: string;
  let plikEnv: string;
  let ad: string;
  let tw: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bridge-257-"));
    ad = join(tmp, "a", "customer");
    tw = join(tmp, "t", "imports", "tw");
    mkdirSync(join(ad, "orders"), { recursive: true });
    mkdirSync(join(ad, "trackings"), { recursive: true });
    mkdirSync(join(tw, "tracking"), { recursive: true });
    plikEnv = join(tmp, ".env");
    writeFileSync(plikEnv, 'JWT_SECRET=tajny\nPARTNERZY_KATALOGI_ZAMOWIEN="x"\n');
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const krok = () => KROKI_WDROZENIA.find((k) => k.id === "2026-10-13-partnerzy-katalogi-trackingu")!;
  const uruchom = async (env: Record<string, string>) => {
    const { sqlite, db } = otworzBaze(":memory:");
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const w = await uruchomKroki(sqlite, db, [krok()], { PLIK_ENV: plikEnv, ...env } as NodeJS.ProcessEnv);
    const zapisany = (sqlite.prepare("SELECT wynik FROM kroki_wdrozenia WHERE id = ?").get(krok().id) as { wynik: string } | undefined)?.wynik ?? "";
    sqlite.close();
    return { ...w, zapisany };
  };

  it("dopisuje PARTNERZY_KATALOGI_TRACKINGU w cudzysłowie, nie rusza innych linii, a wynik w logu nie zawiera ścieżek", async () => {
    const w = await uruchom({ PARTNERZY_KATALOGI_ZAMOWIEN: `Adtyres=${join(ad, "orders")};TyreWorld=${tw}` });
    expect(w.wykonane).toEqual([krok().id]);
    const env = readFileSync(plikEnv, "utf8");
    expect(env).toContain('JWT_SECRET=tajny\n');
    expect(env).toContain(`PARTNERZY_KATALOGI_TRACKINGU="Adtyres=${join(ad, "trackings")};TyreWorld=${join(tw, "tracking")}"`);
    expect(w.zapisany).not.toContain(tmp); // wynik trafia do publicznego logu wdrożenia — bez ścieżek serwera plików
    expect(w.zapisany).toContain("(dopisano) dla: Adtyres, TyreWorld");
  });

  it("nie nadpisuje wartości ustawionej ręcznie", async () => {
    await uruchom({ PARTNERZY_KATALOGI_TRACKINGU: "Adtyres=/reczny", PARTNERZY_KATALOGI_ZAMOWIEN: `Adtyres=${join(ad, "orders")}` });
    expect(readFileSync(plikEnv, "utf8")).not.toContain("PARTNERZY_KATALOGI_TRACKINGU");
  });

  it("brak PARTNERZY_KATALOGI_ZAMOWIEN albo brak istniejących katalogów trackingu → krok odłożony (nie zapisany, .env bez zmian)", async () => {
    const przed = readFileSync(plikEnv, "utf8");
    const bez = await uruchom({});
    expect(bez.wykonane).toEqual([]);
    expect(bez.odlozone?.length ?? 0).toBeGreaterThan(0);
    rmSync(join(ad, "trackings"), { recursive: true });
    rmSync(join(tw, "tracking"), { recursive: true });
    const brakKatalogow = await uruchom({ PARTNERZY_KATALOGI_ZAMOWIEN: `Adtyres=${join(ad, "orders")};TyreWorld=${tw}` });
    expect(brakKatalogow.wykonane).toEqual([]);
    expect(readFileSync(plikEnv, "utf8")).toBe(przed);
  });

  it("środowisko testowe pomija krok (nie pisze do katalogów partnerów)", async () => {
    const w = await uruchom({ KROKI_SRODOWISKO: "testowe", PARTNERZY_KATALOGI_ZAMOWIEN: `Adtyres=${join(ad, "orders")}` });
    expect(w.wykonane).toEqual([]);
    expect(readFileSync(plikEnv, "utf8")).not.toContain("PARTNERZY_KATALOGI_TRACKINGU");
  });
});
