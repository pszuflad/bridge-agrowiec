/**
 * Scheduler pollingu dostawców URL — port `D4()` (`deminified/backend-index.cjs:48118-48131`).
 *
 * Cykliczne pobieranie cenników od dostawców z `sposobDostarczania = "url"`. W produkcji
 * obejmuje PIĘCIU dostawców (MO2, MO3, MO4, MO5, MO9), każdy co 60 minut — czyli 120 pobrań
 * na dobę (zmierzone w `db/snapshot.db`, roadmapa §5 blok 3f, SPROSTOWANIE 2026-09-01).
 *
 * ⚠ NIE PISZE WŁASNEGO POBIERANIA. Woła `synchronizujDostawce()` z `./synchronizuj.ts`
 * (port `L4()`, blok 3f-2) — i woła ją BEZ opcji, dokładnie jak oryginał (`L4(n.kod)`,
 * `:48127`). Znaczy to, że blokada `status === "wstrzymany"` na automacie DZIAŁA; flaga
 * `{recznie: true}` należy wyłącznie do trasy `synchronizuj-teraz` (`q4()`, `:48133`).
 *
 * ⚠ PRZEŁĄCZNIK `IMPORT_SCHEDULER`, DOMYŚLNIE WYŁĄCZONY (decyzja zaklepana 2026-09-01) —
 * świadome odstępstwo, produkcja przełącznika nie ma. Dwa powody: włączony scheduler na
 * stagingu odpytywałby REALNE serwery dostawców i podmieniał dane pod Anią w trakcie testów,
 * a przy braku dławika alertów (decyzja 3f-2) trwale padnięty dostawca zalewałby tabelę
 * alertów tempem ~24 wierszy na dobę. Sam warunek na przełącznik mieszka w `server.ts` —
 * ten moduł niczego nie uruchamia, dopóki nikt nie zawoła `uruchom()`.
 *
 * ⚠ UMIEJSCOWIENIE STARTU — ŚWIADOME ODSTĘPSTWO (decyzja użytkownika 2026-09-01).
 * Oryginał woła `D4()` w `M4()` (`:48167`), czyli w produkcyjnym odpowiedniku `stworzApp`,
 * przed rejestracją tras — zweryfikowane grafem wywołań: to JEDYNE wywołanie `D4()` w całym
 * bundlu (`function D4(` raz, `D4(` dwa razy łącznie w `mirror/backend/index.cjs`).
 * U nas start jest w `server.ts`, po `listen()`. Zachowanie procesu produkcyjnego jest
 * IDENTYCZNE, bo `stworzApp` jest tam wołane dokładnie raz, tuż przed `listen()` — różnica
 * dotyczy wyłącznie testów, w których `stworzApp` buduje KAŻDY scenariusz przez supertest
 * (`test/gate/aplikacja.ts`). Przy wiernym umiejscowieniu cała suita przechodziłaby przez
 * kod stawiający timery, a `stworzApp` nie ma gdzie zawiesić sprzątania; `server.ts` ma
 * już `zamknij()` na SIGTERM/SIGINT.
 */
import type { Baza } from "../db/index.js";
import { listaDostawcow, PROG_NIEAKTUALNOSCI_DNI } from "../repos/suppliers.js";
import type { OpcjeSynchronizacji, WynikSynchronizacji } from "./synchronizuj.js";

/** Podpis `synchronizujDostawce(...)` — ten sam, którego używa `trasyDostawcow`. */
export type FunkcjaSynchronizacji = (
  kod: string,
  opcje?: OpcjeSynchronizacji,
) => Promise<WynikSynchronizacji>;

/**
 * Odstęp między przebiegami startowymi kolejnych dostawców (patrz `pierwszyPrzebieg`).
 * Rozrzut, żeby pięciu dostawców nie ruszyło w tej samej sekundzie.
 */
export const ODSTEP_PIERWSZEGO_PRZEBIEGU_MS = 5_000;

const MS_NA_DOBE = 86_400_000;

