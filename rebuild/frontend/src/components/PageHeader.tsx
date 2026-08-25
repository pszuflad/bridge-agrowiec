/** Nagłówek widoku — 1:1 z `deminified/frontend-index.js:16458-16478` (`hn`). */
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 pb-5 border-b border-border">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
