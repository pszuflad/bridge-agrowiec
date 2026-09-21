import { asc } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { wagaGabPrzewoznicy } from "../db/schema.js";
import type { Przewoznik } from "../waga-gabarytowa/przewoznicy.js";

// Tabela `waga_gab_przewoznicy` (migracja 007) — wspólna lista przewoźników wagi wolumetrycznej.
// ⚠ Spoza produkcji (backlog #27): oryginał trzyma tę listę w IndexedDB przeglądarki.

/** Lista w kolejności z edytora. `kolejnosc` zostaje w bazie — API zna tylko pozycję w tablicy. */
export function odczytajPrzewoznikow(db: Baza): Przewoznik[] {
  return db
    .select({
      id: wagaGabPrzewoznicy.id,
      nazwa: wagaGabPrzewoznicy.nazwa,
      dzielnik: wagaGabPrzewoznicy.dzielnik,
      domyslny: wagaGabPrzewoznicy.domyslny,
    })
    .from(wagaGabPrzewoznicy)
    .orderBy(asc(wagaGabPrzewoznicy.kolejnosc))
    .all();
}

/**
 * Podmienia CAŁĄ listę — tak zapisywał front do IndexedDB i tak zapisuje teraz na serwer.
 * W jednej transakcji, żeby równoległy odczyt nigdy nie zobaczył pustej tabeli.
 * Wygrywa ostatni zapis — świadomie bez blokad współbieżności (plan.md, założenie D).
 */
export function zapiszPrzewoznikow(db: Baza, lista: Przewoznik[]): void {
  db.transaction((tx) => {
    tx.delete(wagaGabPrzewoznicy).run();
    tx.insert(wagaGabPrzewoznicy)
      .values(lista.map((p, kolejnosc) => ({ ...p, kolejnosc })))
      .run();
  });
}
