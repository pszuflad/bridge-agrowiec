# 85-DOCS-instrukcja-testow-i6-v2 — plan

**Karta:** P6.3 (Iteracja 6 — Alerty) · **Typ:** DOCS, zero zmian w `rebuild/` i `contract/`.

## Warunki startu (sprawdzone 2026-09-21)
- PR #87 (P6.1, ticket 72) MERGED 15:05Z, PR #93 (P6.2, ticket 77) MERGED 21:07Z;
  roadmapa, blok „Iteracja 6", ma podsekcję „Delta dla P6.3".
- **Staging:** `tools/deploy-staging.sh` jedzie z crona co 5 min z `develop`; frontend publikuje
  PO `npm run migrate` przy `set -euo pipefail`. Bundle `index-CQfyF1-x.js` na
  test.agritires.eu zawiera napisy P6.1 i P6.2 → oba wdrożone, `008` zastosowana. Bez pytania
  użytkownika o kolejność.
- Danych stagingu nie da się zmierzyć (API za logowaniem) → instrukcja bez liczb stagingu.

## Decyzje formatu (z promptu — nie są decyzjami użytkownika)
- D1: nowy plik `docs/instrukcja-testow-I6-v2.md` jako delta wzorem I5-v2; pierwsza wersja
  dostaje tylko banner.
- D2: rozdział 1 = trzy odpowiedzi Ani (runda 2: 1a, 1b; pytanie 6.4), „Zgłosiłaś → Jest teraz →
  Sprawdź → Twoja ocena"; rozdział 2 = pięć zmian „przy okazji"; rozdział 3 = „czego nie
  zgłaszaj"; rozdział 4 = zdania I6 z numerami paragrafów; rozdział 5 = podsumowanie.
- D3: każdą etykietę cytować z kodu `develop` (`5a7f7db`), zachowanie starego Bridge — z żywego
  bundla `origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js`.
- D4: Pulpit w I10 też obalony — nie ruszamy `instrukcja-testow-I10.md` (własność P10.4);
  krótka nota w I6-v2 + `docs/karty/P10.4/wejscie-85.md`.

## Pliki
Nowe: `docs/instrukcja-testow-I6-v2.md`, `docs/karty/P6.3/karta.md`,
`docs/karty/P10.4/wejscie-85.md`, ten folder. Zmienione: banner w `docs/instrukcja-testow-I6.md`,
odsyłacze w backlogu #26 i #90. Roadmapa — nietknięta (reguła z ticketu 82).