export type ZaleznosciSchedulera = {
  db: Baza;
  /** JEDNA instancja na proces — ta sama, którą dostaje `trasyDostawcow` (nota 3f-2). */
  synchronizuj: FunkcjaSynchronizacji;
  /**
   * Przebieg zaraz po starcie, poza cyklem — ODSTĘPSTWO za osobnym przełącznikiem
   * `IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG`, domyślnie wyłączonym (decyzja użytkownika
   * 2026-09-01). Oryginał stawia sam `setInterval`, więc po włączeniu automatu przez
   * GODZINĘ nie dzieje się nic. Dla produkcji bez znaczenia (proces żyje ciągle), dla
   * testów Ani na stagingu to różnica między „widzę, że działa" a „nie wiem, czy
   * wystartowało". Domyślnie WYŁĄCZONE, więc proces produkcyjny zostaje 1:1.
   */
  pierwszyPrzebieg?: boolean;
  /** Wstrzykiwany w testach, żeby nie czekać rozrzutu w czasie rzeczywistym. */
  odstepPierwszegoPrzebieguMs?: number;
};

export type Scheduler = {
  /** Start automatu: planuje interwały i (jeśli włączone) przebiegi startowe. */
  uruchom: () => number;
  /**
   * Przeplanowanie po zmianie danych dostawcy (`PATCH /api/dostawcy/{id}`).
   * NIE-OPERACJA, gdy automat nie działa, i NIGDY nie odpala przebiegu startowego.
   */
  przeplanuj: () => number;
  zatrzymaj: () => void;
  czyDziala: () => boolean;
  /** Do testów: ile interwałów faktycznie wisi. */
  liczbaTimerow: () => number;
};

/** Pole `czestotliwoscMinuty` z projekcji kontraktowej. */
type DostawcaDoPlanowania = {
  kod: string;
  url: string | null;
  sposobDostarczania: string;
  czestotliwoscMinuty: number | null;
  status: string;
  ostatniPlik: string | null;
  liczbaProduktow: number;
};

/**
 * Powód pominięcia dostawcy — `null` znaczy „bierzemy do automatu".
 *
 * Kolejność warunków jest 1:1 z `D4()` (`:48123`):
 * `sposobDostarczania !== "url" || !url || !czestotliwoscMinuty || status === "wstrzymany"`.
 * Same treści powodów są NASZE — służą wyłącznie drugiej linii logu (patrz `zaplanuj`).
 */
function powodPominiecia(dostawca: DostawcaDoPlanowania, teraz: number): string | null {
  if (dostawca.sposobDostarczania !== "url") {
    return `sposób dostarczania: ${dostawca.sposobDostarczania || "brak"}`;
  }
  if (!dostawca.url) return "brak URL";
  if (!dostawca.czestotliwoscMinuty) return "brak częstotliwości";
  if (dostawca.status === "wstrzymany") return powodWstrzymania(dostawca, teraz);
  return null;
}

/**
 * Rozróżnia status WPISANY w bazie od PRZELICZONEGO w locie — i to jest sedno pułapki
 * opisanej w nagłówku `zaplanuj()`.
 */
function powodWstrzymania(dostawca: DostawcaDoPlanowania, teraz: number): string {
  if (dostawca.ostatniPlik) {
    const wiekDni = (teraz - new Date(dostawca.ostatniPlik).getTime()) / MS_NA_DOBE;
    if (wiekDni > PROG_NIEAKTUALNOSCI_DNI) {
      return (
        `status wstrzymany PRZELICZONY — ostatni plik sprzed ${Math.floor(wiekDni)} dni ` +
        `(próg: ${PROG_NIEAKTUALNOSCI_DNI}); w bazie status może być inny`
      );
    }
    return "status wstrzymany";
  }
  if (dostawca.liczbaProduktow === 0) {
    return "status wstrzymany PRZELICZONY — brak pliku i zero produktów w katalogu";
  }
  return "status wstrzymany";
}

