/**
 * Rama aplikacji — wierne odtworzenie `deminified/frontend-index.js:16329-16456` (`mn`).
 *
 * Tak jak w oryginale, shell jest opakowaniem KAŻDEGO widoku z osobna (a nie warstwą
 * routera) — widok sam się w niego zawija. Zachowane wszystkie `data-testid`.
 */
import { KeyRound, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/Logo";
import { useMotyw } from "@/components/ThemeProvider";
import { useUzytkownik } from "@/components/AuthGate";
import { POZYCJE_NAWIGACJI } from "@/components/nawigacja";
import { Button } from "@/components/ui/button";
import { wyloguj } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { dark, toggle } = useMotyw();
  const [menuOtwarte, setMenuOtwarte] = useState(false);
  const uzytkownik = useUzytkownik();

  const czlony = (uzytkownik.imieNazwisko || "").split(" ");
  const inicjaly = `${czlony[0]?.[0] || ""}${czlony[1]?.[0] || ""}`.toUpperCase();

  async function obsluzWylogowanie() {
    await wyloguj();
    // Cały cache Query znika razem z sesją — inaczej następny użytkownik
    // zobaczyłby dane poprzedniego (fe.js:16431-16441).
    queryClient.clear();
    setLocation("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 border-b border-border bg-sidebar text-sidebar-foreground flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo className="w-7 h-7 text-sidebar-primary" />
          <span className="font-semibold tracking-tight">BridgeOne</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuOtwarte((otwarte) => !otwarte)}
          data-testid="button-menu-mobile"
          className="text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label={menuOtwarte ? "Zamknij menu" : "Otwórz menu"}
        >
          {menuOtwarte ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      <aside
        className={cn(
          "fixed md:static z-30 inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform",
          menuOtwarte ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "pt-14 md:pt-0",
        )}
      >
        <div className="hidden md:flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <Logo className="w-8 h-8 text-sidebar-primary" />
          <div>
            <div className="font-semibold tracking-tight text-base leading-none">BridgeOne</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {POZYCJE_NAWIGACJI.map((pozycja) => {
            const aktywna = location === pozycja.href;
            const Ikona = pozycja.icon;
            return (
              <Link
                key={pozycja.href}
                href={pozycja.href}
                onClick={() => setMenuOtwarte(false)}
                data-testid={`link-nav-${pozycja.href.replace("/", "") || "home"}`}
              >
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                    aktywna
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Ikona className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{pozycja.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          <button
            onClick={toggle}
            data-testid="button-theme-toggle"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{dark ? "Tryb jasny" : "Tryb ciemny"}</span>
          </button>

          <div className="px-3 py-2 flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center text-xs font-semibold"
              data-testid="avatar-current-user"
            >
              {inicjaly || "?"}
            </div>
            <div className="text-xs flex-1 min-w-0">
              <div className="font-medium leading-tight truncate" data-testid="text-current-user">
                {uzytkownik.imieNazwisko}
              </div>
              <div className="text-sidebar-foreground/60 text-[11px]">{uzytkownik.email}</div>
            </div>
          </div>

          <Link
            href="/moje-konto"
            data-testid="link-moje-konto"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            <span>Moje konto</span>
          </Link>

          <button
            onClick={obsluzWylogowanie}
            data-testid="button-logout"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Wyloguj</span>
          </button>
        </div>
      </aside>

      {menuOtwarte && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/40 pt-14"
          onClick={() => setMenuOtwarte(false)}
        />
      )}

      <main
        id="$vMainScroll"
        className="flex-1 min-w-0 pt-14 md:pt-0 overflow-x-hidden overflow-y-auto h-screen"
      >
        <div className="px-4 sm:px-6 lg:px-8 py-6 md:py-8 max-w-[1400px] mx-auto min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
