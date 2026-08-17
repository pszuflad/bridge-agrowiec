# Widoki — specyfikacja odtworzenia

## Konwencja sekcji API

W podpunktach **API zweryfikowane** wykazano wyłącznie wywołania, dla których jest wskazana definicja backendu. `GET` bez body oznacza brak body. Kształt odpowiedzi zapisano tylko, gdy wynika z handlera; w pozostałych przypadkach jest **NIEZNANY**. [fe_doc_brief.md:63-69]

---

## `/login` — Logowanie

1. **Layout.** Karta logowania ma pola e-mail i hasło, przełącznik widoczności hasła, checkbox „zapamiętaj” oraz przycisk ze stanem ładowania. [fe.js:26392-26512]
2. **Dane wejściowe.** Lokalny stan obejmuje e-mail, hasło, błąd, stan wysyłania i checkbox. [fe.js:26392-26512]
3. **Akcje.** Submit wywołuje wspólną funkcję logowania i po sukcesie przechodzi na `/`. [fe.js:26470-26512]
4. **API zweryfikowane.** `POST /api/login` — FE `fe.js:9085-9097`; BE `be.cjs:48156-48174`; body `{email: trim(email), password}`, odpowiedź sukcesu `{ok:true,user,token}`. [fe.js:9085-9097; be.cjs:48156-48174]
5. **Stany.** Błąd uwierzytelnienia jest renderowany w formularzu; przycisk ma stan wykonywania. [fe.js:26470-26512]
6. **Reguły biznesowe.** E-mail jest przycinany przed wysłaniem. [fe.js:9085-9097]
7. **Komponenty React.** `tM`. [fe.js:26392-26512]
8. **Różnice vs instrukcja v5.** Instrukcja nie opisuje ekranu logowania; różnica funkcjonalna jest **NIEZNANA**. [instrukcja.txt:1-241]

---

## `/` — Pulpit

1. **Layout.** Widok renderuje karty KPI, listę alertów i tabelę dostawców w ramie `mn`. [fe.js:16836-17039]
2. **Dane wejściowe.** Pobiera `products`, `staging`, `suppliers` i `history`. [fe.js:16840-16852]
3. **Akcje.** Brak potwierdzonej mutacji w widoku; dane są prezentowane jako dashboard. [fe.js:16836-17039]
4. **API zweryfikowane.** `GET /api/products` — FE `fe.js:16840`; BE `be.cjs:48280-48294`; odpowiedź: tablica produktów albo obiekt stronicowany zależnie od parametrów. `GET /api/staging` — FE `fe.js:16844`; BE `be.cjs:48477-48490`; odpowiedź: lista stagingu. `GET /api/suppliers` — FE `fe.js:16848`; BE `be.cjs:48216-48226`; odpowiedź: lista dostawców. `GET /api/history` — FE `fe.js:16852`; BE `be.cjs:48681-48686`; odpowiedź: historia. [fe.js:16840-16852; be.cjs:48216-48226,48280-48294,48477-48490,48681-48686]
5. **Stany.** Alerty są filtrowane po statusie `nowy`, sortowane według poziomu i ograniczane do pięciu. [fe.js:16853-16860]
6. **Reguły biznesowe.** KPI i widoczne alerty są obliczane po stronie klienta z pobranych zbiorów. [fe.js:16853-16925]
7. **Komponenty React.** `N2`, `mn`, `hn`, `Si`. [fe.js:16287-16443,16836-17039]
8. **Różnice vs instrukcja v5.** Instrukcja opisuje cztery kafle i alerty; kod faktycznie wyprowadza alerty z produktów, a nie z zapytania `/api/alerts`. [instrukcja.txt:27-49; fe.js:16840-16860]

---

## `/staging` — Staging

