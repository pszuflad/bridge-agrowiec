# Agrorami: naprawa transportu MO9, ticket 183

## Diagnoza 02.10.2026

Alerty 03:14–07:14 CEST: `AbortError` w `_generateToken()` → `_gqlFetch()` w legacy `mo9_agrorami_api.cjs`.
Legacy ma timeout 30 s; wcześniejszy ticket 179 zmienił timeout pobierania CSV, nie tego API.
Z VPS odtworzono: logowanie pod `/graphql?store=pl` przekracza 45 s; identyczna mutacja pod `/graphql`
zwraca token (od 0,3 s do 10,8 s). Zapytanie `customer` z tokenem działa.
Natomiast `products` zwraca HTTP 200 z GraphQL `Internal server error`, również minimalne zapytanie
o `total_count` i niezależnie od filtra kategorii 148 / wyszukiwania BKT. To potwierdzony błąd
API dostawcy dla tego konta; nie można przesądzić, czy dotyczy wszystkich jego klientów.

## Zmiany

- `rebuild/backend/src/import/agrorami-worker.cjs`: parametr `store` przeniesiony do nagłówka `Store`;
  osobny timeout 120 s na próbę, do 3 prób, odstępy 2 i 4 s. Ponawiane: sieć/timeout,
  HTTP 429/5xx, GraphQL `Internal server error`. Błąd auth przekazywany legacy do odnowy tokenu.
  Żaden token, hasło ani body zapytania nie trafia do komunikatu.
- `src/import/parsuj.ts`: `parsujAgrorami()`, asynchroniczny `execFile`, limit 600 s całości, 64 MB.
  Istniejący adapter i `feed_safety` pozostają źródłem mapowania oraz kontroli kompletności.
- `src/import/synchronizuj.ts`: synchronizacja MO9 używa `await parsujAgrorami()`. Nie blokuje
  event loop panelu podczas komunikacji z API. Plik CSV pozostaje archiwizowany, ale nadal nie
  jest źródłem stanów i cen Agrorami.
- `scripts/copy-parsery.mjs`: worker dodany do release. Legacy pozostaje bajtowo nietknięte.
- `test/agrorami-transport.test.ts`: URL/nagłówki, sieć, timeout, 429/503, GraphQL internal,
  auth i brak sekretów w komunikacie.

Synchronizacja dostawcy (automatyczna i przycisk synchronizacji) korzysta z nowego transportu.
Stary synchroniczny `parsujPlik("MO9", ...)` pozostawiono dla charakteryzacji i ścieżki importu plikowego;
nie jest naprawą ręcznego uploadu MO9.

## Wynik wdrożenia

Użytkowniczka zatwierdziła wdrożenie 02.10 o 08:18 CEST. [PR 251](https://github.com/pszuflad/bridge-agrowiec/pull/251)
scalono do develop, [PR 252](https://github.com/pszuflad/bridge-agrowiec/pull/252) do main.
[Deploy produkcyjny](https://github.com/pszuflad/bridge-agrowiec/actions/runs/36973145682) zakończył się sukcesem:
release `8f5b9d6`, 08:22 CEST.

API Agrorami wróciło do działania jeszcze przed wdrożeniem (udany import starym kodem o 08:14).
Nie przypisujemy ustąpienia ich `Internal server error` wyłącznie naszej poprawce ani nie twierdzimy,
że parametr URL był jedyną przyczyną awarii.
Po wdrożeniu automatyczny import MO9 o 08:22:57: 929 produktów, 657 automatycznych aktualizacji,
12 pozycji kluczowych/błędów stagingu (nie błędów połączenia).
Dodatkowy pełny test `parsujAgrorami()` na prod: 929 rekordów, 0 błędów parsera,
123 odrzucone przez parser, 68 przez adapter; `meta.complete=true`, `rawCount=997`, 38,5 s.
Surowy pull: API `totalCount=1120`, po parserze 997 rekordów i 0 błędów.
Lokalne lint/typecheck/build oraz CI zielone; 2098 testów passed, 7 skipped.

## Bezpieczeństwo

Bez zmian w Selly i bez masowych poprawek danych. Nie stosujemy starego CSV jako zastępstwa API.
Jeśli GraphQL products nie odpowiada poprawnie, katalog i staging pozostają nienaruszone.
Przed edycją kopie w `/tmp/bridge-backups-183/`; źródła wersjonowane w Git.
