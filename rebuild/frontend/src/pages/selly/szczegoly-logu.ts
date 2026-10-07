/**
 * Czytanie `szczegoly_json` z `selly_sync_log` i grupowanie operacji — ticket 194.
 *
 * Panel Selly pokazywał dotąd w „Historii operacji" same liczby (OK / Błąd / Skip). Tu: skąd się biorą błędy,
 * co dokładnie usunięto z Selly i co oznaczają wpisy próby uprawnień. Wszystko defensywnie — wpisy sprzed
 * ticketu 194 mają inny kształt, a stare (ucięte po 8000 znaków) potrafią nie być poprawnym JSON-em.
 */

export type RodzajBledu = "pending_create" | "tozsamosc" | "inne";

export type ProbkaBledu = { kod: string; error: string; rodzaj: RodzajBledu };

export type WpisUsunieciaZLogu = {
  kod: string;
  nazwa: string | null;
  akcja: string;
  powod?: string | undefined;
};

export type SzczegolyWpisu =
  | { rodzaj: "brak" }
  | { rodzaj: "uszkodzone"; poczatek: string }
  | {
      rodzaj: "synchronizacja";
      stats: Record<string, number>;
      bledyWgRodzaju: Record<RodzajBledu, number> | null;
      probka: ProbkaBledu[];
      kolizje: number;
      uciete: number;
    }
  | { rodzaj: "usuwanie"; sieroty: number | null; wpisy: WpisUsunieciaZLogu[]; wstrzymano: string | null; uciete: number }
  | { rodzaj: "opis"; opis: string }
  | { rodzaj: "inne"; tekst: string };

/** Ta sama reguła, co `rodzajBledu()` w backendzie (`sync-delta.ts`) — dla wpisów sprzed ticketu 194. */
export function rodzajBleduZKomunikatu(komunikat: string): RodzajBledu {
  if (komunikat.includes("brak dictMaps do createProduct") || komunikat.includes("produkt nie istnieje w Selly"))
    return "pending_create";
  if (komunikat.includes("zapis zablokowany")) return "tozsamosc";
  return "inne";
}

const liczba = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function czyToUsuwanie(operacja: string): boolean {
  return operacja === "sync_delete" || operacja.startsWith("probe_delete");
}

export type FiltrOperacji = "wszystko" | "synchronizacja" | "usuwanie";

export const ETYKIETY_FILTRU: Record<FiltrOperacji, string> = {
  wszystko: "Wszystkie operacje",
  synchronizacja: "Synchronizacja cen i stanów",
  usuwanie: "Usuwanie z Selly",
};

export function pasujeDoFiltru(operacja: string, filtr: FiltrOperacji): boolean {
  if (filtr === "wszystko") return true;
  return filtr === "usuwanie" ? czyToUsuwanie(operacja) : !czyToUsuwanie(operacja);
}

export function analizujSzczegoly(operacja: string, szczegolyJson: string | null | undefined): SzczegolyWpisu {
  if (!szczegolyJson) return { rodzaj: "brak" };
  let dane: unknown;
  try {
    dane = JSON.parse(szczegolyJson);
  } catch {
    return { rodzaj: "uszkodzone", poczatek: szczegolyJson.slice(0, 300) };
  }
  if (dane === null || typeof dane !== "object" || Array.isArray(dane)) {
    return { rodzaj: "inne", tekst: String(szczegolyJson).slice(0, 500) };
  }
  const d = dane as Record<string, unknown>;

  if (operacja.startsWith("probe_delete") && typeof d.opis === "string") return { rodzaj: "opis", opis: d.opis };

  if (operacja === "sync_delete") {
    const wpisy = (Array.isArray(d.wpisy) ? d.wpisy : [])
      .filter((w): w is Record<string, unknown> => !!w && typeof w === "object")
      .map((w) => ({
        kod: String(w.kod ?? "—"),
        nazwa: typeof w.nazwa === "string" ? w.nazwa : null,
        akcja: String(w.akcja ?? "—"),
        powod: typeof w.powod === "string" ? w.powod : undefined,
      }));
    return {
      rodzaj: "usuwanie",
      sieroty: typeof d.sieroty === "number" ? d.sieroty : null,
      wpisy,
      wstrzymano: typeof d.wstrzymano === "string" ? d.wstrzymano : null,
      uciete: liczba(d.ucieto_wpisow),
    };
  }

  if (d.stats && typeof d.stats === "object") {
    const stats = Object.fromEntries(
      Object.entries(d.stats as Record<string, unknown>).filter(([, v]) => typeof v === "number"),
    ) as Record<string, number>;
    const surowe = Array.isArray(d.sample_errors) ? d.sample_errors : [];
    const probka: ProbkaBledu[] = surowe
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .map((e) => {
        const error = String(e.error ?? "");
        const rodzaj =
          e.rodzaj === "pending_create" || e.rodzaj === "tozsamosc" || e.rodzaj === "inne"
            ? e.rodzaj
            : rodzajBleduZKomunikatu(error);
        return { kod: String(e.kod ?? "—"), error, rodzaj };
      });
    const r = d.bledy_wg_rodzaju as Record<string, unknown> | undefined;
    const bledyWgRodzaju = r
      ? { pending_create: liczba(r.pending_create), tozsamosc: liczba(r.tozsamosc), inne: liczba(r.inne) }
      : null;
    return {
      rodzaj: "synchronizacja",
      stats,
      bledyWgRodzaju,
      probka,
      kolizje: Array.isArray(d.kolizje) ? d.kolizje.length : 0,
      uciete: liczba(d.ucieto_sample_errors),
    };
  }

  // Ręczny „Sync dostawcy" (`sync_supplier`): `{dostawca, total, created, updated, failed, skipped, errors: […]}`.
  if (Array.isArray(d.errors)) {
    const probka: ProbkaBledu[] = d.errors.slice(0, 20).map((e) => {
      const obiekt = e && typeof e === "object" ? (e as Record<string, unknown>) : {};
      const error = typeof e === "string" ? e : String(obiekt.error ?? obiekt.message ?? JSON.stringify(e));
      return { kod: String(obiekt.kod ?? "—"), error, rodzaj: rodzajBleduZKomunikatu(error) };
    });
    return {
      rodzaj: "synchronizacja",
      stats: {
        total: liczba(d.total),
        ok: liczba(d.created) + liczba(d.updated),
        err: liczba(d.failed),
        skip: liczba(d.skipped),
      },
      bledyWgRodzaju: null,
      probka,
      kolizje: 0,
      uciete: 0,
    };
  }

  return { rodzaj: "inne", tekst: JSON.stringify(d).slice(0, 500) };
}

/**
 * Czas wpisu w lokalnej strefie. SQLite zapisuje `datetime('now')` (UTC, bez znacznika strefy), a audyt — ISO z `Z`;
 * oba są UTC, więc „2026-10-06 10:56:06" to u nas 12:56. Oryginał wypisywał tekst bez przeliczenia, co mylnie
 * wyglądało na „stare" wpisy.
 */
export function formatujCzasLokalny(znacznik: string | null | undefined): string {
  if (!znacznik) return "—";
  const tekst = znacznik.trim();
  const maStrefe = /([zZ]|[+-]\d\d:?\d\d)$/.test(tekst);
  const iso = tekst.replace(" ", "T") + (maStrefe ? "" : "Z");
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return tekst.slice(0, 19).replace("T", " ");
  return data.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "medium" });
}
