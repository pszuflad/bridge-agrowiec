# Backlog — wpisy ticketu 135 (`135-DOCS-domkniecie-105-i-decyzje`) · 2026-09-23

Ticket porządkowy po fali I15.4: domknięcie dwóch wpisów i **wystawienie jednego zadania
organizacyjnego**, żeby nie zginęło między kartami.

Domknięte w miejscu (w `docs/rebuild-backlog.md` / `wpis-129.md`, zmieniona wyłącznie linia
`Do nowej wersji?` / `Status`):
- **`#105`** → ✅ **dowiezione w całości**. Część parserowa weszła z I15.2 (ticket 120), a drugi
  wątek CHANGELOGU Ani („Edycja modelu w stagingu aktualizuje także bieżnik, jeśli wcześniej był
  jego automatyczną kopią") — z I15.4c (ticket 129). Status mówił „zostaje dla I15.4", choć rzecz
  była już na `develop`.
- **`#129.1`** → ❌ **nie zmieniamy** (decyzja użytkownika 2026-09-23). Port jest wierny,
  a produkcja ma ten sam koszt. Wraca dopiero przy zgłoszeniu „panel stoi".

---

### #135.1 · 2026-09-23 · [ORGANIZACYJNE] · Jedenaście wpisów backlogu wisi bez decyzji — do rozstrzygnięcia OSOBNĄ KARTĄ

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23 (stan po zamknięciu fali I15.4) |
| **Kategoria** | ORGANIZACYJNE (nie zmiana produkcji — zadanie dla koordynatora) |
| **Pliki** | `docs/rebuild-backlog.md` |
| **Commit** | — |
| **Do nowej wersji?** | ✅ **ZREALIZOWANE** — runda decyzyjna przeprowadzona kartą **DEC.1** (ticket 141, 2026-09-23). |
| **Status** | ✅ **ZAMKNIĘTE 2026-09-23** — wszystkie wpisy z listy przejrzane, stan faktyczny zmierzony w kodzie na `develop`, decyzje zapisane. Pełny przebieg i dowody: `docs/karty/DEC.1/karta.md`. ⚠ Lista okazała się dłuższa niż 11: na `develop` @ `ab30674` narzędzie pokazywało **14** pozycji — doszły `#137.1` i `#137.2` (ticket 137, zmergowany po wystawieniu tego wpisu) oraz sam `#135.1`. |

**Opis.** `tools/stan-backlogu.sh --do-decyzji` pokazuje dziś **11 wpisów bez decyzji użytkownika**.
Najstarszy wisi od **2026-08-24**, jeden ma w etykiecie wprost dopisane „wisi bez decyzji do
2026-09-19". To są zaszłości z różnych fal — żadna z nich nie należy do karty I15.4 i żadna nie ma
dziś gospodarza, więc przy planowaniu kolejnej fali po prostu ich nie widać.

**Decyzja użytkownika 2026-09-23:** *nie rozstrzygamy ich przy okazji innych kart* —
**mają być zrobione jako osobna karta** (runda decyzyjna: przejść wpis po wpisie, ustalić
✅/❌/🕒, dopiero potem planować z nich zakres).

**Lista do przejścia** (etykiety skrócone; kartа musi przeczytać pełną treść każdego wpisu):

| Wpis | Data | O czym trzeba zdecydować |
|---|---|---|
| `#5` | 2026-08-24 | dopasowanie fraz — w etykiecie „rozstrzygnięte: poza zakresem importu", ale linia decyzji dalej ⬜; **prawdopodobnie tylko do domknięcia formalnego** |
| `#12` | 2026-09-01 | `__restoreZastosowanie()` po każdej akceptacji — objaw czy naprawa? |
| `#43` | 2026-09-04 | `contract/openapi.yaml` nie zna kodów 403/404/409, więc GATE ich nie obejmuje |
| `#65` | 2026-09-09 | `manual_overrides` nieprzemigrowane — override cofa konwencję przy imporcie |
| `#88` | 2026-09-18 | `promocjaPasuje` — pusty `marka`/`kategoria` łapie KAŻDĄ promocję o niepustym zasięgu |
| `#89` | 2026-09-02 | edycja priorytetu reguły — pole niedostępne dla użytkownika |
| `#94` | 2026-09-22 | „Historia dostępności": EAN wybierany przypadkowo, zdublowane migawki liczone podwójnie |
| `#95` | 2026-09-22 | zdublowany kod w jednym cenniku — katalog i historia cen mogą się rozjechać |
| `#98` | 2026-09-22 | resztki w danych po PR.5 (śmieci w marce, bieżniki różniące się wielkością liter) |
| `#103` | 2026-09-22 | `routes_sync.cjs` woła nieistniejące `runFullTodays` — trasy Selly zawsze dają 500 ⚠ **to drugi wpis o numerze #103**, nie mylić z „Braki w cenniku" |
| `#108` | 2026-09-23 | kolizje `kod_importu` — delty do Selly mogą wracać w pętli co 15 minut |

**Rekomendacja (moja).** 🕒 **osobna karta, po domknięciu I15.4b** — nie wcześniej, żeby nie mieszać
rundy decyzyjnej z falą, która jeszcze się scala. Karta powinna być **wyłącznie decyzyjna**
(wynik: ✅/❌/🕒 przy każdym wpisie), bez implementacji — implementacja idzie dopiero z tych decyzji
do następnej fali. Dwa wpisy warto wziąć na początek, bo mogą okazać się tanie: **`#5`** (wygląda
na już rozstrzygnięty, tylko linia decyzji została ⬜) i **`#43`** (dotyczy naszego GATE-u, nie
produkcji — a od ticketu 129 doszły cztery trasy, które celowo oddają 409, więc luka się pogłębiła).

⚠ **Nie kasować tego wpisu przy okazji.** Zamyka go dopiero karta, która przejdzie całą listę;
wtedy `#135.1` dostaje ✅ i odsyłacz do swojej karty.

*Pominięte (zmiany wyłącznie danych):* brak — ten ticket nie jest triażem produkcji.
