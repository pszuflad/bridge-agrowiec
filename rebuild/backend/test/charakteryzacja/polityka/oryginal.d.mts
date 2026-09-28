// Deklaracja typów dla `oryginal.mjs` — oryginału z ZAINSTALOWANĄ polityką Staging v2.

export declare function zaladujPolityke(baza: { db: unknown; sqlite: unknown }): {
  U: {
    /** Nadpisane przez `install()` — z pełną bramką `checkAcceptance`. */
    acceptStaging(id: number, uzytkownikId: number): void;
    /** Sama bramka, wystawiona przez politykę jako `U.checkStagingAcceptance` (`:201`). */
    checkStagingAcceptance(id: number): Record<string, unknown>;
    resolveStaging(id: number, ...argumenty: unknown[]): Record<string, unknown>;
    closeAbsenceReview(id: number): { kod: string };
    chooseAbsenceCard(id: number, ...argumenty: unknown[]): { kod: string; dostawca: string };
    addStaging(wiersz: Record<string, unknown>): Record<string, unknown>;
    updateStaging(id: number, zmiany: Record<string, unknown>): Record<string, unknown>;
    getStaging(id: number): Record<string, unknown> | undefined;
    getProductByKod(kod: string): Record<string, unknown> | undefined;
    listProducts(): Record<string, unknown>[];
  };
  /** Sam moduł `staging_policy.cjs`, gdyby test potrzebował funkcji czystych. */
  polityka: Record<string, unknown>;
  /** KOPIA `bridgeExt` z nadpisanym `assignKodImportu` — nigdy współdzielony obiekt modułu. */
  ext: Record<string, unknown>;
  integralnosc: Record<string, unknown>;
};
