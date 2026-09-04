/**
 * Eksport katalogu do Shopera — DWIE trasy, port
 * `deminified/backend-index.cjs:48783-48818` i `:48853-48863`.
 *
 * ⚠ TO NAPRAWDĘ SĄ DWIE RÓŻNE TRASY, nie literówka w roadmapie:
 *   `GET /api/export-shoper`  — stały format 7-kolumnowy, potrafi oddać ZIP.
 *   `GET /api/export/shoper`  — format sterowany kluczem `shoper.format_eksportu`,
 *                               zawsze jeden plik.
 * Różnice formatu opisuje `selly/csv-shoper.ts`.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (§3, plan.md D1): obie trasy są w produkcji PUBLICZNE — kontrakt
 * zapisuje to wprost jako `security: []` (`contract/openapi.yaml:611-626`), a
 * `docs/spec-backend.md:45` wymienia je wśród publicznych GET-ów. Publiczny eksport oddaje
 * KOMPLET katalogu wraz z cenami zakupu (kolumna `cena_zakupu` jest w słowniku kolumn), więc
 * zakładamy na nie `requireAuth`, kontynuując decyzję z I1/I4a/3b/I10. Treść i format
 * odpowiedzi bez zmian — zmienia się wyłącznie to, kto ją dostanie.
 *
 * ⚠ TO JEST NAWIGACJA PRZEGLĄDARKI, NIE `fetch`. Przycisk w panelu robi
 * `window.location.href = ...`, więc żądanie NIE niesie nagłówka `Authorization` — działa
 * wyłącznie na cookie `bridge_session`. `requireAuth` to obsługuje (`middleware/auth.ts`
 * czyta oba), ale test musi to potwierdzić wprost, inaczej regresja pojawi się dopiero
 * u Ani. Wzorzec: `test/analityka.eksport.gate.test.ts`.
 */

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { odczytajCalaKonfiguracje } from "../repos/config.js";
import { listaProduktow } from "../repos/products.js";
import { listaDostawcow } from "../repos/suppliers.js";
import {
  csvDostawcy,
  csvWgKolumn,
  kolumnyZFormatu,
  liczbaWierszyDanych,
} from "../selly/csv-shoper.js";

export type ZaleznosciEksportuShoper = {
  db: Baza;
};

