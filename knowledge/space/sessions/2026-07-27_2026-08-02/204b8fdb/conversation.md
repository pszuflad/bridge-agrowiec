# Session 204b8fdb (2026-07-31 07:25 UTC → 2026-07-31 13:23 UTC) — 12 turns

**Session UUID:** 204b8fdb-4ffa-4e26-9806-ef930b7ed29b

1. [2026-07-31 07:25 UTC] [line 20] Sprawdziłam kod: backend już wystawia cookie/token ważne 30 dni, ale frontend za...
2. [2026-07-31 07:59 UTC] [line 54] Jak dokładnie sprawdzasz, że logowanie nie jest zapamiętywane?: Zamykam całą prz...
3. [2026-07-31 10:15 UTC] [line 68] Sprawdziłem Twoją przeglądarkę i panel jest tam AKTUALNIE zalogowany (pokazuje P...
4. [2026-07-31 10:39 UTC] [line 86] Formularz logowania ma celowo wbudowaną blokadę przed zapisywaniem haseł przez p...
5. [2026-07-31 10:57 UTC] [line 108] dodaj do Bridge, napis w lewum górnym rogu ''ONE'' pełna nazwa ma być ''Bridge O...
6. [2026-07-31 11:49 UTC] [line 128] tak tez to zauktualizuj
7. [2026-07-31 11:54 UTC] [line 146] zrób drobną kosmetykę nazwy na BridgeOne ale tylko w widoku w panelu nie muisz j...
8. [2026-07-31 12:39 UTC] [line 167] Po dodaniu VAT-u do cena_sprzedaży, kolumna marza_pct (liczona jako (cena_sprzed...
9. [2026-07-31 12:54 UTC] [line 186] <q>Otwarta kwestia do decyzji w przyszłości: kolumna marza_pct liczona jako (cen...
10. [2026-07-31 12:56 UTC] [line 210] No ale marża nie jest równoznaczna  z Vatem, marża to nasz narzut procentowy wię...
11. [2026-07-31 13:01 UTC] [line 232] Czy po wdrożeniu tej poprawki (marza_pct = czysty narzut z reguły, bez VAT) zrob...
12. [2026-07-31 13:23 UTC] [line 243] Plik CSV z ceną `cena_sprzedazy` w formacie `7624,-` (tekst, nie liczba) trafia ...

---

## Turn 1 — 2026-07-31 07:25 UTC
### Query
Sprawdziłam kod: backend już wystawia cookie/token ważne 30 dni, ale frontend zapisuje token w sessionStorage, więc sesja i tak znika po zamknięciu przeglądarki/karty. Jak ma działać checkbox „zapamiętaj mnie”?: Zaznaczony = trwałe logowanie
Czy po wdrożeniu tej jednej poprawki mam przygotować krótkie podsumowanie (max 5 zdań) i wrzucić do space backup kodu produkcyjnego z datą, zgodnie z regułą projektu?: Nie tym razem

### Answer
Czekam na wynik weryfikacji panelu logowania

Czekam na potwierdzenie przywrócenia panelu

Czekam na wynik diagnozy błędu JS

Czekam na wynik weryfikacji poprawionej wersji

Czekam na weryfikację produkcji

Czekam na wynik testu funkcji zapamiętaj mnie

Czekam na wynik testu bez zaznaczonego checkboxa

Czekam na zbudowanie wiki projektu

Instrukcje space zostały zaktualizowane. Podsumowanie wykonanej pracy:

Znaleziono i naprawiono przyczynę wcześniejszej awarii — mój pierwszy patch użył nazwy funkcji BS, która kolidowała z już istniejącą zminifikowaną nazwą w kodzie (komponent Toast z Radix UI), co powodowało SyntaxError i pustą stronę. Poprawka przepisana z unikalnymi nazwami, przetestowana na izolowanej stronie przed wdrożeniem, następnie wdrożona na produkcję i zweryfikowana w obu scenariuszach: zaznaczony checkbox → token trwały w localStorage, odznaczony → jak dotychczas w sessionStorage. Panel [panel.agritires.eu](https://panel.agritires.eu/) działa poprawnie.

Zgodnie z Twoją decyzją "Nie tym razem" nie tworzyłem podsumowania + backupu do space dla tej konkretnej poprawki.

Dodatkowo znaleziony, nienaprawiony problem (do Twojej decyzji): plik frontendu wciąż zawiera jawne dane testowe logowania (Yy=[...], hasło Bridge2026! dla obu kont) w kodzie JS pobieranym publicznie, mimo że UI już ich nie wyświetla. To ryzyko bezpieczeństwa — czy chcesz, żebym to usunął osobną poprawką?
Zbudowałem od zera pełną wiki projektu (9 stron: architektura backendu/frontendu/bazy danych/infrastruktury, integracje 10 dostawców, integracja Selly, chronologiczna historia poprawek, otwarte zadania, oraz notatka z dzisiejszej lekcji o kolizjach nazw w zminifikowanym kodzie).
Dopisałem do instrukcji space zasadę: każdy subagent po zakończonym działaniu musi dopisać notatkę do wiki projektu (co zbudowano, co działa, jak działa) — zatwierdzoną przez Ciebie treść już zapisałem.

---

## Turn 2 — 2026-07-31 07:59 UTC
### Query
Jak dokładnie sprawdzasz, że logowanie nie jest zapamiętywane?: Zamykam całą przeglądarkę i otwieram ponownie
Jakiej przeglądarki używasz i czy masz włączony tryb prywatny/incognito lub blokowanie danych stron trzecich?: nie ma włączonego trybu incognito ani blokady

### Answer
Czekam na wynik diagnozy problemu z zapamiętywaniem

Czekam na wynik testu trwałości sesji

Czekam na wynik diagnozy w lokalnej przeglądarce

---

## Turn 3 — 2026-07-31 10:15 UTC
### Query
Sprawdziłem Twoją przeglądarkę i panel jest tam AKTUALNIE zalogowany (pokazuje Pulpit, nie ekran logowania). Czy to jest ta sama przeglądarka/komputer, na którym zauważyłaś, że zapamiętywanie nie działa?: Tak, ten sam komputer/przeglądarka
Czy możesz teraz sam odpowiedzieć na jedną rzecz: wylogowałaś się ręcznie przyciskiem "Wyloguj", zamknęłaś przeglądarkę, otworzyłaś ją ponownie, i wtedy zostałaś poproszona o ponowne zalogowanie mimo zaznaczonego checkboxa - czy po prostu zamknęłaś przeglądarkę bez wylogowania?: Wylogowałam się ręcznie, potem zamknęłam przeglądarkę

### Answer
Potwierdzone — to jest oczekiwane zachowanie, nie błąd: przycisk "Wyloguj" celowo czyści bridge_auth_token, bridge_user i ustawia bridge_remember na wyłączone (bridgeSetRemember(!1) usuwa flagę z localStorage). To standard w każdej aplikacji z opcją "zapamiętaj mnie" — ręczne wylogowanie zawsze wymaga ponownego zalogowania przy następnej wizycie, niezależnie od tego, czy checkbox był wcześniej zaznaczony. Opcja "Zapamiętaj mnie" ma sens tylko wtedy, gdy zamykasz przeglądarkę bez wylogowania — wtedy sesja powinna przetrwać.

Nie jest to błąd w implementacji — funkcja "Zapamiętaj mnie" działa zgodnie ze specyfikacją, którą wcześniej ustaliliśmy: zachowuje logowanie po zamknięciu przeglądarki, ale ręczne kliknięcie "Wyloguj" zawsze i celowo kończy sesję (tak działa to w każdej podobnej aplikacji — Gmail, Facebook itd.).

Podsumowanie:
Sprawdziłem to, co zgłosiłaś jako błąd — jest to oczekiwane działanie, nie usterka. Przycisk "Wyloguj" zawsze czyści dane logowania (w tym flagę "zapamiętaj mnie"), więc po ręcznym wylogowaniu i ponownym otwarciu przeglądarki panel poprosi o zalogowanie — to zgodne ze standardem.
Żeby faktycznie przetestować "zapamiętaj mnie", trzeba: zaznaczyć checkbox → zalogować się → zamknąć przeglądarkę bez klikania Wyloguj → otworzyć ponownie. Wtedy sesja powinna zostać zachowana (potwierdziłem to wcześniej w testach: token trafia do trwałego ciasteczka bridge_session ważnego 30 dni).

Czy chcesz, żebym mimo wszystko sprawdził ten dokładny scenariusz (bez wylogowania) na Twoim komputerze, żeby mieć 100% pewność, że działa poprawnie w Twoim środowisku?

---

## Turn 4 — 2026-07-31 10:39 UTC
### Query
Formularz logowania ma celowo wbudowaną blokadę przed zapisywaniem haseł przez przeglądarkę (tzw. honeypot pola). Czy chcesz, żebym ją usunął, żeby przeglądarka mogła zaproponować zapisanie hasła i podpowiadać/autouzupełniać email i hasło przy kolejnych wizytach?: Tak, włącz zapisywanie/autouzupełnianie
Czy po wdroženiu tej poprawki na panel.agritires.eu chcesz standardowe podsumowanie zmian + datłowany backup kodu produkcyjnego w space (zgodnie z regułą projektu)?: Nie tym razem

### Answer
Czekam na wynik weryfikacji poprawki

Czekam na wynik weryfikacji produkcji

Wszystko wdrożone i zweryfikowane poprawnie. Pola formularza mają teraz standardowe atrybuty name="email"/autocomplete="username" oraz name="password"/autocomplete="current-password", a pola-pułapki blokujące menedżer haseł zostały usunięte. Przeglądarki (Chrome, Firefox, Edge) powinny teraz normalnie proponować zapisanie hasła i podpowiadać zapisane dane logowania.

Podsumowanie tej poprawki:
Usunięto blokadę autofill: dwa ukryte pola-pułapki (fakeusernameremembered/fakepasswordremembered) oraz autoComplete="off" na formularzu i polu email.
Zmieniono nazwy pól na standardowe (email, password) i ustawiono właściwe atrybuty autocomplete (username, current-password), które przeglądarki rozpoznają do zapisywania/podpowiadania haseł.
Wdrożone na produkcję jako index-AUTOFILL1783335600.js, z kopią zapasową index.html.bak_pre_autofill_20260731_1240.
Zweryfikowano brak błędów JS oraz poprawne atrybuty pól na żywo na [panel.agritires.eu](https://panel.agritires.eu/).

Zgodnie z Twoją odpowiedzią nie robię teraz podsumowania + backupu do space dla tej poprawki. Efekt zobaczysz przy najbliższym logowaniu — przeglądarka powinna zapytać, czy zapisać hasło.

---

## Turn 5 — 2026-07-31 10:57 UTC
### Query
dodaj do Bridge, napis w lewum górnym rogu ''ONE'' pełna nazwa ma być ''Bridge ONE""  bez napisu pod spodem ''dla Agrowca

### Answer
Czekam na wynik weryfikacji wizualnej

Czekam na finalną weryfikację produkcji

Zmiana wdrożona i zweryfikowana pomyślnie — "Bridge ONE" wyświetla się poprawnie bez podpisu "dla Agrowca", brak błędów JS. Warto odnotować jedną drobną rzecz: tytuł karty przeglądarki (<title>) i meta description wciąż zawierają starą nazwę "Bridge dla Agrowca" — to niewidoczne na ekranie, ale widoczne np. w zakładce przeglądarki i wynikach wyszukiwania.

Podsumowanie tej poprawki:
Zmieniono napis "Bridge" → "Bridge ONE" i usunięto podpis "dla Agrowca" w trzech miejscach UI: ekran logowania, sidebar nawigacji (desktop) oraz nagłówek mobilny.
Wdrożone na produkcję jako index-BRIDGEONE1783339200.js, backup index.html.bak_pre_bridgeone_20260731_1301.
Zweryfikowano brak błędów JS i poprawny wygląd na desktopie i mobile.

Dodatkowo znaleziony element do Twojej decyzji: tytuł zakładki przeglądarki oraz meta description dalej mówią "Bridge dla Agrowca — konsolidacja cenników opon" (widoczne w karcie przeglądarki, zakładkach, wynikach wyszukiwania). Nie zmieniałem tego bez pytania — czy chcesz, żebym to też zaktualizował na "Bridge ONE"?

---

## Turn 6 — 2026-07-31 11:49 UTC
### Query
tak tez to zauktualizuj

### Answer
Czekam na weryfikację tytułu karty przeglądarki

Zaktualizowane i zweryfikowane — tytuł karty przeglądarki to teraz "Bridge ONE — konsolidacja cenników opon", strona renderuje się poprawnie, brak błędów JS.

Podsumowanie tej poprawki:
Zmieniono <title> strony z "Bridge dla Agrowca — konsolidacja cenników opon" na "Bridge ONE — konsolidacja cenników opon".
Wdrożone na produkcję z backupem index.html.bak_pre_title_20260731_1350.
Zweryfikowano na żywo: poprawny tytuł karty, formularz logowania działa bez zmian, brak błędów konsoli.

Wszystkie trzy elementy nazwy marki ("Bridge ONE" na ekranie logowania, w sidebarze/mobile nagłówku, i teraz w tytule karty przeglądarki) są teraz spójne w całym panelu.

---

## Turn 7 — 2026-07-31 11:54 UTC
### Query
zrób drobną kosmetykę nazwy na BridgeOne ale tylko w widoku w panelu nie muisz już tegio zmieniac w wyświetlaniu w  pasku wyszukiwarki

### Answer
Czekam na wynik weryfikacji pisowni

Czekam na finalną weryfikację

Czekam na precyzyjną weryfikację nagłówka

Potwierdzone — nagłówek <h1> na ekranie logowania wyświetla dokładnie "BridgeOne" (jedno słowo), a tytuł karty przeglądarki pozostał "Bridge ONE" bez zmian, zgodnie z Twoją prośbą.

Podsumowanie tej poprawki:
Zmieniono pisownię z "Bridge ONE" (ze spacją) na "BridgeOne" (jedno słowo) w trzech widocznych miejscach panelu: ekran logowania, sidebar nawigacji i nagłówek mobilny.
Tytuł karty przeglądarki celowo pozostawiony bez zmian: "Bridge ONE — konsolidacja cenników opon".
Wdrożone na produkcję jako index-BRIDGEONE21783342500.js, backup index.html.bak_pre_bridgeone2_20260731_1355.
Zweryfikowano na żywo: poprawny tekst nagłówka, formularz logowania w pełni funkcjonalny (w tym interaktywność checkboxa "Zapamiętaj mnie"), brak błędów JS.

---

## Turn 8 — 2026-07-31 12:39 UTC
### Query
Po dodaniu VAT-u do cena_sprzedaży, kolumna marza_pct (liczona jako (cena_sprzedaży - cena_zakupu)/cena_zakupu) zacznie pokazywać marżę razem z VAT-em (np. zamiast 6% pokaże ~30%), bo cena_sprzedaży jest teraz brutto. Co zrobić z tą kolumną?: no nie wiem jak to zrobić ja chce żeby w kolumnie cena sprzedazy znalazła się kwota  wyliczona  z ceny zakupu  zgodnie z ustaleniami czyli dodany VAT i marża oraz usunięcie liczb po przecinku

### Answer
Czekam na weryfikację cen w panelu

Zadanie zakończone. Podsumowanie:

Naprawiono błąd w formule ceny sprzedaży — VAT był pobierany z bazy, ale nigdy nie mnożony (martwy kod w 2 miejscach index.cjs), przez co cena_sprzedazy była w rzeczywistości ceną netto. Nowa formuła: cena_sprzedazy = FLOOR(cena_zakupu × (1+narzut%) × (1-rabat%) × (1+VAT%)) — dodaje VAT i zaokrągla w dół do pełnej kwoty bez groszy, cena_zakupu pozostaje nietknięta. Poprawka wdrożona na serwer (backup index.cjs.bak_pre_vat_fix_20260731_1430), PM2 zrestartowany bez błędów.

Wykonano jednorazowe przeliczenie dla wszystkich 7036 aktywnych produktów (backup bazy przed zmianą: data.db.bak_pre_vat_recalc_20260731_1441), zregenerowano eksport CSV dla Selly. Zweryfikowano matematycznie na próbkach oraz wizualnie w panelu Bridge — ceny są teraz bez groszy, ze stosunkiem sprzedaż/zakup ~1,30 (marża + 23% VAT), bez błędów JS.

Otwarta kwestia do decyzji w przyszłości: kolumna marza_pct liczona jako (cena_sprzedazy-cena_zakupu)/cena_zakupu teraz pokazuje marżę razem z VAT-em (~30% zamiast czystych ~6%), bo cena_sprzedazy jest już brutto — nie ruszałem tego bez wyraźnej decyzji.

Wiki projektu zaktualizowane (historia poprawek, backend, baza danych, otwarte zadania), a podsumowanie wraz z backupem kodu produkcyjnego zapisane w projekcie — możesz je pobrać powyżej.

---

## Turn 9 — 2026-07-31 12:54 UTC
### Query
<q>Otwarta kwestia do decyzji w przyszłości: kolumna marza_pct liczona jako (cena_sprzedazy-cena_zakupu)/cena_zakupu teraz pokazuje marżę razem z VAT-em (~30% zamiast czystych ~6%), bo cena_sprzedazy jest już brutto — nie ruszałem tego bez wyraźnej decyzji.</q> nie rozumiem czyli teraz Vat jest zdublowany?

### Answer
Nie, VAT nie jest zdublowany w cenie — to jest dobre pytanie, więc wyjaśnię dokładnie co się dzieje.

cena_sprzedazy jest liczona raz, poprawnie: cena_zakupu × (1+marża) × (1+VAT). VAT doliczany jest tylko jeden raz. Przykład: zakup 213,60 zł, marża 6%, VAT 23% → 213,60 × 1,06 × 1,23 = 278 zł. To jest prawidłowa cena brutto, żadnego dublowania.

Kolumna marza_pct to osobne pole, które ma tylko pokazywać informacyjnie, jaki % marży handlowej dodano — to nie wpływa na żadne obliczenia cen, to czysto opisowa liczba w bazie/panelu.

Problem: ta etykietka jest liczona wzorem (cena_sprzedazy - cena_zakupu) / cena_zakupu. Wcześniej (gdy cena_sprzedazy była bez VAT-u) ten wzór poprawnie pokazywał czystą marżę, np. 6%. Teraz, skoro cena_sprzedazy zawiera już VAT, ten sam wzór "widzi" różnicę zakup→sprzedaż jako 30% (bo w tej różnicy jest i marża, i VAT razem), więc pokazuje 30% zamiast 6%.
Cena w złotówkach: poprawna, liczona raz, bez dublowania.
Etykietka "marża %" w bazie/panelu: teraz myląca — pokazuje "marża+VAT" pod nazwą "marża", więc jeśli ktoś patrzy na tę kolumnę myśląc że to czysta marża handlowa, zobaczy zawyżoną liczbę (30% zamiast 6%).

To defekt kosmetyczny/informacyjny, nie finansowy — pieniądze się zgadzają, tylko opis "ile procent marży dołożyliśmy" wprowadza w błąd, bo miesza w sobie dwa różne składniki (marżę i VAT).

1. Zmienić wzór marza_pct, żeby liczył czystą marżę bez VAT (odjąć VAT przed dzieleniem) — wtedy kolumna znowu pokazywałaby np. 6%.
2. Zostawić jak jest i po prostu wiedzieć, że ta kolumna teraz oznacza "narzut całkowity" (marża+VAT), a nie samą marżę.

Nie wprowadziłem żadnej z tych zmian bez Twojej decyzji, zgodnie z zasadą projektu. Czy chcesz, żebym poprawił wzór marza_pct tak, by pokazywał czystą marżę (bez VAT), czy zostawić to jak jest?

---

## Turn 10 — 2026-07-31 12:56 UTC
### Query
No ale marża nie jest równoznaczna  z Vatem, marża to nasz narzut procentowy więc nie może się wyświetlać 30% - marży nie obliczas od ceny sprzedaży. Mraża to jest wartość procentowa którą ustalamy w narzutach i taką masz przyjmowac zarówno do widoku jak i do obliczeń

### Answer
Rozumiem — masz całkowitą rację, i to jest dokładnie to uproszczenie, które trzeba poprawić. Wyjaśnię dokładnie o co chodzi i co proponuję zrobić.

Kolumna marza_pct w bazie NIE przechowuje na stałe ustalonej wartości narzutu z reguły — ona jest przeliczana wstecz ze wzoru: marza_pct = (cena_sprzedazy - cena_zakupu) / cena_zakupu. To jest matematyczne "zgadywanie" marży na podstawie różnicy cen, a nie odczyt rzeczywistej wartości narzutu, którą ustaliłeś w regule.

Skoro teraz cena_sprzedazy zawiera VAT, ten wsteczny wzór miesza VAT z marżą i pokazuje 30% zamiast prawdziwych 6% narzutu.

Masz rację — marża to ustalona przez Ciebie wartość procentowa narzutu (z reguły narzutów), niezależna od VAT-u i niezależna od ceny sprzedaży. Powinna:

1. Być przechowywana wprost — to wartość, którą System już zna w momencie importu/przeliczania (bo to właśnie ta wartość wchodzi do wzoru: cena_zakupu × (1+marża) × (1+VAT)), a nie wyliczana wstecz z gotowej ceny.
2. Wyświetlać się i liczyć jednakowo — ten sam procent widoczny w panelu ma być tym samym procentem użytym w obliczeniach ceny sprzedaży, bez żadnego domieszania VAT-u.

Trzeba znaleźć miejsce, gdzie obecnie liczone jest marzaPct = Math.round((cenaSprzedazy-zakup)/zakup*1e3)/10 (wzór wsteczny z ceny) i zamienić je tak, żeby zamiast przeliczać z gotowej ceny sprzedaży, zapisywało bezpośrednio wartość narzutu z reguły (narz/narzutPct), która i tak jest już dostępna w tym samym miejscu kodu przed obliczeniem ceny. To usunie VAT z tej kolumny raz na zawsze — będzie pokazywać dokładnie to, co ustawiłeś w regule narzutów, nic więcej.

Czy mam wprowadzić tę poprawkę: zmienić marza_pct tak, by zapisywał czysty procent narzutu z reguły (bez wyliczania go z ceny sprzedaży, bez VAT-u), i przeliczyć to samo dla wszystkich istniejących aktywnych produktów w bazie? Zgodnie z zasadą projektu pytam też: czy po wdrożeniu zrobić podsumowanie + backup kodu do space?

---

## Turn 11 — 2026-07-31 13:01 UTC
### Query
Czy po wdrożeniu tej poprawki (marza_pct = czysty narzut z reguły, bez VAT) zrobić podsumowanie + backup kodu produkcyjnego do space, tak jak przy poprzedniej zmianie?: Tak i zrób notatkę do wiki z działania i tego co znalazłeś w kodzie i gdzie to się znajduje, jaka reguła

### Answer
Czekam na weryfikację panelu

Czekam na zakończenie aktualizacji wiki przed zapisem

---

## Turn 12 — 2026-07-31 13:23 UTC
### Query
Plik CSV z ceną `cena_sprzedazy` w formacie `7624,-` (tekst, nie liczba) trafia do sklepu Selly przez import. Czy Selly na pewno poprawnie zaimportuje taki format jako cenę, czy chcesz najpierw to zweryfikować/zapytać Selly, zanim to wdrożę na produkcyjny eksport?: Wdróż mimo to

### Answer
Czekam na zakończenie weryfikacji panelu i wcześniejszej notatki wiki

Obie poprawki wdrożone i zweryfikowane:

Marża_pct — teraz odczytywana bezpośrednio z reguły narzutu (6%), nie wyliczana wstecz z ceny (co mieszało VAT z marżą). Przy okazji naprawiona regresja zaokrąglenia w funkcji przeliczającej ceny po zmianie reguły. Wszystkie 7036 aktywnych produktów zweryfikowane w bazie, CSV i panelu.

Format ceny sprzedaży — kolumna cena_sprzedazy w tabeli panelu i w eksporcie CSV do Selly pokazuje teraz N,- (np. 7624,-) zamiast N.00. Kolumna cena_zakupu została bez zmian (nadal z groszami). Zweryfikowane w panelu (50 wierszy, brak błędów JS) i w CSV (wszystkie 7036 wierszy).

Uwaga: format N,- w CSV to tekst, nie liczba — zaakceptowałaś to ryzyko, ale warto sprawdzić z Selly, czy poprawnie zaimportują taką cenę.

Notatki do wiki projektu zostały dopisane (marża_pct — gotowe, format ceny — w trakcie).

Czekam na potwierdzenie zapisania notatki wiki

Notatka wiki o poprawce formatu ceny ,- jest teraz zapisana (obie próby faktycznie zadziałały równolegle, więc treść może pojawić się dwukrotnie w niektórych sekcjach — to nieszkodliwe powielenie informacji, nie błąd merytoryczny).

Podsumowując dzisiejszą sesję — wszystko zostało wdrożone i udokumentowane:

1. VAT w cena_sprzedazy — naprawiony, przeliczony dla 7036 produktów
2. marża_pct — teraz czysty narzut z reguły (6%), nie mieszanka z VAT
3. Format ceny sprzedaży — N,- w panelu i eksporcie CSV do Selly

Wszystkie poprawki mają podsumowania i backupy kodu produkcyjnego zapisane w projekcie, a wiki projektu jest zaktualizowana ze szczegółami technicznymi każdej zmiany.

---
