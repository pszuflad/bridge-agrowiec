import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 nie łapie odrzuconych promes z handlerów async — bez tego opakowania
 * błąd w `await` kończy się nieobsłużonym rejectem zamiast odpowiedzią 500.
 */
export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** Nieznana ścieżka — odpowiedź JSON-em, żeby klient nigdy nie dostał HTML-a z Expressa. */
export const nieZnalezionoHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Nie znaleziono" });
};

/**
 * Ostatnia linia obrony. Nie wypuszczamy stack trace'ów ani treści błędu do klienta —
 * szczegóły trafiają do logów serwera.
 */
export const bladHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  // Błędy klienta z parserów ciała (SyntaxError 400 przy zepsutym JSON-ie,
  // PayloadTooLargeError 413 przy przekroczeniu limitu) niosą własny status —
  // oddajemy go zamiast maskować błędem serwera.
  const surowyStatus = (err as { status?: number; statusCode?: number } | null)?.status;
  const status = typeof surowyStatus === "number" ? surowyStatus : 500;
  if (status >= 400 && status < 500) {
    // Świadomie jeden generyczny komunikat: dziś jedynym źródłem błędów 4xx z tego
    // handlera są parsery Expressa. Jeśli kolejna iteracja zacznie rzucać własne błędy
    // ze statusem (np. 422 z walidacji importu), trzeba tu przepuścić ich treść.
    res.status(status).json({ error: "Błędne żądanie" });
    return;
  }
  console.error(`[błąd] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: "Błąd serwera" });
};
