// Deklaracja typów dla oryginal.mjs — wycięcia produkcyjnego `tk()` z mirror/backend/index.cjs.

export declare const SCIEZKA_BUNDLA: string;

export interface Integralnosc {
  helpery: { sha256: string; dlugosc: number };
  silnik: { sha256: string; dlugosc: number };
}

export declare function wytnijFragmenty(): {
  helpery: string;
  silnik: string;
  integralnosc: Integralnosc;
};

export declare function zaladujOryginal(zaleznosci: {
  U: unknown;
  ww: unknown;
  __BRIDGE_EXT: unknown;
  Qi: unknown;
}): Record<string, unknown> & { integralnosc: Integralnosc };
