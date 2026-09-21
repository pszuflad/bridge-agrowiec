# 69-FEATURE-historia-bez-limitu: Historia przestaje gubić najstarsze zdarzenia (P5.1, backlog #87)

> Status: Implemented
> Branch: `feature/69-historia-bez-limitu`
> Worktree: `.worktrees/69-FEATURE-historia-bez-limitu`

## Opis ticketa

P5.1, Iteracja 5: backlog #87, wariant (c), czyli filtrowanie w SQL zamiast przycinania surowego
`audit_log` do 5000 wierszy. Decyzję wdrożenia podjął użytkownik 2026-09-21. Odrzucone warianty:
(a) zostawić 1:1, (b) podnieść limit.
Naprawa ma usunąć oba objawy: (1) najstarsze wpisy przestają być nieosiągalne; (2) `total`
i lista dostawców w `/meta` liczą WSZYSTKIE pasujące zdarzenia, a nie tylko te z ostatnich
5000 wierszy.

## Kontekst

- Produkcja: `U.listAudit(5e3)` w obu handlerach (`deminified/backend-index.cjs:48336`, `:48358`).
  Port: `LIMIT_AUDYTU = 5000` w `rebuild/backend/src/historia/mapowanie.ts`, używany przez
  `routes/history.ts` (`/meta`, `/paged`) przez `listaAudytu()` z `repos/audit.ts`.
- `db/snapshot.db` (zmierzone 2026-09-21): `audit_log` ma 3873 wiersze w 22 akcjach. Przez
  słownik przechodzi 270 z nich (`edycja_produktu` 178, `upload_pliku` 92), sam `auto_pull` to 2869.
  Tempo zapisu to ok. 2400 wierszy na miesiąc w lipcu i 1476 w sierpniu (snapshot urywa się
  w sierpniu). **Próg 5000 w produkcji został więc najpewniej już przekroczony.**
- **Pomiar kolejności (kluczowe ryzyko wariantu c):** dziś SQL sortuje tekstowo po `kiedy`,
  a potem JS sortuje stabilnie po `new Date(kiedy)`. W snapshocie wszystkie 3873 `kiedy` mają
  jeden format (24 znaki, ISO, `Z`), remisów jest 0, a inwersji między porządkiem tekstowym
  a porządkiem `Date` też 0. W odbudowie jedynym pisarzem jest `zapiszAudyt()`
  (`toISOString()`), więc format jest jednolity z konstrukcji.

## Zadanie 1: wynik weryfikacji hipotezy (przed kodem)

**Hipoteza potwierdzona.** Prototyp (odsiew akcji w SQL bez limitu, `ORDER BY kiedy DESC, id DESC`)
przeszedł 99/99 testów historii, w tym `historia.wyrocznia.test.ts` 13/13, bez żadnego wyjątku.
Na obecnym kodzie nowy test powyżej progu (`test/historia.powyzej-progu.test.ts`, 5200 wierszy
`auto_pull` nad wpisami widocznymi) **pada 5/6**: `total` 9 zamiast 12, najstarsze wpisy
niedostępne, `/meta` bez dostawcy z najstarszego wpisu. Po zmianie przechodzi 6/6.

⚠ Zastrzeżenie co do siły dowodu: wyrocznia zasiewa WYŁĄCZNIE 270 wierszy ze słownika, więc
z konstrukcji nie widzi, czy odsiew dzieje się w SQL, czy w pamięci. Samo „przechodzi" to słaby
dowód. Mocny dowód daje pomiar danych z sekcji Kontekst: jednolity format i brak remisów
sprawiają, że porządek z SQL jest identyczny z porządkiem z JS.

**Scenariusz powyżej progu: dokładamy, ale NIE do wyroczni.** Oryginał w tym reżimie gubi wpisy
z założenia, więc nie ma czego z nim porównywać. To test świadomego odstępstwa, w osobnym pliku.

## Kontrakt i fixtures (zakres)

- `GET /api/history/meta` → `contract/fixtures/GET_history_meta.json`
- `GET /api/history/paged` → `contract/fixtures/GET_history_paged.json`
- Kształt odpowiedzi BEZ ZMIAN (te same klucze i typy). `contract/openapi.yaml` nie wspomina
  limitu, więc kontrakt się nie zmienia. Fixtures nagrano przy mniej niż 5000 wierszach, więc
  wartości też pozostają aktualne. **Kontrakt i fixtures nietknięte.** (Backlog #87 zakładał, że
  wariant c wymaga przenagrania fixtures. Pomiar pokazuje, że nie wymaga.)
- Wyrocznia `test/historia.wyrocznia.json` bez zmian; aktualizujemy tylko komentarz przy
  warunku ważności.

## Decyzje

