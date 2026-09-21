# 69-FEATURE-historia-bez-limitu: raport z implementacji

## Podsumowanie

`GET /api/history/meta` i `GET /api/history/paged` przestały ciąć `audit_log` do 5000
najświeższych wierszy. Zapytanie SQL odsiewa od razu do akcji ze słownika pięciu typów
(przy konkretnym `typ` tylko do akcji tego typu), bez limitu. Mapowanie, `dostawca`, fraza,
`total` i paginacja zostają w pamięci, 1:1 z oryginałem. Oba objawy z backlogu #87 znikają:
najstarsze wpisy są osiągalne, a `total` i lista dostawców w `/meta` liczą wszystkie pasujące
zdarzenia. Poniżej progu wynik jest co do znaku identyczny z oryginałem (wyrocznia 13/13 bez
wyjątku). Kontrakt, fixtures i JSON wyroczni pozostały nietknięte.

## Zadanie 1: czy wariant (c) przechodzi wyrocznię (zweryfikowane PRZED kodem)

**Hipoteza potwierdzona, bramka się nie zapaliła.** Kolejność kroków:

1. **Pomiar danych** (`db/snapshot.db`, SQLite 3.47.2). Kluczowe ryzyko wariantu (c) to nie limit,
   tylko **kolejność**. Dziś SQL sortuje tekstowo po `kiedy`, a potem JS sortuje stabilnie po
   `new Date(kiedy)`. Po przeniesieniu do SQL zostaje sam porządek tekstowy. Zmierzone:
   - 3873/3873 wiersze `kiedy` mają jeden format: 24 znaki, ISO, z `Z`;
   - remisy `kiedy`: 0 (w całej tabeli i wśród widocznych);
   - inwersje między porządkiem tekstowym a porządkiem `Date` wśród widocznych: 0; `NaN`: 0;
   - w odbudowie jedynym pisarzem jest `zapiszAudyt()` (`toISOString()`), więc format jest
     jednolity z konstrukcji.
2. **Odtworzenie defektu:** nowy `test/historia.powyzej-progu.test.ts` (5200 wierszy `auto_pull`
   nad wpisami widocznymi) na kodzie sprzed zmiany: **5/6 przypadków pada**. `total` wynosi 9
   zamiast 12, najstarsza edycja i najstarszy import są nieosiągalne filtrem, frazą
   i stronicowaniem, a `/meta` zwraca `["MO1"]` zamiast `["MO1","STARY1"]`.
3. **Prototyp** (odsiew w SQL, bez limitu), a na nim wyrocznia: **99/99 testów historii,
   wyrocznia 13/13**, test powyżej progu 6/6.

⚠ **Siła dowodu z wyroczni jest mniejsza, niż sugeruje „przechodzi".** `historia.wyrocznia.json`
zasiewa wyłącznie 270 wierszy ze słownika, więc z konstrukcji nie widzi, gdzie dzieje się odsiew.
Mocnym dowodem zgodności poniżej progu jest pomiar z punktu 1, a nie zielony test. Zapisałem to
w komentarzu warunku ważności wyroczni, żeby następna sesja nie przeceniła tej bramki.

**Scenariusz powyżej progu: dołożony, ale NIE do wyroczni.** Oryginał w tym reżimie gubi wpisy
z założenia, więc nie ma z czym porównywać. To test świadomego odstępstwa w osobnym pliku.
Wykazano, że pada na starym kodzie.

**Obserwacja o tempie:** w snapshocie `audit_log` przybywało ok. 2400 wierszy w lipcu i 1476
w sierpniu (snapshot urywa się w sierpniu). Próg 5000 w produkcji został więc **najpewniej już
przekroczony**, czyli defekt #87 jest dziś aktywny w starym Bridge, a nie dopiero „kiedyś".

## Zadanie 2: DECYZJA o frazie (i o reszcie zakresu SQL)

**Decyzja (użytkownik, 2026-09-21): hybryda.** SQL: `WHERE akcja IN (…) ORDER BY kiedy DESC, id DESC`,
bez limitu. Pamięć, bez zmian: mapowanie, `dostawca`, fraza, `total`, paginacja.

