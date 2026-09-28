# Wpisy backlogu — jeden plik na ticket

Wprowadzone ticketem `128-DOCS-backlog-per-ticket` (2026-09-23), po serii konfliktów merge'a
w `docs/rebuild-backlog.md`. To ten sam wzorzec, który wcześniej rozwiązano przy roadmapie
(`docs/karty/README.md`) i przy specyfikacji (`docs/spec-backend/README.md`): **oś podziału = PLIK**.

## Dlaczego

`docs/rebuild-backlog.md` ma (miał) trzy punkty, w które **każdy** ticket dopisywał w to samo
miejsce — a to jest definicja konfliktu przy równoległych kartach:

1. **Koniec listy wpisów** — każdy triaż dokłada `### #N` na końcu pliku.
2. **Bloki `*Pominięte — triaż …*`** — każdy triaż dokłada akapit w to samo miejsce. Widać po
   nich historię merge'ów: blok ticketu 104 stoi PRZED blokiem ticketu 94, bo tak je poskładał git.
3. **Akapity podsumowań na górze** („Partia #72–#83 ROZSTRZYGNIĘTA…”, „#31–#35 WDROŻONE…”) —
   dopisywane przy każdym rozliczeniu.

Do tego **numeracja `#N`**: dwa triaże w tym samym czasie obie brały „następny numer po #102”,
więc kolidowały i treścią, i numerem.

## Reguła

- **Nowe wpisy backlogu idą do własnego pliku ticketu:** `docs/rebuild-backlog/wpis-<N>.md`,
  gdzie `N` to **numer ticketu** (unikalny z rezerwacji katalogu w `docs/tickets/`). Dwa tickety
  nigdy nie piszą do tego samego pliku, więc konflikt jest **niemożliwy**, a nie tylko rzadszy.
- **Identyfikator wpisu to `#<ticket>.<kolejny>`** — `#128.1`, `#128.2`, … Numeracja jest lokalna
  dla ticketu, więc nie da się „zająć cudzego numeru”. Wpisy `#1`–`#108` (sprzed tej reguły)
  zostają ze starym numerem i starym miejscem — odnośniki do nich są nadal ważne.
- **Jeden plik ticketu zawiera wszystko, co ten ticket dokłada do backlogu:** wpisy, listę
  „Pominięte” (zmiany wyłącznie danych) i własne podsumowanie partii. Nic z tego nie idzie
  do `docs/rebuild-backlog.md`.
- **Plik jest własnością ticketu, który go stworzył.** Inny ticket go nie przepisuje. Wyjątek:
  **jedna linia** tabeli — `Do nowej wersji?` (decyzja użytkownika) i `Status` (ten, kto wdraża)
  — wolno zmienić w miejscu. Zmiana jednej linii w małym pliku konfliktuje rzadko; dopisywanie
  akapitów do cudzego wpisu — nie wolno, od tego jest własny `wpis-<M>.md` z odnośnikiem.
- **`docs/rebuild-backlog.md` nie rośnie.** Wolno w nim poprawić zdanie, które ticket obalił
  (fałsz ma zniknąć, nie stać obok sprostowania). Wskaźniki na ten katalog są stałe i się nie zmieniają.

## Szablon `wpis-<N>.md`

```markdown
# Backlog — wpisy ticketu <N> (`<TICKET-ID>`) · <RRRR-MM-DD>

Zakres triażu: `<sha_od>..<sha_do>` (jeśli to triaż).

### #<N>.1 · <RRRR-MM-DD> · [BACKEND][BAZA] · <etykieta>

| Pole | Wartość |
|---|---|
| **Data** | <data zmiany w produkcji> |
| **Kategoria** | <BACKEND / BAZA / FRONTEND / DEPLOY / KONTRAKT / BEZPIECZEŃSTWO> |
| **Pliki** | <pliki produkcji + nazwy `.bak`> |
| **Commit** | `<skrót>` |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — |

**Opis biznesowy.** <co realnie się zmieniło i po co — z diffa i wpisu Ani, nie z pamięci>

**Szczegół techniczny (dla rebuildu).** <funkcje/pliki, gdzie i jak>

**Rekomendacja (moja).** <✅ nanieść / ❌ pominąć / 🕒 później + uzasadnienie, wzorce, powiązania>

### #<N>.2 · …

---

*Pominięte (zmiany wyłącznie danych, bez zadania dla rebuildu):*
- `<sha>` (<data>) — <co to było i dlaczego pomijamy>
```

## Czytanie

Cały backlog = `docs/rebuild-backlog.md` (historia `#1`–`#108`) + wszystkie pliki z tego katalogu:

```bash
tools/stan-backlogu.sh                # tabela: wpis, data, decyzja, status, etykieta, plik
tools/stan-backlogu.sh --do-decyzji   # tylko ⬜ — to, na co czeka decyzja użytkownika
tools/stan-backlogu.sh 131            # tylko wpisy ticketu 131
ls docs/rebuild-backlog/wpis-*.md | sort -t- -k2 -n
```

Wpisy sprzed ticketu 128 **nie są przenoszone** — przeniesienie tekstu spod kart, które są
w toku, dałoby im dokładnie ten konflikt, któremu ta zmiana ma zapobiec.

**Karta w toku, która zdążyła dopisać `### #N` na koniec `docs/rebuild-backlog.md`** (zaczęła
przed tą regułą), przy merge'u z `develop` dostanie konflikt w tym jednym miejscu. Rozwiązanie:
przenieść swój wpis do `docs/rebuild-backlog/wpis-<swój N>.md` (identyfikator zmienia się na
`#<N>.1`), a w `docs/rebuild-backlog.md` przyjąć wersję z `develop`.
