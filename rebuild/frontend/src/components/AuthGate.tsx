/**
 * Ochrona tras — odtworzenie `deminified/frontend-index.js:27789-27801` (`cM`).
 *
 * Zachowanie oryginału: `/login` przechodzi zawsze; na każdej innej trasie brak
 * użytkownika w pamięci powoduje przekierowanie na `/login`. Zalogowany użytkownik
 * jest udostępniany widokom przez kontekst.
 *
 * ODSTĘPSTWO O5 (plan.md): oryginał renderował w tym miejscu `null`, przez co przy
 * wejściu bez sesji migał biały ekran. Pokazujemy krótki stan ładowania na tokenach.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import type { Uzytkownik } from "@/lib/api";
import { pobierzUzytkownika } from "@/lib/auth";

const KontekstUzytkownika = createContext<Uzytkownik | null>(null);

/**
 * Zalogowany użytkownik. Wołane wewnątrz shellu jest zawsze niepuste — gdyby było,
 * `AuthGate` już przekierowałby na `/login`.
 */
export function useUzytkownik(): Uzytkownik {
  const uzytkownik = useContext(KontekstUzytkownika);
  if (!uzytkownik) {
    throw new Error("useUzytkownik wywołane poza AuthGate — brak zalogowanego użytkownika.");
  }
  return uzytkownik;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const czyLogowanie = location === "/login";
  const [uzytkownik, setUzytkownik] = useState<Uzytkownik | null>(() => pobierzUzytkownika());

  useEffect(() => {
    const biezacy = pobierzUzytkownika();
    setUzytkownik(biezacy);
    if (!czyLogowanie && !biezacy) setLocation("/login");
  }, [location, czyLogowanie, setLocation]);

  if (czyLogowanie) return <>{children}</>;
  if (!uzytkownik) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background text-muted-foreground"
        data-testid="auth-gate-ladowanie"
      >
        <span className="text-sm">Ładowanie…</span>
      </div>
    );
  }
  return (
    <KontekstUzytkownika.Provider value={uzytkownik}>{children}</KontekstUzytkownika.Provider>
  );
}
