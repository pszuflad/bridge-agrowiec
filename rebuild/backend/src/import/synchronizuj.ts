/**
 * Synchronizacja dostawcy spod URL — port `L4()` (`deminified/backend-index.cjs:48038-48116`).
 *
 * ⚠ TO NIE JEST `src/import/pobierz.ts`. Produkcja ma DWA różne pobieracze i to nie jest
 * niedopatrzenie, tylko dwa mechanizmy powstałe w różnym czasie (roadmapa §5, blok 3f-2,
 * SPROSTOWANIE 2026-09-01 — fakt zweryfikowany w wysłanym bundlu):
 *
 *   | | `downloadUrl` (extensions.cjs:26) | `L4()` (rdzeń, :48038) |
 *   |---|---|---|
 *   | Transport      | `node:http` / `node:https`  | `fetch` + `AbortController` |
 *   | Timeout        | 60 s (`req.setTimeout`)     | 30 s (`setTimeout` → `abort`) |
 *   | Przekierowania | ręcznie, rekurencją         | zostawione `fetch` (sam śledzi) |
 *   | Woła to        | `POST /api/import/from-url` | `synchronizuj-teraz` + scheduler |
 *   | Nasz port      | `src/import/pobierz.ts`     | TEN PLIK |
 *
 * Decyzja użytkownika 2026-09-01: zostają OSOBNO. Różnica jest obserwowalna — komunikaty
 * undici („fetch failed", „This operation was aborted", „terminated") lądują dosłownie
 * w treści alertu i tak wyglądają wszystkie 339 alertów „Błąd pobierania" w produkcyjnym
 * `db/snapshot.db`. Sklejenie obu pobieraczy zmieniłoby też transport trasy z 3b.
 */
import { extname } from "node:path";
import { czyStareZrodlo, najnowszyPlik, zapiszCsvZRekordow } from "./katalog-importow.js";
import type { Baza } from "../db/index.js";
import { zapiszAlert } from "../repos/alerts.js";
import {
  dostawcaPoKodzie,
  oznaczBladDostawcy,
  zapiszWynikImportu,
} from "../repos/suppliers.js";
import {
  aktualizujMeta,
  archiwizujBufor,
  type MetaArchiwum,
  type OpcjeArchiwizacji,
} from "./archiwum.js";
import { parsujAgrorami, parsujBufor } from "./parsuj.js";
import { silnikStagingu, type SilnikStagingu, type StatystykiImportu } from "./tk.js";

/**
 * Timeout żądania — 120 s. Oryginał miał 30 s (`:48054`); w logach produkcji AbortError dotykał MO3 ×55,
 * MO5 ×17, MO4 ×9, bo ich serwery odpowiadają wolno. Decyzja użytkowniczki 2026-10-01 (Etap 4a SPEC). NIE mylić
 * z 60 s w `pobierz.ts`.
 */
export const TIMEOUT_SYNCHRONIZACJI_MS = 120_000;
/** Dodatkowe próby po nieudanej pierwszej (razem 3), odstęp między nimi — Etap 4a. */
export const PONOWIENIA_SYNCHRONIZACJI = 2;
export const ODSTEP_PONOWIEN_MS = 120_000;

export type WynikSynchronizacji =
  | ({ ok: true; liczbaProduktow: number } & StatystykiImportu)
  | { ok: false; error: string };

export type ZaleznosciSynchronizacji = {
  db: Baza;
  /** Katalog archiwum; `undefined` = domyślny `<cwd>/import_archive`. */
  katalogArchiwum?: string;
  /** Wstrzykiwany w testach, tak samo jak w `trasyImportu` i `trasyDostawcow`. */
  silnik?: SilnikStagingu;
  /** Odstęp między ponowieniami; domyślnie `SYNC_ODSTEP_PONOWIEN_MS` z env albo 120 s (testy ustawiają 0). */
  odstepPonowienMs?: number;
  /** Czekanie między próbami — wstrzykiwane w testach, żeby sprawdzić odstępy bez czekania. */
  czekaj?: (ms: number) => Promise<void>;
};

const domyslnyOdstep = (): number => {
  const z = Number(process.env.SYNC_ODSTEP_PONOWIEN_MS);
  return Number.isFinite(z) && process.env.SYNC_ODSTEP_PONOWIEN_MS !== undefined && z >= 0
    ? z
    : ODSTEP_PONOWIEN_MS;
};

/** Błąd odpowiedzi 5xx — jedyna odpowiedź HTTP, którą wolno ponowić (4xx to błąd po naszej/dostawcy stronie). */
class OdpowiedzSerwera extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

