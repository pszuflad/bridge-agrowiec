# I15.10b — montaż modułu dostępności w `server.ts`

> **Stan:** ⬜ do wstawienia w kolejkę (karta założona 2026-09-23 na polecenie użytkownika)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #104 (reszta po I15.10)
> **Ticket:** `136-FEATURE-montaz-dostepnosci` (plan gotowy, niewykonany)
> **Zależy od:** I15.10 ✅ (ticket 119, PR #144 — moduł istnieje)

## Zakres

Rejestracja `stworzSynchronizacjeDostepnosci({db, discovery: discoverySelly, sciezkiCsv})`
przez `ustawDomyslnaSynchronizacjeDostepnosci()` w `src/server.ts`, wzorem `harmonogramSelly`,
plus wyrejestrowanie w `zamknij()`. Pełny opis, wymagania i testy: plan ticketu 136.

## Skąd się wzięła ta karta

Ticket 119 (I15.10) świadomie nie ruszał `app.ts` i oddał montaż „do uzgodnienia z I15.8".
`docs/karty/I15.10/wejscie-121.md` odpowiedziało „montaż robi I15.10" już po zamknięciu tamtego
ticketu, więc czynność została bez właściciela. Wołanie `zadajOdswiezenie()` ma I15.4b
(`docs/karty/I15.4b/wejscie-119.md`) — to osobna rzecz i zostaje tam, gdzie jest.

## Pliki (wyłączna własność)

- `rebuild/backend/src/server.ts` — sam montaż (kilkanaście linii).
- Test montażu — nowy plik, nazwa do wyboru przez wykonawcę.

NIE dotyka: `src/selly/rest/scheduler.ts`, `src/routes/selly-sync.ts` (własność I15.8),
`src/selly/dostepnosc.ts` (własność I15.10 — moduł jest gotowy, nie przepisujemy go).

## Do koordynatora

- **Kolejność:** można wykonać od razu — jedyna zależność (moduł z I15.10) jest na `develop`.
- **Wielkość:** pół godziny, bez zmian w kontrakcie i bez migracji.
- **Ryzyko zostawienia na później:** I15.4b zacznie wołać `zadajOdswiezenie()`, a to bez montażu
  jest ciche no-opem — odświeżanie dostępności nie zadziała i nic o tym nie powie.
