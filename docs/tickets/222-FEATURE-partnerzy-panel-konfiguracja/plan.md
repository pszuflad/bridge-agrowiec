# 222 — panel partnerów: konfiguracja (PRT-5.2)

Karta: `docs/karty/PARTNERZY/` · poziom 5 · zależy od 209 (REST), 221 (lista).

## Zakres
- Frontend: strona `/partnerzy/:id` (`PartnerSzczegoly.tsx` + `pages/partnerzy/{UstawieniaPartnera,MagazynyIWykluczenia,KrajePartnera}.tsx`), link „Konfiguruj” na liście.
- Backend (mały dodatek): `GET /api/partnerzy/magazyny` — magazyny aktywnych pozycji katalogu z liczbą pozycji, do wyboru w panelu (trasa przed `/api/partnerzy/:id`).

## Sekcje
1. **Ustawienia:** nazwa, stan minimalny, zaokrąglanie (4 reguły), harmonogram w minutach (puste = brak), tolerancja ceny %, format pliku (CSV/XML), separator CSV, kanały FTP / e-mail + skrzynka. Walidacja po stronie klienta; przecinek lub kropka w liczbach.
2. **Magazyny:** pola wyboru z listy magazynów katalogu (z liczbą pozycji); magazyn partnera, którego już nie ma w katalogu, zostaje widoczny z adnotacją „(brak w katalogu)”, żeby dało się go odznaczyć.
3. **Wykluczone produkty:** numery katalogowe po jednym w wierszu (też po przecinku/średniku; duplikaty i puste odpadają).
4. **Kraje:** tabela edytowalna (narzut %, kurs NBP/ręczny + wartość, koszty dodatkowe PLN), dodawanie kraju (kod normalizowany do wielkich liter), usuwanie z potwierdzeniem.

## Poza zakresem
Kolumny pliku i pola obliczeniowe z podglądem (PRT-5.3, wymaga tras backendu 5.3a), logi/pliki/„generuj teraz” (PRT-5.4), aktywacja zostaje na liście.

## Zmiana zachowania produkcji
Brak — nowa strona i jedna nowa trasa odczytu.

## Testy
Backend: `partnerzy.trasy.test.ts` (+1). Frontend: `partnerzy.konfiguracja.test.tsx` (14). Backend i frontend: lint, typecheck, build, testy zielone.