1. **Layout.** Tabela ma filtr typu zmiany, wyszukiwarkę, wybór wierszy, akcje masowe, paginację i edycję pojedynczego wpisu. [fe.js:20616-20946]
2. **Dane wejściowe.** Stan obejmuje typ `nowa`, tekst wyszukiwania, stronę, zaznaczenia; główne dane pobierane są stronicowo. [fe.js:20616-20633]
3. **Akcje.** Dostępne są akceptacja/odrzucenie wybranych lub przefiltrowanych pozycji, edycja i usuwanie wpisu. [fe.js:20636-20769,20918-20946]
4. **API zweryfikowane.** `GET /api/staging/paged?page=&limit=&typZmiany=&search=` — FE `fe.js:20621-20628`; BE `pagination_module.cjs:16-90`; odpowiedź `{items,total,page,pageSize,pages}`. `GET /api/staging/:id` — FE `fe.js:20918-20946`; BE `pagination_module.cjs:94-131`; odpowiedź zawiera pełny wpis z `snapshotJson`. `POST /api/staging/accept` — FE `fe.js:20655-20677`; BE `be.cjs:48524-48549`; body `{ids}` albo `{allFiltered:true,typZmiany}`, odpowiedź `{ok,accepted}`. `POST /api/staging/reject` — FE `fe.js:20655-20677`; BE `be.cjs:48550-48569`; body analogiczne, odpowiedź `{ok,rejected}`. `PUT /api/staging/:id` i `DELETE /api/staging/:id` — FE `fe.js:20636-20654`; BE `be.cjs:48570-48633`; body PUT zawiera dopuszczone pola wpisu, odpowiedź odpowiednio `{ok}` lub zaktualizowany wpis. `GET /api/atrybuty` — FE `fe.js:20630-20633`; BE `atrybuty_module.cjs:103-113`; odpowiedź atrybutów. [fe.js:20621-20677,20918-20946; pagination_module.cjs:16-131; be.cjs:48524-48633; atrybuty_module.cjs:103-113]
5. **Stany.** Jest stan pusty, skeleton/ładowanie, zaznaczenie, wynik wyszukiwania i komunikaty mutacji. [fe.js:20740-20834]
6. **Reguły biznesowe.** PUT dopuszcza tylko `nazwa`, `marka`, `model`, `kategoria`, `rozmiar`, `ean`, `cenaZakupuNowa`, `magazyn` i zapisuje override; akceptacja obsługuje listę ID albo cały filtr. [be.cjs:48524-48549,48587-48633]
7. **Komponenty React.** `JP`, `mn`, `hn`. [fe.js:16329-16443,20616-20946]
8. **Różnice vs instrukcja v5.** Instrukcja opisuje ręczną ścieżkę nowych zmian, a nagłówek obecnego kodu mówi, że zmiany ceny i stanu idą automatycznie do katalogu. [instrukcja.txt:50-76; fe.js:20678-20682]

---

## `/katalog` — Katalog

1. **Layout.** Widok ma wirtualizowaną tabelę, filtry, zakładki dostawców, konfigurację kolumn oraz edycję produktu. [fe.js:23214-23473,23909-24088]
2. **Dane wejściowe.** Pobiera produkty, dostawców, konfigurację, atrybuty i override’y. [fe.js:23257-23294,23909-23962]
3. **Akcje.** Filtruje po tokenach, eksportuje bieżący zbiór do pliku w przeglądarce, zapisuje produkt oraz usuwa override. [fe.js:23296-23421,23909-24088]
4. **API zweryfikowane.** `GET /api/products` — FE `fe.js:23257`; BE `be.cjs:48280-48294`; tablica lub obiekt stronicowany. `GET /api/suppliers` — FE `fe.js:23263`; BE `be.cjs:48216-48226`; lista dostawców. `GET /api/config` — FE `fe.js:23269`; BE `be.cjs:48728-48737`; konfiguracja. `GET /api/atrybuty` — FE `fe.js:23284-23294`; BE `atrybuty_module.cjs:103-113`; atrybuty. `GET /api/overrides` i `DELETE /api/overrides/:id` — FE `fe.js:23909-23962`; BE `be.cjs:48634-48675`; lista override’ów / `{ok}`. `PATCH /api/products/:id` — FE `fe.js:9147-9159`; BE `be.cjs:48441-48476`; body jest obiektem edytowanych pól, odpowiedź to produkt. [fe.js:23257-23294,23909-23962,9147-9159; be.cjs:48216-48226,48280-48294,48441-48476,48634-48675,48728-48737; atrybuty_module.cjs:103-113]
5. **Stany.** Wirtualizacja włącza się dla liczby elementów większej niż 150; wysokość wiersza jest ustawiona na 37. [fe.js:23215-23256,23312-23314]
6. **Reguły biznesowe.** Eksport jest generowany po stronie klienta z aktualnie wyfiltrowanych danych. [fe.js:23384-23421]
7. **Komponenty React.** `AT`, `LT`, `mn`, `hn`. [fe.js:16329-16443,23214-23473,23909-24088]
8. **Różnice vs instrukcja v5.** Instrukcja wiąże eksport z Shoperem, natomiast potwierdzony kod tworzy pobierany plik lokalnie; zewnętrzny mechanizm eksportu jest **NIEZNANY**. [instrukcja.txt:80-103; fe.js:23384-23421]

