/**
 * Wygaszacz statusu promocji — „daty naprawdę kończą promocję" (karta 14f, backlog #19).
 *
 * ⚠ TO JEST ŚWIADOME ODSTĘPSTWO OD ORYGINAŁU, zatwierdzone przez Anię 2026-09-18
 * („data ma naprawdę kończyć promocje"). Produkcja NIE przelicza statusu promocji nigdy:
 * `status` zapisuje się RAZ, przy tworzeniu (front liczy go z dat w `Cb()`), `PATCH` go nie
 * wysyła (siedem pól, 1:1 z `Eb()`), a w `mirror/backend/index.cjs` napis `zaplanowana` pada
 * dokładnie raz — w literale seeda; `zakonczona` nie pada ANI RAZU. Skutkiem są DWA defekty
 * naraz, oba zmierzone w 14e (`docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md`):
 *   • wygasła promocja obniża ceny w nieskończoność;
 *   • promocja „zaplanowana" NIGDY SIĘ NIE WŁĄCZA — zostaje zaplanowana na zawsze.
 * Dlatego wygaszacz działa w OBIE strony, nie tylko wygasza.
 *
 * ⚠ DLACZEGO ZMIENIAMY DANE, A NIE SILNIK (wariant (b), decyzja użytkownika).
 * `promocjaPasuje` (`repos/ceny.ts`) zostaje NIETKNIĘTE — dalej patrzy wyłącznie na `status`
 * i dalej nie czyta dat. Silnik JUŻ honoruje status (zmierzone w 14e), więc wpisanie właściwego
 * `status` do bazy wyłącza rabat bez zmiany zachowania PORÓWNYWANEJ funkcji. Wariant (a)
 * — warunek na daty w `promocjaPasuje` — został odrzucony, bo kosztowałby wyjątek w wyroczni
 * charakteryzacji importu, czyli osłabienie najmocniejszej siatki, jaką w tym projekcie mamy.
 *
 * ⚠ GDZIE WOLNO GO WOŁAĆ — trzy miejsca, i ANI JEDNO WIĘCEJ:
 *   1. start procesu (`server.ts`, po `listen()`) — łapie wygaśnięcia z czasu postoju;
 *   2. wejście `przeliczCenyZRegul` (`repos/ceny.ts`) — wygaśnięcia między mutacjami reguł;
 *   3. cyklicznie, co `PROMO_WYGASZACZ_MINUTY` (domyślnie 5).
 * **NIE WOLNO go wołać na ścieżce importu** (`zastosujRegulyCenowe`, wpiętej w `acceptStaging`
 * i `addProductsBulk`). Tam rozjechałby charakteryzację i to od razu na DWÓCH tabelach
 * (`products` i `promotions`), bo zmieniłby dane, których oryginał nie rusza — czyli drożej
 * niż odrzucony wariant (a). Zmierzone: harness porównuje `acceptStaging`, a ta woła
 * `zastosujRegulyCenowe`, nie `przeliczCenyZRegul` (graf wywołań 14e, potwierdzony w 14f:
 * `przeliczCenyZRegul` wołane wyłącznie z `repos/markups.ts` i `repos/promotions.ts`).
 *
 * Cykliczność jest dla charakteryzacji DARMOWA (0 scenariuszy z 31 i 0 z 17), bo timery stoją
 * w `server.ts`, a cała suita — w tym harness — buduje aplikację przez `stworzApp`, bez
 * `listen()`. Pilnuje tego istniejący test `test/scheduler.test.ts` (brak `setInterval`
 * w `app.ts`) plus własny guard w `test/wygaszacz.test.ts`.
 */
import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { promotions } from "../db/schema.js";

/**
 * Trzy statusy rozpoznawane przez silnik cen.
 *
 * ⚠ NAPISY SĄ BEZ POLSKICH ZNAKÓW (`zaplanowana`, `zakonczona`) i takie MUSZĄ zostać —
 * to wartości zapisywane do kolumny `status`, identyczne z tymi, które produkuje front
 * (`pages/narzuty/status.ts`) i które siedzą w danych seeda oryginału
 * (`backend-index.cjs:45687`). „Poprawienie" ich na `zakończona` rozjechałoby nas
 * z istniejącymi danymi i z etykietą na liście.
 */
export const STATUS_AKTYWNA = "aktywna";
export const STATUS_ZAPLANOWANA = "zaplanowana";
export const STATUS_ZAKONCZONA = "zakonczona";

/** Domyślny odstęp między przebiegami — patrz `stworzWygaszacz`. */
export const DOMYSLNY_INTERWAL_MINUT = 5;

/**
 * Status wyliczony z dat — **dokładny port `statusZDat()`** z frontendu
 * (`rebuild/frontend/src/pages/narzuty/status.ts`, sam port `Qd()`, `frontend-index.js:9309`).
 * Obie implementacje MUSZĄ dawać ten sam napis dla tych samych dat, bo inaczej etykieta
 * na liście i kolumna `status` znów by się rozjechały — czyli wróciłby defekt, który ta
 * karta likwiduje.
 *
 * ⚠ DZIWACTWO PARSOWANIA, ODTWARZANE 1:1: `new Date("2026-08-31")` to północ **UTC**, więc
 * data końca jest „już po końcu" od swojej własnej północy UTC, a nie od końca tego dnia.
 * Tak liczy front i tak ma liczyć backend. Nie „naprawiać" tego na koniec dnia lokalnego
 * bez decyzji użytkownika — zmiana przesunęłaby granicę wygaszania o kilkanaście godzin.
 *
 * ⚠ Data niedająca się sparsować daje `NaN`, a oba porównania z `NaN` są fałszywe, więc
 * wynikiem jest `aktywna`. To również zachowanie frontu, zachowane świadomie.
 */
