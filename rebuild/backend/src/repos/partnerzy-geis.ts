// Odczyt tabel GEIS do panelu (ticket 244): kraj → parametry + stawki (posortowane po progu wagowym).
import { asc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { geisKraje, geisStawki } from "../db/schema.js";

export type TabelaGeisKraju = {
  kraj: string;
  wspGabarytowy: number;
  kosztPakowania: number;
  maks: [number, number, number] | null;
  stawki: [number, number][];
};

export function listaGeis(db: Baza): TabelaGeisKraju[] {
  return db
    .select()
    .from(geisKraje)
    .orderBy(asc(geisKraje.kraj))
    .all()
    .map((k) => ({
      kraj: k.kraj,
      wspGabarytowy: k.wspGabarytowy,
      kosztPakowania: k.kosztPakowania,
      maks: k.maksDlugosc !== null && k.maksSzerokosc !== null && k.maksWysokosc !== null ? [k.maksDlugosc, k.maksSzerokosc, k.maksWysokosc] : null,
      stawki: db
        .select({ prog: geisStawki.progKg, stawka: geisStawki.stawka })
        .from(geisStawki)
        .where(eq(geisStawki.kraj, k.kraj))
        .orderBy(asc(geisStawki.progKg))
        .all()
        .map((s): [number, number] => [s.prog, s.stawka]),
    }));
}
