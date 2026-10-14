/** Ticket 271: krok wdrożenia włączający harmonogram cenników partnerów. */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { partnerzy } from "../src/db/schema.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("włączenie publikacji cenników (ticket 271)", () => {
  let tmp: string;
  let plikEnv: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bridge-271-"));
    plikEnv = join(tmp, ".env");
    writeFileSync(plikEnv, "JWT_SECRET=tajny\n");
    mkdirSync(join(tmp, "adtyres"));
    mkdirSync(join(tmp, "tyreworld"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const krok = () => KROKI_WDROZENIA.find((k) => k.id === "2026-10-14-partnerzy-publikacja-wlaczona")!;
  const uruchom = async (env: Record<string, string>, harmonogram: { adtyres: number | null; tyreworld: number | null } = { adtyres: null, tyreworld: null }) => {
    const { sqlite, db } = otworzBaze(":memory:");
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    for (const [nazwa, min] of [["Adtyres", harmonogram.adtyres], ["TyreWorld", harmonogram.tyreworld]] as const) {
      db.insert(partnerzy).values({ nazwa, aktywny: true, harmonogramMinuty: min, utworzono: "x", zmieniono: "x" }).run();
    }
    const w = await uruchomKroki(sqlite, db, [krok()], { PLIK_ENV: plikEnv, ...env } as NodeJS.ProcessEnv);
    const minuty = Object.fromEntries(db.select().from(partnerzy).all().map((p) => [p.nazwa, p.harmonogramMinuty]));
    sqlite.close();
    return { w, minuty };
  };
  const publikacja = () => `Adtyres=${join(tmp, "adtyres")};TyreWorld=${join(tmp, "tyreworld")}`;

  it("włącza harmonogram, ustawia 60 min tylko partnerom bez harmonogramu; krok tylko produkcyjny", async () => {
    expect(krok().tylkoProdukcja).toBe(true);
    const { w, minuty } = await uruchom({ PARTNERZY_KATALOGI_PUBLIKACJI: publikacja() }, { adtyres: 30, tyreworld: null });
    expect(w.wykonane).toEqual([krok().id]);
    expect(readFileSync(plikEnv, "utf8")).toContain("PARTNERZY_SCHEDULER=true\n");
    expect(minuty).toEqual({ Adtyres: 30, TyreWorld: 60 });
  });

  it("odkłada krok, gdy katalog publikacji nie istnieje; bez mapowania jest pomijany", async () => {
    const zly = await uruchom({ PARTNERZY_KATALOGI_PUBLIKACJI: `Adtyres=${join(tmp, "nie-ma")}` });
    expect(zly.w.wykonane).toEqual([]);
    expect(readFileSync(plikEnv, "utf8")).toBe("JWT_SECRET=tajny\n");
    const brak = await uruchom({});
    expect(brak.w.wykonane).toEqual([]);
  });
});
