# 152-DOCS-instrukcja-pracy-dla-ani — raport wdrożenia

## Summary

Powstał `docs/instrukcja-pracy-dla-ani.md` (~2000 słów, 10 rozdziałów) — dokument 3 z trzech w fali
„dokumenty dla Ani", domykający kartę TEST.3. Opisuje jedną drogę zgłaszania uwag i poprawek po
testach: komendę `/feature` w Claude Code w przeglądarce, bez furtki „popraw mi to szybko w czacie".
Jedyne wyjście awaryjne to telefon do Pawła — człowiek, nie czat.

## Changes

- **Nowy:** `docs/instrukcja-pracy-dla-ani.md` — dokument dla Ani. Rozdziały: po co ta kartka ·
  dlaczego nie poprawiamy plików produkcji (trzy udokumentowane skutki) · co dostajesz w zamian
  (5 korzyści) · jak wejść (4 kroki) · jak napisać zgłoszenie (tabela + szablon + przykład dobry
  i zły) · trzy rodzaje zgłoszeń (tabela) · czego nie robimy (5 pozycji z następstwami) ·
  gdy pali się · czego się spodziewać (4 momenty) · do Twojej decyzji (2 pytania).
- **Nowy:** `docs/tickets/152-DOCS-instrukcja-pracy-dla-ani/plan.md`

Zmiany ticketa to **wyłącznie** te dwa pliki (`git diff --name-only $(git merge-base HEAD
origin/develop) HEAD`). Ani linii w `rebuild/`, `contract/`, `.claude/` czy `CLAUDE.md`.

## Deviations from plan

Plan wykonany 1:1 w zakresie i strukturze. Trzy rzeczy dopisane w trakcie pisania, nieprzewidziane
w planie wprost:

1. **Zdanie „jednej sesji = jedno zgłoszenie"** w rozdziale „Jak wejść" — bez tego Ania naturalnie
   wrzuciłaby trzy sprawy w jedną sesję, a `/feature` prowadzi jeden ticket.
2. **Rozwinięcie punktu o sekretach:** „jeśli już się wkleiło — nie usuwaj wiadomości po cichu,
   powiedz Pawłowi". Usunięcie z widoku nie unieważnia klucza; bez tego zdania zakaz produkuje
   zachowanie gorsze niż samo wklejenie.
3. **Wariant zapasowy w „Do Twojej decyzji"** (Ania pisze zgłoszenie, `/feature` odpala Paweł) —
   decyzja użytkownika brzmiała „ma/będzie mieć własne konto", więc wejście opisane jest krok po
   kroku, ale jedno zdanie o wariancie zapasowym zostawia dokument użyteczny, jeśli dostęp
   nie zdąży.

## Test results

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Dodaje jeden plik w `docs/`;
  `rebuild/`, `contract/`, schemat i migracje nietknięte. Kontrakt wystąpił wyłącznie jako źródło
  cytowanego faktu (`contract/openapi.yaml:20431`), bez zmian.
- **Bramki backendu: nie dotyczą** — zero zmian w `rebuild/`. Potwierdzone listą plików wyżej.
- **Weryfikacja faktograficzna (realny test tego ticketa):** każde twierdzenie o Selly sprawdzone
  przeze mnie w kodzie, nie przyjęte z raportu researchera:
  - domyślka `SELLY_CSV_DIR` = katalog produkcyjny → `rebuild/backend/src/config/env.ts:138-141`
    (`/home/admin/domains/agritires.eu/public_html/panel/ex-port-files`), `SELLY_CSV_PLIK`
    = `sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv` (`:142`), `SELLY_CSV_URL` publiczny (`:143-146`) ✓
  - `sync-supplier` z `dry_run=false` realnie tworzy i modyfikuje produkty w cudzym sklepie
    `agroopony.selly24.pl` → `rebuild/backend/src/selly/klient.ts:1-12` ✓ (to jedyny moduł
    odbudowy wychodzący do świata po HTTP — też z tego komentarza)
  - kolumna `Cena-zakupu` w generowanym CSV → `rebuild/backend/src/selly/generator-csv.ts:54` ✓
  - zakazy pushu są umową, nie zamkiem → `.githooks/pre-push:6` dokumentuje własne obejście;
    `134-CHORE-praca-w-chmurze/plan.md:4-6,21-22` (rulesety GitHuba 403 na planie Free, CI jest
    sygnałem nie blokadą) ✓ — dlatego dokument mówi „umowa, nie zamek", nie „nie da się"
  - zamrożenie produkcji od 2026-09-22 → `docs/rebuild-roadmap.md:3436` ✓
