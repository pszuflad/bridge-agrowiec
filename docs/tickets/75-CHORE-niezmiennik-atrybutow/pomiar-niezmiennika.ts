/**
 * POMIAR NIEZMIENNIKA KOLEJKI ATRYBUTÓW — karta P7.3 (`75-CHORE-niezmiennik-atrybutow`).
 *
 * Dla każdej pozycji kolejki pending porównuje trzy liczby z karty:
 *   A — `ile_wystapien` zapisane przy skanie (kolumna listy kolejki, fallback ostrzeżenia),
 *   B — `count` z `uzycieAtrybutu` (to, co dialog pokazuje w ostrzeżeniu),
 *   C — `produktow_zaktualizowano` z akcji (liczba wierszy, które UPDATE dopasował),
 * plus D — niezależne przeliczenie w SQL: ile wierszy PO akcji ma nową wartość, a przed nią
 * jej nie miało, czyli ile produktów REALNIE zmieniło zapis.
 *
 * Dwa warianty, każdy na własnej, świeżej kopii snapshotu:
 *   „stan"   — kolejka i słownik takie, jakie są w snapshocie; skan dokłada to, co znajdzie.
 *              Tak wygląda ekran, który Ania otwiera dziś. Obie akcje (z edycją i alias).
 *   „czysty" — przed skanem pusta kolejka, pusty słownik i pusta lista odrzuconych, więc skan
 *              wystawia KAŻDĄ wartość 13 kolumn ze świeżym A. Sprawdza predykat skanu wobec
 *              predykatu UPDATE na całym katalogu. Tylko „z edycją" — alias wymaga słownika.
 *
 * Każda akcja idzie w transakcji wycofywanej po pomiarze — kolejna pozycja widzi bazę nietkniętą.
 *
 * Bazą jest kopia `db/snapshot.db` w katalogu tymczasowym po migracjach odbudowy 001–006.
 * Oryginału nie stawiamy: `pending_module.cjs` ma zahardkodowane ścieżki produkcyjne i lokalnie
 * się nie podnosi (CLAUDE.md, „Środowisko"). Predykaty odbudowy są dosłowną kopią oryginału —
 * zestawienie w `raport.md`, sekcja „Predykaty".
 *
 * Uruchomienie (Node ≥ 20, z `rebuild/backend/`; NODE_PATH, bo skrypt leży poza pakietem):
 *   NODE_PATH=$PWD/node_modules npx tsx ../../docs/tickets/75-CHORE-niezmiennik-atrybutow/pomiar-niezmiennika.ts
 * Snapshot: `BRIDGE_SNAPSHOT=/sciezka` albo `db/snapshot.db` w worktree lub w głównym repo.
 * Wynik: `pomiar-wynik.json` obok skryptu.
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";

import { otworzBaze } from "../../../rebuild/backend/src/db/index.js";
import { zastosujMigracje } from "../../../rebuild/backend/src/db/migrate.js";
import {
  uzycieAtrybutu,
  znanyRodzaj,
} from "../../../rebuild/backend/src/repos/atrybuty.js";
import {
  akceptujJakoAlias,
  akceptujZEdycja,
  kolumnaRodzaju,
  listaPending,
  skanujNoweWartosci,
} from "../../../rebuild/backend/src/repos/atrybuty-pending.js";

const KATALOG_SKRYPTU = dirname(fileURLToPath(import.meta.url));
const KORZEN = resolve(KATALOG_SKRYPTU, "../../..");
const PRZYKLADOW = 8;

/** Kolejność szukania jak w `tools/record-write-fixtures.cjs:48-69`. */
function znajdzSnapshot(): string {
  const kandydaci: string[] = [];
  if (process.env.BRIDGE_SNAPSHOT)
    kandydaci.push(resolve(process.env.BRIDGE_SNAPSHOT));
  kandydaci.push(join(KORZEN, "db", "snapshot.db"));
  try {
    const wspolny = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      {
        cwd: KORZEN,
        encoding: "utf8",
      },
    ).trim();
    kandydaci.push(join(dirname(wspolny), "db", "snapshot.db"));
  } catch {
    /* nie repo git — zostają pozostałe ścieżki */
  }
  const znaleziony = kandydaci.find((p) => existsSync(p));
  if (!znaleziony)
    throw new Error(
      `Nie znaleziono db/snapshot.db. Sprawdzone: ${kandydaci.join(", ")}`,
    );
  return znaleziony;
}

/** Przerwanie transakcji pomiarowej — wszystko, co akcja zrobiła, wraca do stanu sprzed niej. */
class Wycofaj extends Error {}

type Pomiar = { B: number; C: number; D: number; resztaTrim: number };
type Wiersz = {
  rodzaj: string;
  wartosc: string;
  A: number;
  swieza: boolean;
  /** Wiersze tej wartości u MO6 — skan ich nie liczy, UPDATE i `uzycie` tak. */
  mo6: number;
  edycja: Pomiar;
  alias: (Pomiar & { kanoniczna: string }) | null;
};

