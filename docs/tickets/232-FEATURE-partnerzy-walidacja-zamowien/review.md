# 232-FEATURE-partnerzy-walidacja-zamowien — Code review

> Reviewed: 2026-10-10
> Branch: claude/peaceful-gates-a8yebr
> Diff: 20 plików (+501/-16), 1 commit (07a58f4)
> Uruchomione pojedyncze pliki testów (walidacja, trasy, migracja 029, odbiór e-mail): 45/45 zielone. Pełnych bramek nie uruchamiałem.

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/src/partnerzy/walidacja-zamowienia.ts:53-57` — stan jest sprawdzany osobno dla każdej pozycji, bez sumowania ilości tego samego kodu w jednym zamówieniu.
  - Reason: dwie linie tego samego `CODE` po 60 szt. przy stanie 100 przechodzą walidację (60 ≤ 100), a razem żądają 120. Zamówienie dostaje `przyjete`, choć brakuje stanu. Błąd jest cichy.
  - Suggestion: zsumować `ilosc` po `kod.trim()` w obrębie zamówienia i porównać sumę ze stanem. Albo świadomie zapisać w planie i `wpis-232.md`, że to ograniczenie.
- [ ] `rebuild/backend/src/partnerzy/odbior-email.ts:161-164` w połączeniu z `walidacja-zamowienia.ts:49` — walidacja biegnie ponownie po każdym powtórzonym pliku i nie wyklucza zamówienia już `przyjete`.
  - Reason: stan to bieżący stan katalogu, a nie rezerwacja. Zamówienie ocenione jako `przyjete` wczoraj może po ponownym odebraniu tego samego XML-a (albo po „Sprawdź ponownie”) zmienić się w `blad_importu`, bo towar został w międzyczasie sprzedany. To zaskakuje, bo nic w zamówieniu się nie zmieniło. Dodatkowo każdy duplikat pliku zmienia stan zamówienia i jego błędy.
  - Suggestion: przy powtórzonym pliku (`!z.nowe`) walidować tylko wtedy, gdy zamówienie jest w `blad_importu` albo `nowe`. Albo udokumentować, że `przyjete` nie jest gwarancją rezerwacji. Zasada „przyjęte → błąd po zmianie stanu" powinna być jawną decyzją użytkownika. Wymaga to też wzmianki w `wpis-232.md`.
- [ ] `rebuild/backend/src/partnerzy/odbior-email.ts:158-170` — wyjątek z `zwaliduj` (np. `SQLITE_BUSY`) wpada do zewnętrznego `catch` (`:176`). Wiadomość zostaje nieprzeczytana (to poprawne, zostanie ponowiona), ale zamówienie jest już zapisane (osobna transakcja) w statusie `nowe`, bez wyniku walidacji. Przy ponowieniu liczy się jako duplikat, więc `wynik.nowe`/„Odebrano … nowych zamówień" zaniżają liczbę.
  - Reason: semantyka „zapisane i nieoznaczone" jest spójna, bo następne wywołanie dowalidowuje zamówienie. Brakuje jednak testu tej ścieżki i widoczności zamówienia w stanie `nowe` w panelu (etykieta „nowe" bez błędu).
  - Suggestion: dodać test, w którym `zwaliduj` rzuca wyjątek. Rozważyć osobny `try/catch` wokół samej walidacji (zapis błędu o ostrzeżeniu, wiadomość oznaczona, bo zamówienie jest bezpieczne w bazie, a „Sprawdź ponownie" zostaje dostępne).
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:125` — ramka błędu twierdzi „Partner nie dostał żadnego powiadomienia" jako fakt.
  - Reason: system jest tak zbudowany, że 232 niczego nie wysyła, ale nie gwarantuje tego dla całego procesu. Ten sam e-mail/XML może być obsłużony poza Bridge, a kolejne tickety (7.5) mogą dodać powiadomienia, i napis zostanie fałszywy.
  - Suggestion: sformułować jako „Bridge nie wysyła partnerowi automatycznego powiadomienia o tym błędzie".
