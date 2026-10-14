/** Ticket 263: krok wdrożenia z ustawieniami SMTP (bez hasła i bez odbiorców). */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KROKI_WDROZENIA } from "../src/kroki/rejestr.js";
import { uruchomKroki } from "../src/kroki/runner.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

describe("ustawienia SMTP w .env (ticket 263)", () => {
  let tmp: string;
  let plikEnv: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bridge-263s-"));
    plikEnv = join(tmp, ".env");
    writeFileSync(plikEnv, "JWT_SECRET=tajny\n");
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const krok = () => KROKI_WDROZENIA.find((k) => k.id === "2026-10-14-partnerzy-smtp-ustawienia")!;
  const uruchom = async (env: Record<string, string>) => {
    const { sqlite, db } = otworzBaze(":memory:");
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const w = await uruchomKroki(sqlite, db, [krok()], { PLIK_ENV: plikEnv, ...env } as NodeJS.ProcessEnv);
    sqlite.close();
    return w;
  };

  it("dopisuje ustawienia skrzynki firmowej, NIE hasło ani odbiorców; krok tylko produkcyjny", async () => {
    expect(krok().tylkoProdukcja).toBe(true);
    const w = await uruchom({});
    expect(w.wykonane).toEqual([krok().id]);
    const env = readFileSync(plikEnv, "utf8");
    expect(env).toContain("JWT_SECRET=tajny\n");
    expect(env).toContain("SMTP_HOST=vpshd86.cyber-folks.pl\n");
    expect(env).toContain("SMTP_PORT=465\n");
    expect(env).toContain("SMTP_USER=info@agroopony.eu\n");
    expect(env).toContain("SMTP_OD=info@agroopony.eu\n");
    expect(env).toContain("SMTP_OD_NAZWA=AGROOPONY\n");
    expect(env).not.toContain("SMTP_HASLO");
    expect(env).not.toContain("POWIADOMIENIA_PARTNERZY_DO");
  });

  it("nie nadpisuje kluczy, które już są ustawione", async () => {
    writeFileSync(plikEnv, "SMTP_HOST=inny.example\nSMTP_PORT=587\n");
    await uruchom({ SMTP_HOST: "inny.example", SMTP_PORT: "587" });
    const env = readFileSync(plikEnv, "utf8");
    expect(env).toContain("SMTP_HOST=inny.example");
    expect(env).toContain("SMTP_PORT=587");
    expect(env).toContain("SMTP_USER=info@agroopony.eu");
  });
});
