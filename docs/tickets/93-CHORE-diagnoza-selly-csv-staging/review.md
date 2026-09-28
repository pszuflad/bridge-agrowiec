# 93-CHORE-diagnoza-selly-csv-staging — Code review

> Reviewed: 2026-09-22
> Branch: chore/93-diagnoza-selly-csv-staging
> Diff: 4 pliki zmienione (`tools/deploy-staging.sh`, `tools/publikuj-frontend.sh` [nowy],
> `rebuild/backend/test/publikacja-frontendu.test.ts` [nowy], plan.md), 1 commit

## BLOCKER

- [ ] `docs/karty/PR.4/karta.md` — karta nadal ma stan „⬜ gotowe” i puste sekcje
  Decyzje/Dowiezione/Do koordynatora, mimo że ta karta jest właśnie zamykana tym ticketem.
  - Reason: plan.md tego ticketu (Definition of done) wprost wymaga aktualizacji karty i
    `docs/karty/PR.6/wejscie-93.md`; oba pliki nietknięte w diffie. `CLAUDE.md` p.1 tego repo
    traktuje to jako twardą zasadę („karta.md opisuje STAN, nie zamiar") właśnie dlatego, że
    jej łamanie realnie psuło pracę kolejnych sesji.
  - Suggestion: przed merge'em uzupełnić `docs/karty/PR.4/karta.md` (stan „✅ gotowe”, sekcja
    Decyzje = D1–D4 z plan.md, Dowiezione = zakres z raport.md) oraz dopisać
    `docs/karty/PR.6/wejscie-93.md` — sesja PR.6 (`docs/przeglad-12-widokow.md`, pkt 11/12.6)
    powinna wiedzieć, że objaw „Brak pliku CSV” miał przyczynę infrastrukturalną, nie w
    panelu/backendzie, i że jest już naprawiony.

## SHOULD-FIX

- [ ] `tools/deploy-staging.sh:127` — jeśli `$STAGING_ROOT/.env` (linia 49, `set -a; . .env`)
  świadomie lub przez pomyłkę ustawi `SELLY_CSV_DIR=` (pusty ciąg), `set -u` tego nie złapie
  (zmienna jest „ustawiona”, tylko pusta). W `tools/publikuj-frontend.sh:31-33` pusty `katalog`
  nie pasuje do wzorca `"$DOCROOT"/?*`, więc pętla po prostu nie doda wykluczenia — skrypt
  kończy się bez błędu, ale ochrona katalogu CSV cicho znika i kolejny deploy znów go skasuje.
  Dokładnie ten sam typ błędu (cichej regresji bez żadnego komunikatu), który ten ticket właśnie
  diagnozuje.
  - Suggestion: w `deploy-staging.sh` przed wywołaniem helpera dodać strażnika
    `[ -n "$SELLY_CSV_DIR" ] || { log "BŁĄD: SELLY_CSV_DIR puste — pomijam publikację, żeby nie skasować CSV"; exit 1; }`,
    albo analogiczny warunek w `publikuj-frontend.sh` (pusty argument katalogu → `exit 2`
    zamiast cichego pominięcia).

## NICE-TO-HAVE

- [ ] `tools/publikuj-frontend.sh:32` — wzorzec wykluczenia działa poprawnie także dla
  chronionego katalogu zagnieżdżonego głębiej niż jeden poziom pod docrootem (sprawdzone
  lokalnie: `$DOCROOT/sub/exdir`), ale rsync wtedy zgłasza na stderr nieszkodliwe
  `cannot delete non-empty directory: sub` (bo katalog pośredni `sub` nie jest wykluczony, więc
  rsync próbuje go usunąć i nie może, bo nie jest pusty). Dziś nieistotne — jedyny realny
  argument to `$DOCROOT/ex-port-files`, płytki o jeden poziom, bez tego efektu — ale gdyby ktoś
  w przyszłości dodał drugi chroniony katalog głębiej zagnieżdżony, warto o tym wiedzieć.
- [ ] `tools/publikuj-frontend.sh:32` — wzorzec wykluczenia wstawia ścieżkę katalogu dosłownie do
  `--exclude`; katalog o nazwie zawierającej znaki specjalne rsync (`*`, `?`, `[`) zostałby
  zinterpretowany jako glob, nie literał. Nierealne dla dzisiejszego `ex-port-files`, ale warto
  odnotować jako założenie w komentarzu nad funkcją.

## Plan compliance

