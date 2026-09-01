// Deklaracja typów dla oryginal.mjs — wycięcia `acceptStaging` z produkcyjnego bundla.

export declare const SCIEZKA_BUNDLA: string;

export declare function wytnijFragmenty(): {
  pomocnicy: string;
  metody: string;
  integralnosc: {
    pomocnicy: { sha256: string; dlugosc: number };
    metody: { sha256: string; dlugosc: number };
  };
};

export declare function zaladujOryginal(
  baza: { db: unknown; sqlite: unknown },
  podmianaBridgeExt?: Record<string, unknown>,
): {
  U: {
    acceptStaging(id: number, uzytkownikId: number): void;
    rejectStaging(id: number): void;
    clearStaging(): void;
    upsertOverride(dane: Record<string, unknown>): Record<string, unknown>;
    deleteOverride(id: number): Record<string, unknown> | null;
    listOverrides(): Record<string, unknown>[];
    getOverridesFor(dostawca: string, kod: string): Record<string, unknown>[];
    updateStaging(id: number, zmiany: Record<string, unknown>): Record<string, unknown>;
    getStaging(id: number): Record<string, unknown> | undefined;
  };
  integralnosc: ReturnType<typeof wytnijFragmenty>["integralnosc"];
};
