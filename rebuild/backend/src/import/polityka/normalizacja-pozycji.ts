// Ticket 178 — Etap 3 SPEC „Naprawa kolejki stagingu (2026-10-01)”: normalizacja pozycji cennika.
//
// ⚠ ODSTĘPSTWO OD PRODUKCJI (decyzja użytkowniczki) I OD LITERY SPECA. Spec wskazuje poprawki w
// parserach (`legacy/parsers/*.cjs`). Te pliki są jednak pilnowane bajt w bajt względem
// `mirror/backend` (`test/charakteryzacja.test.ts`, część 1), a ich wyjście — nagranym wzorcem
// z produkcji. Dlatego poprawki idą WARSTWĄ PO parserze, w tym samym miejscu co `oczyscModelZDot`
// (`fabryka.ts`), na polach rekordu, i są wspólne dla importu oraz jednorazowego czyszczenia katalogu
// (`src/import/migracje/normalizuj-katalog.ts`) — jedna logika, bez drugiej kopii.
//
// Wszystko tu jest czystą funkcją na wartościach; żadnego dostępu do bazy.

import { MODELE_PRODUCENTA } from "../slowniki/modele-producenta.js";

type Pozycja = Record<string, unknown>;

/** Dopiski osi/zastosowania doklejone do modelu przez dostawcę (nie są częścią modelu producenta). */
const DOPISKI_RE = /\s+(?:NAP[ĘE]D(?:OWA)?|PROWADZ[ĄA]CA|NACZEPA|UNIWERSALNA)\s*$/iu;

/**
 * Klucz porównania modelu: NFKC → wielkie litery → bez końcowych dopisków osi → bez spacji, `-`, `_`, `.`, `/`.
 * `T-539` = `T539`, `EM 22` = `EM-22`, `MG121 PROWADZĄCA` = `MG121`.
 */
export function kluczModelu(v: unknown): string {
  let t = String(v ?? "").normalize("NFKC").trim().toUpperCase();
  while (DOPISKI_RE.test(t)) t = t.replace(DOPISKI_RE, "");
  return t.replace(/[\s\-_./]+/g, "");
}

function wzorzecProducenta(marka: unknown, model: string): string | null {
  const wzorce = MODELE_PRODUCENTA[String(marka ?? "").trim().toUpperCase()];
  if (!wzorce) return null;
  const klucz = kluczModelu(model);
  return wzorce.find((w) => kluczModelu(w) === klucz) ?? null;
}

