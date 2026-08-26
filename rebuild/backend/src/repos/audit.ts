import type { Baza } from "../db/index.js";
import { auditLog } from "../db/schema.js";

/**
 * Wpis do dziennika audytu — odpowiednik `be()` + `U.addAudit`
 * (backend-index.cjs:45103-45113).
 *
 * `encjaId` jest w bazie tekstem, więc liczby są rzutowane; `szczegoly` trafiają jako
 * zserializowany JSON albo NULL, gdy ich nie ma. Odtwarzamy dokładnie tę konwersję,
 * bo `GET /api/history/meta` (Iteracja 5) czyta `szczegoly_json` i parsuje go z powrotem.
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
