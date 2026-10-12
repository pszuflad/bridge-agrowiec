# 234 — Raport (PRT-7.1b)

## Summary
Parser zamówień rozpoznaje drugi format — TyreWorld `bestellung` (TopM R6) — obok `DOCUMENTORDER` Adtyres. Oba trafiają do tego samego modelu, walidacji i panelu. Sprawdzone na czterech prawdziwych przykładach od użytkownika
(2× `bestellung` wcześniej odrzucane jako „zły korzeń”, 2× `DOCUMENTORDER` działały), fixtures w repo zanonimizowane.

## Changes
- `backend/src/partnerzy/zamowienie-xml.ts` — dyspozytor po elemencie głównym, `parsujBestellung`
- Frontend: `pages/partnerzy/ZamowieniaPartnera.tsx` — etykiety niemieckich pól adresu
- Testy: `partnerzy.zamowienie-bestellung.test.ts` (7) + fixture `partnerzy.zamowienie-bestellung-przyklad.ts`, rozszerzone `partnerzy.odbior-email.test.ts` i `partnerzy.zamowienia.test.tsx`
- Docs: `wpis-234.md`, `karta.md`, `podzial-na-tickety.md`, `decyzje-do-konsultacji-marty.md` (fakty i pytania z zrzutów FTP)

## Deviations from plan
Brak.

## Test results
- **Gate kontraktu:** N/D — moduł wewnętrzny, trasy bez zmian.
- Backend i frontend: zob. PR (pełne bramki po synchronizacji z `develop`).

## Breaking changes
None.

## Follow-up
- Decyzje z `decyzje-do-konsultacji-marty.md`: układ katalogów i nazwy plików na istniejącym serwerze, znaczenie `done/`, kanał zamówień TyreWorld, netto/brutto i waluta `preis`.
- Zmiana nazw plików generatora na istniejące (`adtyres_agrowiec_<kraj>.csv`, `tyreworld_agrowiec.csv`) — po potwierdzeniu.
