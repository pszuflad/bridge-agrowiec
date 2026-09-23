# Wejście dla I15.11 od ticketu 129 (karta I15.4c — akceptacja) · 2026-09-23

Backend ścieżki decyzji użytkownika jest gotowy. Panel ma co wołać — poniżej kontrakt.

## Cztery trasy, nie dwie

Pierwotny opis karty I15.4c wymieniał `review` i `resolve`. `registerRoutes`
(`staging_policy.cjs:620-664`) ma **cztery** i wszystkie są wdrożone oraz opisane
w `contract/openapi.yaml`:

| Trasa | Ciało | Odpowiedź |
|---|---|---|
| `GET /api/staging/{id}/review` | — | materiał do przeglądu (niżej) |
| `POST /api/staging/{id}/resolve` | `{action: "link"\|"new", targetCode}` | `{ok, id, kod}` — **`id` NOWEGO zgłoszenia** |
| `POST /api/staging/{id}/choose-absence-card` | `{selectedCode, candidateVersion}` | `{ok, kod}` |
| `POST /api/staging/{id}/close-absence-review` | — | `{ok, kod}` |

## ⚠ Trzy rzeczy, które zaskoczą przy pisaniu UI

**1. Klucz błędu to `message`, NIE `error`.** Reszta tras stagingu
(`POST /api/staging/accept`, `PUT /api/staging/{id}`…) odpowiada `{error}`. Te cztery odpowiadają
`{message}`, bo w produkcji to osobny moduł. **To jest wierne odtworzenie i nie zostanie
ujednolicone** — obsługa błędów w panelu musi znać oba kształty.

**2. Rozstrzygnięcie ZMIENIA `id` zgłoszenia.** `POST /resolve` nie edytuje wiersza: kasuje go
i zakłada nowy (`:243-248`). Komentarz oryginału mówi po co: *„Fresh id invalidates old browser
selections."* Panel **musi** odświeżyć listę po rozstrzygnięciu — zaznaczenie po starym `id`
wskazuje nieistniejący wiersz. To samo dotyczy każdego nowego importu dla tej samej pary
`(dostawca, kod)`.

**3. Blokady akceptacji oddają 409, a zbiorcze zatwierdzanie przerywa się na pierwszej.**
`POST /api/staging/accept` woła akceptację w pętli **bez** `try`/`catch`
(`deminified/backend-index.cjs:48544`). Pierwsza zablokowana pozycja kończy całe żądanie kodem 409
z `{message}`, **audyt się nie zapisuje**, a pozycje zatwierdzone wcześniej **zostają
zatwierdzone** (każda ma własną transakcję). Odtworzone 1:1. Panel nie powinien zakładać, że
„409 = nic się nie stało" — po takiej odpowiedzi trzeba przeładować listę.

## Kształt `GET .../review`

```
{ id, kod, nazwa, powod, matchIssue, absenceReview, absenceEvidence,
  duplicateSource, sourceConflict, eanIssue,
  incoming: { marka, model, rozmiar, dot, ean, stan, status },
  candidates: [ { ...pola kandydata ze snapshotu,
                  catalogStan, status, catalogDot, catalogVersion,
                  selectable, sameEan, sameDot } ] }
```

- **`incoming.stan` i `incoming.status` pochodzą z PRODUKTU W KATALOGU**, nie ze snapshotu
  (`:630`). Reszta `incoming` jest ze snapshotu. To celowe: panel pokazuje obok siebie
  „co przyszło z cennika" i „co stoi dziś w katalogu".
- **`candidates[].status` to status ŻYWEJ karty kandydata**, nadpisany na kopii jego snapshotu.
- **`selectable` i `sameDot` niosą TĘ SAMĄ wartość** — trójstronną zgodność DOT (zapamiętany DOT
  kandydata = DOT jego żywej karty = DOT starej karty). To nie jest pomyłka w porcie, tylko
  `sameDot: selectable` w oryginale (`:637`).
- **`catalogVersion` podaje się z powrotem** jako `candidateVersion` w `choose-absence-card`.
  Nieaktualny odcisk daje 409 „Karta z bieżącej oferty została zmieniona. Odśwież cennik." —
  to jest zabezpieczenie przed decyzją podjętą na nieświeżych danych.

## Semantyka `choose-absence-card` (backlog #106)

- `selectedCode` **równe kodowi zgłoszenia** → STARA karta przejmuje bieżącą ofertę, kandydat
  zostaje wstrzymany, a jego kod zapamiętuje się jako `selected_source_code`. Wymaga świeżego
  odczytu oferty (stan + cena) i **dokładnie jednego** wybieralnego kandydata.
- `selectedCode` **inne** → kandydat przejmuje ofertę, stara karta zostaje wstrzymana,
  `selected_source_code` jest zerowany.
- `close-absence-review` → nic nie scala, stara karta zostaje wstrzymana, sprawa zamknięta.

Sprawa **nie wraca** przy kolejnym imporcie, dopóki nie zmieni się kod, EAN albo DOT któregoś
kandydata — `candidates_hash` liczy się właśnie z tej trójki. Zmiana ceny czy stanu jej nie wskrzesza.

## Komunikaty blokad — do pokazania użytkownikowi dosłownie

Wszystkie z 409, kopiowane znak w znak z produkcji. Najczęstsze przy akceptacji:
„To zgłoszenie pochodzi ze starego importu. Odśwież cennik przed akceptacją." ·
„Najpierw rozstrzygnij dopasowanie opony przyciskiem „Rozstrzygnij"." ·
„Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją." ·
„Ta stara karta wymaga porównania z bieżącą ofertą. Nie można automatycznie zmienić jej w inną
oponę ani wstrzymać." · „Produkt zmienił się po utworzeniu zgłoszenia. Wczytaj aktualny cennik;
stare dane nie zostały zapisane."

Pełna lista z numerami linii: `rebuild/backend/src/import/polityka/blokady.ts`.

## Wydajność, o której warto wiedzieć projektując UI

Zatwierdzanie zbiorcze kosztuje **ok. 386 ms na pozycję** (zmierzone na kopii produkcji, 7405
produktów). Zatwierdzenie całego stagingu (~2500 pozycji) to **ok. 16 minut** jednego żądania HTTP.
To zachowanie produkcji, nieoptymalizowane świadomie (`docs/karty/I15.4c/karta.md`, pomiar #107).
**Panel powinien to uwzględnić** — pasek postępu, porcjowanie albo ostrzeżenie; inaczej Ania zobaczy
zawieszoną przeglądarkę i timeout proxy.
