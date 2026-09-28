/**
 * Logo Bridge — SVG przepisany 1:1 z `deminified/frontend-index.js:16244-16285` (`Nd`).
 * Most: dwa filary, główny łuk, cieńszy łuk wewnętrzny i linia pomostu.
 * Wszystko na `currentColor`, więc kolor nadaje klasa (`text-primary`, `text-sidebar-primary`).
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-label="Bridge"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="6" cy="28" r="2.5" fill="currentColor" />
      <circle cx="34" cy="28" r="2.5" fill="currentColor" />
      <path
        d="M6 28 Q 20 4, 34 28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6 28 Q 20 14, 34 28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <line x1="6" y1="28" x2="34" y2="28" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
    </svg>
  );
}
