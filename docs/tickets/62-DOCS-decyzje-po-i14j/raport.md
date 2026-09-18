# 62-DOCS — raport

## Summary

Naniesione trzy decyzje użytkownika z 2026-09-18, będące odpowiedzią na pytania postawione
w raporcie karty `59-CHORE-i14j`. **Zero zmian w kodzie** — i to jest ustalenie, nie skutek
uboczny: żadna z trzech decyzji zmiany kodu nie wymagała, bo odbudowa już zachowywała się tak,
jak użytkownik zdecydował.

Przy okazji **odzyskano dokument, który był o jeden `git gc` od zniknięcia** — patrz niżej.

## Changes

- **Nowy:** `docs/instrukcja-testow-I5.md` (407 linii) — odzyskany i poprawiony w sześciu miejscach.
- `docs/rebuild-backlog.md` — #87 z ⬜ na ❌ (z uzasadnieniem i warunkiem powrotu); **nowy wpis #88**.
- `docs/rebuild-roadmap.md` — trzy noty w podbloku 14j przestały być otwarte.
- `docs/pytania-do-ani-2026-09-18.md` — pytanie 5.3 przestało być pytaniem.
- **Nowe:** `docs/tickets/62-DOCS-decyzje-po-i14j/{plan,raport}.md`.

## D1 — eksport ZIP: nie odtwarzamy defektu

Backlog **#88**, `Do nowej wersji?` = ✅ TAK. Wpis niesie komplet pomiaru: log procesu
(`zip pipeline failed TypeError: oh is not a constructor` przy potwierdzonym
`archiver w piaskownicy: JEST`), tabelę trzech ścieżek eksportu po obu stronach oraz wskazanie,
że `archiver` **nie jest zadeklarowany** w `package.json` produkcji, tylko w lockfile.

**Osobna karta implementacyjna okazała się zbędna.** Raport 14j proponował ją, zakładając, że
decyzja może pójść w stronę „odtwórzmy defekt". Skoro poszła w drugą — nie ma czego
implementować: odbudowa deklaruje `archiver: ^8.0.0` i działa.

Odnotowane w #88 jako morał wykraczający poza ten jeden przypadek: to **pierwszy raz w tej
odbudowie, gdy wierne przepisanie kodu dało zachowanie INNE niż produkcja**, bo różnica siedziała
w wersji biblioteki, a nie w kodzie.

## D2 — instrukcja I5: odzyskana i poprawiona

### ⚠ Gałąź zdążyła zniknąć z `origin`

Raport 14j podawał (zgodnie ze stanem sprzed kilku godzin), że instrukcja leży na
`origin/docs/instrukcja-testow-i5`. **Przy realizacji tej karty tej gałęzi na `origin` już nie
było** — `git ls-remote --heads origin | grep instrukcja-testow-i5` zwraca zero trafień.

Treść odzyskano z **wiszącego lokalnie** commita `322a176`. Kontrola: `4ea3b92` daje identyczną
sumę MD5 (`f7e37f91ece46d1e7896cc31043cee4c`), więc obie wersje niosły ten sam plik i nic nie
zginęło po drodze. Gdyby ta karta poszła kilka dni później albo na innej maszynie, **dokumentu
nie dałoby się odzyskać w ogóle** — i nikt by tego nie zauważył, bo plik nigdy nie był na `develop`.

Morał zapisany w roadmapie: **instrukcja wysłana Ani z niezmergowanej gałęzi jest o jeden `git gc`
od zniknięcia — po wysłaniu domykaj PR.**

### Sześć poprawek merytorycznych

| Miejsce | Było | Jest |
|---|---|---|
| Nagłówek | wersja 2026-09-02 | banner „co się zmieniło", wersja 2026-09-18 |
| §1 | „zacznij od §9, tam sedno" | §9 to dziś pięć minut, nie godzina |
| **§3.3** | „wpisów typu *edycja* nie przybędzie" | **przybywa** — jeden wiersz na każde zmienione pole, plus dziwactwo `null` |
| **§8.2** | „nowych eksportów nie wygenerujesz" | **wygenerujesz**, plus różnica na korzyść Ani z #88 |
| **§9** | ręczne porównanie całej listy | wynik pomiaru + **trzy wpisy** do kontroli wzrokowej |
| §11 pkt 9 | „dziś niewidoczne, z czasem wypłynie" | liczba (3873 z 5000, 77%) + decyzja + po czym pozna próg |
| §12, §13 | pozycje „jeszcze nie ma" | oznaczone ✅, lista kontrolna przepisana pod nowy §9 |

## D3 — limit 5000: zostaje

Backlog **#87** przechodzi z ⬜ na ❌ **NIE — zostawiamy 5000**. Uzasadnienie zgodne z domyślną
regułą odbudowy: produkcja ma ten sam limit, więc zmiana byłaby świadomym odstępstwem, a dziś nie
ma powodu go ponosić.

⚠ **Temat nie jest zamknięty na zawsze** i jest to zapisane w dwóch miejscach: wraca przy progu
albo razem z rozstrzygnięciem **#21**, które go przyspiesza. Roadmapa mówi wprost sesji 14k, żeby
policzyła to, **zanim** zaproponuje rozszerzenie słownika akcji.

## Deviations from plan

Jedno, opisane wyżej: gałąź z instrukcją zniknęła z `origin` między kartą 59 a 62, więc źródłem
stał się wiszący commit lokalny zamiast zdalnej gałęzi. Nie zmieniło to zakresu.

## Test results

- **Gate odbudowy:** N/D — karta nie dotyka API ani kontraktu. Zero zmian w `rebuild/`.
- **Bramki backendu** (gałąź niesie kod z 58 i 59, więc uruchomione mimo docs-only):
  `lint` ✓, `typecheck` ✓, `test` ✓ — **83 pliki, 1271 testów**.

## Breaking changes

Brak.

## Follow-up

1. **Pytanie #21 do Ani nadal otwarte** — `docs/pytania-do-ani-2026-09-18.md` §5.1 (czy Historia
   ma pokazywać pobrania z URL i „Synchronizuj teraz"). Jego rozstrzygnięcie **otwiera ponownie
   #87**.
2. **Zgłoszenie defektu eksportu ZIP Ani** — opcjonalne, nie blokuje cutoveru. Naprawa po stronie
   produkcji to podbicie `archiver` do 8.x **i** dopisanie go do `package.json`; skoro cutover
   zastąpi tamten backend, prawdopodobnie nie warto.
3. **Follow-upy 1–3 z raportu karty 59 są tą kartą ZAŁATWIONE** — tamten raport zostaje
   niezmieniony jako zapis historyczny stanu na moment pomiaru.
