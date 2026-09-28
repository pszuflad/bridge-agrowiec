# Raport — Iteracja 3, blok 3f-3 · Scheduler importu (BE)

**Data:** 2026-09-01 · **Gałąź:** `feature/14-dostawcy-url-alerty-sterowanie`
**Zakres:** port `D4()` (`deminified/backend-index.cjs:48118-48131`) za przełącznikiem
`IMPORT_SCHEDULER`. Bez frontendu.

> Bloki 3f-1 i 3f-2 nie zakładały katalogu ticketu — ich raporty są w roadmapie i w
> komunikatach commitów. Ten plik istnieje, bo DoD sesji 3f-3 wymaga raportu obok roadmapy;
> obejmuje **wyłącznie blok 3f-3**.

---

## 1. Weryfikacja faktów PRZED planowaniem

Wszystkie trzy twierdzenia z promptu sprawdzone w wysłanym bundlu, nie przyjęte na słowo:

| Twierdzenie | Sprawdzenie | Wynik |
|---|---|---|
| `D4()` wołane dokładnie raz, w `M4()` (`:48167`) | `grep -n "\bD4(" deminified/backend-index.cjs` | ✅ dwa trafienia: definicja `:48118` i wywołanie `:48167` |
| Żadna trasa nie woła `D4()` | jw. | ✅ potwierdzone |
| Brak duplikatu definicji (CLAUDE.md §5) | `grep -o "function D4(" mirror/backend/index.cjs \| wc -l` | ✅ `1`; `D4(` łącznie `2` |
| `D4()` nie odpala przebiegu na starcie | odczyt `:48125` | ✅ sam `setInterval` |
| Piątka `url` po 60 min | zapytanie do `db/snapshot.db` | ✅ MO2/MO3/MO4/MO5/MO9 = 60 min |

---

## 2. Cztery decyzje użytkownika (2026-09-01)

### 2.1 Start w `server.ts` po `listen()`, nie w `stworzApp`

**Odstępstwo w UMIEJSCOWIENIU, bez zmiany zachowania procesu produkcyjnego.** Oryginał woła
`D4()` w `M4()`, czyli w odpowiedniku `stworzApp`, przed rejestracją tras. Wierne
umiejscowienie znaczyłoby, że przez kod stawiający timery przechodzi KAŻDY test suity
(cała suita buduje aplikację przez `stworzApp`/supertest, `test/gate/aplikacja.ts`) —
i że sprzątania nie ma gdzie zawiesić, bo `stworzApp` nie ma odpowiednika `zamknij()`.
W produkcji `stworzApp` jest wołane dokładnie raz, tuż przed `listen()`, więc różnicy
w zachowaniu procesu nie ma. `server.ts` ma już `zamknij()` na SIGTERM/SIGINT i tam
scheduler jest gaszony.

Pilnuje tego test czytający `src/app.ts` i sprawdzający, że nie ma w nim `stworzScheduler`
ani `setInterval` — żeby nikt tego kiedyś „nie poprawił" z powrotem.

**Konsekwencja przewodowa:** `server.ts` tworzy JEDNĄ instancję `synchronizujDostawce` na
proces i podaje ją i trasie (`przez stworzApp` → `trasyDostawcow`), i schedulerowi —
zgodnie z notą 3f-2. Bez tego oba dostałyby własny `silnikStagingu`.

### 2.2 `PATCH /api/dostawcy/{id}` przeplanowuje scheduler

**Świadome odstępstwo.** `D4()` nie jest wołane z żadnej trasy, więc w produkcji zmiana
częstotliwości daje „Zapisano", a automat chodzi ze starym interwałem **aż do restartu
procesu**. Do 3f-2 było to niewidoczne (częstotliwość zmieniało się PATCH-em z konsoli);
po wchłonięciu `freq-injection.js` jest na to przycisk w panelu, więc cisza po zapisie
stała się zachowaniem mylącym.

Trzy ograniczenia wpisane w implementację:

- **nie-operacja, gdy automat nie działa** — czyli zawsze przy wyłączonym `IMPORT_SCHEDULER`;
- **nigdy nie odpala przebiegu startowego** — inaczej każdy zapis w panelu waliłby w pięć
  serwerów dostawców naraz;
