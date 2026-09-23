# Wpis do spec-backend od ticketu 129 (karta I15.4c) · 2026-09-23

**Sekcja:** §2 (staging i akceptacja).

**Potwierdzone w 129** (`129-FEATURE-akceptacja-stagingu`, 2026-09-23, karta I15.4c):

1. **Bramka akceptacji ma SIEDEM blokad, nie cztery.** `staging_policy.cjs:188-200` wykonuje
   siedem wywołań `fail()`, każde ze statusem **409** i ciałem `{message}`: brak wiersza ·
   `_absenceReview` · mniej niż trzy dowody nieobecności przy wycofaniu · brak `_policyVersion` ·
   nierozstrzygnięte dopasowanie · błędny EAN · rozjazd `_catalogVersion`. **Kolejność jest częścią
   zachowania** — pozycja z kilkoma wadami zawsze zgłasza pierwszą. Odbudowa odtwarza to 1:1
   (`rebuild/backend/src/import/polityka/blokady.ts`), komunikaty zweryfikowane porównaniem ciągów
   znak w znak, zgodność potwierdzona GATE-em różnicowym na uruchomionym oryginale (23 scenariusze).

2. **Moduł polityki wystawia CZTERY trasy**, nie dwie: `GET /api/staging/{id}/review`,
   `POST /api/staging/{id}/resolve`, `POST /api/staging/{id}/choose-absence-card`,
   `POST /api/staging/{id}/close-absence-review` (`:620-664`). Dopisane do `contract/openapi.yaml`.
   **Zwracają błąd pod kluczem `message`, a nie `error`** jak pozostałe trasy stagingu — to dwa
   osobne moduły produkcji i odbudowa tej niespójności świadomie NIE ujednolica.

3. **Zatwierdzanie zbiorcze jest atomowe PER POZYCJA, nie per żądanie.**
   `deminified/backend-index.cjs:48544` woła `U.acceptStaging` w pętli **bez** `try`/`catch`
   i bez zbiorczej transakcji. Pierwsza zablokowana pozycja przerywa całe żądanie (409), audyt się
   nie zapisuje, a pozycje zatwierdzone wcześniej **zostają zatwierdzone**. Odbudowa odtwarza to 1:1.

4. **Odbudowa NIE MA globalnego error middleware**, które produkcja ma w `:48977-48982`
   (`status = e.status || e.statusCode || 500`, ciało `{message}`). Bez niego wyjątek rzucony
   w trasie wychodzi jako HTML-owe 500 Express-a. Ticket 129 odtworzył ten kształt **lokalnie**
   w `POST /api/staging/accept`; dołożenie middleware globalnie pozostaje otwarte.

5. **`_policyVersion` ustawia wyłącznie `importer()`** (`:428`, `:571`, `:588`, `:606`), a bramka
   akceptacji go wymaga (`:194`). To wiąże ścieżkę akceptacji ze ścieżką importu: bez sportowanego
   importera żadna świeżo zaimportowana pozycja nie przejdzie akceptacji.

6. **`candidates_hash` (decyzje o nieobecnych kartach) liczy się WYŁĄCZNIE z `[kod, ean, dot]`**
   każdego kandydata, posortowanych (`:260`, `:307`, `:321`). Zmiana ceny, stanu czy nazwy nie
   otwiera zamkniętej sprawy ponownie; zmiana kodu, EAN-u albo DOT-u — tak. `.sort()` jest **bez
   komparatora**, na tablicy tablic, więc porównuje reprezentacje tekstowe; od tego zależy wartość
   hasha i odtworzone jest dosłownie.

7. **Pomiar wydajności zatwierdzania zbiorczego** (kopia `db/snapshot.db`, 7405 produktów):
   **386 ms na pozycję** po Staging v2 wobec **6,7 ms** przed. 95 % kosztu to nadpisane
   `assignKodImportu` (`:141-157`), które woła `listProducts()` dla każdej pozycji i przepuszcza
   katalog przez `compatibility()`. Problem z backlogu #107 (5 s na pozycję, osobne połączenie
   w `uwaga_cena_patch.cjs`) w odbudowie **nie występuje**. Szczegóły:
   `docs/rebuild-backlog/wpis-129.md` → `#129.1`.

8. **Zamyka „stan przejściowy D4" z `wpis-120.md`.** Tamten wpis (ticket 120, karta I15.2)
   notował: *„Docelowo (D4) ma to być błąd blokujący akceptację do ręcznej poprawki."* — i to
   właśnie dowiózł ticket 129: `checkAcceptance` (`:197`) odrzuca pozycję z błędnym EAN-em,
   a odstępstwo **14i** (ciche zerowanie `ean` przy zapisie do katalogu) zostało USUNIĘTE
   z `rebuild/backend/src/import/akceptacja.ts`. **Reszta `wpis-120.md` zostaje prawdziwa** —
   opis zachowania SILNIKA importu (`tk.ts:221`, `ean: null` degraduje do pustego łańcucha,
   pozycja wchodzi pod własnym kodem dostawcy) dotyczy ścieżki importu, której ta karta nie
   dotyka; jej port to karta I15.4b.

Szczegóły: `docs/tickets/129-FEATURE-akceptacja-stagingu/`.
