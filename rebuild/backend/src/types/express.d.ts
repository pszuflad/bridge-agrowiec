import type { PayloadTokena } from "../auth/jwt.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Ustawiane przez `optionalAuth`, gdy żądanie niesie ważny token. */
      user?: PayloadTokena;
    }
  }
}

export {};
