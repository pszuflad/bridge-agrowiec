// Historia cen — tabela `historia_cen`.
//
// W zakresie 3d-1 ma dokładnie JEDNEGO pisarza: gałąź auto-zatwierdzania w `tk()`
// (`deminified/backend-index.cjs:47800`). Import, który podnosi cenę bez pytania człowieka,
// zostawia po sobie ślad — i to jest jedyny powód, dla którego ta tabela rośnie przy imporcie.
//
// Czytelnika (`GET /api/history`) dowozi Iteracja 5.

import { historiaCen } from "../db/schema.js";
import type { Baza } from "../db/index.js";

/**
 * Wiersz historii w kolejności kolumn z oryginalnego INSERT-a (`:47800`).
 *
 * ⚠ Pola tożsamości (`kod`, `ean`, `marka`, `model`, `rozmiar`, indeksy, `kategoria`) pochodzą
 * z produktu SPRZED aktualizacji, a ceny i stan — z wartości PO. Oryginał robi to samo,
 * podając `T.*` obok `AP.x ?? T.x`.
 */
export type NowyWpisHistorii = typeof historiaCen.$inferInsert;

/** Port INSERT-a z `:47800`. Jeden wiersz na jedno auto-zatwierdzenie. */
export function zapiszHistorieCen(db: Baza, wpis: NowyWpisHistorii): void {
  db.insert(historiaCen).values(wpis).run();
}
