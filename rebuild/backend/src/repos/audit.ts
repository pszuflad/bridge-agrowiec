import { desc } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { auditLog } from "../db/schema.js";

// ⚠ TRZY PODOBNE TABELE — pełne rozróżnienie w nagłówku `repos/dziennik-zmian.ts`.
// W skrócie: `audit_log` (TU) = AKCJE użytkownika, `history` = zmiany pól produktu,
// `historia_cen` = migawki cenowe z auto-zatwierdzenia importu.

/**
 * Wpis do dziennika audytu — odpowiednik `be()` + `U.addAudit`
 * (backend-index.cjs:45103-45113).
 *
 * `encjaId` jest w bazie tekstem, więc liczby są rzutowane; `szczegoly` trafiają jako
 * zserializowany JSON albo NULL, gdy ich nie ma. Odtwarzamy dokładnie tę konwersję,
 * bo `GET /api/history/meta` i `/paged` (Iteracja 5, `historia/mapowanie.ts`) czytają
 * `szczegoly_json` i parsują go z powrotem — z NULL-em włącznie.
 */
export function zapiszAudyt(
  db: Baza,
  wpis: {
    uzytkownikId?: number | null;
    uzytkownikImie?: string | null;
    akcja: string;
    encjaTyp?: string | null;
    encjaId?: string | number | null;
    szczegoly?: unknown;
  },
): void {
  db.insert(auditLog)
    .values({
      uzytkownikId: wpis.uzytkownikId ?? null,
      uzytkownikImie: wpis.uzytkownikImie ?? null,
      akcja: wpis.akcja,
      encjaTyp: wpis.encjaTyp ?? null,
      encjaId: wpis.encjaId != null ? String(wpis.encjaId) : null,
      szczegolyJson: wpis.szczegoly ? JSON.stringify(wpis.szczegoly) : null,
      kiedy: new Date().toISOString(),
    })
    .run();
}

/** Wiersz `audit_log` — kształt czytany przez `historia/mapowanie.ts` i (w I12) `/api/audit-log`. */
export type WierszAudytu = typeof auditLog.$inferSelect;

/**
 * Port `listAudit(t = 500)` (`backend-index.cjs:45068-45073`):
 * `X.select().from(Za).orderBy(Ii(Za.kiedy)).limit(t).all()`.
 *
 * ⚠ Limit działa PRZED jakimkolwiek filtrowaniem — `/api/history/paged` woła `listAudit(5000)`
 * i dopiero na tych 5 000 najświeższych wierszach robi mapowanie, odsiew akcji i paginację.
 * Starsze wpisy są dla tego widoku niewidoczne niezależnie od numeru strony. To zastane
 * zachowanie produkcji, nie nasze uproszczenie.
 */
export function listaAudytu(db: Baza, limit = 500): WierszAudytu[] {
  return db.select().from(auditLog).orderBy(desc(auditLog.kiedy)).limit(limit).all();
}
