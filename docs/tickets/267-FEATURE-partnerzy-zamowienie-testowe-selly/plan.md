# 267 — zamówienie testowe do sprawdzenia „Utwórz w Selly”

W panelu partnerów nie ma żadnego zamówienia, więc nie da się przetestować utworzenia zamówienia w Selly. Decyzja 2026-10-14: założyć przykładowe zamówienie, wysłać do Selly, a użytkowniczka usunie je w Selly.

- Krok wdrożenia `2026-10-14-partnerzy-zamowienie-testowe-selly` (tylko produkcja): zamówienie `TEST-SELLY-20261014` w panelu Adtyres — 1 szt. aktywnego produktu na stanie z jednoznacznym powiązaniem Selly (produkt + wariant), 10 EUR, kraj DE, odbiorca „TEST - do usuniecia”.
- Idempotentne (po numerze); brak partnera albo pasującego produktu → krok odłożony.
- Po teście zamówienie usuwa się w Selly ręcznie; w Bridge zostaje jako ślad.
