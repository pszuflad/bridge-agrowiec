// Deklaracja typów dla atrapy.mjs — pamięciowej warstwy danych dla oryginalnego `tk()`.

export declare function stworzAtrapy(opcje: {
  produkty: Record<string, unknown>[];
  overrides?: Record<string, unknown>[];
}): {
  zaleznosci: { U: unknown; ww: unknown; __BRIDGE_EXT: unknown; Qi: unknown };
  staging: Record<string, unknown>[];
  wywolaniaStagingu: Record<string, unknown>[];
  skasowane: number[];
  aktualizacje: { id: number; patch: Record<string, unknown> }[];
  fazyAktualizacji(): {
    petlaGlowna: { id: number; patch: Record<string, unknown> }[];
    petlaWycofan: { id: number; patch: Record<string, unknown> }[];
  };
};
