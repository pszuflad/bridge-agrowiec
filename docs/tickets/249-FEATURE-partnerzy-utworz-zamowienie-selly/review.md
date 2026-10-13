# 249-FEATURE-partnerzy-utworz-zamowienie-selly — Code review

> Reviewed: 2026-10-13
> Branch: claude/peaceful-gates-a8yebr
> Diff: 25 plików (+560/−61), 1 commit (cea5257)

Uwaga: nie uruchamiałem testów; opieram się na raport.md ("lint/typecheck czyste", testy zielone).

## BLOCKER

- [ ] `rebuild/backend/src/partnerzy/podglad-selly.ts:177-181` — każdy wyjątek z `createOrder` (timeout 30 s, zerwane połączenie, HTTP 5xx/502/504 od proxy) cofa zamówienie do `przyjete` i zwraca 502 "Selly odrzuciło zamówienie".
  - Reason: to dokładnie ścieżka duplikatu. `POST /api/orders` mógł zostać przyjęty przez sklep, a odpowiedź nie dotarła (`zapytaj` w `selly/klient.ts` przerywa fetch po `DOMYSLNY_TIMEOUT_MS`=30 s, a samo Selly może być wolne przy zapisie). Zamówienie wraca do `przyjete`, przycisk znów aktywny, a komunikat mówi "odrzuciło", więc człowiek kliknie drugi raz i w żywym sklepie powstaje drugie zamówienie. Docelowo błąd rozstrzygnięty (HTTP 4xx z ciałem od sklepu) wolno cofać, ale błąd niejednoznaczny (abort/timeout, błąd sieci, 5xx) NIE.
  - Suggestion: rozróżnić `BladSelly` ze statusem 4xx (jednoznaczna odmowa, cofnięcie do `przyjete` OK) od reszty. Dla reszty zostawić `wysylanie` i zwrócić komunikat "wynik nieznany — sprawdź w Selly, czy zamówienie powstało" (plus ręczne odblokowanie, patrz SHOULD-FIX niżej). `BlokadaSelly` (tryb) również powinna cofać, bo zapytanie nie wyszło, ale lepiej sprawdzić tryb przed "zajęciem" (SHOULD-FIX).

## SHOULD-FIX

- [ ] `podglad-selly.ts:177-190` — brak wyjścia ze statusu `wysylanie`: nic w kodzie (backend/frontend) go nie obsługuje poza etykietą w UI, a `czyPodlegaWalidacji` go nie dotyka. Po crashu procesu albo po niejednoznacznym błędzie (patrz BLOCKER) zamówienie zostaje "wysyłanie do Selly…" na zawsze, bez przycisku.
  - Suggestion: akcja ręczna "Sprawdziłem w Selly: nie ma zamówienia → przywróć do przyjęte" albo "jest → wpisz numer" (z audytem), ewentualnie wpis w ostrzeżeniu na liście.
- [ ] `podglad-selly.ts:111-116,134` — wiązanie `selly_products`: `.where(bridgeKod = …).all().find(vid !== null)` bierze PIERWSZY wiersz z wariantem. `selly_products` ma unikat na `(kod_importu, dostawca)`, a nie na `bridge_kod`, więc jeden `bridge_kod` może mieć kilka wierszy (inne `kod_importu`/dostawca, stare/błędne powiązania, `ostatni_status` = błąd). Wybór jest cichy i zależny od kolejności wierszy (bez `ORDER BY`), więc zamówienie może pójść na zły produkt/wariant w sklepie. Brak też sprawdzenia `ostatni_status`.
  - Suggestion: gdy kandydatów z `vid` jest >1 z różnymi `(pid,vid)` — blokada "niejednoznaczne powiązanie"; ignorować wiersze w statusie błędu; dodać test z dwoma wierszami.
