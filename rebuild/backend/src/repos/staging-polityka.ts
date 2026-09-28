/**
 * Repozytorium sześciu tabel polityki stagingu — karta I15.4a (ticket 124).
 *
 * ODPOWIEDNIK: `mirror/backend/staging_policy.cjs` (`origin/main` @ 88fa31c, 665 l.) — ale WYŁĄCZNIE
 * jego warstwa dostępu do bazy. Każda funkcja niżej odtwarza DOKŁADNIE JEDNO zapytanie oryginału,
 * łącznie z klauzulą `ON CONFLICT`, i ma przy sobie numer linii, z której pochodzi.
 *
 * ⚠ ŚWIADOMIE BEZ LOGIKI DECYZYJNEJ. Nic tu nie rozstrzyga, czy produkt wstrzymać, czy ofertę uznać
 * za kompletną, ani czy minęły 24 godziny — to zakres kart I15.4b (importer) i I15.4c (akceptacja
 * i trasy). Sygnatury są tak dobrane, żeby obie mogły z nich korzystać BEZ zmian w tym pliku
 * (decyzja D-124.1 użytkownika, 2026-09-23).
 *
 * ⚠ KLAUZULE `ON CONFLICT` SĄ CZĘŚCIĄ ZACHOWANIA, nie szczegółem zapisu. Trzy różne upserty na
 * `staging_absence_decisions` mają tu trzy osobne funkcje właśnie dlatego, że różnią się
 * traktowaniem `selected_source_code` — sklejenie ich w jedną zgubiłoby różnicę.
 *
 * ⚠ Te tabele NIE zasilają żadnej odpowiedzi HTTP (trasy wnosi I15.4c), więc camelCase pól modelu
 * jest tu bezpieczny. Trasa zbudowana na tych funkcjach musi mieć WŁASNĄ jawną projekcję pod
 * fixture (CLAUDE.md: `select()` bez listy pól oddaje nazwy PÓL, fixture ma nazwy KOLUMN).
 */
import { and, eq, sql } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import {
  productAbsenceChecks,
  productAutoSuspensions,
  stagingAbsenceDecisions,
  stagingMatches,
  supplierFeedState,
  supplierFeedVersions,
} from "../db/schema.js";

// ───────────────────────────── staging_matches (backlog #99) ─────────────────────────────

export type DopasowanieStagingu = typeof stagingMatches.$inferSelect;

/**
 * Świadome dopasowanie zapamiętane dla pary dostawca + klucz źródłowy — `staging_policy.cjs:137`
 * (zmienna `aliases`), czytane w `:369`.
 *
 * ⚠ Nazwa `aliases` w oryginale jest w liczbie mnogiej, ale zapytanie woła się przez `.get()`,
 * czyli oddaje JEDEN wiersz — i tak musi być, bo `(supplier, source_key)` to klucz główny.
 */
export function dopasowanieStagingu(db: Baza, dostawca: string, kluczZrodlowy: string): string | undefined {
  return db
    .select({ productCode: stagingMatches.productCode })
    .from(stagingMatches)
    .where(and(eq(stagingMatches.supplier, dostawca), eq(stagingMatches.sourceKey, kluczZrodlowy)))
    .get()?.productCode;
}

/**
 * Zapamiętanie świadomego dopasowania — `staging_policy.cjs:224` i `:305`, oba w identycznej treści:
 * `ON CONFLICT(supplier,source_key) DO UPDATE SET product_code=excluded.product_code,created_at=excluded.created_at`.
 */
export function zapiszDopasowanieStagingu(
  db: Baza,
  dostawca: string,
  kluczZrodlowy: string,
  kodProduktu: string,
  utworzono: string,
): void {
  db.insert(stagingMatches)
    .values({ supplier: dostawca, sourceKey: kluczZrodlowy, productCode: kodProduktu, createdAt: utworzono })
    .onConflictDoUpdate({
      target: [stagingMatches.supplier, stagingMatches.sourceKey],
      set: { productCode: sql`excluded.product_code`, createdAt: sql`excluded.created_at` },
    })
    .run();
}

// ──────────────────── supplier_feed_state / _versions (backlog #103) ────────────────────

export type StanOfertyDostawcy = typeof supplierFeedState.$inferSelect;

