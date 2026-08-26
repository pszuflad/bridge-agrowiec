import { Router, type Request } from "express";
import type { Baza } from "../db/index.js";
import {
  aktualizujMeta,
  archiwizujBufor,
  type MetaArchiwum,
  type OpcjeArchiwizacji,
  type ZrodloImportu,
} from "../import/archiwum.js";
import { parsujBufor, urlDostawcy } from "../import/parsuj.js";
import { pobierzZUrl } from "../import/pobierz.js";
import { silnikStagingu3b, type SilnikStagingu, type StatystykiImportu } from "../import/tk.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { dostawcaPoKodzie, zapiszWynikImportu } from "../repos/suppliers.js";
import { odczytajKonfiguracje } from "../repos/config.js";

export type ZaleznosciImportu = {
  db: Baza;
  /** Katalog archiwum; `undefined` = domyślny `<cwd>/import_archive` (plan.md D11). */
  katalogArchiwum?: string;
  /** Wstrzykiwany, żeby 3c mogła podmienić silnik bez ruszania tras (plan.md D2). */
  silnik?: SilnikStagingu;
  /** Wstrzykiwane w testach, żeby nie wychodzić do sieci. */
  pobierz?: (url: string) => Promise<Buffer>;
};

/** Limit rozmiaru uploadu — 25 MB (extensions.cjs:224). */
export const MAX_ROZMIAR_UPLOADU = 25 * 1024 * 1024;

/**
 * Import — uruchamianie i jego brzegi.
 *
 * Trasy pochodzą z `mirror/backend/extensions.cjs:126-286`, a NIE z rdzenia. To istotne
 * rozróżnienie: rdzeń ma osobny `POST /api/dostawcy/:kod/upload` (multer, pole `plik`,
 * fallback do starych parserów `Wc()` w bloku `catch`, backend-index.cjs:48243) — inny
 * endpoint, inne zachowanie przy błędzie, i należy do Iteracji 11. Endpointy z tego pliku
 * NIE mają żadnego fallbacku: wyjątek parsera kończy się zwykłym 500.
 *
 * ⚠ Ścieżka uploadu jest tu ŚCIEŻKĄ GŁÓWNĄ, nie wariantem pobocznym auto-pulla: MO6
 * (Uniglory) i MO8 (Trelleborg) nigdy nie miały auto-pulla, pliki przychodzą mailem
 * i Marta wgrywa je ręcznie (backlog #7 i #8).
 */
