/**
 * POMIAR KOLEJKI ATRYBUTÓW PRZED I PO P7.2 — ticket `78-FEATURE-seed-bieznikow-podobienstwo`.
 *
 * Na kopii `db/snapshot.db` (po migracjach odbudowy) liczy:
 *   1. słownik `bieznik`: skąd pochodzą wartości (`products.model` / `products.bieznik` / żadna),
 *   2. kolejkę i sugestie „PRZED" — stan snapshotu, sugestie liczone WZOREM ORYGINAŁU
 *      (`pending_module.cjs:41-72`, surowe napisy, napis identyczny przechodzi),
 *   3. „PO STARCIE" — to, co robi `stworzApp` po wdrożeniu: seed (`zasiejSlownikAtrybutow`,
 *      już z `products.bieznik`) i `usunZKolejkiObecneWSlowniku`, potem `listaPending` z kodu,
 *   4. „PO STARCIE I SKANIE" — jak wyżej plus `skanujNoweWartosci` (pierwszy import po wdrożeniu).
 *
 * Wzór oryginału jest tu przepisany dosłownie, bo kod rebuildu ma już regułę po odstępstwie
 * (#40, #42) — w jednym procesie nie da się wołać obu wersji `czySugerowacAlias`.
 *
 * Uruchomienie (Node ≥ 20, z `rebuild/backend/`; NODE_PATH, bo skrypt leży poza pakietem):
 *   NODE_PATH=$PWD/node_modules npx tsx ../../docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/pomiar-kolejki.ts
 * Snapshot: `BRIDGE_SNAPSHOT=/sciezka` albo `db/snapshot.db` w worktree lub w głównym repo.
 * Wynik: `pomiar-wynik.json` obok skryptu.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import { otworzBaze } from "../../../rebuild/backend/src/db/index.js";
import { zastosujMigracje } from "../../../rebuild/backend/src/db/migrate.js";
import { zasiejSlownikAtrybutow } from "../../../rebuild/backend/src/repos/atrybuty.js";
import {
  levenshtein,
  listaPending,
  skanujNoweWartosci,
  usunZKolejkiObecneWSlowniku,
} from "../../../rebuild/backend/src/repos/atrybuty-pending.js";

const KATALOG_SKRYPTU = dirname(fileURLToPath(import.meta.url));
const KORZEN = resolve(KATALOG_SKRYPTU, "../../..");

function znajdzSnapshot(): string {
  const kandydaci: string[] = [];
  if (process.env.BRIDGE_SNAPSHOT) kandydaci.push(resolve(process.env.BRIDGE_SNAPSHOT));
  kandydaci.push(join(KORZEN, "db", "snapshot.db"));
  try {
    const wspolny = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: KORZEN,
      encoding: "utf8",
    }).trim();
    kandydaci.push(join(dirname(wspolny), "db", "snapshot.db"));
  } catch {
    /* nie repo git */
  }
  const znaleziony = kandydaci.find((p) => existsSync(p));
  if (!znaleziony) throw new Error(`Nie znaleziono db/snapshot.db. Sprawdzone: ${kandydaci.join(", ")}`);
  return znaleziony;
}

/** Wzór oryginału (`pending_module.cjs:57-72`) — surowe napisy, napis identyczny przechodzi. */
function podobienstwoOryginal(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}
function czySugerowacOryginal(nowa: string, kanoniczna: string): boolean {
  if (podobienstwoOryginal(nowa, kanoniczna) < 0.9) return false;
  if (nowa.replace(/\+/g, "") === kanoniczna.replace(/\+/g, "") && nowa !== kanoniczna) return false;
  return true;
}

type Sqlite = InstanceType<typeof Database>;
const liczbaWg = (sqlite: Sqlite, zapytanie: string) =>
  Object.fromEntries(
    (sqlite.prepare(zapytanie).all() as { k: string; n: number }[]).map((r) => [r.k, r.n]),
  );