| Co | Gdzie | Dlaczego |
|---|---|---|
| odsiew akcji spoza słownika | SQL | czysta lista wartości `akcja`; to on usuwa 93% szumu (`auto_pull` i spółka) |
| `typ` | SQL (plus powtórnie w pamięci) | lista akcji danego typu z tego samego słownika; nieznany `typ` → `[]` → pusty wynik, jak dawniej w pamięci |
| `dostawca` | pamięć | pole WYLICZANE (`encja_id` przy `encja_typ='dostawca'`, inaczej `szczegoly.dostawca`, i to tylko gdy jest stringiem, po `JSON.parse`); wersja SQL przez `json_extract` byłaby drugą kopią mapowania, czyli mechanizmem #41 |
| fraza | pamięć | trafia w pola wyliczane (`typ`, `format`, „Plik: …”, `zmienionePola`), instrukcja I5 §11 pkt 4; tłumaczenie na listę akcji odrzucone, bo fraza trafia też w kod, plik i użytkownika |
| `total`, paginacja | pamięć | skoro `dostawca` i fraza są w pamięci, `total` musi się liczyć po nich; paginacja w SQL wymagałaby drugiej ścieżki kodu (bez frazy i bez dostawcy) |

**Koszt:** każde żądanie mapuje w pamięci wszystkie WIDOCZNE zdarzenia (dziś 270, przybywa
ok. 130 na miesiąc), a nie wszystkie wiersze `audit_log`.
**Konsekwencja do odnotowania uczciwie:** backlog #87 odrzucił wariant (b) m.in. dlatego, że
„każe mapować całość w pamięci przy każdym żądaniu". Hybryda dziedziczy łagodną wersję tego
kosztu, ale na zbiorze ok. 14 razy mniejszym (270 zamiast 3873+), który rośnie wolno
i nie ma progu, przy którym cokolwiek się gubi. Paginacja nie trafiła do SQL, więc jest to
odejście od LITERY wariantu (c) przy zachowaniu jego SKUTKU. Użytkownik wybrał to świadomie,
znając koszt. Gdyby kiedyś widocznych zdarzeń były setki tysięcy, następnym krokiem jest pełne
(c) dla ścieżki bez frazy, ale dopiero wtedy.

**Jedno źródło prawdy słownika (warunek z promptu):** `SLOWNIK_AKCJI` (`Map`) w
`historia/mapowanie.ts`. Czytają go i `typWpisu()`, i `akcjeHistorii()`, a drugiej listy
akcji nie ma nigdzie. `Map` zamiast literału obiektu, żeby `typWpisu("constructor")` i
`akcjeHistorii("__proto__")` nie trafiały w prototyp (pokryte testem).

## Zmiany

- `rebuild/backend/src/historia/mapowanie.ts`: usunięty `LIMIT_AUDYTU`; słownik jako
  `SLOWNIK_AKCJI: ReadonlyMap`; `typWpisu()` czyta mapę; nowe `akcjeHistorii(typ)`; nagłówek
  opisuje odstępstwo; sprostowane komentarze („z dwunastu akcji… przechodzą dwie”, „odsiew
  dopiero po parsowaniu”), które przestały być prawdą.
- **Nowy:** `rebuild/backend/src/repos/audit-historia.ts`: `audytDlaHistorii(db, akcje)`,
  `inArray(akcja) ORDER BY kiedy DESC, id DESC`, bez limitu.
- `rebuild/backend/src/routes/history.ts`: `/meta` i `/paged` czytają `audytDlaHistorii()`;
  `/paged` zawęża po `typ` już w SQL. `GET /api/history` nietknięte.
- `rebuild/backend/src/repos/audit.ts`: wyłącznie komentarz przy `listaAudytu()` (zdanie
  „historia woła `listAudit(5000)`” przestało być prawdą o odbudowie). Kod bez zmian;
  `/api/audit-log` dalej czyta `listaAudytu(db, 500)`.