/** Stan ostatniej oferty dostawcy — `staging_policy.cjs:455` (`SELECT * … .get()`). */
export function stanOfertyDostawcy(db: Baza, dostawca: string): StanOfertyDostawcy | undefined {
  return db.select().from(supplierFeedState).where(eq(supplierFeedState.supplier, dostawca)).get();
}

/**
 * Zapis stanu oferty — `staging_policy.cjs:522-525`.
 *
 * ⚠ `maxItemCount` przy konflikcie idzie przez `MAX(supplier_feed_state.max_item_count, excluded.…)`,
 * czyli **nigdy nie maleje**: to szczyt historyczny, po którym poznaje się ofertę „mniejszą o ponad
 * 20%". Podmiana tego na zwykłe `excluded.max_item_count` wyłączyłaby blokadę źródła — oryginał
 * dodatkowo podaje w parametrze już policzone `Math.max(itemCount, feedState?.max_item_count||0)`,
 * więc zabezpieczenie jest podwójne i oba zostają.
 */
export function zapiszStanOfertyDostawcy(db: Baza, stan: typeof supplierFeedState.$inferInsert): void {
  db.insert(supplierFeedState)
    .values(stan)
    .onConflictDoUpdate({
      target: supplierFeedState.supplier,
      set: {
        lastIdentityHash: sql`excluded.last_identity_hash`,
        lastItemCount: sql`excluded.last_item_count`,
        maxItemCount: sql`MAX(${supplierFeedState.maxItemCount}, excluded.max_item_count)`,
        updatedAt: sql`excluded.updated_at`,
        lastCountedAt: sql`excluded.last_counted_at`,
      },
    })
    .run();
}

/** Czy taki odcisk oferty już się liczył — `staging_policy.cjs:463` (`SELECT 1 … .get()`). */
export function czyZnanaWersjaOferty(db: Baza, dostawca: string, odcisk: string): boolean {
  return (
    db
      .select({ jest: sql<number>`1` })
      .from(supplierFeedVersions)
      .where(and(eq(supplierFeedVersions.supplier, dostawca), eq(supplierFeedVersions.fingerprint, odcisk)))
      .get() !== undefined
  );
}

/**
 * Odnotowanie nowej kompletnej oferty — `staging_policy.cjs:526`.
 *
 * ⚠ GOŁY `INSERT`, bez `ON CONFLICT` — wiernie. Oryginał woła to wyłącznie pod warunkiem
 * `distinctCompleteFeed`, który jest prawdziwy tylko wtedy, gdy `czyZnanaWersjaOferty()` było
 * fałszem. Dołożenie tu `ON CONFLICT DO NOTHING` zamaskowałoby błąd wołającego, więc tego nie robimy.
 */
export function zapiszWersjeOferty(db: Baza, dostawca: string, odcisk: string, policzonoO: string): void {
  db.insert(supplierFeedVersions)
    .values({ supplier: dostawca, fingerprint: odcisk, countedAt: policzonoO })
    .run();
}

// ─────────────────────── product_absence_checks (backlog #103) ───────────────────────

/**
 * Zapisane dowody nieobecności — `staging_policy.cjs:598`. Oddaje surowy JSON; rozpakowanie
 * i liczenie potwierdzeń należy do I15.4b.
 */
export function dowodyNieobecnosci(db: Baza, dostawca: string, kodProduktu: string): string | undefined {
  return db
    .select({ checksJson: productAbsenceChecks.checksJson })
    .from(productAbsenceChecks)
    .where(and(eq(productAbsenceChecks.supplier, dostawca), eq(productAbsenceChecks.productCode, kodProduktu)))
    .get()?.checksJson;
}

/** Zapis dowodów nieobecności — `staging_policy.cjs:602`. */
export function zapiszDowodyNieobecnosci(
  db: Baza,
  dostawca: string,
  kodProduktu: string,
  dowodyJson: string,
): void {
  db.insert(productAbsenceChecks)
    .values({ supplier: dostawca, productCode: kodProduktu, checksJson: dowodyJson })
    .onConflictDoUpdate({
      target: [productAbsenceChecks.supplier, productAbsenceChecks.productCode],
      set: { checksJson: sql`excluded.checks_json` },
    })
    .run();
}