- ⚠ **koszt przyjęty świadomie:** przebudowa jest HURTOWA (`D4()` czyści całą mapę i stawia
  ją od nowa), więc PATCH zeruje odliczanie WSZYSTKIM dostawcom, nie tylko zmienionemu.
  PATCH częstszy niż interwał zagłodziłby automat. Opisane Ani w instrukcji testów.

### 2.3 Przebieg startowy za osobnym przełącznikiem

`IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG`, domyślnie wyłączony, działa tylko razem
z `IMPORT_SCHEDULER`. **Osobna zmienna, a nie zmiana samego `D4()`, żeby proces produkcyjny
został 1:1** — przy obu domyślnych wartościach zachowanie jest identyczne z oryginałem,
a Ania na stagingu dostaje sygnał w kilkanaście sekund zamiast po godzinie. Rozrzut 5 s
między dostawcami, żeby piątka nie ruszyła w tej samej sekundzie.

Rozstrzygane ODRĘBNIE od samego przełącznika `IMPORT_SCHEDULER`, który był zaklepany wcześniej.

### 2.4 Druga linia logu z powodami pominięcia

Linia `[scheduler] zaplanowano N dostawców z URL polling` zostaje co do znaku 1:1 (`:48130`).
Pod nią nasza: `[scheduler] pominięto: MO1 (sposób dostarczania: mail), …`. **Wyłącznie log,
zero wpływu na dobór i na dane.** Powód w §3.

---

## 3. Znalezione w tej sesji: DWA POJĘCIA STATUSU (backlog #17, #18)

Sprawa spoza promptu, znaleziona przy pisaniu doboru dostawców.

`D4()` dobiera z `U.listSuppliers()`, a ta funkcja **przelicza `status` w locie** (`:45026`)
zamiast czytać kolumnę. `L4()` sprawdza natomiast status z **surowego wiersza**
(`getSupplierByKod`, `:48039`). To dwa różne pojęcia statusu w jednym mechanizmie.

```
przeliczStatus(status_z_kolumny, ostatniPlik, liczbaProduktow):
  if (ostatniPlik) {
    wiek > 30 dni → "wstrzymany"
    else          → liczbaProduktow === 0 ? "blad" : "aktywny"
  }
  else            → liczbaProduktow === 0 ? "wstrzymany" : status_z_kolumny
```

Trzy konsekwencje, **wszystkie odtworzone 1:1**:

1. **Samozakleszczenie po 30 dniach** — dostawca bez udanego importu od ponad 30 dni ma
   wyliczony status „wstrzymany", więc wypada z automatu, więc nigdy się nie odświeży, więc
   już nie wróci bez ręcznego „Synchronizuj teraz".
2. **Świeża baza planuje ZERO** — przy `ostatniPlik = null` i zerze produktów wyliczony status
   to „wstrzymany" u WSZYSTKICH. Dotyczy też stagingu ze snapshotu: `db/snapshot.db` ma
   u piątki `url` `ostatni_plik = 2026-08-13`, czyli **po 2026-09-13 planuje zero**.
3. **Wstrzymany dostawca ze świeżym `ostatniPlik` DOSTAJE timer** — bo `D4()` widzi status
   wyliczony. Pobrania nie ma, bo zatrzymuje je dopiero `L4()`. Skutek dla użytkownika
   właściwy, mechanizm mylący. **Gate „wstrzymany wyklucza z automatu" jest więc rozliczony
   na poziomie BRAKU POBRANIA, nie braku timera** — i tak jest zapisany w teście.

Objaw widoczny dla Ani (karta pokazuje „aktywny" po zapisaniu „wstrzymany") opisany
w `docs/instrukcja-testow-I3.md` §4 pkt 11. Propozycje napraw w backlogu **#17** i **#18**;
właściciel do ustalenia — #17 zmienia dobór dostawców do automatu, #18 dokłada klucz do
kontraktu `GET /api/dostawcy`.

**To jest powód, dla którego powstała druga linia logu.** Różnica między `zaplanowano 0`
a wiedzą, dlaczego zero.

---

## 4. Co dowiezione

