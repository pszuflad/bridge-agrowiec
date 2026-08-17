# Kontrakt API — Bridge

Zamrożony kontrakt backendu — cel dla odbudowy i siatka bezpieczeństwa przy
przepisywaniu.

## Zawartość

| Plik | Co | Stan |
|---|---|---|
| `openapi.yaml` | 94 ścieżki / 111 operacji: metoda, ścieżka, auth, parametry | ✅ **zamrożone** (z zweryfikowanego inwentarza, Krok 2.3) |
| `fixtures/` | nagrane pary żądanie↔odpowiedź z żywego backendu | 🔲 **Krok 2.4** — jeszcze puste |

## Co jest zamrożone teraz (2.3)

Z `docs/spec-backend.md` + `01_ENDPOINTY.md` (cytaty `plik:linia`, nie pamięć):
- **ścieżki i metody** wszystkich 111 operacji,
- **auth** per operacja (`security` = wymaga JWT; brak `security` = **publiczne**),
- **parametry ścieżki** (`{id}`, `{kod}`, `{value}`, `{view}`).

## Czego jeszcze NIE ma (celowo — Krok 2.4)

**Kształtów request/response nie zmyślam.** Zostaną zamrożone przez **nagranie
rzeczywistych odpowiedzi** z żywego backendu (potrzebny token logowania):
dla każdego GET-a zapiszemy realną odpowiedź do `fixtures/`, a przy przepisywaniu
nowy backend będzie musiał zwrócić identyczny kształt. To jest właściwy „dowód",
że kontrakt opisuje rzeczywistość — nie nasze wyobrażenie.

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
