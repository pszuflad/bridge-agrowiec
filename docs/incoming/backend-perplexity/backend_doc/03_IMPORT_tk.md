# 03. Silnik importu `tk()`

## Źródło i sygnatura

Aktualnie działająca definicja to `tk = function(t, e)` (`/tmp/bridge_be/be.cjs:47584-47851`), po wcześniejszej definicji `function tk(t, e)` (`47378-47583`). W obu przypadkach sygnatura ma dwa argumenty: `t` (kod dostawcy) i `e` (iterowalne surowe rekordy). Końcowe przypisanie na linii 47584 jest wersją obowiązującą.

## Diagram decyzyjny wynikający z kodu

```text
tk(dostawca t, rekordy e)
  pobierz products o dostawca=t; zbuduj mapy po kodzie i EAN
    [47598-47615]
  dla każdego rekordu:
    filtr śmieci MO2: kod 999991 + brak EAN / pusta lub "rozmiarowa" marka -> odrzuć
      [47619-47634]
    dopasuj najpierw po kodzie, a gdy brak — po EAN [47636-47642]
    brak kodu:
      jeśli istnieje dopasowany produkt -> użyj jego kodu
      w przeciwnym razie, jeśli EAN -> EAN jako kod
      inaczej, tylko dla wykrytej opony -> identyfikator techniczny Lq(...)
      gdy nie można wygenerować -> odrzuć „brak danych”
      [47643-47671]
    zastosuj Gq(...) (manual_overrides), potem Zc(...) (czy opona)
      [47673-47683]
    nie-opona -> odrzuć; jeżeli odpowiada produkt istniejący, usuń go [47683-47690]
    Hq(...) normalizuje pozycję/EAN/rozmiar [47692-47696]
    brak istniejącego T:
      dodaj staging: `nowa`, albo `blad` gdy EAN błędny / nazwa błędna /
      brak rozmiaru / techniczny kod / konflikt EAN [47710-47738]
    istniejący T:
      porównaj pola kluczowe i konflikty poprawek [47740-47758]
      jeżeli zmiana kluczowa albo błąd -> staging `zmiana_kluczowa`/`blad` [47765-47790]
      w przeciwnym razie, jeżeli zmieniła się wyłącznie cena/sprzedaż/marża/stan/magazyn:
        auto-zatwierdź UPDATE products oraz wpisz historia_cen [47760-47805]
      inaczej -> bezZmian [47805]
  dla produktu katalogowego nieobecnego w imporcie:
    zwiększ nieobecnosc_pod_rzad; po 3 importach dodaj staging `wycofana`,
    a licznik wyzeruj [47807-47847]
  transakcyjnie U.addStaging dla wszystkich; zwróć liczniki [47848-47851]
```

## Reguły i dane szczegółowe

* Klasyfikator `Zc` najpierw wyklucza bieżnikowane, koła/zawory/oringi/obręcze/ochraniacze, dętki oraz listę akcesoriów; następnie uznaje oponę po słowie kluczowym, wymiarze lub kategorii (`/tmp/bridge_be/be.cjs:47061-47106`).
* Kod zastępczy: gdy brakuje kodu, bieżąca wersja najpierw korzysta z kodu dopasowanego produktu, następnie z EAN, a bez obu — z `Lq(t, ...)` wyłącznie dla opony (`/tmp/bridge_be/be.cjs:47643-47671`). Dokładny algorytm `Lq` nie został tu rozwinięty, bo nie jest częścią funkcji `tk`; **NIEZNANE** bez osobnej analizy jego definicji.
* `Gq(t, ...)` zwraca pozycję, listę naruszonych ręcznych poprawek oraz wartości źródłowe; przy konflikcie `tk` zachowuje wartość Marty i zapisuje konflikt do `snapshotJson` (`/tmp/bridge_be/be.cjs:47673-47681`, `47740-47741`). Zatem ręczna blokada nie jest „domysłem”: wywołanie i zachowanie są widoczne w kodzie.
* Nowy EAN może zostać automatycznie zmieniony tylko jeśli ma długość 8/12/13/14 i (o ile stary EAN nie jest pusty) nie kończy się pięcioma zerami (`/tmp/bridge_be/be.cjs:47503-47512`).
* Wycofanie nie następuje po jednym braku: stała `WYCOFANIE_PROG_IMPORTOW = 3` (`/tmp/bridge_be/be.cjs:47807-47847`).
* `kod_importu` nie jest liczony w samej pętli `tk`; przy zapisie produktów nadaje go `__BRIDGE_EXT.assignKodImportu` (`/tmp/bridge_be/be.cjs:44790-44792`, `44903-44904`). Ten helper zachowuje istniejący 6-cyfrowy kod, następnie szuka grupy po prawidłowym EAN, a bez prawidłowego EAN po marka+rozmiar+bieznik+nazwa (`/home/admin/private_apps/bridge/bridge_ext.cjs:147-169`).
