// Dziennik zmian produktu — tabela `history` (Drizzle: `Wa`, backend-index.cjs:43833).
//
// ⚠ TRZY PODOBNE TABELE, ŁATWO O POMYŁKĘ — w tym katalogu leżą obok siebie:
//
//   • `repos/dziennik-zmian.ts` (TU)  → tabela `history`     — jedna zmiana JEDNEGO POLA
//                                        produktu, z wartością przed i po.
//   • `repos/historia.ts`             → tabela `historia_cen` — migawka cenowa przy
//                                        auto-zatwierdzeniu importu (pisarz: blok 3d-1,
//                                        czytelnik: Iteracja 10, `/api/analytics/prices/…`).
//   • `repos/audit.ts`                → tabela `audit_log`    — dziennik AKCJI użytkownika;
//                                        to z niego czytają `/api/history/meta` i `/paged`.
//
// Roadmapa do Iteracji 5 włącznie podawała „`Wa` = `historia_cen`" — to nieprawda i zostało
// sprostowane w bloku I5 (ticket 15-FEATURE-historia-zmian). `Wa = Nt("history", …)`.
//
// PISARZ tej tabeli w oryginale jest dokładnie jeden: ręczna edycja produktu w katalogu
// (`PUT`/`PATCH /api/products/:id` → `addHistory()`, :48435 i :48475).
//
// ⭐ SPORTOWANY W ITERACJI 12a (ticket 35). Do tej pory tabela nie miała w rebuildzie pisarza
// i `GET /api/history` zwracał na stagingu `[]` — I5 odnotowała to jako stan przejściowy.
// Od tej sesji trasa mutacji produktu zapisuje tu jeden wiersz na KAŻDE zmienione pole,
// więc endpoint przestaje być pusty.

import { desc } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { history } from "../db/schema.js";

/** Wiersz tabeli `history` — 10 pól, dokładnie tyle ma `contract/fixtures/GET_history.json`. */
export type WpisDziennikaZmian = typeof history.$inferSelect;

/**
 * Port `listHistory()` (`backend-index.cjs:44962-44964`):
 * `X.select().from(Wa).orderBy(Ii(Wa.data)).all()`.
 *
 * Bez limitu i bez parametrów — oryginał wysyła CAŁĄ tabelę (nagranie produkcji miało
 * 46 916 wierszy, patrz `_body_przyciete_z` w fixture). Nie dokładamy limitu, bo zmieniłby
 * kształt odpowiedzi wobec kontraktu.
 */
export function listaDziennikaZmian(db: Baza): WpisDziennikaZmian[] {
  return db.select().from(history).orderBy(desc(history.data)).all();
}

/** Nowy wpis dziennika — kształt argumentu `U.addHistory` (`:48435-48445`). */
export type NowyWpisDziennikaZmian = typeof history.$inferInsert;

/**
 * Port `U.addHistory()` (`backend-index.cjs:44957-44960`), wołany przez trasę edycji produktu.
 *
 * Jeden wiersz = JEDNO zmienione pole. Trasa woła to w pętli po polach, których wartość
 * faktycznie się zmieniła — pole wysłane z niezmienioną wartością wpisu nie tworzy.
 *
 * ⚠ `staraWartosc`/`nowaWartosc` są TEKSTEM i powstają przez `String(...)` po stronie trasy,
 * dokładnie jak w oryginale (`:48441-48442`) — łącznie z tym, że `null` staje się napisem
 * `"null"`, a nie pustym polem. Zastane, odtwarzane 1:1.
 */
export function zapiszWpisDziennika(db: Baza, wpis: NowyWpisDziennikaZmian): void {
  db.insert(history).values(wpis).run();
}