---

## `/narzuty` — Narzuty

1. **Layout.** Widok rozdziela reguły marży, promocje i kalkulator/symulator na komponenty zakładkowe. [fe.js:25122-25151]
2. **Dane wejściowe.** Reguły i promocje są pobierane przez wspólne funkcje widoku. [fe.js:9208-9429]
3. **Akcje.** Tworzenie, edycja i usuwanie marż oraz promocji; symulacja ceny. [fe.js:9208-9429,9434-9505]
4. **API zweryfikowane.** `GET/POST /api/markups` — FE `fe.js:9208-9227`; BE `be.cjs:48681-48687`; POST body `{typ,zakres,warunki,nazwa,wartosc,jednostka,priorytet,status}`, odpowiedź to reguła. `PATCH/DELETE /api/markups/:id` — FE `fe.js:9253-9306`; BE `be.cjs:48688-48703`; body PATCH to zmieniane pola, DELETE zwraca `{ok}`. `GET/POST /api/promotions` — FE `fe.js:9316-9342`; BE `be.cjs:48704-48710`; body `{nazwa,rabatPct,zasieg,warunki,prio,start,koniec,status}`. `PATCH/DELETE /api/promotions/:id` — FE `fe.js:9369-9429`; BE `be.cjs:48711-48723`; PATCH zwraca promocję, DELETE `{ok}`. [fe.js:9208-9429; be.cjs:48681-48723]
5. **Stany.** Widok ma oddzielne stany zakładek i formularzy. [fe.js:25122-25151]
6. **Reguły biznesowe.** Aktywne warunki są łączone jako AND, reguły sortowane malejąco po priorytecie, a cena symulowana jest jako zakup × marża × rabat × VAT. [fe.js:9434-9505]
7. **Komponenty React.** `VT`, `WT`, `UT`, `BT`, `mn`, `hn`. [fe.js:16329-16443,25122-25151]
8. **Różnice vs instrukcja v5.** Instrukcja opisuje Narzuty jako moduł „w przygotowaniu”, ale kod zawiera trwałe mutacje API. [instrukcja.txt:222-230; fe.js:9208-9429]

---

## `/atrybuty` — Atrybuty

