import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";

type Wlasciwosci = Omit<ComponentProps<typeof Input>, "type"> & { id: string };

/**
 * Pole hasła z „oczkiem” do podglądu wpisanego tekstu — ten sam wzorzec co na stronie
 * logowania (`Login.tsx`). Każde pole ma własny stan podglądu, więc odkrycie jednego nie
 * ujawnia pozostałych. Guzik ma `tabIndex={-1}`, żeby Tab przechodził między polami.
 */
export function PoleHasla({ id, className, ...reszta }: Wlasciwosci) {
  const [widoczne, ustawWidoczne] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={widoczne ? "text" : "password"}
        className={`pr-10 ${className ?? ""}`.trim()}
        {...reszta}
      />
      <button
        type="button"
        onClick={() => ustawWidoczne((w) => !w)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
        tabIndex={-1}
        aria-label={widoczne ? "Ukryj hasło" : "Pokaż hasło"}
        data-testid={`button-toggle-${id}`}
      >
        {widoczne ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
