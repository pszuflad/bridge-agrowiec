/**
 * Dialog — shadcn/ui na Radiksie, klasy przepisane z produkcji
 * (`deminified/frontend-index.js:18248-18305`).
 *
 * Katalog używa go do podglądu produktu. Przycisk zamykania ma w oryginale angielskie
 * `sr-only` „Close" — u nas po polsku, bo to tekst dla czytników ekranu, a cały panel
 * jest polskojęzyczny.
 */
import * as Radix from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Dialog = Radix.Root;
export const DialogTrigger = Radix.Trigger;
export const DialogClose = Radix.Close;

export const DialogOverlay = forwardRef<
  ElementRef<typeof Radix.Overlay>,
  ComponentPropsWithoutRef<typeof Radix.Overlay>
>(({ className, ...reszta }, ref) => (
  <Radix.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/80", className)} {...reszta} />
));
DialogOverlay.displayName = Radix.Overlay.displayName;

export const DialogContent = forwardRef<
  ElementRef<typeof Radix.Content>,
  ComponentPropsWithoutRef<typeof Radix.Content>
>(({ className, children, ...reszta }, ref) => (
  <Radix.Portal>
    <DialogOverlay />
    <Radix.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
        className,
      )}
      {...reszta}
    >
      {children}
      <Radix.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Zamknij</span>
      </Radix.Close>
    </Radix.Content>
  </Radix.Portal>
));
DialogContent.displayName = Radix.Content.displayName;

export function DialogHeader({ className, ...reszta }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...reszta} />;
}

export const DialogTitle = forwardRef<
  ElementRef<typeof Radix.Title>,
  ComponentPropsWithoutRef<typeof Radix.Title>
>(({ className, ...reszta }, ref) => (
  <Radix.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...reszta}
  />
));
DialogTitle.displayName = Radix.Title.displayName;

export const DialogDescription = forwardRef<
  ElementRef<typeof Radix.Description>,
  ComponentPropsWithoutRef<typeof Radix.Description>
>(({ className, ...reszta }, ref) => (
  <Radix.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...reszta}
  />
));
DialogDescription.displayName = Radix.Description.displayName;
