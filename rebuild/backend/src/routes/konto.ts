// Konto użytkownika — `POST /api/password/change` i `GET /api/users`.
// Port `deminified/backend-index.cjs:48195-48223` (obie trasy w rdzeniu, obie z `we`).

import { Router } from "express";

import { zmienHaslo } from "../auth/zmiana-hasla.js";
import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncRoute } from "../middleware/errors.js";
import { zapiszAudyt } from "../repos/audit.js";
import { listaUzytkownikow } from "../repos/users.js";

export type ZaleznosciKonta = {
  db: Baza;
};

export function trasyKonta({ db }: ZaleznosciKonta): Router {
  const router = Router();

  /**
   * Lista użytkowników (`:48195-48201`) — goła tablica trzech pól, bez koperty i bez
   * paginacji, `contract/fixtures/GET_users.json`. Odczyt, więc bez wpisu do audytu.
   *
   * `requireAuth` jest tu ODTWORZENIEM 1:1 — oryginał ma na tej trasie `we`.
   */
  router.get("/api/users", requireAuth, (_req, res) => {
    res.json(listaUzytkownikow(db));
  });

  /**
   * Zmiana hasła (`:48202-48223`). Ciało `{oldPassword, newPassword}`.
   *
   * Trasa sama sprawdza tylko TYPY obu pól (`:48206-48208`); cała logika i kolejność
   * sprawdzeń siedzi w `zmienHaslo` (port `P4`). Mapowanie kodu na status jest dosłowne:
   * 401 wyłącznie dla `WRONG_OLD_PASSWORD`, wszystko inne 400 (`:48212`).
   *
   * Odpowiedź błędu niesie OBA pola — `error` (tekst dla użytkownika) i `code`
   * (dla frontu). Widok `/moje-konto` pokazuje `error`, ale `code` jest częścią kontraktu.
   */
  router.post(
    "/api/password/change",
    requireAuth,
    asyncRoute(async (req, res) => {
      const { oldPassword, newPassword } = (req.body ?? {}) as {
        oldPassword?: unknown;
        newPassword?: unknown;
      };

      if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
        res.status(400).json({ error: "Wymagane: oldPassword i newPassword" });
        return;
      }

      // `requireAuth` gwarantuje `req.user`.
      const user = req.user!;
      const wynik = await zmienHaslo(db, user.id, oldPassword, newPassword);

      if (!wynik.ok) {
        res
          .status(wynik.code === "WRONG_OLD_PASSWORD" ? 401 : 400)
          .json({ error: wynik.message, code: wynik.code });
        return;
      }

      // `:48218-48220` — audyt niesie e-mail, nie hasło ani jego długość.
      zapiszAudyt(db, {
        uzytkownikId: user.id,
        uzytkownikImie: user.imieNazwisko,
        akcja: "zmiana_hasla",
        encjaTyp: "user",
        encjaId: user.id,
        szczegoly: { email: user.email },
      });

      res.json({ ok: true });
    }),
  );

  return router;
}
