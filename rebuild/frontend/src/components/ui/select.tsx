/**
 * Select — shadcn/ui na Radiksie, klasy przepisane z produkcji
 * (`deminified/frontend-index.js:20380-20468`).
 *
 * Katalog używa go do filtra statusu (jedyny filtr single-select na tym ekranie).
 */
import * as Radix from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/utils";

export const Select = Radix.Root;
export const SelectValue = Radix.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof Radix.Trigger>,
  ComponentPropsWithoutRef<typeof Radix.Trigger>
>(({ className, children, ...reszta }, ref) => (
  <Radix.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...reszta}
  >
    {children}
    <Radix.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </Radix.Icon>
  </Radix.Trigger>
));
SelectTrigger.displayName = Radix.Trigger.displayName;

export const SelectContent = forwardRef<
  ElementRef<typeof Radix.Content>,
  ComponentPropsWithoutRef<typeof Radix.Content>
>(({ className, children, position = "popper", ...reszta }, ref) => (
  <Radix.Portal>
    <Radix.Content
      ref={ref}
      position={position}
      className={cn(
        "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      {...reszta}
    >
      <Radix.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </Radix.Viewport>
    </Radix.Content>
  </Radix.Portal>
));
SelectContent.displayName = Radix.Content.displayName;

export const SelectItem = forwardRef<
  ElementRef<typeof Radix.Item>,
  ComponentPropsWithoutRef<typeof Radix.Item>
>(({ className, children, ...reszta }, ref) => (
  <Radix.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...reszta}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <Radix.ItemIndicator>
        <Check className="h-4 w-4" />
      </Radix.ItemIndicator>
    </span>
    <Radix.ItemText>{children}</Radix.ItemText>
  </Radix.Item>
));
SelectItem.displayName = Radix.Item.displayName;