1. **Layout.** Widok pokazuje listę rodzajów atrybutów, wyszukiwanie wartości i dialogi CRUD. [fe.js:27495-27622]
2. **Dane wejściowe.** Natywny widok używa funkcji `J0`; dołączony injection odczytuje `/api/atrybuty` i nadpisuje cache danych. [fe.js:27495-27622; pending-injection.js:1190-1276]
3. **Akcje.** Dodawanie rodzaju, dodawanie/edycja/usuwanie wartości oraz obsługa pending są dostarczane przez warstwę atrybutów/injection. [fe.js:10191-10265; pending_module.cjs:218-386]
4. **API zweryfikowane.** `GET /api/atrybuty` — FE `fe.js:10158-10191`; BE `atrybuty_module.cjs:103-113`; dane rodzajów i wartości. `POST /api/atrybuty/rodzaje` — FE `fe.js:10243-10265`; BE `atrybuty_module.cjs:125-152`; body `{value,label,opis}`. `POST /api/atrybuty/wartosci` — FE `fe.js:10191-10211`; BE `atrybuty_module.cjs:199-218`; body `{rodzaj,wartosc,origin}`. `PUT/DELETE /api/atrybuty/wartosci/:id` — FE `fe.js:10212-10242`; BE `atrybuty_module.cjs:219-236,237-252`; body PUT `{wartosc}`, DELETE zwraca wynik usunięcia. [fe.js:10158-10265; atrybuty_module.cjs:103-113,125-152,199-252]
5. **Stany.** Istnieje stan ładowania/skeleton oraz odświeżanie cache przez injection. [fe.js:27495-27622; pending-injection.js:1172-1185,1190-1276]
6. **Reguły biznesowe.** Dwa stare klucze `/api/attributes` i `/api/attribute-kinds` są w bundlu, lecz bez backendu; nie należy ich odtwarzać. [fe.js:9965-10155; api_be_uniq.txt:1-95]
7. **Komponenty React.** `iM`, `sg`, `rg`, `aM`, `sM`, `oM`, `mn`, `hn`. [fe.js:16329-16443,27495-27622]
8. **Różnice vs instrukcja v5.** Instrukcja opisuje zwykły moduł atrybutów, a produkcyjny obraz jest zmieniany przez osobny `pending-injection.js`. [instrukcja.txt:104-120; index.html:17; pending-injection.js:1-11]

---

## `/alerty` — Alerty

1. **Layout.** Karty alertów z filtrowaniem, sortowaniem i działaniami zbiorczymi. [fe.js:25177-25334]
2. **Dane wejściowe.** Widok pobiera produkty i czyta lokalnie utrwalany stan obsługi alertów. [fe.js:25177-25194]
3. **Akcje.** Filtrowanie, sortowanie i masowa zmiana lokalnego statusu. [fe.js:25195-25334]
4. **API zweryfikowane.** `GET /api/products` — FE `fe.js:25177-25194`; BE `be.cjs:48280-48294`; odpowiedź: produkty. [fe.js:25177-25194; be.cjs:48280-48294]
5. **Stany.** Statusy i kolejność są wyprowadzane lokalnie z produktów oraz zapisanego stanu. [fe.js:25177-25211]
6. **Reguły biznesowe.** Nie potwierdzono w komponencie wywołania `/api/alerts`, mimo że backend obsługuje GET/PATCH tej trasy. [fe.js:25177-25334; be.cjs:48677-48680]
7. **Komponenty React.** `HT`, `KT`, `mn`, `hn`. [fe.js:16329-16443,25177-25334]
8. **Różnice vs instrukcja v5.** Instrukcja zakłada operacyjne alerty, lecz obecny komponent utrwala ich obsługę lokalnie; synchronizacja statusu z serwerem jest **NIEZNANA**. [instrukcja.txt:121-145; fe.js:25177-25334]

---

## `/waga-gabarytowa` — Waga gabarytowa

1. **Layout.** Formularz wymiarów i wagi rzeczywistej oraz panel wyniku/wyceny. [fe.js:26545-26772]
2. **Dane wejściowe.** Stan lokalny obejmuje przewoźnika, długość, szerokość, wysokość i wagę rzeczywistą. [fe.js:26545-26653]
3. **Akcje.** Użytkownik zmienia dane przesyłki; wynik jest obliczany natychmiast lokalnie. [fe.js:26584-26685]
4. **API zweryfikowane.** Brak potwierdzonego wywołania API przez komponent. Backend ma `POST /api/waga-gabarytowa/oblicz` w `be.cjs:48738-48757`, ale nie należy go przypisywać widokowi bez wywołania FE. [fe.js:26545-26685; be.cjs:48738-48757]
5. **Stany.** Walidacja wymaga dodatnich wartości; wynik ma stan pusty przy błędnych danych. [fe.js:26584-26685]
6. **Reguły biznesowe.** Waga gabarytowa to `długość × szerokość × wysokość / dzielnik`, a do wyceny wybierane jest maksimum wagi rzeczywistej i gabarytowej. [fe.js:26656-26685]
7. **Komponenty React.** `nM`, `mn`, `hn`. [fe.js:16329-16443,26545-26772]
8. **Różnice vs instrukcja v5.** Instrukcja opisuje kalkulator przewoźników; w bieżącym kodzie kalkulacja jest frontendowa, nie serwerowa. [instrukcja.txt:146-164; fe.js:26545-26685]

