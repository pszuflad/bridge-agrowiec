// Atrybuty — 13 ścieżek / 18 operacji (`contract/openapi.yaml:333-530`).
//
// Port dwóch modułów oryginału ładowanych przez `mirror/backend/extensions.cjs:114,121`:
//   • `atrybuty_module.cjs` — słownik: `/api/atrybuty`, rodzaje×4, wartości×4, liczniki, użycie;
//   • `pending_module.cjs`  — kolejka: pending×2, akceptacje×3, odrzucenie, skan.
//
// ⚠ `requireAuth` NA WSZYSTKICH TRASACH TO ODTWORZENIE 1:1, NIE ODSTĘPSTWO. Inaczej niż przy
// promocjach czy narzutach (D1 z I1), oryginał wpina tu middleware auth (`we` z ctx,
// `extensions.cjs:80,105`) w każdą trasę obu modułów. Nie ma tu czego odnotowywać jako zmianę.
//
// ⚠ BŁĘDY ODDAJEMY LOKALNIE JAKO `{ok:false, error}`. Globalny `bladHandler` zwraca `{error}`
// bez `ok`, więc przepuszczenie tych błędów przez `next(err)` zmieniłoby kształt odpowiedzi,
// który front 7b (i `pending-injection.js` w produkcji) czyta wprost.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import {
  czyRodzajIstnieje,
  czyWartoscWKatalogu,
  dodajRodzaj,
  dodajWartosc,
  licznikiAtrybutow,
  listaRodzajow,
  listaRodzajowZeZnacznikiem,
  listaWartosci,
  rodzajPoValue,
  slugRodzaju,
  usunRodzaj,
  usunWartosc,
  uzycieAtrybutu,
  wartoscPoId,
  zmienRodzaj,
  zmienWartosc,
  znanyRodzaj,
} from "../repos/atrybuty.js";
import {
  akceptujJakoAlias,
  akceptujPending,
  akceptujZEdycja,
  kolumnaRodzaju,
  listaPending,
  odrzucPending,
  pozycjaPendingPoId,
  skanujNoweWartosci,
  wyczyscPending,
} from "../repos/atrybuty-pending.js";

export type ZaleznosciAtrybutow = {
  db: Baza;
};

/** Błąd w kształcie oryginału — `{ok:false, error}` z własnym kodem. */
function blad(res: Response, status: number, komunikat: string): Response {
  return res.status(status).json({ ok: false, error: komunikat });
}

/** Czy wyjątek pochodzi z naruszenia UNIQUE — oryginał sprawdza to napisem (`:145`, `:211`). */
function naruszenieUnique(e: unknown): boolean {
  return e instanceof Error && e.message.includes("UNIQUE");
}

/** Pojedynczy parametr zapytania; tablica (`?rodzaj=a&rodzaj=b`) nie jest filtrem. */
function parametr(wartosc: unknown): string | undefined {
  return typeof wartosc === "string" && wartosc !== "" ? wartosc : undefined;
}

