/**
 * Menu „Akcje" w wierszu katalogu — port `deminified/frontend-index.js:23763-23814`.
 *
 * ZASTĘPUJE przycisk podglądu, którym Iteracja 2 wypełniła tę kolumnę (odstępstwo D4).
 *
 * ⚠ KOLEJNOŚĆ POZYCJI JEST CZĘŚCIĄ PORTU i nie jest tą, którą podpowiada intuicja:
 * Edytuj → Historia (zawsze `disabled`) → separator → Wstrzymaj/Aktywuj → Usuń.
 * „Historia" stoi DRUGA, nie na końcu, a separator oddziela ją od akcji zmieniających dane.
 *
 * ⚠ WSTRZYMAJ/AKTYWUJ TO JEDNA POZYCJA PRZEŁĄCZAJĄCA, nie dwie osobne akcje — etykieta
 * i cel wynikają z aktualnego `status` produktu (`:23803`, `:23807`).
 */
import { EllipsisVertical, History, Pause, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Produkt } from "./filtrowanie";

export const STATUS_WSTRZYMANY = "wstrzymany";
export const STATUS_AKTYWNY = "aktywny";

/** Docelowy status przełącznika — port `:23796`. */
export function przeciwnyStatus(status: string): string {
  return status === STATUS_WSTRZYMANY ? STATUS_AKTYWNY : STATUS_WSTRZYMANY;
}

/** Etykieta przełącznika — port `:23807`. Opisuje SKUTEK kliknięcia, nie stan bieżący. */
export function etykietaPrzelacznika(status: string): string {
  return status === STATUS_WSTRZYMANY ? "Aktywuj" : "Wstrzymaj";
}

export function MenuAkcji({
  produkt,
  onEdytuj,
  onPrzelaczStatus,
  onUsun,
}: {
  produkt: Produkt;
  onEdytuj: (produkt: Produkt) => void;
  onPrzelaczStatus: (produkt: Produkt) => void;
  onUsun: (produkt: Produkt) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          data-testid={`button-actions-${produkt.id}`}
        >
          <EllipsisVertical className="w-4 h-4" />
          <span className="sr-only">Akcje</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={() => onEdytuj(produkt)}
          data-testid={`button-edit-${produkt.id}`}
        >
          <Pencil className="w-3.5 h-3.5 mr-2" />
          Edytuj
        </DropdownMenuItem>

        {/*
          `disabled` BEZ akcji — dokładnie jak w oryginale (`:23788`). Historia zmian
          produktu istnieje (widok `/historia` z I5, a od 12a backend pisze do niej przy
          każdej edycji), ale produkcja nigdy nie podpięła tego wejścia. Odtwarzamy stan
          faktyczny; ożywienie tej pozycji byłoby NOWĄ funkcją, nie portem.
        */}
        <DropdownMenuItem disabled>
          <History className="w-3.5 h-3.5 mr-2" />
          Historia
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onPrzelaczStatus(produkt)}>
          {/* Ta sama ikona w obie strony — oryginał nie podmienia jej na „Play" (`:23805`). */}
          <Pause className="w-3.5 h-3.5 mr-2" />
          {etykietaPrzelacznika(produkt.status)}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onUsun(produkt)}
          className="text-red-600 focus:text-red-600"
        >
          Usuń
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
