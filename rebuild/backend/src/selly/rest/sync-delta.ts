/**
 * TOR 1: szybki delta sync — port `origin/main:mirror/backend/selly/sync_delta.cjs`
 * (karta I15.6, ticket 108; produkcja zamrożona na 7d6cfc9).
 *
 * Aktualizuje TYLKO cenę i stan pozycji zmienionych od ostatniej wysyłki:
 * `PUT /api/products/{pid}/variants/{vid}` z ciałem `{quantity, price}`. Nazw, kategorii i cech
 * NIE rusza — to robi nocny `sync_full` (Tor 2, karta I15.7). Brakujące mapowania uzupełnia
 * leniwie `discovery.ensureMapping` — ale BEZ słowników, więc nowego produktu Tor 1 nie założy
 * (kończy się `pending_create`, backlog #68/#69).
 *
 * Wołający w oryginale: wyłącznie `scheduler_selly.cjs` (`syncDelta`) — montaż harmonogramu
 * to karta I15.8. `routes_sync.cjs` importuje nieistniejące `syncDeltaForDostawca`; ta karta
 * eksportuje nazwę, którą oryginał naprawdę ma (`syncDelta`), a los tamtej trasy rozstrzyga I15.8.
 *
 * ⚠ `dryRun` pomija TYLKO PUT ceny/stanu. Discovery idzie normalnie i MOŻE utworzyć wariant
 * w Selly (`createVariant`) — tak działa oryginał (`sync_delta.cjs:137,151`). Twardą blokadą
 * zapisów jest `SELLY_TRYB=tylko-odczyt`, nie `dryRun`.
 */

import type { Baza } from "../../db/index.js";
import type { Discovery, WierszBridge, WynikMapowania } from "./discovery.js";

/** Wiersz `findDeltaProducts` — kolumny SQL-a, dlatego `snake_case`. */
export type WierszDelta = WierszBridge & {
  id: number;
  status: string;
  kod_importu: string;
  dostawca: string;
  nazwa: string | null;
  stan: number | null;
  cena_sprzedazy: number | null;
  cena_zakupu: number | null;
  vat_rate: number | null;
  selly_product_id: number | null;
  selly_variant_id: number | null;
  feature_id_magazyn: number | null;
  stan_wyslany: number | null;
  cena_sprzedazy_wyslana: number | null;
};

export type StatystykiDelta = {
  total: number;
  ok: number;
  err: number;
  skip: number;
  discovered: number;
  created: number;
  /**
   * Grupy `(dostawca, kod_importu)` z więcej niż jednym aktywnym produktem, napotkane w tym
   * biegu. Backlog #108 — patrz `grupyKolizyjne()`. Sama liczba; wysyłki NIE zmienia.
   */
  kolizje_kod_importu: number;
};

/** Grupa `(dostawca, kod_importu)` z >1 aktywnym produktem — raport do `selly_sync_log`. */
export type GrupaKolizyjna = {
  dostawca: string;
  kod_importu: string;
  liczba: number;
  rozne_ceny_lub_stany: boolean;
};

export type WynikSyncDelta = {
  stats: StatystykiDelta;
  errors: { kod: string; error: string }[];
  kolizje: GrupaKolizyjna[];
  logId: number;
};

/**
 * Port `findDeltaProducts()` (`:22-54`) — SQL verbatim, stan `origin/main:abe5f14`
 * (zmiana „dostępność”, 2026-09-22; karta I15.10, ticket 119).
 *
 * Backlog #77: `wstrzymany` wchodzi TYLKO z istniejącym wariantem i wysyła stan 0 (zerujemy
 * wariant w sklepie, ale nie zakładamy produktu, który nigdy nie był opublikowany).
 *
 * Backlog #104 wprowadza do tego warunku dwie zmiany:
 * 1. `wstrzymany` jest wykluczony, jeśli w TEJ SAMEJ grupie `(dostawca, kod_importu)` jest inna
 *    pozycja `aktywna` — inaczej zerowalibyśmy wariant, który druga oferta właśnie sprzedaje.
 * 2. EAN nie jest już bezwarunkowo wymagany: wiersz z GOTOWYM mapowaniem wariantu
 *    (`sp.selly_variant_id`) wchodzi bez EAN-u, bo wariant i tak trzeba zaktualizować.
 *    Bez mapowania EAN nadal jest konieczny (discovery nie ma po czym szukać).
 */
