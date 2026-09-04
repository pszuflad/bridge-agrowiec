/**
 * Kropka statusu przy nagłówku sekcji — odpowiednik klas `.dot`/`.err`/`.load`
 * z `mirror/frontend/assets/selly-injection.js:262-300` (blok CSS `injectCSS`).
 *
 * Oryginał: zielony `#6DAA45` (ok), czerwony `#E5484D` (błąd), pulsujący bursztyn
 * `#FDAB43` (ładowanie). Odbudowa bierze te same znaczenia z tokenów motywu, żeby
 * kropka działała w obu schematach kolorów — kolor jest ten sam co reszta panelu,
 * nie wklejony literałem.
 */
import { cn } from "@/lib/utils";
import type { StanWskaznika } from "./formatowanie";

const KLASY: Record<StanWskaznika, string> = {
  ok: "bg-emerald-500",
  blad: "bg-destructive",
  ladowanie: "bg-amber-500 animate-pulse",
};

const OPISY: Record<StanWskaznika, string> = {
  ok: "OK",
  blad: "Błąd",
  ladowanie: "Ładowanie",
};

export function Wskaznik({ stan, className }: { stan: StanWskaznika; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", KLASY[stan], className)}
      role="status"
      aria-label={OPISY[stan]}
      data-stan={stan}
    />
  );
}

/** Nagłówek karty panelu: kropka + tytuł + opcjonalne akcje po prawej. */
export function NaglowekKarty({
  stan,
  tytul,
  akcje,
}: {
  stan: StanWskaznika;
  tytul: string;
  akcje?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Wskaznik stan={stan} />
        {tytul}
      </h3>
      {akcje && <div className="flex items-center gap-2">{akcje}</div>}
    </div>
  );
}
