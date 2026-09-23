# Backlog — wpisy ticketu 143 (`143-DOCS-wpisy-organizacyjne-dec1`) · 2026-09-24

To NIE jest triaż produkcji. Trzy wpisy organizacyjne z rundy decyzyjnej **DEC.1**
(ticket 141, 2026-09-23), które po zamknięciu tamtej karty zostałyby **bez domu**: siedziały
wyłącznie w sekcji „Do koordynatora" zamkniętego `docs/karty/DEC.1/karta.md`.

**Powód założenia tego pliku — ten sam, co przy tickecie 137.** Sprawdzone 2026-09-24:
`grep -l "Do koordynatora" tools/*.sh` daje **zero trafień**, czyli żadne narzędzie przeglądowe
nie wypisuje tej sekcji. Karta oznaczona `✅` wypada z pola uwagi (`tools/stan-kart.sh` pokazuje
tylko stan, nie treść), więc notatka dla koordynatora ginie. Backlog jest przeglądany rutynowo
(`tools/stan-backlogu.sh`) — stąd przeniesienie. Decyzja użytkownika 2026-09-24.

⚠ **Wpis `#137.1` z tej samej rodziny nie jest tu powtarzany** — ma własną, aktualną decyzję
(🕒 po cutoverze, użytkownik 2026-09-23 podtrzymał 2026-09-24: „zostawmy to na razie").

---

### #143.1 · 2026-09-24 · [ORGANIZACYJNE] · zduplikowany numer `#103` w `docs/rebuild-backlog.md` — dwa różne wpisy

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (powstanie duplikatu), wykryte w tickecie 120, przeniesione tu z DEC.1 |
| **Kategoria** | ORGANIZACYJNE (higiena backlogu, nie zmiana produkcji) |
| **Pliki** | `docs/rebuild-backlog.md:4613` i `:4638` |
| **Commit** | — |
| **Do nowej wersji?** | 🕒 **po cutoverze** — nie blokuje wdrożenia, ale myli przy każdym czytaniu backlogu |
| **Status** | ⬜ do zrobienia przez koordynatora — przenumerowania nie robi karta |

**Opis.** W `docs/rebuild-backlog.md` są **dwa różne wpisy o numerze `#103`**:
- `:4613` — Selly: `routes_sync.cjs` importuje nieistniejące `runFullTodays`
  (**zamknięty przez DEC.1** jako ✅ dowiezione w I15.8, ticket 121);
- `:4638` — „Braki w cenniku": bezpieczeństwo źródła, koniec fałszywych wycofań, staging v3
  (**żyje dalej**, dotyczy I15.2/I15.4/I15.5/I15.11).

**Dlaczego to boli.** `tools/stan-backlogu.sh` wypisuje oba jako `#103`, a odnośnik „patrz #103"
w dowolnej karcie jest dziś niejednoznaczny. Po zamknięciu pierwszego z nich ryzyko rośnie:
czytelnik widzi „#103 zamknięte" i może uznać, że dotyczy to stagingu — a nie dotyczy.

**Szczegół techniczny.** Oba wpisy mają już adnotację ostrzegawczą o duplikacie (dopisaną
w tickecie 120), więc sam fakt jest udokumentowany — brakuje wyłącznie przenumerowania.
Numeracja `#1`–`#108` jest historyczna i zamrożona (`docs/rebuild-backlog/README.md`), więc
przenumerowanie wymaga decyzji, który z dwóch zachowuje `#103` i jakim numerem opatrzeć drugi
(poza pulą historyczną, np. jako wpis w `docs/rebuild-backlog/wpis-<N>.md` z odsyłaczem).

**Rekomendacja (moja).** 🕒 **po cutoverze, przez koordynatora.** Drugi wpis („Braki w cenniku")
przenieść do własnego pliku per-ticket z nowym identyfikatorem i zostawić w `rebuild-backlog.md`
jednolinijkowy odsyłacz; `#103` zostawić temu zamkniętemu (Selly), bo odnośniki do niego są już
rozsiane po kartach I15.6–I15.8. Karta DEC.1 celowo tego nie ruszała — przenumerowanie cudzych
wpisów nie jest w zakresie karty.

---

### #143.2 · 2026-09-24 · [ORGANIZACYJNE] · katalog karty nie zakładany przed wydaniem promptu — DEC.1 musiała założyć się sama

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23 (przypadek DEC.1) |
| **Kategoria** | ORGANIZACYJNE (proces fali, nie kod) |
| **Pliki** | `docs/karty/README.md` („Przepływ fali", krok 1) |
| **Commit** | — |
| **Do nowej wersji?** | 🕒 **po cutoverze** — to proces, nie produkt; poprawić przy planowaniu następnej fali |
| **Status** | ⬜ do rozważenia przez koordynatora |

**Opis.** `docs/karty/README.md` → „Przepływ fali" krok 1 mówi wprost: koordynator zakłada
`docs/karty/<ID>/karta.md` dla KAŻDEJ karty fali i **merguje to do `develop` PRZED** wydaniem
promptów — po to, żeby karty branchowały z gałęzi, która już ma ich pliki, i żeby żadna nie
tworzyła wspólnego szkieletu (to jest źródło konfliktów, które cały ten katalog ma eliminować).

**Co się stało.** Prompt do karty **DEC.1** kazał przeczytać `docs/karty/DEC.1/karta.md`, a tego
katalogu **nie było** — ticket 141 musiał go założyć sam. Skutków ubocznych nie było (nowy plik
= zero konfliktu, a karta szła sama), ale przy fali równoległej ten sam błąd oznacza dwie karty
tworzące ten sam plik, czyli dokładnie konflikt, któremu reguła ma zapobiegać.

**Rekomendacja (moja).** 🕒 **dopilnować przy planowaniu następnej fali.** Tanie zabezpieczenie:
dopisać do `tools/stan-kart.sh` sygnalizowanie kart wymienionych w roadmapie, które nie mają
katalogu — wtedy brak wychodzi mechanicznie, a nie dopiero w sesji karty. Alternatywnie zostawić
jako dyscyplinę koordynatora; przy jednej karcie na raz koszt błędu jest zerowy.

---

### #143.3 · 2026-09-24 · [ORGANIZACYJNE] · siedem kart z rundy DEC.1 czeka na zaplanowanie PO CUTOVERZE

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23 (runda decyzyjna DEC.1, ticket 141) |
| **Kategoria** | ORGANIZACYJNE (zadanie dla koordynatora) |
| **Pliki** | `docs/karty/DEC.1/karta.md` → „Do koordynatora" pkt 5 (pełne zakresy i koszty) |
| **Commit** | — |
| **Do nowej wersji?** | 🕒 **po cutoverze** — decyzja użytkownika 2026-09-23 |
| **Status** | ⬜ do zaplanowania jako fala po cutoverze |

**Opis.** Runda DEC.1 rozstrzygnęła 14 wpisów backlogu. Siedem z nich zostało zakwalifikowanych
do naprawy **po cutoverze** — zgodnie z regułą przyjętą przez użytkownika 2026-09-23:
*co da się zrobić po cutoverze, robimy po cutoverze; teraz priorytetem jest wdrożenie produkcyjne.*

Każdy z tych wpisów ma własną decyzję `🕒` i uzasadnienie w swoim polu `Status`, więc **nie zginie
pojedynczo**. Ten wpis istnieje po to, żeby nie zginął **plan jako całość** — kolejność, koszty
i pogrupowanie w karty, wypracowane w rundzie:

| # | Proponowana karta | Wpisy | Koszt |
|---|---|---|---|
| 1 | Analityka: zwinięcie duplikatów (CTE `HISTORIA_BEZ_DUPLIKATOW_KLUCZA` gotowe; fixture NIE wymaga przenagrania) | `#94` | ~0,5 dnia |
| 2 | Marka w historii cen — karta 4.4 pokazuje `Alliance` i `ALLIANCE` jako dwie marki | `#98` pkt 3 | ~0,5 dnia |
| 3 | Kontrakt: dopisać 403/404/409 do ~20-25 operacji w `openapi.yaml` | `#43` krok 1 | kilka godzin |
| 4 | GATE: dowiązać ~10 plików testowych do `sprawdzZgodnoscZKontraktem` | `#43` krok 2 | 1-2 dni |
| 5 | Selly: kategorie z wielkiej litery — zdejmuje 84 z 84 pominięć **bez** portu CSV | `#12` | ~0,5 dnia |
| 6 | Porządki w danych: 3 wpisy `manual_overrides.konstrukcja='D'`, 2 marki-śmieci, 4 pary case-only w słowniku `bieznik` | `#65`, `#98` pkt 1-2 | ~1-2 h |
| 7 | Silnik cen: dopasowanie przez pustkę + brakujący test wariantu częściowego | `#88` | ~1 h |

Razem **~3-4 dni**. Kolejność jest propozycją, nie zależnością — karty są rozłączne plikowo
poza `#98` (pkt 1-2 i pkt 3 dotykają różnych miejsc: słownik i migracja vs zapytanie analityki).

**Czego ten wpis NIE obejmuje.** Wpisy czekające na decyzję — mają własne `⬜` i wychodzą
w `tools/stan-backlogu.sh --do-decyzji`, więc nie zginą: `#89`, `#108`, `#137.2` (wszystkie trzy
czekają na **Anię**, rozstrzygnięte jako takie w rundzie DEC.1) oraz `#139.2`, który **pojawił
się PO rundzie** (ticket 139, zmergowany 2026-09-23) i czeka na **użytkownika**, nie na Anię.
⚠ `#139.2` niesie pozycję **do sprawdzenia PRZED deployem produkcji**, niezależnie od samej
decyzji: czy `.env` produkcji ma `SELLY_TRYB=pelny` i czy `SELLY_CSV_DIR` wskazuje właściwy
katalog na każdym środowisku, które nie ma `wylaczony` — inaczej staging dzielący VPS
z produkcją może nadpisać produkcyjny CSV. Nie wchodzi w zakres tego ticketu, ale nie powinien
zginąć w planowaniu okna.
Poza tym `#137.1` (🕒 po cutoverze, ale wymaga decyzji użytkownika o polityce mirrora, nie karty
wykonawczej) — użytkownik podtrzymał 2026-09-24: „zostawmy to na razie".

**Rekomendacja (moja).** 🕒 **zaplanować jako jedną falę po cutoverze**, zaczynając od pozycji
1-2 (widoczne dla Ani na kartach analityki) i 5 (realna strata handlowa: 84 opony nie docierają
do Selly). Pozycje 3-4 to dług kontraktowy o zerowym ryzyku runtime — dobre wypełniacze.

---

*Pominięte (zmiany wyłącznie danych):* brak — ten ticket nie jest triażem produkcji.

*Nie przeniesione z „Do koordynatora" DEC.1, bo rozwiązało się samo:* nota o `docs/karty/I15.10b/karta.md`
(miała `Stan: ⬜ do wstawienia w kolejkę` mimo zmergowanego PR #149). Sprawdzone 2026-09-24 na
`develop`: karta ma już `Stan: ✅ 2026-09-23 · 139-FEATURE-montaz-dostepnosci`. Nieaktualne.