async function main() {
  const snapshot = znajdzSnapshot();
  const katalog = mkdtempSync(join(tmpdir(), "bridge-78-pomiar-"));
  const sciezka = join(katalog, "data.db");
  // `backup`, nie kopia pliku — snapshot ma plik WAL
  const zrodlo = new Database(snapshot, { readonly: true });
  await zrodlo.backup(sciezka);
  zrodlo.close();

  const { sqlite, db } = otworzBaze(sciezka);
  try {
    zastosujMigracje(sqlite, join(KORZEN, "rebuild", "schema"));

    // — 1. słownik `bieznik` —
    const zbior = (kol: string) =>
      new Set(
        (sqlite
          .prepare(`SELECT DISTINCT ${kol} AS v FROM products WHERE ${kol} IS NOT NULL AND ${kol} != ''`)
          .all() as { v: string }[]).map((r) => r.v),
      );
    const zModel = zbior("model");
    const zBieznik = zbior("bieznik");
    const slownikBieznik = (sqlite
      .prepare("SELECT wartosc FROM atrybuty_wartosci WHERE rodzaj = 'bieznik'")
      .all() as { wartosc: string }[]).map((r) => r.wartosc);
    const slownikZbior = new Set(slownikBieznik);
    const pochodzenie = { wObu: 0, tylkoModel: 0, tylkoBieznik: 0, zadna: [] as string[] };
    for (const w of slownikBieznik) {
      const m = zModel.has(w);
      const b = zBieznik.has(w);
      if (m && b) pochodzenie.wObu++;
      else if (m) pochodzenie.tylkoModel++;
      else if (b) pochodzenie.tylkoBieznik++;
      else pochodzenie.zadna.push(w);
    }
    const tylkoWModel = [...zModel].filter((w) => !zBieznik.has(w));
    const slownik = {
      wartosci: slownikBieznik.length,
      pochodzenie,
      recznieDodane_audit: (sqlite
        .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE akcja = 'atrybut_wartosc_dodano'")
        .get() as { n: number }).n,
      produktyModelRoznyOdBieznik: (sqlite
        .prepare("SELECT COUNT(*) AS n FROM products WHERE COALESCE(model,'') <> COALESCE(bieznik,'')")
        .get() as { n: number }).n,
      wartosciTylkoWModel: tylkoWModel.length,
      wartosciTylkoWModelObecneWSlowniku: tylkoWModel.filter((w) => slownikZbior.has(w)).length,
    };

    // — 2. PRZED —
    const pozycjePrzed = sqlite
      .prepare("SELECT rodzaj, wartosc FROM atrybuty_wartosci_pending")
      .all() as { rodzaj: string; wartosc: string }[];
    const kandydaci = new Map<string, string[]>();
    for (const r of sqlite.prepare("SELECT rodzaj, wartosc FROM atrybuty_wartosci").all() as {
      rodzaj: string;
      wartosc: string;
    }[]) {
      kandydaci.set(r.rodzaj, [...(kandydaci.get(r.rodzaj) ?? []), r.wartosc]);
    }
    let przedZSugestia = 0;
    let przedSelf = 0;
    const paryPrzed = new Set<string>();
    for (const p of pozycjePrzed) {
      const sug = (kandydaci.get(p.rodzaj) ?? [])
        .filter((k) => czySugerowacOryginal(p.wartosc, k))
        .map((k) => ({ k, s: Math.round(podobienstwoOryginal(p.wartosc, k) * 100) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 5);
      if (sug.length) przedZSugestia++;
      if (sug[0]?.k === p.wartosc) przedSelf++;
      for (const s of sug) paryPrzed.add(`${p.rodzaj}\u0000${p.wartosc}\u0000${s.k}`);
    }
    const przed = {
      pozycji: pozycjePrzed.length,
      wgRodzaju: liczbaWg(sqlite, "SELECT rodzaj AS k, COUNT(*) AS n FROM atrybuty_wartosci_pending GROUP BY rodzaj"),
      obecnychWSlowniku: liczbaWg(
        sqlite,
        `SELECT p.rodzaj AS k, COUNT(*) AS n FROM atrybuty_wartosci_pending p
         JOIN atrybuty_wartosci w ON w.rodzaj = p.rodzaj AND w.wartosc = p.wartosc GROUP BY p.rodzaj`,
      ),
      pozycjiZSugestia: przedZSugestia,
      pozycjiZSelfMatchemNaSzczycie: przedSelf,
      sugestii: paryPrzed.size,
    };

    // — 3. PO STARCIE —
    const slownikPrzedSeedem = liczbaWg(sqlite, "SELECT rodzaj AS k, COUNT(*) AS n FROM atrybuty_wartosci GROUP BY rodzaj");
    zasiejSlownikAtrybutow(db);
    const slownikPoSeedzie = liczbaWg(sqlite, "SELECT rodzaj AS k, COUNT(*) AS n FROM atrybuty_wartosci GROUP BY rodzaj");
    const usunieteNaStarcie = usunZKolejkiObecneWSlowniku(db);

    const opisz = () => {
      const lista = listaPending(db);
      const nowe: string[] = [];
      let sugestii = 0;
      let self = 0;
      for (const p of lista) {
        for (const s of p.sugerowane_aliasy) {
          sugestii++;
          if (s.wartosc === p.wartosc) self++;
          if (!paryPrzed.has(`${p.rodzaj}\u0000${p.wartosc}\u0000${s.wartosc}`)) {
            nowe.push(`${p.rodzaj}: „${p.wartosc}" → „${s.wartosc}" ${s.podobienstwo}% (wystąpień ${p.ile_wystapien})`);
          }
        }
      }
      return {
        pozycji: lista.length,
        wgRodzaju: liczbaWg(sqlite, "SELECT rodzaj AS k, COUNT(*) AS n FROM atrybuty_wartosci_pending GROUP BY rodzaj"),
        pozycjiZSugestia: lista.filter((p) => p.sugerowane_aliasy.length).length,
        sugestii,
        selfMatchy: self,
        nowychPar: nowe.length,
        nowePary: nowe,
      };
    };
    const poStarcie = {
      usunieto: usunieteNaStarcie,
      dosianoDoSlownika: Object.fromEntries(
        Object.entries(slownikPoSeedzie)
          .map(([k, n]) => [k, n - (slownikPrzedSeedem[k] ?? 0)])
          .filter(([, d]) => d !== 0),
      ),
      ...opisz(),
    };

    // — 4. PO STARCIE I SKANIE —
    const staty = skanujNoweWartosci(db);
    const poSkanie = { staty, ...opisz() };

    // — ALLIANCE / Alliance (#92) —
    const alliance = {
      slownikMarka: (sqlite
        .prepare("SELECT wartosc FROM atrybuty_wartosci WHERE rodzaj = 'marka' AND LOWER(wartosc) = 'alliance'")
        .all() as { wartosc: string }[]).map((r) => r.wartosc),
      kolejkaPoZmianie: listaPending(db, "marka").filter((p) => p.wartosc.toLowerCase() === "alliance"),
    };

    const wynik = { snapshot, slownik, przed, poStarcie, poSkanie, alliance };
    writeFileSync(join(KATALOG_SKRYPTU, "pomiar-wynik.json"), JSON.stringify(wynik, null, 2) + "\n");
    console.log(JSON.stringify({ ...wynik, poStarcie: { ...poStarcie, nowePary: poStarcie.nowePary.slice(0, 20) }, poSkanie: { ...poSkanie, nowePary: poSkanie.nowePary.slice(0, 20) } }, null, 2));
  } finally {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
