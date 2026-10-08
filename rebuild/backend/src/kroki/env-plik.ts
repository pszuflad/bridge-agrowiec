import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Ustawia w pliku `.env` podane klucze na podane wartości (istniejący wpis dostaje nową wartość,
 * brakujący jest dopisywany na końcu). Pozostałe linie — w tym sekrety — zostają bajt w bajt.
 * Zwraca opis zmian z samymi KLUCZAMI i nowymi wartościami (nigdy zawartości innych linii).
 * Idempotentne: gdy wszystko już się zgadza, plik nie jest przepisywany.
 */
export function ustawWEnvPliku(sciezka: string, wartosci: Record<string, string>): string[] | null {
  if (!existsSync(sciezka)) return null;
  const linie = readFileSync(sciezka, "utf8").split("\n");
  const opis: string[] = [];
  for (const [klucz, wartosc] of Object.entries(wartosci)) {
    const wzor = new RegExp(`^\\s*(export\\s+)?${klucz}\\s*=`);
    const indeksy = linie.flatMap((l, i) => (wzor.test(l) ? [i] : []));
    const docelowa = `${klucz}=${wartosc}`;
    if (indeksy.length === 0) {
      // koniec pliku bywa pustą linią po `\n` — dopisz przed nią
      if (linie.length && linie[linie.length - 1] === "") linie.splice(linie.length - 1, 0, docelowa);
      else linie.push(docelowa);
      opis.push(`${docelowa} (dopisano)`);
      continue;
    }
    // Ostatni wpis wygrywa przy `source`, więc ujednolicamy WSZYSTKIE wystąpienia.
    let zmieniono = false;
    for (const i of indeksy) {
      if (linie[i] !== docelowa) {
        linie[i] = docelowa;
        zmieniono = true;
      }
    }
    opis.push(zmieniono ? `${docelowa} (zmieniono)` : `${docelowa} (bez zmian)`);
  }
  if (opis.some((o) => !o.endsWith("(bez zmian)"))) {
    const tmp = `${sciezka}.tmp-${process.pid}`;
    writeFileSync(tmp, linie.join("\n"), { mode: 0o600 });
    renameSync(tmp, sciezka);
  }
  return opis;
}
