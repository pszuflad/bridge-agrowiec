/** Ticket 261: krok wdrożenia włączający „Utwórz w Selly” (PARTNERZY_SELLY_ZAMOWIENIA=true w .env produkcji). */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("włączenie flagi „Utwórz w Selly” (ticket 261)", () => {
  let tmp: string;
  let plikEnv: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bridge-261-"));
    plikEnv = join(tmp, ".env");
    writeFileSync(plikEnv, "JWT_SECRET=tajny\nSELLY_TRYB=pelny\n");
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const krok = () => KROKI_WDROZENIA.find((k) => k.id === "2026-10-14-partnerzy-selly-zamowienia-wlaczone")!;
  const uruchom = async (env: Record<string, string>) => {
    const { sqlite, db } = otworzBaze(":memory:");
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const w = await uruchomKroki(sqlite, db, [krok()], { PLIK_ENV: plikEnv, ...env } as NodeJS.ProcessEnv);
    const wynik = (sqlite.prepare("SELECT wynik FROM kroki_wdrozenia WHERE id = ?").get(krok().id) as { wynik: string } | undefined)?.wynik ?? "";
    sqlite.close();
    return { ...w, wynik };
  };

  it("dopisuje flagę, nie rusza innych linii, jest idempotentne; to krok tylko produkcyjny", async () => {
    expect(krok().tylkoProdukcja).toBe(true);
    const w = await uruchom({ SELLY_TRYB: "pelny" });
    expect(w.wykonane).toEqual([krok().id]);
    expect(readFileSync(plikEnv, "utf8")).toBe("JWT_SECRET=tajny\nSELLY_TRYB=pelny\nPARTNERZY_SELLY_ZAMOWIENIA=true\n");
    expect(w.wynik).toContain("PARTNERZY_SELLY_ZAMOWIENIA=true (dopisano)");
    expect(w.wynik).not.toContain("UWAGA");
    // kolejny bieg na świeżej bazie (jak po odtworzeniu bazy) niczego nie dubluje w .env
    await uruchom({ SELLY_TRYB: "pelny" });
    expect(readFileSync(plikEnv, "utf8")).toBe("JWT_SECRET=tajny\nSELLY_TRYB=pelny\nPARTNERZY_SELLY_ZAMOWIENIA=true\n");
  });

  it("przy SELLY_TRYB innym niż pelny ostrzega w wyniku (flaga nic nie zrobi)", async () => {
    const w = await uruchom({ SELLY_TRYB: "odczyt" });
    expect(w.wynik).toContain("UWAGA: SELLY_TRYB=odczyt");
  });

  it("bez pliku .env krok jest odkładany, nie wywala wdrożenia", async () => {
    rmSync(plikEnv);
    const w = await uruchom({ SELLY_TRYB: "pelny" });
    expect(w.wykonane).toEqual([]);
    expect(w.odlozone).toHaveLength(1);
  });
});
