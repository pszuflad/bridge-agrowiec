# Wpis do spec-backend od ticketu 91 (karta PR.1) · 2026-09-22

**Sekcja:** §2 (auth — nowe trasy odczytu archiwum importów).

**Potwierdzone w 91** (`91-FEATURE-archiwum-importow`, 2026-09-22, karta PR.1): trzy trasy
odczytu archiwum importów, port `archive_module.cjs:160-241` — `GET /api/import-archive`
(filtry `dostawca` upper-case, `miesiac` = nazwa katalogu, `status` dosłownie; najnowsze
pierwsze po `mtime`; wartości zastępcze, gdy brak `.meta.json`), `GET
/api/import-archive/stats` (`{ok, plikow, bajtow, limitBajtow: 5 GB, retencjaDni: 7,
perMiesiac}`) i `GET /api/import-archive/file/{month}/{name}` — **dwa segmenty, nie
`file/:id`**, bo Apache `AllowEncodedSlashes=Off` odrzuca `%2F`; regex `^\d{4}-\d{2}/[^/]+$`
+ zakaz `..` → 400, brak pliku → 404, `Content-Disposition` z nazwą archiwalną. Wszystkie
trzy już w oryginale za `we` (Bearer lub cookie) — **NIE jest to odstępstwo D1**. Zapis
archiwum bez zmian (od 3b), retencja `RETENCJA_DNI = 7` zgodna z produkcją (nie 90 dni —
komentarz nagłówka oryginału jest nieaktualny, kod wygrywa). Szczegóły:
`docs/tickets/91-FEATURE-archiwum-importow/`.
