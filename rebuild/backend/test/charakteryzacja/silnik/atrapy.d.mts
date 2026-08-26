// Deklaracja typów dla atrapy.mjs — pamięciowej warstwy danych dla oryginalnego `tk()`.

/** Pola produktu, po których liczone są `zmianyProduktow` (obie strony porównania). */
export declare const POLA_PRODUKTU: string[];
/** Kolumny `historia_cen` w kolejności placeholderów z INSERT-a (`:47800`). */
export declare const KOLUMNY_HISTORII: string[];

export declare function stworzAtrapy(opcje: {
  produkty: Record<string, unknown>[];
  overrides?: Record<string, unknown>[];
}): {
  zaleznosci: { U: unknown; ww: unknown; __BRIDGE_EXT: unknown; Qi: unknown };
  staging: Record<string, unknown>[];
  wywolaniaStagingu: Record<string, unknown>[];
  skasowane: number[];
  historiaCen: Record<string, unknown>[];
  wywolaniaBridgeExt: Record<string, unknown>[];
  zapytanDoPamieciLinkow(): number;
  aktualizacje: { id: number; patch: Record<string, unknown> }[];
  zmianyProduktow(): { id: number; zmiany: Record<string, { przed: unknown; po: unknown }> }[];
  sprawdzUkladPetli(): void;
  zamknij(): void;
};
