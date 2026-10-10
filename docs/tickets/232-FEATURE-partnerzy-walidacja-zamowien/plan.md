# 232 — walidacja zamówień partnera: nieznany kod i brak stanu (PRT-7.4a)

> Status: Approved (użytkownik 2026-10-10: „rób kolejny ticket, który nie wymaga Marty”, pracujemy autonomicznie) · Gałąź: `claude/peaceful-gates-a8yebr`

Karta: `docs/karty/PARTNERZY/` · poziom 7 · zależy od 228–231. Część PRT-7.4, która nie czeka na numer katalogowy ani na wartość tolerancji cenowej.

## Zakres
- Migracja `029_partner_zamowienia_walidacja.sql`: `partner_zamowienia.blad_importu` (opis zbiorczy) i `partner_zamowienia_pozycje.blad` (powód per pozycja) — dwie kolumny przez `@dodaj-kolumne-jesli-brak`.
- `src/partnerzy/walidacja-zamowienia.ts` — `zwaliduj(db, zamowienieId)`: dla każdej pozycji szuka produktu po `CODE` (dziś `products.kod`, UNIKALNE — jedna funkcja `znajdzPozycjeKatalogu`, którą łatwo przestawić na numer katalogowy `KK PP NNNNN`
  po decyzji Marty) i sprawdza: **nieznany kod**, **produkt nieaktywny** (`status ≠ 'aktywny'`), **brak stanu** (`stan < zamówiona ilość`). Wynik: status `przyjete` (wszystko w porządku) albo `blad_importu`
  (z opisem w `blad_importu` i powodem przy każdej błędnej pozycji). Zamówienie ZAWSZE zostaje zapisane — nic nie ginie przed Selly.
- Wywołanie: automatycznie po zapisie nowego zamówienia z e-maila (229/231) oraz ręcznie `POST /api/partnerzy/:id/zamowienia/:zamowienieId/waliduj` (po poprawieniu katalogu człowiek ponawia walidację).
  Walidacja tyka WYŁĄCZNIE zamówień w statusie `nowe`, `przyjete` lub `blad_importu`; późniejsze statusy (np. wysłane do sklepu, 7.5) są nietykalne.
- Panel: status w kolorze (`blad_importu` wyróżniony), opis błędu przy zamówieniu, powód przy pozycji, przycisk „Sprawdź ponownie”.
- **Nie wychodzi żadne powiadomienie do partnera** (decyzja z karty).

## Decyzje (samodzielnie, do potwierdzenia)
- Zasada „zamówienie z błędem wpada ze statusem `blad_importu`, bez powiadomienia partnera” jest w karcie zapisana dla ceny; dla nieznanego kodu i braku stanu karta mówi „zakładane: ta sama zasada — do potwierdzenia”. Wdrażamy ją, bo jest odwracalna i niczego nie wysyła na zewnątrz.
- Stan: wystarczy `stan ≥ ilość` pozycji katalogu o danym kodzie (kod jednoznacznie wskazuje magazyn).
- **Poza zakresem: kontrola ceny/tolerancji** — wymaga decyzji o wartości tolerancji i zasady dla ceny wyższej (karta, „Otwarte” pkt 2) oraz zapisu ceny z ostatniego cennika.

## Kontrakt i fixtures
Brak (nowa trasa poza `openapi.yaml`; istniejące bez zmian). Migracja dokłada kolumny do tabel z ticketu 228 (puste na produkcji).

## Testy
Backend: moduł walidacji (każdy powód, wiele błędów naraz, idempotencja, przejście `blad_importu` → `przyjete` po uzupełnieniu stanu, nietykalność późniejszych statusów), integracja z odbiorem e-mail, trasa. Migracja 029 (test + liczniki). Frontend: MSW (status, błąd, powód przy pozycji, ponowna walidacja).

## Poza zakresem
Cena/tolerancja, mapowanie na numer katalogowy, wysyłka do Selly (7.5), powiadomienia.

## Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop`
