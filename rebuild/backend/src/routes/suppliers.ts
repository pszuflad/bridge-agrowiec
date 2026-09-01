import { Router, type Request, type RequestHandler, type Response } from "express";
import multer from "multer";
import type { Baza } from "../db/index.js";
import {
  aktualizujMeta,
  archiwizujBufor,
  type MetaArchiwum,
  type OpcjeArchiwizacji,
} from "../import/archiwum.js";
import { parsujBufor } from "../import/parsuj.js";
import { synchronizujDostawce, type OpcjeSynchronizacji, type WynikSynchronizacji } from "../import/synchronizuj.js";
import { PustyImportBlad, silnikStagingu, type SilnikStagingu } from "../import/tk.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAlert } from "../repos/alerts.js";
import { zapiszAudyt } from "../repos/audit.js";
import {
  aktualizujDostawce,
  dostawcaPoId,
  dostawcaPoKodzie,
  listaDostawcow,
  odsiejPolaEdytowalne,
  POLA_AUDYTOWANE_DOSTAWCY,
  zapiszWynikImportu,
} from "../repos/suppliers.js";

export type ZaleznosciDostawcow = {
  db: Baza;
  /** Katalog archiwum; `undefined` = domyślny `<cwd>/import_archive`, jak w 3b. */
  katalogArchiwum?: string;
  /** Wstrzykiwany w testach, tak samo jak w `trasyImportu`. */
  silnik?: SilnikStagingu;
  /**
   * Wstrzykiwana WYŁĄCZNIE po to, żeby scheduler z 3f-3 mógł dostać tę samą instancję
   * co trasa. Testy tej sesji jej NIE podmieniają — stawiają prawdziwy serwer HTTP
   * na porcie efemerycznym, bo mockowanie `fetch` ukryłoby dokładnie tę warstwę,
   * której dotyczy gate.
   */
  synchronizuj?: (kod: string, opcje?: OpcjeSynchronizacji) => Promise<WynikSynchronizacji>;
};

/** Limit uploadu — 50 MB, 1:1 z multerem produkcji (backend-index.cjs:48150). */
export const MAX_ROZMIAR_UPLOADU_DOSTAWCY = 50 * 1024 * 1024;

/**
 * Dostawcy — odczyt (I2) i ręczne wgranie cennika (3f-1).
 *
 * Odczyt: oryginał rejestruje JEDEN handler pod DWIEMA ścieżkami — `/api/dostawcy`
 * (ekran konfiguracji) i `/api/suppliers` (katalog). Oba mają własne fixtures
 * — `GET_dostawcy.json` i `GET_suppliers.json` — identyczne co do bajta.
 *
 * Sterowanie (`PATCH /api/dostawcy/{id}`) i ręczna synchronizacja
 * (`POST /api/dostawcy/{kod}/synchronizuj-teraz`) doszły w bloku 3f-2.
 */
