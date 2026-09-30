# 164c-CHORE-deploy-napraw-nazwy — raport implementacji

## Summary

Użytkowniczka poprosiła, żeby naprawa z ticketu 164/164b (174 poprawnych nazw dla opon
z kolizją `kod_importu`) nie wymagała jej ponownego logowania SSH na serwer produkcyjny.
Rozwiązanie: wpięcie jednorazowego, samoograniczającego się wywołania skryptu
`napraw-nazwy-sklejone` w `tools/deploy-produkcja.sh` — uruchomi się automatycznie przy
najbliższym deployu produkcji (czyli przy scaleniu PR-a `develop→main`), bez żadnej akcji
ze strony użytkowniczki.

## Changes

- `tools/deploy-produkcja.sh` — nowy blok po `npm run migrate`, przed atomową podmianą
  release'u: jeśli plik-znacznik `$PROD_ROOT/.164-napraw-nazwy-wykonano` nie istnieje,
  uruchamia `DB_PATH=$DATA_DB npm run napraw-nazwy-sklejone` z katalogu `rebuild/backend`
  repo (ma tam devDependencies z etapu builda, w tym `tsx`) i tworzy znacznik.

## Deviations from plan

Świadome, jednorazowe odstępstwo od zasady „`deploy-produkcja.sh` i `deploy-staging.sh` są
identyczne poza konfiguracją" (nagłówek obu plików) — opisane komentarzem w miejscu zmiany.
Staging nie potrzebuje tej naprawy (dane testowe, nie produkcyjne).

Mechanizm: plik-znacznik POZA katalogiem `repo/` (czyli poza tym, co nadpisuje
`git reset --hard` przy każdym deployu), więc uruchomi się dokładnie raz, niezależnie od tego,
ile kolejnych deployów produkcji nastąpi. Sam skrypt `napraw-nazwy-sklejone` jest i tak
idempotentny (upsert + porównanie przed zapisem w `zastosujNazwyWKatalogu`), więc nawet
przypadkowe powtórne uruchomienie byłoby nieszkodliwe — znacznik jest tylko po to, żeby nie
robić zbędnej pracy przy każdym przyszłym deployu.

## Test results

- Zmiana jest w skrypcie bash uruchamianym na serwerze produkcyjnym — nie da się jej
  zweryfikować testem jednostkowym backendu. Sprawdzono ręcznie: składnia bloku (`if`/`fi`,
  cytowanie zmiennych), zgodność ścieżek (`rebuild/backend` względem `$REPO_DIR`, do którego
  skrypt robi `cd` na starcie) z resztą pliku.
- Potwierdzono grepem, że żaden test w `rebuild/backend/test/` nie porównuje treści
  `deploy-produkcja.sh` z `deploy-staging.sh` (więc ten świadomy rozjazd nie wywali CI).
- Bramki backendu (lint/typecheck/build/test) nie dotyczą tego pliku — nie ma kodu TS do
  sprawdzenia w tym ticketcie.

## Breaking changes

None — zmiana wykonuje się tylko raz (plik-znacznik), w środku istniejącego, już
zatwierdzonego procesu deployu produkcji.

## Follow-up

Po potwierdzeniu, że pierwszy deploy po tym PR-ze faktycznie naprawił nazwy w katalogu
produkcyjnym (użytkowniczka sprawdzi w panelu), warto w kolejnym, mniejszym ticketcie usunąć
cały ten blok z `deploy-produkcja.sh` — swoje zadanie już wykona, a stały kod bez zastosowania
to szum dla kogoś, kto czyta skrypt za pół roku. Nie usuwam go teraz automatycznie, żeby nie
zgadywać, czy przebieg się faktycznie powiódł, zanim ktoś to potwierdzi.
