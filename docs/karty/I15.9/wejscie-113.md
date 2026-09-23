# Wejście dla I15.9 od ticketu 113 (koordynator) · 2026-09-23 — co Ania zobaczy po odświeżeniu stagingu

Staging dostał 23.09 świeżą kopię bazy produkcji (8329 produktów). Przy pierwszym starcie backendu w logu:

```
[atrybuty] start: usunięto z kolejki 526 pozycji obecnych w słowniku
```

To **nasze świadome odstępstwo z karty P7.2** (#40, sprzątanie kolejki atrybutów: pozycja, której wartość jest już
w słowniku, znika zamiast podpowiadać samą siebie ze 100%). Na realnych danych produkcji znika **526 pozycji** —
Ania zobaczy wyraźnie krótszą kolejkę „Do akceptacji”. **Do opisania w delcie**, żeby nie zgłosiła tego jako utraty
danych: krótko — co zmieniliśmy, co zobaczy, że nic nie zostało usunięte z katalogu.

Druga rzecz do wzmianki: na stagingu **scheduler importu jest wyłączony** (`IMPORT_SCHEDULER` nie jest ustawione —
widoczne w logu startu). Automatyczne pobieranie cenników po URL tam nie chodzi; import trzeba wywołać ręcznie
(„Synchronizuj teraz” albo wgranie pliku). Jeśli scenariusz testowy Ani tego dotyczy, trzeba ją uprzedzić albo
poprosić Pawła o włączenie flagi na czas testów.
