// Statusy pseudo-alertów katalogowych — `/api/alerty-katalogu/statusy` (karta P6.2,
// ticket `77-FEATURE-pseudo-alerty-katalogowe`).
//
// ⚠ TRASY NIE MA W PRODUKCJI — świadome odstępstwo (decyzja 2 użytkownika z 2026-09-21,
// backlog #26). Oryginał liczy pseudo-alerty w przeglądarce (`pv()`) i ich status trzyma
// w IndexedDB (`HT()`: `un("alerty-statusy", …)`), więc do backendu nie woła w ogóle. Odbudowa
// liczy alerty tak samo — w przeglądarce — a na serwer przenosi WYŁĄCZNIE status, żeby nie ginął
// po wyczyszczeniu historii i był wspólny dla komputerów (jak D1 z I6 dla alertów importu).
//
// Nagrania produkcji dla tej trasy nie ma i być nie może, więc kształt zamraża ręczny opis
// w `contract/openapi.yaml` (blok „ODSTĘPSTWO OD PRODUKCJI — P6.2") i test
// `test/alerty-katalogu.gate.test.ts`.

import { Router, type Request, type Response } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  STATUSY_ALERTU_KATALOGU,
  listStatusyKatalogu,
  rozbierzIdAlertu,
  ustawStatusyKatalogu,
  type StatusAlertuKatalogu,
} from "../repos/alerty-katalogu.js";

/**
 * Górna granica liczby `id` w jednym żądaniu. „Zaakceptuj wszystko" wysyła wszystkie widoczne
 * alerty naraz; na snapshocie 7405 produktów realna lista to kilkadziesiąt pozycji, a teoretyczny
 * sufit (każdy produkt z marżą <5 i jako nie-opona, plus dostawcy) to ok. dwa razy katalog.
 */
export const MAKS_ID_W_ZADANIU = 20_000;

/**
 * Najdłuższy przyjmowany `id`. Najdłuższa forma to `…-nie-opona-${nazwa}|${kategoria}`, a nazwa
 * i kategoria to wolny tekst z pliku dostawcy — limit odcina tylko śmieci, nie realne dane.
 */
export const MAKS_DLUGOSC_ID = 2_000;

export type ZaleznosciAlertowKatalogu = {
  db: Baza;
};

function czyStatus(wartosc: unknown): wartosc is StatusAlertuKatalogu {
  return (STATUSY_ALERTU_KATALOGU as readonly unknown[]).includes(wartosc);
}

export function trasyAlertowKatalogu({ db }: ZaleznosciAlertowKatalogu): Router {
  const router = Router();

  /**
   * Wszystkie zapisane statusy — goła tablica `{id, status, kto, kiedy}`. Alert, którego tu
   * nie ma, jest „nowy".
   */
  router.get("/api/alerty-katalogu/statusy", requireAuth, (_req: Request, res: Response) => {
    res.json(listStatusyKatalogu(db));
  });

  /**
   * Jeden status dla wielu alertów: `{ids: string[], status}`. Obsługuje zarówno przyciski przy
   * alercie, jak i „Zaakceptuj wszystko" — jedno żądanie, jedna transakcja. `nowy` kasuje wpis
   * („Otwórz ponownie", decyzja Q4). Sprzątanie starych odcisków: `repos/alerty-katalogu.ts`.
   *
   * W odróżnieniu od `PATCH /api/alerts/:id` (1:1 z oryginałem, bez walidacji) tu walidujemy:
   * trasa jest NASZA, więc nie ma zachowania do odtworzenia, a `CHECK` w tabeli i tak odrzuciłby
   * obcy status — lepiej czytelnym 400 niż 500. Audytu w `audit_log` brak, spójnie z alertami
   * importu (D4 z I6); „kto i kiedy" niesie sama tabela.
   */
  router.put("/api/alerty-katalogu/statusy", requireAuth, (req: Request, res: Response) => {
    const { ids, status } = (req.body ?? {}) as { ids?: unknown; status?: unknown };

    if (!czyStatus(status)) {
      res.status(400).json({
        error: `Nieznany status. Dozwolone: ${STATUSY_ALERTU_KATALOGU.join(", ")}`,
      });
      return;
    }
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAKS_ID_W_ZADANIU) {
      res.status(400).json({
        error: `Pole \`ids\` musi być niepustą tablicą (najwyżej ${MAKS_ID_W_ZADANIU} pozycji)`,
      });
      return;
    }

    const wpisy = [];
    for (const id of new Set(ids)) {
      if (typeof id !== "string" || id.length === 0 || id.length > MAKS_DLUGOSC_ID) {
        res.status(400).json({ error: "Każdy identyfikator alertu musi być niepustym tekstem" });
        return;
      }
      const rozbior = rozbierzIdAlertu(id);
      if (!rozbior) {
        res.status(400).json({ error: `Nieznany identyfikator alertu: ${id.slice(0, 100)}` });
        return;
      }
      wpisy.push({ id, ...rozbior });
    }

    const zmienione = ustawStatusyKatalogu(db, wpisy, status, {
      id: req.user?.id ?? null,
      imie: req.user?.imieNazwisko ?? null,
    });

    res.json({ ok: true, zmienione });
  });

  return router;
}
