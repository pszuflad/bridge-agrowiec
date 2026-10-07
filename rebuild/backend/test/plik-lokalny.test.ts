import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  BrakPlikuLokalnego,
  czyPlikLokalny,
  czytajPlikLokalny,
} from "../src/import/plik-lokalny.js";
import { pobierzZUrl } from "../src/import/pobierz.js";

const baza = mkdtempSync(join(tmpdir(), "plik-lokalny-"));
const korzen = join(baza, "imports");
mkdirSync(join(korzen, "MO4_x"), { recursive: true });
writeFileSync(join(korzen, "MO4_x", "agrowiec_wr.csv"), "a;b\n1;2\n");
writeFileSync(join(baza, "sekret.txt"), "nie");
symlinkSync(join(baza, "sekret.txt"), join(korzen, "link.txt"));
const env = { IMPORT_KATALOG_LOKALNY: korzen } as NodeJS.ProcessEnv;
afterAll(() => rmSync(baza, { recursive: true, force: true }));

describe("plik lokalny dostawcy (ticket 194)", () => {
  it("rozpoznaje ścieżkę i file://, nie URL", () => {
    expect(czyPlikLokalny("/home/admin/x.csv")).toBe(true);
    expect(czyPlikLokalny("file:///home/admin/x.csv")).toBe(true);
    expect(czyPlikLokalny("https://agroopony.eu/imports/x.csv")).toBe(false);
  });
  it("czyta plik spod katalogu (ścieżka i file://)", async () => {
    const p = join(korzen, "MO4_x", "agrowiec_wr.csv");
    expect((await czytajPlikLokalny(p, env)).toString()).toBe("a;b\n1;2\n");
    expect((await czytajPlikLokalny(`file://${p}`, env)).toString()).toBe(
      "a;b\n1;2\n",
    );
  });
  it("odrzuca ścieżkę spoza katalogu — przez .. i przez dowiązanie", async () => {
    await expect(
      czytajPlikLokalny(join(korzen, "..", "sekret.txt"), env),
    ).rejects.toThrow(/spoza dozwolonego/);
    await expect(
      czytajPlikLokalny(join(korzen, "link.txt"), env),
    ).rejects.toThrow(/spoza dozwolonego/);
  });
  it("brak pliku to BrakPlikuLokalnego", async () => {
    await expect(
      czytajPlikLokalny(join(korzen, "MO4_x", "brak.csv"), env),
    ).rejects.toBeInstanceOf(BrakPlikuLokalnego);
  });
  it("pobierzZUrl obsługuje ścieżkę lokalną", async () => {
    process.env.IMPORT_KATALOG_LOKALNY = korzen;
    expect(
      (await pobierzZUrl(join(korzen, "MO4_x", "agrowiec_wr.csv"))).toString(),
    ).toContain("1;2");
    delete process.env.IMPORT_KATALOG_LOKALNY;
  });
});
