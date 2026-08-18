# Rebuild backlog — zmiany produkcji do naniesienia na nową wersję

Powierzchnia kontroli nad tym, **które zmiany Ani z żywej produkcji trafiają do
odbudowywanego stosu** (`rebuild/`). Ty decydujesz per zmiana; ja opisuję i implementuję
zatwierdzone.

## Jak to działa

```
Ania zmienia produkcję → producent (commit + mail z diffem/etykietą)   [automat]
      → ja: opis biznesowy + rekomendacja (tu, w tabeli)               [Claude]
      → Ty: kolumna „Do nowej wersji?" = TAK / NIE / PÓŹNIEJ           [decyzja]
      → zatwierdzone: implementacja w rebuild/ + status DONE           [Claude Code]
```

**Zakres:** śledzimy zmiany **po snapshocie kontraktu z Fazy 2** (spec objął stan
bundla do ~2026-08-05, MD5 `b745bf95`). Wcześniejsze zmiany są już w specyfikacji.

**Legenda „Do nowej wersji?":** ⬜ do decyzji · ✅ TAK · ❌ NIE (świadomie pomijamy) · 🕒 PÓŹNIEJ
**Legenda „Status":** — nie zaczęte · 🔨 w toku · ✔ zrobione w rebuild

---

## Backlog

### #1 · 2026-08-18 · [BACKEND] · `sniegfix`

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-18 09:03 |
| **Kategoria** | BACKEND (import / parsery) |
| **Pliki** | `parsers/adapter.cjs`, `parsers/tyre_params.cjs` (kopie `*.bak_pre_sniegfix_20260818090314`) |
| **Commit** | `7bd31de` sync(vps) |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — |

**Opis biznesowy:**
Kolumna „Śnieg" (zdolność zimowa opony) w katalogu pokazywała dla części opon
bezsensowne wartości techniczne — „0.0" albo „1.0" — zamiast czytelnego „Tak"
(opona z oznaczeniem zimowym) lub pustego pola (brak oznaczenia).
Przyczyna: import traktował oznaczenie śniegu jak *ilość sztuk* (liczbę), przez co
zapisywał „0.0/1.0" zamiast flagi. Poprawka: teraz kolumna pokazuje „Tak" tylko gdy
opona faktycznie ma oznaczenie zimowe (snow/3PMSF), inaczej zostaje pusta — nigdy
liczby. Naprawione w dwóch miejscach łańcucha importu (adapter + parametry opony).

**Szczegół techniczny (dla rebuildu):**
Dodano dwie funkcje normalizujące flagę: `normalizeLabelSnowValue(rawLabelSnow, snow3pmsf)`
(adapter) i `normalizeLabelFlag(value)` (tyre_params). Zwracają wyłącznie `'Tak'` albo
`null`. Wcześniej `enriched.labelSnow ?? enriched.snow3pmsf` oraz `normalizeQty(record.labelSnow)`
wpychały surową flagę 0/1 do kolumny TEXT.

**Rekomendacja (moja):** ✅ **nanieść** — to realna poprawka poprawności danych, którą
nowy backend musi odtworzyć. Dotyczy warstwy import/adapter (kierunek A Fazy 4).
Ta sama zasada dotyczy prawdopodobnie innych pól-flag etykiety UE (`label_ice`,
`ms`, `reinforced` itd.) — do sprawdzenia przy przepisywaniu adaptera, czy nie mają
tego samego błędu „ilość zamiast flagi".

### #2 · 2026-08-18 · [BACKEND][BAZA] · `kategoriafix`

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-18 11:48 |
| **Kategoria** | BACKEND (import/adapter, klasyfikator) + BAZA (dane) |
| **Pliki** | `common.cjs`, `parsers/adapter.cjs`, `zastosowania/audit.cjs` (kopie `*.bak_pre_kategoriafix_20260818114801`) |
| **Commit** | `740b273` sync(vps) |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — |

**Opis biznesowy:**
Kategorie produktów miały **duplikaty różniące się tylko wielkością liter**
(np. „rolnicze" i „Rolnicze" jako dwie osobne kategorie) — **537 rekordów** —
co psuło statystyki i filtry w panelu. Ania scaliła je do jednej formy z wielkiej
litery (stan: Rolnicze 4533, Ciężarowe 1463, Przemysłowe 1195, Leśne 214) i naprawiła
**u źródła**, żeby nie wracały. Analogicznie ujednolicono `zastosowanie` (343 rekordy)
i dodano 5 brakujących wartości do słownika.

**Szczegół techniczny (dla rebuildu):**
- `classifyByName()` (common.cjs) zwraca teraz formy z wielkiej litery (było z małej).
- **Nowa `capitalizeKategoria()` (common.cjs)** — mapuje każdy wariant (mała/wielka,
  z/bez polskich znaków) na formę kanoniczną; wołana w **`adapter.cjs` → `recordToSurowe()`
  na KOŃCU potoku (przed zapisem)** → obejmuje wszystkich dostawców (też MO9 i hardkody
  w `tyre_params.cjs`) bez edycji każdego parsera.
- `zastosowania/audit.cjs` — słownik `SLOWNIK` ujednolicony, żeby audyt nie zgłaszał
  naprawionych wartości jako błędnych.

**Rekomendacja (moja):** ✅ **nanieść** — poprawka jakości danych + **dobry wzorzec
architektoniczny**. Potwierdza regułę: **`adapter.recordToSurowe()` to centralne miejsce
finalnej normalizacji** wszystkich pól przed zapisem (tu: kategoria; przy sniegfix: labelSnow).
Nowy adapter powinien mieć jeden blok „normalizacja końcowa" — kategoria, zastosowanie,
flagi etykiety UE — zamiast rozsypanych hardkodów po parserach.

---

*Pominięte (nie kod, brak zadania rebuild):*
- 2026-08-18 06:00 [FRONTEND] — regeneracja pliku eksportu `sellycsv-...csv` (odświeżenie
  danych, nie zmiana UI/kodu).
