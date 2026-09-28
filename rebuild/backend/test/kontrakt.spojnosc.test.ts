/**
 * SPÓJNOŚĆ KONTRAKTU — `contract/openapi.yaml` po odświeżeniu w sesji 12d (ticket 38).
 *
 * Kontrakt przestał być listą ścieżek: od tego ticketu niesie SCHEMATY CIAŁ wygenerowane
 * z `contract/fixtures/` (`tools/generate-openapi-schemas.cjs`) oraz jawne adnotacje
 * `x-odbudowa-auth` przy trasach, które produkcja oddaje bez logowania, a odbudowa chroni.
 *
 * Skoro kontrakt jest generowany, musi mieć własną siatkę — inaczej rozjedzie się po cichu:
 *   • plik ma się parsować i mieć rozwiązywalne wszystkie `$ref`-y,
 *   • ma być AKTUALNY wobec fixtures (ktoś przenagrał nagranie i nie przebudował schematów),
 *   • adnotacje odstępstw mają zgadzać się z tym, co backend REALNIE robi — mierzone
 *     żądaniem, nie deklaracją.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import request from "supertest";
import yaml from "js-yaml";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { katalogRepo, SCIEZKA_KONTRAKTU } from "./gate/repo.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

type Operacja = {
  security?: unknown[];
  responses?: Record<string, { content?: unknown }>;
  "x-odbudowa-auth"?: string;
};
type Kontrakt = {
  paths: Record<string, Record<string, Operacja>>;
  components: { schemas: Record<string, unknown> };
};

const METODY = ["get", "post", "put", "patch", "delete"] as const;

const kontrakt = yaml.load(readFileSync(SCIEZKA_KONTRAKTU(), "utf8")) as Kontrakt;

const operacje = (): Array<{ metoda: string; sciezka: string; op: Operacja }> => {
  const wynik: Array<{ metoda: string; sciezka: string; op: Operacja }> = [];
  for (const [sciezka, metody] of Object.entries(kontrakt.paths)) {
    for (const [metoda, op] of Object.entries(metody)) {
      if ((METODY as readonly string[]).includes(metoda)) wynik.push({ metoda, sciezka, op });
    }
  }
  return wynik;
};

/**
 * Dwie trasy, w których `401` opisuje PRODUKCJĘ, a nie nasze odstępstwo.
 * Zmierzone na uruchomionym oryginale (`mirror/backend/index.cjs` na kopii bazy):
 * `GET /api/me` bez tokenu oddaje 401, bo oryginał chroni ją ręcznym `if (!req.user)`
 * zamiast wspólnym middlewarem — dlatego inwentarz 2.3 uznał ją za publiczną.
 * `POST /api/login` oddaje 401 przy złym haśle. Żadna z nich nie dostaje
 * `x-odbudowa-auth`, bo nie ma tu czego przypisywać odbudowie.
 */
const PRODUKCYJNE_401 = new Set(["GET /api/me", "POST /api/login"]);

describe("contract/openapi.yaml — struktura i integralność", () => {
  it("parsuje się i ma ścieżki oraz wygenerowane schematy", () => {
    expect(Object.keys(kontrakt.paths).length).toBeGreaterThan(90);
    expect(Object.keys(kontrakt.components.schemas).length).toBeGreaterThan(50);
  });

  it("każdy $ref wskazuje na istniejący schemat", () => {
    const brakujace: string[] = [];
    const obejdz = (wezel: unknown): void => {
      if (Array.isArray(wezel)) {
        wezel.forEach(obejdz);
        return;
      }
      if (!wezel || typeof wezel !== "object") return;
      for (const [klucz, wartosc] of Object.entries(wezel as Record<string, unknown>)) {
        if (klucz === "$ref" && typeof wartosc === "string") {
          const nazwa = wartosc.replace("#/components/schemas/", "");
          if (!(nazwa in kontrakt.components.schemas)) brakujace.push(wartosc);
        } else {
          obejdz(wartosc);
        }
      }
    };
    obejdz(kontrakt);
    expect(brakujace).toEqual([]);
  });

  it("nie ma osieroconych schematów — każdy jest z czegoś wołany", () => {
    const uzyte = new Set<string>();
    const obejdz = (wezel: unknown): void => {
      if (Array.isArray(wezel)) {
        wezel.forEach(obejdz);
        return;
      }
      if (!wezel || typeof wezel !== "object") return;
      for (const [klucz, wartosc] of Object.entries(wezel as Record<string, unknown>)) {
        if (klucz === "$ref" && typeof wartosc === "string") {
          uzyte.add(wartosc.replace("#/components/schemas/", ""));
        } else {
          obejdz(wartosc);
        }
      }
    };
    obejdz(kontrakt);
    const osierocone = Object.keys(kontrakt.components.schemas).filter((n) => !uzyte.has(n));
    expect(osierocone).toEqual([]);
  });

  /**
   * Strażnik dryfu: jeśli ktoś przenagra fixture i nie przebuduje schematów, kontrakt
   * zacznie opisywać nieaktualny kształt — czyli dokładnie ten rodzaj cichego rozjazdu,
   * dla którego ten ticket w ogóle powstał. Generator ma tryb `--sprawdz`, który nic
   * nie zapisuje i kończy się błędem, gdy plik jest nieaktualny.
   */
  it("schematy są AKTUALNE wobec contract/fixtures/", () => {
    const skrypt = join(katalogRepo(), "tools", "generate-openapi-schemas.cjs");
    expect(() =>
      execFileSync(process.execPath, [skrypt, "--sprawdz"], {
        cwd: dirname(dirname(skrypt)),
        encoding: "utf8",
      }),
    ).not.toThrow();
  });
});

