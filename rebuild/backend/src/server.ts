// Wejście produkcyjne — `dist/server.js` (kontrakt deployu, tools/deploy-staging.sh).
import { wczytajEnv } from "./config/env.js";
import { otworzBaze } from "./db/index.js";
import { stworzApp } from "./app.js";

const env = wczytajEnv();
const { sqlite, db } = otworzBaze(env.DB_PATH);
const app = stworzApp({ env, db });

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(
    `Bridge backend słucha na http://${env.HOST}:${env.PORT} ` +
      `(NODE_ENV=${env.NODE_ENV}, DB_PATH=${env.DB_PATH})`,
  );
});

function zamknij(sygnal: string): void {
  console.log(`${sygnal} — zamykam serwer…`);
  server.close(() => {
    sqlite.close();
    process.exit(0);
  });
  // Gdyby otwarte połączenia nie chciały się domknąć — nie wisimy w nieskończoność.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => zamknij("SIGTERM"));
process.on("SIGINT", () => zamknij("SIGINT"));
