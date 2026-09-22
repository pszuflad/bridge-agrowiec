/**
 * Liczenie kafli Pulpitu i wybór alertów — czyste funkcje, port `N2`
 * (`deminified/frontend-index.js:16852-16880`) i pomocników `j2`/`b2` (`:16762-16775`).
 *
 * Wydzielone z komponentu, żeby dało się je sprawdzić bez DOM-u: to tutaj siedzą wszystkie
 * progi, sortowania i rysunek kafla „Ostatni eksport CSV" (`opisKafelkaEksportu` niżej —
 * świadome odstępstwo: w produkcji ten kafel jest martwy, backlog #34).
 */
import { STATUS_NOWY } from "@/pages/alerty/api";
import type { StronaHistorii } from "@/pages/historia/dane";
import type { DostawcaPulpitu } from "./api";
import { sformatujWzglednie } from "./czas";
import type { Zmiana } from "./KafelKpi";

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
 * Minimalny kształt alertu, na którym działa dobór — wspólny dla alertów importu (`Alert`
 * z `GET /api/alerts`) i pseudo-alertów katalogowych (`AlertKatalogu` z silnika P6.2).
 */
export type AlertDoPulpitu = { poziom: string; status: string; data: string };

/**
 * Alerty do karty „Najnowsze powiadomienia" (`:16853-16856`): tylko `krytyczny`/`ostrzezenie`,
 * posortowane najpierw po wadze poziomu, potem po dacie MALEJĄCO, ucięte do pięciu.
 *
 * ŹRÓDŁA (decyzja 3 użytkownika z 2026-09-21, karta P6.2 — `docs/rebuild-backlog.md` #26).
 * Oryginał karmił kartę WYŁĄCZNIE pseudo-alertami katalogowymi (`pv()`); odbudowa do P6.2 —
 * wyłącznie alertami importu (O-10f-1, D1 z 2026-09-04). Od P6.2 Pulpit pokazuje OBA źródła
 * z podziałem na dwie sekcje i ta funkcja jest wołana osobno dla każdej z nich. Sam DOBÓR
 * i SORTOWANIE zostają portem 1:1.
 */
export function najswiezszeAlerty<A extends AlertDoPulpitu>(alerty: readonly A[]): A[] {
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
export function aktywneAlerty<A extends AlertDoPulpitu>(alerty: readonly A[] | null | undefined): A[] {
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

/** Stan jednego z dwóch zapytań kafla „Ostatni eksport CSV" — tyle, ile potrzeba do rysunku. */
export type ZrodloKafelkaEksportu = {
  /** Odpowiedź `GET /api/history/paged?…&limit=1`; `null` przy wygasłej sesji, `undefined` w trakcie ładowania. */
  strona: StronaHistorii | null | undefined;
  blad: boolean;
};

/** Tekst podpisu przy błędzie zapytania — spoza oryginału (plan.md D3 ticketu 96). */
export const PODPIS_BLEDU_HISTORII = "Nie udało się pobrać historii";

/**
 * Wartość i podpis kafla „Ostatni eksport CSV" — port rysunku z `N2` (`:16852`, `:16902-16917`).
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO (backlog #34, decyzja Ani 2026-09-21 „niech zacznie pokazywać datę";
 * karta P10.2, ticket 96). W produkcji kafel jest TRWALE MARTWY: szuka `find(e => e.typ ===
 * "eksport")` w `GET /api/history` (tabela `history`, dziennik zmian pól produktu), której
 * wiersze pola `typ` nie mają — zawsze „—" / „Brak eksportów ani importów". Tutaj wpisy
 * przychodzą z `GET /api/history/paged` (tabela `audit_log`), najnowszy wpis każdego typu.
 *
 * 1:1 z oryginałem zostają: teksty, format daty (`Bu` = `sformatujWzglednie`) i KOLEJNOŚĆ
 * gałęzi — import trafia do podpisu tylko wtedy, gdy nie ma żadnego eksportu. Także quirk
 * eksportu ZIP „wszyscy": backend liczy mu `liczbaPozycji` z `liczbaDostawcow`, więc podpis
 * brzmi „wszyscy — 10 produktów", gdzie 10 to liczba DOSTAWCÓW (Historia pokazuje to samo).
 *
 * „Eksport" i „import" znaczą tyle, co w Historii — słownik akcji backendu
 * (`historia/mapowanie.ts`): eksport = `eksport_csv` (pojedynczy dostawca i ZIP) oraz
 * `eksport_shoper`; import = `upload_pliku` i `import_cennika`. Generowanie CSV dla Selly
 * audytu nie pisze, więc się nie liczy — i nie poszerzamy słownika (backlog #21).
 *
 * Nowe względem oryginału jest tylko zachowanie przy BŁĘDZIE (D3): „—" i podpis
 * {@link PODPIS_BLEDU_HISTORII}, zamiast udawać, że eksportów nie było. Błąd zapytania
 * o import liczy się dopiero wtedy, gdy import byłby pokazany (brak eksportu).
 * Ładowanie rysuje pusty stan — jak oryginał, który ma `data: r = []`.
 */
export function opisKafelkaEksportu(
  eksport: ZrodloKafelkaEksportu,
  imp: ZrodloKafelkaEksportu,
  teraz: Date = new Date(),
): { wartosc: string; zmiana: Zmiana } {
  const ostatniEksport = eksport.strona?.items[0];
  if (ostatniEksport) {
    return {
      wartosc: sformatujWzglednie(ostatniEksport.kiedy, teraz),
      zmiana: {
        kierunek: "none",
        text: `${ostatniEksport.dostawca ?? "wszyscy"} — ${ostatniEksport.liczbaPozycji ?? 0} produktów`,
      },
    };
  }
  if (eksport.blad) return { wartosc: "—", zmiana: { kierunek: "none", text: PODPIS_BLEDU_HISTORII } };

  const ostatniImport = imp.strona?.items[0];
  if (ostatniImport) {
    return {
      wartosc: "—",
      zmiana: {
        kierunek: "none",
        text: `Ostatni import: ${sformatujWzglednie(ostatniImport.kiedy, teraz)}`,
      },
    };
  }
  if (imp.blad) return { wartosc: "—", zmiana: { kierunek: "none", text: PODPIS_BLEDU_HISTORII } };

  return { wartosc: "—", zmiana: { kierunek: "none", text: "Brak eksportów ani importów" } };
}
