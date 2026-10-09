/**
 * Bridge nie może być indeksowany (Google, inne wyszukiwarki, boty) — ani produkcja,
 * ani środowisko testowe. Trzy zamki: robots.txt, meta robots w index.html i nagłówek
 * X-Robots-Tag w .htaccess obu instancji. Test pilnuje, żeby żaden nie zniknął.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { katalogRepo } from "./gate/repo.js";

const czytaj = (...sciezka: string[]): string => readFileSync(join(katalogRepo(), ...sciezka), "utf8");

describe("zakaz indeksowania", () => {
  it("robots.txt zabrania wstępu wszystkim robotom", () => {
    const robots = czytaj("rebuild", "frontend", "public", "robots.txt");
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Disallow: \/$/m);
  });

  it("index.html ma meta robots noindex, nofollow", () => {
    const html = czytaj("rebuild", "frontend", "index.html");
    expect(html).toMatch(/<meta\s+name="robots"\s+content="[^"]*noindex[^"]*nofollow[^"]*"/);
  });

  it.each(["produkcja", "staging"])("deploy/%s/htaccess wysyła X-Robots-Tag", (instancja) => {
    const htaccess = czytaj("deploy", instancja, "htaccess");
    expect(htaccess).toMatch(/^Header always set X-Robots-Tag "[^"]*noindex[^"]*nofollow[^"]*"$/m);
  });
});
