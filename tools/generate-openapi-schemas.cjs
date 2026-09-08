#!/usr/bin/env node
/* eslint-disable no-console */
// ============================================================================
//  Bridge — generate-openapi-schemas.cjs
//
//  Dopisuje do `contract/openapi.yaml` SCHEMATY CIAŁ wywnioskowane z nagrań
//  w `contract/fixtures/`. Wersja 2.3 kontraktu zamrażała wyłącznie ścieżki,
//  metody, `security` i kody odpowiedzi — ciała były `{type: object}`, a
//  odpowiedzi miały sam `description`.
//
//  ⭐ ZASADA NADRZĘDNA (ticket 38 / sesja 12d): schematy powstają Z NAGRAŃ
//  PRODUKCJI, nie z `rebuild/`. Ten skrypt czyta wyłącznie `contract/fixtures/`
//  i nie dotyka kodu odbudowy — inaczej kontrakt przestałby być niezależnym
//  dowodem i sprawdzalibyśmy własną pracę własną pracą.
//
//  Uruchomienie:  node tools/generate-openapi-schemas.cjs
//                 node tools/generate-openapi-schemas.cjs --sprawdz   # tylko kontrola
//
//  ── DLACZEGO EDYCJA TEKSTU, A NIE `yaml.dump()` ───────────────────────────
//  `openapi.yaml` niesie komentarze (m.in. dwunastowierszowy blok o ścieżkach
//  `uwaga_cena` dopisanych w 12a) oraz zwięzły styl inline. `yaml.load` +
//  `yaml.dump` przepisałoby cały plik i SKASOWAŁO komentarze — czyli wiedzę,
//  dla której ten projekt trzyma kontrakt pod kontrolą wersji. Dlatego skrypt
//  dokłada schematy chirurgicznie:
//    • cała masa schematów ląduje w JEDNYM generowanym bloku `components.schemas`
//      między znacznikami POCZĄTEK/KONIEC,
//    • każda operacja dostaje w swojej linii wyłącznie krótkie `$ref`.
//  Dzięki temu `paths` zmienia się o jedną linię na operację, a nie w całości.
//
//  IDEMPOTENTNY: drugi bieg na niezmienionych fixtures nie zmienia pliku.
//  Osiąga to przez zdjęcie własnych wstawek (blok znacznikowy + `content:`
//  w liniach odpowiedzi) PRZED regeneracją.
// ============================================================================

const fs = require("node:fs");
const path = require("node:path");

const KORZEN = path.resolve(__dirname, "..");
const SCIEZKA_KONTRAKTU = path.join(KORZEN, "contract", "openapi.yaml");
const KATALOG_FIXTURES = path.join(KORZEN, "contract", "fixtures");

const ZNACZNIK_POCZATEK =
  "  # === POCZĄTEK: schematy generowane z contract/fixtures/ (tools/generate-openapi-schemas.cjs) ===";
const ZNACZNIK_KONIEC = "  # === KONIEC: schematy generowane ===";

const TYLKO_SPRAWDZ = process.argv.includes("--sprawdz");

// ————————————————————————————————————————————————————————————————————————————
// 1. Wnioskowanie schematu z nagranej wartości
// ————————————————————————————————————————————————————————————————————————————

/** Klucze techniczne nagrywarki (`_przyciete`, `_body_przyciete_z`) nie są częścią kontraktu. */
const techniczny = (klucz) => klucz.startsWith("_");

function schematZWartosci(wartosc) {
  if (wartosc === null) return { nullable: true };
  if (Array.isArray(wartosc)) {
    if (wartosc.length === 0) return { type: "array", items: {} };
    return { type: "array", items: scalWiele(wartosc.map(schematZWartosci)) };
  }
  if (typeof wartosc === "object") {
    const properties = {};
    const required = [];
    for (const [klucz, v] of Object.entries(wartosc)) {
      if (techniczny(klucz)) continue;
      properties[klucz] = schematZWartosci(v);
      required.push(klucz);
    }
    const schemat = { type: "object", properties };
    if (required.length > 0) schemat.required = required;
    return schemat;
  }
  if (typeof wartosc === "number") {
    return { type: Number.isInteger(wartosc) ? "integer" : "number" };
  }
  if (typeof wartosc === "boolean") return { type: "boolean" };
  return { type: "string" };
}

/**
 * Scalenie schematów wielu elementów tablicy w JEDEN wzorzec pozycji.
 *
 * Fixtures są przycięte do pięciu elementów, więc pole obecne tylko w części z nich
 * nie może trafić do `required` — inaczej kontrakt zamroziłby przypadek próbki
 * zamiast reguły. To ta sama polityka, którą stosuje `scalElementy` w GATE
 * (`rebuild/backend/test/gate/ksztalt.ts`).
 */
