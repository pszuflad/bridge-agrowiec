import type { Baza, BazaSqlite } from "../db/index.js";

/**
 * Kroki wdrożenia — jednorazowe operacje na danych produkcji (zmiana nazw, założenie kont,
 * poprawka wartości), uruchamiane AUTOMATYCZNIE przez `tools/deploy-produkcja.sh` po merge'u do
 * `main`. Użytkownik nie uruchamia niczego ręcznie na serwerze.
 *
 * Czym różni się od migracji SQL (`rebuild/schema/*.sql`): krok jest kodem TS i może użyć logiki
 * aplikacji (np. `zahashujHaslo`, reguł nazw), a nie samego SQL.
 * Czym różni się od `npm run napraw-nazwy-sklejone` itp.: te biegną przy KAŻDYM wdrożeniu;
 * krok wdrożenia biegnie RAZ i zostaje zapisany w `kroki_wdrozenia`.
 */
export type KontekstKroku = {
  db: Baza;
  sqlite: BazaSqlite;
  env: NodeJS.ProcessEnv;
};

export type Krok = {
  /** Stały, unikalny, nigdy nie zmieniany po wdrożeniu (np. `2026-10-06-konta-erwin-anna`). */
  id: string;
  opis: string;
  /** Zmienne env (sekrety z `$PROD_ROOT/.env`). Brak którejkolwiek → krok POMINIĘTY, nie zapisany. */
  wymagaEnv?: string[];
  /** Zwrócony tekst trafia do `kroki_wdrozenia.wynik` i do logu wdrożenia. */
  uruchom: (ctx: KontekstKroku) => Promise<string | void>;
};

export type WynikKrokow = {
  wykonane: string[];
  juzWykonane: string[];
  pominieteBrakEnv: { id: string; brakuje: string[] }[];
};

const TABELA = "kroki_wdrozenia";

/**
 * Wykonuje kroki po kolei. Zasady:
 *  - krok zapisany w `kroki_wdrozenia` jest pomijany (raz = raz);
 *  - brak wymaganego env → pominięty BEZ zapisu, więc po dopisaniu sekretu wykona się przy
 *    następnym wdrożeniu (wdrożenie się nie wywala);
 *  - wyjątek w kroku PRZERYWA bieg i kroku nie zapisuje — wdrożenie staje przed podmianą
 *    release'u, a kopia bazy z `deploy-produkcja.sh` to punkt powrotu. Kroki muszą więc być
 *    odporne na ponowne uruchomienie po częściowym wykonaniu.
 */
export async function uruchomKroki(
  sqlite: BazaSqlite,
  db: Baza,
  kroki: Krok[],
  env: NodeJS.ProcessEnv,
  log: (linia: string) => void = () => {},
): Promise<WynikKrokow> {
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS ${TABELA} (
       id TEXT PRIMARY KEY,
       wykonano TEXT NOT NULL,
       wynik TEXT
     )`,
  );

  const ids = new Set<string>();
  for (const k of kroki) {
    if (ids.has(k.id))
      throw new Error(`Powtórzony id kroku wdrożenia: ${k.id}`);
    ids.add(k.id);
  }

  const zapisany = sqlite.prepare(`SELECT 1 FROM ${TABELA} WHERE id = ?`);
  const zapisz = sqlite.prepare(
    `INSERT INTO ${TABELA} (id, wykonano, wynik) VALUES (?, ?, ?)`,
  );
  const wynik: WynikKrokow = {
    wykonane: [],
    juzWykonane: [],
    pominieteBrakEnv: [],
  };

  for (const krok of kroki) {
    if (zapisany.get(krok.id)) {
      wynik.juzWykonane.push(krok.id);
      continue;
    }
    const brakuje = (krok.wymagaEnv ?? []).filter((nazwa) => !env[nazwa]);
    if (brakuje.length > 0) {
      log(`krok ${krok.id}: POMINIĘTY — brak w .env: ${brakuje.join(", ")}`);
      wynik.pominieteBrakEnv.push({ id: krok.id, brakuje });
      continue;
    }
    log(`krok ${krok.id}: ${krok.opis}`);
    const rezultat = (await krok.uruchom({ db, sqlite, env })) ?? "";
    zapisz.run(krok.id, new Date().toISOString(), rezultat);
    log(`krok ${krok.id}: gotowe${rezultat ? ` — ${rezultat}` : ""}`);
    wynik.wykonane.push(krok.id);
  }
  return wynik;
}