- [ ] `podglad-selly.ts:139-141` — `cena === 0` przechodzi kontrolę (`!(x.cena >= 0)` odrzuca tylko null/NaN/ujemne). Pozycja za 0 EUR do żywego sklepu to prawie na pewno błąd danych. Również `waluta: z.waluta ?? "EUR"` po cichu zakłada EUR, gdy waluty brak (TyreWorld ma `waluta: null` — tam to świadome, ale wtedy zamówienie idzie z `exchange_rate`; do decyzji, najlepiej ostrzeżenie).
- [ ] `podglad-selly.ts:143-144` — kurs: bierze OSTATNI zapisany wiersz `kursy_nbp` bez sprawdzenia wieku. Może to być kurs sprzed tygodni/miesięcy (zapis tylko przy generowaniu cennika). Do ciała idzie bez ostrzeżenia o dacie.
  - Suggestion: ostrzeżenie lub blokada, gdy `data` starsza niż np. 5 dni; pokazać datę kursu w podglądzie. Kierunek `exchange_rate` jest NIEZNANY (wiadomo z planu), ale ciało nie pokazuje nawet skąd jest ten kurs.
- [ ] `podglad-selly.ts:155-157` (+ `adresDostawy`) — ISO kraju dostawy: `adres.kraj.toUpperCase().slice(0, 2)`. Gdy `COUNTRY`/`lkz` to pełna nazwa ("Germany", "Deutschland") wyjdzie "GE"/"DE" przypadkowo/błędnie; gdy pusty — `delivery_country_iso2: ""` bez żadnego ostrzeżenia (ostrzeżenie dotyczy tylko ulicy/kodu/miasta).
  - Suggestion: wymagać `^[A-Za-z]{2}$`, inaczej blokada (albo ostrzeżenie + puste).
- [ ] `podglad-selly.ts:100-103,152-166` — adres Adtyres: jedyny przykład w repo (`test/partnerzy.zamowienie-przyklad.ts:12`) ma w `DELIVERY` TYLKO `CUSTOMERNAME/COUNTRY/PHONE`. Klucze `STREET`/`ZIP`/`CITY`/`EMAIL` w `adresDostawy` są zgadywane. Praktycznie każde zamówienie Adtyres da pusty `ship_address/postcode/city` i `email: ""`, a to tylko "ostrzeżenie" — przycisk pozostaje aktywny i do żywego sklepu pójdzie zamówienie bez adresu dostawy (i z pustym `email`, który Selly może odrzucić lub zapisać klienta bez maila). Formaty TyreWorld (`name/name2/strasse/plz/ort/lkz/telefon`) wyglądają spójnie z parserem (`lieferadresse`), ale `email` też nie występuje w żadnym z wzorców.
  - Suggestion: przynajmniej dla pierwszej próby uczynić brak ulicy/kodu/miasta BLOKADĄ albo wymagać potwierdzenia ostrzeżeń; zweryfikować nazwy kluczy na prawdziwym pliku Adtyres.
- [ ] `podglad-selly.ts:148-170` — `zamawiajacy.kraj` jest wymagany (BRAKUJE), ale NIE trafia do ciała (brak `invoice_country_iso2` lub podobnego). Dla partnera zagranicznego (EUR, VAT 0 %) faktura może wyjść z domyślnym krajem sklepu (PL) — to błąd merytoryczny faktury. Do potwierdzenia w GET wzorcu, ale pole jest zebrane i walidowane, więc jego brak w ciele wygląda na przeoczenie. Również `invoice_as_ship: 0`, `invoice_type: "faktura"` są zgadnięte.
- [ ] `podglad-selly.ts:171-175` + `routes/partnerzy.ts:283-288` — tryb `SELLY_TRYB=tylko-odczyt`/`wylaczony` blokuje `createOrder` poprawnie (proxy w `selly/tryb.ts`, `createOrder` w `METODY_ZAPISUJACE`; test kompletności rozszerzony), ale dopiero PO "zajęciu" zamówienia; użytkownik dostanie 502 "Selly odrzuciło zamówienie: [Selly] Zapis zablokowany…" (mylące), a `tworzenieWlaczone` w podglądzie mówi `true` mimo trybu read-only (przycisk aktywny). Brak testu integracyjnego trasy z klientem opakowanym `opakujKlientaTrybem`.
  - Suggestion: przekazać do podglądu informację o trybie i traktować go jak flagę (403/409 przed zajęciem), `BlokadaSelly` mapować na 403, nie 502.
