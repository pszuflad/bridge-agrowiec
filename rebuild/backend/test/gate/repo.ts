import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Katalog główny repo — szukany po `contract/openapi.yaml`, żeby harness działał
 * tak samo z `rebuild/backend`, z katalogu głównego i z CI (working-directory).
 */
export function katalogRepo(): string {
  let katalog = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(katalog, "contract", "openapi.yaml"))) return katalog;
    const rodzic = dirname(katalog);
    if (rodzic === katalog) break;
    katalog = rodzic;
  }
  throw new Error(
    "Nie znaleziono katalogu repo (szukano contract/openapi.yaml w katalogach nadrzędnych).",
  );
}

export const SCIEZKA_KONTRAKTU = (): string => join(katalogRepo(), "contract", "openapi.yaml");
export const KATALOG_FIXTURES = (): string => join(katalogRepo(), "contract", "fixtures");
export const KATALOG_SCHEMATU = (): string => resolve(join(katalogRepo(), "rebuild", "schema"));
