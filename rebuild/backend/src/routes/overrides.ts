// Poprawki Marty — `manual_overrides`. Trzy trasy: lista/filtr, upsert, kasowanie.
//
// ⚠ `PUT /api/overrides/{id}` NIE ISTNIEJE — ani w produkcji, ani w zamrożonym kontrakcie.
// Zapis idzie przez `POST /api/overrides`, które jest UPSERTEM po (dostawca, kod, pole),
// a nie zwykłym „utwórz". Wcześniejsze wersje roadmapy podawały tu `PUT` — sprostowane
// w 3d-2 przez porównanie żywego kodu (`:48650`) z `openapi.yaml`.

import { Router } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { listaPoprawek, poprawkiDla, usunPoprawke, zapiszPoprawke } from "../repos/overrides.js";

export type ZaleznosciOverrides = {
  db: Baza;
};

export function trasyOverrides({ db }: ZaleznosciOverrides): Router {
  const router = Router();

  /**
   * Lista poprawek albo — po podaniu OBU parametrów — poprawki jednej pozycji (`:48645`).
   *
   * ⚠ ODSTĘPSTWO ŚWIADOME (D1): w produkcji ta trasa jest PUBLICZNA (brak `we` przy
   * `e.get("/api/overrides", …)`). Stosujemy `requireAuth`, kontynuując decyzję zaklepaną
   * w I1 (auth na wszystkich trasach danych) — tak samo jak `GET /api/products` w I2
   * i `GET /api/staging` w 3b. Kształt odpowiedzi bez zmian.
   *
   * Filtr działa tylko przy KOMPLECIE `dostawca` + `kod`; sam `dostawca` jest ignorowany
   * i zwraca pełną listę. Odtworzone dosłownie.
   */
  router.get("/api/overrides", requireAuth, (req, res) => {
    const dostawca = req.query.dostawca == null ? undefined : String(req.query.dostawca);
    const kod = req.query.kod == null ? undefined : String(req.query.kod);

    if (dostawca && kod) return res.json(poprawkiDla(db, dostawca, kod));
    return res.json(listaPoprawek(db));
  });

  /** Upsert poprawki po (dostawca, kod, pole) (`:48650`). */
  router.post("/api/overrides", requireAuth, (req, res) => {
    const { supplierKod, supplierProductId, fieldName, overrideValue, reason } = (req.body ??
      {}) as Record<string, unknown>;

    if (!supplierKod || !supplierProductId || !fieldName) {
      return res
        .status(400)
        .json({ error: "Wymagane: supplierKod, supplierProductId, fieldName" });
    }

    const poprawka = zapiszPoprawke(db, {
      supplierKod: String(supplierKod),
      supplierProductId: String(supplierProductId),
      fieldName: String(fieldName),
      // `null`/`undefined` → pusty napis, nie błąd: pusta poprawka to sposób Marty na
      // wyczyszczenie pola, które dostawca uparcie wypełnia (`overrideValue` jest NOT NULL).
      overrideValue: overrideValue == null ? "" : String(overrideValue),
      reason: (reason as string | undefined) ?? "ręczny override",
      createdBy: req.user!.id,
      createdAt: new Date().toISOString(),
    });

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "override",
      encjaTyp: "manual_override",
      encjaId: String(poprawka.id),
      szczegoly: { dostawca: supplierKod, produkt: supplierProductId, pole: fieldName },
    });

    return res.json(poprawka);
  });

  /** Kasowanie poprawki (`:48675`). 404, gdy nie istnieje. */
  router.delete("/api/overrides/:id", requireAuth, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const skasowana = usunPoprawke(db, id);
    if (!skasowana) return res.status(404).json({ error: "Nie znaleziono override" });

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "usuniecie_override",
      encjaTyp: "manual_override",
      encjaId: String(id),
      szczegoly: {
        dostawca: skasowana.supplierKod,
        produkt: skasowana.supplierProductId,
        pole: skasowana.fieldName,
      },
    });

    return res.json({ ok: true });
  });

  return router;
}
