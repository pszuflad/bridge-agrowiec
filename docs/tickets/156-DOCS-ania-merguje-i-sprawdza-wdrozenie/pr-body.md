## Ticket
156-DOCS-ania-merguje-i-sprawdza-wdrozenie — Ania sama włącza zmianę i sprawdza wdrożenie

## Summary
`docs/instrukcja-pracy-dla-ani.md` przypisuje włączanie zmian Ani, nie Pawłowi, i dostał nowy rozdział
„Jak włączyć zmianę i sprawdzić, że jest na teście": cztery kroki na GitHubie plus sprawdzenie biegu
„Deploy staging" w zakładce Actions. Łańcuch domyka się na tym, czego Ania oczekuje — po jej kliknięciu
zmiana sama jedzie na `test.agritires.eu` w ok. minutę.

## Problem / Motivation
Ticket 152 (PR #166) napisał w instrukcji: *„Włączenie zmiany robi Paweł"*. Decyzja użytkownika
z 2026-09-24 to obala — merguje Ania, i musi wiedzieć, jak to zrobić oraz jak sprawdzić, czy paczka
wdrożyła się z `develop` na środowisko testowe. Przy okazji przeglądu okazało się, że ostatnie ogniwo
łańcucha (automatyczne wdrożenie po merge'u) **już istnieje i działa** — brakowało tylko opisu dla niej.

## Solution
- punkt 4 w „Czego się spodziewać po drodze": „robi Paweł" → **„robisz Ty"** + odesłanie do nowego rozdziału;
- **nowy rozdział**: otwórz PR → poczekaj na zielone ✓ (`synchronizacja`, `backend`, `frontend`, ~2 min) →
  „Merge pull request" + „Confirm merge" → zakładka Actions, bieg **„Deploy staging"** (~1 min) →
  `Ctrl+Shift+R` na `test.agritires.eu`; reakcja na żółty/zielony/czerwony, wyjątek „tylko dokumenty →
  brak wdrożenia", zdanie o tym, że wdrożenie nie kasuje danych na teście;
- dwa miejsca poprawione na spójność (rozdziały „Jak wejść" i „Czego nie robimy");
- karta TEST.3: odnotowana zmiana + **lista rzeczy do sprawdzenia empirycznie w sesji przeglądarkowej**.

## Design decisions
- **Twarda reguła „tylko przy zielonym ✓" z jawnym ostrzeżeniem, że GitHub nie zablokuje przycisku** —
  `develop` nie ma ochrony gałęzi (plan Free, rulesety 403), a bramki w sesji przeglądarkowej są
  niesprawdzone. CI jest więc realnym zabezpieczeniem tylko wtedy, gdy ktoś na nie patrzy; ten „ktoś"
  to Ania i dokument mówi to wprost.
- **Podajemy konkretne liczby (2 min, 1 min)** — w odróżnieniu od „ile trwa ticket" (świadomie pominięte
  w 152) te są zmierzone na realnych biegach Actions.
- **Uprzedzamy o wyjątku „tylko dokumenty → brak biegu «Deploy staging»"** — inaczej Ania zgłosi
  nieistniejącą usterkę, dokładnie jak przy odświeżaniu dostępności (`docs/karty/TEST.1/wejscie-144.md`).
- **Dopisujemy, czego wdrożenie nie robi** (nie kasuje danych na teście) — pierwsze pytanie przy pierwszym merge'u.

## Tests
- **Gate odbudowy: N/D**, bramki backendu nie dotyczą — zero zmian w `rebuild/` (`git diff --name-only
  origin/develop HEAD` → wyłącznie `docs/`).
- **Weryfikacja faktograficzna:** nazwa i wyzwalacz workflow (`deploy-staging.yml:1,13-20`), SSH + skrypt
  (`:29-40`), czasy wdrożeń z realnych biegów (1m11s, 59 s — oba sukces), sekrety `STAGING_SSH_*` ustawione
  od 25.08, nazwy trzech sprawdzeń CI i Node 20 (`ci.yml:17,36,67,47,78`), czasy CI 2m05s–2m22s, brak
  ochrony gałęzi `develop`, trwałość bazy stagingu (`tools/deploy-staging.sh:23`).
- `grep` po dokumencie: zero zdań o włączaniu zmiany przez Pawła; pozostałe wzmianki o nim są celowe.

## Breaking changes
None.

## Follow-up
1. **Przelot testowy w chmurze** — czy `gh` jest zalogowany w sesji przeglądarkowej i czy bramki się tam
   uruchomią. To jedyna niewiadoma, która może urwać łańcuch po cichu. Lista kontrolna w karcie TEST.3
   („Do koordynatora", punkt 2).
2. **Wariant `/feature` dla zgłoszeń Ani** — pytania biznesowe zamiast technicznych + jawny krok tworzący
   wpis w backlogu (zmiana `.claude/commands/feature.md`, osobna decyzja użytkownika).
3. Punkty z ticketa 152 bez zmian: błędny odsyłacz w `CLAUDE.md`, brak bramki na `SELLY_CSV_DIR` (`#139.2`),
   odsyłacz z `docs/cutover.md`.

## Review
Bez osobnego przebiegu review — zmiana dokumentacyjna w jednym pliku, wynikająca wprost z decyzji
użytkownika; weryfikacja faktograficzna (sekcja „Tests") zrobiona w oparciu o repo i realne biegi
GitHub Actions, nie o raport z drugiej ręki.

---
Ticket docs: `docs/tickets/156-DOCS-ania-merguje-i-sprawdza-wdrozenie/`