function scalWiele(schematy) {
  return schematy.reduce((a, b) => scalDwa(a, b));
}

/** Suma wariantów, bez powtórek — używana, gdy pole ma w nagraniu więcej niż jeden typ. */
function suma(...schematy) {
  const warianty = [];
  for (const schemat of schematy) {
    for (const wariant of schemat.oneOf ?? [schemat]) {
      if (!warianty.some((w) => JSON.stringify(w) === JSON.stringify(wariant))) warianty.push(wariant);
    }
  }
  return warianty.length === 1 ? warianty[0] : { oneOf: warianty };
}

/**
 * Schemat „bez typu" — powstaje z `null` w nagraniu (`{nullable: true}`) albo z pustej
 * tablicy (`{}`). Nie niesie informacji o typie, więc scalony z czymkolwiek ma tylko
 * dołożyć `nullable`, a nie tworzyć wariantu.
 */
const bezTypu = (x) => x.type === undefined && x.oneOf === undefined;

function scalDwa(a, b) {
  // ⚠ Ta gałąź MUSI iść przed porównaniem typów. Wcześniej stały tu warunki
  // `a.nullable && !b.nullable`, które nie łapały przypadku „oba nullable, jeden bez typu":
  // `{type:"string", nullable:true}` + `{nullable:true}` przelatywało dalej i produkowało
  // zdegenerowane `oneOf: [ {type:string,nullable}, {nullable} ]` — wariant, który niczego
  // nie zawęża. Widoczne stało się dopiero po zamianie cichego `{}` na jawną sumę.
  if (bezTypu(a) && bezTypu(b)) return a.nullable || b.nullable ? { nullable: true } : {};
  if (bezTypu(a)) return a.nullable ? { ...b, nullable: true } : b;
  if (bezTypu(b)) return b.nullable ? { ...a, nullable: true } : a;
  if (a.nullable && !b.nullable) return { ...b, nullable: true };
  if (b.nullable && !a.nullable) return { ...a, nullable: true };
  if (a.oneOf || b.oneOf) return suma(a, b);
  if (a.type !== b.type) {
    // `integer` i `number` w jednej kolumnie to po prostu liczba.
    if (["integer", "number"].includes(a.type) && ["integer", "number"].includes(b.type)) {
      return { ...a, type: "number" };
    }
    // ⚠ Każdy inny rozjazd typu to FAKT o nagraniu: produkcja oddaje w tym polu raz jedno,
    // raz drugie. Wcześniejsza wersja zwracała tu `{}`, czyli schemat „akceptuję wszystko" —
    // rozjazd znikał po cichu i kontrakt przestawał cokolwiek o tym polu mówić. To ten sam
    // wzorzec, przed którym ostrzega CLAUDE.md (pusty wynik udający brak problemu).
    // Zapisujemy go jawnie jako `oneOf`, żeby był widoczny w kontrakcie i w review.
    return suma(a, b);
  }
  if (a.type === "object") {
    const properties = { ...a.properties };
    for (const [klucz, schemat] of Object.entries(b.properties ?? {})) {
      properties[klucz] = properties[klucz] ? scalDwa(properties[klucz], schemat) : schemat;
    }
    const wspolne = (a.required ?? []).filter((k) => (b.required ?? []).includes(k));
    const wynik = { type: "object", properties };
    if (wspolne.length > 0) wynik.required = wspolne;
    return wynik;
  }
  if (a.type === "array") {
    const itemsA = a.items ?? {};
    const itemsB = b.items ?? {};
    const items =
      Object.keys(itemsA).length === 0 ? itemsB : Object.keys(itemsB).length === 0 ? itemsA : scalDwa(itemsA, itemsB);
    return { type: "array", items };
  }
  return a;
}

// ————————————————————————————————————————————————————————————————————————————
// 2. Rejestr schematów — dedupe i wyniesienie do components/schemas
// ————————————————————————————————————————————————————————————————————————————

/** Obiekt tej wielkości powtórzony w kilku operacjach (pozycja produktu ma 72 pola)
 *  rozdąłby plik wielokrotnie — takie wynosimy pod wspólną nazwę. */
const PROG_WYNIESIENIA = 20;

class Rejestr {
  constructor() {
    this.wgKlucza = new Map(); // kanoniczny JSON → nazwa
    this.schematy = new Map(); // nazwa → schemat
  }

