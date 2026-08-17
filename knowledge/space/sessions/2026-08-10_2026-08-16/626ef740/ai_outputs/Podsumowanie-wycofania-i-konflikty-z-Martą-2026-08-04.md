# Podsumowanie: mechanizm wycofań i wyjaśnienie konfliktów z poprawkami Marty (2026-08-04)

## Co zostało wdrożone

1. **Mechanizm N-potwierdzeń (próg=3) dla wycofań** — pozycja jest oznaczana jako "wycofana" w stagingu tylko po 3 kolejnych importach bez jej obecności w pliku dostawcy (wcześniej wystarczał 1 dzień), co eliminuje fałszywe wycofania z powodu jednorazowych błędów w plikach dostawców. Zmiana w `index.cjs`, funkcja `tk()`, nowa kolumna `products.nieobecnosc_pod_rzad`.
2. **Wyczyszczono kolejkę wycofań**: usunięto 95 pozycji z dowodem powrotu do cennika, następnie odrzucono (przez `staging_items` DELETE + wpis `audit_log`, analogicznie do `/api/staging/reject`) pozostałe 550 pozycji na wyraźną prośbę użytkownika — produkty pozostały aktywne w bazie.
3. **Wyjaśniono i naprawiono komunikat o konfliktach z override Marty**: stary tekst ("plik nadpisuje poprawkę Marty") był mylący — w rzeczywistości override Marty **zawsze wygrywa** (funkcja `Gq()`), plik dostawcy nigdy nie nadpisuje pól chronionych. Nowy komunikat w stagingu pokazuje wartość Marty vs wartość z pliku i wyjaśnia, że akceptacja tylko "wygasza" powtarzające się ostrzeżenie (przez `acknowledgedSourceValue`), nie zmienia danych.
4. **Masowa akceptacja 11587 pozycji "błąd"** (wszystkie miały identyczną przyczynę: konflikt kategorii/nazwy z override Marty) — wykonana na wyraźną prośbę użytkownika przez prawdziwy mechanizm `acceptStaging()` (stan/cena zaktualizowane z plików dostawców, override Marty zachowany).
5. Backup bazy i kodu wykonany przed każdą operacją; zmiany zweryfikowane (`node --check`, restart PM2, sprawdzenie liczby rekordów).

## Pliki backup w tym repo
`backup_kod_produkcyjny/index.cjs_2026-08-04_wycofania-override-fix.txt`

## Otwarte pytania / kolejne kroki
Brak — wszystkie zlecone zadania z tej sesji zostały zakończone. Historyczne 6214+ wpisów "błąd" z sesji poprzednich (przed masową akceptacją) już nie istnieją w kolejce.
