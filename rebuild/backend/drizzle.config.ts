// Konfiguracja drizzle-kit — używana WYŁĄCZNIE do jednorazowej introspekcji
// schematu (`npx drizzle-kit pull`) z bazy zbudowanej z rebuild/schema/001_schema.sql.
// Źródłem prawdy o strukturze jest 001_schema.sql, nie ten plik (rebuild/schema/README.md).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./.drizzle",
  dbCredentials: {
    url: process.env.DB_PATH ?? "./.tmp/introspect.db",
  },
});
