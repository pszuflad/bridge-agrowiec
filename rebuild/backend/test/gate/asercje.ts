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
 * ZADEKLAROWANY WYJĄTEK od porównania z fixture'em.
 *
 * Istnieje po to, żeby rozjazd, o którym WIEMY i który mamy udokumentowany, nie zmuszał nas
 * ani do wyłączenia gate'a, ani do „poprawienia" fixture'a (czego zabrania Krok 9). Każdy
 * wyjątek musi powiedzieć CO, DLACZEGO i KIEDY znika — inaczej po roku nikt nie odróżni
 * świadomej decyzji od zapomnianego obejścia.
 */
export type WyjatekGate = {
  /** Wzorzec ścieżki w odpowiedzi, np. /^\$\.items\[\d+\]\.szerokosc$/. */
  sciezka: RegExp;
  /** Co się rozjeżdża i dlaczego jest to zgodne z produkcją, a nie z fixture'em. */
  powod: string;
  /** Co domknie wyjątek — ticket albo iteracja. */
  domyka: string;
};

/**
 * GATE, część 2 — FIXTURES: kształt odpowiedzi zgadza się 1:1 z nagraną odpowiedzią
 * produkcji (klucze, typy, zagnieżdżenie).
 *
 * Rozbieżność = STOP. Fixture'a NIE wolno „poprawiać" pod nowy kod — to on pokazuje,
 * co produkcja realnie zwraca (.claude/commands/feature.md, Krok 9). Jedyną furtką są
 * `wyjatki` — jawne, opisane i SAMOCZYSZCZĄCE SIĘ: wyjątek, który przestał być potrzebny,
 * zapala test, zamiast po cichu zostać w kodzie na zawsze.
 */
export function sprawdzZgodnoscZFixture(
  nazwaPliku: string,
  cialoOdpowiedzi: unknown,
  wyjatki: WyjatekGate[] = [],
): void {
  const fixture = wczytajFixture(nazwaPliku);
  const { roznice, ostrzezenia } = porownajKsztalt(cialoOdpowiedzi, fixture.body);

  if (ostrzezenia.length > 0) {
    console.warn(
      `[GATE] ${nazwaPliku} — pola null tam, gdzie fixture miał wartość ` +
        `(dopuszczalne, kolumny nullable):\n${opiszRoznice(ostrzezenia)}`,
    );
  }

  const objete = (wyjatek: WyjatekGate) => roznice.filter((r) => wyjatek.sciezka.test(r.sciezka));
  const pozostale = roznice.filter((r) => !wyjatki.some((w) => w.sciezka.test(r.sciezka)));

  expect(
    pozostale,
    `Kształt odpowiedzi nie zgadza się z contract/fixtures/${nazwaPliku}:\n` +
      `${opiszRoznice(pozostale)}\n` +
      `To jest STOP — nie poprawiaj fixture'a, zgłoś rozjazd.`,
  ).toEqual([]);

  // Wyjątek, który nic nie pokrywa, jest MARTWY — najczęściej dlatego, że fixture został
  // w końcu przenagrany. Zapalamy się, żeby wymusić jego usunięcie zamiast cichego dryfu.
  for (const wyjatek of wyjatki) {
    expect(
      objete(wyjatek).length,
      `Zadeklarowany wyjątek GATE dla ${nazwaPliku} (${wyjatek.sciezka}) NIE wystąpił.\n` +
        `Powód wpisany przy nim: ${wyjatek.powod}\n` +
        `Domknięcie: ${wyjatek.domyka}\n` +
        `Jeśli rozjazd zniknął (np. przenagrano fixture) — USUŃ ten wyjątek.`,
    ).toBeGreaterThan(0);
  }
}