- **Nowy:** `rebuild/backend/test/historia.powyzej-progu.test.ts`: 6 przypadków powyżej progu
  plus 1 przypadek remisu `kiedy` → `id DESC`.
- `rebuild/backend/test/historia.mapowanie.test.ts`: `akcjeHistorii()` (all, trzy typy, nieznane
  i prototypowe wartości, spójność z `typWpisu()`).
- `rebuild/backend/test/historia.odczyt.test.ts`: nieznany `typ` → pusta strona, `pages: 1`.
- `rebuild/backend/test/historia.wyrocznia.test.ts`: tylko komentarz warunku ważności.
  **`historia.wyrocznia.json` bez zmian.**

## Odstępstwa od planu

Brak merytorycznych. Drobiazg techniczny: prettier bez konfiguracji w repo formatuje do 80
kolumn, a kod jest w stylu 100, więc zmiany sformatowano `--print-width 100`, a szum
formatowania w nieruszanych plikach cofnięto.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. `test/historia.gate.test.ts`
  (`GET /api/history/meta` ↔ `contract/fixtures/GET_history_meta.json`, `GET /api/history/paged`
  ↔ `GET_history_paged.json`, plus `GET /api/history` ↔ `GET_history.json`, walidacja względem
  `contract/openapi.yaml`) bez zmian i zielony. Kształt odpowiedzi nie zmienił się, więc
  przenagranie fixtures nie było potrzebne (backlog #87 zakładał, że będzie).
- **Wyrocznia:** ✓ `test/historia.wyrocznia.test.ts` 13/13, **bez wyjątku**, JSON nietknięty.
- **Test odstępstwa:** ✓ `test/historia.powyzej-progu.test.ts` 7/7. Wykazano, że 5 z 6
  przypadków powyżej progu pada na starym kodzie, a przypadek remisu pada bez `id DESC`.
- **Testy historii razem:** 99 → 113.
- **Bramki backendu:** `npm run lint` ✓, `npm run typecheck` ✓, `npm run build` ✓,
  `npm test` ✓: **86 plików, 1337 testów, wszystkie przechodzą.**
- Frontend: nie dotyczy (kontrakt i fixtures bez zmian, FE nietknięty).

## Zmiany łamiące zgodność

Brak w kontrakcie. **Zmiana zachowania (zamierzona):** powyżej 5000 wierszy `audit_log` widok
pokazuje więcej wpisów niż stary Bridge, a `N wpisów` jest większe. Przy równym `kiedy`
kolejność jest teraz deterministyczna (`id DESC`); w oryginale była nieokreślona.

## Follow-up

1. **Karta P5.3 (delta I5-v2):** `docs/instrukcja-testow-I5.md` §11 pkt 9 („ekran czyta 5000
   najświeższych zdarzeń… z czasem wypłynie”) po tej karcie PRZESTAJE być prawdziwa.
   Sprostowanie należy do P5.3. Ta karta pliku celowo nie rusza. Warto przy tym dodać
   Ani, że w starym Bridge próg jest najpewniej już przekroczony (tempo z sekcji Zadanie 1),
   więc przy porównaniu obok siebie **licznik `N wpisów` i najstarsze wpisy mogą się różnić
   na korzyść odbudowy**. To oczekiwane, nie zgłoszenie.
2. **Oracle-diff z 59-CHORE-i14j** (`oracle-diff-historii.cjs`) przy ponownym uruchomieniu na
   bazie z więcej niż 5000 wierszy `audit_log` pokaże rozjazdy z założenia (odbudowa oddaje
   więcej). Sam skrypt ich nie odróżni od regresji. Rozpozna je dopiero nagrana z niego
   wyrocznia: zapisze `limitNieGryzie: false` (`oracle-diff-historii.cjs:894`), a pierwszy
   warunek ważności w `historia.wyrocznia.test.ts` zaświeci. Przenagrywając, trzeba więc brać
   bazę poniżej progu. Nie ruszam skryptu, bo jest artefaktem zamkniętej karty.