| Plik | Zmiana |
|---|---|
| `src/import/scheduler.ts` | **nowy** — `stworzScheduler` → `uruchom` / `przeplanuj` / `zatrzymaj` / `czyDziala` / `liczbaTimerow` |
| `src/config/env.ts` | `IMPORT_SCHEDULER`, `IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG` (oba domyślnie wyłączone) |
| `src/server.ts` | jedna instancja `synchronizujDostawce` na proces; start pod warunkiem, po `listen()`; gaszenie w `zamknij()` |
| `src/app.ts` | przewód `synchronizuj` i `przeplanujScheduler` |
| `src/routes/suppliers.ts` | `przeplanujScheduler?.()` po udanym PATCH |
| `test/scheduler.test.ts` | **nowy** — 24 testy |
| `.env.example`, `README.md` | opis obu zmiennych |
| `docs/instrukcja-testow-I3.md` | §3.13 (jak włączyć i po czym poznać), §4 pkt 11 (status) |
| `docs/rebuild-backlog.md` | #17, #18 |
| `docs/rebuild-roadmap.md` | 3f-3 zamknięty, 3f zamknięty, DoD I3 rozliczony |

**Czego NIE napisano drugi raz:** funkcji pobierającej. Scheduler woła
`synchronizujDostawce()` z 3f-2, **bez opcji** — 1:1 z `L4(n.kod)` (`:48127`) — więc blokada
`wstrzymany` na automacie działa. Flaga `{recznie: true}` została wyłącznie przy trasie
`synchronizuj-teraz`; osobny test sprawdza wprost, że scheduler przekazuje sam kod.

---

## 5. Gate — rozliczony

| Wymóg | Stan |
|---|---|
| Bez `IMPORT_SCHEDULER` nie startuje w ogóle — zero timerów | ✅ + test pilnujący, że `app.ts` nie zawiera `stworzScheduler`/`setInterval` |
| Dobiera właściwych dostawców (url + URL + częstotliwość + nie wstrzymany) | ✅ także `czestotliwoscMinuty = 0` wypada |
| Ponowne wywołanie nie mnoży timerów | ✅ i stary interwał jest GASZONY, nie tylko nadpisywany w mapie |
| `wstrzymany` wyklucza z automatu, ręczna synchronizacja przechodzi | ✅ na poziomie braku pobrania — patrz §3 pkt 3 |
| Interwał faktycznie ODPALA pobranie | ✅ żywy serwer HTTP na porcie efemerycznym, `fetch` niemockowany, **prawdziwe timery** |
| Po `zamknij()` nic nie wisi | ✅ `zatrzymaj()` gasi interwały i oczekujące przebiegi startowe; `unref()` sprawdzony przez `process.getActiveResourcesInfo()` |
| Regresja I1–I3, w tym 24 testy dostawców z 3f-2 | ✅ BE **449** (425 + 24) w 30 plikach, FE **183** w 13 |
| lint / typecheck / build / test | ✅ czyste |

**Jak uzyskano krótki interwał bez fałszywych timerów:** ułamkowa `czestotliwoscMinuty`
(0,005 min = 300 ms) wpisana wprost do bazy. SQLite trzyma taką wartość jako REAL mimo
deklaracji kolumny INTEGER, więc kod produkcyjny nie musi o tym wiedzieć — mnożenie
`× 60 × 1000` jest to samo. Cały plik testowy chodzi na prawdziwych timerach i prawdziwym
HTTP w ~8 s.

**Pułapka, która kosztowała trzynaście fałszywych porażek przy pierwszym uruchomieniu:**
`ostatniPlik` w zasiewie testowym musi być ŚWIEŻY, inaczej `przeliczStatus` daje „wstrzymany"
i dostawca w ogóle nie kwalifikuje się do automatu. To ta sama przyczyna co §3.

---

## 6. Iteracja 3

Blok 3f-3 zamyka **cały blok 3f** i **Iterację 3**. DoD rozliczony w roadmapie; wszystkie
trzy produkcyjne ścieżki importu (mail/upload → wgranie ręczne, url → „Synchronizuj teraz",
url → automat) są uruchamialne z przeglądarki.

**Otwarte po iteracji, świadomie, żadne nie blokuje I4:** fallback `Wc()` (właściciel do
ustalenia), dławik alertów → I6, dwa pojęcia statusu → backlog #17/#18 (właściciel do
ustalenia), `PATCH markups/promotions` → I4 (backlog #14).
