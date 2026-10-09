# 205-CHORE-reset-hasla-arkadiusz — reset hasła Arkadiusza Mielczarka

> Status: Approved (prośba użytkowniczki 2026-10-09: „Arek nie pamięta hasła, trzeba mu zresetować”)
> Branch: `claude/awesome-faraday-98rpkk` (wymuszona przez środowisko sesji chmurowej)

## Opis
Arkadiusz nie pamięta swojego hasła i nie może się zalogować. Użytkowniczka prosi o reset. Zgodnie z regułą z
`CLAUDE.md` (poprawki danych i konta na produkcji idą przez wdrożenie, nigdy ręcznie na serwerze) robimy to
krokiem wdrożenia w `rebuild/backend/src/kroki/rejestr.ts`.

## Decyzje
1. **Hasło tymczasowe = `HASLO_TYMCZASOWE` z `$PROD_ROOT/.env`** (to samo, którym założono konta Erwina i Anny). Wartości nie ma
   w repo; brak zmiennej → krok pominięty bez zapisu. Arkadiusz zmienia je po zalogowaniu w `/moje-konto`.
2. **Krok biegnie RAZ** (zapis w `kroki_wdrozenia`): hasło, które Arkadiusz ustawi sobie potem, nie zostanie nadpisane
   przy kolejnym wdrożeniu.
3. **Brak konta nie przerywa wdrożenia:** krok zwraca `odloz` (nie zapisuje się) i nie zakłada konta.
4. **Dotyka wyłącznie `users.haslo_hash`** jednego konta (`arkadiusz.mielczarek@agrowiec.eu`, dopasowanie dokładne jak w logowaniu).
5. **Środowisko testowe** nie uruchamia kroków wdrożenia (`deploy-staging.sh`), więc jego baza nie jest ruszana.

## Zakres
`src/auth/reset-hasla.ts` (`ustawHasloTymczasowe`), nowy wpis w `src/kroki/rejestr.ts`, testy w `test/kroki.runner.test.ts`.
Kontrakt API i fixtures nie są dotykane (brak nowych tras).

## Poza zakresem
Mechanizm „zapomniałem hasła” w aplikacji (reset przez e-mail), wylogowanie istniejących sesji (JWT bezstanowy),
błąd 404 przy logowaniu zgłoszony wcześniej (osobne ustalenia: nie jest błędem kodu).

## Definition of done
- [ ] Po wdrożeniu Arkadiusz loguje się hasłem tymczasowym; stare nie działa
- [ ] Inne konta i pozostałe pola jego konta bez zmian
- [ ] Kolejne wdrożenie nie nadpisuje hasła ustawionego przez użytkownika
- [ ] Bramki backendu zielone po synchronizacji z `develop`; PR `MERGEABLE`
