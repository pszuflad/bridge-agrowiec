import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Odpowiednik `Ce` z oryginalnego bundla — łączenie klas z rozstrzyganiem konfliktów Tailwinda. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