export function statusZDat(start: string, koniec: string, teraz: number = Date.now()): string {
  const od = new Date(start).getTime();
  const do_ = new Date(koniec).getTime();
  if (teraz < od) return STATUS_ZAPLANOWANA;
  if (teraz > do_) return STATUS_ZAKONCZONA;
  return STATUS_AKTYWNA;
}

/**
 * Jeden przebieg: ustawia `status` każdej promocji na wartość wyliczoną z jej dat.
 *
 * Działa w OBIE strony — `aktywna → zakonczona` po dacie końca, ale też
 * `zaplanowana → aktywna` po nadejściu daty startu (bez tego drugiego kierunku karta
 * naprawiłaby wygaszanie i zostawiła niedziałające planowanie).
 *
 * `UPDATE` leci TYLKO tam, gdzie status faktycznie się różni, więc przebieg na ustabilizowanej
 * bazie nie robi żadnego zapisu i jest idempotentny. Zwracana liczba zmienionych wierszy
 * służy logowi i testom — oryginał nie ma odpowiednika tej funkcji, więc nie ma czego naśladować.
 *
 * Projekcja wypisana JAWNIE — nie dlatego, że to odpowiedź API (nie jest), ale żeby zmiana
 * modelu nie wciągnęła tu po cichu wszystkich kolumn.
 */
export function zamiecStatusyPromocji(db: Baza, teraz: number = Date.now()): number {
  const wiersze = db
    .select({
      id: promotions.id,
      start: promotions.start,
      koniec: promotions.koniec,
      status: promotions.status,
    })
    .from(promotions)
    .all();

  let zmienione = 0;
  for (const wiersz of wiersze) {
    const docelowy = statusZDat(wiersz.start, wiersz.koniec, teraz);
    if (wiersz.status === docelowy) continue;
    db.update(promotions).set({ status: docelowy }).where(eq(promotions.id, wiersz.id)).run();
    zmienione += 1;
  }
  return zmienione;
}

export type Wygaszacz = {
  /** Start automatu: zamiata NATYCHMIAST (postój procesu), potem co `interwalMs`. */
  uruchom: () => number;
  zatrzymaj: () => void;
  czyDziala: () => boolean;
  /** Jeden przebieg na żądanie — używane przez testy. */
  zamiec: (teraz?: number) => number;
};

export type ZaleznosciWygaszacza = {
  db: Baza;
  /** `0` albo mniej = automat wyłączony; `uruchom()` zamiata raz i nie stawia timera. */
  interwalMs: number;
};

/**
 * Fabryka automatu — kształt 1:1 ze `stworzScheduler` (`src/import/scheduler.ts`), żeby oba
 * automaty w tym backendzie wyglądały tak samo: **sam obiekt jest bezczynny**, dopóki nikt
 * nie zawoła `uruchom()`, a `zatrzymaj()` sprząta. Na tej gwarancji stoi to, że timery nie
 * wchodzą do testów — warunek darmowej charakteryzacji (patrz nagłówek pliku).
 */
export function stworzWygaszacz({ db, interwalMs }: ZaleznosciWygaszacza): Wygaszacz {
  let timer: NodeJS.Timeout | null = null;

  const zamiec = (teraz: number = Date.now()): number => {
    try {
      return zamiecStatusyPromocji(db, teraz);
    } catch (e) {
      // Awaria zamiatania nie może wywrócić pętli zdarzeń ani startu procesu — promocje
      // zostaną wtedy ze starym statusem do najbliższego przebiegu, co jest stanem
      // sprzed tej karty, a nie nowym błędem.
      console.error("[wygaszacz] przebieg nieudany:", e);
      return 0;
    }
  };

  return {
    uruchom() {
      // Przebieg startowy jest OBOWIĄZKOWY, nie opcjonalny jak w schedulerze: tam pierwszy
      // przebieg siedzi za osobną flagą, bo odpytywałby realne serwery dostawców. Tutaj
      // „start procesu" jest jednym z trzech miejsc wymaganych decyzją karty — bez niego
      // wygaśnięcia z czasu postoju czekałyby do pierwszego cyklu.
      const zmienione = zamiec();
      if (zmienione > 0) {
        console.log(`[wygaszacz] start: przestawiono ${zmienione} promocji wg dat`);
      }

      if (interwalMs > 0) {
        timer = setInterval(() => zamiec(), interwalMs);
        // KONIECZNE, nie kosmetyczne: wiszący timer trzyma proces i wywraca `afterAll`.
        timer.unref();
        console.log(`[wygaszacz] cykl co ${Math.round(interwalMs / 60_000)} min`);
      } else {
        console.log("[wygaszacz] cykl wyłączony (PROMO_WYGASZACZ_MINUTY=0) — zamiecione raz");
      }
      return zmienione;
    },
    zatrzymaj() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    czyDziala: () => timer !== null,
    zamiec,
  };
}
