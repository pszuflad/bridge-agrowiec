/**
 * Pozycje sidebara — 1:1 z `deminified/frontend-index.js:16287-16327` (`l2`),
 * z zachowaną kolejnością (Atrybuty PRZED Alertami, Waga przed Analityką).
 *
 * Uwaga na rozbieżność w opisie ticketa: aplikacja ma 12 TRAS, ale sidebar
 * ma 10 POZYCJI. `/moje-konto` jest osobnym linkiem w stopce sidebara,
 * a `/login` nie występuje w żadnym menu.
 */
import {
  Bell,
  History,
  Inbox,
  LayoutDashboard,
  Package,
  Percent,
  Scale,
  Settings,
  Tags,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type PozycjaNawigacji = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const POZYCJE_NAWIGACJI: PozycjaNawigacji[] = [
  { href: "/", label: "Pulpit", icon: LayoutDashboard },
  { href: "/staging", label: "Staging", icon: Inbox },
  { href: "/katalog", label: "Katalog", icon: Package },
  { href: "/narzuty", label: "Narzuty i promocje", icon: Percent },
  { href: "/atrybuty", label: "Atrybuty", icon: Tags },
  { href: "/alerty", label: "Alerty", icon: Bell },
  { href: "/waga-gabarytowa", label: "Waga gabarytowa", icon: Scale },
  { href: "/analityka", label: "Analityka", icon: TrendingUp },
  { href: "/historia", label: "Historia", icon: History },
  { href: "/konfiguracja", label: "Konfiguracja", icon: Settings },
];
