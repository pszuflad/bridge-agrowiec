# Wpis 187 — staging: „Odrzuć” w szczegółach zostawia kartę i zapisuje się jak poprawka Marty

> Sesja 2026-10-05. **Nowe zachowanie, nie port — decyzja użytkowniczki.** Dotyczy
> `import/polityka/odrzucenie-zmiany.ts`, trasy `POST /api/staging/{id}/keep-card`
> (`routes/staging-polityka.ts`, `contract/openapi.yaml`) i okna szczegółów
> (`frontend/src/pages/staging/SzczegolyPozycji.tsx`).

**Po co.** Gdy plik dostawcy proponuje zmianę nazwy/modelu/marki/rozmiaru istniejącej karty na gorszą, były dwie
drogi: ręcznie wpisać starą wartość w pola edycji (zapisuje poprawkę Marty) albo „Odrzuć” z listy, które niczego nie
zapamiętuje — ta sama propozycja wracała przy następnym imporcie.

**Co jest.** W szczegółach pozycji typu `zmiana_kluczowa` jest przycisk „Odrzuć”:
1. Karta w katalogu zostaje DOKŁADNIE taka, jaka jest (żadnego zapisu na `products`).
2. Dla każdego pola tożsamości (`KEYS`: nazwa, marka, model, rozmiar, indeksy, kod dostawcy), w którym plik różni się
   od karty, powstaje poprawka Marty (`manual_overrides`) z OBECNĄ wartością karty, `acknowledgedSourceValue` = wartość
   z pliku i powodem „Odrzucona zmiana z pliku dostawcy (staging)…”. Widać ją na karcie produktu i można ją usunąć
   (`DELETE /api/overrides/{id}`) — wtedy plik znów decyduje.
3. Zgłoszenie znika (jedna transakcja). Cena zakupu i sprzedaży, marża, stan i magazyn z pliku wchodzą OD RAZU na
   kartę, z wpisem do historii cen — tak jak w cichej aktualizacji importera. Powód: importer odkłada cały wiersz do
   stagingu i nie rusza wtedy karty (`fabryka.ts`: `doStagingu` + `continue`), więc dopóki zgłoszenie czeka, cena i stan
   są nieświeże; bez tego po „Odrzuć” zostawałyby takie do następnego importu (decyzja użytkowniczki, 2026-10-05).
   Karta wstrzymana nie dostaje stanu. Tożsamość (nazwa, model…) zostaje z karty. DOT i EAN z pliku nie są stosowane.
4. Pola, które się różnią, ale karta ma je puste, nie dają poprawki (`pominietePola`). Gdy żadnego pola nie da się
   zachować albo pozycja już nie różni się od karty — odmowa 409.
5. Audyt: akcja `odrzucenie_zmiany_stagingu` (kod, zachowane, pominięte i zaktualizowane pola).

**Działa dokładnie jak każda poprawka Marty — czyli bezwarunkowo i po cichu.** Staging v2 nakłada poprawki bez alarmu
(`fabryka.ts`, `nalozPoprawki` → `chron()`): także gdy dostawca zmieni wartość jeszcze raz, karta zostaje przy wartości
z poprawki i nic nie zgłasza. (Alarm „plik chciał nadpisać poprawkę” istniał tylko w starym `tk()`.) Pokrywa to
`test/odrzucenie-zmiany.test.ts`.

**Nazwa karty (`nazwa_pamiec`, `manual_overrides`).** Poprawka `nazwa` wygrywa z plikiem i z pamięcią nazw przy imporcie
(import: plik → `nazwa_pamiec` → poprawki → reguły końcowe). Akceptacja stagingu nakłada pamięć nazw jeszcze raz, ale
poprawek nie — tu akceptacji nie ma (zgłoszenie jest usuwane), więc ten rozjazd nie dotyczy „Odrzuć”. Reguła DEMO
(`nazwa-demo.ts`) działa PO poprawkach i wygrywa z nimi — „Odrzuć” nie zdejmie dopisku „DEMO”.

**Nie ruszone.** „Odrzuć” na liście (`POST /api/staging/reject`, `DELETE /api/staging/{id}`) działa jak dotąd — kasuje
zgłoszenie bez zapamiętywania.
