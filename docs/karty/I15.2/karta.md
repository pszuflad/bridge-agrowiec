# I15.2 — resync parserów + `application_rules`, `payment_blocks`, część parserowa Staging v2

> **Stan:** ⬜ po I15.1 (fala 2)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #73, #75, #78, #79, #80, #82, #83, #99 · **Zależy od:** I15.1
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Ta sama metoda co 13a (`42-CHORE-i13a-resync-parserow`): kopia z `origin/main` do `rebuild/backend/src/import/legacy/`:
- `parsers/adapter.cjs`, `parsers/mo9_agrorami_api.cjs`, `parsers/tyre_params.cjs`, `common.cjs`;
- NOWE: `application_rules.cjs` (#75/#79/#80/#82), `payment_blocks.cjs` (#73 — tylko czysta
  `getBlockedPaymentForms()`; moduł ma zahardkodowaną ścieżkę bazy produkcji `/home/admin/private_apps/bridge/data.db`
  — adapter NIE może otwierać żadnej bazy), `staging_policy.cjs` w części używanej przez adapter/common
  (`validateEan`, `rawEan`, `syntheticCode` i ich zależności; `install()`/`registerRoutes()` należą do I15.4).
- `git diff origin/develop origin/main -- mirror/backend/extensions.cjs` — rozłóż i przypisz: co dotyczy parsowania,
  robisz tu; co importu/akceptacji → wejście dla I15.4; Selly → I15.6/I15.8.

**Test akceptacyjny (gotowy):** `docs/tickets/71-DOCS-plan-poprawek/porownaj-parsery.cjs` na 8 prawdziwych
cennikach w `/tmp/cenniki` (poza repo — **NIE commitować**; jeśli ich nie ma, zapytaj użytkownika). Po resyncu:
**zero różnic w polach** między potokiem produkcji (`origin/main`, z nowymi modułami) a naszym. MO9 nie da się
przetestować plikiem (API, brak haseł) — opisz to.

⚠ D4: adapter produkuje teraz `eanRaw`/`_eanLossy` i `ean: null` dla błędnego EAN. Do czasu I15.4 importer
(`import/tk.ts`) tych flag nie zna — sprawdź, że stan przejściowy nie psuje importu (oczekiwanie: jak 14i, EAN pusty),
i zapisz wejście dla I15.4. Wpisy #11 i 14i: oznacz jako zastąpione przez #99/D4 (backlog).
⚠ #83 łamie obietnicę z `docs/instrukcja-testow-I3.md` §11 pkt 10 („10.00 zostaje”) — wejście dla I15.9.

## Pliki (wyłączna własność)
`rebuild/backend/src/import/legacy/**`, testy charakteryzacyjne parserów. NIE: `import/tk.ts` i staging (I15.4),
`rebuild/schema/`, Selly.

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

—

## Dowiezione
—

## Do koordynatora
—