describe("contract/openapi.yaml — adnotacje odstępstw auth (D4)", () => {
  let srodowisko: SrodowiskoTestowe;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
  });
  afterAll(() => srodowisko.posprzataj());

  /**
   * ⭐ MIERZYMY, NIE WIERZYMY NA SŁOWO. Dla każdej operacji, którą kontrakt opisuje jako
   * publiczną (`security: []` = stan produkcji), wysyłamy żądanie BEZ tokenu i patrzymy,
   * co robi odbudowa. Jeśli chroni — kontrakt musi to jawnie odnotować (`x-odbudowa-auth`
   * + zadeklarowany `401`). Jeśli nie chroni — adnotacji być nie może.
   *
   * Dzięki temu kontrakt zostaje lustrem PRODUKCJI (`security` nietknięte), a jednocześnie
   * nie da się po cichu dołożyć ani zdjąć `requireAuth` bez zaktualizowania dokumentu.
   */
  it("każda trasa publiczna w kontrakcie, którą odbudowa chroni, ma x-odbudowa-auth i 401", async () => {
    const rozjazdy: string[] = [];

    for (const { metoda, sciezka, op } of operacje()) {
      const publiczna = Array.isArray(op.security) && op.security.length === 0;
      if (!publiczna) continue;

      const url = sciezka.replace(/\{[^}]+\}/g, "1");
      const odp = await (
        request(srodowisko.app) as unknown as Record<string, (s: string) => request.Test>
      )[metoda]!(url).send({});

      const etykieta = `${metoda.toUpperCase()} ${sciezka}`;
      const chroniona = odp.status === 401;
      const maAdnotacje = typeof op["x-odbudowa-auth"] === "string";
      const deklaruje401 = Object.keys(op.responses ?? {}).includes("401");

      if (chroniona && !deklaruje401) {
        rozjazdy.push(`${etykieta}: odbudowa oddaje 401, kontrakt go nie deklaruje`);
      }
      if (chroniona && !maAdnotacje && !PRODUKCYJNE_401.has(etykieta)) {
        rozjazdy.push(`${etykieta}: odbudowa chroni trasę publiczną, brak x-odbudowa-auth`);
      }
      if (!chroniona && maAdnotacje) {
        rozjazdy.push(`${etykieta}: ma x-odbudowa-auth, ale odbudowa jej nie chroni (${odp.status})`);
      }
      if (PRODUKCYJNE_401.has(etykieta) && maAdnotacje) {
        rozjazdy.push(`${etykieta}: 401 pochodzi z produkcji — x-odbudowa-auth jest tu myląca`);
      }
    }

    expect(rozjazdy, `Kontrakt rozjechał się z zachowaniem odbudowy:\n${rozjazdy.join("\n")}`)
      .toEqual([]);
  });

  /** Odstępstw ma być dokładnie tyle, ile zmierzono w tickecie 38 — wzrost wymaga decyzji. */
  it("odstępstw auth jest 14 — tyle, ile zmierzono na oryginale w sesji 12d", () => {
    const zAdnotacja = operacje().filter((o) => typeof o.op["x-odbudowa-auth"] === "string");
    expect(zAdnotacja).toHaveLength(14);
  });
});