export function findDeltaProducts(db: Baza, dostawca: string | null = null, limit = 10000): WierszDelta[] {
  const where = [
    `(p.status = 'aktywny' OR (p.status = 'wstrzymany' AND sp.selly_variant_id IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM products active
                        WHERE active.dostawca = p.dostawca
                          AND active.kod_importu = p.kod_importu
                          AND active.status = 'aktywny')))`,
    "(sp.selly_variant_id IS NOT NULL OR (p.ean IS NOT NULL AND p.ean != ''))",
    "p.kod_importu IS NOT NULL",
    "p.kod_importu != ''",
  ];
  const params: (string | number)[] = [];
  if (dostawca) {
    where.push("p.dostawca = ?");
    params.push(dostawca);
  }
  const sql = `
    SELECT p.id, p.status, p.kod, p.kod_importu, p.dostawca, p.ean, p.nazwa,
           p.marka, p.kategoria,
           CASE WHEN p.status = 'wstrzymany' THEN 0 ELSE p.stan END AS stan,
           p.cena_sprzedazy, p.cena_zakupu, p.vat AS vat_rate,
           sp.selly_product_id, sp.selly_variant_id, sp.feature_id_magazyn,
           sp.stan_wyslany, sp.cena_sprzedazy_wyslana
    FROM products p
    LEFT JOIN selly_products sp ON sp.kod_importu = p.kod_importu AND sp.dostawca = p.dostawca
    WHERE ${where.join(" AND ")}
      AND (
        sp.selly_variant_id IS NULL
        OR sp.stan_wyslany IS NULL
        OR sp.stan_wyslany != CASE WHEN p.status = 'wstrzymany' THEN 0 ELSE p.stan END
        OR sp.cena_sprzedazy_wyslana IS NULL OR sp.cena_sprzedazy_wyslana != p.cena_sprzedazy
      )
    LIMIT ?
  `;
  params.push(limit);
  return db.$client.prepare(sql).all(...params) as WierszDelta[];
}

/**
 * Grupy `(dostawca, kod_importu)`, w których JEDEN dostawca ma więcej niż jeden aktywny produkt
 * — backlog #108. **Nie ma odpowiednika w oryginale**: to czysto raportowe rozszerzenie
 * dołożone w karcie I15.10 (ticket 119), które NIE zmienia tego, co Tor 1 wysyła.
 *
 * Po co: `markSynced()` kluczuje snapshot (`stan_wyslany`, `cena_sprzedazy_wyslana`) po
 * `kod_importu + dostawca`, więc dwa aktywne wiersze jednej grupy piszą do TEGO SAMEGO wiersza
 * `selly_products`. Każdy nadpisuje poprzedni, warunek delty znów widzi różnicę i obie pozycje
 * lecą w kółko przy każdym cyklu.
 *
 * ⚠ Celowo grupujemy po PARZE `(dostawca, kod_importu)`, nie po samym `kod_importu`. Ten sam
 * `kod_importu` u RÓŻNYCH dostawców to zamierzona wielomagazynowość Selly (potwierdziła Ania
 * 2026-09-23: jedna karta produktu, różne ceny i magazyny; różne EAN-y nie znaczą, że to inna
 * opona — klasyfikuje nazwa, model i indeksy). Tamten przypadek NIE jest kolizją i nie może
 * tu wpaść; odbudowa obsługuje go w `isMetadataOwner()` w Torze 2.
 */
