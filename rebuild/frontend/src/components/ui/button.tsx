/**
 * Button — shadcn/ui w wariancie z produkcji (`deminified/frontend-index.js:16183-16220`).
 * Warianty i rozmiary przepisane dosłownie, łącznie z `hover-elevate active-elevate-2`
 * i obramowaniami liczonymi z tokenu (`--primary-border` itd.).
 */
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const wariantyPrzycisku = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary-border",
        destructive: "bg-destructive text-destructive-foreground border border-destructive-border",
        outline: "border [border-color:var(--button-outline)] active:shadow-none",
        secondary: "border bg-secondary text-secondary-foreground border-secondary-border",
        ghost: "border border-transparent",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof wariantyPrzycisku> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...reszta }, ref) => {
    const Element = asChild ? Slot : "button";
    return (
      <Element
        className={cn(wariantyPrzycisku({ variant, size, className }))}
        ref={ref}
        {...reszta}
      />
    );
  },
);
Button.displayName = "Button";
