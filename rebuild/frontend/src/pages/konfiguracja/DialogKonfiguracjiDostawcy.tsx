/**
 * Dialog edycji konfiguracji jednego dostawcy — `PATCH /api/admin/supplier-config/{kod}`.
 *
 * ⚠ WYSYŁA TYLKO POLA ZMIENIONE. Backend rozróżnia „pole nieobecne" (nie ruszaj) od „pole
 * `null`" (wyczyść) przez `hasOwnProperty` (`extensions.cjs:355,363,371`), więc wysłanie
 * kompletu pól przy każdym zapisie odbierałoby temu rozróżnieniu sens — a przy okazji
 * nadpisywałoby wartości, których nikt nie dotknął.
 *
 * Walidacja klienta jest kopią walidacji backendu i istnieje po to, żeby Ania zobaczyła błąd
 * przed wysłaniem. Prawdą pozostaje serwer: jego komunikat też pokazujemy, gdy odrzuci zapis.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_CZESTOTLIWOSC,
  MIN_CZESTOTLIWOSC,
  STATUSY_DOSTAWCY,
  type KonfiguracjaDostawcy,
  type ZmianaDostawcy,
} from "./admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Puste pole adresu = polecenie wyczyszczenia; backend przyjmuje `""` i `null` tak samo. */
function url(wartosc: string): string | null {
  const przyciety = wartosc.trim();
  return przyciety.length === 0 ? null : przyciety;
}

export function DialogKonfiguracjiDostawcy({
  dostawca,
  otwarty,
  onZamknij,
  onZapisz,
  zapisywanie,
  bladZapisu,
}: {
  dostawca: KonfiguracjaDostawcy;
  otwarty: boolean;
  onZamknij: () => void;
  onZapisz: (zmiana: ZmianaDostawcy) => void;
  zapisywanie: boolean;
  bladZapisu: string | null;
}) {
  // Pole adresu startuje PUSTE, gdy dostawca nie ma własnego URL-a w bazie — inaczej
  // pokazywałoby fallback dispatchera i zapis „bez zmian" wpisałby go do bazy na stałe.
  const [adres, ustawAdres] = useState(dostawca.urlEfektywnyZDb ? (dostawca.url ?? "") : "");
  const [czestotliwosc, ustawCzestotliwosc] = useState(
    dostawca.czestotliwoscMinuty === null ? "" : String(dostawca.czestotliwoscMinuty),
  );
  const [status, ustawStatus] = useState(dostawca.status);

  const adresPoprawny = adres.trim() === "" || /^https?:\/\//i.test(adres.trim());
  const liczba = czestotliwosc.trim() === "" ? null : Number(czestotliwosc);
  const czestotliwoscPoprawna =
    liczba === null ||
    (Number.isFinite(liczba) && liczba >= MIN_CZESTOTLIWOSC && liczba <= MAX_CZESTOTLIWOSC);

  const adresPoczatkowy = dostawca.urlEfektywnyZDb ? (dostawca.url ?? "") : "";
  const czestotliwoscPoczatkowa =
    dostawca.czestotliwoscMinuty === null ? "" : String(dostawca.czestotliwoscMinuty);

  const zmiana: ZmianaDostawcy = {};
  if (adres.trim() !== adresPoczatkowy.trim()) zmiana.url = url(adres);
  if (czestotliwosc.trim() !== czestotliwoscPoczatkowa) {
    zmiana.czestotliwoscMinuty = liczba === null ? null : Math.round(liczba);
  }
  if (status !== dostawca.status) zmiana.status = status;

  const cokolwiekZmieniono = Object.keys(zmiana).length > 0;
  const mozeZapisac = cokolwiekZmieniono && adresPoprawny && czestotliwoscPoprawna && !zapisywanie;

  return (
    <Dialog open={otwarty} onOpenChange={(o) => !o && onZamknij()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dostawca.kod} — {dostawca.nazwa}
          </DialogTitle>
          <DialogDescription>
            Puste pola oznaczają wartość domyślną: adres wraca wtedy do fallbacku dispatchera,
            a częstotliwość zostaje wyczyszczona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-url">Adres cennika</Label>
            <Input
              id="admin-url"
              value={adres}
              placeholder={dostawca.fallbackUrl ?? "brak fallbacku"}
              onChange={(e) => ustawAdres(e.target.value)}
              data-testid="input-admin-url"
            />
            {!adresPoprawny && (
              <p className="text-[11px] text-destructive" data-testid="blad-admin-url">
                url musi być http(s):// albo pusty
              </p>
            )}
            {dostawca.fallbackUrl && (
              <p className="text-[11px] text-muted-foreground">
                Fallback dispatchera:{" "}
                <span className="font-mono break-all">{dostawca.fallbackUrl}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-czestotliwosc">Częstotliwość (minuty)</Label>
            <Input
              id="admin-czestotliwosc"
              type="number"
              value={czestotliwosc}
              min={MIN_CZESTOTLIWOSC}
              max={MAX_CZESTOTLIWOSC}
              onChange={(e) => ustawCzestotliwosc(e.target.value)}
              data-testid="input-admin-czestotliwosc"
            />
            {!czestotliwoscPoprawna && (
              <p className="text-[11px] text-destructive" data-testid="blad-admin-czestotliwosc">
                czestotliwoscMinuty: {MIN_CZESTOTLIWOSC}..{MAX_CZESTOTLIWOSC} albo puste
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={ustawStatus}>
              <SelectTrigger data-testid="select-admin-status" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSY_DOSTAWCY.map((wartosc) => (
                  <SelectItem key={wartosc} value={wartosc}>
                    {wartosc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bladZapisu && (
            <p className="text-[11px] text-destructive" data-testid="blad-admin-zapis">
              {bladZapisu}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onZamknij} data-testid="button-admin-anuluj">
            Anuluj
          </Button>
          <Button
            onClick={() => onZapisz(zmiana)}
            disabled={!mozeZapisac}
            data-testid="button-admin-zapisz"
          >
            {zapisywanie ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