export function stworzScheduler({
  db,
  synchronizuj,
  pierwszyPrzebieg = false,
  odstepPierwszegoPrzebieguMs = ODSTEP_PIERWSZEGO_PRZEBIEGU_MS,
}: ZaleznosciSchedulera): Scheduler {
  /** Odpowiednik `sh` z oryginału (`:48037`) — mapa `kod → timer`. */
  const interwaly = new Map<string, NodeJS.Timeout>();
  /** Oczekujące przebiegi startowe; trzymane osobno, żeby `zatrzymaj()` je też sprzątnął. */
  const przebiegiStartowe = new Set<NodeJS.Timeout>();
  let dziala = false;

  const odpal = (kod: string): void => {
    // Bez opcji — 1:1 z `L4(n.kod)` (`:48127`), więc blokada `wstrzymany` DZIAŁA na
    // automacie. `.catch()` jak w oryginale: awaria jednego dostawcy nie może wywrócić
    // pętli zdarzeń, a alert i tak zapisuje `synchronizujDostawce`.
    void synchronizuj(kod).catch(() => {});
  };

  function wyczyscInterwaly(): void {
    for (const timer of interwaly.values()) clearInterval(timer);
    interwaly.clear();
  }

  /**
   * Rdzeń `D4()`: czyści poprzednie interwały i stawia nowe. Wołanie wielokrotne jest
   * bezpieczne — timery się NIE mnożą, bo mapa jest czyszczona na wejściu.
   *
   * ⚠ PUŁAPKA 30 DNI, ODTWARZANA 1:1 (znaleziona 2026-09-01, sesja 3f-3). Dobór idzie po
   * `U.listSuppliers()` (`:48121`), a ta funkcja PRZELICZA `status` w locie (`:45026`):
   * `ostatniPlik` starszy niż 30 dni ⇒ `status = "wstrzymany"`. Tymczasem `L4()` sprawdza
   * `status` z SUROWEGO wiersza (`getSupplierByKod`, `:48039`). To dwa różne pojęcia statusu
   * i dają samozakleszczenie: dostawca nietknięty od 30 dni wypada z automatu, więc nigdy
   * nie zostanie odświeżony, więc już nie wróci. W produkcji niewidoczne, bo proces żyje
   * ciągle i odświeża `ostatniPlik` co godzinę — ale na stagingu ze snapshotu (`ostatni_plik
   * = 2026-08-13`) po 2026-09-13 automat zaplanuje ZERO dostawców. Dlatego druga linia logu.
   */
  function zaplanuj(zPrzebiegiemStartowym: boolean): number {
    wyczyscInterwaly();

    const teraz = Date.now();
    const dostawcy = listaDostawcow(db, teraz) as DostawcaDoPlanowania[];
    const pominieci: string[] = [];
    let zaplanowanych = 0;

    for (const dostawca of dostawcy) {
      const powod = powodPominiecia(dostawca, teraz);
      if (powod) {
        pominieci.push(`${dostawca.kod} (${powod})`);
        continue;
      }

      const kod = dostawca.kod;
      const interwalMs = (dostawca.czestotliwoscMinuty ?? 0) * 60 * 1000;
      const timer = setInterval(() => odpal(kod), interwalMs);
      // KONIECZNE, nie kosmetyczne: wiszący timer trzyma proces i wywraca `afterAll`.
      timer.unref();
      interwaly.set(kod, timer);

      if (zPrzebiegiemStartowym) {
        const opoznienie = zaplanowanych * odstepPierwszegoPrzebieguMs;
        const start: NodeJS.Timeout = setTimeout(() => {
          przebiegiStartowe.delete(start);
          odpal(kod);
        }, opoznienie);
        start.unref();
        przebiegiStartowe.add(start);
      }

      zaplanowanych += 1;
    }

    // Treść 1:1 z oryginałem (`:48130`) — po niej poznaje się scheduler w logach produkcji.
    console.log(`[scheduler] zaplanowano ${zaplanowanych} dostawców z URL polling`);
    // NASZA linia (decyzja użytkownika 2026-09-01) — wyłącznie log, zero wpływu na dobór.
    // Bez niej „zaplanowano 0" nie mówi, czy to konfiguracja, czy pułapka 30 dni.
    if (pominieci.length > 0) {
      console.log(`[scheduler] pominięto: ${pominieci.join(", ")}`);
    }
    return zaplanowanych;
  }

  return {
    uruchom() {
      dziala = true;
      return zaplanuj(pierwszyPrzebieg);
    },
    przeplanuj() {
      if (!dziala) return 0;
      // Bez przebiegu startowego — inaczej każdy zapis w panelu waliłby w pięć serwerów
      // dostawców naraz (decyzja użytkownika 2026-09-01).
      return zaplanuj(false);
    },
    zatrzymaj() {
      dziala = false;
      wyczyscInterwaly();
      for (const timer of przebiegiStartowe) clearTimeout(timer);
      przebiegiStartowe.clear();
    },
    czyDziala: () => dziala,
    liczbaTimerow: () => interwaly.size,
  };
}
