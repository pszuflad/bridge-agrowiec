import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { SCIEZKA_KONTRAKTU } from "./repo.js";

/**
 * Walidacja odpowiedzi względem zamrożonego kontraktu `contract/openapi.yaml`.
 *
 * ⚠ ZAKRES WALIDACJI — świadomie ograniczony do tego, co kontrakt (wersja 2.3) faktycznie
 * zamraża: ścieżki, metody, `security` i KODY odpowiedzi. Ciała NIE są opisane schematami
 * (request body to `{type: object}`, odpowiedzi mają tylko `description`), więc sprawdzenie
 * kształtu ciała należy do porównania z `contract/fixtures/` (test/gate/ksztalt.ts).
 * Nie udajemy, że walidujemy więcej, niż kontrakt opisuje.
 */

type OperacjaOpenApi = {
  security?: unknown[];
  responses?: Record<string, unknown>;
};

export type Operacja = {
  metoda: string;
  wzorzecSciezki: string;
  wymagaAuth: boolean;
  kody: string[];
};

export type Kontrakt = {
  znajdzOperacje(metoda: string, sciezka: string): Operacja | undefined;
  /** Zwraca listę naruszeń kontraktu; pusta = OK. */
  sprawdzOdpowiedz(zadanie: {
    metoda: string;
    sciezka: string;
    status: number;
    contentType?: string | undefined;
  }): string[];
};

let cache: Kontrakt | undefined;

export function wczytajKontrakt(): Kontrakt {
  if (cache) return cache;

  const dokument = yaml.load(readFileSync(SCIEZKA_KONTRAKTU(), "utf8")) as {
    paths?: Record<string, Record<string, OperacjaOpenApi>>;
  };
  const sciezki = dokument.paths ?? {};

  const operacje: Array<Operacja & { regex: RegExp }> = [];
  for (const [wzorzec, metody] of Object.entries(sciezki)) {
    for (const [metoda, operacja] of Object.entries(metody)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options"].includes(metoda)) continue;
      operacje.push({
        metoda: metoda.toUpperCase(),
        wzorzecSciezki: wzorzec,
        // `security: []` = jawnie publiczne; brak klucza albo niepusta lista = wymaga auth.
        wymagaAuth: !(Array.isArray(operacja.security) && operacja.security.length === 0),
        kody: Object.keys(operacja.responses ?? {}),
        regex: naRegex(wzorzec),
      });
    }
  }

  cache = {
    znajdzOperacje(metoda, sciezka) {
      const bezQuery = sciezka.split("?")[0] ?? sciezka;
      return operacje.find((o) => o.metoda === metoda.toUpperCase() && o.regex.test(bezQuery));
    },
    sprawdzOdpowiedz({ metoda, sciezka, status, contentType }) {
      const naruszenia: string[] = [];
      const operacja = this.znajdzOperacje(metoda, sciezka);
      if (!operacja) {
        naruszenia.push(`${metoda} ${sciezka} — brak takiej operacji w contract/openapi.yaml`);
        return naruszenia;
      }
      if (!operacja.kody.includes(String(status))) {
        naruszenia.push(
          `${metoda} ${operacja.wzorzecSciezki} — status ${status} nie jest zadeklarowany ` +
            `w kontrakcie (dozwolone: ${operacja.kody.join(", ")})`,
        );
      }
      if (contentType !== undefined && !contentType.includes("application/json")) {
        naruszenia.push(
          `${metoda} ${operacja.wzorzecSciezki} — odpowiedź nie jest JSON-em (${contentType})`,
        );
      }
      return naruszenia;
    },
  };
  return cache;
}

/** `/api/products/{id}` → regex dopasowujący `/api/products/123`. */
function naRegex(wzorzec: string): RegExp {
  const escaped = wzorzec
    .split("/")
    .map((segment) =>
      /^\{.+\}$/.test(segment)
        ? "[^/]+"
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${escaped}$`);
}
