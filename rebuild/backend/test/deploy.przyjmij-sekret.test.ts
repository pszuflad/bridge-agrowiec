/** Ticket 264: tools/przyjmij-sekret.sh — hasło SMTP z STDIN workflow trafia do .env serwera (bez wypisywania i bez gubienia innych linii). */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SKRYPT = resolve(__dirname, "../../../tools/przyjmij-sekret.sh");

describe("przyjmij_sekret_smtp", () => {
  let tmp: string;
  let plikEnv: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bridge-264-"));
    plikEnv = join(tmp, ".env");
    writeFileSync(plikEnv, "JWT_SECRET=tajny\nSELLY_TRYB=pelny\n", { mode: 0o600 });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  /** Uruchamia funkcję tak jak deploy-produkcja.sh (set -euo pipefail, źródłowanie, stdin z potoku) i oddaje wartości widziane PO niej. */
  const uruchom = (stdin: string) => {
    const polecenie = `set -euo pipefail; . '${SKRYPT}'; przyjmij_sekret_smtp '${plikEnv}'; echo "FORCE=\${FORCE:-0}"; set -a; . '${plikEnv}'; set +a; printf 'HASLO<%s>' "\${SMTP_HASLO:-}"; printf 'KAT<%s>' "\${PARTNERZY_KATALOGI_ZAMOWIEN:-}"`;
    const w = spawnSync("bash", ["-c", polecenie], { input: stdin, encoding: "utf8" });
    return { kod: w.status, out: w.stdout, err: w.stderr };
  };

  it("zapisuje hasło w .env (cytowane, źródłowalne także ze znakami specjalnymi), zachowuje pozostałe linie i prawa 0600, wymusza wdrożenie, nie wypisuje hasła", () => {
    const haslo = `p@ss "w$rd' #1 \\ x`;
    const w = uruchom(`${haslo}\n`);
    expect(w.kod).toBe(0);
    expect(w.out).toContain("FORCE=1");
    expect(w.out).toContain(`HASLO<${haslo}>`); // po `source` .env wartość jest dokładnie taka
    expect(w.out.replace(`HASLO<${haslo}>`, "")).not.toContain(haslo); // poza tym jedynym miejscem hasło nigdzie się nie pojawia
    expect(w.err).not.toContain(haslo);
    const env = readFileSync(plikEnv, "utf8");
    expect(env.startsWith("JWT_SECRET=tajny\nSELLY_TRYB=pelny\n")).toBe(true);
    expect(statSync(plikEnv).mode & 0o777).toBe(0o600);
  });

  it("to samo hasło drugi raz: nic się nie zmienia i wdrożenie nie jest wymuszane", () => {
    uruchom("tajne123\n");
    const przed = readFileSync(plikEnv, "utf8");
    const w = uruchom("tajne123\n");
    expect(w.out).toContain("FORCE=0");
    expect(readFileSync(plikEnv, "utf8")).toBe(przed);
  });

  it("inne hasło zastępuje stare (jedna linia SMTP_HASLO) i wymusza wdrożenie", () => {
    uruchom("stare\n");
    const w = uruchom("nowe\n");
    expect(w.out).toContain("FORCE=1");
    expect(w.out).toContain("HASLO<nowe>");
    expect((readFileSync(plikEnv, "utf8").match(/SMTP_HASLO=/g) ?? []).length).toBe(1);
  });

  it("pusty stdin (brak sekretu w GitHubie) i sam znak nowej linii: .env nietknięty, brak wymuszenia", () => {
    const przed = readFileSync(plikEnv, "utf8");
    for (const wejscie of ["", "\n"]) {
      const w = uruchom(wejscie);
      expect(w.kod).toBe(0);
      expect(w.out).toContain("FORCE=0");
    }
    expect(readFileSync(plikEnv, "utf8")).toBe(przed);
  });

  it("zamiast ręcznie wpisanej linii `export SMTP_HASLO=…` zostaje jedna nowa; brak pliku .env jest tworzony", () => {
    writeFileSync(plikEnv, "A=1\nexport SMTP_HASLO=reczne\nB=2\n", { mode: 0o600 });
    uruchom("z-githuba\n");
    const env = readFileSync(plikEnv, "utf8");
    expect(env).toContain("A=1\n");
    expect(env).toContain("B=2\n");
    expect(env).not.toContain("reczne");
    expect((env.match(/SMTP_HASLO=/g) ?? []).length).toBe(1);
    rmSync(plikEnv);
    expect(uruchom("nowy-plik\n").out).toContain("HASLO<nowy-plik>");
  });

  it("druga linia stdin (ticket 265): mapowanie katalogów ze średnikami trafia do .env w całości; hasło i mapowanie zapisują się niezależnie", () => {
    const mapowanie = "Adtyres=/srv/a/customer/orders;TyreWorld=/srv/t/orders";
    const w = uruchom(`haslo-smtp\n${mapowanie}\n`);
    expect(w.out).toContain("FORCE=1");
    expect(w.out).toContain(`KAT<${mapowanie}>`); // po `source` .env (średnik nie rozbija linii)
    expect(w.out).toContain("HASLO<haslo-smtp>");
    expect(w.out.replace(`KAT<${mapowanie}>`, "")).not.toContain("/srv/a"); // ścieżki poza tym jedynym miejscem nie wyciekają (np. do komunikatów skryptu)
    expect(w.out).toContain("PARTNERZY_KATALOGI_ZAMOWIEN zapisane w .env");
    const env = readFileSync(plikEnv, "utf8");
    expect(env.startsWith("JWT_SECRET=tajny\nSELLY_TRYB=pelny\n")).toBe(true);
    expect((env.match(/PARTNERZY_KATALOGI_ZAMOWIEN=/g) ?? []).length).toBe(1);
  });

  it("samo mapowanie (pusta linia hasła) zapisuje tylko mapowanie; to samo mapowanie drugi raz = bez zmian i bez wymuszenia", () => {
    uruchom("\nAdtyres=/x/orders\n");
    expect(readFileSync(plikEnv, "utf8")).not.toContain("SMTP_HASLO");
    expect(readFileSync(plikEnv, "utf8")).toContain("PARTNERZY_KATALOGI_ZAMOWIEN=");
    const przed = readFileSync(plikEnv, "utf8");
    const w = uruchom("\nAdtyres=/x/orders\n");
    expect(w.out).toContain("FORCE=0");
    expect(readFileSync(plikEnv, "utf8")).toBe(przed);
  });

  it("zmiana mapowania zastępuje stare (jedna linia) i wymusza wdrożenie", () => {
    uruchom("\nAdtyres=/x/orders\n");
    const w = uruchom("\nAdtyres=/y/orders;TyreWorld=/z\n");
    expect(w.out).toContain("FORCE=1");
    expect(w.out).toContain("KAT<Adtyres=/y/orders;TyreWorld=/z>");
    expect((readFileSync(plikEnv, "utf8").match(/PARTNERZY_KATALOGI_ZAMOWIEN=/g) ?? []).length).toBe(1);
  });
});
