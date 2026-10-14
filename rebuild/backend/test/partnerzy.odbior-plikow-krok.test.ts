/** Ticket 266: krok wdrożenia włączający odbiór zamówień z plików co 10 minut. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("włączenie odbioru plików (ticket 266)", () => {
  let tmp: string;
  let plikEnv: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bridge-266-"));
    plikEnv = join(tmp, ".env");
    writeFileSync(plikEnv, "JWT_SECRET=tajny\n");
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const krok = () => KROKI_WDROZENIA.find((k) => k.id === "2026-10-14-partnerzy-odbior-plikow-wlaczony")!;
  const uruchom = async (env: Record<string, string>) => {
    const { sqlite, db } = otworzBaze(":memory:");
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const w = await uruchomKroki(sqlite, db, [krok()], { PLIK_ENV: plikEnv, ...env } as NodeJS.ProcessEnv);
    sqlite.close();
    return w;
  };

  it("przy skonfigurowanych katalogach zamówień włącza odbiór co 10 minut; krok tylko produkcyjny", async () => {
    expect(krok().tylkoProdukcja).toBe(true);
    const w = await uruchom({ PARTNERZY_KATALOGI_ZAMOWIEN: "Adtyres=/x/orders" });
    expect(w.wykonane).toEqual([krok().id]);
    const env = readFileSync(plikEnv, "utf8");
    expect(env).toContain("JWT_SECRET=tajny\n");
    expect(env).toContain("PARTNERZY_ODBIOR_PLIKOW=true\n");
    expect(env).toContain("PARTNERZY_ODBIOR_PLIKOW_MINUTY=10\n");
  });

  it("bez mapowania katalogów zamówień krok jest pomijany i nic nie zmienia", async () => {
    const w = await uruchom({});
    expect(w.wykonane).toEqual([]);
    expect(readFileSync(plikEnv, "utf8")).toBe("JWT_SECRET=tajny\n");
  });
});
