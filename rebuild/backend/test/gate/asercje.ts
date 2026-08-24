import { expect } from "vitest";
import { wczytajFixture } from "./fixtures.js";
import { wczytajKontrakt } from "./kontrakt.js";
import { opiszRoznice, porownajKsztalt } from "./ksztalt.js";

/** Minimalny fragment odpowiedzi supertest, którego potrzebują asercje GATE. */
export type OdpowiedzHttp = {
  status: number;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
};

/**
 * GATE, część 1 — KONTRAKT: ścieżka i metoda istnieją w `contract/openapi.yaml`,
 * zwrócony status jest tam zadeklarowany, odpowiedź jest JSON-em.
 */
export function sprawdzZgodnoscZKontraktem(arg: {
  metoda: string;
  sciezka: string;
  odpowiedz: OdpowiedzHttp;
}): void {
  const { metoda, sciezka, odpowiedz } = arg;
  const contentType = odpowiedz.headers["content-type"];
  const naruszenia = wczytajKontrakt().sprawdzOdpowiedz({
    metoda,
    sciezka,
    status: odpowiedz.status,
    contentType: Array.isArray(contentType) ? contentType.join(", ") : contentType,
  });
  expect(
    naruszenia,
    `Naruszenia kontraktu (contract/openapi.yaml):\n${naruszenia.join("\n")}`,
  ).toEqual([]);
}

/**
 * GATE, część 2 — FIXTURES: kształt odpowiedzi zgadza się 1:1 z nagraną odpowiedzią
 * produkcji (klucze, typy, zagnieżdżenie).
 *
 * Rozbieżność = STOP. Fixture'a NIE wolno „poprawiać" pod nowy kod — to on pokazuje,
 * co produkcja realnie zwraca (.claude/commands/feature.md, Krok 9).
 */
export function sprawdzZgodnoscZFixture(nazwaPliku: string, cialoOdpowiedzi: unknown): void {
  const fixture = wczytajFixture(nazwaPliku);
  const { roznice, ostrzezenia } = porownajKsztalt(cialoOdpowiedzi, fixture.body);

  if (ostrzezenia.length > 0) {
    console.warn(
      `[GATE] ${nazwaPliku} — pola null tam, gdzie fixture miał wartość ` +
        `(dopuszczalne, kolumny nullable):\n${opiszRoznice(ostrzezenia)}`,
    );
  }

  expect(
    roznice,
    `Kształt odpowiedzi nie zgadza się z contract/fixtures/${nazwaPliku}:\n` +
      `${opiszRoznice(roznice)}\n` +
      `To jest STOP — nie poprawiaj fixture'a, zgłoś rozjazd.`,
  ).toEqual([]);
}