/** Skasowanie dowodów — `staging_policy.cjs:467` (`clearAbsence`, wołane w :507, :533, :542, :560, :579, :594). */
export function usunDowodyNieobecnosci(db: Baza, dostawca: string, kodProduktu: string): void {
  db.delete(productAbsenceChecks)
    .where(and(eq(productAbsenceChecks.supplier, dostawca), eq(productAbsenceChecks.productCode, kodProduktu)))
    .run();
}

// ─────────────────────── product_auto_suspensions (backlog #104) ───────────────────────

/**
 * Czy produkt jest wstrzymany AUTOMATYCZNIE — `staging_policy.cjs:111` (`autoMarker`) i `:468`
 * (`autoSuspension`); oba zapytania są identyczne. Brak wiersza znaczy „wstrzymanie ręczne albo
 * brak wstrzymania" — i to właśnie chroni ręczne decyzje Ani przed automatycznym odwstrzymaniem.
 */
export function czyAutomatycznieWstrzymany(db: Baza, dostawca: string, kodProduktu: string): boolean {
  return (
    db
      .select({ jest: sql<number>`1` })
      .from(productAutoSuspensions)
      .where(
        and(eq(productAutoSuspensions.supplier, dostawca), eq(productAutoSuspensions.productCode, kodProduktu)),
      )
      .get() !== undefined
  );
}

/**
 * Odnotowanie automatycznego wstrzymania — `staging_policy.cjs:122-124`.
 *
 * ⚠ `suspended_at` NIE jest w `DO UPDATE`: ponowne wstrzymanie tego samego produktu **nie przesuwa**
 * daty pierwszego wstrzymania, aktualizują się tylko `source_fingerprint` i `reason`. To wierny
 * szczegół oryginału — data służy za punkt odniesienia, jak długo produktu nie ma w ofercie.
 */
export function zapiszAutomatyczneWstrzymanie(
  db: Baza,
  dostawca: string,
  kodProduktu: string,
  wstrzymanoO: string,
  odcisk: string | null,
  powod: string,
): void {
  db.insert(productAutoSuspensions)
    .values({
      supplier: dostawca,
      productCode: kodProduktu,
      suspendedAt: wstrzymanoO,
      sourceFingerprint: odcisk,
      reason: powod,
    })
    .onConflictDoUpdate({
      target: [productAutoSuspensions.supplier, productAutoSuspensions.productCode],
      set: { sourceFingerprint: sql`excluded.source_fingerprint`, reason: sql`excluded.reason` },
    })
    .run();
}

/**
 * Zdjęcie automatycznego wstrzymania — `staging_policy.cjs:469` (`clearSuspension`) oraz identyczne
 * `DELETE` w `:116`, `:218`, `:302`, `:318`.
 */
export function usunAutomatyczneWstrzymanie(db: Baza, dostawca: string, kodProduktu: string): void {
  db.delete(productAutoSuspensions)
    .where(and(eq(productAutoSuspensions.supplier, dostawca), eq(productAutoSuspensions.productCode, kodProduktu)))
    .run();
}

// ─────────────────────── staging_absence_decisions (backlog #106) ───────────────────────

/**
 * Zamknięta sprawa nieobecnej karty — `staging_policy.cjs:544` i `:567`. Oddaje sam
 * `candidates_hash`, bo po nim wołający poznaje, czy sprawa ma się otworzyć ponownie
 * (zmienił się kod, EAN albo DOT któregoś kandydata).
 */
export function decyzjaONieobecnej(db: Baza, dostawca: string, kodProduktu: string): string | undefined {
  return db
    .select({ candidatesHash: stagingAbsenceDecisions.candidatesHash })
    .from(stagingAbsenceDecisions)
    .where(
      and(eq(stagingAbsenceDecisions.supplier, dostawca), eq(stagingAbsenceDecisions.productCode, kodProduktu)),
    )
    .get()?.candidatesHash;
}

/**
 * Karta, do której przypisano wskazany kod źródłowy dostawcy — `staging_policy.cjs:358`
 * (`manualChoice`). Zapytanie idzie po `selected_source_code`, czyli po kolumnie z indeksu
 * częściowego `staging_absence_one_choice`.
 */
export function kodProduktuDlaWybranegoZrodla(
  db: Baza,
  dostawca: string,
  wybranyKodZrodlowy: string,
): string | undefined {
  return db
    .select({ productCode: stagingAbsenceDecisions.productCode })
    .from(stagingAbsenceDecisions)
    .where(
      and(
        eq(stagingAbsenceDecisions.supplier, dostawca),
        eq(stagingAbsenceDecisions.selectedSourceCode, wybranyKodZrodlowy),
      ),
    )
    .get()?.productCode;
}

