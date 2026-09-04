/**
 * Prezentacja błędu w sekcji panelu.
 *
 * ⚠ DWIE ŚCIEŻKI, CELOWO RÓŻNE (decyzja D4 planu):
 *
 *  1. Brak sekretów `SELLY_*` → backend 8a oddaje 500 z `[Selly] Brak konfiguracji: …`.
 *     To zachowanie 1:1 z produkcją, NIE awaria do naprawienia w backendzie. Pokazujemy
 *     czytelny komunikat zamiast surowego 500 — jedyne odstępstwo od oryginału w tym pliku.
 *
 *  2. KAŻDY inny błąd → surowa treść, dokładnie jak oryginał, który renderuje
 *     `escapeHtml(JSON.stringify(r.data))` (`selly-injection.js:622, 657, 706`).
 *
 * Rozpoznawanie po treści komunikatu jest z natury kruche, dlatego dopasowanie siedzi
 * w jednym miejscu (`czyBrakKonfiguracjiSelly`) i ma własny test wraz z kontrtestem.
 */
import { czyBrakKonfiguracjiSelly } from "./api";

export function BladSekcji({ blad }: { blad: unknown }) {
  if (czyBrakKonfiguracjiSelly(blad)) {
    return (
      <div className="text-sm" data-testid="selly-nieskonfigurowane">
        <p className="font-medium text-destructive">Selly nieskonfigurowane</p>
        <p className="mt-1 text-muted-foreground">
          Brakuje sekretów połączenia (<code className="font-mono">SELLY_SHOP_URL</code>,{" "}
          <code className="font-mono">SELLY_CLIENT_ID</code>,{" "}
          <code className="font-mono">SELLY_CLIENT_SECRET</code>). Trasy rozmawiające
          z API Selly.pl będą zwracać błąd, dopóki nie zostaną ustawione na serwerze.
        </p>
      </div>
    );
  }

  return (
    <pre
      className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-destructive"
      data-testid="selly-blad"
    >
      {blad instanceof Error ? blad.message : String(blad)}
    </pre>
  );
}