### Done ✓
- Diagnoza z odtworzeniem lokalnym (przyczyna: `rsync --delete` w `deploy-staging.sh` kasuje
  `SELLY_CSV_DIR` leżący pod docrootem) — udokumentowana w raport.md z tabelą kroków.
- `tools/publikuj-frontend.sh` — dokładnie zgodny z planem: `mkdir -p`, `rsync -a --delete`,
  `--exclude '.htaccess'` (1:1 ze starym zachowaniem) + `--exclude` per chroniony katalog liczony
  względem `$DOCROOT`, katalog poza docrootem pomijany bez błędu.
- `tools/deploy-staging.sh` — krok frontendu woła helper z `"$SELLY_CSV_DIR"` zamiast inline
  `rsync`; kolejność (build → publikacja → `cp .htaccess`) zachowana identycznie jak przed
  zmianą.
- Test `publikacja-frontendu.test.ts` — prawdziwy `bash`+`rsync` na katalogach tymczasowych
  (`mkdtempSync`, bez mocków, bez stałych portów/ścieżek — równoległy), `describe.skipIf` bez
  `bash`/`rsync`; 5/5 zielone (zweryfikowane ponownie w tej recenzji), w tym test-świadek
  odtwarzający oryginalny błąd bez wykluczenia.
- Weryfikacja lokalna: `bash -n` obu skryptów OK, `npm run lint` i `npm run typecheck` czyste
  (zweryfikowane ponownie w tej recenzji); `shellcheck` niedostępny na maszynie (potwierdzone,
  zgodnie z raportem).
- Semantyka rsync `--exclude` + `--delete` sprawdzona ręcznie: domyślne zachowanie (bez
  `--delete-excluded`, którego skrypt świadomie nie używa) chroni wykluczone ścieżki przed
  skasowaniem; zakotwiczenie `/` + końcowy `/` w wzorcu działa poprawnie dla ścieżek ze
  spacjami (zweryfikowane) i dla katalogów zagnieżdżonych głębiej niż jeden poziom
  (zweryfikowane, patrz NICE-TO-HAVE o komunikacie stderr).

### Missing or deviating ✗
- `docs/karty/PR.4/karta.md` i `docs/karty/PR.6/wejscie-93.md` — wymagane przez Definition of
  done w plan.md, nieobecne w diffie (patrz BLOCKER).
- `docs/tickets/93-CHORE-diagnoza-selly-csv-staging/raport.md` jest w worktree jako plik
  nieśledzony (`git status`) — nie wchodzi w diff `origin/develop...HEAD`. Prawdopodobnie do
  domknięcia razem z commitem karty/wejścia-93 wyżej; odnotowuję, żeby nie zgubić przy merge'u.

### Definition of done
- [x] Przyczyna ustalona i udowodniona odtworzeniem — tabela kroków w raport.md, spójna z
  diagnozą i z kodem (`app.ts:201-205`, `tryb.ts:87`).
- [x] Deploy stagingu nie kasuje katalogu CSV; test zielony; bramki zielone (lint, typecheck
  zweryfikowane ponownie; `npm test` wg raportu 91/91 plików po ponownym biegu).
- [ ] `docs/karty/PR.4/karta.md` + `docs/karty/PR.6/wejscie-93.md` — nie zrobione (patrz BLOCKER).

## Parallel-test concerns

None — `publikacja-frontendu.test.ts` używa `mkdtempSync` (unikalny katalog tymczasowy per test),
bez stałych portów i bez współdzielonych plików; `describe.skipIf` bezpiecznie pomija środowiska
bez `bash`/`rsync`.

## Overall assessment

Diagnoza jest solidna i dobrze udowodniona (odtworzenie end-to-end przed/po), a poprawka jest
mała, precyzyjnie ograniczona do skryptu stagingu i zgodna z deklaracją „produkcja bez zmian".
Semantyka `rsync --exclude`+`--delete` w `publikuj-frontend.sh` jest poprawna i przetestowana
realnym procesem (zweryfikowałem to również ręcznie, w tym przypadek ze spacją w nazwie
katalogu) — to jest dokładnie ten rodzaj testu, jakiego ten bug wymagał. Jedyny realny brak to
niedopełniony obowiązek dokumentacyjny wynikający wprost z `CLAUDE.md` tego repo (karta PR.4 +
wejście dla PR.6) — bez niego następna sesja czytająca kartę PR.4 zobaczy nieaktualny stan
„gotowe do zrobienia", a PR.6 straci kontekst, że zgłoszenie Ani miało przyczynę
infrastrukturalną.
