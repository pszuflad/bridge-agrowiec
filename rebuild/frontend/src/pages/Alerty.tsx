/**
 * Widok `/alerty` — Iteracja 6.
 *
 * ⚠ ŚWIADOME ODEJŚCIE OD ORYGINAŁU (D1 planu, ticket `18-FEATURE-widok-alerty`).
 * `HT()` (`deminified/frontend-index.js:25177-25340`) pod tym adresem pokazuje
 * pseudo-alerty wyliczane z `GET /api/products` (marża ujemna, niska marża, „nie-opona"),
 * a stan ich obsługi trzyma w IndexedDB — `/api/alerts` nie woła w ogóle, mimo że backend
 * ma tę trasę od zawsze. Ten widok stoi na realnych alertach IMPORTU, bo to one mówią
 * Ani, co się w nocy nie pobrało. Pseudo-alerty katalogowe czekają na decyzję
 * w `docs/rebuild-backlog.md`.
 */
import { PageHeader } from "@/components/PageHeader";
import { TabelaAlertow } from "./alerty/TabelaAlertow";

export function Alerty() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Alerty"
        subtitle="Zdarzenia importu — powtórki zwinięte w grupy (dostawca, typ, status)"
      />
      <TabelaAlertow />
    </div>
  );
}
