# 05. Parsery, moduły i integracje

## Dispatcher, adapter i wspólne normalizacje

* Dispatcher mapuje MO1–MO10 na parsery; MO4 i MO5 współdzielą Handlopex (`/home/admin/private_apps/bridge/parsers/dispatcher.cjs:5-13`, `29-40`). Adres źródła jest wybierany z DB `suppliers.url`, a potem z `URLS` (`dispatcher.cjs:46-63`; `extensions.cjs:71-89`).
* Adapter konwertuje rekordy dostawców do jednego kształtu `surowe`, buduje syntetyczny kod przy EAN utraconym w notacji naukowej oraz finalnie mapuje `ean`, `stan`, `cenaZakupu`, rozmiar i pola techniczne (`/home/admin/private_apps/bridge/parsers/adapter.cjs:77-96`, `490-622`).
* `common.cjs` normalizuje EAN, cenę i ilość; przy niejednoznacznym EAN z zapisu naukowego zwraca `value:null, lossy:true`, aby adapter utworzył kod syntetyczny (`/home/admin/private_apps/bridge/common.cjs:44-75`, `101-145`, `348-383`). `tyre_params.cjs` normalizuje cenę/ilość/rozmiar, LI/SI i marki techniczne (`tyre_params.cjs:30-39`, `138-279`, `303-324`).

## Parsery MO1–MO10

| Dostawca | Format i mapowanie potwierdzone w kodzie | Reguła szczególna / źródło |
|---|---|---|
| MO1 Bohnenkamp | CSV `;`, bez nagłówka; EAN z `row[1]`, cena z `row[7]`, stan `null`. | Ignoruje stany G/I/J innych krajów; filtruje dętki i akcesoria (`mo1_bohnenkamp.cjs:14-24`, `46-161`). |
| MO2 JMK | CSV `;` z nagłówkiem; EAN `ean`, cena `Cena klient netto`, stan `Magazyn 1`. | Sumuje stan rekordów o tym samym EAN, nie sumuje Magazynu 2 (`mo2_jmk.cjs:6-7`, `30-120`). |
| MO3 Grasdorf | CSV `;` z nagłówkiem normalizowanym; rozpoznaje dwa formaty nagłówków. | Używa `normalizeGrasdorf`, zwraca również `odrzucone` (`mo3_grasdorf.cjs:7-12`, `32-128`; `tyre_params.cjs:521-804`). |
| MO4/MO5 Handlopex | CSV `;` z nagłówkiem; EAN `ean`, cena `cena hurt netto`, stan `ilosc`. | Jeden parser, `parseMO4`/`parseMO5` różnią kod dostawcy (`mo4_mo5_handlopex.cjs:5-82`; `tyre_params.cjs:827-1046`). |
| MO6 Agrowiec | CSV `;` z nagłówkiem; EAN `EAN`, cena `Cena`, stan `Lagerbestand`. | Wejściowe nagłówki są wypisane w kodzie (`mo6_agrowiec.cjs:5-88`; `tyre_params.cjs:1050-1079`). |
| MO7 Nokian | CSV `;` z przyciętymi nagłówkami; EAN `EAN`, cena `Zakup 1 szt`, stan `Magazyn`. | Kod jawnie ignoruje detal i „Zakup min 2” (`mo7_nokian.cjs:5-99`; `tyre_params.cjs:1091-1129`). |
| MO8 Trelleborg | XLSX przez SheetJS; EAN kolumna G, cena liczbowo, stan zawsze `0`. | Odrzuca „In preparation” i pozycje bez rozmiaru (`mo8_trelleborg.cjs:29-350`; `tyre_params.cjs:1133-1181`). |
| MO9 Agrorami | Nie CSV produkcyjnie: synchroniczny wrapper odpala helper Node przez `execFileSync`. | Powód to GraphQL i prawdziwy stan `stock_availability.in_stock_real` (`mo9_agrorami.cjs:1-62`; `mo9_agrorami_api.cjs:1-12`, `604-669`). |
| MO10 GRI | CSV `;` z nagłówkiem, a parser obsługuje też XLSX; EAN `EAN`, stan `ilość`, cena netto/szt. | Gdy przekreślona cena F ma promocję, używa wartości z kolumny G (`mo10_gri.cjs:8-119`; `tyre_params.cjs:1337-1385`). |

