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
 * GATE, część 1b — KONTRAKT dla odpowiedzi, która NIE jest JSON-em.
 *
 * Istnieje dla dokładnie jednej trasy w całym backendzie: `GET /api/analytics/export/{view}`
 * oddaje `text/csv`, bo tak robi oryginał (`analytics_module.cjs:305-322`). Wariant podstawowy
 * (`sprawdzZgodnoscZKontraktem`) zawsze podaje `contentType` do `sprawdzOdpowiedz()`, a ta
 * zgłasza naruszenie dla wszystkiego, co nie jest `application/json` — więc dla CSV-a
 * zapaliłaby się zawsze, choć kontrakt niczego takiego nie wymaga:
 * `contract/openapi.yaml:178-188` nie deklaruje dla tej ścieżki ŻADNEGO `content`.
 *
 * Dlatego tu pomijamy `contentType` (parametr jest opcjonalny po stronie `sprawdzOdpowiedz`,
 * `gate/kontrakt.ts:81`) i sprawdzamy dwie rzeczy, które kontrakt realnie niesie: że ścieżka
 * i metoda istnieją w `openapi.yaml` oraz że zwrócony status jest tam zadeklarowany.
 * Typ odpowiedzi asertuje wywołujący, osobno i wprost — patrz `analityka.eksport.gate.test.ts`.
 *
 * ⚠ NIE UŻYWAĆ jej do obchodzenia gate'a przy trasach JSON-owych. Jeśli trasa oddaje JSON,
 * ma iść przez `sprawdzZgodnoscZKontraktem`; pominięcie sprawdzenia typu byłoby wtedy
 * osłabieniem siatki, a nie dopasowaniem jej do kontraktu.
 */
