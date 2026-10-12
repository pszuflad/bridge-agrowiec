// Import tabel GEIS z arkusza Excel (ticket 244). Układ pliku: jeden arkusz na kraj (nazwa polska: „Francja", „Niemcy"…), na górze wiersze parametrów
// („Opłata paliwowa", „Koszt pakowania", „Współczynnik wagi gabarytowej", „Maks. długość / szerokość / wysokość" w postaci „240 × 240 × 220"),
// niżej tabela „Waga | 1 | 2 | … | Średnia". V1: stawka CAŁEGO kraju = kolumna „1". Maks. „0 × 0 × 0" znaczy brak limitu. Opłaty paliwowej z arkusza
// NIE importujemy (pochodzi z paneli GEIS, a bieżący procent użytkowniczka wpisuje w panelu kraju).

import * as XLSX from "xlsx";

import type { TabeleGeisJson } from "./transport.js";

const KRAJE: Record<string, string> = {
  francja: "FR", niemcy: "DE", holandia: "NL", belgia: "BE", austria: "AT", czechy: "CZ", slowacja: "SK", litwa: "LT", lotwa: "LV",
  rumunia: "RO", wegry: "HU", wlochy: "IT", luksemburg: "LU",
};
const bezDiakrytykow = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").trim().toLowerCase();
const liczba = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

export type WynikParsowaniaGeis = { dane: TabeleGeisJson; ostrzezenia: string[] };

/** Parsuje arkusz GEIS. Arkusz o nieznanej nazwie kraju jest pomijany z ostrzeżeniem; błąd struktury arkusza rzuca `Error` z jego nazwą. */
export function parsujGeisXlsx(bufor: Buffer): WynikParsowaniaGeis {
  const wb = XLSX.read(bufor, { type: "buffer", cellDates: false });
  const dane: TabeleGeisJson = {};
  const ostrzezenia: string[] = [];
  for (const nazwa of wb.SheetNames) {
    const kraj = KRAJE[bezDiakrytykow(nazwa)];
    if (!kraj) {
      ostrzezenia.push(`Arkusz „${nazwa}”: nieznany kraj — pominięty.`);
      continue;
    }
    const wiersze = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nazwa]!, { header: 1, blankrows: false, defval: null });
    let wsp: number | null = null;
    let pakowanie = 0;
    let maks: [number, number, number] | null = null;
    const stawki: [number, number][] = [];
    let wTabeli = false;
    for (const w of wiersze) {
      const a = w[0];
      if (typeof a === "string" && /^waga$/i.test(a.trim())) {
        wTabeli = true;
        continue;
      }
      if (wTabeli) {
        const prog = liczba(a);
        const stawka = liczba(w[1]);
        if (prog !== null && stawka !== null) stawki.push([prog, stawka]);
        continue;
      }
      const klucz = typeof a === "string" ? bezDiakrytykow(a) : "";
      if (klucz.startsWith("wspolczynnik")) wsp = liczba(w[2]);
      else if (klucz.startsWith("koszt pakowania")) pakowanie = liczba(w[2]) ?? 0;
      else if (klucz.startsWith("maks")) {
        const czesci = String(w[2] ?? "").split(/[×x]/i).map((c) => liczba(c));
        if (czesci.length === 3 && czesci.every((c) => c !== null && c > 0)) maks = czesci as [number, number, number];
      }
    }
    if (wsp === null || wsp <= 0) throw new Error(`Arkusz „${nazwa}”: brak współczynnika wagi gabarytowej.`);
    if (stawki.length === 0) throw new Error(`Arkusz „${nazwa}”: brak tabeli stawek (nagłówek „Waga”, kolumna „1”).`);
    dane[kraj] = { wspGabarytowy: wsp, kosztPakowania: pakowanie, maks, stawki };
  }
  if (Object.keys(dane).length === 0) throw new Error("W pliku nie znaleziono żadnego arkusza z krajem GEIS.");
  return { dane, ostrzezenia };
}