## Agrorami / GraphQL

`mo9_agrorami.cjs` musi pozostać synchroniczny, bo dispatcher i helper `nq()` są synchroniczne; dlatego uruchamia `_agrorami_fetch_helper.cjs` przez `execFileSync` (`/home/admin/private_apps/bridge/parsers/mo9_agrorami.cjs:13-37`; `_agrorami_fetch_helper.cjs:2-9`). API GraphQL pobiera `stock_availability{ in_stock in_stock_real }`, a transformacja przypisuje `in_stock_real` do magazynu/stanu (`mo9_agrorami_api.cjs:481-490`, `604-669`). Nazwy zmiennych środowiskowych GraphQL są w konfiguracji, lecz wartości nie są tu ujawniane (`mo9_agrorami_api.cjs:376`).

## Moduły runtime

* **Atrybuty**: otwiera własny handle DB, tworzy tylko `atrybuty_rodzaje` i `atrybuty_wartosci`, a potem rejestruje 11 tras CRUD/liczników/użycia (`/home/admin/private_apps/bridge/atrybuty_module.cjs:39-61`, `86-308`).
* **Pending**: otwiera własny handle DB i obsługuje kolejkę `pending` — lista, akceptacja, edycja, alias, odrzucenie, skan i czyszczenie (`pending_module.cjs:198-393`). Nie tworzy obu tabel pending/odrzucone; patrz dryf.
* **Analytics**: rejestruje 27 endpointów (`analytics_module.cjs:76-342`) i tworzy `historia_cen` w funkcji inicjalizacyjnej (`1-38`); jest ładowany dwukrotnie, lecz druga rejestracja jest martwa.
* **Paginacja**: rejestruje cztery endpointy (`pagination_module.cjs:12-223`); `history/meta` i `history/paged` są zasłonięte przez wcześniejsze trasy rdzenia.
* **bridge_ext**: nie rejestruje tras. Dodaje reguły wymiarów i pamięci link/nazwa/waga; tworzy tabele pamięci, a `assignKodImportu` grupuje po EAN albo marka+rozmiar+bieznik+nazwa (`bridge_ext.cjs:46-62`, `124-125`, `147-211`).
* **Extensions**: pobiera URL/pliki, robi `dispatcher → adapter → tk`, rejestruje moduły i uruchamia scheduler (`extensions.cjs:54-68`, `92-400`).

## Selly

**Status: podpięte w runtime warunkowo.** Extensions otwiera `_bridgeDb`; tylko gdy uchwyt powstanie, wywołuje `registerSellyRoutes(app, {db:_bridgeDb, requireAuth:we})` w `try/catch` (`/home/admin/private_apps/bridge/extensions.cjs:369-400`). To oznacza, że rejestracja nie jest bezwarunkowa, lecz na działającym odczytanym kodzie jest częścią runtime — przeciwne twierdzenie jest nieaktualne.

Klient używa OAuth2 `client_credentials`, przechowuje token w pamięci i odświeża go po 401 (`selly/client.cjs:1-3`, `71-125`). Mapper buduje payload produktu, a przy podanym DB korzysta z dwóch tabel mapowań kategorii/zastosowania (`selly/mapper.cjs:105-220`). Trasy Selly korzystają z `selly_dict`, `selly_products`, `selly_sync_log` (`selly/routes.cjs:25-79`, `167-247`, `375-425`).

## Scheduler auto-pull

Scheduler uruchamia się raz, ma tick co 60 sekund, bierze `czestotliwosc_minuty` z `suppliers`, pomija brak częstotliwości i wymusza minimum 5 minut (`/home/admin/private_apps/bridge/extensions.cjs:740-768`). Nie ma zakodowanej częstotliwości „per dostawca”: jest ona danymi w DB. `runAutoPull` pobiera URL, wykonuje parse/adapter/tk, aktualizuje dostawcę i audytuje (`extensions.cjs:770-825`).
