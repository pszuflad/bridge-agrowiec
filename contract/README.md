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

**Dwie kategorie tras trwale bez fixtures** (Iteracja 8, `28-FEATURE-selly-eksport-backend`,
2026-09-04) — nie chodzi o zaległość do domknięcia, tylko o strukturalny brak: nagrywarka
zapisywała wyłącznie JSON, więc `GET /api/export-shoper` i `GET /api/export/shoper`
(`text/csv`/`application/zip`) nie mają i nie mogą mieć fixture'a — pokrycie idzie przez
kontrakt + test formatu bajtowego. `POST /api/selly/{producers,categories,sync-product,
sync-supplier}` wołają zewnętrzne API Selly — nagranie zmieniałoby cudzy sklep; pokrycie
przez kontrakt + testy na atrapie klienta (`rebuild/backend/test/gate/selly-atrapa.ts`).

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

Mechanizm z punktów 2-3 już istnieje jako harness **GATE** (`rebuild/backend/test/gate/`,
funkcje `sprawdzZgodnoscZFixture` i `sprawdzZgodnoscZKontraktem`), odpalany przez `npm test`
w `rebuild/backend` i wpięty w CI — kolejne iteracje dokładają tylko ścieżki/fixtures, nie
budują harnessu od nowa. Szczegóły: `rebuild/backend/README.md`.

**⚠ Ograniczenie kontraktu (odkryte w Iteracji 1):** `openapi.yaml` (2.3) zamraża ścieżki,
metody, `security` i kody odpowiedzi, ale **nie zawiera schematów ciał** — request body to
`{type: object}`, a odpowiedzi mają tylko `description`. Walidacja „wg kontraktu" w GATE
sprawdza więc istnienie ścieżki+metody, zadeklarowany kod statusu i JSON-owatość odpowiedzi;
**kształt ciała weryfikują wyłącznie fixtures**. Nie czytaj „zgodne z openapi" jako gwarancji
kształtu odpowiedzi.

**Rozjazd kontrakt ↔ produkcja:** `GET /api/me` ma w kontrakcie `security: []` i kody 200/400,
ale produkcja realnie zwraca **401** bez tokenu — oryginał chroni tę trasę ręcznym `if (!req.user)`,
nie wspólnym middlewarem `we`, więc inwentarz 2.3 uznał ją za publiczną. To samo dotyczy 401
z `POST /api/login`. Wzorcem przy odbudowie jest zachowanie produkcji, nie deklaracja kontraktu.
