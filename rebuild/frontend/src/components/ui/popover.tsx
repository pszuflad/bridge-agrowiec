/**
 * Popover — shadcn/ui na Radiksie, klasy zgodne z `dropdown-menu.tsx` (ten sam token
 * `--popover` z motywu, więc oba wyskakujące panele wyglądają identycznie).
 *
 * Wniesione w bloku 10a. Powód, dla którego nie wystarczył istniejący `DropdownMenu`:
 * kontrolka filtra analityki ma w środku POLE TEKSTOWE, a `DropdownMenu` Radiksa
 * przechwytuje znaki na typeahead („skocz do pozycji zaczynającej się na…") i pole
 * traci znaki. `Popover` żadnego typeaheadu nie ma — patrz `components/WyborZWyszukiwarka.tsx`.
 */
import * as RadixPopover from "@radix-ui/react-popover";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;

export const PopoverContent = forwardRef<
  ElementRef<typeof RadixPopover.Content>,
  ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(({ className, align = "start", sideOffset = 4, ...reszta }, ref) => (
  <RadixPopover.Portal>
    <RadixPopover.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 rounded-md border border-popover-border bg-popover p-1 text-popover-foreground shadow-md outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...reszta}
    />
  </RadixPopover.Portal>
));
PopoverContent.displayName = RadixPopover.Content.displayName;
