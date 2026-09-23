# Wejście dla TEST.3 od ticketu 149 (TEST.1) · 2026-09-24

## Cztery decyzje, na które dokument 1 zbiera odpowiedź od Ani

`docs/instrukcja-pelnego-testu.md` ma sekcję „Do Twojej decyzji" z **czterema pozycjami**
(pełna treść w `docs/karty/TEST.1/karta.md`, decyzja D4):
1. priorytet reguły narzutu (#89 — brak pola „priorytet" w formularzu),
2. podział admin / zwykły użytkownik (brak w oryginale, pytanie czy wprowadzić),
3. #137.2 — ciche nadpisywanie ręcznych poprawek Marty przy sprzecznym pliku dostawcy,
4. złączenie czterech podwójnych par bieżników w `/atrybuty`.

Każda ma warianty do zaznaczenia (np. A/B, w #3 i #4 A/B/C(/D)) — kratki, nie opisowa odpowiedź.

## Którą drogą wracają odpowiedzi — TEST.3 ma to powiedzieć wprost

Zaznaczone kratki w odesłanym dokumencie **nie są jeszcze implementacją**. TEST.3 (`docs/instrukcja-pracy-dla-ani.md`)
ma jasno wskazać drogę powrotną, żeby te cztery odpowiedzi nie zginęły w czacie:

**decyzja użytkownika → wpis w backlogu → `/feature`.**

Czyli: Ania odsyła dokument z zaznaczonymi wariantami → zaznaczenie jest **decyzją użytkownika** →
trafia jako nowy wpis do `docs/rebuild-backlog/wpis-<numer ticketu>.md` (reguła własności backlogu,
`docs/rebuild-backlog/README.md`) → dopiero wtedy ktoś odpala `/feature` na ten wpis, żeby powstał
ticket implementujący wybrany wariant. Dokument dla Ani (TEST.3, sekcja „Trzy rodzaje zgłoszeń")
już opisuje ten wzorzec ogólnie dla „świadomej zmiany" — wystarczy, żeby czytelnik skojarzył, że
cztery pozycje z dokumentu 1 są dokładnie tym przypadkiem, nie osobną kategorią.

Nie zakładaj, że odpowiedzi na te cztery pytania wrócą przez PR do `docs/instrukcja-pelnego-testu.md`
— ten plik jest własnością karty TEST.1 i po odesłaniu dokumentu nie jest już aktualizowany w ramach
tego cyklu testów.