- **D1 (użytkownik, 2026-09-21): wariant (c)** zamiast (a) lub (b).
- **D2 (użytkownik, 2026-09-21): hybryda.** W SQL: odsiew do akcji ze słownika (przy
  konkretnym `typ` tylko do akcji tego typu) plus sortowanie, bez limitu. W pamięci, bez zmian:
  mapowanie, `dostawca`, fraza, `total`, paginacja.
  - Dlaczego fraza zostaje w pamięci: trafia w pola WYLICZANE (`typ`, `format`, „Plik: …”,
    `zmienionePola`) na zmapowanym wpisie (instrukcja I5 §11 pkt 4). Przetłumaczenie jej na
    SQL zmieniłoby semantykę. Odrzucone też tłumaczenie frazy na listę wartości `akcja`,
    bo fraza trafia również w kod, plik i użytkownika.
  - Dlaczego `dostawca` zostaje w pamięci: to pole wyliczane (`encja_id` przy
    `encja_typ='dostawca'`, w przeciwnym razie `szczegoly.dostawca`, i to tylko gdy jest
    stringiem, po parsowaniu JSON). Wersja SQL (`json_extract`) byłaby drugą kopią mapowania,
    czyli mechanizmem backlogu #41.
  - Koszt: każde żądanie mapuje wszystkie widoczne zdarzenia (dziś 270, przybywa
    ok. 130 na miesiąc), a nie wszystkie wiersze `audit_log`. Konsekwencja: paginacja nie
    trafia do SQL, więc odchodzimy od litery wariantu (c), zachowując jego skutek.
- **D3: słownik akcja→typ pozostaje JEDNYM źródłem prawdy.** Staje się stałą-mapą
  w `mapowanie.ts`. Z niej wyliczamy i `typWpisu()`, i listę akcji do klauzuli `IN`. Mapa to
  `Map`, a nie literał obiektu, żeby `typWpisu("constructor")` nie trafiało w prototyp.
- **D4: rozstrzygnięcie remisów `id DESC`.** Oryginał przy równym `kiedy` ma kolejność
  nieokreśloną (plan SQLite plus stabilny sort JS). Dokładamy `id DESC`, żeby paginacja była
  deterministyczna. W danych produkcji remisów jest 0, więc nic się nie zmienia.
  Stabilny sort JS w `stronaHistorii()` zachowuje ten porządek.
- **Świadome odstępstwo od oryginału:** brak limitu 5000 (backlog #87 → ✅ TAK, wariant c).
  Poniżej progu wynik jest identyczny z oryginałem (wyrocznia). Powyżej progu odbudowa pokazuje
  wszystko, a oryginał gubi najstarsze wpisy.

## Plan implementacji

1. `src/historia/mapowanie.ts`:
   - `SLOWNIK_AKCJI: ReadonlyMap<string, TypWpisu>` (pięć wpisów, jak dziś);
   - `typWpisu(akcja)` = `SLOWNIK_AKCJI.get(akcja) ?? null`;
   - `akcjeHistorii(typ: string): string[]`: dla `"all"` wszystkie akcje, dla znanego typu
     akcje tego typu, dla nieznanego `[]` (w pamięci też daje zero trafień, więc spójnie);
   - usunąć `LIMIT_AUDYTU`, zaktualizować nagłówek i komentarze.
2. **Nowy** `src/repos/audit-historia.ts`: `audytDlaHistorii(db, akcje)`, czyli
   `select().from(auditLog).where(inArray(akcja, akcje)).orderBy(desc(kiedy), desc(id))`.
   `inArray([])` daje w Drizzle 0.45 `false`, więc pusta lista to pusty wynik.
3. `src/routes/history.ts`: `/meta` → `audytDlaHistorii(db, akcjeHistorii("all"))`;
   `/paged` → `akcjeHistorii(typ)`, a reszta bez zmian. `stronaHistorii()` bez zmian
   (filtr `typ` w pamięci zostaje: nic nie kosztuje, a funkcja zostaje czysta).
4. `src/repos/audit.ts`: tylko komentarz przy `listaAudytu` („historia woła 5000” przestaje
   być prawdą w odbudowie). `/api/audit-log` (`listaAudytu(db, 500)`) bez zmian.
5. Testy (niżej), bramki, raport.

## Strategia testów

- **GATE:** `historia.gate.test.ts` (fixtures `GET_history_meta.json`, `GET_history_paged.json`
  plus walidacja `openapi.yaml`) bez zmian i zielony.
- **Wyrocznia:** `historia.wyrocznia.test.ts` bez wyjątków i bez zmian w JSON-ie.
- **Nowy** `test/historia.powyzej-progu.test.ts`: reżim powyżej 5000 wierszy, oba objawy plus
  fraza po polu wyliczanym i filtry typ/dostawca. Wykazano, że pada na starym kodzie.
- `historia.mapowanie.test.ts`: `akcjeHistorii()` (all, typ, nieznany, `"constructor"`),
  słownik vs `typWpisu`, jedno źródło prawdy.
- `historia.odczyt.test.ts`: remis czasowy rozstrzygany `id DESC`; nieznany `typ` → pusta
  strona przez pustą listę akcji.

## Poza zakresem

- `GET /api/history` (tabela `history`, `repos/dziennik-zmian.ts`) — nie ruszamy.
- `GET /api/audit-log` (limit 500) — inna trasa, bez zmian.
- `docs/instrukcja-testow-I5.md` §11 pkt 9 — sprostowanie należy do karty P5.3.
- Kontrakt i fixtures.
- Rozszerzenie słownika (#21 rozstrzygnięty na NIE).

## Definicja ukończenia

- [x] `LIMIT_AUDYTU` usunięty; `/meta` i `/paged` nie tną `audit_log`
- [x] słownik akcji ma jedno źródło; klauzula `IN` z niego wyliczana
- [x] test powyżej progu zielony (pada na starym kodzie, wykazane)
- [x] wyrocznia 13/13 bez wyjątku, GATE zielony
- [x] lint, typecheck, build, test zielone
- [x] roadmapa (P5.1) i backlog #87 zaktualizowane; follow-up P5.3 w raporcie
