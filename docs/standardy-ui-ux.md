# Standardy UI/UX — wyciąg z dokumentu „Bridge ONE — standardy UI/UX”

Źródło: dokument przekazany 2026-09-30, opisujący panel produkcyjny (bundle `index-Dg-iqfJ2.js`).

**To opis produkcji, nie źródło prawdy.** Przy każdej rozbieżności wygrywa żywy bundle
z `mirror/frontend/index.html` i fixtures (zasada 1:1 z `CLAUDE.md`). Ten plik służy jako lista
kontrolna przy sprawdzaniu widoków, a nie jako nowe wymagania.

Świadomie pominięte z oryginału: zamiana `alert()`/`confirm()` na dialogi i toasty oraz
pozostałe sekcje (typografia, layout, komponenty). Nie wprowadzamy ich bez decyzji użytkownika.

---

## 1. Formaty danych (§7 oryginału)

| Dana | Format |
|---|---|
| Cena zakupu | 2 miejsca po przecinku, np. `1234.56` (w tekstach: `1234.56 zł`) |
| **Cena sprzedaży** (tabela katalogu) | liczba całkowita + `,-`, np. `7252,-` |
| Marża | `12%` (bez miejsc po przecinku) |
| VAT | `23%` |
| Waga | `12.50 kg`, `font-mono` |
| Data/godzina | `toLocaleString("pl-PL")` → `30.09.2026, 12:41:00` (lub `dd.mm.rrrr, gg:mm`) |
| Brak wartości | półpauza `—` (nie „null”, nie puste „0”) |
| Wartości logiczne / etykiety UE (śnieg, lód itd.) | `Tak` albo puste — nigdy 0/1 |
| Konstrukcja | pełne nazwy `Radialna` / `Diagonalna` |
| Status produktu | `aktywny` / `wstrzymany` |
| Kody, EAN | `font-mono`, bez formatowania |
| Liczniki w podsumowaniach | separator `·`, np. „3 krytycznych · 12 ostrzeżeń” |
| Wielokropek | znak `…` („Ładowanie…”) |

Uwaga do „Tak albo puste”: kolumny flagowe `products` trzymają w produkcji mieszane typy
(`0`/`1` i tekst `'Tak'`) — patrz `CLAUDE.md` (pułapka `integer({ mode: "boolean" })`).
Format wyświetlania nie zmienia tego, jak czytamy dane z bazy.

## 2. Kolory statusów i reguła marży (§3.4 oryginału)

Jedyne kolory dopuszczalne poza tokenami motywu:

| Znaczenie | Klasy (jasny / ciemny) |
|---|---|
| Sukces, OK, wzrost, „zsynchronizowano” | `text-emerald-600 dark:text-emerald-400`; badge `bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]` |
| Ostrzeżenie, niska marża, „w toku” | `text-amber-600` / `font-semibold`; badge `bg-amber-500 hover:bg-amber-600 text-white`; ramka informacyjna `bg-amber-500/10 border border-amber-500/20 rounded-lg p-4` |
| Błąd, krytyczne, spadek, marża ujemna | `text-red-600 dark:text-red-400`; marża < 0 → `text-red-600 font-bold` |
| Informacja | `bg-blue-600` / `text-blue-700 border-blue-200` (oszczędnie) |
| Pulsujący wskaźnik aktywności | `bg-amber-500 animate-pulse` (kropka) |
| Brak zmian / neutralne | `text-muted-foreground` |

**Reguła marży (tabela katalogu):**

- `< 0%` — czerwony, pogrubiony (`text-red-600 font-bold`),
- `0–5%` — bursztynowy, półgruby (`text-amber-600 font-semibold`),
- `≥ 5%` — bez koloru.

## 3. Błąd ładowania nie wygląda jak pusta baza (§5.12 oryginału)

Błąd ładowania **nie może** wyglądać jak brak danych. Widok pokazuje pasek błędu:

- klasy: `bg-red-50 border border-red-200 text-red-800 rounded-lg p-4`
  (ciemny: `bg-red-950/40 text-red-300`),
- treść błędu z API,
- przycisk „Spróbuj ponownie”.

Powiązane: pułapka `safeAll()` i pustych odpowiedzi w `CLAUDE.md` — zepsuta trasa potrafi
zwrócić `rows: []`, więc pusty stan sam w sobie niczego nie dowodzi.
