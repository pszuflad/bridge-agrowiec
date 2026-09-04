/**
 * Karta „Status połączenia" — `selly-injection.js:409-412` (widok) i `:544-566` (`loadPing`).
 *
 * `GET /api/selly/ping` jest jedną z SZEŚCIU tras rozmawiających z realnym API Selly.pl
 * (OAuth2 `client_credentials`), więc bez sekretów `SELLY_*` odda 500 — obsłużone przez
 * `BladSekcji` (decyzja D4).
 */
import { Card, CardContent } from "@/components/ui/card";
import type { PingSelly } from "./api";
import { BladSekcji } from "./BladSekcji";
import { stanPolaczenia } from "./formatowanie";
import { NaglowekKarty } from "./Wskaznik";

export function SekcjaPolaczenie({
  dane,
  ladowanie,
  blad,
}: {
  dane: PingSelly | undefined;
  ladowanie: boolean;
  blad: unknown;
}) {
  return (
    <Card data-testid="selly-sekcja-polaczenie">
      <CardContent className="space-y-3 p-4">
        <NaglowekKarty
          stan={stanPolaczenia(ladowanie, Boolean(blad), dane?.ok)}
          tytul="Status połączenia"
        />
        {ladowanie && <p className="text-sm text-muted-foreground">Sprawdzam połączenie...</p>}
        {!ladowanie && blad != null && <BladSekcji blad={blad} />}
        {!ladowanie && blad == null && dane && (
          /*
           * Jedna linia, dokładnie jak `selly-injection.js:553-559`:
           *   „✓ Połączono · <shop> · token wygasa za <N>s · <vat_probe>"
           *
           * ⚠ `token_prefix` z fixtura NIE jest tu pokazywany — oryginał go nie renderuje,
           * mimo że API go zwraca. Nie dokładamy go, bo to prefiks tokenu dostępowego:
           * pokazywanie fragmentu sekretu na ekranie byłoby zmianą zachowania w złą stronę.
           */
          <p className="text-sm" data-testid="selly-ping">
            <span className="text-emerald-600">✓ Połączono</span> ·{" "}
            <strong>{dane.shop}</strong> · token wygasa za{" "}
            <strong>{dane.expires_in_seconds}s</strong> ·{" "}
            <span className="font-mono">{dane.vat_probe || ""}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