export function trasyDostawcow({
  db,
  katalogArchiwum,
  silnik,
  synchronizuj,
}: ZaleznosciDostawcow): Router {
  const router = Router();
  const uruchomImport = silnik ?? silnikStagingu(db);
  const uruchomSynchronizacje =
    synchronizuj ?? synchronizujDostawce({ db, katalogArchiwum, silnik });

  const lista: RequestHandler = (_req, res) => {
    res.json(listaDostawcow(db));
  };

  router.get("/api/dostawcy", requireAuth, lista);
  router.get("/api/suppliers", requireAuth, lista);

  // Ta sama biblioteka i ta sama konfiguracja co produkcja: bufor w pamięci, 50 MB,
  // jedno pole `plik` (backend-index.cjs:48150-48155, :48243).
  const wgrywanie = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ROZMIAR_UPLOADU_DOSTAWCY },
  });

  /**
   * Multer sygnalizuje przekroczenie limitu wyjątkiem `MulterError` BEZ pola `status`,
   * więc `bladHandler` zamieniłby go w bezużyteczne 500 „Błąd serwera". Tłumaczymy go
   * na 400 z komunikatem, który mówi, co się stało — reszta błędów leci dalej bez zmian.
   */
  const przyjmijPlik: RequestHandler = (req, res, next) => {
    wgrywanie.single("plik")(req, res, (e: unknown) => {
      if (e instanceof multer.MulterError && e.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Plik większy niż 50 MB" });
        return;
      }
      next(e);
    });
  };

  const envArchiwum: NodeJS.ProcessEnv = katalogArchiwum
    ? { ...process.env, IMPORT_ARCHIVE_DIR: katalogArchiwum }
    : process.env;
  const archiwizuj = (bufor: Buffer, opcje: OpcjeArchiwizacji) =>
    archiwizujBufor(bufor, opcje, envArchiwum);
  const oznaczWArchiwum = (id: string, patch: Partial<MetaArchiwum>) =>
    aktualizujMeta(id, patch, envArchiwum);

  /**
   * `POST /api/dostawcy/:kod/upload` — port backend-index.cjs:48243-48280.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME 1 — BRAK FALLBACKU `Wc()` (roadmapa §5, blok 3f, decyzja
   * zaklepana 2026-09-01). Oryginał w bloku `catch` wokół parsera sięga po `Wc()`
   * (`:46910`) — osobny zestaw dziesięciu starych parserów zaszytych w bundlu, niezależny
   * od `parsers/*.cjs`. My tego nie portujemy: gdy parser rzuci, leci CZYTELNY błąd
   * i alert, zamiast cichej drugiej próby innym kodem. Wolimy o awarii WIEDZIEĆ.
   * Luka jest otwarta i opisana w roadmapie.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME 2 — bramka `importWylaczony` (MO6), ta sama co w 3b
   * (`routes/import.ts`, plan.md D5). Produkcja jej nie ma; bez niej każdy zalogowany
   * użytkownik wgrałby plik dostawcy wycofanego z importu.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME 3 — bezpiecznik pustego wsadu (`PustyImportBlad`, plan.md D4/D7),
   * dziedziczony po silniku z 3c. Chroni przed wycofaniem katalogu dostawcy po trzech
   * pustych przebiegach.
   *
   * Archiwizacja NIE jest odstępstwem, wbrew wcześniejszej nocie w roadmapie: produkcyjny
   * upload archiwizuje bufor wewnątrz `nq()` (`:48013-48022`, `zrodlo: "rdzen-nq"`, PRZED
   * `parseByKod`), co potwierdza wysłany bundel `mirror/backend/index.cjs`. Robimy to samo
   * i w tym samym miejscu — przed parsowaniem — żeby plik, który wywrócił parser, też
   * został zapisany.
   */
  router.post(
    "/api/dostawcy/:kod/upload",
    requireAuth,
    przyjmijPlik,
    (req: Request, res: Response) => {
      // Kolejność bramek 1:1 z oryginałem: najpierw plik, potem dostawca.
      if (!req.file) {
        res.status(400).json({ error: "Brak pliku" });
        return;
      }

      const kod = String(req.params.kod ?? "").toUpperCase();
      const dostawca = dostawcaPoKodzie(db, kod);
      if (!dostawca) {
        res.status(404).json({ error: "Brak dostawcy" });
        return;
      }
      if (dostawca.importWylaczony) {
        res.status(400).json({ error: `Dostawca ${kod} jest wyłączony z importu` });
        return;
      }

      const nazwaPliku = req.file.originalname || "upload.csv";
      const bufor = req.file.buffer;
      let idArchiwum: string | null = null;

      try {
        idArchiwum =
          archiwizuj(bufor, {
            dostawcaKod: kod,
            oryginalnaNazwa: nazwaPliku,
            zrodlo: "upload",
            uzytkownik: req.user?.imieNazwisko ?? null,
            status: "ok",
          })?.id ?? null;

        const sparsowane = parsujBufor(kod, bufor, nazwaPliku);
        if (idArchiwum) {
          oznaczWArchiwum(idArchiwum, {
            rekordy: sparsowane.rekordy.length,
            parserErrors: sparsowane.bledy.length,
            odrzucone: sparsowane.odrzucone.length,
          });
        }

        const statystyki = uruchomImport(kod, sparsowane.rekordy);
        const teraz = new Date().toISOString();

        // Oryginał ustawia OBA znaczniki czasu, nie tylko `ostatniPlik` (`:48260-48265`).
        zapiszWynikImportu(db, dostawca.id, {
          ostatniPlik: teraz,
          ostatniaSync: teraz,
          liczbaProduktow: sparsowane.rekordy.length,
        });

        zapiszAlert(db, {
          poziom: "info",
          typ: "Ręczny upload",
          opis:
            `${kod}: wgrano ${nazwaPliku} (${sparsowane.rekordy.length} produktów, ` +
            `nowe: ${statystyki.nowe}, kluczowe/bledy: ${statystyki.zmienione}, ` +
            `wycofane: ${statystyki.wycofane}, auto: ${statystyki.autoZatwierdzone})`,
          dostawca: kod,
          status: "rozwiazany",
          data: teraz,
        });

        zapiszAudyt(db, {
          uzytkownikId: req.user?.id ?? null,
          uzytkownikImie: req.user?.imieNazwisko ?? null,
          akcja: "upload_pliku",
          encjaTyp: "dostawca",
          encjaId: kod,
          szczegoly: {
            nazwaPliku,
            liczbaProduktow: sparsowane.rekordy.length,
            doStagingu: statystyki.doStagingu,
            autoZatwierdzone: statystyki.autoZatwierdzone,
          },
        });

        res.json({
          ok: true,
          nazwaPliku,
          liczbaProduktow: sparsowane.rekordy.length,
          ...statystyki,
          // Oryginał odsyła pierwsze 5 rekordów PO adapterze (`:48277`).
          podglad: sparsowane.rekordy.slice(0, 5),
        });
      } catch (e) {
        const komunikat = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        console.error(`[upload] ${kod} BŁĄD:`, e);
        if (idArchiwum) oznaczWArchiwum(idArchiwum, { status: "blad", blad: komunikat });

        // Nieudany parse MUSI zostawić ślad — to jest gate tej sesji. Zapis alertu
        // owinięty własnym try/catch: awaria alertu nie może zamienić czytelnego 400/500
        // w pustą odpowiedź.
        try {
          zapiszAlert(db, {
            poziom: "ostrzezenie",
            typ: "Ręczny upload",
            opis: `${kod}: nie udało się wczytać ${nazwaPliku} — ${komunikat}`,
            dostawca: kod,
            status: "nowy",
            data: new Date().toISOString(),
          });
        } catch (bladAlertu) {
          console.error("[upload] zapis alertu nieudany:", bladAlertu);
        }

        // Pusty wsad to wina PLIKU, nie serwera — 400, jak w trasach z 3b.
        // Reszta zostaje przy 500 oryginału (`:48279`).
        const status = e instanceof PustyImportBlad ? 400 : 500;
        res.status(status).json({ error: komunikat, dostawcaKod: kod, nazwaPliku });
      }
    },
  );

  /**
   * `PATCH /api/dostawcy/:id` — port backend-index.cjs:48227-48237.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME — LISTA PÓL EDYTOWALNYCH (decyzja użytkownika 2026-09-01).
   * Oryginał robi `U.updateSupplier(l, c.body)`, czyli `SET` z CAŁEGO ciała żądania, bez
   * żadnego filtra: każdy zalogowany użytkownik ustawia dowolną kolumnę. U nas dotyczyłoby
   * to także `importWylaczony` z migracji 002 — a to jest bramka wyłączająca MO6 z importu
   * (plan.md D5), więc dałoby się ją zdjąć jednym PATCH-em. Lista mieszka
   * w `repos/suppliers.ts` (`POLA_EDYTOWALNE_DOSTAWCY`) razem z uzasadnieniem, co odcina
   * i dlaczego.
   *
   * ⚠ NIESPÓJNOŚĆ AUDYTU ZOSTAJE 1:1 (roadmapa: decyzja zaklepana): zapis obejmuje dziesięć
   * pól, a audyt wyłącznie cztery (`POLA_AUDYTOWANE_DOSTAWCY`). Zmiana `uwagi` czy `parser`
   * przechodzi bez śladu — tak działa produkcja i tego nie ruszamy. Dlatego lista
   * edytowalnych jest ŚWIADOMIE szersza niż czwórka audytowana: zawężenie jej do czwórki
   * skasowałoby tę niespójność po cichu.
   *
   * Różnica techniczna bez wpływu na obserwowalne zachowanie: oryginał wykonuje `UPDATE`
   * PRZED sprawdzeniem istnienia dostawcy (`:48229-48230`) — dla nieistniejącego `id` to
   * `UPDATE … WHERE id = <brak>`, czyli zero wierszy, po czym i tak leci 404. Czytamy
   * najpierw, żeby nie pisać w ciemno.
   */
  router.patch("/api/dostawcy/:id", requireAuth, (req: Request, res: Response) => {
    // `parseInt` jak w oryginale (`:48228`): „abc" → NaN → brak wiersza → 404.
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const przed = Number.isNaN(id) ? undefined : dostawcaPoId(db, id);
    if (!przed) {
      res.status(404).json({ error: "Brak dostawcy" });
      return;
    }

    const patch = odsiejPolaEdytowalne(req.body);
    const po = aktualizujDostawce(db, id, patch);
    if (!po) {
      res.status(404).json({ error: "Brak dostawcy" });
      return;
    }

    // Porównanie i kolejność kluczy 1:1 z oryginałem (`:48234-48236`): do audytu wchodzi
    // pole obecne w ciele I faktycznie różne od poprzedniej wartości.
    const zmiany: Record<string, unknown> = {};
    for (const pole of POLA_AUDYTOWANE_DOSTAWCY) {
      if (pole in patch && przed[pole] !== patch[pole]) zmiany[pole] = patch[pole];
    }
    if (Object.keys(zmiany).length > 0) {
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "edycja_dostawcy",
        encjaTyp: "dostawca",
        encjaId: po.kod,
        szczegoly: zmiany,
      });
    }

    // Oryginał odsyła CAŁY wiersz z bazy. My odsyłamy go w projekcji kontraktowej — bez
    // niej `importWylaczony` wyciekłoby do API jako 19. klucz obok 18 z fixtures.
    res.json(po);
  });

  /**
   * `POST /api/dostawcy/:kod/synchronizuj-teraz` — port backend-index.cjs:48238-48242.
   *
   * Oryginał woła `q4(kod)` = `L4(kod, {rrcznie: true})`, czyli ręczne uruchomienie
   * OMIJAJĄCE blokadę `status === "wstrzymany"`. To jedyna różnica między tą trasą
   * a przebiegiem schedulera z 3f-3, który woła `L4(kod)` bez flagi.
   *
   * ⚠ Dwie rzeczy wyglądające na błąd, a portowane świadomie:
   *  - audyt leci PRZED synchronizacją i BEZWARUNKOWO (`:48240`) — także dla nieznanego
   *    kodu i dla dostawcy bez URL-a. Zapisuje ZAMIAR, nie wynik;
   *  - odpowiedź to zawsze 200, również przy niepowodzeniu — status siedzi w polu `ok`
   *    ciała, a nie w kodzie HTTP. Frontend oryginału czyta właśnie `t.ok`
   *    (frontend-index.js:25727), więc zmiana kodu zepsułaby wchłanianą kartę dostawcy.
   */
  router.post(
    "/api/dostawcy/:kod/synchronizuj-teraz",
    requireAuth,
    async (req: Request, res: Response) => {
      // Wielkie litery jak w `upload` z 3f-1 — nasza konwencja dla kodu z URL-a.
      const kod = String(req.params.kod ?? "").toUpperCase();

      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: "synchronizacja_reczna",
        encjaTyp: "dostawca",
        encjaId: kod,
      });

      const wynik = await uruchomSynchronizacje(kod, {
        recznie: true,
        uzytkownik: req.user?.imieNazwisko ?? null,
      });
      res.json(wynik);
    },
  );

  return router;
}
