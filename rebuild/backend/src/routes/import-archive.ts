import { Router } from "express";
import {
  listaArchiwum,
  statystykiArchiwum,
  szukajPlikuArchiwum,
} from "../import/archiwum.js";
import { requireAuth } from "../middleware/auth.js";

export type ZaleznosciArchiwumImportu = {
  /** Nadpisanie `IMPORT_ARCHIVE_DIR` (testy, `app.ts`) — ta sama forma co w `trasyImportu`. */
  katalogArchiwum?: string | undefined;
};

/** Pierwsza wartość parametru query jako tekst — `?x=a&x=b` w Expressie daje tablicę. */
function tekstZQuery(wartosc: unknown): string | undefined {
  const pierwsza = Array.isArray(wartosc) ? wartosc[0] : wartosc;
  return typeof pierwsza === "string" ? pierwsza : undefined;
}

function komunikat(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Archiwum importów — trzy trasy ODCZYTU, port `mirror/backend/archive_module.cjs:160-241`
 * (ticket 91, karta PR.1). Zapis archiwum przy imporcie żyje w `routes/import.ts`
 * i `routes/suppliers.ts` (3b) — tutaj tylko czytamy.
 *
 * Wszystkie trzy za `we` w oryginale → `requireAuth` (Bearer albo cookie), 401
 * `{error:"Nieautoryzowany"}`. Kody i ciała błędów (`{ok:false, error}`) dosłownie z oryginału.
 *
 * ⚠ Komentarz nagłówka oryginału (`file/:id`, rotacja 90 dni) jest nieaktualny od łatek
 * z 2026-08-21 (`.bak_dlfix_20260821`, `.bak_ret7_20260821`): trasa pobrania ma DWA segmenty,
 * bo Apache z `AllowEncodedSlashes=Off` odrzucał `%2F` w jednym `:id`, a retencja to 7 dni.
 */
export function trasyArchiwumImportu({ katalogArchiwum }: ZaleznosciArchiwumImportu = {}): Router {
  const router = Router();
  const env: NodeJS.ProcessEnv = katalogArchiwum
    ? { ...process.env, IMPORT_ARCHIVE_DIR: katalogArchiwum }
    : process.env;

  // Lista: GET /api/import-archive?dostawca=MO1&miesiac=2026-08&status=ok|blad (:169-200)
  router.get("/api/import-archive", requireAuth, (req, res) => {
    try {
      const items = listaArchiwum(
        {
          dostawca: tekstZQuery(req.query.dostawca),
          miesiac: tekstZQuery(req.query.miesiac),
          status: tekstZQuery(req.query.status),
        },
        env,
      );
      res.json({ ok: true, total: items.length, items });
    } catch (e) {
      console.error("[archiwum] BŁĄD listy:", komunikat(e));
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  // Statystyki: GET /api/import-archive/stats (:203-220)
  router.get("/api/import-archive/stats", requireAuth, (_req, res) => {
    try {
      res.json({ ok: true, ...statystykiArchiwum(env) });
    } catch (e) {
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  // Pobranie: GET /api/import-archive/file/:month/:name (:224-238)
  router.get("/api/import-archive/file/:month/:name", requireAuth, (req, res) => {
    try {
      const wynik = szukajPlikuArchiwum(req.params.month ?? "", req.params.name ?? "", env);
      if (wynik.rodzaj === "nieprawidlowe-id") {
        res.status(400).json({ ok: false, error: "Nieprawidłowe id" });
        return;
      }
      if (wynik.rodzaj === "brak") {
        res.status(404).json({ ok: false, error: "Nie znaleziono pliku" });
        return;
      }
      // Nazwa w nagłówku to nazwa W ARCHIWUM (`MO6__20260922__12345__MO6.csv`), nie oryginalna —
      // front i tak zapisuje plik pod `oryginalnaNazwa` z listy (archive-injection.js:220).
      res.setHeader("Content-Disposition", `attachment; filename="${wynik.nazwa}"`);
      res.sendFile(wynik.sciezka);
    } catch (e) {
      res.status(500).json({ ok: false, error: komunikat(e) });
    }
  });

  return router;
}
