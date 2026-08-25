/**
 * Motyw jasny/ciemny — odtworzenie `deminified/frontend-index.js:16228-16241` (`a2`)
 * z jednym zatwierdzonym odstępstwem.
 *
 * ODSTĘPSTWO O2 (plan.md): oryginał NIE zapisywał wyboru — po każdym odświeżeniu
 * motyw wracał do ustawienia systemowego. Tutaj wybór ląduje w `localStorage`
 * pod `bridge_theme`. Reszta jest wierna: przełącznik dodaje/usuwa klasę `dark`
 * na `<html>`, a gdy zapisu nie ma, decyduje `prefers-color-scheme`.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KLUCZ_MOTYWU = "bridge_theme";

type KontekstMotywu = { dark: boolean; toggle: () => void };

const Kontekst = createContext<KontekstMotywu>({ dark: false, toggle: () => {} });

function czyCiemnyNaStarcie(): boolean {
  if (typeof window === "undefined") return true; // jak w oryginale: brak okna → ciemny
  try {
    const zapisany = localStorage.getItem(KLUCZ_MOTYWU);
    if (zapisany === "dark") return true;
    if (zapisany === "light") return false;
  } catch {
    /* storage niedostępny — schodzimy do preferencji systemowej */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(czyCiemnyNaStarcie);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(KLUCZ_MOTYWU, dark ? "dark" : "light");
    } catch {
      /* jw. — brak zapisu nie może psuć przełączania */
    }
  }, [dark]);

  return (
    <Kontekst.Provider value={{ dark, toggle: () => setDark((poprzedni) => !poprzedni) }}>
      {children}
    </Kontekst.Provider>
  );
}

export const useMotyw = (): KontekstMotywu => useContext(Kontekst);
