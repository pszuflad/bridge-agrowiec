// Ticket 185 — treść migracji 022 (jednorazowe przypisanie kategorii i zastosowania przy wdrożeniu).
// Runner migracji zapisuje wykonaną migrację w `_migracje`, więc przypisanie robi się RAZ na bazę, po kopii
// bazy robionej przez deploy i po migracji 021 (triggery muszą już znać nową listę zastosowań).

import { tabelaPrzypisania, type WierszPliku } from "./przypisz-kategorie-zastosowanie.js";

const q = (t: string): string => `'${t.replace(/'/g, "''")}'`;

const BEZ_POPRAWKI = `NOT EXISTS (
    SELECT 1 FROM manual_overrides m
    WHERE m.supplier_kod = p.dostawca AND m.supplier_product_id = p.kod AND m.field_name IN ('kategoria', 'zastosowanie')
  )`;

export function trescMigracjiPrzypisania(wiersze: readonly WierszPliku[]): string {
  const wpisy = tabelaPrzypisania(wiersze);
  const paczki: string[] = [];
  for (let i = 0; i < wpisy.length; i += 400) {
    const wartosci = wpisy
      .slice(i, i + 400)
      .map((w) => `(${q(w.nazwa)}, ${q(w.kategoria)}, ${q(w.zastosowanie)})`)
      .join(",\n");
    paczki.push(`INSERT INTO _przypisanie_185 (nazwa, kategoria, zastosowanie) VALUES\n${wartosci};`);
  }
  return `-- 022_przypisanie_kategorii_zastosowania_csv.sql — ticket 185-FEATURE-przypisanie-kategorii-zastosowania
-- PLIK GENEROWANY: \`npm run generuj-migracje-przypisania\` (w rebuild/backend) z
-- scripts/data/katalog-kategoria-zastosowanie-2026-09-30.csv i tabeli przeniesień w
-- src/import/migracje/przypisz-kategorie-zastosowanie.ts. Nie edytować ręcznie (test db.migracja-022 porównuje).
--
-- NOWA LOGIKA BIZNESOWA, NIE PORT (decyzje użytkownika, 2026-10-04): jednorazowe przypisanie kategorii i
-- zastosowania produktom po \`products.nazwa\` (${wpisy.length} nazw; nazwy niejednoznaczne są pominięte).
--  • Zmieniane są tylko wiersze, w których para różni się od docelowej.
--  • Produkt z poprawką Marty (\`manual_overrides\` na kategoria/zastosowanie) NIE jest ruszany.
--  • Każda zmiana pola ląduje w \`history\` (źródło \`przypisanie-kat-zast\`).
--  • Wykonuje się raz na bazę (\`_migracje\`), po kopii bazy z deployu i po migracji 021.

CREATE TEMP TABLE _przypisanie_185 (nazwa TEXT PRIMARY KEY, kategoria TEXT NOT NULL, zastosowanie TEXT NOT NULL);

${paczki.join("\n\n")}

INSERT INTO history (data, kod_produktu, nazwa, pole, stara_wartosc, nowa_wartosc, zrodlo, kto)
SELECT datetime('now'), p.kod, p.nazwa, 'kategoria', p.kategoria, t.kategoria, 'przypisanie-kat-zast', 'migracja 022'
FROM products p JOIN _przypisanie_185 t ON TRIM(p.nazwa) = t.nazwa
WHERE p.kategoria <> t.kategoria AND ${BEZ_POPRAWKI};

INSERT INTO history (data, kod_produktu, nazwa, pole, stara_wartosc, nowa_wartosc, zrodlo, kto)
SELECT datetime('now'), p.kod, p.nazwa, 'zastosowanie', COALESCE(p.zastosowanie, ''), t.zastosowanie, 'przypisanie-kat-zast', 'migracja 022'
FROM products p JOIN _przypisanie_185 t ON TRIM(p.nazwa) = t.nazwa
WHERE COALESCE(p.zastosowanie, '') <> t.zastosowanie AND ${BEZ_POPRAWKI};

UPDATE products AS p
SET kategoria = (SELECT t.kategoria FROM _przypisanie_185 t WHERE t.nazwa = TRIM(p.nazwa)),
    zastosowanie = (SELECT t.zastosowanie FROM _przypisanie_185 t WHERE t.nazwa = TRIM(p.nazwa))
WHERE EXISTS (
    SELECT 1 FROM _przypisanie_185 t
    WHERE t.nazwa = TRIM(p.nazwa) AND (p.kategoria <> t.kategoria OR COALESCE(p.zastosowanie, '') <> t.zastosowanie)
  )
  AND ${BEZ_POPRAWKI};

DROP TABLE _przypisanie_185;
`;
}