---

## `/analityka` — Analityka

1. **Layout.** Zakładkowy panel danych, tabel i eksportu. [fe.js:27804-27971]
2. **Dane wejściowe.** Funkcja `d` czyta zapytania analityczne, zależnie od aktywnej zakładki i filtrów. [fe.js:27804-27940]
3. **Akcje.** Zmiana zakładek/filtrów oraz pobranie eksportu. [fe.js:27938-27971]
4. **API zweryfikowane.** Wszystkie poniższe ścieżki są faktycznie wywoływane przez FE `fe.js:27813-27940` i zdefiniowane w backendzie: `GET /api/analytics/status` — `analytics_module.cjs:93-96`, odpowiedź `{hasHistory,snapshots,od,do}`; `GET /api/analytics/filters` — `98-107`; `GET /api/analytics/suppliers/stability` — `110-131`; `.../suppliers/lifecycle` — `133-141`; `.../suppliers/stock` — `143-154`; `.../availability/products` — `156-171`; `.../availability/sell-through` — `173-185`; `.../ean/comparison` — `188-200`; `.../ean/unique` — `210-217`; `.../ean/coverage` — `219-222`; `.../ean/supplier-rank` — `224-235`; `.../market/group-prices` — `237-242`; `.../prices/last-import` — `245-248`; `.../prices/product-history` — `250-261`; `.../prices/inflation` — `263-276`; `.../seasonality/monthly` — `279-283`; `.../lifecycle/models` — `285-289`; `.../margins` — `292-297`; `.../rotation/inactive` — `299-303`; `.../export/:typ` — `305-...`, odpowiedź CSV. Ciała GET: brak; poza `status` dokładny kształt odpowiedzi zależy od danego handlera. [fe.js:27813-27940; analytics_module.cjs:93-305]
5. **Stany.** Tabele są ograniczane do 300 wierszy w rendererze. [fe.js:27942-27971]
6. **Reguły biznesowe.** Historia produktu jest odpytywana tylko, gdy są dostępne parametry `ean` i `kod`; ceny grupowe przyjmują parametr grupy. [fe.js:27813-27940]
7. **Komponenty React.** `zM`, `mn`, `hn`. [fe.js:16329-16443,27804-27971]
8. **Różnice vs instrukcja v5.** Instrukcja v5 nie opisuje tego widoku jako osobnej części menu, a bundle posiada pełny panel i moduł backendowy. [instrukcja.txt:16-26; fe.js:16287-16327,27804-27971; analytics_module.cjs:76-80]

---

## `/historia` — Historia

1. **Layout.** Tabela historii z filtrami, wyszukiwaniem i paginacją. [fe.js:25374-25564]
2. **Dane wejściowe.** Pobierana jest stronicowana historia z parametrami `page`, `limit`, `search`, `typ`, `dostawca`. [fe.js:25380-25391]
3. **Akcje.** Użytkownik zmienia filtry i stronę. [fe.js:25374-25564]
4. **API zweryfikowane.** `GET /api/history/paged?...` — FE `fe.js:25380-25391`; BE `be.cjs:48341-48380`; odpowiedź zawiera dane stronicowania i elementy historii. `GET /api/history/meta` — FE używa klucza historii pomocniczej w tym obszarze; BE `be.cjs:48324-48340`; odpowiedź metadanych filtrów. [fe.js:25380-25391; be.cjs:48324-48380]
5. **Stany.** Widok renderuje stan ładowania, pustą listę oraz paginację. [fe.js:25374-25564]
6. **Reguły biznesowe.** Parametry wyszukiwania są przekazywane jako query string. [fe.js:25380-25391]
7. **Komponenty React.** `GT`, `QT`, `mn`, `hn`. [fe.js:16329-16443,25374-25564]
8. **Różnice vs instrukcja v5.** Instrukcja nazywa Historię przygotowaniem i opisuje pusty widok, ale kod pobiera dane stronicowane. [instrukcja.txt:231-241; fe.js:25380-25391]