/**
 * „Pozostaw starą wstrzymaną i zamknij sprawę" — `staging_policy.cjs:261-263`.
 *
 * ⚠ `selected_source_code` NIE jest w `DO UPDATE` i nie ma go wśród wstawianych kolumn: przy
 * pierwszym zapisie zostaje NULL-em, a przy powtórnym **zachowuje dotychczasową wartość**. To
 * odróżnia tę funkcję od `zapiszWyborBiezacejKarty()`, która tę samą kolumnę jawnie zeruje.
 */
export function zamknijSpraweNieobecnej(
  db: Baza,
  dostawca: string,
  kodProduktu: string,
  hashKandydatow: string,
  zdecydowanoO: string,
): void {
  db.insert(stagingAbsenceDecisions)
    .values({
      supplier: dostawca,
      productCode: kodProduktu,
      candidatesHash: hashKandydatow,
      decidedAt: zdecydowanoO,
    })
    .onConflictDoUpdate({
      target: [stagingAbsenceDecisions.supplier, stagingAbsenceDecisions.productCode],
      set: { candidatesHash: sql`excluded.candidates_hash`, decidedAt: sql`excluded.decided_at` },
    })
    .run();
}

/**
 * Wskazanie karty z bieżącej oferty jako odpowiednika starej — `staging_policy.cjs:308-311`.
 * Zapamiętany `selected_source_code` sprawia, że kolejny import rozpozna kod dostawcy jako
 * należący do tej właśnie karty (patrz `kodProduktuDlaWybranegoZrodla`).
 */
export function zapiszWyborKartyZrodlowej(
  db: Baza,
  dostawca: string,
  kodProduktu: string,
  hashKandydatow: string,
  zdecydowanoO: string,
  wybranyKodZrodlowy: string,
): void {
  db.insert(stagingAbsenceDecisions)
    .values({
      supplier: dostawca,
      productCode: kodProduktu,
      candidatesHash: hashKandydatow,
      decidedAt: zdecydowanoO,
      selectedSourceCode: wybranyKodZrodlowy,
    })
    .onConflictDoUpdate({
      target: [stagingAbsenceDecisions.supplier, stagingAbsenceDecisions.productCode],
      set: {
        candidatesHash: sql`excluded.candidates_hash`,
        decidedAt: sql`excluded.decided_at`,
        selectedSourceCode: sql`excluded.selected_source_code`,
      },
    })
    .run();
}

/**
 * Wybór karty BIEŻĄCEJ (stara zostaje wstrzymana) — `staging_policy.cjs:322-325`.
 *
 * ⚠ `selected_source_code` jest jawnie zerowany: i przy wstawieniu (`VALUES(?,?,?,?,NULL)`),
 * i przy konflikcie (`DO UPDATE SET selected_source_code=NULL`) — a nie brany z `excluded`.
 * Dzięki temu wcześniejsze przypisanie kodu źródłowego zostaje zdjęte i zwalnia miejsce
 * w indeksie `staging_absence_one_choice`.
 */
export function zapiszWyborBiezacejKarty(
  db: Baza,
  dostawca: string,
  kodProduktu: string,
  hashKandydatow: string,
  zdecydowanoO: string,
): void {
  db.insert(stagingAbsenceDecisions)
    .values({
      supplier: dostawca,
      productCode: kodProduktu,
      candidatesHash: hashKandydatow,
      decidedAt: zdecydowanoO,
      selectedSourceCode: null,
    })
    .onConflictDoUpdate({
      target: [stagingAbsenceDecisions.supplier, stagingAbsenceDecisions.productCode],
      set: {
        candidatesHash: sql`excluded.candidates_hash`,
        decidedAt: sql`excluded.decided_at`,
        selectedSourceCode: sql`NULL`,
      },
    })
    .run();
}

/** Ponowne otwarcie sprawy — `staging_policy.cjs:550`. */
export function usunDecyzjeONieobecnej(db: Baza, dostawca: string, kodProduktu: string): void {
  db.delete(stagingAbsenceDecisions)
    .where(
      and(eq(stagingAbsenceDecisions.supplier, dostawca), eq(stagingAbsenceDecisions.productCode, kodProduktu)),
    )
    .run();
}
