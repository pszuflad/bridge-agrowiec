/**
 * `tools/publikuj-frontend.sh` — krok „frontend → docroot” z `tools/deploy-staging.sh`.
 *
 * Regresja z ticketu 93 (karta PR.4): `SELLY_CSV_DIR` na stagingu to `$DOCROOT/ex-port-files`,
 * a publikacja frontendu robi `rsync --delete` na cały docroot. Bez wyłączenia każdy deploy
 * kasował plik z „Wygeneruj CSV teraz” i panel Selly wracał do „Brak pliku CSV”.
 *
 * Bez mocków: prawdziwy `bash` + `rsync` na katalogach tymczasowych, skrypt uruchamiany jako
 * osobny proces — tak, jak woła go deploy. Na maszynie bez `bash`/`rsync` (np. Windows bez
 * Git Bash) test jest pomijany: deploy stagingu i tak chodzi tylko na VPS.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { katalogRepo } from "./gate/repo.js";

const SKRYPT = join(katalogRepo(), "tools", "publikuj-frontend.sh");

const maNarzedzia = ["bash", "rsync"].every(
  (narzedzie) => spawnSync(narzedzie, ["--version"], { stdio: "ignore" }).status === 0,
);

function zapisz(sciezka: string, tresc: string): void {
  mkdirSync(join(sciezka, ".."), { recursive: true });
  writeFileSync(sciezka, tresc);
}

describe.skipIf(!maNarzedzia)("publikuj-frontend.sh — rsync --delete do docroota stagingu", () => {
  let tmp: string;
  let dist: string;
  let docroot: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "bridge-publikacja-"));
    dist = join(tmp, "dist");
    docroot = join(tmp, "public_html", "test");

    zapisz(join(dist, "index.html"), "nowy index");
    zapisz(join(dist, "assets", "index-NOWY.js"), "nowy bundle");

    // Stan docroota po poprzednim deployu + kliknięciu „Wygeneruj CSV teraz”.
    zapisz(join(docroot, "index.html"), "stary index");
    zapisz(join(docroot, "assets", "index-STARY.js"), "stary bundle");
    zapisz(join(docroot, ".htaccess"), "proxy");
    zapisz(join(docroot, "ex-port-files", "sellycsv-staging.csv"), "wygenerowany CSV");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function publikuj(...chronione: string[]): void {
    execFileSync("bash", [SKRYPT, dist, docroot, ...chronione], { stdio: "pipe" });
  }

  it("plik CSV Selly spod docroota przeżywa publikację, reszta jak dotąd", () => {
    publikuj(join(docroot, "ex-port-files"));

    const csv = join(docroot, "ex-port-files", "sellycsv-staging.csv");
    expect(readFileSync(csv, "utf8")).toBe("wygenerowany CSV");
    expect(readFileSync(join(docroot, ".htaccess"), "utf8")).toBe("proxy");
    expect(readFileSync(join(docroot, "index.html"), "utf8")).toBe("nowy index");
    expect(existsSync(join(docroot, "assets", "index-NOWY.js"))).toBe(true);
    // `--delete` nadal sprząta stare bundle — wyłączenie nie może go wyłączyć w ogóle.
    expect(existsSync(join(docroot, "assets", "index-STARY.js"))).toBe(false);
  });

  it("końcowy ukośnik w ścieżce katalogu CSV nie zmienia wyniku", () => {
    publikuj(`${join(docroot, "ex-port-files")}/`);
    expect(existsSync(join(docroot, "ex-port-files", "sellycsv-staging.csv"))).toBe(true);
  });

  it("bez chronionego katalogu rsync --delete kasuje CSV — to był błąd z ticketu 93", () => {
    publikuj();
    expect(existsSync(join(docroot, "ex-port-files"))).toBe(false);
  });

  it("katalog CSV poza docrootem jest pomijany bez błędu i nietykany", () => {
    const poza = join(tmp, "private", "ex-port-files");
    zapisz(join(poza, "plik.csv"), "poza docrootem");

    publikuj(poza);

    expect(readFileSync(join(poza, "plik.csv"), "utf8")).toBe("poza docrootem");
    expect(existsSync(join(docroot, "assets", "index-STARY.js"))).toBe(false);
  });

  it("tworzy docroot, gdy go nie ma (pierwszy deploy)", () => {
    rmSync(docroot, { recursive: true, force: true });
    publikuj(join(docroot, "ex-port-files"));
    expect(readFileSync(join(docroot, "index.html"), "utf8")).toBe("nowy index");
  });
});