---

## `/konfiguracja` — Konfiguracja

1. **Layout.** Zakładki obejmują dostawców, upload, spedycję, Shoper, katalog i AI. [fe.js:26279-26382]
2. **Dane wejściowe.** Widok pobiera dostawców, konfigurację spedycji i konfigurację ogólną. [fe.js:26279-26282]
3. **Akcje.** Ręczna synchronizacja, upload pliku, zapis konfiguracji i czyszczenie produktów; injection `freq` dodaje zmianę częstotliwości. [fe.js:25710-25803,25995-26001,26107; freq-injection.js:74-115]
4. **API zweryfikowane.** `GET /api/suppliers` — FE `fe.js:26279-26282`; BE `be.cjs:48216-48226`; lista dostawców. `GET /api/spedycja` — FE `fe.js:26279-26282`; BE `be.cjs:48724-48727`; konfiguracja spedycji. `GET/POST /api/config` — FE `fe.js:25995-26001,26279-26282`; BE `be.cjs:48728-48737`; POST body to obiekt konfiguracji, odpowiedź konfiguracja. `POST /api/dostawcy/:kod/synchronizuj-teraz` — FE `fe.js:25710-25803`; BE `be.cjs:48227-48231`; body `{}`, odpowiedź zadania synchronizacji. `POST /api/dostawcy/:kod/upload` — FE `fe.js:25710-25803`; BE `be.cjs:48232-48279`; body `FormData` z plikiem, odpowiedź wyniku importu. `POST /api/products/clear` — FE `fe.js:26107`; BE `be.cjs:48304-48323`; body `{}`, odpowiedź `{ok}`. [fe.js:25710-25803,25995-26001,26107,26279-26282; be.cjs:48216-48231,48232-48279,48304-48323,48724-48737]
5. **Stany.** Po synchronizacji/uploadzie cache dostawców i stagingu jest aktualizowany. [fe.js:25710-25803]
6. **Reguły biznesowe.** Upload jest przesyłany jako `FormData` z cookie sesyjnym; szczegóły walidacji pliku realizuje backend. [fe.js:25710-25803; be.cjs:48232-48279]
7. **Komponenty React.** `eM`, `Qr`, `ZT`, `JT`, `qT`, `GK`, `XT`, `YT`, `mn`, `hn`. [fe.js:16329-16443,25710-26282]
8. **Różnice vs instrukcja v5.** Instrukcja wymienia moduły konfiguracji, lecz `freq-injection.js` dokłada UI częstotliwości poza natywnym drzewem React. [instrukcja.txt:165-212; freq-injection.js:1-115]

---

## `/moje-konto` — Moje konto

1. **Layout.** Formularz zmiany hasła z trzema polami i komunikatami błędów/sukcesu. [fe.js:27624-27779]
2. **Dane wejściowe.** Stan lokalny zawiera stare hasło, nowe hasło, powtórzenie i stan żądania. [fe.js:27624-27695]
3. **Akcje.** Submit zmienia hasło; wrapper przekierowuje bez użytkownika na `/login`. [fe.js:27682-27695,27789-27801]
4. **API zweryfikowane.** `POST /api/password/change` — FE `fe.js:27682-27695`; BE `be.cjs:48191-48215`; body `{oldPassword,newPassword}`, odpowiedź `{ok:true}` albo błąd. [fe.js:27682-27695; be.cjs:48191-48215]
5. **Stany.** Błędy walidacji i wynik żądania są lokalne. [fe.js:27624-27779]
6. **Reguły biznesowe.** Nowe hasło ma minimum osiem znaków, musi być powtórzone i nie może być równe staremu. [fe.js:27662-27695]
7. **Komponenty React.** `lM`, `mn`, `hn`. [fe.js:16329-16443,27624-27801]
8. **Różnice vs instrukcja v5.** Instrukcja zawiera zmianę hasła; dodatkowej różnicy potwierdzonej w kodzie nie stwierdzono. [instrukcja.txt:213-221; fe.js:27624-27779]