- [ ] `podglad-selly.ts:195-197` — fallback `numerWlasny = "wysłano (Selly nie zwróciło numeru)"` jest zapisywany w polu numeru i potem blokuje ponowienie (`numerWlasny` niepuste), co jest dobre, ale w tym wypadku nie zostaje żaden ślad id zamówienia; `idSelly` zwracane tylko w odpowiedzi HTTP, nie zapisane w DB ani w audycie. Przy nieznanym formacie odpowiedzi (a ten jest NIEZNANY) to realny scenariusz pierwszej próby. Zapisać surową odpowiedź (skróconą, bez danych osobowych) w audycie/logu.
- [ ] `routes/partnerzy.ts:276-286` — audyt tylko po sukcesie. Próby nieudane (502, niejednoznaczne, zajęcie → `wysylanie`) nie zostawiają śladu "kto kliknął i kiedy". Dla zapisu do żywego sklepu warto audytować również start próby (przed wywołaniem) z `zamowienieId`.
- [ ] `repos/partnerzy.ts:153-158` — walidacja ID dopuszcza `0` (`v >= 0`) i dowolnie duże liczby całkowite (np. `1e300` przechodzi `Number.isInteger`). ID Selly zaczynają się od 1; `0` jest "ustawione" i przechodzi blokadę "brak identyfikatorów". Zmienić na `>= 1` i `Number.isSafeInteger`. (Frontend ma `^\d+$`, ale też przepuszcza `0`.)
- [ ] Testy: brak testów dla (a) timeoutu/5xx przy `createOrder` (zachowanie z BLOCKER), (b) kilku wierszy `selly_products` na jeden `bridge_kod`, (c) `cena = 0`, (d) kraju niedwuliterowego, (e) formatu TyreWorld w `adresDostawy` (czy jest w teście `podglad-selly`, nie potwierdziłem). Test "9 przypadków" nie obejmuje ścieżek niejednoznacznych.
- [ ] Dokumentacja: nowa flaga `PARTNERZY_SELLY_ZAMOWIENIA` i endpoint `POST …/utworz-w-selly` (+ nowe pola w `GET …/podglad-selly`) — sprawdzić, że są w `docs/` (wpis-249 jest, 3 linie) oraz w `contract/openapi.yaml`, jeśli partnerzy tam są (nie sprawdzałem; GATE kontraktu).

## NICE-TO-HAVE

- [ ] `ZamowieniaPartnera.tsx` (PodgladDoSelly) — po kliknięciu "Tak, utwórz" serwer przelicza ciało od nowa; ciało pokazane w `<details>` mogło się zmienić (kurs, ustawienia partnera) między podglądem a kliknięciem. Można odesłać skrót ciała i porównać po stronie serwera (409, gdy inny).
- [ ] `UstawieniaPartnera.tsx` — nowe pola "Selly: ID …" wstawione między "Faktura: miasto" a "Faktura: kraj"; rozdzielają grupę pól faktury (kosmetyka). Brak opisu, skąd wziąć ID (słowniki są pod `listOrderStatuses` itd.) — rozważyć wybór z listy zamiast wpisywania liczb.
- [ ] `routes/partnerzy.ts:276-279` — przy braku klienta Selly (503) sprawdzenie następuje przed flagą (403); kolejność odwrotna dałaby czytelniejszy komunikat, gdy flaga wyłączona.
- [ ] Wiadomość 502 przenosi do UI `raw.slice(0,800)` odpowiedzi sklepu (`[Selly] HTTP … :: …`); Selly może odesłać dane klienta w komunikacie walidacji. Nie jest logowane przez ten kod (OK), ale trafia do toasta; rozważyć skrót.
- [ ] Zamówienie z kilkoma pozycjami o tym samym `bridge_kod` generuje osobne linie `products` — bywa OK, ale można zsumować.

## Plan compliance

