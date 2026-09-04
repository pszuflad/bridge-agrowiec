/**
 * Drzewo aplikacji — odpowiednik `deminified/frontend-index.js:28640-28699`.
 *
 * Oryginał: QueryClientProvider > ThemeProvider > TooltipProvider > [Toaster, Router > AuthGate > Switch].
 * `TooltipProvider` i `Toaster` dochodzą w iteracji, która pierwsza ich użyje —
 * Iteracja 1 nie ma ani jednego tooltipa ani toasta, a wnoszenie nieużywanych
 * providerów to martwy kod. **`Toaster` wszedł w sesji 4b** (`/narzuty` woła toast przy
 * każdym zapisie, usunięciu i błędzie walidacji); `TooltipProvider` dalej czeka.
 *
 * ODSTĘPSTWO O1 (plan.md): oryginał używał routingu po hashu (`useHashLocation`
 * + `window.location.hash ||= "#/"`) — obejście z Replita dające adresy `/#/katalog`.
 * Nowy build stoi za Apache z poprawnym SPA fallbackiem (`deploy/staging/htaccess:16-20`),
 * więc używamy zwykłych ścieżek.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { AuthGate } from "@/components/AuthGate";
import { ThemeProvider } from "@/components/ThemeProvider";
import { queryClient } from "@/lib/queryClient";
import { ToastProvider } from "@/components/ui/toast";
import { Alerty } from "@/pages/Alerty";
import { Atrybuty } from "@/pages/Atrybuty";
import { Historia } from "@/pages/Historia";
import { Katalog } from "@/pages/Katalog";
import { Konfiguracja } from "@/pages/Konfiguracja";
import { Narzuty } from "@/pages/Narzuty";
import { Staging } from "@/pages/Staging";
import { WagaGabarytowa } from "@/pages/WagaGabarytowa";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";
import { PLACEHOLDERY } from "@/pages/placeholdery";
import { Pulpit } from "@/pages/Pulpit";
import { Selly } from "@/pages/Selly";
import { WidokWPrzygotowaniu } from "@/pages/WidokWPrzygotowaniu";

/**
 * `/analityka` jest JEDYNĄ trasą ładowaną leniwie — i to nie z upodobania do code-splittingu,
 * tylko z pomiaru. Recharts (wniesiony w bloku 10a, używany wyłącznie przez ten widok) podnosi
 * wspólny bundle z 451 kB do 837 kB (gzip 140 → 254 kB). Ładowany statycznie kazałby płacić
 * tę cenę przy każdym wejściu na logowanie, katalog czy staging. Osobny chunk zdejmuje ją
 * ze wszystkich pozostałych widoków.
 *
 * Bloki 10b–10e dokładają kolejne wykresy DO TEGO SAMEGO chunku — nie trzeba nic zmieniać.
 */
const Analityka = lazy(async () => ({
  default: (await import("@/pages/Analityka")).Analityka,
}));

export function Trasy() {
  return (
    <AuthGate>
      <Suspense
        fallback={
          <div className="p-8 text-sm text-muted-foreground">Wczytywanie…</div>
        }
      >
        <Switch>
          <Route path="/" component={Pulpit} />
          <Route path="/login" component={Login} />
          <Route path="/katalog" component={Katalog} />
          <Route path="/staging" component={Staging} />
          <Route path="/konfiguracja" component={Konfiguracja} />
          <Route path="/historia" component={Historia} />
          <Route path="/narzuty" component={Narzuty} />
          <Route path="/alerty" component={Alerty} />
          <Route path="/atrybuty" component={Atrybuty} />
          <Route path="/waga-gabarytowa" component={WagaGabarytowa} />
          <Route path="/analityka" component={Analityka} />
          <Route path="/selly" component={Selly} />
          {PLACEHOLDERY.map(({ path, tytul, opis, iteracja }) => (
            <Route key={path} path={path}>
              <WidokWPrzygotowaniu
                tytul={tytul}
                opis={opis}
                iteracja={iteracja}
              />
            </Route>
          ))}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AuthGate>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <Trasy />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
