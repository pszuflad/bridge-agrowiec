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
        {ladowanie && <p className="text-sm text-muted-foreground">Sprawdzam...</p>}
        {!ladowanie && blad != null && <BladSekcji blad={blad} />}
        {!ladowanie && blad == null && dane && (
          // Układ linii 1:1 z `selly-injection.js:562-565`: sklep, prefiks tokenu,
          // czas życia tokenu i wynik sondy stawek VAT.
          <dl className="grid gap-1 text-sm sm:grid-cols-2" data-testid="selly-ping">
            <div>
              <dt className="inline text-muted-foreground">Sklep: </dt>
              <dd className="inline font-mono">{dane.shop}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Token: </dt>
              <dd className="inline font-mono">{dane.token_prefix}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Wygasa za: </dt>
              <dd className="inline">{dane.expires_in_seconds} s</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Stawki VAT: </dt>
              <dd className="inline">{dane.vat_probe}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