/** Przyczyna A≠C — rozłączne klasy, sprawdzane w tej kolejności. */
function przyczynaAC(w: Wiersz): string {
  if (!w.swieza && w.edycja.C === 0)
    return "wartość zniknęła z products po skanie";
  if (w.A + w.mo6 === w.edycja.C)
    return "wiersze MO6 (skan pomija, UPDATE nie)";
  if (!w.swieza) return "migawka nieświeża (inne zmiany katalogu po skanie)";
  return "inna";
}

function pomiar(snapshot: string, tryb: "stan" | "czysty") {
  const katalog = mkdtempSync(join(tmpdir(), `bridge-75-pomiar-${tryb}-`));
  const sciezka = join(katalog, "data.db");
  copyFileSync(snapshot, sciezka);
  const { sqlite, db } = otworzBaze(sciezka);
  try {
    zastosujMigracje(sqlite, join(KORZEN, "rebuild", "schema"));
    if (tryb === "czysty") {
      sqlite.exec(`DELETE FROM atrybuty_wartosci_pending;
                   DELETE FROM atrybuty_wartosci;
                   DELETE FROM atrybuty_wartosci_odrzucone;`);
    }
    const pendingPrzedSkanem = (
      sqlite
        .prepare("SELECT COUNT(*) AS c FROM atrybuty_wartosci_pending")
        .get() as { c: number }
    ).c;
    // Znacznik skanu: pozycje, których skan NIE dotknął, mają starsze `ostatni_import`.
    const znacznikSkanu = (
      sqlite.prepare("SELECT datetime('now') AS t").get() as { t: string }
    ).t;
    const staty = skanujNoweWartosci(db);
    const pozycje = listaPending(db);

    /** Jedna akcja w transakcji wycofywanej: B przed, C z akcji, D przeliczone niezależnie. */
    function zmierz(
      rodzaj: string,
      kolumna: string,
      stara: string,
      nowa: string,
      akcja: () => number,
    ): Pomiar {
      const kol = sql.raw(kolumna);
      let wynik: Pomiar | undefined;
      try {
        sqlite.transaction(() => {
          if (!znanyRodzaj(rodzaj))
            throw new Error(`rodzaj spoza mapy słownika: ${rodzaj}`);
          const B = uzycieAtrybutu(db, rodzaj, stara).count;
          const idPrzed = new Set(
            db
              .all<{ id: number }>(
                sql`SELECT id FROM products WHERE ${kol} = ${nowa}`,
              )
              .map((w) => w.id),
          );
          const C = akcja();
          const idPo = db.all<{ id: number }>(
            sql`SELECT id FROM products WHERE ${kol} = ${nowa}`,
          );
          const D = idPo.filter((w) => !idPrzed.has(w.id)).length;
          // Wiersze, które PO akcji nadal niosą starą wartość z doklejonymi spacjami.
          const resztaTrim =
            db.get<{ c: number }>(
              sql`SELECT COUNT(*) AS c FROM products WHERE TRIM(${kol}) = ${stara} AND ${kol} != ${stara}`,
            )?.c ?? 0;
          wynik = { B, C, D, resztaTrim };
          throw new Wycofaj();
        })();
      } catch (e) {
        if (!(e instanceof Wycofaj)) throw e;
      }
      return wynik!;
    }

    const wiersze: Wiersz[] = [];
    const pominiete: Record<string, number> = {};
    for (const p of pozycje) {
      const kolumna = kolumnaRodzaju(p.rodzaj);
      if (!kolumna || !znanyRodzaj(p.rodzaj)) {
        pominiete[p.rodzaj] = (pominiete[p.rodzaj] ?? 0) + 1;
        continue;
      }
      const kol = sql.raw(kolumna);
      const mo6 =
        db.get<{ c: number }>(
          sql`SELECT COUNT(*) AS c FROM products WHERE ${kol} = ${p.wartosc} AND dostawca = 'MO6'`,
        )?.c ?? 0;

      const nowa = `${p.wartosc}__P73`;
      const edycja = zmierz(p.rodzaj, kolumna, p.wartosc, nowa, () =>
        akceptujZEdycja(db, {
          id: p.id,
          rodzaj: p.rodzaj,
          kolumna,
          stara: p.wartosc,
          nowa,
        }),
      );

      // Kanoniczna: pierwsza sugestia (to podsuwa UI), inaczej pierwsza inna wartość słownika.
      const kanoniczna =
        p.sugerowane_aliasy[0]?.wartosc ??
        db.get<{ wartosc: string }>(
          sql`SELECT wartosc FROM atrybuty_wartosci WHERE rodzaj = ${p.rodzaj} AND wartosc != ${p.wartosc} ORDER BY id LIMIT 1`,
        )?.wartosc;
      const alias =
        tryb === "czysty" || kanoniczna === undefined
          ? null
          : {
              ...zmierz(p.rodzaj, kolumna, p.wartosc, kanoniczna, () =>
                akceptujJakoAlias(db, {
                  id: p.id,
                  kolumna,
                  stara: p.wartosc,
                  kanoniczna,
                }),
              ),
              kanoniczna,
            };

      wiersze.push({
        rodzaj: p.rodzaj,
        wartosc: p.wartosc,
        A: p.ile_wystapien,
        swieza: p.ostatni_import >= znacznikSkanu,
        mo6,
        edycja,
        alias,
      });
    }

    // ————————————————————————— agregacja per rodzaj —————————————————————————
    const tabela: Record<string, Record<string, number>> = {};
    for (const w of wiersze) {
      const r = (tabela[w.rodzaj] ??= {
        pozycji: 0,
        swiezych: 0,
        "A≠C": 0,
        "B≠C edycja": 0,
        "C≠D edycja": 0,
        "z aliasem": 0,
        "B≠C alias": 0,
        "C≠D alias": 0,
        "alias na samą siebie": 0,
      });
      r.pozycji!++;
      if (w.swieza) r.swiezych!++;
      if (w.A !== w.edycja.C) r["A≠C"]!++;
      if (w.edycja.B !== w.edycja.C) r["B≠C edycja"]!++;
      if (w.edycja.C !== w.edycja.D) r["C≠D edycja"]!++;
      if (w.alias) {
        r["z aliasem"]!++;
        if (w.alias.B !== w.alias.C) r["B≠C alias"]!++;
        if (w.alias.C !== w.alias.D) r["C≠D alias"]!++;
        if (w.alias.kanoniczna === w.wartosc) r["alias na samą siebie"]!++;
      }
    }

    const rozjazdyAC = wiersze.filter((w) => w.A !== w.edycja.C);
    const przyczyny: Record<string, { liczba: number; przyklady: unknown[] }> =
      {};
    for (const w of rozjazdyAC) {
      const k = przyczynaAC(w);
      const wpis = (przyczyny[k] ??= { liczba: 0, przyklady: [] });
      wpis.liczba++;
      if (wpis.przyklady.length < PRZYKLADOW) {
        wpis.przyklady.push({
          rodzaj: w.rodzaj,
          wartosc: w.wartosc,
          A: w.A,
          B: w.edycja.B,
          C: w.edycja.C,
          mo6: w.mo6,
        });
      }
    }
    const przyklad = (w: Wiersz) => ({
      rodzaj: w.rodzaj,
      wartosc: w.wartosc,
      A: w.A,
      edycja: w.edycja,
      alias: w.alias,
    });

    return {
      tryb,
      pendingPrzedSkanem,
      staty,
      pozycjiPoSkanie: pozycje.length,
      pominiete,
      tabela,
      sumaRozjazdow: {
        "A≠C": rozjazdyAC.length,
        "A≠C wśród świeżych": rozjazdyAC.filter((w) => w.swieza).length,
        "B≠C": wiersze.filter(
          (w) =>
            w.edycja.B !== w.edycja.C || (w.alias && w.alias.B !== w.alias.C),
        ).length,
        "C≠D": wiersze.filter(
          (w) =>
            w.edycja.C !== w.edycja.D || (w.alias && w.alias.C !== w.alias.D),
        ).length,
        "C≠D poza aliasem na samą siebie": wiersze.filter(
          (w) =>
            w.edycja.C !== w.edycja.D ||
            (w.alias &&
              w.alias.kanoniczna !== w.wartosc &&
              w.alias.C !== w.alias.D),
        ).length,
        "reszta po TRIM": wiersze.filter((w) => w.edycja.resztaTrim > 0).length,
      },
      przyczynyAC: przyczyny,
      przykladyBC: wiersze
        .filter(
          (w) =>
            w.edycja.B !== w.edycja.C || (w.alias && w.alias.B !== w.alias.C),
        )
        .slice(0, PRZYKLADOW)
        .map(przyklad),
      przykladyAliasNaSiebie: wiersze
        .filter(
          (w) => w.alias && w.alias.kanoniczna === w.wartosc && w.alias.C > 0,
        )
        .slice(0, PRZYKLADOW)
        .map(przyklad),
      przykladyResztaTrim: wiersze
        .filter((w) => w.edycja.resztaTrim > 0)
        .slice(0, PRZYKLADOW)
        .map(przyklad),
    };
  } finally {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  }
}

const snapshot = znajdzSnapshot();
const wynik = {
  snapshot: snapshot
    .replace(KORZEN, "<repo>")
    .replace(/^.*\/db\/snapshot\.db$/, "<repo>/db/snapshot.db"),
  warianty: [pomiar(snapshot, "stan"), pomiar(snapshot, "czysty")],
};
const plikWyniku = join(KATALOG_SKRYPTU, "pomiar-wynik.json");
writeFileSync(plikWyniku, `${JSON.stringify(wynik, null, 2)}\n`);
console.log(`Zapisano: ${plikWyniku}`);
for (const w of wynik.warianty) {
  console.log(`\n=== ${w.tryb} ===`);
  console.log(
    JSON.stringify({
      staty: w.staty,
      pozycji: w.pozycjiPoSkanie,
      pominiete: w.pominiete,
      suma: w.sumaRozjazdow,
    }),
  );
  console.table(w.tabela);
}
