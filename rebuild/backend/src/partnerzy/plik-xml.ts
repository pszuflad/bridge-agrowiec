// Szablon XML cennika partnera — domyślnie wzorzec Ceneo (karta PARTNERZY, ticket 216 / PRT-3.3).
//
// Ta sama konfiguracja kolumn co w CSV (`wczytajKolumny`, PRT-3.2). Ceneo ma JEDNĄ cenę oferty, więc XML powstaje w układzie „plik na kraj”:
// cena kraju → atrybut `price`. Mapowanie kolumn na elementy Ceneo (po polu katalogu): `kod` → `o@id`, `nazwa` → `<name>`, `stan` → `o@stock`,
// `kategoria` → `<cat>`; pozostałe kolumny (katalog, cena innych krajów, pola obliczeniowe) idą do `<attrs><a name="nazwa kolumny">`.
// Bez kolumny `kod`/`nazwa`/`stan` wartości domyślne biorą się z pozycji (Ceneo wymaga id, ceny i nazwy). `avail` = 1 dla stanu > 0.
// Wiersz bez ceny kraju wypada. Tekst jest ESCAPOWANY (bez CDATA); znaki niedozwolone w XML 1.0 są usuwane.
//
// Cena: kropka, 2 miejsca (`202.00`). Struktura jest ustawiana przez zarządcę Bridge — inną strukturę (nazwy elementów) zmienia się tu, w jednym miejscu.

import { BladFormuly, obliczFormule } from "./formula.js";
import type { KolumnaPliku } from "./plik-csv.js";
import type { WierszWyceniony } from "./selekcja.js";

/** Usuwa znaki niedozwolone w XML 1.0 i escapuje znaki specjalne. */
export function escapujXml(wartosc: string): string {
  return wartosc
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const liczbaNaTekst = (v: number): string => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6))));

export type WynikXml = {
  tekst: string;
  liczbaWierszy: number;
  pominiete: number;
  bledy: { kod: string; kolumna: string; powod: string }[];
};

export function zbudujXml(opcje: { kolumny: readonly KolumnaPliku[]; wiersze: readonly WierszWyceniony[]; kraj: string }): WynikXml {
  const { kolumny, kraj } = opcje;
  const wynik: WynikXml = { tekst: "", liczbaWierszy: 0, pominiete: 0, bledy: [] };
  const linie = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<offers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" version="1">',
    '  <group name="other">',
  ];
  const zmapowane = new Set(["kod", "nazwa", "stan", "kategoria"]);

  for (const { pozycja: p, ceny } of opcje.wiersze) {
    const cena = ceny[kraj];
    if (cena == null) {
      wynik.pominiete++;
      continue;
    }
    const zmienne: Record<string, number | null> = {
      zakup: p.cenaZakupu, stan: p.stan, waga: p.waga, dlugosc: p.dlugosc, szerokosc_paczki: p.szerokoscPaczki, wysokosc: p.wysokosc,
      ...Object.fromEntries(Object.entries(ceny).map(([k, c]) => [`cena_${k}`, c])),
    };
    const atrybuty: string[] = [];
    for (const k of kolumny) {
      if (k.typ === "katalog" && zmapowane.has(k.pole)) continue;
      let wartosc = "";
      if (k.typ === "katalog") {
        const v = p[k.pole];
        wartosc = typeof v === "number" ? liczbaNaTekst(v) : (v ?? "");
      } else if (k.typ === "cena") {
        const c = ceny[k.kraj];
        wartosc = c == null ? "" : c.toFixed(2);
      } else {
        try {
          wartosc = liczbaNaTekst(obliczFormule(k.formula, zmienne));
        } catch (e) {
          if (!(e instanceof BladFormuly)) throw e;
          wynik.bledy.push({ kod: p.kod, kolumna: k.nazwa, powod: e.message });
        }
      }
      if (wartosc !== "") atrybuty.push(`        <a name="${escapujXml(k.nazwa)}">${escapujXml(wartosc)}</a>`);
    }
    linie.push(
      `    <o id="${escapujXml(p.kod)}" price="${cena.toFixed(2)}" avail="${p.stan > 0 ? 1 : 0}" stock="${p.stan}">`,
      `      <cat>${escapujXml(p.kategoria)}</cat>`,
      `      <name>${escapujXml(p.nazwa)}</name>`,
    );
    if (atrybuty.length) linie.push("      <attrs>", ...atrybuty, "      </attrs>");
    linie.push("    </o>");
    wynik.liczbaWierszy++;
  }
  linie.push("  </group>", "</offers>");
  wynik.tekst = `${linie.join("\n")}\n`;
  return wynik;
}