export function sprawdzZgodnoscZKontraktemNieJson(arg: {
  metoda: string;
  sciezka: string;
  odpowiedz: Pick<OdpowiedzHttp, "status">;
}): void {
  const { metoda, sciezka, odpowiedz } = arg;
  const naruszenia = wczytajKontrakt().sprawdzOdpowiedz({
    metoda,
    sciezka,
    status: odpowiedz.status,
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

/**
 * GATE, część 2b — FIXTURES dla odpowiedzi będącej SŁOWNIKIEM DYNAMICZNYM.
 *
 * Istnieje dla dokładnie jednej trasy: `GET /api/atrybuty/liczniki`
 * (`mirror/backend/atrybuty_module.cjs:270-286`). Ta trasa nie zwraca rekordów o stałym
 * kształcie, tylko GOŁĄ MAPĘ `"<rodzaj>::<wartosc>" → liczba produktów` — w nagraniu
 * produkcji ma 5 348 kluczy, a każdy z nich to konkretna marka, rozmiar czy bieżnik
 * z ówczesnego katalogu.
 *
 * Dlaczego nie `sprawdzZgodnoscZFixture`: `porownajKsztalt` porównuje obiekty klucz po
 * kluczu, a brakujący i nadmiarowy klucz to twarda różnica (`gate/ksztalt.ts:56-75`).
 * Baza testowa ma inne produkty niż produkcja, więc dosłowne porównanie zapaliłoby tysiące
 * różnic — i to bez cienia wartości dowodowej, bo nie chodzi o to, żeby test miał te same
 * MARKI, tylko żeby odpowiedź miała ten sam KSZTAŁT.
 *
 * Co więc dowodzimy (decyzja użytkownika, plan.md D3 ticketa 29-FEATURE-atrybuty-backend):
 *  1. odpowiedź jest płaskim obiektem — bez zagnieżdżeń,
 *  2. NIE MA w niej klucza `ok` — ta trasa jako jedyna w module oddaje `res.json(wynik)`
 *     zamiast `res.json({ok:true, …})`; dodanie `ok` byłoby zmianą kontraktu,
 *  3. mapa NIE JEST PUSTA — pusta przeszłaby każdą pozostałą asercję, a jest realnym trybem
 *     awarii tej trasy: `licznikiAtrybutow` połyka wyjątek per kolumna (`continue`),
 *     więc rozjazd nazw kolumn kończy się nie błędem, tylko cichym `{}`,
 *  4. każdy klucz ma postać `<rodzaj>::<wartosc>`, a `<rodzaj>` należy do zbioru rodzajów
 *     PODANEGO PRZEZ WYWOŁUJĄCEGO (mapa z kodu),
 *  5. każdy prefiks OBECNY W FIXTURZE należy do tej samej mapy — to dowód w drugą stronę:
 *     gdyby z mapy wypadł wpis, który produkcja realnie zwracała, gate się zapali,
 *  6. każda wartość to dodatnia liczba całkowita (`COUNT(*)` z grupowania).
 *
 * Zbiór rodzajów NIE MOŻE pochodzić z samego fixture'a: nagranie ma 13 prefiksów, bo `sezon`
 * i `wentyl` były w produkcji puste, a mapa ma ich 15. Pierwszy produkt testowy z wypełnionym
 * `sezon` zapaliłby wtedy fałszywy STOP przy poprawnym kodzie.
 *
 * Czego NIE dowodzimy i dlaczego: konkretnych liczb ani konkretnych wartości atrybutów —
 * zależą od zawartości `products`, która w bazie testowej jest z definicji inna.
 * Ciężar dowodu dla samego liczenia leży w `test/atrybuty.crud.test.ts`.
 */
export function sprawdzZgodnoscZFixtureSlownika(
  nazwaPliku: string,
  cialoOdpowiedzi: unknown,
  znaneRodzaje: readonly string[],
): void {
  const fixture = wczytajFixture(nazwaPliku);
  const dozwolone = new Set(znaneRodzaje);

  const rodzajeZFixture = new Set(
    Object.keys(fixture.body as Record<string, unknown>)
      .filter((klucz) => !klucz.startsWith("_"))
      .map((klucz) => klucz.split("::")[0] ?? klucz),
  );
  expect(
    rodzajeZFixture.size,
    `Fixture ${nazwaPliku} nie zawiera ani jednego klucza "<rodzaj>::<wartosc>" — ` +
      "czy to na pewno nagranie słownika dynamicznego?",
  ).toBeGreaterThan(0);

  // Dowód w drugą stronę: rodzaj, który produkcja realnie zwracała, musi być w mapie z kodu.
  expect(
    [...rodzajeZFixture].filter((rodzaj) => !dozwolone.has(rodzaj)),
    `Rodzaje obecne w ${nazwaPliku}, których nie ma w mapie kodu — wypadł wpis z mapy?`,
  ).toEqual([]);

  expect(
    typeof cialoOdpowiedzi === "object" &&
      cialoOdpowiedzi !== null &&
      !Array.isArray(cialoOdpowiedzi),
    `Odpowiedź nie jest obiektem, a fixture ${nazwaPliku} nagrał mapę.`,
  ).toBe(true);

  const mapa = cialoOdpowiedzi as Record<string, unknown>;

  expect(
    Object.keys(mapa).length,
    `Odpowiedź jest PUSTA, a to realny tryb awarii tej trasy (połknięty wyjątek per kolumna), ` +
      `nie brak danych. Fixture ${nazwaPliku} ma klucze — dane testowe też powinny je dać.`,
  ).toBeGreaterThan(0);

  expect(
    Object.hasOwn(mapa, "ok"),
    `Odpowiedź ma klucz "ok", którego nagranie produkcji (${nazwaPliku}) NIE ma — ` +
      "ta trasa oddaje gołą mapę (`res.json(wynik)`).",
  ).toBe(false);

  const bledy: string[] = [];
  for (const [klucz, wartosc] of Object.entries(mapa)) {
    const rozdzielnik = klucz.indexOf("::");
    if (rozdzielnik <= 0) {
      bledy.push(`klucz "${klucz}" nie ma postaci <rodzaj>::<wartosc>`);
      continue;
    }
    const rodzaj = klucz.slice(0, rozdzielnik);
    if (!dozwolone.has(rodzaj)) {
      bledy.push(`rodzaj "${rodzaj}" (klucz "${klucz}") nie jest znanym rodzajem atrybutu`);
    }
    if (typeof wartosc !== "number" || !Number.isInteger(wartosc) || wartosc <= 0) {
      bledy.push(`wartość dla "${klucz}" to ${String(wartosc)}, oczekiwano dodatniego int`);
    }
  }

  expect(
    bledy,
    `Kształt słownika nie zgadza się z contract/fixtures/${nazwaPliku}:\n${bledy.join("\n")}\n` +
      "To jest STOP — nie poprawiaj fixture'a, zgłoś rozjazd.",
  ).toEqual([]);
}
