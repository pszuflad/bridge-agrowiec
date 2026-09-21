/**
 * Archiwum importów — typy, formatowanie i pobieranie pliku.
 *
 * Port `mirror/frontend/assets/archive-injection.js` (skrypt WSTRZYKIWANY do DOM obok żywego
 * bundla, nie komponent Reacta). Backend: `GET /api/import-archive` (+ `/stats`,
 * + `/file/{month}/{name}`) — `rebuild/backend/src/routes/import-archive.ts`.
 */
import { BAZA_API, naglowki } from "@/lib/api";

/** Pozycja listy — 11 pól z `archive_module.cjs:181-193` (`contract/fixtures/GET_import-archive.json`). */
export type PozycjaArchiwum = {
  id: string;
  dostawca: string;
  zrodlo: string | null;
  uzytkownik: string | null;
  data: string;
  oryginalnaNazwa: string;
  rozmiar: number;
  status: string;
  blad: string | null;
  rekordy: number | null;
  sha256: string | null;
};

export type ListaArchiwum = { ok: boolean; total: number; items: PozycjaArchiwum[] };

export type StatystykiArchiwum = {
  ok: boolean;
  plikow: number;
  bajtow: number;
  limitBajtow: number;
  retencjaDni: number;
  perMiesiac: Record<string, number>;
};

export type FiltryArchiwum = { dostawca: string; miesiac: string; status: string };

/** Wartość „bez filtra" w selectach — Radix nie dopuszcza pustego `value` (jak w Historii). */
export const WSZYSTKIE = "all";

export const OPCJE_STATUSU = [
  { wartosc: WSZYSTKIE, etykieta: "Każdy status" },
  { wartosc: "ok", etykieta: "OK" },
  { wartosc: "blad", etykieta: "Błąd parsowania" },
] as const;

/**
 * Adres listy z filtrami — kolejność parametrów jak w oryginale: dostawca, status, miesiąc
 * (`archive-injection.js:87-91`). Klucz zapytania = ten adres (konwencja `lib/queryClient.ts`).
 */
export function adresListy({ dostawca, miesiac, status }: FiltryArchiwum): string {
  const parametry = new URLSearchParams();
  if (dostawca !== WSZYSTKIE) parametry.set("dostawca", dostawca);
  if (status !== WSZYSTKIE) parametry.set("status", status);
  if (miesiac !== WSZYSTKIE) parametry.set("miesiac", miesiac);
  const qs = parametry.toString();
  return `/api/import-archive${qs ? `?${qs}` : ""}`;
}

/**
 * Opcje selectów dostawcy i miesiąca — liczone Z WCZYTANEJ (przefiltrowanej) LISTY, jak
 * w oryginale (`:148-149`): po wyborze dostawcy lista dostawców zawęża się do niego.
 *
 * Jedyna różnica: aktualnie wybrana wartość zostaje na liście nawet wtedy, gdy przestała
 * w niej występować (np. połączenie filtrów dało pustą listę). W oryginale `<select>` pokazywał
 * wtedy „Wszyscy dostawcy", choć filtr dalej działał — widok kłamał, co filtruje.
 */
export function opcjeFiltrow(
  pozycje: PozycjaArchiwum[],
  wybrane: Pick<FiltryArchiwum, "dostawca" | "miesiac">,
): { dostawcy: string[]; miesiace: string[] } {
  const dostawcy = new Set(pozycje.map((p) => p.dostawca).filter(Boolean));
  const miesiace = new Set(pozycje.map((p) => (p.id || "").split("/")[0] ?? "").filter(Boolean));
  if (wybrane.dostawca !== WSZYSTKIE) dostawcy.add(wybrane.dostawca);
  if (wybrane.miesiac !== WSZYSTKIE) miesiace.add(wybrane.miesiac);
  return {
    dostawcy: [...dostawcy].sort(),
    miesiace: [...miesiace].sort().reverse(),
  };
}

const MIESIACE = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

/** `fmtMonthLabel` (:123-126): „2026-09" → „wrzesień 2026". */
export function etykietaMiesiaca(rrrrMm: string): string {
  const [rok, miesiac] = rrrrMm.split("-").map(Number);
  return `${MIESIACE[(miesiac ?? 0) - 1] ?? rrrrMm} ${rok}`;
}

/** `fmtDate` (:109-115): czas LOKALNY przeglądarki, `DD.MM.RRRR GG:MM`. */
export function sformatujDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `fmtSize` (:116-122). */
export function sformatujRozmiar(bajty: number | null | undefined): string {
  if (bajty == null) return "—";
  if (bajty < 1024) return `${bajty} B`;
  if (bajty < 1024 * 1024) return `${(bajty / 1024).toFixed(1)} KB`;
  if (bajty < 1024 * 1024 * 1024) return `${(bajty / 1024 / 1024).toFixed(1)} MB`;
  return `${(bajty / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Pobranie pliku z archiwum — port `downloadFile` (:207-228).
 *
 * `fetch` z Bearerem → blob → kotwica `download`. Nie zwykła nawigacja z cookie (jak eksport
 * analityki): przeglądarka zapisałaby wtedy plik pod nazwą z `Content-Disposition`, czyli
 * ARCHIWALNĄ (`MO6__20260922__12345__MO6.csv`), a oryginał daje nazwę, pod którą plik
 * przyszedł od dostawcy — tej Ania szuka, porównując plik z katalogiem.
 *
 * Dwa segmenty ścieżki, każdy osobno zakodowany: Apache produkcji (`AllowEncodedSlashes=Off`)
 * odrzuca `%2F`, stąd łatka `.bak_dlfix_20260821`. `id` dzielimy na PIERWSZYM ukośniku.
 */
export async function pobierzPlikArchiwum(pozycja: Pick<PozycjaArchiwum, "id" | "oryginalnaNazwa">): Promise<void> {
  const id = String(pozycja.id);
  const ukosnik = id.indexOf("/");
  const miesiac = id.slice(0, ukosnik);
  const nazwa = id.slice(ukosnik + 1);
  const odpowiedz = await fetch(
    `${BAZA_API}/api/import-archive/file/${encodeURIComponent(miesiac)}/${encodeURIComponent(nazwa)}`,
    { headers: naglowki(false), credentials: "include" },
  );
  if (!odpowiedz.ok) throw new Error(`${odpowiedz.status} ${odpowiedz.statusText}`.trim());
  const blob = await odpowiedz.blob();
  const adres = URL.createObjectURL(blob);
  const kotwica = document.createElement("a");
  kotwica.href = adres;
  // Oryginał zdejmuje cudzysłowy z nazwy (atrybut `data-arch-name`, :190).
  kotwica.download = (pozycja.oryginalnaNazwa || "plik").replace(/"/g, "") || "plik";
  document.body.appendChild(kotwica);
  kotwica.click();
  kotwica.remove();
  setTimeout(() => URL.revokeObjectURL(adres), 5000);
}