export type OpcjeSynchronizacji = {
  /**
   * Ręczne uruchomienie z panelu — omija blokadę `status === "wstrzymany"`.
   *
   * Oryginał nazywa tę flagę `rrcznie` (literalnie, z podwójnym „r" — jest tak w wysłanym
   * bundlu w OBU miejscach, w odczycie `:48049` i w zapisie `q4()` `:48134`, więc działa).
   * Nie przenosimy literówki; nazwa flagi jest wewnętrzna i nie wychodzi do API.
   */
  recznie?: boolean;
  /** Imię i nazwisko do metadanych archiwum; scheduler (3f-3) nie ma użytkownika. */
  uzytkownik?: string | null;
};

/**
 * Ostatni segment ścieżki URL — nazwa pliku do archiwum.
 *
 * Oryginalne `L4()` nazwy pliku NIE liczy: `nq()` archiwizuje pod sztywnym `"rdzen" + ext`
 * (`:48016`). Nazwa z URL-a jest naszym dodatkiem i jest czysto opisowa — trafia wyłącznie
 * do metadanych archiwum, nigdzie indziej.
 */
function nazwaPlikuZUrl(url: string, rozszerzenie: string): string {
  try {
    const segmenty = new URL(url).pathname.split("/").filter(Boolean);
    return segmenty[segmenty.length - 1] || `import${rozszerzenie}`;
  } catch {
    return `import${rozszerzenie}`;
  }
}

/**
 * Rozszerzenie dla parsera — 1:1 z `:48071`: z URL-a, a gdy ścieżka go nie ma,
 * z `formatPliku` dostawcy, a gdy i tego brak — `.csv`.
 */
function rozszerzenieDlaParsera(url: string, formatPliku: string | null): string {
  let zUrl = "";
  try {
    zUrl = extname(new URL(url).pathname);
  } catch {
    zUrl = "";
  }
  return zUrl || `.${String(formatPliku || "csv").toLowerCase()}`;
}

/**
 * `L4(kod, opcje)` — pobierz cennik spod URL dostawcy i przepuść go przez staging.
 *
 * Kolejność bramek, treść błędów i treść alertów są portem 1:1. Świadome odstępstwa,
 * wszystkie opisane w roadmapie §5, blok 3f:
 *
 *  1. **BRAK fallbacku `Wc()`** (decyzja zaklepana 2026-09-01, obejmuje obie ścieżki —
 *     upload z 3f-1 i tę). Oryginał przy wyjątku parsera sięga po osobny zestaw dziesięciu
 *     starych parserów zaszytych w bundlu (`:46910`); my wolimy o awarii WIEDZIEĆ.
 *  2. **Bramka `importWylaczony`** (migracja 002, plan.md D5) — ta sama co w 3b i 3f-1.
 *     Sprawdzana PO oryginalnych bramkach, żeby nie zmieniać ich kolejności ani treści.
 *  3. **`clearTimeout` w `finally`.** Oryginał czyści timer dopiero PO udanym `await fetch`
 *     (`:48057`), więc odrzucone żądanie zostawia wiszący 30-sekundowy timer, który potem
 *     woła `abort()` na zakończonym kontrolerze. Nieszkodliwe, ale trzyma pętlę zdarzeń —
 *     a scheduler z 3f-3 robi to cyklicznie. Zachowanie obserwowalne bez zmian.
 *
 * ⚠ Wyjątek PARSERA też ląduje w alercie „Błąd pobierania" — i to jest WIERNE. Oryginał
 * ma jeden blok `catch` wokół całości (`:48100`), a po usunięciu fallbacku `Wc()` błąd
 * parsera trafia tam bezpośrednio. Nazwa typu alertu jest więc myląca, ale zostaje 1:1:
 * powód awarii i tak jest w treści alertu, a widok z I6 grupuje po `typ` i musi widzieć
 * dokładnie te same wartości co produkcja.
 *
 * ⚠ ALERT PRZY KAŻDEJ NIEUDANEJ PRÓBIE — BEZ DŁAWIKA (decyzja użytkownika 2026-09-01).
 * Trwale padnięty dostawca odpytywany co 60 min daje ~24 alerty na dobę; w produkcyjnym
 * `db/snapshot.db` jest tego 339 wierszy (MO3: 150, MO5: 102, MO4: 83, MO2: 4), z
 * rekordem 23/dobę dla MO3 w dniach 2026-08-08…10. Zwijanie powtórek należy do WIDOKU
 * alertów (Iteracja 6), nie do zapisu: liczba powtórzeń jest tu sygnałem diagnostycznym,
 * a dławik kasowałby go bezpowrotnie.
 */
