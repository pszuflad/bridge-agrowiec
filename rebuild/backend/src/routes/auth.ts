import { Router } from "express";
import { ustawCookieSesji, wyczyscCookieSesji } from "../auth/cookie.js";
import { podpiszToken, type PayloadUzytkownika } from "../auth/jwt.js";
import { porownajHaslo } from "../auth/password.js";
import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncRoute } from "../middleware/errors.js";
import { pobierzUzytkownikaPoEmailu, zapiszOstatnieLogowanie } from "../repos/users.js";

export type ZaleznosciAuth = {
  db: Baza;
  jwtSecret: string;
  cookieSecure: boolean;
};

/**
 * Uwierzytelnianie — wierne odtworzenie oryginału (backend-index.cjs:48156-48183).
 *
 * Zachowane 1:1, mimo że kusi „poprawienie":
 *  - ten sam komunikat 401 dla nieznanego e-maila i błędnego hasła (nie zdradzamy, które),
 *  - BRAK rate-limitingu i lockoutu (oryginał ich nie ma — do rozważenia w Iteracji 12),
 *  - BRAK wpisu do `audit_log` przy logowaniu (oryginał loguje tam tylko zmianę hasła),
 *  - `GET /api/me` zwraca surowy payload JWT, nie świeży rekord z bazy
 *    (contract/fixtures/GET_me.json — pola `iat`/`exp` są tego dowodem).
 */
export function trasyAuth({ db, jwtSecret, cookieSecure }: ZaleznosciAuth): Router {
  const router = Router();

  // Oryginał: backend-index.cjs:48156-48174
  router.post(
    "/api/login",
    asyncRoute(async (req, res) => {
      const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
      if (!email || !password || typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "Email i hasło są wymagane" });
        return;
      }

      const uzytkownik = pobierzUzytkownikaPoEmailu(db, email);
      // Ta sama odpowiedź dla nieznanego e-maila i złego hasła — jak w oryginale.
      if (!uzytkownik || !(await porownajHaslo(password, uzytkownik.hasloHash))) {
        res.status(401).json({ error: "Nieprawidłowy email lub hasło" });
        return;
      }

      zapiszOstatnieLogowanie(db, uzytkownik.id);

      const user: PayloadUzytkownika = {
        id: uzytkownik.id,
        email: uzytkownik.email,
        imieNazwisko: uzytkownik.imieNazwisko,
      };
      // ODSTĘPSTWO (plan.md O5): oryginał podpisywał token dwa razy (raz do cookie w `R4`,
      // raz do ciała odpowiedzi). Redundancja bez wpływu na kontrakt — podpisujemy raz.
      const token = podpiszToken(user, jwtSecret);
      ustawCookieSesji(res, token, cookieSecure);
      res.json({ ok: true, user, token });
    }),
  );

  // Oryginał: backend-index.cjs:48175-48178. JWT jest bezstanowy — czyścimy tylko cookie.
  router.post("/api/logout", (_req, res) => {
    wyczyscCookieSesji(res, cookieSecure);
    res.json({ ok: true });
  });

  // Oryginał: backend-index.cjs:48179-48183 (ręczne `if (!req.user)`).
  // Tutaj przez `requireAuth` — ten sam efekt (401 {error:"Nieautoryzowany"}),
  // ale zgodnie z zasadą §3: auth nakładany jawnie na trasy danych.
  router.get("/api/me", requireAuth, (req, res) => {
    res.json(req.user);
  });

  return router;
}
