# Wpis do spec-backend od ticketu 205 (Tor 3: rotacja po sierotach) · 2026-10-09

- **Błąd (wykryty na produkcji 09.10):** Tor 3 przy każdym przebiegu brał te same 20 najstarszych sierot (`ORDER BY id LIMIT 20`). Sieroty pomijane przez kontrolę
  tożsamości zostają w `selly_products`, więc te same 20 blokowały wszystkie następne — przy 178 sierotach usunięto jedną, reszta nigdy nie była sprawdzana.
- **Poprawka** (`selly/rest/sync-usuwanie.ts`): kursor rotacji osobno dla każdej bazy (pamięć procesu). Każdy przebieg sprawdza do `LIMIT_SPRAWDZEN_NA_PRZEBIEG` (60)
  kolejnych sierot od miejsca, w którym skończył poprzedni (z zawinięciem na początek) i kończy po `LIMIT_NA_PRZEBIEG` (20) USUNIĘCIACH (albo limicie dobowym).
  Pominięte nadal zostają w tabeli — nic nie jest usuwane bez potwierdzenia tożsamości. Po restarcie kursor startuje od początku.
- Skutek uboczny: wpis dziennika z przebiegu może mieć do 60 pozycji (przycinane do poprawnego JSON-a przez `szczegolyDoZapisu`).
- Sieroty, które NIGDY nie przejdą kontroli (brak znanego EAN-u i nazwy w historii, albo EAN/nazwa w Selly się różni), pozostaną w liczniku „Produkty do usunięcia teraz”;
  to nie błąd — wymagają decyzji człowieka (usunięcie ręczne w Selly albo uzupełnienie historii).