export function trasyImportu({
  db,
  katalogArchiwum,
  silnik,
  pobierz,
}: ZaleznosciImportu): Router {
  const router = Router();
  const uruchomImport = silnik ?? silnikStagingu3b(db);
  const pobierzPlik = pobierz ?? pobierzZUrl;

  // `archiwizujBufor`/`aktualizujMeta` czytają katalog z env, więc podajemy im nadpisanie
  // w tej samej formie zamiast dublować parametr w każdej sygnaturze.
  const envArchiwum: NodeJS.ProcessEnv = katalogArchiwum
    ? { ...process.env, IMPORT_ARCHIVE_DIR: katalogArchiwum }
    : process.env;
  const archiwizuj = (bufor: Buffer, opcje: OpcjeArchiwizacji) =>
    archiwizujBufor(bufor, opcje, envArchiwum);
  const oznaczWArchiwum = (id: string, patch: Partial<MetaArchiwum>) =>
    aktualizujMeta(id, patch, envArchiwum);

  /**
   * Rozwiązanie adresu cennika — `resolveUrl` z extensions.cjs:90-92: najpierw
   * `suppliers.url` z bazy, potem mapa `URLS` dispatchera.
   */
  const adresCennika = (kod: string): string | null => {
    const zBazy = dostawcaPoKodzie(db, kod)?.url;
    if (typeof zBazy === "string" && zBazy.trim().length > 0) return zBazy.trim();
    return urlDostawcy(kod);
  };

  /*
   * Wejście i komunikaty błędów RÓŻNIĄ SIĘ między tymi dwiema trasami i nie jest to
   * niedopatrzenie oryginału — powstały w różnym czasie i mają różnych wołających:
   *
   *   parse-file (extensions.cjs:214-218)   from-url (extensions.cjs:127-130)
   *   ─────────────────────────────────     ────────────────────────────────
   *   query.dostawcaKod || body.dostawcaKod  body.dostawcaKod || body.dostawca
   *   "Brak dostawcaKod (query lub body)"    "Brak dostawcaKod"
   *   "Nieznany dostawca: X"                 "Brak URL dla dostawcy X"
   *
   * Scalenie tego w jedną bramkę po cichu poszerzyłoby powierzchnię API (parse-file
   * zacząłby przyjmować alias `dostawca`) i zmieniło treść błędu dla from-url. Dlatego
   * odczyt kodu i pierwsze dwa sprawdzenia zostają osobne, a wspólny jest wyłącznie
   * strażnik wyłączonego dostawcy — bo ten jest NASZYM dodatkiem, nie portem.
   */

  const kodDlaParseFile = (req: Request): string =>
    String(
      (req.query?.dostawcaKod as string | undefined) ||
        (req.body as { dostawcaKod?: string } | undefined)?.dostawcaKod ||
        "",
    ).toUpperCase();

  const kodDlaFromUrl = (req: Request): string => {
    const cialo = req.body as { dostawcaKod?: string; dostawca?: string } | undefined;
    return String(cialo?.dostawcaKod || cialo?.dostawca || "").toUpperCase();
  };

  /**
   * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D5, backlog #7): dostawca z `import_wylaczony = 1`
   * jest odrzucany. Produkcja takiej bramki nie ma — wycofanie MO6 sprowadzało się tam do
   * „nikt już nie wrzuca pliku". Nam to nie wystarcza, bo `POST /api/import/parse-file`
   * przyjąłby plik MO6 od każdego zalogowanego użytkownika.
   *
   * Sprawdzane PO oryginalnych walidacjach, żeby nie zmieniać ich kolejności ani treści.
   */
  const wylaczonyZImportu = (kod: string): boolean =>
    Boolean(dostawcaPoKodzie(db, kod)?.importWylaczony);

  /**
   * Wspólny ogon obu ścieżek: parsowanie bufora → staging → aktualizacja dostawcy → audyt.
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D4, backlog #8): pusty wynik parsowania kończy import
   * błędem, ZANIM cokolwiek trafi do stagingu. Produkcja przepuszcza `{records: [], errors: []}`
   * dalej, a `tk()` nie ma zabezpieczenia przed pustym wejściem — trzy takie przebiegi
   * wycofują cały katalog dostawcy (licznik `nieobecnosc_pod_rzad`, próg 3). Realny przypadek:
   * parser MO8 przy pliku CSV zamiast XLSX zwraca zero rekordów bez żadnego błędu, a MO8
   * to import ręczny, więc nie ma cyklicznego przebiegu, który by to nadrobił.
   */
  const przetworzBufor = (
    req: Request,
    bufor: Buffer,
    kodDostawcy: string,
    zrodlo: ZrodloImportu,
    idArchiwum: string | null,
    nazwaPliku: string,
  ): { blad: string } | { wynik: WynikPrzetworzenia } => {
    const sparsowane = parsujBufor(kodDostawcy, bufor, nazwaPliku);

    if (idArchiwum) {
      oznaczWArchiwum(idArchiwum, {
        rekordy: sparsowane.rekordy.length,
        parserErrors: sparsowane.bledy.length,
        odrzucone: sparsowane.odrzucone.length,
      });
    }

    if (sparsowane.rekordy.length === 0) {
      return {
        blad:
          `Parser nie zwrócił ani jednej pozycji dla ${kodDostawcy} — import przerwany. ` +
          `Sprawdź, czy plik ma właściwy format.`,
      };
    }

    const statystyki = uruchomImport(kodDostawcy, sparsowane.rekordy);

    // Oba bloki są w oryginale opakowane w try/catch: awaria statystyk dostawcy ani audytu
    // nie może wywrócić importu, który już się powiódł (extensions.cjs:151-172).
    try {
      const dostawca = dostawcaPoKodzie(db, kodDostawcy);
      if (dostawca) {
        zapiszWynikImportu(db, dostawca.id, {
          ostatniPlik: new Date().toISOString(),
          liczbaProduktow: sparsowane.rekordy.length,
        });
      }
      zapiszAudyt(db, {
        uzytkownikId: req.user?.id ?? null,
        uzytkownikImie: req.user?.imieNazwisko ?? null,
        akcja: zrodlo === "from-url" ? "import_z_url" : "import_pliku",
        encjaTyp: "dostawca",
        encjaId: kodDostawcy,
        szczegoly: {
          source: zrodlo === "from-url" ? "from-url" : "parse-file",
          wczytanych: sparsowane.rekordy.length,
          parserErrors: sparsowane.bledy.length,
          odrzucone: sparsowane.odrzucone.length,
          ...statystyki,
        },
      });
    } catch (e) {
      console.error("[import] audit log fail:", e instanceof Error ? e.message : e);
    }

    return {
      wynik: {
        wczytanych: sparsowane.rekordy.length,
        parserErrors: sparsowane.bledy.length,
        odrzuconePrzezParser: sparsowane.odrzucone.length,
        statystyki,
      },
    };
  };

  /**
   * `POST /api/import/parse-file` (extensions.cjs:213-286).
   *
   * ⚠ Czyta SUROWY strumień żądania, nie multipart — mimo komentarza w oryginale, który
   * mówi o multiparcie. Kod produkcji robi `for await (const c of req)`, więc odtwarzamy
   * to samo. `express.json()` z `app.ts` nie przeszkadza: parsuje wyłącznie ciała
   * o typie `application/json`, a cenniki przychodzą jako `text/csv` albo
   * `application/octet-stream`. Ta sama kolejność middleware jest w oryginale.
   */
  router.post("/api/import/parse-file", requireAuth, async (req, res) => {
    const kodDostawcy = kodDlaParseFile(req);
    if (!kodDostawcy) {
      res.status(400).json({ error: "Brak dostawcaKod (query lub body)" });
      return;
    }
    if (!adresCennika(kodDostawcy)) {
      res.status(400).json({ error: `Nieznany dostawca: ${kodDostawcy}` });
      return;
    }
    if (wylaczonyZImportu(kodDostawcy)) {
      res.status(400).json({ error: `Dostawca ${kodDostawcy} jest wyłączony z importu` });
      return;
    }

    let idArchiwum: string | null = null;
    try {
      /*
       * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D13) — utwardzenie bez zmiany zachowania.
       *
       * Oryginał (extensions.cjs:224-230) buforuje CAŁE ciało żądania, a limit sprawdza
       * dopiero potem: `const buf = Buffer.concat(chunks); if (buf.length > 25MB) …`.
       * Zalogowany użytkownik mógł tym wysłać dowolnie duże ciało i wyczerpać pamięć
       * procesu, zanim ktokolwiek sprawdzi rozmiar.
       *
       * Liczymy bajty w trakcie strumieniowania i przerywamy w chwili przekroczenia progu.
       * Odpowiedź jest IDENTYCZNA — ten sam kod 400 i ten sam komunikat — więc z punktu
       * widzenia kontraktu nic się nie zmienia; różni się wyłącznie zużycie pamięci.
       */
      const kawalki: Buffer[] = [];
      let rozmiar = 0;
      let przekroczonyLimit = false;
      for await (const kawalek of req) {
        const czesc = kawalek as Buffer;
        rozmiar += czesc.length;
        // Ostro `>`, jak w oryginale — plik dokładnie 25 MB jeszcze przechodzi.
        if (rozmiar > MAX_ROZMIAR_UPLOADU) {
          przekroczonyLimit = true;
          break;
        }
        kawalki.push(czesc);
      }

      if (przekroczonyLimit) {
        res.status(400).json({ error: "Plik większy niż 25 MB" });
        return;
      }

      const bufor = Buffer.concat(kawalki);
      if (bufor.length === 0) {
        res.status(400).json({ error: "Pusty plik" });
        return;
      }

      const nazwaPliku = String(
        (req.query?.nazwa as string | undefined) ?? req.headers["x-nazwa-pliku"] ?? "upload.csv",
      );

      // Archiwum PRZED parsowaniem — żeby plik, który wywrócił parser, też został zapisany.
      idArchiwum =
        archiwizuj(bufor, {
          dostawcaKod: kodDostawcy,
          oryginalnaNazwa: nazwaPliku,
          zrodlo: "upload",
          uzytkownik: req.user?.imieNazwisko ?? null,
          status: "ok",
        })?.id ?? null;

      const przetworzone = przetworzBufor(
        req,
        bufor,
        kodDostawcy,
        "upload",
        idArchiwum,
        nazwaPliku,
      );
      if ("blad" in przetworzone) {
        if (idArchiwum) oznaczWArchiwum(idArchiwum, { status: "blad", blad: przetworzone.blad });
        res.status(400).json({ error: przetworzone.blad, dostawcaKod: kodDostawcy });
        return;
      }

      res.json({ ok: true, dostawcaKod: kodDostawcy, ...splaszcz(przetworzone.wynik) });
    } catch (e) {
      const komunikat = e instanceof Error ? e.message : String(e);
      console.error(`[import] parse-file ${kodDostawcy} BŁĄD:`, e);
      if (idArchiwum) oznaczWArchiwum(idArchiwum, { status: "blad", blad: komunikat.slice(0, 500) });
      res.status(500).json({ error: komunikat, dostawcaKod: kodDostawcy });
    }
  });

  /**
   * `POST /api/import/from-url` (extensions.cjs:126-205).
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D8) — naprawa błędu oryginału: tam `let archOk` jest
   * zadeklarowane WEWNĄTRZ bloku `try` (extensions.cjs:140), a blok `catch` go używa
   * (`:193`). Wejście w obsługę błędu daje więc `ReferenceError` w samej obsłudze błędu:
   * odpowiedź nigdy nie wychodzi, a żądanie wisi aż do timeoutu klienta. Deklarujemy
   * `idArchiwum` przed `try` i odtwarzamy ZAMIERZONE zachowanie — oznaczenie archiwum
   * statusem `blad` i odpowiedź 500.
   */
  router.post("/api/import/from-url", requireAuth, async (req, res) => {
    const kodDostawcy = kodDlaFromUrl(req);
    if (!kodDostawcy) {
      res.status(400).json({ error: "Brak dostawcaKod" });
      return;
    }
    const url = adresCennika(kodDostawcy);
    if (!url) {
      res.status(400).json({ error: `Brak URL dla dostawcy ${kodDostawcy}` });
      return;
    }
    if (wylaczonyZImportu(kodDostawcy)) {
      res.status(400).json({ error: `Dostawca ${kodDostawcy} jest wyłączony z importu` });
      return;
    }
    let bufor: Buffer | null = null;
    let idArchiwum: string | null = null;

    try {
      bufor = await pobierzPlik(url);
      const nazwaPliku = nazwaPlikuZUrl(url);

      idArchiwum =
        archiwizuj(bufor, {
          dostawcaKod: kodDostawcy,
          oryginalnaNazwa: nazwaPliku,
          zrodlo: "from-url",
          url,
          uzytkownik: req.user?.imieNazwisko ?? null,
          status: "ok",
        })?.id ?? null;

      const przetworzone = przetworzBufor(
        req,
        bufor,
        kodDostawcy,
        "from-url",
        idArchiwum,
        nazwaPliku,
      );
      if ("blad" in przetworzone) {
        if (idArchiwum) oznaczWArchiwum(idArchiwum, { status: "blad", blad: przetworzone.blad });
        res.status(400).json({ error: przetworzone.blad, dostawcaKod: kodDostawcy, url });
        return;
      }

      res.json({
        ok: true,
        dostawcaKod: kodDostawcy,
        url,
        ...splaszcz(przetworzone.wynik),
        archiwum: idArchiwum,
      });
    } catch (e) {
      const komunikat = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      console.error(`[import] from-url ${kodDostawcy} BŁĄD:`, e);
      // Nawet błędny plik chcemy w archiwum — ale tylko raz.
      if (bufor && !idArchiwum) {
        archiwizuj(bufor, {
          dostawcaKod: kodDostawcy,
          oryginalnaNazwa: nazwaPlikuZUrl(url),
          zrodlo: "from-url",
          url,
          uzytkownik: req.user?.imieNazwisko ?? null,
          status: "blad",
          blad: komunikat,
        });
      } else if (idArchiwum) {
        oznaczWArchiwum(idArchiwum, { status: "blad", blad: komunikat });
      }
      res.status(500).json({ error: komunikat, dostawcaKod: kodDostawcy, url });
    }
  });

  /**
   * `POST /api/ai-fallback/parse` — port 1:1 z backend-index.cjs:48864-48886.
   *
   * ⚠ To NIE jest fallback z bloku `catch`. Endpoint nie jest wpięty w żadną ścieżkę
   * parsowania — ani tutaj, ani w oryginale; woła się go wyłącznie ręcznie. Mechanizmem
   * z `catch` jest `Wc()` (backend-index.cjs:46910), zestaw starych parserów per-dostawca
   * używany przez rdzeniowy `POST /api/dostawcy/:kod/upload`, i to zupełnie inna rzecz.
   *
   * ⚠ Nigdy nie łączy się z OpenAI — w obu gałęziach zwraca odpowiedź zastępczą. Bez klucza
   * `ai_fallback.klucz_api` w tabeli `config` produkuje pięć ZMYŚLONYCH pozycji opisanych
   * jako symulacja; z kluczem — pustą listę i komunikat, że tryb wymaga połączenia.
   * Odtwarzamy to wiernie, łącznie z zmyślonymi danymi: to jest faktyczne zachowanie
   * produkcji, a nie nasz stub.
   */
  router.post("/api/ai-fallback/parse", requireAuth, (_req, res) => {
    const klucz = odczytajKonfiguracje(db, "ai_fallback.klucz_api");

    if (!klucz || klucz.trim() === "") {
      res.json({
        tryb: "symulacja",
        komunikat: "Klucz API OpenAI nie jest skonfigurowany. To wynik symulacji.",
        produkty: Array.from({ length: 5 }, (_, i) => ({
          kodProduktu: `AI_DETECT_${i}`,
          producent: "Wykryto AI",
          nazwa: `Produkt rozpoznany przez AI (symulacja) #${i}`,
          cenaNetto: 100 + i * 50,
          iloscMagazyn: i + 1,
        })),
      });
      return;
    }

    res.json({
      tryb: "aktywny",
      komunikat: "Tryb aktywny — wymaga połączenia z OpenAI",
      produkty: [],
    });
  });

  return router;
}

type WynikPrzetworzenia = {
  wczytanych: number;
  parserErrors: number;
  odrzuconePrzezParser: number;
  statystyki: StatystykiImportu;
};

/**
 * Statystyki `tk()` są w oryginale rozsypywane wprost do ciała odpowiedzi
 * (`...tkResult`, extensions.cjs:180-188), a nie zagnieżdżane pod kluczem.
 */
function splaszcz(wynik: WynikPrzetworzenia) {
  return {
    wczytanych: wynik.wczytanych,
    parserErrors: wynik.parserErrors,
    odrzuconePrzezParser: wynik.odrzuconePrzezParser,
    ...wynik.statystyki,
  };
}

/** Ostatni segment ścieżki URL, bez query string (extensions.cjs:55-63). */
function nazwaPlikuZUrl(url: string): string {
  try {
    const segmenty = new URL(url).pathname.split("/").filter(Boolean);
    return segmenty[segmenty.length - 1] || "import.csv";
  } catch {
    return "import.csv";
  }
}