export function trasyAtrybutow({ db }: ZaleznosciAtrybutow): Router {
  const router = Router();

  // ————————————————————————————— słownik —————————————————————————————

  /** Cała struktura słownika (`atrybuty_module.cjs:103-111`). */
  router.get("/api/atrybuty", requireAuth, (_req: Request, res: Response) => {
    res.json({
      ok: true,
      rodzaje: listaRodzajowZeZnacznikiem(db),
      wartosci: listaWartosci(db),
    });
  });

  /**
   * Lista rodzajów (`:114-121`).
   *
   * ⚠ BEZ pola `utworzony`, choć trasa wyżej je zwraca — SELECT oryginału (`:116`) go nie
   * pobiera. Różnica jest widoczna w obu nagraniach produkcji i jest odtworzona celowo.
   */
  router.get("/api/atrybuty/rodzaje", requireAuth, (_req: Request, res: Response) => {
    res.json({ ok: true, rodzaje: listaRodzajow(db) });
  });

  /** Nowy rodzaj (`:125-150`). `value` opcjonalne — bez niego slug z `label`. */
  router.post("/api/atrybuty/rodzaje", requireAuth, (req: Request, res: Response) => {
    const cialo = (req.body ?? {}) as { value?: unknown; label?: unknown; opis?: unknown };
    const label = typeof cialo.label === "string" ? cialo.label.trim() : "";
    if (!label) return blad(res, 400, "Brak label");

    const opis = typeof cialo.opis === "string" ? cialo.opis : undefined;
    const value =
      typeof cialo.value === "string" && cialo.value ? cialo.value : slugRodzaju(label);
    if (!value) return blad(res, 400, "Nie udało się wygenerować value z label");

    try {
      dodajRodzaj(db, { value, label, opis });
    } catch (e) {
      if (naruszenieUnique(e)) return blad(res, 409, `Rodzaj '${value}' już istnieje`);
      throw e;
    }

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "atrybut_rodzaj_dodano",
      encjaTyp: "atrybut_rodzaj",
      encjaId: value,
      szczegoly: { label, opis },
    });

    return res.json({ ok: true, rodzaj: { value, label, opis: opis || null, core: 0 } });
  });

  /**
   * Edycja rodzaju (`:153-166`).
   *
   * ⚠ `core` NIE BLOKUJE edycji — wbudowany rodzaj można przemianować. Blokada dotyczy tylko
   * usunięcia (`:174`). Asymetria jest w oryginale.
   */
  router.put("/api/atrybuty/rodzaje/:value", requireAuth, (req: Request, res: Response) => {
    const value = String(req.params.value ?? "");
    const cialo = (req.body ?? {}) as { label?: unknown; opis?: unknown };

    if (!rodzajPoValue(db, value)) return blad(res, 404, "Nie znaleziono");
    zmienRodzaj(db, value, cialo);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "atrybut_rodzaj_zmieniono",
      encjaTyp: "atrybut_rodzaj",
      encjaId: value,
      szczegoly: { label: cialo.label, opis: cialo.opis },
    });

    return res.json({ ok: true });
  });

  /** Usunięcie rodzaju (`:169-182`). Wartości znikają kaskadą z klucza obcego. */
  router.delete("/api/atrybuty/rodzaje/:value", requireAuth, (req: Request, res: Response) => {
    const value = String(req.params.value ?? "");
    const rodzaj = rodzajPoValue(db, value);
    if (!rodzaj) return blad(res, 404, "Nie znaleziono");
    if (rodzaj.core) return blad(res, 403, "Nie można usunąć wbudowanego rodzaju");

    usunRodzaj(db, value);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "atrybut_rodzaj_usunieto",
      encjaTyp: "atrybut_rodzaj",
      encjaId: value,
      szczegoly: {},
    });

    return res.json({ ok: true });
  });

  /** Wartości słownika, opcjonalnie jednego rodzaju (`:185-196`). */
  router.get("/api/atrybuty/wartosci", requireAuth, (req: Request, res: Response) => {
    res.json({ ok: true, wartosci: listaWartosci(db, parametr(req.query.rodzaj)) });
  });

  /** Nowa wartość (`:199-216`). */
  router.post("/api/atrybuty/wartosci", requireAuth, (req: Request, res: Response) => {
    const cialo = (req.body ?? {}) as { rodzaj?: unknown; wartosc?: unknown };
    const rodzaj = typeof cialo.rodzaj === "string" ? cialo.rodzaj : "";
    if (!rodzaj || cialo.wartosc == null || cialo.wartosc === "") {
      return blad(res, 400, "Brak rodzaj lub wartosc");
    }
    if (!czyRodzajIstnieje(db, rodzaj)) return blad(res, 400, `Rodzaj '${rodzaj}' nie istnieje`);

    const wartosc = String(cialo.wartosc).trim();
    if (!wartosc) return blad(res, 400, "Pusta wartość");

    let dodana;
    try {
      dodana = dodajWartosc(db, rodzaj, wartosc);
    } catch (e) {
      if (naruszenieUnique(e)) {
        return blad(res, 409, "Taka wartość już istnieje dla tego rodzaju");
      }
      throw e;
    }

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "atrybut_wartosc_dodano",
      encjaTyp: "atrybut_wartosc",
      encjaId: dodana.id,
      szczegoly: { rodzaj, wartosc },
    });

    return res.json({ ok: true, wartosc: dodana });
  });

  /** Zmiana wartości (`:219-234`). */
  router.put("/api/atrybuty/wartosci/:id", requireAuth, (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const cialo = (req.body ?? {}) as { wartosc?: unknown };
    if (cialo.wartosc == null || cialo.wartosc === "") return blad(res, 400, "Brak wartosc");

    let zmienione: number;
    try {
      zmienione = zmienWartosc(db, id, String(cialo.wartosc).trim());
    } catch (e) {
      if (naruszenieUnique(e)) return blad(res, 409, "Taka wartość już istnieje");
      throw e;
    }
    if (zmienione === 0) return blad(res, 404, "Nie znaleziono");

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "atrybut_wartosc_zmieniono",
      encjaTyp: "atrybut_wartosc",
      encjaId: id,
      // Oryginał loguje SUROWĄ wartość z ciała, a zapisuje przyciętą (`:224` vs `:226`).
      szczegoly: { wartosc: cialo.wartosc },
    });

    return res.json({ ok: true });
  });

  /** Usunięcie wartości (`:237-248`). */
  router.delete("/api/atrybuty/wartosci/:id", requireAuth, (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const wiersz = wartoscPoId(db, id);
    if (!wiersz) return blad(res, 404, "Nie znaleziono");

    usunWartosc(db, id);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "atrybut_wartosc_usunieto",
      encjaTyp: "atrybut_wartosc",
      encjaId: id,
      szczegoly: wiersz,
    });

    return res.json({ ok: true });
  });

  /**
   * Liczniki użycia (`:270-286`).
   *
   * ⚠ GOŁA MAPA, BEZ `ok` — jedyna taka odpowiedź w całym module. Potwierdza to
   * `contract/fixtures/GET_atrybuty_liczniki.json`. Dodanie `ok` byłoby zmianą kontraktu.
   */
  router.get("/api/atrybuty/liczniki", requireAuth, (_req: Request, res: Response) => {
    res.json(licznikiAtrybutow(db));
  });

  /** Produkty używające wartości atrybutu (`:289-303`). */
  router.get("/api/atrybuty/uzycie", requireAuth, (req: Request, res: Response) => {
    const rodzaj = req.query.rodzaj;
    if (!znanyRodzaj(rodzaj)) {
      // Interpolacja jak w oryginale (`:293`) — stąd nagrane „…: undefined”, gdy rejestrator
      // wołał trasę bez parametrów (`contract/fixtures/GET_atrybuty_uzycie.json`).
      return blad(res, 400, `Nieznany rodzaj atrybutu: ${String(rodzaj)}`);
    }
    const wartosc = req.query.wartosc;
    if (wartosc == null || wartosc === "") return blad(res, 400, "Brak wartosc");

    const { count, products } = uzycieAtrybutu(db, rodzaj, String(wartosc));
    return res.json({ ok: true, count, products });
  });

  // ————————————————————————————— kolejka pending —————————————————————————————
  //
  // ⚠ ŻADNA trasa poniżej nie pisze do audytu — oryginalny moduł nie dostaje funkcji `be`
  // (`pending_module.cjs:199`). Dotyczy to też akceptacji przepisujących `products`.
  // Decyzja użytkownika: odtwarzamy 1:1 (plan.md D4).

  /** Kolejka z podpowiedziami aliasów (`pending_module.cjs:218-250`). */
  router.get("/api/atrybuty/pending", requireAuth, (req: Request, res: Response) => {
    const pozycje = listaPending(db, parametr(req.query.rodzaj));
    res.json({ ok: true, count: pozycje.length, items: pozycje });
  });

  /**
   * Wyczyszczenie kolejki (`:377-390`), opcjonalnie jednego rodzaju.
   *
   * ⚠ Bez wpisu do odrzuconych — wartości wrócą przy kolejnym skanie, jeśli produkty wciąż
   * je zawierają. Roadmapa §5 I7 pomijała tę operację w wyliczeniu backendu; jest w kontrakcie
   * i woła ją UI produkcji (`pending-injection.js:990`).
   */
  router.delete("/api/atrybuty/pending", requireAuth, (req: Request, res: Response) => {
    const rodzaj = parametr(req.query.rodzaj);
    res.json({ ok: true, usunieto: wyczyscPending(db, rodzaj), rodzaj: rodzaj ?? null });
  });

  /** Akceptacja zwykła (`:253-270`) — wartość do słownika, `products` bez zmian. */
  router.post("/api/atrybuty/pending/:id/akceptuj", requireAuth, (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const pozycja = pozycjaPendingPoId(db, id);
    if (!pozycja) return blad(res, 404, "Pozycja pending nie istnieje");

    akceptujPending(db, id, pozycja.rodzaj, pozycja.wartosc);
    return res.json({
      ok: true,
      akcja: "akceptowana",
      rodzaj: pozycja.rodzaj,
      wartosc: pozycja.wartosc,
    });
  });

  /** Akceptacja z edycją (`:274-307`) — poprawiona wartość zastępuje starą w `products`. */
  router.post(
    "/api/atrybuty/pending/:id/akceptuj-z-edycja",
    requireAuth,
    (req: Request, res: Response) => {
      const id = Number.parseInt(String(req.params.id ?? ""), 10);
      const cialo = (req.body ?? {}) as { nowa_wartosc?: unknown };
      const nowa = String(cialo.nowa_wartosc ?? "").trim();
      if (!nowa) return blad(res, 400, "Brak nowa_wartosc");

      const pozycja = pozycjaPendingPoId(db, id);
      if (!pozycja) return blad(res, 404, "Pozycja pending nie istnieje");

      const kolumna = kolumnaRodzaju(pozycja.rodzaj);
      if (!kolumna) return blad(res, 400, `Nieznany rodzaj: ${pozycja.rodzaj}`);

      const zmienione = akceptujZEdycja(db, {
        id,
        rodzaj: pozycja.rodzaj,
        kolumna,
        stara: pozycja.wartosc,
        nowa,
      });

      return res.json({
        ok: true,
        akcja: "akceptowana_z_edycja",
        z: pozycja.wartosc,
        na: nowa,
        produktow_zaktualizowano: zmienione,
      });
    },
  );

  /**
   * Akceptacja jako alias (`:311-342`) — produkty dostają wartość kanoniczną.
   *
   * Kanoniczna MUSI już być w słowniku tego rodzaju; inaczej 400. Sama wartość aliasowana
   * do słownika NIE trafia — nie ma tabeli aliasów, mapowanie nigdzie nie zostaje.
   */
  router.post(
    "/api/atrybuty/pending/:id/akceptuj-jako-alias",
    requireAuth,
    (req: Request, res: Response) => {
      const id = Number.parseInt(String(req.params.id ?? ""), 10);
      const cialo = (req.body ?? {}) as { kanoniczna_wartosc?: unknown };
      const kanoniczna = String(cialo.kanoniczna_wartosc ?? "").trim();
      if (!kanoniczna) return blad(res, 400, "Brak kanoniczna_wartosc");

      const pozycja = pozycjaPendingPoId(db, id);
      if (!pozycja) return blad(res, 404, "Pozycja pending nie istnieje");

      if (!czyWartoscWKatalogu(db, pozycja.rodzaj, kanoniczna)) {
        return blad(res, 400, `Kanoniczna "${kanoniczna}" nie istnieje w katalogu ${pozycja.rodzaj}`);
      }

      const kolumna = kolumnaRodzaju(pozycja.rodzaj);
      if (!kolumna) return blad(res, 400, `Nieznany rodzaj: ${pozycja.rodzaj}`);

      const zmienione = akceptujJakoAlias(db, {
        id,
        kolumna,
        stara: pozycja.wartosc,
        kanoniczna,
      });

      return res.json({
        ok: true,
        akcja: "akceptowana_jako_alias",
        z: pozycja.wartosc,
        na: kanoniczna,
        produktow_zaktualizowano: zmienione,
      });
    },
  );

  /** Odrzucenie (`:345-362`) — wartość do tabeli odrzuconych, skan będzie ją pomijał. */
  router.post("/api/atrybuty/pending/:id/odrzuc", requireAuth, (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const pozycja = pozycjaPendingPoId(db, id);
    if (!pozycja) return blad(res, 404, "Pozycja pending nie istnieje");

    odrzucPending(db, id, pozycja.rodzaj, pozycja.wartosc);
    return res.json({
      ok: true,
      akcja: "odrzucona",
      rodzaj: pozycja.rodzaj,
      wartosc: pozycja.wartosc,
    });
  });

  /** Ręczne uruchomienie skanu (`:365-372`). Statystyki wracają rozpakowane do ciała. */
  router.post("/api/atrybuty/scan-pending", requireAuth, (_req: Request, res: Response) => {
    res.json({ ok: true, ...skanujNoweWartosci(db) });
  });

  return router;
}
