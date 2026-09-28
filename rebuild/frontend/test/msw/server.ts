import { setupServer } from "msw/node";

/**
 * Pusty serwer — każdy test rejestruje własne handlery przez `server.use(...)`.
 * `onUnhandledRequest: "error"` (test/setup.ts) sprawia, że żądanie, którego test
 * nie przewidział, wywala test zamiast po cichu wychodzić w sieć.
 */
export const server = setupServer();
