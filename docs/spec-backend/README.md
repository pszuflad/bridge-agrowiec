# Wpisy do `docs/spec-backend.md` — jeden plik na ticket

Wprowadzone ticketem `91-FEATURE-archiwum-importow` (2026-09-22), po pierwszym konflikcie
merge'u w `docs/spec-backend.md`: karty P10.1 (ticket 90) i PR.1 (ticket 91) szły równolegle
i obie dopisały akapit „Potwierdzone w N” **w to samo miejsce** — na koniec §2. To dokładnie
wzorzec „dopisek w tym samym punkcie”, który w roadmapie dał siedem konfliktów
(`docs/karty/README.md`, „Dlaczego”). Ta sama pułapka czeka na końcu §5 (bloki „Odbudowa (…)”).

Rozwiązanie jest to samo co przy roadmapie: **oś podziału = PLIK**.

## Reguła

- Ticket, który ma do zapisania nowe ustalenie o backendzie (nowa trasa, potwierdzone
  zachowanie oryginału, świadome odstępstwo), tworzy **NOWY plik**
  `docs/spec-backend/wpis-<N>.md`, gdzie `N` to numer ticketu. Dwa tickety nigdy nie tworzą
  tego samego pliku, więc konflikt jest niemożliwy, a nie tylko mniej prawdopodobny.
- **Nie dopisuje się nowych akapitów** na koniec żadnej sekcji `docs/spec-backend.md`.
  Końce §2 i §5 mają stały wskaźnik na ten katalog i ten wskaźnik się nie zmienia.
- **Wolno poprawiać w miejscu** istniejące zdanie w `docs/spec-backend.md`, które ticket
  obalił (fałsz ma zniknąć, nie stać obok sprostowania). Taka poprawka dotyka linii, którą
  zmienia ten jeden ticket, więc konfliktuje rzadko. Wpis w pliku opisuje wtedy, co i dlaczego
  zostało poprawione.
- Plik wpisu jest **własnością ticketu, który go stworzył** — inne tickety go nie edytują.
  Jeśli późniejszy ticket obali wpis, pisze własny `wpis-<M>.md` z odnośnikiem do starego.

## Szablon `wpis-<N>.md`

```markdown
# Wpis do spec-backend od ticketu <N> (karta <ID>) · <RRRR-MM-DD>

**Sekcja:** §<nr> (<czego dotyczy>).

**Potwierdzone w <N>** (`<TICKET-ID>`, <data>, karta <ID>): <fakt, dowód plik:linia / pomiar,
co odbudowa robi tak samo, a co świadomie inaczej>. Szczegóły: `docs/tickets/<TICKET-ID>/`.
```

## Czytanie

Pełna specyfikacja = `docs/spec-backend.md` + wszystkie pliki z tego katalogu, najnowsze
na końcu:

```bash
ls docs/spec-backend/wpis-*.md | sort -t- -k2 -n
```

Wpisy sprzed ticketu 91 zostają w `docs/spec-backend.md` jako historia — nie są przenoszone,
bo przeniesienie tekstu spod kart, które są w toku, dałoby im ten sam konflikt, któremu ta
zmiana ma zapobiec. Wyjątek: wpis ticketu 90 (`wpis-90.md`) przeniesiony przy rozwiązywaniu
konfliktu, który tę regułę wywołał.

**Karta w toku, która już dopisała akapit na koniec §2 lub §5** (zaczęła przed tą regułą),
przy merge'u z `develop` dostanie konflikt w tym jednym miejscu. Rozwiązanie: przenieść swój
akapit do `docs/spec-backend/wpis-<swój N>.md` i przyjąć wersję `develop` wskaźnika.
