/**
 * Toast — powiadomienia po mutacjach.
 *
 * DLACZEGO DOPIERO TERAZ: `App.tsx` zapisuje wprost, że `Toaster` „dochodzi w iteracji, która
 * pierwsza go użyje" — wnoszenie nieużywanego providera to martwy kod. Widok `/narzuty` jest
 * pierwszym, który go potrzebuje: oryginał woła toast przy każdym zapisie, aktualizacji
 * i usunięciu reguły oraz przy trzech błędach walidacji (`el()`, `WT()`, `BT()`).
 *
 * ODSTĘPSTWO ŚWIADOME (plan.md D7): produkcja używa shadcn/ui na `@radix-ui/react-toast`
 * (`frontend-index.js:13834`). Tej zależności nie ma w `package.json` odbudowy, a cała
 * potrzebna funkcjonalność to lista komunikatów znikających po chwili — więc zamiast dokładać
 * paczkę, odtwarzamy zachowanie własnym komponentem. Zachowane 1:1:
 *  - LIMIT JEDNEGO widocznego toastu (`nS = 1` i `.slice(0, 1)`, `:10384`, `:10406`) — nowy
 *    komunikat wypiera poprzedni, zamiast układać się w stos;
 *  - pozycja: na małych ekranach u góry, od `sm` w prawym dolnym rogu (`:13834`);
 *  - kształt wywołania `toast({ title, description, variant })`, żeby miejsca wywołań
 *    wyglądały jak w oryginale.
 * Nie odtwarzamy `TOAST_REMOVE_DELAY = 1e6` (`:10385`) — w oryginale to opóźnienie SPRZĄTANIA
 * z tablicy po zamknięciu przez Radiksa, a nie czas życia komunikatu; bez Radiksa znaczyłoby
 * „nigdy nie znika".
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** Czas życia komunikatu — domyślna wartość Radiksa, którą produkcja przyjmuje milcząco. */
const CZAS_ZYCIA_MS = 5000;

export type WariantToastu = "default" | "destructive";

export type Toast = {
  id: number;
  title: string;
  description?: string;
  variant?: WariantToastu;
};

export type ZgloszenieToastu = Omit<Toast, "id">;

type KontekstToastow = {
  toast: (zgloszenie: ZgloszenieToastu) => void;
  odrzuc: () => void;
  aktualny: Toast | null;
};

const Kontekst = createContext<KontekstToastow | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [aktualny, ustawAktualny] = useState<Toast | null>(null);
  const licznik = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const odrzuc = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    ustawAktualny(null);
  }, []);

  const toast = useCallback((zgloszenie: ZgloszenieToastu) => {
    licznik.current += 1;
    // Limit 1 z oryginału: nowy komunikat WYPIERA poprzedni razem z jego timerem.
    if (timer.current) clearTimeout(timer.current);
    ustawAktualny({ ...zgloszenie, id: licznik.current });
    timer.current = setTimeout(() => ustawAktualny(null), CZAS_ZYCIA_MS);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const wartosc = useMemo(() => ({ toast, odrzuc, aktualny }), [toast, odrzuc, aktualny]);

  return (
    <Kontekst.Provider value={wartosc}>
      {children}
      <Toaster />
    </Kontekst.Provider>
  );
}

/**
 * Hook wywołania — odpowiednik `yt()` (`:10481-10493`).
 *
 * Poza providerem zwraca atrapę zamiast rzucać: komunikat to informacja poboczna i jego brak
 * nie może wywrócić widoku (np. w teście renderującym sam komponent bez drzewa aplikacji).
 */
export function useToast(): KontekstToastow {
  const kontekst = useContext(Kontekst);
  if (kontekst) return kontekst;
  return { toast: () => {}, odrzuc: () => {}, aktualny: null };
}

/** Pojemnik komunikatu — klasy pozycjonowania 1:1 z `:13834`. */
export function Toaster() {
  const { aktualny, odrzuc } = useToast();
  if (!aktualny) return null;

  return (
    <div
      className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
      data-testid="toaster"
    >
      <div
        role="status"
        aria-live="polite"
        data-testid={`toast-${aktualny.variant ?? "default"}`}
        onClick={odrzuc}
        className={cn(
          "pointer-events-auto flex w-full cursor-pointer flex-col gap-1 rounded-md border p-4 shadow-lg",
          aktualny.variant === "destructive"
            ? "border-destructive bg-destructive text-destructive-foreground"
            : "border-border bg-background text-foreground",
        )}
      >
        <div className="text-sm font-semibold">{aktualny.title}</div>
        {aktualny.description ? (
          <div className="text-sm opacity-90">{aktualny.description}</div>
        ) : null}
      </div>
    </div>
  );
}
