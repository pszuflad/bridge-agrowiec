/**
 * Karta „Sync dostawcy" — `selly-injection.js:456-473` (widok) i `:682-740` (`doSync`).
 *
 * ⚠ ODSTĘPSTWO D5: lista dostawców.
 * Oryginał ma ją ZAHARDKODOWANĄ jako `['MO1'…'MO10']` (`:499`). Bierzemy ją z
 * `GET /api/selly/status` — panel i tak woła tę trasę do tabeli mapowania, więc nie
 * kosztuje to dodatkowego żądania, a lista nadąża za realnym stanem bazy. Gdy `/status`
 * padnie albo nie zwróci nic, select jest wyłączony, a oba przyciski nieaktywne —
 * bez tego dałoby się wysłać sync z pustym `dostawca`.
 *
 * ⚠ ODSTĘPSTWO D3: „Wyślij do Selly" przechodzi przez dialog potwierdzenia (obsługiwany
 * przez rodzica). „Test dry-run (5 szt.)" leci od razu — nic nie zapisuje.
 *
 * Semantyka pól 1:1 z oryginałem: `limit` domyślnie `0` (= wszystko), a przy dry-runie
 * jest IGNOROWANY i podmieniany na `5` (`:696`).
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { WynikSynchronizacji } from "./api";
import { BladSekcji } from "./BladSekcji";
import { NaglowekKarty } from "./Wskaznik";

export function SekcjaSync({
  dostawcy,
  dostawca,
  onDostawca,
  limit,
  onLimit,
  tylkoZmienione,
  onTylkoZmienione,
  onDryRun,
  onWyslij,
  trwa,
  wynik,
  blad,
}: {
  dostawcy: string[];
  dostawca: string;
  onDostawca: (wartosc: string) => void;
  limit: number;
  onLimit: (wartosc: number) => void;
  tylkoZmienione: boolean;
  onTylkoZmienione: (wartosc: boolean) => void;
  onDryRun: () => void;
  onWyslij: () => void;
  trwa: boolean;
  wynik: WynikSynchronizacji | undefined;
  blad: unknown;
}) {
  const brakDostawcow = dostawcy.length === 0;

  return (
    <Card data-testid="selly-sekcja-sync">
      <CardContent className="space-y-3 p-4">
        <NaglowekKarty stan={trwa ? "ladowanie" : "ok"} tytul="Sync dostawcy" />

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="selly-dostawca">Dostawca</Label>
            {/* Zwykły <select>, nie Radix: oryginał ma natywny select, a lista jest
                krótka i bez wyszukiwania. */}
            <select
              id="selly-dostawca"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              value={dostawca}
              disabled={brakDostawcow}
              onChange={(zdarzenie) => onDostawca(zdarzenie.target.value)}
              data-testid="selly-select-dostawca"
            >
              {brakDostawcow && <option value="">Brak dostawców</option>}
              {dostawcy.map((kod) => (
                <option key={kod} value={kod}>
                  {kod}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="selly-limit">Limit (0=wszystko)</Label>
            <Input
              id="selly-limit"
              type="number"
              min={0}
              className="w-24"
              value={limit}
              onChange={(zdarzenie) =>
                // `parseInt(...) || 0` z oryginału (:684): puste pole i śmieci → 0.
                onLimit(parseInt(zdarzenie.target.value, 10) || 0)
              }
              data-testid="selly-input-limit"
            />
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={tylkoZmienione}
              onChange={(zdarzenie) => onTylkoZmienione(zdarzenie.target.checked)}
              data-testid="selly-checkbox-tylko-zmienione"
            />
            tylko zmienione od ostatniego syncu
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={onDryRun}
            disabled={trwa || brakDostawcow}
            data-testid="selly-button-dryrun"
          >
            Test dry-run (5 szt.)
          </Button>
          <Button
            onClick={onWyslij}
            disabled={trwa || brakDostawcow}
            data-testid="selly-button-wyslij"
          >
            Wyślij do Selly
          </Button>
        </div>

        {trwa && (
          <p className="text-sm text-muted-foreground">
            ⏳ Synchronizuję <strong>{dostawca}</strong>...
          </p>
        )}
        {!trwa && blad != null && <BladSekcji blad={blad} />}
        {!trwa && blad == null && wynik && <WynikSync wynik={wynik} />}
      </CardContent>
    </Card>
  );
}

/** Podsumowanie wyniku — `selly-injection.js:711-735`. */
function WynikSync({ wynik }: { wynik: WynikSynchronizacji }) {
  const bledy = wynik.errors ?? [];
  const payloady = wynik.dry_payloads;

  return (
    <div className="space-y-3" data-testid="selly-wynik-sync">
      <p className="text-sm">
        <strong>{wynik.dostawca}</strong>: {wynik.total ?? 0} produktów
        {wynik.dry_run && (
          <Badge variant="secondary" className="ml-2">
            DRY-RUN
          </Badge>
        )}
      </p>

      <div className="flex flex-wrap gap-6 text-sm">
        <Statystyka
          etykieta="OK"
          wartosc={(wynik.created ?? 0) + (wynik.updated ?? 0)}
          klasa="text-emerald-600"
        />
        <Statystyka etykieta="Błędy" wartosc={wynik.failed ?? 0} klasa="text-destructive" />
        <Statystyka etykieta="Pominięto" wartosc={wynik.skipped ?? 0} klasa="text-amber-600" />
        <Statystyka etykieta="Utworzono" wartosc={wynik.created ?? 0} klasa="text-emerald-600" />
        <Statystyka etykieta="Zaktualizowano" wartosc={wynik.updated ?? 0} klasa="text-cyan-700" />
      </div>

      {/* Oryginał rozwija błędy domyślnie (`<details open>`), a payloady zwija (:729). */}
      {bledy.length > 0 && (
        <details open>
          <summary className="cursor-pointer text-sm">Błędy ({bledy.length})</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(bledy, null, 2)}
          </pre>
        </details>
      )}
      {payloady && (
        <details>
          <summary className="cursor-pointer text-sm">
            Podgląd payloadów ({payloady.length})
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(payloady, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function Statystyka({
  etykieta,
  wartosc,
  klasa,
}: {
  etykieta: string;
  wartosc: number;
  klasa: string;
}) {
  return (
    <div className="flex flex-col">
      <span className={`text-lg font-semibold tabular-nums ${klasa}`}>{wartosc}</span>
      <span className="text-xs text-muted-foreground">{etykieta}</span>
    </div>
  );
}
