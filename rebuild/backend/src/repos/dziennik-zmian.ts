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
// (`PUT`/`PATCH /api/products/:id` → `addHistory()`, :48435 i :48475). To mutacja katalogu,
// której rebuild jeszcze nie portuje, więc do tego czasu tabela jest pusta, a
// `GET /api/history` zwraca `[]`. Czytelnik i tak powstaje teraz: endpoint jest w kontrakcie,
// ma fixture i wołają go Pulpit (I10) oraz optymistyczny cache edycji katalogu.

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
