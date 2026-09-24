# 156-DOCS-ania-merguje-i-sprawdza-wdrozenie — Ania sama włącza zmianę i sprawdza wdrożenie

> Status: Approved → Implemented → Shipped
> Branch: `docs/156-ania-merguje-i-sprawdza-wdrozenie`
> Worktree: `.worktrees/156-DOCS-ania-merguje-i-sprawdza-wdrozenie`
> Kontynuacja ticketa `152-DOCS-instrukcja-pracy-dla-ani` (karta TEST.3, zamknięta)

## Ticket description

Decyzja użytkownika z 2026-09-24, po przeglądzie całego łańcucha „zgłoszenie → wdrożenie":
**włączanie zmian nie należy do Pawła — merguje Ania.** Do instrukcji trzeba dopisać, jak się
merguje i jak potem w zakładce Actions sprawdzić, czy paczka wdrożyła się z `develop` na środowisko
testowe.

## Context

Dokument `docs/instrukcja-pracy-dla-ani.md` (ticket 152, PR #166, zmergowany) mówił w rozdziale
„Czego się spodziewać po drodze": *„Włączenie zmiany robi Paweł"*. Nowa decyzja to obala.

**Łańcuch jest już zbudowany — sprawdzone, nie założone:**
- `.github/workflows/deploy-staging.yml:13-20` — `on: push: branches: [develop]`, `paths:`
  `rebuild/**`, `deploy/staging/**`, `tools/deploy-staging.sh`; job łączy się po SSH z VPS
  i uruchamia `tools/deploy-staging.sh` (`:29-40`). `concurrency` kolejkuje, nie przerywa.
- Sekrety `STAGING_SSH_*` ustawione w repo od 2026-08-25 (`gh secret list`).
- Realne biegi: „Deploy staging" po merge'u PR #169 — **sukces, 1m11s**; poprzedni po #161 —
  sukces, 59 s (`gh run list --workflow=deploy-staging.yml`).
- CI (`ci.yml`) ma trzy joby: `synchronizacja`, `backend`, `frontend`, Node 20; ostatnie biegi
  **2m05s–2m22s**.
- `develop` **nie ma ochrony gałęzi ani wymogu review** — Ania może zmergować sama, a GitHub nie
  zablokuje przycisku przy czerwonym CI. To czyni ją ostatnim sprawdzeniem.
- Baza stagingu przeżywa podmianę wersji (`tools/deploy-staging.sh:23` —
  `DATA_DB=.../data-nowy.db  # baza staging (przeżywa podmiany)`), więc wdrożenie nie kasuje danych
  z jej importów.
- Filtr `paths` znaczy, że **zmiana tylko w `docs/` nie odpala wdrożenia** — trzeba ją o tym
  uprzedzić, inaczej będzie czekać na bieg, który nie powstanie.

## Kontrakt i fixtures (zakres)

**Brak (nie dotyka kontraktu).** Jeden plik w `docs/` plus artefakty ticketa. Zero zmian
w `rebuild/`, `contract/`, schemacie.

## Decisions

1. **Merguje Ania, nie Paweł** (decyzja użytkownika 2026-09-24). Uzasadnienie w dokumencie podane
   jako korzyść, nie procedura: to ostatni moment, w którym da się coś zatrzymać bez kosztów,
   więc jest po jej stronie.
2. **Twarda reguła „tylko przy zielonym ✓"**, z jawnym ostrzeżeniem, że GitHub przycisku nie
   zablokuje. Powód: bramki w sesji przeglądarkowej są niesprawdzone (ticket 134 niedomknięty),
   więc CI jest realnym zabezpieczeniem — ale tylko jeśli ktoś na nie patrzy. Przy czerwonym:
   komentarz pod propozycją + Paweł, bez klikania „Re-run".
3. **Podajemy konkretne liczby, bo są zmierzone:** ~2 min na CI, ~1 min na wdrożenie. Tu liczba jest
   dowiedziona biegami, w przeciwieństwie do „ile trwa ticket" (świadomie pominięte w 152).
4. **Uprzedzamy o wyjątku „tylko dokumenty → brak biegu «Deploy staging»"** — inaczej zgłosi
   nieistniejącą usterkę, tak jak przy odświeżaniu dostępności (`docs/karty/TEST.1/wejscie-144.md`).
5. **Dopisujemy, czego wdrożenie NIE robi** (nie kasuje danych na teście) — to pierwsze pytanie,
   które zada przy pierwszym merge'u.

## Implementation plan

1. `docs/instrukcja-pracy-dla-ani.md`:
   - rozdział „Czego się spodziewać po drodze", punkt 4: „Włączenie zmiany robi Paweł" → „robisz Ty"
     + odesłanie do nowego rozdziału;
   - **nowy rozdział „Jak włączyć zmianę i sprawdzić, że jest na teście"** (4 kroki: otwórz PR →
     poczekaj na zielone → „Merge pull request" + „Confirm merge" → zakładka Actions, bieg
     „Deploy staging"), z wariantami żółty/zielony/czerwony przy każdym biegu i `Ctrl+Shift+R`;
   - spójność: dwa zdania w innych rozdziałach mówiące „ktoś włącza" → „włączasz sama".
2. `docs/karty/TEST.3/karta.md` — jedna linia w „Dowiezione" (ticket 156 zmienił punkt o włączaniu)
   i rozszerzenie noty o tickecie 134 w „Do koordynatora" o listę rzeczy do sprawdzenia empirycznie
   w sesji przeglądarkowej (`gh`, bramki, numer ticketa).

## Testing strategy

- GATE odbudowy: **N/D** (uzasadnienie wyżej). Bramki backendu nie dotyczą — zero zmian w `rebuild/`.
- **Weryfikacja faktograficzna:** każda liczba i nazwa w nowym rozdziale potwierdzona w repo albo
  w realnym biegu GitHub Actions (nazwy jobów CI, nazwa workflow „Deploy staging", czasy, filtr
  `paths`, brak ochrony `develop`, trwałość bazy stagingu).
- Kontrola, czy w dokumencie nie został ślad po starym podziale ról: `grep -n 'Paweł\|ktoś włącza'`.

## Out of scope

- Wariant `/feature` dla zgłoszeń Ani (pytania biznesowe zamiast technicznych) i krok tworzący nowy
  wpis backlogu — zmiana `.claude/commands/feature.md`, osobna decyzja użytkownika.
- Przelot testowy w chmurze (`gh`, bramki, numer ticketa) — osobny ticket, wymaga sesji
  w przeglądarce; notatka w „Do koordynatora".
- Ochrona gałęzi `develop` na GitHubie — niedostępna na planie Free (HTTP 403,
  `134-CHORE-praca-w-chmurze/plan.md:4-6`).

## Definition of done

- [ ] Dokument mówi, że merguje Ania, i nie ma w nim zdania o włączaniu przez Pawła
- [ ] Nowy rozdział: 4 kroki merge'a + sprawdzenie biegu „Deploy staging" w Actions, z reakcją
      na zielony / żółty / czerwony
- [ ] Reguła „tylko przy zielonym ✓" z ostrzeżeniem, że GitHub nie zablokuje przycisku
- [ ] Wyjątek „tylko dokumenty → brak wdrożenia" opisany
- [ ] Wszystkie liczby (2 min, 1 min) i nazwy (`synchronizacja`, `backend`, `frontend`,
      „Deploy staging") zgodne z repo i realnymi biegami
- [ ] Karta TEST.3 odnotowuje zmianę; roadmapa nietknięta
- [ ] `git diff --name-only origin/develop HEAD` wyłącznie `docs/`; gałąź zsynchronizowana, PR `MERGEABLE`