export function grupyKolizyjne(db: Baza, dostawca: string | null = null): GrupaKolizyjna[] {
  const params: string[] = [];
  let filtr = "";
  if (dostawca) {
    filtr = " AND dostawca = ?";
    params.push(dostawca);
  }
  return db.$client
    .prepare(
      `SELECT dostawca, kod_importu, COUNT(*) AS liczba,
              CASE WHEN COUNT(DISTINCT IFNULL(stan, -1) || '/' || IFNULL(cena_sprzedazy, -1)) > 1
                   THEN 1 ELSE 0 END AS rozne
       FROM products
       WHERE status = 'aktywny' AND kod_importu IS NOT NULL AND kod_importu != ''${filtr}
       GROUP BY dostawca, kod_importu
       HAVING COUNT(*) > 1`,
    )
    .all(...params)
    .map((r) => {
      const w = r as { dostawca: string; kod_importu: string; liczba: number; rozne: number };
      return {
        dostawca: w.dostawca,
        kod_importu: w.kod_importu,
        liczba: w.liczba,
        rozne_ceny_lub_stany: w.rozne === 1,
      };
    });
}

/** Klucz grupy — `\u0000` nie wystąpi w żadnej z obu wartości. */
function kluczGrupy(dostawca: string | null, kodImportu: string | null): string {
  return `${dostawca ?? ""}\u0000${kodImportu ?? ""}`;
}

/** `logSyncStart` (`:59-66`) — `dostawca_kod = 'ALL'`, gdy bez filtra. */
function logSyncStart(db: Baza, dostawca: string | null): number {
  const info = db.$client
    .prepare(
      `INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip,
                                 rozpoczeto, status)
    VALUES ('sync_delta', ?, 0, 0, 0, datetime('now'), 'w_trakcie')`,
    )
    .run(dostawca || "ALL");
  return Number(info.lastInsertRowid);
}

/** `logSyncEnd` (`:68-75`) — szczegóły ucinane do 8000 znaków. */
function logSyncEnd(
  db: Baza,
  logId: number,
  ok: number,
  err: number,
  skip: number,
  details: unknown,
  status = "zakonczono",
): void {
  db.$client
    .prepare(
      `UPDATE selly_sync_log
    SET liczba_ok = ?, liczba_blad = ?, liczba_skip = ?,
        szczegoly_json = ?, zakonczono = datetime('now'), status = ?
    WHERE id = ?`,
    )
    .run(ok, err, skip, JSON.stringify(details).slice(0, 8000), status, logId);
}

/** `markSynced` (`:80-92`) — snapshot wysłanych wartości. */
function markSynced(db: Baza, row: WierszDelta, priceOk: boolean, stockOk: boolean): void {
  db.$client
    .prepare(
      `UPDATE selly_products
    SET stan_wyslany = ?, cena_sprzedazy_wyslana = ?, cena_zakupu_wyslana = ?,
        ostatnia_sync = datetime('now'), ostatni_status = 'ok', ostatni_blad = NULL
    WHERE kod_importu = ? AND dostawca = ?`,
    )
    .run(stockOk ? row.stan : null, priceOk ? row.cena_sprzedazy : null, row.cena_zakupu, row.kod_importu, row.dostawca);
}

/**
 * `markError` (`:94-106`). „Produkt nie istnieje w Selly” to `pending_create` (robota dla Toru 2),
 * reszta — `error`.
 *
 * ⚠ Backlog #69, odtworzone 1:1: sam `UPDATE` bez `INSERT`. Pozycja, która nie ma jeszcze
 * wiersza w `selly_products` (czyli właśnie ta, dla której discovery nic nie znalazło), nie
 * zostawia w bazie ŻADNEGO śladu — błąd jest tylko w `stats`/`errors` i w `selly_sync_log`.
 */
