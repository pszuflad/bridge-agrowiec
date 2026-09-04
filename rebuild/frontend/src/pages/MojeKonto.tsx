/**
 * Widok `/moje-konto` — port `lM()` (`deminified/frontend-index.js:27624-27780`).
 *
 * Dwie karty obok siebie: „Dane konta" (odczyt) i „Zmiana hasła" (formularz).
 *
 * ⚠ DANE KONTA NIE POCHODZĄ Z ŻĄDANIA. Oryginał czyta je z kontekstu użytkownika (`tk()`,
 * `:27625`), a nie z `GET /api/me` — i tak samo robimy przez `useUzytkownik()`. Dołożenie
 * fetcha byłoby zmianą zachowania: karta pokazuje to, co jest w tokenie sesji, więc po
 * zmianie danych w bazie odświeży się dopiero po ponownym logowaniu. Zastane, świadome.
 *
 * ⚠ WALIDACJA KLIENTA JEST TYLKO WYGODĄ. Prawdą jest backend (`P4()`), który sprawdza to samo
 * w innej kolejności i dokłada weryfikację starego hasła. Formularz blokuje przycisk, ale
 * komunikat o błędnym aktualnym haśle i tak przychodzi z serwera.
 */
import { KeyRound, User } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useUzytkownik } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { BladOdpowiedziSerwera, MIN_DLUGOSC_HASLA, zmienHaslo } from "./moje-konto/api";

export function MojeKonto() {
  const uzytkownik = useUzytkownik();
  const { toast } = useToast();

  const [stare, ustawStare] = useState("");
  const [nowe, ustawNowe] = useState("");
  const [powtorz, ustawPowtorz] = useState("");
  const [zapisywanie, ustawZapisywanie] = useState(false);

  // Trzy warunki 1:1 z oryginałem (`:27629-27631`). Każdy ma własny komunikat inline.
  const dlugieDosc = nowe.length >= MIN_DLUGOSC_HASLA;
  const zgodne = nowe.length > 0 && nowe === powtorz;
  const inneNizStare = nowe.length > 0 && nowe !== stare;
  const mozeWyslac = stare.length > 0 && dlugieDosc && zgodne && inneNizStare && !zapisywanie;

  async function wyslij(zdarzenie: FormEvent) {
    zdarzenie.preventDefault();
    if (!mozeWyslac) return;

    ustawZapisywanie(true);
    try {
      await zmienHaslo(stare, nowe);
      toast({ title: "Hasło zmienione", description: "Twoje hasło zostało zaktualizowane." });
      // Czyszczenie wszystkich trzech pól po sukcesie (`:27690`).
      ustawStare("");
      ustawNowe("");
      ustawPowtorz("");
    } catch (blad) {
      // DWA RÓŻNE TOASTY, 1:1 z oryginałem (`:27684-27698`): odpowiedź błędu z serwera
      // dostaje „Nie udało się zmienić hasła", a awaria samego `fetch` — „Błąd".
      // Zlanie ich w jeden mówiłoby przy zerwanym łączu, że to serwer odrzucił hasło.
      if (blad instanceof BladOdpowiedziSerwera) {
        toast({
          title: "Nie udało się zmienić hasła",
          description: blad.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Błąd",
          description: blad instanceof Error ? blad.message : "Nieznany błąd",
          variant: "destructive",
        });
      }
    } finally {
      ustawZapisywanie(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Moje konto" subtitle="Dane konta i zmiana hasła" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="w-4 h-4" />
              Dane konta
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Imię i nazwisko</div>
                <div className="font-medium" data-testid="account-name">
                  {uzytkownik.imieNazwisko}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Email (login)</div>
                <div className="font-medium" data-testid="account-email">
                  {uzytkownik.email}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <form onSubmit={wyslij} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                <KeyRound className="w-4 h-4" />
                Zmiana hasła
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stare-haslo">Aktualne hasło</Label>
                <Input
                  id="stare-haslo"
                  type="password"
                  autoComplete="current-password"
                  data-testid="input-old-password"
                  value={stare}
                  onChange={(e) => ustawStare(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nowe-haslo">Nowe hasło</Label>
                <Input
                  id="nowe-haslo"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_DLUGOSC_HASLA}
                  data-testid="input-new-password"
                  value={nowe}
                  onChange={(e) => ustawNowe(e.target.value)}
                />
                {/*
                  Kolejność komunikatów jest z oryginału (`:27738-27744`): najpierw długość,
                  a dopiero po jej spełnieniu „musi być inne". Dzięki temu przy pustym polu
                  nie krzyczą oba naraz.
                */}
                <p className="text-[11px] text-muted-foreground">
                  Minimum {MIN_DLUGOSC_HASLA} znaków.{" "}
                  {nowe.length > 0 && !dlugieDosc && (
                    <span className="text-destructive">Za krótkie.</span>
                  )}
                  {dlugieDosc && !inneNizStare && (
                    <span className="text-destructive">Musi być inne niż aktualne.</span>
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="powtorz-haslo">Powtórz nowe hasło</Label>
                <Input
                  id="powtorz-haslo"
                  type="password"
                  autoComplete="new-password"
                  data-testid="input-confirm-password"
                  value={powtorz}
                  onChange={(e) => ustawPowtorz(e.target.value)}
                />
                {powtorz.length > 0 && !zgodne && (
                  <p className="text-[11px] text-destructive">Hasła nie są identyczne.</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={!mozeWyslac}
                className="w-full"
                data-testid="button-submit-change-password"
              >
                {zapisywanie ? "Zapisywanie..." : "Zmień hasło"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
