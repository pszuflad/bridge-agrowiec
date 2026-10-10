# 229 — Raport (PRT-7.3)

## Summary
Dodano odbiór zamówień partnerów przez e-mail: IMAP za interfejsem, zapis załączników XML przez model z ticketu 228, logi, pomijanie kanału bez sekretu i harmonogram domyślnie wyłączony.

## Changes
- **Nowe:** `src/partnerzy/{poczta,poczta-imap,odbior-email}.ts`, `test/partnerzy.odbior-email.test.ts` (12 testów na atrapie skrzynki)
- `src/config/env.ts` (4 zmienne `PARTNERZY_ODBIOR_EMAIL*`/`PARTNERZY_IMAP_*`), `src/server.ts` (timer za flagą), `.env.example`, `package.json`/`package-lock.json` (imapflow, mailparser, @types/mailparser)
- Docs: `docs/spec-backend/wpis-229.md`, `docs/karty/PARTNERZY/karta.md`

## Deviations from plan
Brak.

## Test results
- **Gate kontraktu:** N/D — ticket nie dotyka API (brak tras, brak zmian w `openapi.yaml`/fixtures).
- Unit/integracja: 12 nowych testów ✓ (atrapa skrzynki). Pełne bramki: zob. PR.
- **Nie przetestowano** realnego połączenia IMAP (`poczta-imap.ts`) — brak serwera z chmury. Sprawdzono tylko, że moduł się buduje i ładuje (`dist/`).

## Breaking changes
None. Nowe zmienne env są opcjonalne, odbiór domyślnie wyłączony.

## Follow-up
- Pierwszy odbiór na prawdziwej skrzynce (środowisko testowe), w tym zachowanie `imapflow` przy dużych wiadomościach i utracie połączenia.
- Czy mailbox partnera ma być na naszym serwerze IMAP, czy zewnętrznym — ustala się przy konfiguracji (host jest wspólny dla wszystkich partnerów).
