/**
 * Przycisk „CSV" w nagłówku karty analityki — port `M()` (`frontend-index.js:27938-27940`).
 *
 * Bloki 10a–10e świadomie ten przycisk pomijały, bo trasa `GET /api/analytics/export/{view}`
 * jeszcze nie istniała (decyzje D3/D5 tamtych bloków — przycisk wiodący donikąd jest gorszy
 * niż jego brak). Blok 10f dowozi trasę i dokłada przycisk do wszystkich dziesięciu kart,
 * które mają go w oryginale.
 *
 * ⚠ TO NAWIGACJA PRZEGLĄDARKI, NIE `fetch` — i to jest istotne, a nie stylistyczne.
 * Oryginał robi `window.location.href = …`, więc żądanie NIE niesie nagłówka
 * `Authorization` i uwierzytelnia się **wyłącznie cookie'em sesji** `bridge_session`
 * (`HttpOnly; Path=/; SameSite=Lax` — a `Lax` wysyła cookie właśnie przy nawigacji GET
 * najwyższego poziomu). Przepisanie tego na `fetch` + `blob` zmieniłoby model autoryzacji
 * i zerwałoby zgodność z produkcją; dowód, że wariant cookie'owy działa, siedzi
 * w `backend/test/analityka.eksport.gate.test.ts`.
 *
 * ⚠ EKSPORT NIE NIESIE FILTRÓW. Oryginał nie dokleja do adresu żadnego query stringu, a każdy
 * `{view}` ma po stronie backendu WŁASNY SQL, inny niż trasa dashboardu o tej samej nazwie
 * (`backend/src/repos/analityka-eksport.ts`). Plik CSV nie jest więc „tym, co widać w tabeli"
 * — i tak ma zostać.
 */
import { Button } from "@/components/ui/button";
import { BAZA_API } from "@/lib/api";

/**
 * Dziesięć nazw `{view}`, które woła oryginalny front (`frontend-index.js:28065`, `:28109`,
 * `:28147`, `:28190`, `:28233`, `:28310`, `:28432`, `:28470`, `:28531`, `:28573`).
 * Backend zna dokładnie te same (`repos/analityka-eksport.ts`); nazwa spoza listy dostałaby
 * z niego pusty plik ze statusem 200, więc typ pilnuje, żeby literówka nie przeszła cicho.
 */
export type WidokEksportu =
  | "suppliers-stability"
  | "suppliers-lifecycle"
  | "suppliers-stock"
  | "ean-comparison"
  | "unique"
  | "prices-last"
  | "availability-products"
  | "sell-through"
  | "margins"
  | "rotation-inactive";

/** Port `M()` — goły adres, bez query stringu. Wydzielony, żeby dało się go sprawdzić testem. */
export function adresEksportu(widok: WidokEksportu): string {
  return `${BAZA_API}/api/analytics/export/${widok}`;
}

/**
 * Markup 1:1 z oryginałem: `<Button variant="outline" size="sm">CSV</Button>` w nagłówku
 * karty, po prawej stronie tytułu.
 */
export function PrzyciskCsv({ widok }: { widok: WidokEksportu }) {
  return (
    <Button
      variant="outline"
      size="sm"
      data-testid={`csv-${widok}`}
      onClick={() => {
        window.location.href = adresEksportu(widok);
      }}
    >
      CSV
    </Button>
  );
}
