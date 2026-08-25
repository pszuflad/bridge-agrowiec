/**
 * Logowanie — wierne odtworzenie `deminified/frontend-index.js:26391-26509` (`tM`).
 *
 * ODSTĘPSTWO O4 (plan.md): pominięte dwa martwe artefakty oryginału —
 *  - `list="konta-testowe-email"` na polu e-mail wskazywał na `<datalist>`, której
 *    w dokumencie nie ma (atrybut nic nie robił),
 *  - tablica kont testowych z HASŁAMI w kodzie bundla (fe.js:26384-26390).
 *
 * Reszta — teksty PL, kolejność pól, klasy, `data-testid` — jest 1:1.
 */
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zaloguj } from "@/lib/auth";

export function Login() {
  const [email, setEmail] = useState("");
  const [haslo, setHaslo] = useState("");
  const [hasloWidoczne, setHasloWidoczne] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [wysylanie, setWysylanie] = useState(false);
  const [zapamietaj, setZapamietaj] = useState(false);
  const [, setLocation] = useLocation();

  async function obsluzSubmit(zdarzenie: FormEvent<HTMLFormElement>) {
    zdarzenie.preventDefault();
    setBlad(null);
    setWysylanie(true);
    try {
      await zaloguj(email, haslo, zapamietaj);
      setLocation("/");
    } catch (wyjatek) {
      setBlad((wyjatek as Error)?.message || "Błąd logowania");
    } finally {
      setWysylanie(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-16 h-16 text-primary mb-3" />
          <h1 className="text-xl font-semibold tracking-tight">BridgeOne</h1>
        </div>

        <div className="border border-border rounded-lg bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1" data-testid="text-login-title">
            Zaloguj się
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Wpisz swój email i hasło, aby się zalogować
          </p>

          <form onSubmit={obsluzSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                value={email}
                onChange={(zdarzenie) => setEmail(zdarzenie.target.value)}
                placeholder="twoj@email.pl"
                required
                autoFocus
                autoComplete="username"
                data-testid="input-email"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Hasło</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={hasloWidoczne ? "text" : "password"}
                  name="password"
                  value={haslo}
                  onChange={(zdarzenie) => setHaslo(zdarzenie.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  data-testid="input-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setHasloWidoczne((widoczne) => !widoczne)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                  tabIndex={-1}
                  aria-label={hasloWidoczne ? "Ukryj hasło" : "Pokaż hasło"}
                  data-testid="button-toggle-password"
                >
                  {hasloWidoczne ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember-me"
                checked={zapamietaj}
                onChange={(zdarzenie) => setZapamietaj(zdarzenie.target.checked)}
                className="rounded"
                data-testid="checkbox-remember-me"
              />
              <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal">
                Zapamiętaj mnie
              </Label>
            </div>

            {blad && (
              <div
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
                data-testid="text-login-error"
              >
                <CircleAlert className="w-4 h-4 shrink-0" />
                <span>{blad}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={wysylanie} data-testid="button-login">
              {wysylanie ? (
                <>
                  <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                  Logowanie...
                </>
              ) : (
                "Zaloguj się"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
