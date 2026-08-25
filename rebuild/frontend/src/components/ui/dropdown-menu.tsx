/**
 * DropdownMenu — shadcn/ui na Radiksie, klasy przepisane z produkcji
 * (`deminified/frontend-index.js:22626-22705`).
 *
 * Katalog używa tego w trzech miejscach: konfigurator kolumn oraz multi-select marki
 * i kategorii. Wszystkie trzy opierają się na `DropdownMenuCheckboxItem`.
 */
import * as Radix from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Radix.Root;
export const DropdownMenuTrigger = Radix.Trigger;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof Radix.Content>,
  ComponentPropsWithoutRef<typeof Radix.Content>
>(({ className, sideOffset = 4, ...reszta }, ref) => (
  <Radix.Portal>
    <Radix.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
      {...reszta}
    />
  </Radix.Portal>
));
DropdownMenuContent.displayName = Radix.Content.displayName;

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof Radix.Item>,
  ComponentPropsWithoutRef<typeof Radix.Item>
>(({ className, ...reszta }, ref) => (
  <Radix.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...reszta}
  />
));
DropdownMenuItem.displayName = Radix.Item.displayName;

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof Radix.CheckboxItem>,
  ComponentPropsWithoutRef<typeof Radix.CheckboxItem>
>(({ className, children, checked, ...reszta }, ref) => (
  <Radix.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    // `exactOptionalPropertyTypes` nie pozwala przekazać `checked: undefined` wprost.
    {...(checked === undefined ? {} : { checked })}
    {...reszta}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <Radix.ItemIndicator>
        <Check className="h-4 w-4" />
      </Radix.ItemIndicator>
    </span>
    {children}
  </Radix.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = Radix.CheckboxItem.displayName;

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof Radix.Label>,
  ComponentPropsWithoutRef<typeof Radix.Label> & { inset?: boolean }
>(({ className, inset, ...reszta }, ref) => (
  <Radix.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...reszta}
  />
));
DropdownMenuLabel.displayName = Radix.Label.displayName;

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof Radix.Separator>,
  ComponentPropsWithoutRef<typeof Radix.Separator>
>(({ className, ...reszta }, ref) => (
  <Radix.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...reszta} />
));
DropdownMenuSeparator.displayName = Radix.Separator.displayName;
