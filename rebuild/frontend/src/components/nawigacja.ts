/**
 * Pozycje sidebara — 1:1 z `deminified/frontend-index.js:16287-16327` (`l2`),
 * z zachowaną kolejnością (Atrybuty PRZED Alertami, Waga przed Analityką).
 *
 * Uwaga na rozbieżność w opisie ticketa: aplikacja ma 14 TRAS, ale sidebar
 * ma 12 POZYCJI. `/moje-konto` jest osobnym linkiem w stopce sidebara,
 * a `/login` nie występuje w żadnym menu.
 *
 * ⚠ „Selly" (ostatnia pozycja, dołożona w sesji 8b) to pierwsza z dwóch pozycji, których NIE MA w `l2`
 * oryginału. Produkcja nie miała dla Selly trasy Reacta w ogóle — link do sidebara
 * dokładał wstrzykiwany skrypt `mirror/frontend/assets/selly-injection.js:255-280`,
 * wstawiając go ZA „Konfiguracją", a sam panel overlayował `<main>` przy adresie `#/`.
 * Odbudowa robi z tego normalną trasę i normalną pozycję menu (odstępstwo O1,
 * `docs/tickets/30-FEATURE-selly-panel-frontend/plan.md`).
 *
 * Tak samo „Archiwum importów" (10. pozycja, ticket 91): w produkcji link doklejał skrypt
 * `archive-injection.js`, wstawiając go tuż ZA „Historią". Tu jest zwykłą pozycją — stąd 12, a nie 10.
 */
import {
  Archive,
  Bell,
  History,
  Inbox,
  LayoutDashboard,
  Package,
  PackageOpen,
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
  // Tuż za „Historią" — tam wstawiał link wstrzykiwany skrypt archiwum
  // (`mirror/frontend/assets/archive-injection.js:239-265`, `historia.after(link)`).
  // Oryginał klonował link Historii razem z ikoną; bierzemy własną z lucide (ticket 91).
  { href: "/archiwum", label: "Archiwum importów", icon: Archive },
  { href: "/konfiguracja", label: "Konfiguracja", icon: Settings },
  // Za „Konfiguracją" — tam wstawiał link oryginalny injection (`:255-280`).
  // Ikona: oryginał miał własne SVG „karton"; bierzemy najbliższą z lucide, bo `Package`
  // zajmuje już „Katalog" (decyzja D7).
  { href: "/selly", label: "Selly", icon: PackageOpen },
];