/** Data w nazwie pliku — `YYYY-MM-DD`, jak w oryginale (`:48785`). */
function dataDoNazwy(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Konstruktor archiwum ZIP, importowany LENIWIE i zapamiętywany — port `rV()`
 * (`deminified/backend-index.cjs:48139-48149`), łącznie z cache'owaniem w zmiennej modułu.
 *
 * `archiver` jest ESM-only i ciągnie kilkanaście zależności, których jedenaście pozostałych
 * tras tego ticketa nie potrzebuje; import w środku żądania trzyma je poza ścieżką startu
 * procesu. Cache jest po to, żeby `await import()` nie wisiał w każdym żądaniu ZIP-a —
 * Node i tak trzyma moduł w swoim rejestrze, ale oryginał robi to jawnie i tak zostaje.
 */
let ZipArchiveCache: typeof import("archiver").ZipArchive | undefined;

async function konstruktorZip(): Promise<typeof import("archiver").ZipArchive> {
  if (!ZipArchiveCache) ZipArchiveCache = (await import("archiver")).ZipArchive;
  return ZipArchiveCache;
}

export function trasyEksportuShoper({ db }: ZaleznosciEksportuShoper): Router {
  const router = Router();

  /**
   * Pełny katalog w stałym formacie 7-kolumnowym (`:48783-48818`).
   *
   * Bez `?dostawca` albo z `dostawca=wszyscy` oddaje ZIP `shoper_wszyscy_{data}.zip`
   * z osobnym CSV per dostawca; z konkretnym kodem — pojedynczy plik.
   *
   * ⚠ ZIP jest STRUMIENIOWANY: nagłówki idą przed pierwszym bajtem archiwum, więc gdy
   * `archiver` padnie w trakcie, nie da się już odpowiedzieć 500 — stąd warunek
   * `headersSent` w obu obsługach błędu, przeniesiony 1:1 z oryginału (`:48792`, `:48804`).
   *
   * ⚠ Lista dostawców do ZIP-a idzie z `listaDostawcow`, nie z `DISTINCT products.dostawca`.
   * Dostawca bez produktów dostaje więc plik z samym nagłówkiem — tak jak w produkcji.
   */
  router.get("/api/export-shoper", requireAuth, (req: Request, res: Response) => {
    const dostawca = String(req.query.dostawca ?? "wszyscy");
    const data = dataDoNazwy();
    const produkty = listaProduktow(db);

    if (dostawca === "wszyscy") {
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="shoper_wszyscy_${data}.zip"`);

      void (async () => {
        const ZipArchive = await konstruktorZip();
        const archiwum = new ZipArchive({ zlib: { level: 9 } });

        archiwum.on("error", (blad: Error) => {
          console.error("zip error", blad);
          if (!res.headersSent) res.status(500).end();
        });
        archiwum.pipe(res);

        const dostawcy = listaDostawcow(db);
        for (const d of dostawcy) {
          archiwum.append(csvDostawcy(produkty, d.kod), {
            name: `shoper_${d.kod}_${data}.csv`,
          });
        }

        if (req.user) {
          zapiszAudyt(db, {
            uzytkownikId: req.user.id,
            uzytkownikImie: req.user.imieNazwisko,
            akcja: "eksport_csv",
            encjaTyp: "dostawcy",
            encjaId: "wszyscy",
            szczegoly: { liczbaDostawcow: dostawcy.length },
          });
        }

        await archiwum.finalize();
      })().catch((blad: unknown) => {
        console.error("zip pipeline failed", blad);
        if (!res.headersSent) {
          res.status(500).json({ error: blad instanceof Error ? blad.message : "zip" });
        }
      });
      return;
    }

    const csv = csvDostawcy(produkty, dostawca);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="shoper_${dostawca}_${data}.csv"`);

    if (req.user) {
      zapiszAudyt(db, {
        uzytkownikId: req.user.id,
        uzytkownikImie: req.user.imieNazwisko,
        akcja: "eksport_csv",
        encjaTyp: "dostawca",
        encjaId: dostawca,
        szczegoly: { liczbaProduktow: liczbaWierszyDanych(csv) },
      });
    }

    res.send(csv);
  });

  /**
   * Pełny katalog w formacie z konfiguracji (`:48853-48863`).
   *
   * ⚠ Czyta klucz `shoper.format_eksportu` — to INNY klucz niż `shoper.kolumny`
   * i `shoper.separator`, które I11 dodała do zakładki „Shoper" w `/konfiguracja`. Tamte dwa
   * należą do przycisku „Pobierz CSV (Shoper)" w katalogu i podepnie je sesja 8b; ta trasa
   * ich nie zna i znać nie ma. Separator jest tu zahardkodowany na `;`.
   *
   * ⚠ Parametr filtrujący nazywa się `?supplier=`, a nie `?dostawca=` jak w trasie wyżej.
   * Rozjazd nazewnictwa jest w oryginale i zostaje — frontend 8b musi użyć właściwej nazwy
   * dla właściwej trasy.
   */
  router.get("/api/export/shoper", requireAuth, (req: Request, res: Response) => {
    const konfiguracja = odczytajCalaKonfiguracje(db);
    const kolumny = kolumnyZFormatu(konfiguracja["shoper.format_eksportu"]);
    const dostawca = req.query.supplier ? String(req.query.supplier) : undefined;
    const data = dataDoNazwy();

    const csv = csvWgKolumn(listaProduktow(db), kolumny, dostawca);
    const nazwaPliku = `shoper_${dostawca || "wszyscy"}_${data}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nazwaPliku}"`);

    if (req.user) {
      zapiszAudyt(db, {
        uzytkownikId: req.user.id,
        uzytkownikImie: req.user.imieNazwisko,
        akcja: "eksport_shoper",
        encjaTyp: "dostawca",
        encjaId: dostawca || "wszyscy",
        szczegoly: { kolumny, liczbaProduktow: liczbaWierszyDanych(csv) },
      });
    }

    res.send(csv);
  });

  return router;
}
