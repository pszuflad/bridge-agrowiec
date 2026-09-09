# 46-CHORE-revert-13d1-selly — raport

**Data:** 2026-09-09 · **Typ:** chore (revert) · **Cofa:** PR #57 (`45-FEATURE-selly-rest-sync-tor1`)

## Co i dlaczego

13d-1 (Selly REST sync — fundament + Tor 1) zostało sportowane i zmergowane (PR #57), a tu **cofnięte**
przez `git revert -m 1 <merge #57>` (forward-commit, NIE rebase — develop jest opublikowany/chroniony).

**Powód.** Ania (2026-09-09) potwierdziła, że podsystem Selly **nie jest zamrożony**: dostawcy
aktualizują się przez ~tydzień, a ona łata błędy w `selly/*` na bieżąco. Port z 08.09 był ruchomym
celem — dokładnie ta blokada, przed którą ostrzegał plan I13. **Całe 13d przepiszemy świeżo** po
ustabilizowaniu, zamiast utrzymywać prowizorkę i doganiać ją deltami.

## Co usunął revert (41 plików, −4616)

- `rebuild/schema/007_selly_products_warianty.sql` (migracja RENAME→`_old` + nowa `selly_products`)
- `rebuild/backend/src/selly/{discovery,limiter,mapper-v2,scheduler-sync,sync-delta}.ts`
- `rebuild/backend/src/routes/selly-sync.ts`
- model wariantowy w `src/db/schema.ts`, `src/repos/selly.ts`, montaż w `server.ts`
- 7 plików testów Selly REST + 3 ścieżki w kontrakcie
- `docs/tickets/45-FEATURE-selly-rest-sync-tor1/*`

## Weryfikacja

Bramki po rewercie (Node 20): **lint ✓ · typecheck ✓ · build ✓ (6 migracji, 007 zniknęła) ·
test 80 plików / 1241 testów ✓**. Zero wiszących referencji do usuniętego kodu.

## Skutki dla planu

- Roadmapa blok 13d → ⛔ ODŁOŻONE; backlog #60 → status „odłożone/cofnięte".
- **Sygnał startu 13d:** `git log --since="7 days ago" main -- mirror/backend/selly/` przez kilka dni bez
  zmian (rewizja ~2026-09-16).
- ⚠ **Rewrite na NOWEJ gałęzi.** Revert merge’a #57 sprawia, że git traktuje `feature/45` jako „już
  zmergowane" — przyszłe 13d nie może iść przez re-merge tamtej gałęzi; świeży port z finalnego `mirror/selly/`.
- Tor bieżący bez zmian: 13a→13b→13c→13e (13d wypada z kolejki do czasu stabilizacji).

## Dołożone w tym samym PR (2026-09-09): triaż 09.09 + decyzja o rebrandzie

Producent znów działa (fix `d88ac15` zadziałał — 3 commity `sync(vps)` przyszły z automatu + mail).

- **Triaż `d88ac15..94bdf11`** (3 commity, 08-09 17:00 / 09-09 06:00 / 09-09 09:00): WSZYSTKO to
  docieranie Selly Tor 2 — `sync_full` przepisany (428 linii, usunięte PUT features po Selly 400
  „Malformed JSON"), `mapper_v2 v2.1` (bez `vat_rate`), `discovery.buildProductCodeCache`, weryfikacja
  pierwszego nocnego Tor 2 (MO5 1713 ok). **ZERO zmian FE/menu** — tag `[FRONTEND]` w mailu to tylko
  przegenerowany `sellycsv-*.csv` (dane). Nie zakładamy nowej karty — to należy do odłożonego 13d;
  **zegar startu 13d zresetowany**. Marker triażu → `94bdf11`. To dodatkowo potwierdza trafność revertu.
- **Rebrand (decyzja użytkownika 2026-09-09):** odbudowa PRZYJMUJE nazwę **„Bridge ONE"** (produkcja się
  przemianowała → 1:1). Zapisane w roadmapie 13e i backlogu #61 — sesja 13e nie pyta już o to.