  /** Zwraca `{ $ref: … }` dla schematu, nadając mu nazwę przy pierwszym wystąpieniu. */
  zarejestruj(schemat, proponowanaNazwa) {
    const klucz = JSON.stringify(schemat);
    const istniejaca = this.wgKlucza.get(klucz);
    if (istniejaca) return { $ref: `#/components/schemas/${istniejaca}` };

    let nazwa = proponowanaNazwa;
    let n = 2;
    while (this.schematy.has(nazwa)) nazwa = `${proponowanaNazwa}${n++}`;
    this.wgKlucza.set(klucz, nazwa);
    this.schematy.set(nazwa, schemat);
    return { $ref: `#/components/schemas/${nazwa}` };
  }

  /** Rekurencyjnie wynosi duże obiekty, zostawiając w ich miejscu `$ref`. */
  wynies(schemat, nazwaBazowa) {
    if (!schemat || typeof schemat !== "object") return schemat;

    if (schemat.type === "array" && schemat.items) {
      return { ...schemat, items: this.wynies(schemat.items, `${nazwaBazowa}Pozycja`) };
    }
    if (schemat.type === "object" && schemat.properties) {
      const properties = {};
      for (const [klucz, pod] of Object.entries(schemat.properties)) {
        properties[klucz] = this.wynies(pod, nazwaBazowa + naNazwe(klucz));
      }
      const zWyniesionymi = { ...schemat, properties };
      if (Object.keys(properties).length >= PROG_WYNIESIENIA) {
        return this.zarejestruj(zWyniesionymi, nazwaBazowa);
      }
      return zWyniesionymi;
    }
    return schemat;
  }
}

const naNazwe = (tekst) =>
  String(tekst)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((c) => c[0].toUpperCase() + c.slice(1))
    .join("");

// ————————————————————————————————————————————————————————————————————————————
// 3. Dopasowanie fixture'ów do operacji kontraktu
// ————————————————————————————————————————————————————————————————————————————