/** Model/bieżnik po poprawkach: dopiski osi, śmieci po rozmiarze, utracone HS/LS (Continental), litera LingLong, słownik. */
export function normalizujModel(model: unknown, ctx: { marka?: unknown; nazwa?: unknown }): unknown {
  if (typeof model !== "string" || !model.trim()) return model;
  let m = model.trim();
  while (DOPISKI_RE.test(m)) m = m.replace(DOPISKI_RE, "").trim();
  // Resztka indeksu nośności zjedzona przez parser: `MG121 158/ PROWADZĄCA` → `MG121`.
  m = m.replace(/\s+\d{2,3}\/(?=\s|$)/g, "").trim();

  const nazwa = String(ctx.nazwa ?? "").toUpperCase();
  // Continental: parser gubi `HS`/`LS`/`HD`/`HT` z modelu (`CONTI ECO HS 5` → `CONTI ECO 5`).
  const hs = /\b(CONTI\s+[A-Z]+)\s+((?:HS|LS|HD|HT)\s?\d+)\b/u.exec(nazwa);
  if (hs) {
    const prefiks = hs[1]!.replace(/\s+/g, " ");
    const cecha = hs[2]!.replace(/\s+/g, "");
    const cyfry = cecha.replace(/^[A-Z]+/, "");
    if (m.toUpperCase() === `${prefiks} ${cyfry}`) m = `${prefiks} ${cecha}`;
  }
  // LingLong: parser zjada pierwszą literę bieżnika (`-T20` zamiast `L-T20`); odtwarzamy ją z nazwy.
  if (/^-[A-Z0-9]/i.test(m)) {
    const lit = new RegExp(`(?:^|\\s)([A-Z])${m.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "u").exec(nazwa);
    if (lit) m = `${lit[1]}${m}`;
  }

  return wzorzecProducenta(ctx.marka, m) ?? m;
}

/** DOT: `24` → `2024`; `4822` (tydzień+rok) → `2022`; lista po przecinku/średniku element po elemencie. */
export function normalizujDot(dot: unknown): unknown {
  if (typeof dot !== "string" || !dot.trim()) return dot;
  const czesci = dot.split(/\s*([,;])\s*/);
  const wynik = czesci.map((c, i) => {
    if (i % 2 === 1) return c;
    const t = c.trim();
    if (/^\d{2}$/.test(t)) return `20${t}`;
    if (/^\d{4}$/.test(t)) {
      const tydzien = Number(t.slice(0, 2));
      return tydzien >= 1 && tydzien <= 53 ? `20${t.slice(2)}` : t;
    }
    return t;
  });
  return wynik.join("");
}

/**
 * Konstrukcja w zapisie katalogu. ⚠ Spec podaje litery `R`/`D`, ale katalog trzyma formę słowną
 * (`Radialna`/`Diagonalna`, migracja `005_konstrukcja_slowa.sql`, fixture `GET /api/products`),
 * więc normalizujemy DO TEJ formy — litery zmieniłyby kontrakt API. Nieznana wartość zostaje bez zmian.
 */
export function normalizujKonstrukcje(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim().toUpperCase();
  if (["R", "RADIAL", "RADIALNA"].includes(t)) return "Radialna";
  if (["D", "-", "BIAS", "DIAGONAL", "DIAGONALNA"].includes(t)) return "Diagonalna";
  return v;
}

const INDEKSY_W_NAZWIE = /(?:^|\s)(\d{2,3}(?:\/\d{2,3})?)([A-Z]\d?)(?:\/([A-Z]\d?))?(?=\s|$)/u;
const znakiBezSkosow = (t: string): string => [...t.replace(/\//g, "")].sort().join("");

/**
 * Indeksy nośności/prędkości ucięte przez parser (MO5: `154/152K/L` → LI `154/52`, SI `K1/L`).
 * Wartości z nazwy bierzemy WYŁĄCZNIE wtedy, gdy zawierają dokładnie te same znaki co to, co oddał
 * parser (tylko poprzestawiane) — wtedy to ten sam zapis, a nie inna opona.
 */
export function poprawIndeksy(
  nazwa: unknown,
  li: unknown,
  si: unknown,
): { indeksNosnosci: unknown; indeksPredkosci: unknown } {
  const zNazwy = INDEKSY_W_NAZWIE.exec(String(nazwa ?? "").toUpperCase());
  const bez = { indeksNosnosci: li, indeksPredkosci: si };
  if (!zNazwy || !li || !si) return bez;
  const liNazwy = zNazwy[1]!;
  const siNazwy = zNazwy[3] ? `${zNazwy[2]}/${zNazwy[3]}` : zNazwy[2]!;
  if (`${li}${si}` === `${liNazwy}${siNazwy}`) return bez;
  if (znakiBezSkosow(`${li}${si}`) !== znakiBezSkosow(`${liNazwy}${siNazwy}`)) return bez;
  return { indeksNosnosci: liNazwy, indeksPredkosci: siNazwy };
}

/** Wszystkie poprawki na jednej pozycji; zwraca kopię (wejście nietknięte). */
export function normalizujPozycje(d: Pozycja): Pozycja {
  const ctx = { marka: d.marka, nazwa: d.nazwa };
  const wynik: Pozycja = { ...d };
  if (d.model) wynik.model = normalizujModel(d.model, ctx);
  if (d.bieznik) wynik.bieznik = normalizujModel(d.bieznik, ctx);
  if (d.dot) wynik.dot = normalizujDot(d.dot);
  if (d.konstrukcja) wynik.konstrukcja = normalizujKonstrukcje(d.konstrukcja);
  const ind = poprawIndeksy(d.nazwa, d.indeksNosnosci, d.indeksPredkosci);
  wynik.indeksNosnosci = ind.indeksNosnosci;
  wynik.indeksPredkosci = ind.indeksPredkosci;
  return wynik;
}
