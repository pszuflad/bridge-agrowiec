/**
 * ZWIJANIE POWTÓREK — sedno Iteracji 6.
 *
 * ⚠ DLACZEGO TO ISTNIEJE. Import pisze alert przy KAŻDEJ nieudanej próbie, bez dławika
 * po stronie zapisu — to świadoma decyzja z bloku 3f-2: liczba powtórzeń jest sygnałem
 * diagnostycznym, a dławik kasowałby go bezpowrotnie. Ciężar spada więc tutaj.
 * Skala zmierzona w `db/snapshot.db`: 339 alertów „Błąd pobierania" (MO3: 150, MO5: 102,
 * MO4: 83, MO2: 4) wobec 4 × „Błąd HTTP" i 2127 × „Synchronizacja"; rekord to 23 alerty
 * na dobę dla samego MO3. Po włączeniu schedulera (3f-3, 120 pobrań/dobę) skala rośnie.
 * SUROWA LISTA JEST W TEJ SYTUACJI BEZUŻYTECZNA.
 *
 * ⚠ TYP NIE ROZRÓŻNIA PRZYCZYNY. „Błąd pobierania" obejmuje TAKŻE błędy parsera —
 * oryginał ma jeden blok `catch` wokół pobrania i parsowania (`backend-index.cjs:48100`,
 * `docs/rebuild-backlog.md` #16). Grupowanie po `typ` zmiesza więc dwie przyczyny; powód
 * jest w treści (`opis`), nie w typie, i widać go dopiero po rozwinięciu grupy. Tego się
 * NIE naprawia zmianą typu przy zapisie — to port 1:1, widok ma się dostosować.
 */
import type { Alert } from "./api";

export type GrupaAlertow = {
  /** Klucz techniczny `(dostawca, typ, status)` — stabilny identyfikator wiersza w UI. */
  klucz: string;
  dostawca: string | null;
  typ: string;
  status: string;
  /** Poziom NAJNOWSZEGO wpisu w grupie — patrz komentarz przy `pogrupujAlerty`. */
  poziom: string;
  liczba: number;
  /** `data` najnowszego wpisu w grupie (ISO). Po niej sortują się grupy. */
  ostatnia: string;
  /** Wpisy grupy, `data` MALEJĄCO — kolejność z backendu. */
  wpisy: Alert[];
};

export type FiltryAlertow = {
  status: string | null;
  dostawca: string | null;
  typ: string | null;
};

/** Domyślny stan filtrów: sama robota do zrobienia, bez 2127 wpisów „Synchronizacja". */
export const FILTRY_POCZATKOWE: FiltryAlertow = {
  status: "nowy",
  dostawca: null,
  typ: null,
};

/**
 * `dostawca` bywa `null` (alerty niezwiązane z żadnym dostawcą) — musi mieć własną grupę.
 *
 * Zastępnik ma WIODĄCĄ SPACJĘ celowo: kody dostawców to `MO2`…`MO9`, ale kolumna jest zwykłym
 * tekstem bez `CHECK`, więc nic nie broni Ani wpisać dostawcy o kodzie „brak". Spacja jest
 * jedynym znakiem, którego kod dostawcy nigdy nie ma na początku, i dzięki niej alert bez
 * dostawcy nie wpadnie do jego grupy.
 */
function kluczGrupy(alert: Alert): string {
  return `${alert.dostawca ?? " brak"}|${alert.typ}|${alert.status}`;
}

/**
 * Grupowanie po `(dostawca, typ, status)`.
 *
 * `status` JEST częścią klucza celowo: te same błędy przed i po obsłużeniu to dwie różne
 * pozycje na liście roboczej — inaczej zamknięcie połowy grupy nie byłoby nigdzie widać.
 *
 * `poziom` bierzemy z najnowszego wpisu, a nie z klucza: w praktyce jest funkcją typu
 * („Błąd pobierania" zawsze `ostrzezenie`), ale schemat tego nie gwarantuje — kolumna
 * nie ma `CHECK` — więc zamiast zakładać jednorodność, pokazujemy stan najświeższy.
 *
 * Wejście przychodzi z backendu posortowane `data` MALEJĄCO (`listAlerts`,
 * `backend-index.cjs:44951`). Nie polegamy na tym ślepo — wpisy w grupie sortujemy
 * jeszcze raz, żeby „ostatnio o 14:45" było prawdą także dla danych z innego źródła.
 *
 * @returns grupy posortowane po `ostatnia` MALEJĄCO (najświeższy problem na górze).
 */
