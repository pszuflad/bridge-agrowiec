import type { PayloadTokena } from "../auth/jwt.js";

declare global {
  namespace Express {
    interface Request {
      /** Ustawiane przez `optionalAuth`, gdy żądanie niesie ważny token. */
      user?: PayloadTokena;
    }
  }
}

export {};
