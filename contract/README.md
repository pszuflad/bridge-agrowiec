# Kontrakt API — Bridge

Zamrożony kontrakt backendu — cel dla odbudowy i siatka bezpieczeństwa przy
przepisywaniu.

## Zawartość

| Plik | Co | Stan |
|---|---|---|
| `openapi.yaml` | 94 ścieżki / 111 operacji: metoda, ścieżka, auth, parametry | ✅ **zamrożone** (z zweryfikowanego inwentarza, Krok 2.3) |
| `fixtures/` | nagrane odpowiedzi GET z żywego backendu (kształt) | ✅ **Krok 2.4** — 55 GET-ów, 54×200 |

## Co jest zamrożone teraz (2.3)

Z `docs/spec-backend.md` + `01_ENDPOINTY.md` (cytaty `plik:linia`, nie pamięć):
- **ścieżki i metody** wszystkich 111 operacji,
- **auth** per operacja (`security` = wymaga JWT; brak `security` = **publiczne**),
- **parametry ścieżki** (`{id}`, `{kod}`, `{value}`, `{view}`).

## Fixtures GET (Krok 2.4 — zrobione)

`fixtures/GET_*.json` — 55 endpointów GET nagranych z żywego backendu (54×200;
`/api/atrybuty/uzycie` → 400, bo wymaga parametru query). Każdy plik:
```json
{ "endpoint": "...", "method": "GET", "status": 200, "json": true, "body": {...} }
```

**To są fixtures KSZTAŁTU, nie pełne snapshoty danych.** Duże tablice przycięto do
5 elementów (adnotacja `_body_przyciete_z` / `_przyciete`), bo celem jest zamrożenie
**struktury odpowiedzi** (pola, zagnieżdżenie, typy), nie archiwum danych, które
i tak się zmieniają. Rozmiar: 27 MB → 247 KB.

**Ustalenie kontraktowe:** API zwraca **camelCase** (`cenaZakupu`, `cenaSprzedazy`,
`marzaPct`, `kodDostawcy`), mimo że baza jest snake_case (`cena_zakupu`). Warstwa
API konwertuje — nowy backend musi to zachować.

Sanityzacja: brak sekretów (config: klucze puste; users: bez hashy; zero JWT/Bearer).

**Czego wciąż NIE ma:** POST/PUT/PATCH/DELETE (zapisujące) — świadomie pominięte,
bo modyfikowałyby produkcję. Nagramy je osobno przeciwko **kopii bazy**
(`db/snapshot.db`) w Fazie 4.

## ⚠ Uwaga bezpieczeństwa wbudowana w kontrakt

Operacje z `security: []` są **publiczne bez logowania** — to **stan faktyczny**,
nie rekomendacja. 17 tras (w tym `GET /api/export/shoper` = pełny katalog CSV,
`/api/audit-log`, `/api/history`, `/api/config`) nie ma auth. Kontrakt to
odnotowuje, żeby przy odbudowie świadomie zdecydować: domknąć auth (zalecane)
albo zachować dla zgodności. Szczegóły: `docs/spec-backend.md §2`.

## Jak używać przy odbudowie

1. Nowy backend implementuje ścieżki z `openapi.yaml`.
2. Nagrane fixtures (2.4) puszczamy na nowy backend → odpowiedzi muszą się zgadzać.
3. Rozbieżność = błąd, zanim dotknie produkcji.