export function synchronizujDostawce({
  db,
  katalogArchiwum,
  silnik,
  odstepPonowienMs,
  czekaj,
}: ZaleznosciSynchronizacji): (
  kod: string,
  opcje?: OpcjeSynchronizacji,
) => Promise<WynikSynchronizacji> {
  const uruchomImport = silnik ?? silnikStagingu(db);

  const envArchiwum: NodeJS.ProcessEnv = katalogArchiwum
    ? { ...process.env, IMPORT_ARCHIVE_DIR: katalogArchiwum }
    : process.env;
  const archiwizuj = (bufor: Buffer, opcje: OpcjeArchiwizacji) =>
    archiwizujBufor(bufor, opcje, envArchiwum);
  const oznaczWArchiwum = (id: string, patch: Partial<MetaArchiwum>) =>
    aktualizujMeta(id, patch, envArchiwum);

  const odstep = odstepPonowienMs ?? domyslnyOdstep();
  const czekajMs = czekaj ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  /** Dostawcy, których synchronizacja (z ponowieniami) właśnie trwa — kolejny cykl nie nakłada się na nią. */
  const wTrakcie = new Set<string>();

  /**
   * Jedna próba: pobranie + odczyt ciała. Ponawiamy WYŁĄCZNIE awarie transportu (AbortError, błąd sieci,
   * zerwane ciało) i odpowiedzi 5xx; 4xx, błędy parsera i „podejrzanie mały” nie są ponawiane (Etap 4a).
   */
  async function pobierzZPonowieniami(
    url: string,
  ): Promise<{ odpowiedz: Response; bufor: Buffer | null; proby: number }> {
    const maxProb = 1 + PONOWIENIA_SYNCHRONIZACJI;
    for (let proba = 1; ; proba++) {
      const kontroler = new AbortController();
      const licznik = setTimeout(() => kontroler.abort(), TIMEOUT_SYNCHRONIZACJI_MS);
      try {
        const odpowiedz = await fetch(url, { signal: kontroler.signal });
        if (odpowiedz.status >= 500 && proba < maxProb) {
          await odpowiedz.arrayBuffer().catch(() => undefined);
          throw new OdpowiedzSerwera(odpowiedz.status);
        }
        const bufor = odpowiedz.ok ? Buffer.from(await odpowiedz.arrayBuffer()) : null;
        return { odpowiedz, bufor, proby: proba };
      } catch (e) {
        if (proba >= maxProb) {
          // Do alertu trafia liczba prób — doklejamy ją do błędu transportu.
          (e as { proby?: number }).proby = proba;
          throw e;
        }
        if (odstep > 0) await czekajMs(odstep);
      } finally {
        clearTimeout(licznik); // ODSTĘPSTWO 3 — patrz nagłówek funkcji
      }
    }
  }
  const opisProb = (proby: number): string =>
    proby > 1
      ? ` (próby: ${proby}, odstęp ${Math.round(odstep / 1000)} s, limit ${Math.round(TIMEOUT_SYNCHRONIZACJI_MS / 1000)} s)`
      : "";

  return async function synchronizuj(kod, opcje = {}): Promise<WynikSynchronizacji> {
    const dostawca = dostawcaPoKodzie(db, kod);
    if (!dostawca) return { ok: false, error: "Dostawca nie istnieje" };
    // Gdy ustawiono IMPORTY_KATALOG, stare źródła (brak URL / agroopony.eu/imports) czytamy z lokalnego folderu.
    const katalogImportow = process.env.IMPORTY_KATALOG?.trim() || "";
    const lokalnie = katalogImportow !== "" && czyStareZrodlo(dostawca.url);
    if (!dostawca.url && !lokalnie) return { ok: false, error: "Brak URL" };
    if (dostawca.status === "wstrzymany" && !opcje.recznie) {
      return { ok: false, error: "Wstrzymany" };
    }
    // ODSTĘPSTWO 2 — bramka spoza produkcji, po oryginalnych sprawdzeniach.
    if (dostawca.importWylaczony) {
      return { ok: false, error: `Dostawca ${kod} jest wyłączony z importu` };
    }

    // Jedna synchronizacja na dostawcę naraz: ponowienia trwają minuty, a kolejny cykl schedulera (lub ręczne
    // „synchronizuj teraz”) nie może się na nie nałożyć. Bez alertu — to nie awaria.
    if (wTrakcie.has(dostawca.kod)) {
      return { ok: false, error: "Synchronizacja tego dostawcy już trwa" };
    }
    wTrakcie.add(dostawca.kod);

    const url = dostawca.url ?? "";
    let idArchiwum: string | null = null;
    let proby = 1;

    try {
      let bufor: Buffer;
      let nazwaPliku: string;
      let sparsowane: Awaited<ReturnType<typeof parsujAgrorami>> | null = null;

      if (lokalnie && dostawca.kod === "MO9") {
        // MO9: źródłem jest API; wynik zapisujemy jako CSV w folderze MO9 (i archiwizujemy ten plik).
        sparsowane = await parsujAgrorami();
        nazwaPliku = "agrorami-api.csv";
        bufor = zapiszCsvZRekordow(katalogImportow, "MO9", nazwaPliku, sparsowane.rekordy);
      } else if (lokalnie) {
        const plik = najnowszyPlik(katalogImportow, dostawca.kod);
        bufor = plik.bufor;
        nazwaPliku = plik.nazwa;
      } else {
        const pobrane = await pobierzZPonowieniami(url);
        const odpowiedz = pobrane.odpowiedz;
        proby = pobrane.proby;

        if (!odpowiedz.ok) {
          const teraz = new Date().toISOString();
          zapiszAlert(db, {
            poziom: "ostrzezenie",
            typ: "Błąd HTTP",
            opis: `${dostawca.kod} (${dostawca.nazwa}): HTTP ${odpowiedz.status}${opisProb(proby)}`,
            dostawca: dostawca.kod,
            status: "nowy",
            data: teraz,
          });
          oznaczBladDostawcy(db, dostawca.id, teraz);
          return { ok: false, error: `HTTP ${odpowiedz.status}` };
        }

        bufor = pobrane.bufor!;
        nazwaPliku = nazwaPlikuZUrl(url, rozszerzenieDlaParsera(url, dostawca.formatPliku));
      }

      // Archiwum PRZED parsowaniem — dokładnie jak `nq()` (`:48013-48022`), żeby plik,
      // który wywrócił parser, też został zapisany.
      idArchiwum =
        archiwizuj(bufor, {
          dostawcaKod: dostawca.kod,
          oryginalnaNazwa: nazwaPliku,
          zrodlo: "auto-pull",
          url: lokalnie ? `plik://${nazwaPliku}` : url,
          uzytkownik: opcje.uzytkownik ?? null,
          status: "ok",
        })?.id ?? null;

      // MO9 ignoruje pobrany CSV: źródłem cen/stanów jest API GraphQL, nie pole magazyn w CSV.
      sparsowane ??= dostawca.kod === "MO9"
        ? await parsujAgrorami()
        : parsujBufor(dostawca.kod, bufor, nazwaPliku);
      if (idArchiwum) {
        oznaczWArchiwum(idArchiwum, {
          rekordy: sparsowane.rekordy.length,
          parserErrors: sparsowane.bledy.length,
          odrzucone: sparsowane.odrzucone.length,
        });
      }

      const statystyki = uruchomImport(dostawca.kod, sparsowane.rekordy, {
        meta: sparsowane.meta,
      });
      const teraz = new Date().toISOString();

      // Oryginał ustawia OBA znaczniki i `status: aktywny` (`:48078-48083`).
      zapiszWynikImportu(db, dostawca.id, {
        ostatniPlik: teraz,
        ostatniaSync: teraz,
        liczbaProduktow: sparsowane.rekordy.length,
      });

      zapiszAlert(db, {
        poziom: "info",
        typ: "Synchronizacja",
        opis:
          `${dostawca.kod} (${dostawca.nazwa}): pobrano ${sparsowane.rekordy.length} ` +
          `produktów (nowe: ${statystyki.nowe}, kluczowe/błędy: ${statystyki.zmienione}, ` +
          `wycofane: ${statystyki.wycofane}, auto: ${statystyki.autoZatwierdzone})`,
        dostawca: dostawca.kod,
        status: "rozwiazany",
        data: teraz,
      });

      return { ok: true, liczbaProduktow: sparsowane.rekordy.length, ...statystyki };
    } catch (e) {
      const komunikat = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      const probyBledu = (e as { proby?: number } | null)?.proby ?? proby;
      console.error(`[synchronizacja] ${kod} BŁĄD:`, e);
      if (idArchiwum) oznaczWArchiwum(idArchiwum, { status: "blad", blad: komunikat });

      const teraz = new Date().toISOString();
      zapiszAlert(db, {
        poziom: "ostrzezenie",
        typ: "Błąd pobierania",
        opis: `${dostawca.kod} (${dostawca.nazwa}): ${komunikat}${opisProb(probyBledu)}`,
        dostawca: dostawca.kod,
        status: "nowy",
        data: teraz,
      });
      oznaczBladDostawcy(db, dostawca.id, teraz);
      return { ok: false, error: komunikat };
    } finally {
      wTrakcie.delete(dostawca.kod);
    }
  };
}