- [ ] `rebuild/backend/src/routes/partnerzy.ts:112-126` — nowa trasa nie ma dopisku w dokumentacji API poza `wpis-232.md`. `contract/openapi.yaml` jej nie zna (zgodne z planem, trasy `/api/partnerzy*` są poza kontraktem), ale warto sprawdzić, czy `docs/spec-backend` wymienia całą listę tras partnerów.
  - Suggestion: upewnić się, że `wpis-232.md` zawiera metodę, ścieżkę, kształt odpowiedzi (szczegóły zamówienia z `bladImportu` i `pozycje[].blad`) i kody 404.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/partnerzy/walidacja-zamowienia.ts:46` — `db.transaction` bez `behavior: "immediate"`, podczas gdy `zapiszZamowienie` używa `immediate`. W jednym procesie z synchronicznym better-sqlite3 nie ma realnego wyścigu, ale odczyt statusu i późniejszy zapis nie są chronione przed drugim procesem. Dla spójności i pod 7.5 (zmiana statusu na „wysłane") warto użyć `immediate`.
- [ ] `rebuild/backend/src/partnerzy/walidacja-zamowienia.ts:28` — dopasowanie kodu jest wrażliwe na wielkość liter i `trim` dotyczy tylko kodu z zamówienia (kod katalogowy bez `trim`). Dziś kody to cyfry, więc OK. Warto to wprost zaznaczyć w komentarzu przy późniejszej zmianie na numer katalogowy.
- [ ] `rebuild/backend/src/partnerzy/odbior-email.ts:161` — zmienna `w` (wynik walidacji) przesłania parametr `w: WiadomoscPoczty` funkcji. Zasięg blokowy chroni `w.oznaczPrzetworzona()` (`:183`), ale to pułapka przy przyszłej edycji. Zmienić nazwę, np. `wynikWalidacji`.
- [ ] `rebuild/backend/src/routes/partnerzy.ts:121` — wywołanie `audytuj` zapisuje wpis także wtedy, gdy zamówienie ma późniejszy status i walidacja jest no-op (`zmieniony:false`, `bledy:0`). Wynik jest wtedy mylący („bledy: 0" dla zamówienia, którego nie sprawdzono). Rozważyć 409 albo pole `pominiete` w odpowiedzi/audycie.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:140` — kolumna „Uwaga" jest pusta dla pozycji bez błędu; wystarczy, bo pozycja z błędem ma tekst (nie tylko kolor). Można dodać `aria-label`/`scope="col"` do nagłówków tabeli.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:128` — lista statusów `["nowe","przyjete","blad_importu"]` jest zduplikowana względem backendu (`STATUSY_DO_WALIDACJI`). Przy statusach z 7.5 trzeba pamiętać o obu miejscach. Najlepiej, żeby backend zwracał flagę `mozeWalidowac`.
- [ ] Kolumny `blad_importu` i `blad` istnieją tylko w `schema.ts` i migracji; brak ograniczenia długości (opis zbiorczy łączy wszystkie pozycje). Dla dużych zamówień opis może być bardzo długi (toast pokazuje całość). Rozważyć przycięcie w toaście.

## Plan compliance

### Done ✓
- Migracja `029` z dwiema kolumnami przez `@dodaj-kolumne-jesli-brak`. Numeracja 029 jest wolna na `origin/develop` (najwyższa to 028). README schematu i liczniki w `db.migracje.test.ts` zaktualizowane (bilans tabel i indeksów bez zmian). Jest osobny test migracji z idempotencją.
- `zwaliduj` z powodami: nieznany kod, nieaktywny, brak stanu. Wiele błędów naraz, zapis powodu per pozycja, idempotencja (powód zapisywany tylko przy zmianie), nietykalność statusów spoza `nowe`/`przyjete`/`blad_importu`. Całość w jednej transakcji, a `znajdzPozycjeKatalogu` jest jedynym punktem mapowania kodu.
- Automatyczne wywołanie po odbiorze z e-maila oraz ręczny `POST …/waliduj`. Trasa jest za `requireAuth`, sprawdza przynależność zamówienia do partnera (`szczegolyZamowieniaDlaPartnera`), więc obcy partner dostaje 404. Audyt zapisany. Odpowiedź to świeże szczegóły bez `surowyXml`.
- Panel: kolorowy status, ramka błędu, powód przy pozycji, przycisk „Sprawdź ponownie", unieważnianie cache pasujące do kluczy list i szczegółów (`zamowienia…`). Toasty sukces/błąd.
- Zgodność z kartą: zamówienie zawsze zapisane, bez powiadomienia partnera. Kontrola ceny świadomie pominięta i opisana jako follow-up.

### Missing or deviating ✗
- Brak sumowania ilości po powtarzającym się kodzie (patrz SHOULD-FIX 1) — plan mówi o „stan < zamówiona ilość" per pozycja, więc to luka funkcjonalna, nie odstępstwo.
- Brak testu wyjątku z `zwaliduj` w odbiorze e-mail oraz testu zachowania `przyjete` → `blad_importu` po zmianie stanu (świadomie lub nie).

### Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop` — nie zweryfikowane przeze mnie (pełne bramki w tle; wybrane pliki testów backendu przechodzą). Raport nie podaje wyników testów ("zob. PR").

## Parallel-test concerns

None — all tests parallelizable (testy używają `stworzSrodowiskoTestowe` z bazą w katalogu tymczasowym; test migracji 029 używa `mkdtemp`).

## Overall assessment

Zmiana jest czytelna i dobrze odizolowana: logika walidacji w jednym module, idempotentna i transakcyjna, trasa z izolacją partnerów, a decyzja z karty (zapis bez powiadomienia, brak kontroli ceny) została zachowana. Brak blockerów. Główne ryzyka to cicha luka przy zdublowanym kodzie w zamówieniu, to, że ponowna walidacja potrafi zdegradować `przyjete` do `blad_importu` wyłącznie przez zmianę stanu (bez zmiany zamówienia), oraz kategoryczny komunikat o braku powiadomienia w UI.