### Done ✓
- Migracja 034 (`@dodaj-kolumne-jesli-brak`, idempotentna, NULL domyślnie) + schema.ts + wpis w `rebuild/schema/README.md` + test migracji; edycja w ustawieniach partnera.
- Pozycje → Selly przez lokalne `selly_products`, bez wołania sklepu przy podglądzie.
- Podgląd rozszerzony o `ostrzezenia`, `zadanie` (null przy blokadach), `tworzenieWlaczone`.
- `POST …/utworz-w-selly` + `createOrder` jako metoda ZAPISUJĄCA (blokowana w `tylko-odczyt` przez proxy; test kompletności zaktualizowany).
- Flaga domyślnie wyłączona (`flagaBoolDomyslnieWylaczona`), 403 bez flagi, przycisk nieaktywny.
- Panel: dwa kliknięcia, ciało widoczne przed wysyłką.
- Zajęcie zamówienia atomowo przed wywołaniem (UPDATE z warunkiem `przyjete` + `numer_wlasny IS NULL`, sprawdzenie `changes === 1`; w jednym procesie better-sqlite3 jest synchroniczny, więc między podglądem a zajęciem nie ma `await` — podwójne kliknięcie daje 409). Audyt zawiera tylko `zamowienieId` i `numerWlasny` — brak danych osobowych w audycie/logach.

### Missing or deviating ✗
- Plan: "błąd sklepu → powrót do `przyjete`" — zaimplementowane dla WSZYSTKICH błędów, w tym niejednoznacznych; sprzeczne z głównym celem "brak duplikatów" (BLOCKER).
- Plan wymienia blokadę "brak dopasowania/powiązania pozycji" — nie obsłużone powiązanie niejednoznaczne (wiele wierszy `selly_products`).
- Poza planem, ale brakujące: obsługa/odblokowanie `wysylanie`, dane kraju faktury w ciele.
- Nic spoza zakresu ("tracking, wiadomości, automatyka") nie wsunęło się.

### Definition of done
- [x] Flaga domyślnie wyłączona; bez niej 403 i zero wywołań Selly (test).
- [x] Tryb `tylko-odczyt` blokuje `createOrder` na poziomie klienta (proxy), test kompletności.
- [x] Migracja idempotentna, nowe kolumny nullable.
- [x] Podgląd ciała przed wysłaniem; jedno zamówienie na kliknięcie (409 przy drugim).
- [ ] Brak duplikatów w każdej ścieżce błędu — timeout/5xx po stronie sklepu może dać duplikat (BLOCKER).
- [ ] Zamówienie nie zostaje w `wysylanie` bez powodu / da się je odblokować — brak mechanizmu.
- [ ] Wszystkie blokady zatrzymują wysyłkę — luki: cena 0, niejednoznaczne powiązanie, stary kurs, pusty/zły kraj.

## Parallel-test concerns

None — testy backendu (`partnerzy.podglad-selly.test.ts`) używają bazy tymczasowej, atrapy Selly i portów efemerycznych; testy frontendu na MSW. Nie widzę zasobów wyłącznych.

## Overall assessment

Konstrukcja jest przemyślana (flaga, atomowe zajęcie, tryb przez proxy, podgląd ciała, audyt bez danych osobowych), ale mechanizm "zajmij → wywołaj → cofnij" jest niebezpieczny przy błędach niejednoznacznych: timeout lub 5xx po udanym zapisie cofa status i zaprasza do drugiego kliknięcia, czyli do duplikatu w żywym sklepie. Do naprawy przed merge. Dodatkowo kilka blokad ma luki (powiązania wielokrotne, kraj, adres, cena 0, wiek kursu).

Co do NIEZNANEGO kontraktu `POST /api/orders`: podgląd ciała jest dobrą podstawą, ale NIE wystarcza do bezpiecznej pierwszej próby, dopóki: (1) ciało nie zawiera kraju faktury, (2) brak adresu dostawy i pusty email to tylko ostrzeżenie, (3) niejednoznaczny wynik (timeout/nieznany format odpowiedzi) nie zostawia śladu id ani nie blokuje ponowienia, (4) podgląd nie pokazuje daty i kierunku użytego kursu. Przed pierwszym włączeniem flagi sugeruję próbę na zamówieniu testowym ze sklepem w trybie, w którym da się je usunąć.
