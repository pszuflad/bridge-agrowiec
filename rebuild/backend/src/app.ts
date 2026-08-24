import express, { type Express } from "express";
import type { Env } from "./config/env.js";
import type { Baza } from "./db/index.js";
import { optionalAuth } from "./middleware/auth.js";
import { corsZAllowlisty } from "./middleware/cors.js";
import { bladHandler, nieZnalezionoHandler } from "./middleware/errors.js";
import { trasyAuth } from "./routes/auth.js";

export type ZaleznosciApp = {
  env: Env;
  db: Baza;
};

/**
 * Fabryka aplikacji Express — BEZ `listen()`, żeby testy mogły ją tworzyć w pamięci
 * (supertest) bez zajmowania portu. Nasłuch startuje dopiero `server.ts`.
 */
export function stworzApp({ env, db }: ZaleznosciApp): Express {
  const app = express();

  // Staging i produkcja stoją za proxy Apache (X-Forwarded-*) — bez tego
  // req.ip i req.protocol pokazywałyby adres proxy zamiast klienta.
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "5mb" }));
  if (env.CORS_ORIGINS.length > 0) app.use(corsZAllowlisty(env.CORS_ORIGINS));

  // Odpowiednik globalnego `e.use(C4)` z oryginału (backend-index.cjs:48156):
  // wypełnia req.user, gdy żądanie niesie ważny token. O dostępie decyduje requireAuth.
  app.use(optionalAuth(env.JWT_SECRET));

  // Publiczne z definicji: healthcheck dla PM2/monitoringu (nie zwraca żadnych danych).
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(trasyAuth({ db, jwtSecret: env.JWT_SECRET, cookieSecure: env.cookieSecure }));

  app.use(nieZnalezionoHandler);
  app.use(bladHandler);

  return app;
}
