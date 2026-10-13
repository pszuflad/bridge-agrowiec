/** Pełne polskie nazwy krajów po kodzie (ticket 254) — do podglądu obok kodów w panelu partnerów. Bez zasobów zewnętrznych: `Intl.DisplayNames` przeglądarki. */
const WYJATKI: Record<string, string> = {
  EL: "Grecja", // kod VAT UE (ISO: GR)
  XI: "Irlandia Północna", // kod VAT UE
  UK: "Wielka Brytania", // potoczny kod (ISO: GB)
};

let nazwy: Intl.DisplayNames | null | undefined;

/** Polska nazwa kraju dla dwuliterowego kodu (np. „AT” → „Austria”); `null`, gdy kodu nie da się rozpoznać. */
export function nazwaKraju(kod: string | null | undefined): string | null {
  const k = (kod ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(k)) return null;
  if (WYJATKI[k]) return WYJATKI[k]!;
  if (nazwy === undefined) {
    try {
      nazwy = new Intl.DisplayNames(["pl"], { type: "region", fallback: "none" });
    } catch {
      nazwy = null;
    }
  }
  try {
    const n = nazwy?.of(k);
    // Nieznany kod: Intl oddaje sam kod albo „Nieznany region” (np. ZZ) — wtedy nie udajemy, że to nazwa.
    return n && n !== k && !/nieznan/i.test(n) ? n : null;
  } catch {
    return null;
  }
}

/** „AT — Austria” albo sam kod, gdy nazwy nie ma. */
export const kodZNazwa = (kod: string): string => {
  const n = nazwaKraju(kod);
  return n ? `${kod} — ${n}` : kod;
};