/** `/api/products/{id}` → regex dopasowujący `/api/products/123` (jak w GATE). */
function naRegex(wzorzec) {
  const escaped = wzorzec
    .split("/")
    .map((s) => (/^\{.+\}$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${escaped}$`);
}

/**
 * Mapa operacji z pliku kontraktu, czytana LINIAMI (nie parserem YAML), bo tym samym
 * przebiegiem wstawiamy potem `$ref`-y. Format `openapi.yaml` jest regularny:
 * 2 spacje = ścieżka, 4 = metoda, 6 = `responses`/`requestBody`, 8 = kod statusu.
 * Gdyby się rozjechał, skrypt ma się zatrzymać, a nie po cichu pominąć operację.
 */
function przeczytajOperacje(linie) {
  const operacje = [];
  let sciezka = null;
  let biezaca = null;

  linie.forEach((linia, i) => {
    const mSciezka = /^ {2}(\/\S*):\s*$/.exec(linia);
    if (mSciezka) {
      sciezka = mSciezka[1];
      biezaca = null;
      return;
    }
    const mMetoda = /^ {4}(get|post|put|patch|delete|head|options):\s*$/.exec(linia);
    if (mMetoda) {
      if (!sciezka) throw new Error(`Metoda bez ścieżki w linii ${i + 1}: ${linia}`);
      biezaca = {
        metoda: mMetoda[1].toUpperCase(),
        sciezka,
        regex: naRegex(sciezka),
        liniaRequestBodyContent: null,
        liniaRequestBodySchema: null,
        statusy: new Map(),
      };
      operacje.push(biezaca);
      return;
    }
    if (!biezaca) return;

    const mStatus = /^ {8}"(\d{3})":/.exec(linia);
    if (mStatus) {
      biezaca.statusy.set(mStatus[1], i);
      return;
    }
    if (/^ {8}content: \{ application\/json: \{ schema: /.test(linia)) {
      biezaca.liniaRequestBodySchema = i;
    }
  });

  return operacje;
}

// ————————————————————————————————————————————————————————————————————————————
// 4. Serializacja schematu do YAML-a (blokowo, w components/schemas)
// ————————————————————————————————————————————————————————————————————————————

const cytujKlucz = (klucz) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(klucz) ? klucz : JSON.stringify(klucz));

function doYaml(wartosc, wciecie) {
  const p = " ".repeat(wciecie);
  if (Array.isArray(wartosc)) {
    if (wartosc.length === 0) return `${p}[]`;
    return wartosc.map((v) => `${p}- ${JSON.stringify(v)}`).join("\n");
  }
  const klucze = Object.keys(wartosc);
  if (klucze.length === 0) return `${p}{}`;
  const linie = [];
  for (const klucz of klucze) {
    const v = wartosc[klucz];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (Object.keys(v).length === 0) {
        linie.push(`${p}${cytujKlucz(klucz)}: {}`);
      } else {
        linie.push(`${p}${cytujKlucz(klucz)}:`);
        linie.push(doYaml(v, wciecie + 2));
      }
    } else if (Array.isArray(v)) {
      linie.push(`${p}${cytujKlucz(klucz)}:`);
      linie.push(doYaml(v, wciecie + 2));
    } else {
      linie.push(`${p}${cytujKlucz(klucz)}: ${JSON.stringify(v)}`);
    }
  }
  return linie.join("\n");
}

// ————————————————————————————————————————————————————————————————————————————
// 5. Zdjęcie poprzedniej generacji (idempotencja)
// ————————————————————————————————————————————————————————————————————————————

function zdejmijPoprzedniaGeneracje(tekst) {
  let linie = tekst.split("\n");

  const start = linie.indexOf(ZNACZNIK_POCZATEK);
  if (start !== -1) {
    const koniec = linie.indexOf(ZNACZNIK_KONIEC);
    if (koniec === -1) throw new Error("Znacznik POCZĄTEK bez KOŃCA — kontrakt uszkodzony.");
    linie.splice(start, koniec - start + 1);
  }

  linie = linie.map((linia) => {
    // Odpowiedzi: zdejmij dopisane `, content: { … }` z linii statusu.
    const mStatus = /^( {8}"\d{3}": \{ .*?)(, content: \{ application\/json: .*)\}\s*$/.exec(linia);
    if (mStatus) return `${mStatus[1]} }`;
    // Ciała żądań: przywróć pierwotne `{ type: object }`.
    if (/^ {8}content: \{ application\/json: \{ schema: \{ \$ref:/.test(linia)) {
      return "        content: { application/json: { schema: { type: object } } }";
    }
    return linia;
  });

  return linie.join("\n");
}

// ————————————————————————————————————————————————————————————————————————————
// 6. Główna pętla
// ————————————————————————————————————————————————————————————————————————————

function main() {
  const oryginalny = fs.readFileSync(SCIEZKA_KONTRAKTU, "utf8");
  const tekst = zdejmijPoprzedniaGeneracje(oryginalny);
  const linie = tekst.split("\n");
  const operacje = przeczytajOperacje(linie);

  const rejestr = new Rejestr();
  // Nr linii → LISTA nagrań, nie pojedyncze. Jedna operacja potrafi mieć kilka
  // legalnych kształtów: `GET /api/products` oddaje kopertę albo gołą tablicę
  // zależnie od parametrów, a `POST /api/products` przyjmuje tablicę albo `{items}`.
  // Wcześniejsza wersja brała pierwsze nagranie i po cichu gubiła drugie — czyli
  // kontrakt zamrażałby połowę prawdy i uznawał drugą połowę za niezgodną.
  const nagraniaStatusow = new Map();
  const nagraniaZadan = new Map();
  const pominiete = [];

  const pliki = fs
    .readdirSync(KATALOG_FIXTURES)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (const plik of pliki) {
    const fixture = JSON.parse(fs.readFileSync(path.join(KATALOG_FIXTURES, plik), "utf8"));
    if (!fixture || typeof fixture !== "object" || !("body" in fixture)) continue;
    if (fixture.json === false) {
      pominiete.push(`${plik} — odpowiedź nie jest JSON-em`);
      continue;
    }

    const sciezkaBezQuery = String(fixture.endpoint).split("?")[0];
    const operacja = operacje.find(
      (o) => o.metoda === String(fixture.method).toUpperCase() && o.regex.test(sciezkaBezQuery),
    );
    if (!operacja) {
      pominiete.push(`${plik} — ${fixture.method} ${sciezkaBezQuery} nie ma operacji w kontrakcie`);
      continue;
    }

    const nrLinii = operacja.statusy.get(String(fixture.status));
    if (nrLinii === undefined) {
      pominiete.push(
        `${plik} — kontrakt nie deklaruje ${fixture.status} dla ${operacja.metoda} ${operacja.sciezka}`,
      );
    } else {
      if (!nagraniaStatusow.has(nrLinii)) nagraniaStatusow.set(nrLinii, { operacja, fixtury: [] });
      nagraniaStatusow.get(nrLinii).fixtury.push(fixture);
    }

    if (fixture.request !== undefined && operacja.liniaRequestBodySchema !== null) {
      const nr = operacja.liniaRequestBodySchema;
      if (!nagraniaZadan.has(nr)) nagraniaZadan.set(nr, { operacja, cialaZadan: [] });
      nagraniaZadan.get(nr).cialaZadan.push(fixture.request);
    }
  }

  const nazwaBazowa = (operacja) =>
    naNazwe(operacja.metoda) + naNazwe(operacja.sciezka.replace("/api/", ""));

  /**
   * Kilka nagrań tej samej operacji → `oneOf`, ale TYLKO gdy realnie różnią się kształtem.
   * Powtórki (to samo ciało nagrane dwa razy) rejestr i tak sklei do jednego `$ref`.
   */
  const zbudujRef = (schematy, bazowa) => {
    const unikalne = [];
    for (const ref of schematy) {
      if (!unikalne.some((u) => u.$ref === ref.$ref)) unikalne.push(ref);
    }
    if (unikalne.length === 1) return unikalne[0].$ref;
    return rejestr.zarejestruj({ oneOf: unikalne }, `${bazowa}Warianty`).$ref;
  };

  const wstawkiStatusow = new Map();
  for (const [nrLinii, { operacja, fixtury }] of nagraniaStatusow) {
    const bazowa = nazwaBazowa(operacja);
    const refy = fixtury.map((fixture) => {
      const schemat = rejestr.wynies(schematZWartosci(fixture.body), `${bazowa}${fixture.status}`);
      return schemat.$ref ? schemat : rejestr.zarejestruj(schemat, `${bazowa}Odpowiedz${fixture.status}`);
    });
    wstawkiStatusow.set(nrLinii, zbudujRef(refy, `${bazowa}Odpowiedz${fixtury[0].status}`));
  }

  const wstawkiZadan = new Map();
  for (const [nrLinii, { operacja, cialaZadan }] of nagraniaZadan) {
    const bazowa = nazwaBazowa(operacja);
    const refy = cialaZadan.map((cialo) => {
      const schemat = rejestr.wynies(schematZWartosci(cialo), `${bazowa}Zadanie`);
      return schemat.$ref ? schemat : rejestr.zarejestruj(schemat, `${bazowa}Zadanie`);
    });
    wstawkiZadan.set(nrLinii, zbudujRef(refy, `${bazowa}Zadanie`));
  }

  const dopasowanych = wstawkiStatusow.size;

  // Wstawienie `$ref`-ów w liniach.
  const wynik = linie.map((linia, i) => {
    const refStatusu = wstawkiStatusow.get(i);
    if (refStatusu) {
      const m = /^( {8}"\d{3}": \{ .*?) \}\s*$/.exec(linia);
      if (!m) throw new Error(`Nieoczekiwany kształt linii statusu ${i + 1}: ${linia}`);
      return `${m[1]}, content: { application/json: { schema: { $ref: "${refStatusu}" } } } }`;
    }
    const refZadania = wstawkiZadan.get(i);
    if (refZadania) {
      return `        content: { application/json: { schema: { $ref: "${refZadania}" } } }`;
    }
    return linia;
  });

  // Blok components/schemas — wstawiony zaraz za `securitySchemes`.
  const nrPaths = wynik.findIndex((l) => l === "paths:");
  if (nrPaths === -1) throw new Error("Nie znaleziono sekcji `paths:` w kontrakcie.");

  const blok = [ZNACZNIK_POCZATEK];
  blok.push(
    "  # Wywnioskowane z nagrań produkcji, NIE z rebuild/. Nie edytuj ręcznie —",
    "  # przebuduj: node tools/generate-openapi-schemas.cjs",
    "  schemas:",
  );
  for (const [nazwa, schemat] of [...rejestr.schematy.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    blok.push(`    ${nazwa}:`);
    blok.push(doYaml(schemat, 6));
  }
  blok.push(ZNACZNIK_KONIEC);

  wynik.splice(nrPaths, 0, ...blok);

  const nowy = wynik.join("\n");

  if (TYLKO_SPRAWDZ) {
    if (nowy !== oryginalny) {
      console.error(
        "contract/openapi.yaml jest NIEAKTUALNY wobec contract/fixtures/.\n" +
          "Przebuduj: node tools/generate-openapi-schemas.cjs",
      );
      process.exit(1);
    }
    console.log("contract/openapi.yaml aktualny wobec fixtures.");
    return;
  }

  fs.writeFileSync(SCIEZKA_KONTRAKTU, nowy, "utf8");

  console.log(`Operacji ze schematem odpowiedzi: ${dopasowanych}`);
  console.log(`Schematów w components/schemas: ${rejestr.schematy.size}`);
  console.log(`Ciał żądań opisanych schematem: ${wstawkiZadan.size}`);
  if (pominiete.length > 0) {
    console.log(`\nPominięte nagrania (${pominiete.length}):`);
    for (const powod of pominiete) console.log(`  • ${powod}`);
  }
}

main();