- **Kontrola żargonu:** `grep -noE 'gate|GATE|fixture|worktree|triaż|deminif|bramka|kontrakt|snapshot'`
  → jedno trafienie: `worktree` (linia 74), użyte raz i wyjaśnione w tym samym zdaniu („sesja sama
  zakłada osobną kopię plików do pracy — zobaczysz słowo *worktree*, to właśnie ona"). Zostawione
  świadomie: Ania zobaczy to słowo w wyjściu sesji, więc lepiej je raz wyjaśnić niż zostawić
  jako zagadkę. Wyjaśnione przy pierwszym użyciu również: „gałąź", `develop`, PR, staging.
  **Nieużyte wcale:** „gate", „fixture", „karta", „triaż", „kontrakt" — zastąpione polskim
  („sprawdzenie", „nagrane odpowiedzi starego Bridge'a", „nasza lista zmian").
- **Kontrola zakresu własności:** ✓ zgodnie z kartą TEST.3.

## Breaking changes

None.

## Follow-up

1. **Domknięcie ticketu 134 (praca w chmurze)** — na dziś to sam plan: `.claude/settings.json` nie ma
   bloku `hooks`/`SessionStart`, `.claude/commands/feature.md` nie ma wariantu „branch w chmurze"
   (zero wystąpień „chmur"/„cloud"/„claude.ai"), hook `pre-push` w świeżej sesji w chmurze włącza się
   dopiero po `npm install` (skrypt `prepare`, `rebuild/backend/package.json:11`). Dokument dla Ani
   opisuje więc zasady jako **umowę** (decyzja użytkownika z 2026-09-24) — to jest uczciwe, ale
   zabezpieczenie warto dołożyć przed cutoverem.
2. **`/feature` nie ma jawnego kroku „utwórz NOWY wpis backlogu dla świadomej zmiany".**
   `.claude/commands/feature.md:29` nanosi tylko wpisy oznaczone ✅, a Faza 5 (`:382`) aktualizuje
   STATUSY istniejących. Dotychczasowe wpisy `docs/rebuild-backlog/wpis-*.md` powstawały w triażu
   starych zmian produkcji, nie jako odpowiedź na nowe żądanie w czasie rzeczywistym. Dokument
   obiecuje Ani, że „zapisujemy jako Twoją decyzję" — mechanizm trzeba nazwać w procedurze.
   Karta TEST.3 zakazuje edycji `feature.md` („zmiana samej komendy = osobna decyzja użytkownika"),
   więc idzie to do „Do koordynatora".
3. **Błędny odsyłacz w `CLAUDE.md`:** jako dowód na łatkę `konstrukcja` w martwym bundlu wskazuje
   `mirror/backend/CHANGELOG.md:101`, gdzie dziś jest inny wpis (hold-reasons). Weryfikowalny dowód
   leży w tabeli łatek w `deminified/README.md`. `CLAUDE.md` jest zakazany przez kartę — do koordynatora.
4. **Brak twardej bramki na `SELLY_CSV_DIR`** (oryginał miał ją w `mirror/backend/staging_policy.cjs:131-134`,
   odbudowa nie ma) — otwarte w backlogu jako `#139.2`, nie ten ticket. Dokument dla Ani łata to
   dziś zakazem („nie generujemy CSV na próbę"), co jest słabszą ochroną niż kod.

## Review fixes applied

Review: `docs/tickets/152-DOCS-instrukcja-pracy-dla-ani/review.md` (2 BLOCKER, 4 SHOULD-FIX,
2 NICE-TO-HAVE). Wszystkie fakty o Selly, zamrożeniu produkcji, trzech skutkach dawnych łatek,
nazwach sekretów i godzinie 12:00 reviewer potwierdził niezależnie w kodzie i repo.

- **BLOCKER 1 (karta TEST.3 nie domknięta)** — słuszny, ale to Faza 5 planu (doc-checker), nie brak
  w treści; domknięte w kolejnym kroku ticketa razem z „Do koordynatora".
- **BLOCKER 2 (obietnica o „liście zmian" bez nazwanego kroku w `feature.md`)** — poprawione.
  Dokument mówił: „zapisujemy jako Twoją decyzję na naszej liście zmian". Nowe brzmienie:
  „zapisujemy z datą jako Twoją decyzję — w planie tego zgłoszenia, a przy szerszych zmianach także
  na naszej liście zmian". Część gwarantowana procedurą (sekcja `Decisions` w `plan.md` każdego
  ticketu) jest teraz podana jako pewna, a wpis na wspólnej liście jako to, czym jest w praktyce
  (por. `docs/rebuild-backlog/wpis-153.md` — sesja założyła wpis dla nowego znaleziska). Luka
  w `feature.md` idzie do „Do koordynatora" w karcie TEST.3.
- **SHOULD-FIX „Mamy ostrzeżenie przy zapisie"** — poprawione. Dopisane, że ostrzeżenie jest
  ustawieniem środowiska, nie jej sesji, i może się nie odezwać; puenta przeniesiona na to, co
  faktycznie rozstrzyga („przeczytana propozycja, nie sam zapis"). Powód: hook włącza się dziś tylko
  przez `npm install` (`134-CHORE-praca-w-chmurze/plan.md:26-31`, nieodhaczone).
- **SHOULD-FIX „opcja na próbę" w panelu Selly** — poprawione, bo było nieprawdą: w UI są **dwa
  osobne przyciski**, nie przełącznik — „Test dry-run (5 szt.)" (`dry_run: true`, limit 5) i „Wyślij
  do Selly" (`dry_run: false`), `rebuild/frontend/src/pages/selly/SekcjaSync.tsx:109-124`
  (potwierdzone przeze mnie w pliku). Dokument nazywa oba przyciski dosłownie, więc Ania nie szuka
  nieistniejącego pola do zaznaczenia.
- **SHOULD-FIX (worktree vs sesja w chmurze)** — reviewer sam ocenia opis jako zgodny ze stanem
  na dziś; ticket 134 planuje dla chmury inny mechanizm („branch bez worktree"), więc fragment
  trzeba będzie zweryfikować po jego domknięciu. Bez zmiany w treści, nota do „Do koordynatora".
- **SHOULD-FIX (sync + PR w DoD)** — normalny krok przed pushem, wykonany w Fazie 6.
- **NICE-TO-HAVE oba przyjęte:** data „1 września" uzupełniona rokiem; „587 pozycji" zmienione
  na „587 pozycji z 7395" — mianownik zmienia wrażenie skali i uczciwiej oddaje proporcję.
