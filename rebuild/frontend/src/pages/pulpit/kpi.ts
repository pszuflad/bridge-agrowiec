/**
 * Liczenie kafli Pulpitu i wybór alertów — czyste funkcje, port `N2`
 * (`deminified/frontend-index.js:16852-16880`) i pomocników `j2`/`b2` (`:16762-16775`).
 *
 * Wydzielone z komponentu, żeby dało się je sprawdzić bez DOM-u: to tutaj siedzą wszystkie
 * progi, sortowania i jedna udokumentowana usterka produkcji (`ostatniEksport` niżej).
 */
import type { Alert } from "@/pages/alerty/api";
import { STATUS_NOWY } from "@/pages/alerty/api";
import type { WpisDziennikaZmian, DostawcaPulpitu } from "./api";

/** Ile alertów mieści karta „Najnowsze powiadomienia" (`slice(0, 5)`, `:16856`). */
export const LIMIT_ALERTOW_PULPITU = 5;

/**
 * Waga poziomu przy sortowaniu — 1:1 z `{krytyczny: 0, ostrzezenie: 1, info: 2}` (`:16853`).
 * Poziom spoza tej trójki wypada na koniec, zamiast wywracać porównanie na `undefined`.
 */
const WAGA_POZIOMU: Record<string, number> = { krytyczny: 0, ostrzezenie: 1, info: 2 };

function waga(poziom: string): number {
  return WAGA_POZIOMU[poziom] ?? Number.MAX_SAFE_INTEGER;
}

/** Port `j2` (`:16762`) — „dzisiaj" liczone po dacie lokalnej, nie po 24 godzinach wstecz. */
export function czyDzisiaj(iso: string | null | undefined, teraz: Date = new Date()): boolean {
  if (!iso) return false;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return false;
  return data.toDateString() === teraz.toDateString();
}

/**
 * Port `b2` (`:16769`) — „w tym tygodniu" to ostatnie SIEDEM DÓB, nie tydzień kalendarzowy.
 * Data z przyszłości daje `false` (warunek `n >= 0` oryginału), więc przestawiony zegar
 * na maszynie dostawcy nie napompuje licznika.
 */
export function czyWTymTygodniu(
  iso: string | null | undefined,
  teraz: Date = new Date(),
): boolean {
  if (!iso) return false;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return false;
  const dni = Math.floor((teraz.getTime() - data.getTime()) / 86_400_000);
  return dni >= 0 && dni < 7;
}

/**
 * Alerty do karty „Najnowsze powiadomienia" (`:16853-16856`): tylko `krytyczny`/`ostrzezenie`,
 * posortowane najpierw po wadze poziomu, potem po dacie MALEJĄCO, ucięte do pięciu.
 *
 * ⚠ ŹRÓDŁO ALERTÓW TO ŚWIADOME ODSTĘPSTWO (O-10f-1, decyzja D1 użytkownika z 2026-09-04).
 * Oryginał liczył tu pseudo-alerty katalogowe klientem (`pv()`, `:16631-16745` — marża
 * ujemna/niska, „nie-opona", brak importu ≥7/≥30 dni). Odbudowa karmi ten sam układ REALNYMI
 * alertami importu z `GET /api/alerts`, kontynuując decyzję D1 z Iteracji 6
 * (`docs/rebuild-backlog.md` #26). Powód: „Zobacz wszystkie" prowadzi do `/alerty`, a tamten
 * widok stoi na alertach importu — dwa różne zbiory pod jednym linkiem myliłyby bardziej
 * niż inne liczby. Sam DOBÓR i SORTOWANIE zostają portem 1:1.
 */
export function najswiezszeAlerty(alerty: Alert[]): Alert[] {
  return alerty
    .filter((a) => a.poziom === "krytyczny" || a.poziom === "ostrzezenie")
    .sort((a, b) =>
      waga(a.poziom) !== waga(b.poziom)
        ? waga(a.poziom) - waga(b.poziom)
        : new Date(b.data).getTime() - new Date(a.data).getTime(),
    )
    .slice(0, LIMIT_ALERTOW_PULPITU);
}

/** Alerty „aktywne" — status `nowy`, tak jak `pv(...).filter(e => "nowy" === e.status)` (`:16852`). */
export function aktywneAlerty(alerty: Alert[] | null | undefined): Alert[] {
  return (alerty ?? []).filter((a) => a.status === STATUS_NOWY);
}

/**
 * Kolejność dostawców w tabeli — port `parseInt(kod.replace(/\D/g, "")) || 0` (`:17038`).
 * Sortuje po LICZBIE w kodzie, więc „MO10" idzie po „MO9", a nie między „MO1" a „MO2",
 * jak zrobiłoby sortowanie napisów.
 */
export function sortujDostawcowPoKodzie(dostawcy: DostawcaPulpitu[]): DostawcaPulpitu[] {
  const numer = (kod: string) => parseInt(kod.replace(/\D/g, ""), 10) || 0;
  return [...dostawcy].sort((a, b) => numer(a.kod) - numer(b.kod));
}

/**
 * Wpis szukany przez kafel „Ostatni eksport CSV" — port `r.find(e => "eksport" === e.typ)`
 * (`:16852`).
 *
 * ⚠ TEN KAFEL JEST W PRODUKCJI TRWALE MARTWY I ODTWARZAMY GO MARTWYM (decyzja D3 użytkownika
 * z 2026-09-04). `GET /api/history` oddaje wiersze tabeli `history` — dziennik zmian pól
 * produktu — a te NIE MAJĄ pola `typ` (fixture `GET_history.json`: `{id, data, kodProduktu,
 * nazwa, pole, staraWartosc, nowaWartosc, zrodlo, kto, wykonalUzytkownikId}`). `find` nie
 * trafi więc nigdy i kafel zawsze pokazuje „—" / „Brak eksportów ani importów".
 *
 * Pole `typ` niesie INNA trasa — `GET /api/history/paged` (tabela `audit_log`, wartości
 * `eksport_csv`, `import_cennika`); podpięcie jej byłoby zmianą zachowania produkcji, więc
 * czeka na decyzję Ani jako wpis w `docs/rebuild-backlog.md`. Sygnatura celowo przyjmuje
 * `WpisDziennikaZmian[]`, żeby `typ` nie dało się tu odczytać przez przypadek — zwracamy
 * `null`, dopóki źródło się nie zmieni.
 */
export function znajdzPoTypie(
  wpisy: WpisDziennikaZmian[] | null | undefined,
  typ: "eksport" | "import",
): (WpisDziennikaZmian & { kiedy?: string; dostawca?: string; liczbaPozycji?: number }) | null {
  return (
    (wpisy ?? []).find(
      (w) => (w as unknown as Record<string, unknown>).typ === typ,
    ) ?? null
  );
}
