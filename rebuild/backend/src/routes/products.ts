import { Router, type RequestHandler } from "express";
import { sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { zapiszWpisDziennika } from "../repos/dziennik-zmian.js";
import { zapiszPoprawke } from "../repos/overrides.js";
import {
  aktualizujProdukt,
  listaProduktow,
  listaProduktowStronicowana,
  odsiejPolaEdytowalneProduktu,
  produktPoId,
  usunProdukt,
  wKontrakcie,
} from "../repos/products.js";
import { dodajProduktyBulk, type PozycjaBulku } from "../import/bulk.js";

export type ZaleznosciProduktow = {
  db: Baza;
};

/** Górny pułap `limit` z oryginału (backend-index.cjs:48281: `Math.min(…, 2e3)`). */
export const MAX_LIMIT = 2000;

/** Wartość `limit` używana, gdy parametr jest obecny, ale nie daje się sparsować. */
export const DOMYSLNY_LIMIT = 200;

/**
 * Produkty — wierne odtworzenie oryginału (backend-index.cjs:48280-48294).
 *
 * ⚠ Endpoint ma DWA kształty odpowiedzi i to nie jest niedopatrzenie:
 *
 *   • `limit` NIEPODANY i `dostawca` NIEPODANY  →  goła TABLICA wszystkich produktów
 *   • w każdym innym przypadku                  →  `{ items, total, limit, offset }`
 *
 * Frontend katalogu korzysta z pierwszego wariantu (`queryKey: ["/api/products"]`,
 * frontend-index.js:23261) — pobiera komplet i filtruje/sortuje/paginuje u siebie.
 * Fixture `contract/fixtures/GET_products.json` zamraża wariant drugi (`?limit=5`).
 *
 * Endpoint NIE zna `search` ani `sort` — produkcja ich nie obsługuje.
 * `GET /api/products/{id}` nie istnieje ani w produkcji, ani w kontrakcie
 * (openapi.yaml:834-870 ma tam wyłącznie delete/patch/put) — dlatego go tu nie ma.
 */
export function trasyProduktow({ db }: ZaleznosciProduktow): Router {
  const router = Router();

  router.get("/api/products", requireAuth, (req, res) => {
    // 1:1 z oryginałem: `parseInt(…) || 200` — czyli NaN i 0 dają 200, a nie błąd.
    // Rozróżnienie „brak parametru" vs „parametr niepoprawny" jest tu istotne,
    // bo tylko brak przełącza odpowiedź na gołą tablicę.
    const limit =
      req.query.limit !== undefined
        ? Math.min(parseInt(String(req.query.limit), 10) || DOMYSLNY_LIMIT, MAX_LIMIT)
        : undefined;
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
    const dostawca = req.query.dostawca ? String(req.query.dostawca) : undefined;

    if (limit === undefined && dostawca === undefined) {
      res.json(listaProduktow(db));
      return;
    }

    const { items, total } = listaProduktowStronicowana(
      db,
      limit ?? DOMYSLNY_LIMIT,
      offset,
      dostawca,
    );
    res.json({ items, total, limit: limit ?? DOMYSLNY_LIMIT, offset });
  });

  // ————————————————————————————————————————————————————————————————————————————————————
  // uwaga_cena — DWIE trasy spoza zamrożonego kontraktu (`mirror/backend/uwaga_cena_patch.cjs`).
  //
  // W produkcji są monkey-patchem doklejanym do `index.cjs` po buildzie, dlatego nie ma ich
  // ani w `deminified/backend-index.cjs`, ani (do tego ticketa) w `contract/openapi.yaml`.
  // Ścieżki dopisane do kontraktu w 12a; schematy ciał dojdą w 12d z nagrań produkcji.
  //
  // ⚠ REJESTRACJA PRZED TRASAMI PARAMETRYCZNYMI. Dziś kolizji nie ma, bo `GET /api/products/{id}`
  // nie istnieje ani w produkcji, ani w kontrakcie — ale gdyby kiedyś powstał, `uwagi-cena`
  // wpadłoby w niego jako `id`. Kolejność jest tu zabezpieczeniem, nie przypadkiem.
  // ————————————————————————————————————————————————————————————————————————————————————

  /**
   * Port `uwaga_cena_patch.cjs:96-110`.
   *
   * ⚠ KLUCZ `uwaga_cena` JEST W `snake_case` — i tak ma zostać. Produkcja czyta te wiersze
   * surowym `better-sqlite3` (`db.prepare(...).all()`), więc oddaje nazwy KOLUMN, nie pól
   * modelu. Gołe `select()` Drizzle'a dałoby tu `uwagaCena` i rozjechałoby kształt — to
   * dokładnie pułapka opisana w `CLAUDE.md` (siedem kluczy naraz na `GET /api/selly/log`).
   * Dlatego projekcja jest wypisana JAWNIE, z aliasem.
   */
  router.get("/api/products/uwagi-cena", requireAuth, (_req, res) => {
    const items = db.all<{ id: number; kod: string; ean: string | null; uwaga_cena: string }>(
      sql`SELECT id, kod, ean, uwaga_cena
          FROM products
          WHERE uwaga_cena IS NOT NULL AND uwaga_cena <> ''`,
    );
    res.json({ ok: true, items });
  });

  /**
   * Port `uwaga_cena_patch.cjs:120-147` — powód wstrzymania liczony W LOCIE, nie z kolumny.
   *
   * Pięć przypadków w tej dokładnie kolejności; `uwaga_cena` bije wszystkie pozostałe, więc
   * produkt z ceną 0 ORAZ uwagą dostaje treść uwagi, a nie „Brak ceny u dostawcy".
   * Szósta gałąź (`else`) jest w oryginale nieosiągalna — `Number(x) || 0` nie produkuje
   * wartości ujemnych ani `NaN` — ale portujemy ją 1:1 razem z resztą.
   */
  router.get("/api/products/hold-reasons", requireAuth, (_req, res) => {
    const wiersze = db.all<{
      id: number;
      kod: string;
      ean: string | null;
      cena_zakupu: number | null;
      stan: number | null;
      uwaga_cena: string | null;
    }>(
      sql`SELECT id, kod, ean, cena_zakupu, stan, uwaga_cena
          FROM products
          WHERE status = 'wstrzymany'`,
    );

    const items = wiersze.map((w) => {
      const cenaZakupu = Number(w.cena_zakupu) || 0;
      const stan = Number(w.stan) || 0;
      let reason: string;
      if (w.uwaga_cena && String(w.uwaga_cena).trim() !== "") {
        reason = String(w.uwaga_cena).trim();
      } else if (cenaZakupu === 0 && stan === 0) {
        reason = "Brak ceny i stanu u dostawcy";
      } else if (cenaZakupu === 0 && stan > 0) {
        reason = "Brak ceny u dostawcy";
      } else if (cenaZakupu > 0 && stan === 0) {
        reason = "Brak stanu magazynowego u dostawcy";
      } else if (cenaZakupu > 0 && stan > 0) {
        reason = "Wstrzymane — sprawdź ręcznie";
      } else {
        reason = "Wstrzymane — powód nieznany";
      }
      return { id: w.id, kod: w.kod, ean: w.ean, reason };
    });

    res.json({ ok: true, items });
  });

  /**
   * Hurtowy zapis — port `:48306-48314`.
   *
   * ⚠ DWA DOPUSZCZALNE KSZTAŁTY CIAŁA, oba odtworzone: goła tablica ALBO `{items: [...]}`.
   * Cokolwiek innego daje pustą listę i `dodano: 0` — oryginał nie waliduje wejścia.
   * Odpowiedź niesie LICZBĘ, nie zapisane produkty.
   *
   * BEZ listy pól edytowalnych — i to jest różnica wobec `PATCH`/`PUT` niżej, nie przeoczenie.
   * Bulk MUSI zapisywać kolumny wyliczane, bo to on je produkuje (`marzaPct`, `magazyn`,
   * `kodImportu`, wymiary paczki). Odsiew stoi na poziomie kolumn tabeli
   * (`tylkoKolumnyProduktu`), tak samo jak przy `acceptStaging`.
   */
  router.post("/api/products", requireAuth, (req, res) => {
    const cialo = req.body as unknown;
    const pozycje: PozycjaBulku[] = Array.isArray(cialo)
      ? (cialo as PozycjaBulku[])
      : (((cialo as { items?: PozycjaBulku[] } | null)?.items ?? []) as PozycjaBulku[]);

    const dodano = dodajProduktyBulk(db, pozycje);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "bulk_dodanie_produktow",
      encjaTyp: "produkt",
      // ⚠ `encjaId` to PUSTY NAPIS, nie null — oryginał podaje `""` (`:48310`).
      encjaId: "",
      szczegoly: { ile: dodano },
    });

    res.json({ ok: true, dodano });
  });

  /**
   * Edycja produktu — WSPÓLNY handler `PUT` i `PATCH` (`:48415-48449` i `:48452-48487`).
   *
   * ⚠ ROZJAZD Z ROADMAPĄ, SPROSTOWANY W 12a: to NIE jest w oryginale jeden handler. `:48415`
   * obsługuje wyłącznie `PUT`; `PATCH` ma własną, niemal identyczną funkcję zdefiniowaną tuż
   * obok. Jedyna różnica to kolejność efektów: `PUT` robi pętlę override/history i dopiero
   * potem audyt, `PATCH` odwrotnie. Stan końcowy bazy i odpowiedź są identyczne, więc
   * portujemy jedną funkcję (decyzja D2 ticketa 35) zamiast duplikować czterdzieści linii.
   *
   * Trasa dotyka TRZECH tabel poza `products`:
   *  • `manual_overrides` — jeden wiersz na każde zmienione pole. To znaczy, że ręczna edycja
   *    ZAMRAŻA pole przed importem: silnik respektuje poprawki (3d-1). Stąd lista pól
   *    edytowalnych decyduje nie tylko o tym, co da się zapisać.
   *  • `history` — jeden wiersz na każde zmienione pole (`:48435`). Do 12a ta tabela nie
   *    miała w rebuildzie pisarza i `GET /api/history` zwracał `[]`.
   *  • `audit_log` — jeden wpis `edycja_produktu` na całe żądanie.
   */
  const handlerEdycji: RequestHandler = (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const przed = produktPoId(db, id);
    if (!przed) {
      res.status(404).json({ error: "Nie znaleziono produktu" });
      return;
    }

    // Oryginał odsiewa WYŁĄCZNIE `_reason` i oddaje resztę (70 kolumn) do `updateProduct`.
    // My przepuszczamy ciało przez listę pól — świadome odstępstwo, backlog #14 / D1.
    const { _reason, ...reszta } = (req.body ?? {}) as Record<string, unknown>;
    const zmiany = odsiejPolaEdytowalneProduktu(reszta);
    const powod = (_reason as string | undefined) ?? "edycja w katalogu";

    const po = aktualizujProdukt(db, id, zmiany);
    if (!po) {
      res.status(404).json({ error: "Nie znaleziono produktu" });
      return;
    }

    const teraz = new Date().toISOString();
    for (const [pole, nowa] of Object.entries(zmiany)) {
      // ⚠ Porównanie ŚCISŁE (`!==`) na wartości SPRZED zapisu, dokładnie jak `:48426`.
      // Skutek uboczny, który jest zachowaniem oryginału: `"9"` z JSON-a i `9` z bazy to dla
      // niego DWIE różne wartości, więc przysłanie liczby jako napisu tworzy poprawkę i wpis
      // dziennika mimo braku zmiany merytorycznej.
      // Pole wysłane z niezmienioną wartością nie tworzy ani poprawki, ani wpisu dziennika.
      const stara = (przed as unknown as Record<string, unknown>)[pole];
      if (stara === nowa) continue;

      zapiszPoprawke(db, {
        supplierKod: przed.dostawca,
        supplierProductId: przed.kod,
        fieldName: pole,
        // `null`/`undefined` → pusty napis, a nie napis "null" (`:48431`).
        overrideValue: nowa == null ? "" : String(nowa),
        reason: powod,
        createdBy: req.user?.id ?? null,
        createdAt: teraz,
      });

      zapiszWpisDziennika(db, {
        data: teraz,
        kodProduktu: przed.kod,
        nazwa: przed.nazwa,
        pole,
        // ⚠ TU `String(...)` jest BEZWARUNKOWY (`:48441-48442`), więc `null` staje się
        // napisem "null" — inaczej niż w poprawce wyżej. Niespójność oryginału, port 1:1.
        staraWartosc: String(stara),
        nowaWartosc: String(nowa),
        zrodlo: "recznie",
        kto: req.user?.imieNazwisko ?? "",
        wykonalUzytkownikId: req.user?.id ?? null,
      });
    }

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "edycja_produktu",
      encjaTyp: "produkt",
      encjaId: przed.kod,
      // ⚠ `zmiany` to klucze PO odsianiu listą pól — audyt opisuje to, co realnie zapisaliśmy.
      // Inaczej niż przy narzutach/promocjach (4a), gdzie audyt loguje surowe ciało.
      szczegoly: { zmiany: Object.keys(zmiany) },
    });

    // Odpowiedź w projekcji kontraktowej — bez niej `uwagaCena` (migracja 002) wyciekłaby
    // do API 73. kluczem, tak jak `importWylaczony` u dostawców w 3f-2.
    res.json(wKontrakcie(po));
  };

  router.put("/api/products/:id", requireAuth, handlerEdycji);
  router.patch("/api/products/:id", requireAuth, handlerEdycji);

  /**
   * Usunięcie produktu — port `:48407-48414`.
   *
   * ⚠ BEZ KASKAD. `manual_overrides` i `history` powiązane z produktem zostają w bazie jako
   * sieroty — oryginał ich nie rusza. Zastane zachowanie, nie naprawiamy go tutaj.
   */
  router.delete("/api/products/:id", requireAuth, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    if (!usunProdukt(db, id)) {
      res.status(404).json({ error: "Nie znaleziono produktu" });
      return;
    }

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "usuniecie_produktu",
      encjaTyp: "produkt",
      // ⚠ `encjaId` to `id` produktu jako TEKST (`c.params.id`), a nie `kod` — inaczej niż
      // w `edycja_produktu` wyżej. Niespójność oryginału (`:48412`), port 1:1.
      encjaId: String(req.params.id),
    });

    res.json({ ok: true });
  });

  return router;
}
