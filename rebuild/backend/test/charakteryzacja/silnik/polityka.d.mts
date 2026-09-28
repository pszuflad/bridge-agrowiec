// Deklaracja typów dla polityka.mjs — harnessu ORYGINALNEJ polityki stagingu
// (`staging_policy.install()` @ `88fa31c`) postawionej na prawdziwym SQLite.

/** Pola produktu, po których liczone są `zmianyProduktow` (obie strony porównania). */
export declare const POLA_PRODUKTU: string[];
/** Kolumny `historia_cen` w kolejności z INSERT-a oryginału (`staging_policy.cjs:517`). */
export declare const KOLUMNY_HISTORII: string[];

/** Uchwyt better-sqlite3 w zakresie, którego używa harness i testy. */
interface UchwytBazy {
  prepare(sql: string): {
    all(...args: unknown[]): unknown[];
    get(...args: unknown[]): unknown;
    run(...args: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  };
  exec(sql: string): unknown;
  close(): void;
}

export declare function stworzPolitykeOryginalu(opcje: {
  produkty: readonly unknown[];
  overrides?: readonly unknown[];
}): {
  /** Oryginalny `importer(supplier, incoming, options)` zwrócony przez `install()`. */
  importer: (
    dostawca: string,
    wejscie: readonly unknown[],
    opcje?: Record<string, unknown>,
  ) => Record<string, unknown>;
  db: UchwytBazy;
  integralnosc: Record<string, { sha256: string; dlugosc: number }>;
  staging(): Record<string, unknown>[];
  wywolaniaStagingu: Record<string, unknown>[];
  wywolaniaBridgeExt: Record<string, unknown>[];
  historiaCen(): Record<string, unknown>[];
  zmianyProduktow(): { id: number; zmiany: Record<string, { przed: unknown; po: unknown }> }[];
  zamknij(): void;
};
