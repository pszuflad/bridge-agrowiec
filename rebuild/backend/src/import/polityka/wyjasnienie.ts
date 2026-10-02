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
import { norm } from "./helpery.js";
import type { Snapshot } from "./kontekst.js";

type Kandydat = { kod: string; nazwa?: unknown; ean?: unknown };

const opis = (k: Kandydat): string => `${k.kod}${k.nazwa ? ` (${String(k.nazwa)})` : ""}`;

/** „Błędny zapis nazwy: …" z `powod` (`fabryka.ts:486`) → zdanie dla człowieka. */
function uwagaONazwie(powod: string | null): string | null {
  const m = /Błędny zapis nazwy:\s*([^•]+)/.exec(powod ?? "");
  if (!m) return null;
  return `Nazwa z importu wygląda na nieprawidłową (${m[1]!.trim()}). Sprawdź ją i w razie potrzeby popraw poniżej.`;
}

/** Pola porównywane przy dopasowaniu, z etykietą do pokazania; `tekstowe` = różnica w samym opisie. */
const POLA: ReadonlyArray<{ klucz: string; etykieta: string; tekstowe: boolean }> = [
  { klucz: "marka", etykieta: "Marka", tekstowe: true },
  { klucz: "model", etykieta: "Model", tekstowe: true },
  { klucz: "rozmiar", etykieta: "Rozmiar", tekstowe: false },
  { klucz: "indeksNosnosci", etykieta: "Indeks nośności", tekstowe: false },
  { klucz: "indeksPredkosci", etykieta: "Indeks prędkości", tekstowe: false },
  { klucz: "pr", etykieta: "PR", tekstowe: false },
  { klucz: "tlTt", etykieta: "TL/TT", tekstowe: false },
  { klucz: "vfIf", etykieta: "VF/IF", tekstowe: false },
  { klucz: "konstrukcja", etykieta: "Konstrukcja", tekstowe: false },
];

type Roznica = { etykieta: string; tekstowe: boolean; katalog: string; oferta: string };

/**
 * Cechy, którymi oferta RÓŻNI SIĘ od karty, z wartościami po obu stronach. Pomija różnice, które są
 * tylko zapisem. DOT nie jest tu porównywany wcale — nie odróżnia opon i zmienia się w miejscu
 * (`tolerancja-dopasowania.ts`). Puste po obu stronach to nie różnica.
 */
function roznice(snap: Snapshot, produkt: ProduktWewnetrzny): Roznica[] {
  const p = produkt as unknown as Record<string, unknown>;
  const wynik: Roznica[] = [];
  for (const { klucz, etykieta, tekstowe } of POLA) {
    const oferta = String(snap[klucz] ?? "").trim();
    const katalog = String(p[klucz] ?? "").trim();
    if (norm(oferta) === norm(katalog)) continue;
    wynik.push({ etykieta, tekstowe, katalog: katalog || "brak", oferta: oferta || "brak" });
  }
  return wynik;
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
      `Kod dostawcy należy do istniejącego produktu ${opis(pierwszy)}, ale cechy z oferty są inne lub niepełne.`,
    );
  } else if (problem.startsWith("Kilka zgodnych produktów z tym EAN")) {
    linie.push(
      `EAN ${String(snap.eanRaw ?? snap.ean ?? "")} pasuje do kilku produktów w katalogu: ${kandydaci
        .map((k) => k.kod)
        .join(", ")}. Nie wiadomo, do którego należy ta pozycja.`,
    );
  } else if (problem.startsWith("Ten EAN występuje w katalogu") && pierwszy) {
    linie.push(
      `EAN jest taki sam jak w produkcie ${opis(pierwszy)}, ale cechy z oferty (marka, model, rozmiar, DOT) są inne lub niepełne.`,
    );
  } else if (problem.startsWith("Podobna opona") && pierwszy) {
    linie.push(
      `W katalogu jest opona o takich samych cechach, ale pod innym kodem lub EAN: ${opis(pierwszy)}.`,
    );
  } else if (problem.startsWith("Oznaczenie wskazuje inną oponę") && pierwszy) {
    // Importer tylko OCENIA, że to inna opona — kody często różnią się samym prefiksem dostawcy.
    linie.push(
      `Ten kod (${String(snap.kodDostawcy || pierwszy.kod)}) już jest w katalogu: ${opis(pierwszy)}. ` +
        "Cechy z oferty różnią się od karty, więc nie wiadomo, czy to ta sama opona.",
    );
  } else if (problem) {
    linie.push(problem);
  }

  const uwaga = uwagaONazwie(powod);
  if (uwaga) linie.push(uwaga);

  // Różnice z wartościami po obu stronach — tylko gdy jest jedna karta do porównania.
  let rozn: Roznica[] = [];
  const karta = produktyKandydatow[0];
  if (kandydaci.length === 1 && karta) {
    rozn = roznice(snap, karta);
    for (const r of rozn) linie.push(`${r.etykieta}: ${r.katalog} (katalog) → ${r.oferta} (oferta)`);
  }

  if (nazwaImportu) {
    // Aktualna nazwa z żywej karty; snapshot kandydata niesie nazwę z chwili importu.
    const nazwaKarty = karta?.nazwa ?? pierwszy?.nazwa;
    const wKatalogu = kandydaci.length === 1 && nazwaKarty ? String(nazwaKarty) : null;
    linie.push(
      wKatalogu && wKatalogu !== nazwaImportu
        ? `Import chce ustawić nazwę: ${nazwaImportu} (w katalogu jest: ${wKatalogu}).`
        : `Nazwa z importu: ${nazwaImportu}.`,
    );
  }

  // Wskazówka zależna od przypadku — zamiast jednego ogólnego akapitu.
  if (rozn.length && rozn.every((r) => r.tekstowe)) {
    linie.push(
      "Najpewniej ta sama opona z innym zapisem nazwy. Wybierz istniejący produkt, a poprawną nazwę wpisz w „Popraw dane z oferty”.",
    );
  } else if (rozn.length) {
    linie.push("To może być inna opona (rozmiar, indeksy albo konstrukcja się różnią). Sprawdź kartę w katalogu.");
  }

  return linie;
}
