// Ludzkie wyjaśnienie, DLACZEGO zgłoszenie czeka na decyzję — dla okna „Sprawdź dopasowanie".
//
// ⚠ NOWE ZACHOWANIE, NIE PORT (decyzja użytkowniczki, 2026-09-30). Importer zapisuje przy
// zgłoszeniu jedno zdanie-hasło (`_matchIssue`: „Oznaczenie wskazuje inną oponę. Sprawdź
// dopasowanie."), a okno pokazywało obok surową linię z oferty. Żadne z dwóch nie mówi, CO jest
// nie tak. Tu z tego samego snapshotu i kandydatów budujemy krótkie zdania: co rozpoznano
// (EAN taki sam jak w innym produkcie, zajęty kod, podejrzana nazwa) i jaką nazwę proponuje import.
//
// Nie zmieniamy `_matchIssue` ani `powod` — od nich zależy przycisk „Rozstrzygnij" i blokady
// akceptacji. Wyjaśnienie jest liczone przy odczycie przeglądu, nic nie trafia do bazy.

import type { ProduktWewnetrzny } from "../../repos/products.js";
import { compatibility } from "./helpery.js";
import type { Snapshot } from "./kontekst.js";

type Kandydat = { kod: string; nazwa?: unknown; ean?: unknown };

const opis = (k: Kandydat): string => `${k.kod}${k.nazwa ? ` (${String(k.nazwa)})` : ""}`;

/** „Błędny zapis nazwy: …" z `powod` (`fabryka.ts:486`) → zdanie dla człowieka. */
function uwagaONazwie(powod: string | null): string | null {
  const m = /Błędny zapis nazwy:\s*([^•]+)/.exec(powod ?? "");
  if (!m) return null;
  return `Nazwa z importu wygląda na nieprawidłową (${m[1]!.trim()}). Sprawdź ją i w razie potrzeby popraw poniżej.`;
}

/** Cechy, którymi import różni się od kandydata w katalogu — z tej samej funkcji co importer. */
function roznice(snap: Snapshot, produkt: ProduktWewnetrzny | undefined): string | null {
  if (!produkt) return null;
  const z = compatibility(snap, produkt as unknown as Record<string, unknown>);
  const lista = [...(z.different ?? []), ...(z.missing ?? [])];
  return lista.length ? lista.join(", ") : null;
}

/**
 * @param produktyKandydatow — żywe karty katalogowe kandydatów, w kolejności `kandydaci`
 *   (`undefined` tam, gdzie karty już nie ma).
 */
export function wyjasnijZgloszenie(args: {
  snap: Snapshot;
  nazwaImportu: string;
  powod: string | null;
  kandydaci: Kandydat[];
  produktyKandydatow: Array<ProduktWewnetrzny | undefined>;
}): string[] {
  const { snap, nazwaImportu, powod, kandydaci, produktyKandydatow } = args;
  const problem = String(snap._matchIssue ?? "");
  const pierwszy = kandydaci[0];
  const linie: string[] = [];

  if (problem.startsWith("Kod dostawcy wskazuje starą kartę") && pierwszy) {
    linie.push(
      `Kod dostawcy należy do istniejącego produktu ${opis(pierwszy)}, ale cechy z importu są inne lub niepełne.`,
    );
  } else if (problem.startsWith("Kilka zgodnych produktów z tym EAN")) {
    linie.push(
      `EAN ${String(snap.eanRaw ?? snap.ean ?? "")} pasuje do kilku produktów w katalogu: ${kandydaci
        .map((k) => k.kod)
        .join(", ")}. Nie wiadomo, do którego należy ta pozycja.`,
    );
  } else if (problem.startsWith("Ten EAN występuje w katalogu") && pierwszy) {
    linie.push(
      `EAN jest taki sam jak w produkcie ${opis(pierwszy)}, ale cechy z importu (marka, model, rozmiar, DOT) są inne lub niepełne.`,
    );
  } else if (problem.startsWith("Podobna opona") && pierwszy) {
    linie.push(
      `W katalogu jest opona o takich samych cechach, ale pod innym kodem lub EAN: ${opis(pierwszy)}.`,
    );
  } else if (problem.startsWith("Oznaczenie wskazuje inną oponę") && pierwszy) {
    linie.push(
      `Kod ${String(snap.kodDostawcy || pierwszy.kod)} jest w katalogu zajęty przez inną oponę: ${opis(pierwszy)}.`,
    );
  } else if (problem) {
    linie.push(problem);
  }

  const uwaga = uwagaONazwie(powod);
  if (uwaga) linie.push(uwaga);

  if (kandydaci.length === 1) {
    const r = roznice(snap, produktyKandydatow[0]);
    if (r) linie.push(`Różnią się: ${r}.`);
  }

  if (nazwaImportu) {
    const wKatalogu = kandydaci.length === 1 && pierwszy?.nazwa ? String(pierwszy.nazwa) : null;
    linie.push(
      wKatalogu && wKatalogu !== nazwaImportu
        ? `Import chce ustawić nazwę: ${nazwaImportu} (w katalogu jest: ${wKatalogu}).`
        : `Nazwa z importu: ${nazwaImportu}.`,
    );
  }

  return linie;
}
