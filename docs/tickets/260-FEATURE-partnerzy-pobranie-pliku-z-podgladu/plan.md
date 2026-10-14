# 260 — PARTNERZY: pobranie pełnego pliku z „Podglądu pliku”

Prośba użytkowniczki 2026-10-14: przy podglądzie pliku ma być możliwość pobrania.

Podgląd pokazuje tylko 20 pozycji, więc „pobierz” daje **cały plik** (wszystkie pozycje) — dokładnie tę treść, którą generowanie zapisałoby w katalogu partnera, na komputer użytkowniczki. Nic nie jest zapisywane na dysku serwera ani wysyłane do partnera, `partner_kursy` i logi nietknięte.
- Backend: `GET /api/partnerzy/:id/podglad/plik?nazwa=<plik z podglądu>` (`requireAuth`), `pelnyPlikPartnera` w `generator.ts` (ten sam rdzeń `przygotujPliki` bez limitu), metoda `pelnyPlik` w serwisie. Nazwa walidowana (`[A-Za-z0-9._-]`, do 120 znaków; nie dotyka systemu plików), nieznana nazwa = 404, brak serwisu = 503. Odpowiedź: załącznik `text/csv` albo `application/xml`.
- Frontend: przy każdym pliku w podglądzie przycisk „Pobierz cały plik” (`fetch` z tokenem + kotwica, jak CSV usuniętych Selly).
Koszt: pobranie liczy wycenę wszystkich pozycji partnera (tak jak generowanie), więc może trwać kilka sekund.
