/**
 * STRAŻNIK ZALEŻNOŚCI — `archiver` musi eksportować `ZipArchive` (backlog #93, karta P5.2).
 *
 * ⚠ TEN TEST PILNUJE WERSJI PAKIETU, NIE NASZEGO KODU. Eksport ZIP
 * (`GET /api/export-shoper` bez `?dostawca=`, `src/routes/export-shoper.ts`) robi
 * `(await import("archiver")).ZipArchive` — port `rV()` z `deminified/backend-index.cjs:48139`.
 * W PRODUKCJI ta sama linijka zawsze pada: lockfile produkcji przypina `archiver@5.3.2`, który
 * eksportuje tylko `create`/`registerFormat`/`isRegisteredFormat`. Skutek: `new undefined(...)`,
 * log „zip pipeline failed TypeError: oh is not a constructor" i HTTP 500 przy każdym eksporcie
 * wszystkich dostawców.
 *
 * My mamy `archiver@^8.0.0` (lockfile: dokładnie 8.0.0), gdzie `ZipArchive` istnieje — i świadomie
 * przy tym zostajemy (decyzja użytkownika 2026-09-18, backlog #93). Ale zakres `^8.0.0` pozwala
 * `npm install` pociągnąć inną wersję. Gdyby ta zgubiła `ZipArchive`, TypeScript by tego nie
 * zauważył (`@types/archiver` to osobny pakiet), bramka ZIP też nie od razu — trasa oddaje
 * nagłówki, zanim zbuduje archiwum. Ten test pada przy `npm test` od razu i mówi dlaczego.
 *
 * Dlaczego zakres, a nie przypięta wersja (decyzja D3 karty 70): `npm ci` i tak instaluje
 * wersję z lockfile'a, zakres zostawia drogę poprawkom 8.x, a ten strażnik łapie jedyną
 * zmianę API, na której eksport stoi.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { czytajZip, type WpisZip } from "./gate/czytnik-zip.js";

/** Wersja faktycznie zainstalowana — do komunikatu błędu, nie do asercji. */
function wersjaArchivera(): string {
  // `archiver` ma `exports` bez `./package.json`, więc szukamy go od katalogu wejścia pakietu.
  const wejscie = createRequire(import.meta.url).resolve("archiver");
  const pkg = JSON.parse(readFileSync(join(dirname(wejscie), "package.json"), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

describe("strażnik zależności — `archiver` eksportuje `ZipArchive` (backlog #93)", () => {
  it("`ZipArchive` jest eksportowany i jest konstruktorem", async () => {
    const modul: Record<string, unknown> = await import("archiver");

    expect(
      typeof modul.ZipArchive,
      `archiver@${wersjaArchivera()} nie eksportuje ZipArchive — to dokładnie defekt produkcji ` +
        `(archiver@5.3.2, backlog #93): eksport ZIP w /api/export-shoper odda 500. ` +
        `Eksporty tej wersji: ${Object.keys(modul).join(", ")}`,
    ).toBe("function");
  });

  it("archiwum zbudowane `ZipArchive` da się przeczytać", async () => {
    const { ZipArchive } = await import("archiver");
    const archiwum = new ZipArchive({ zlib: { level: 9 } });

    const kawalki: Buffer[] = [];
    archiwum.on("data", (c: Buffer) => kawalki.push(c));
    const koniec = new Promise<void>((ok, blad) => {
      archiwum.on("end", ok);
      archiwum.on("error", blad);
    });

    archiwum.append("kod;cena\r\nMO9_1;1,00", { name: "a.csv" });
    archiwum.append("", { name: "pusty.csv" });
    await archiwum.finalize();
    await koniec;

    const wpisy = czytajZip(Buffer.concat(kawalki)).map((w: WpisZip) => [
      w.nazwa,
      w.tresc.toString("utf8"),
    ]);
    expect(wpisy).toEqual([
      ["a.csv", "kod;cena\r\nMO9_1;1,00"],
      ["pusty.csv", ""],
    ]);

    /**
     * Kontrola samego czytnika: bramki ZIP stoją na tym, że `czytajZip` ODRZUCA zepsute
     * archiwum. Urwany plik (tak wygląda przerwany transfer) i przekłamany bajt danych muszą
     * rzucić, inaczej asercje zawartości w bramkach byłyby puste.
     */
    const zip = Buffer.concat(kawalki);
    expect(() => czytajZip(zip.subarray(0, zip.length - 10))).toThrow();
    const przeklamany = Buffer.from(zip);
    przeklamany[40] = (przeklamany[40] ?? 0) ^ 0xff;
    expect(() => czytajZip(przeklamany)).toThrow();
  });
});
