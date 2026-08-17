# Session 1f18be52 (2026-07-16 09:41 UTC) — 1 turns

**Session UUID:** 1f18be52-9eb7-426d-87b1-c189d8023df7

1. [2026-07-16 09:41 UTC] [line 9] cczyszczenie atrybutów

---

## Turn 1 — 2026-07-16 09:41 UTC
### Query
cczyszczenie atrybutów

### Answer
W kontekście Bridge „czyszczenie atrybutów” to operacje na słowniku atrybutów w module atrybuty (rodzaje i wartości), wykonywane przez istniejące endpointy backendu i UI, a nie osobny „cleanup job”.
Rodzaje atrybutów: tabela atrybutyrodzaje (np. marka, kategoria, zastosowanie, konstrukcja, vfIf, bieżnik, rodzaj).
Wartości atrybutów: tabela atrybutywartosci (konkretne marki, kategorie, zastosowania itd.).
Rodzaje core (wbudowane) są chronione flagą core=1 i nie można ich usuwać, ale można zmieniać im label/opis.
Wartości powiązane z rodzajem mają FK z ON DELETE CASCADE, więc usunięcie rodzaju non‑core usunie też jego wartości.

Backend ma już pełny CRUD, z którego korzysta panel „Atrybuty”:
GET api/atrybuty – zwraca całe drzewo rodzajów i wartości (do przeglądu stanu przed czyszczeniem).
GET api/atrybuty/rodzaje – lista rodzajów z flagą core (widać, czego nie wolno usuwać).
POST api/atrybuty/rodzaje – dodanie nowego rodzaju (non‑core) w razie potrzeby refaktoryzacji.
PUT api/atrybuty/rodzaje/:value – zmiana label/opisu rodzaju (np. ujednolicenie nazewnictwa).
DELETE api/atrybuty/rodzaje/:value – usunięcie rodzaju non‑core (z kaskadowym usunięciem jego wartości).
GET api/atrybuty/wartosci?rodzaj=... – podgląd wartości danego rodzaju (np. duplikaty, literówki).
POST api/atrybuty/wartosci – dodanie poprawnej wartości (np. prawidłowa pisownia marki).
PUT api/atrybuty/wartosci/:id – zmiana istniejącej wartości (scalenie, korekta literówek).
DELETE api/atrybuty/wartosci/:id – usunięcie nieużywanej/błędnej wartości.

Wszystkie operacje są logowane w auditlog, więc operacyjne „sprzątanie” jest audytowalne.

Najczęstszy przypadek to porządkowanie literówek i duplikatów (np. „Michelin”, „Michellin”):

1. Przegląd wartości dla rodzaju marka przez GET api/atrybuty/wartosci?rodzaj=marka albo przez panel „Atrybuty”.
2. Dodanie jednej poprawnej wartości, jeśli jej brakuje (POST).  
3. Podmiana powiązań produktów na poprawną wartość (to jest logika po stronie mappera/importu lub osobnego skryptu – w obecnym kodzie nie ma automatu w module atrybutów, więc trzeba to uwzględnić w konkretnej poprawce).
4. Usunięcie starych, błędnych wartości przez DELETE (po upewnieniu się, że nie są już używane).  

Dodatkowo, po wprowadzeniu nowego rodzaju zastosowanie i jego seed‑listy (ciągnik, kombajn itd.), czyszczenie może oznaczać ujednolicenie pól products.zastosowanie tak, by zawsze używać wartości z atrybutywartosci zamiast wolnego tekstu.



Na jaki dokładnie „cleanup” atrybutów patrzysz teraz: porządkowanie listy marek/zastosowań (literówki, duplikaty), czy raczej usuwanie całych, niepotrzebnych rodzajów atrybutów?

---
