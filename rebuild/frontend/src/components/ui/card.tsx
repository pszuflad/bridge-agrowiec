/** Card — 1:1 z `deminified/frontend-index.js:16479-16533`. Używany przez placeholdery widoków. */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...reszta }, ref) => (
    <div
      ref={ref}
      className={cn(
        "shadcn-card rounded-xl border bg-card border-card-border text-card-foreground shadow-sm",
        className,
      )}
      {...reszta}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...reszta }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...reszta} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...reszta }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...reszta} />
  ),
);
CardContent.displayName = "CardContent";