function markError(db: Baza, row: WierszDelta, error: unknown): void {
  const errStr = String(error);
  const isPendingCreate =
    errStr.includes("brak dictMaps do createProduct") || errStr.includes("produkt nie istnieje w Selly");
  const status = isPendingCreate ? "pending_create" : "error";
  db.$client
    .prepare(
      `UPDATE selly_products
    SET ostatnia_sync = datetime('now'), ostatni_status = ?, ostatni_blad = ?
    WHERE kod_importu = ? AND dostawca = ?`,
    )
    .run(status, errStr.slice(0, 500), row.kod_importu, row.dostawca);
}

/**
 * GŁÓWNA FUNKCJA — port `syncDelta(db, dostawca, opts)` (`:114-185`). Instancja discovery
 * jest argumentem, bo w oryginale to moduł współdzielony przez `require` (patrz nota
 * w `discovery.ts`).
 *
 * ⚠ Gałąź `else` po PUT (status spoza 2xx) jest w praktyce martwa: klient rzuca na non-2xx,
 * więc błąd HTTP trafia do `catch` z komunikatem `[Selly] HTTP …`. Zostaje, bo jest w oryginale.
 * ⚠ `stats.created` nigdy nie rośnie — tak jest w oryginale.
 */
export async function syncDelta(
  db: Baza,
  discovery: Discovery,
  dostawca: string | null = null,
  opts: { dryRun?: boolean; maxProducts?: number } = {},
): Promise<WynikSyncDelta> {
  const { dryRun = false, maxProducts = 5000 } = opts;
  const rows = findDeltaProducts(db, dostawca, maxProducts);
  const logId = logSyncStart(db, dostawca);

  const stats: StatystykiDelta = {
    total: rows.length,
    ok: 0,
    err: 0,
    skip: 0,
    discovered: 0,
    created: 0,
    kolizje_kod_importu: 0,
  };
  const errors: { kod: string; error: string }[] = [];

  // #108: grupy kolizyjne wykrywamy RAZ, jednym zapytaniem — zamiast pytać per wiersz.
  // Raportujemy tylko te, które faktycznie weszły do tego biegu.
  const wszystkieKolizje = new Map(grupyKolizyjne(db, dostawca).map((g) => [kluczGrupy(g.dostawca, g.kod_importu), g]));
  const kolizjeBiegu = new Map<string, GrupaKolizyjna>();

  console.log(`[sync_delta] Start: ${rows.length} produktow, dostawca=${dostawca || "ALL"}, dryRun=${dryRun}`);

  for (const row of rows) {
    try {
      // 0. #108: sam raport — wiersz leci dalej normalną ścieżką i ZOSTANIE wysłany.
      // Pomijanie takiej grupy zatrzymałoby pozycje, których dane Ania uznaje za poprawne
      // (wyjaśnienie z 2026-09-23), dlatego zawór z `wejscie-117.md` został wycofany.
      const klucz = kluczGrupy(row.dostawca, row.kod_importu);
      const kolizja = wszystkieKolizje.get(klucz);
      if (kolizja && !kolizjeBiegu.has(klucz)) {
        kolizjeBiegu.set(klucz, kolizja);
        stats.kolizje_kod_importu++;
      }

      // 1. Mapping — z JOIN-a albo przez discovery
      let mapping: WynikMapowania;
      if (row.selly_variant_id) {
        mapping = {
          product_id: row.selly_product_id ?? undefined,
          variant_id: row.selly_variant_id,
          feature_id_magazyn: row.feature_id_magazyn,
          action: "cache_hit",
        };
      } else {
        mapping = await discovery.ensureMapping(db, row);
        if (mapping.action === "found_variant" || mapping.action === "created_variant") {
          stats.discovered++;
        }
      }

      if (mapping.error || !mapping.variant_id) {
        stats.err++;
        errors.push({ kod: row.kod, error: mapping.error || "brak variant_id" });
        markError(db, row, mapping.error || "discovery: brak variant_id");
        continue;
      }

      // 2. Aktualizacja wariantu (quantity + price)
      //
      // Backlog #104 (`abe5f14`): import mógł wstrzymać pozycję W TRAKCIE tego biegu, kiedy
      // discovery szukało wariantów. Migawka sprzed pętli jest wtedy nieaktualna, więc stan
      // i cenę czytamy z bazy DOPIERO TERAZ. Komentarz oryginału: „Never send a stock captured
      // before suspension.”
      const live = db.$client
        .prepare("SELECT status, stan, cena_sprzedazy FROM products WHERE id = ?")
        .get(row.id) as { status: string; stan: number | null; cena_sprzedazy: number | null } | undefined;

      if (!live) {
        // Produkt zniknął z bazy w trakcie biegu — nie ma czego wysyłać.
        stats.skip++;
        continue;
      }

      if (live.status === "wstrzymany") {
        // Wstrzymany, ale grupa ma inną CZYNNĄ ofertę — zerowanie wariantu zabiłoby sprzedaż
        // tamtej pozycji, bo wariant w Selly jest wspólny dla grupy.
        const innaAktywna = db.$client
          .prepare("SELECT 1 FROM products WHERE dostawca = ? AND kod_importu = ? AND status = 'aktywny' LIMIT 1")
          .get(row.dostawca, row.kod_importu);
        if (innaAktywna) {
          stats.skip++;
          continue;
        }
        row.stan = 0;
      } else {
        row.stan = live.stan;
        row.cena_sprzedazy = live.cena_sprzedazy;
      }

      if (dryRun) {
        stats.skip++;
        console.log(
          `  [DRY] ${row.kod} -> pid=${mapping.product_id} vid=${mapping.variant_id} qty=${row.stan} price=${row.cena_sprzedazy}`,
        );
        continue;
      }

      const productId = mapping.product_id as number;
      const variantId = mapping.variant_id;
      const putRes = await discovery.apiWithRetry(`PUT /api/products/${productId}/variants/${variantId}`, async () => {
        const data = await discovery.klient.updateVariant(productId, variantId, {
          quantity: row.stan ?? 0,
          price: row.cena_sprzedazy ?? 0,
        });
        // Klient rzuca na non-2xx, więc dotarcie tutaj oznacza 2xx (`client.api` → `{status, data}`).
        return { status: 200, data };
      });

      if (putRes.status >= 200 && putRes.status < 300) {
        stats.ok++;
        markSynced(db, row, true, true);
      } else {
        stats.err++;
        const msg = `HTTP ${putRes.status}: ${JSON.stringify(putRes.data).slice(0, 200)}`;
        errors.push({ kod: row.kod, error: msg });
        markError(db, row, msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      stats.err++;
      errors.push({ kod: row.kod, error: msg });
      markError(db, row, msg);
    }
  }

  const kolizje = [...kolizjeBiegu.values()];

  logSyncEnd(
    db,
    logId,
    stats.ok,
    stats.err,
    stats.skip,
    { stats, kolizje: kolizje.slice(0, 20), sample_errors: errors.slice(0, 20) },
    stats.err > 0 && stats.ok === 0 ? "blad" : "zakonczono",
  );

  if (kolizje.length) {
    // #108: nie blokujemy wysyłki, ale zostawiamy ślad — inaczej pętla jest niewidoczna.
    console.warn(
      `[sync_delta] Kolizje kod_importu: ${kolizje.length} grup (ten sam dostawca, >1 aktywny produkt) ` +
        `— pozycje wysłane, snapshot współdzielony, patrz backlog #108`,
    );
  }

  console.log(
    `[sync_delta] Koniec: ok=${stats.ok}, err=${stats.err}, skip=${stats.skip}, discovered=${stats.discovered}`,
  );
  return { stats, errors, kolizje, logId };
}
