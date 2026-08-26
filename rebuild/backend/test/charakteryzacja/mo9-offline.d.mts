// Deklaracja typów dla mo9-offline.mjs. Sam helper musi zostać plikiem .mjs, bo importuje go
// zarówno test (vitest/TS), jak i scripts/charakteryzacja-nagraj.mjs uruchamiany gołym node.

import type { BladWiersza, OdrzuconyWiersz } from "../../src/import/typy.js";

export interface WynikMo9Offline {
  records: unknown[];
  errors: BladWiersza[];
  odrzucone: OdrzuconyWiersz[];
  dostawca: string;
  totalCount: number | null;
}

export interface ModulApiMo9 {
  fetchAll(): Promise<WynikMo9Offline>;
}

export function pobierzMo9Offline(
  modulApi: ModulApiMo9,
  itemy: unknown[],
): Promise<WynikMo9Offline>;
