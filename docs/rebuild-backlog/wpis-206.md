# Wpisy backlogu od sesji 206 · 2026-10-09

Decyzje użytkowniczki po audycie z 07.10 (zadanie 8). Statusy wpisów #173.x / #175.x poniżej; sami edytujemy tylko linie `Status` i `Do nowej wersji?` w oryginałach.

- **#173.1 (karty AUTO):** ✅ decyzja — usunąć wszystkie; realizuje krok `2026-10-09-usun-karty-auto` (ticket 206). Pozycje obecne w pliku wpadną jako nowe i przejdą weryfikację.
- **#173.2 (HS5 → 5):** ✅ zamknięte jako „obsłużone ręczną poprawką” dla `CCCR22538555KCH50`. Przyczyna w parserze legacy zostaje — wrócić, jeśli pojawi się kolejna karta z utraconym znacznikiem.
- **#175.1 (znaczniki KMAX D/S, CEAT SB/CFO/CHO):** decyzja — bez zmian (nazwy kart się różnią).
- **#175.2 (dwie karty o tym samym EAN):** ⏳ do sprawdzenia w Selly. Konkretne pozycje (MO5, plik `agrowiec_mw`; w pliku EAN wariantu DOT ma końcówkę `W2`, importer ją zdejmuje):
  CEAT 315/60 R22.5 WINMILE-S: `CTCR22531560LWES0` (kod producenta 113287, EAN 8904288108224, DOT 2024, 926,10) i `CTCR22531560LWES1` (113287W2024, DOT 2024, 804,58);
  Fulda 285/70 R19.5 ECOTONN: `GFCR19528570JETN0` (580182, EAN 4038526059871, DOT 2025,2026, 1128,57) i `GFCR19528570JETN1` (580182W2020, DOT 2020, 822,22).
  Uwaga do kodu: mapowanie ma klucz `kod_importu`+`dostawca`, ale karta BEZ mapowania szuka produktu w Selly najpierw po EAN (`discovery.ts`, krok 2).
- **#175.3 (zmiana symbolu razem z DOT):** ⏳ czeka na porównanie dwóch pobrań tego samego cennika z różnych dni (MO5 `agrowiec_mw`, MO4 `agrowiec_wr`, MO1 `bohnenkamp`); mamy zrzuty z 2026-10-01.