export function pogrupujAlerty(alerty: Alert[]): GrupaAlertow[] {
  const grupy = new Map<string, GrupaAlertow>();

  for (const alert of alerty) {
    const klucz = kluczGrupy(alert);
    const grupa = grupy.get(klucz);
    if (grupa) {
      grupa.wpisy.push(alert);
    } else {
      grupy.set(klucz, {
        klucz,
        dostawca: alert.dostawca,
        typ: alert.typ,
        status: alert.status,
        poziom: alert.poziom,
        liczba: 0,
        ostatnia: alert.data,
        wpisy: [alert],
      });
    }
  }

  const wynik = [...grupy.values()];
  for (const grupa of wynik) {
    grupa.wpisy.sort((a, b) => porownajMalejaco(a.data, b.data));
    grupa.liczba = grupa.wpisy.length;
    grupa.ostatnia = grupa.wpisy[0]!.data;
    grupa.poziom = grupa.wpisy[0]!.poziom;
  }

  return wynik.sort((a, b) => porownajMalejaco(a.ostatnia, b.ostatnia));
}

/** Porównanie znaczników ISO malejąco. Na ISO 8601 porządek leksykalny = chronologiczny. */
function porownajMalejaco(a: string, b: string): number {
  if (a < b) return 1;
  if (a > b) return -1;
  return 0;
}

/** `null` w filtrze = brak zawężenia. Filtry łączą się operatorem AND. */
export function filtrujAlerty(alerty: Alert[], filtry: FiltryAlertow): Alert[] {
  return alerty.filter(
    (alert) =>
      (filtry.status === null || alert.status === filtry.status) &&
      (filtry.dostawca === null || alert.dostawca === filtry.dostawca) &&
      (filtry.typ === null || alert.typ === filtry.typ),
  );
}

export type WartosciFiltrow = {
  statusy: string[];
  dostawcy: string[];
  typy: string[];
};

/**
 * Listy wartości do rozwijanych filtrów — WYLICZANE Z DANYCH, nie zaszyte na sztywno.
 *
 * Import może dołożyć nowy typ alertu bez ruszania frontendu (i już to zrobił: „Ręczny
 * upload" to nasz dodatek z 3f-1, którego produkcja nie ma). Lista z literałów rozjechałaby
 * się przy pierwszej takiej zmianie i po cichu ukryła nowy rodzaj problemu.
 *
 * `dostawca: null` pomijamy — nie ma czym go w filtrze nazwać.
 */
export function wartosciFiltrow(alerty: Alert[]): WartosciFiltrow {
  const statusy = new Set<string>();
  const dostawcy = new Set<string>();
  const typy = new Set<string>();

  for (const alert of alerty) {
    statusy.add(alert.status);
    typy.add(alert.typ);
    if (alert.dostawca !== null && alert.dostawca !== "") dostawcy.add(alert.dostawca);
  }

  const posortuj = (zbior: Set<string>) => [...zbior].sort((a, b) => a.localeCompare(b, "pl"));
  return { statusy: posortuj(statusy), dostawcy: posortuj(dostawcy), typy: posortuj(typy) };
}

/**
 * „ostatnio 14:45" dla dzisiejszych wpisów, pełna data dla starszych.
 *
 * Alert sprzed tygodnia z samą godziną wyglądałby jak świeży — a to jest ekran, na którym
 * odróżnienie „psuje się teraz" od „psuło się w lipcu" jest całą treścią.
 */
export function sformatujOstatnia(kiedy: string, teraz: Date = new Date()): string {
  const data = new Date(kiedy);
  if (Number.isNaN(data.getTime())) return kiedy;

  const tenSamDzien =
    data.getFullYear() === teraz.getFullYear() &&
    data.getMonth() === teraz.getMonth() &&
    data.getDate() === teraz.getDate();

  return tenSamDzien
    ? data.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
    : data.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}
