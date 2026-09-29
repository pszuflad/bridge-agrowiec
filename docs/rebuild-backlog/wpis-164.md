# Backlog — wpisy ticketu 164 (`164-BUG-poprawione-nazwy-sklejonych-opon`) · 2026-09-29

### #164.1 · 2026-09-29 · [BACKEND][BAZA] · nazwy sklejonych opon (#108) — ręczna poprawka `nazwa`, nie zamknięcie wpisu

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-29 |
| **Kategoria** | BACKEND (dane) + BAZA |
| **Pliki** | `rebuild/backend/src/import/naprawaNazwSklejonych.ts`, `rebuild/backend/scripts/napraw-nazwy-sklejone.ts`, `rebuild/backend/scripts/data/164-poprawione-nazwy.csv` |
| **Do nowej wersji?** | ✅ **TAK, częściowo — tylko symptom nazwy.** Rozstrzygnięcie semantyczne kolizji `kod_importu` (#108: deduplikacja/agregacja/rozdzielenie grup, decyzja handlowa Ani) i pętla delty do Selly co 15 minut **zostają otwarte**, ticket 164 ich nie dotyka. |
| **Status** | ✅ **wdrożone** — jednorazowy skrypt uruchomiony i zweryfikowany, 174/174 poprawek `manual_overrides` zapisanych. |

**Opis biznesowy.** Dla znanej kolizji `(dostawca, kod_importu)` opisanej w `docs/rebuild-backlog.md`
wpis #108 (przykład: MO1, `kod_importu` 326606, produkty `MO1_15126981`/`MO1_15126983`) wgrano
174 ręczne poprawki wyświetlanej nazwy produktu (dostawcy MO1/MO2/MO4/MO5/MO7/MO8), kluczowane
po dokładnym `(dostawca, kod)`, przez istniejący mechanizm „Poprawki Marty” (`manual_overrides`).

**Szczegół techniczny (dla rebuildu).** Jednorazowy skrypt CLI
`DB_PATH=... npm run napraw-nazwy-sklejone [ścieżka-csv]`; logika w
`naprawaNazwSklejonych.ts` (`sparsujWierszeNaprawy` + `zapiszPoprawke`/`naprawNazwySklejone`).
Nie zmienia `nazwa_pamiec`, API ani kontraktu — tylko dane w `manual_overrides`.

**Co to NIE naprawia.** Pętla delty do Selly co 15 minut (Tor 1, `selly_products` kluczowany
`(kod_importu, dostawca)`) i rozstrzygnięcie semantyczne przypadku „ten sam dostawca, ten sam
`kod_importu`" — to nadal decyzja handlowa Ani, poza zakresem odbudowy (patrz #108, sekcja
„Co zostaje otwarte"). Ten ticket naprawia wyłącznie SYMPTOM: wyświetlaną nazwę produktu dla
174 znanych, konkretnych par kolizyjnych.

**Rekomendacja (moja).** ✅ Nanieść jako naprawę danych — nie zmienia zachowania sync ani ryzyka
opisanego w #108. Szczegóły: `docs/tickets/164-BUG-poprawione-nazwy-sklejonych-opon/`.
