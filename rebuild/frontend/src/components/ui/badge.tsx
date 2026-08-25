/**
 * Badge — shadcn/ui w wariancie z produkcji (`deminified/frontend-index.js:16558-16583`).
 * Warianty i klasy przepisane dosłownie, łącznie ze spacją na początku wariantu `outline`.
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const wariantyOdznaki = cva(
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover-elevate ",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-xs",
        outline: " border [border-color:var(--badge-outline)] shadow-xs",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof wariantyOdznaki>;

export function Badge({ className, variant, ...reszta }: BadgeProps) {
  return <div className={cn(wariantyOdznaki({ variant }), className)} {...reszta} />;
}
