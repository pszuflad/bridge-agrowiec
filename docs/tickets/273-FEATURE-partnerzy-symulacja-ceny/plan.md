# 273 — symulacja ceny partnera na prawdziwych danych (z rozbiciem składników)

Prośba 2026-10-14: „chciałam realne dane, żeby zobaczyć, czy się dobrze wylicza”. Sesja nie ma dostępu do bazy produkcji, a dziennik wdrożenia jest publiczny (nie wolno w nim pokazywać cen zakupu), więc rozbicie musi liczyć panel dla zalogowanego użytkownika.

- Backend: `src/partnerzy/symulacja-ceny.ts` + `POST /api/partnerzy/:id/symulacja-ceny` `{kraj, kody?, limit?}` (tylko odczyt). Cena końcowa pochodzi z `wycenPozycje` — tego samego kodu co generator cenników — więc symulacja i plik nie mogą się rozjechać; rozbicie dodaje: zakup PLN, marża sklepu, dopłata kraju albo nazwa reguły, narzut łączny, przesyłka GEIS (waga rozliczeniowa, próg, stawka, paliwo, pakowanie, myto, pakowanie kraju), koszty dodatkowe, kurs i jego źródło, powód braku ceny.
- Próbka: podane kody / numery katalogowe / EAN albo (domyślnie 10, maks. 50) pozycje równomiernie rozłożone po całej ofercie partnera.
- Frontend: sekcja „Symulacja ceny (prawdziwe produkty)” pod „Podglądem pliku” na stronie partnera.
- Nie zmienia danych ani nazw produktów.
