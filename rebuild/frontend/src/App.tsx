/**
 * Drzewo aplikacji — odpowiednik `deminified/frontend-index.js:28640-28699`.
 *
 * Oryginał: QueryClientProvider > ThemeProvider > TooltipProvider > [Toaster, Router > AuthGate > Switch].
 * `TooltipProvider` i `Toaster` dochodzą w iteracji, która pierwsza ich użyje —
 * Iteracja 1 nie ma ani jednego tooltipa ani toasta, a wnoszenie nieużywanych
 * providerów to martwy kod.
 *
 * ODSTĘPSTWO O1 (plan.md): oryginał używał routingu po hashu (`useHashLocation`
 * + `window.location.hash ||= "#/"`) — obejście z Replita dające adresy `/#/katalog`.
 * Nowy build stoi za Apache z poprawnym SPA fallbackiem (`deploy/staging/htaccess:16-20`),
 * więc używamy zwykłych ścieżek.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { AuthGate } from "@/components/AuthGate";
import { ThemeProvider } from "@/components/ThemeProvider";
import { queryClient } from "@/lib/queryClient";
import { Katalog } from "@/pages/Katalog";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";
import { PLACEHOLDERY } from "@/pages/placeholdery";
import { WidokWPrzygotowaniu } from "@/pages/WidokWPrzygotowaniu";

export function Trasy() {
  return (
    <AuthGate>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/katalog" component={Katalog} />
        {PLACEHOLDERY.map(({ path, tytul, opis, iteracja }) => (
          <Route key={path} path={path}>
            <WidokWPrzygotowaniu tytul={tytul} opis={opis} iteracja={iteracja} />
          </Route>
        ))}
        <Route component={NotFound} />
      </Switch>
    </AuthGate>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Trasy />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
