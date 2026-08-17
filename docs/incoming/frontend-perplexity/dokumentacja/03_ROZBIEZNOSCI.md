# Rozbieżności klient–backend i warstwa injection

## Wynik kontroli

Przejrzano wszystkie 53 znormalizowane ścieżki z mapy frontendu. **Jedynymi rzeczywistymi niezgodnościami wywołań klienta z backendem są `/api/attributes` i `/api/attribute-kinds`**: nie mają definicji backendowej. Wszystkie konkretne ścieżki `/api/analytics/*` istnieją w `analytics_module.cjs`. [api_fe_uniq.txt:1-53; api_be_uniq.txt:1-95; analytics_module.cjs:93-305]

`/api/analytics` występuje w zestawieniu jako znormalizowany prefiks, ale nie jest samodzielnym targetem widoku: FE woła wyłącznie szczegółowe ścieżki poniżej. Dlatego nie jest to trzecia rozbieżność. [api_fe_uniq.txt:2-21; fe.js:27813-27940]

## Macierz wszystkich ścieżek z `api_fe_uniq.txt`

| Ścieżka klienta | Istnieje w BE? | Definicja / uwaga |
|---|---|---|
| `/api/alerts` | TAK | `be.cjs:48677-48680` (GET/PATCH). |
| `/api/analytics` | TAK jako namespace | Brak endpointu root; konkretne wywołania są niżej i są zdefiniowane. [fe.js:27813-27940; analytics_module.cjs:93-305] |
| `/api/analytics/availability/products` | TAK | `analytics_module.cjs:156-171`. |
| `/api/analytics/availability/sell-through` | TAK | `analytics_module.cjs:173-185`. |
| `/api/analytics/ean/comparison` | TAK | `analytics_module.cjs:188-200`. |
| `/api/analytics/ean/coverage` | TAK | `analytics_module.cjs:219-222`. |
| `/api/analytics/ean/supplier-rank` | TAK | `analytics_module.cjs:224-235`. |
| `/api/analytics/ean/unique` | TAK | `analytics_module.cjs:210-217`. |
| `/api/analytics/export/` | TAK | Szablon dynamiczny eksportu: `analytics_module.cjs:305`. |
| `/api/analytics/filters` | TAK | `analytics_module.cjs:98-107`. |
| `/api/analytics/lifecycle/models` | TAK | `analytics_module.cjs:285-289`. |
| `/api/analytics/margins` | TAK | `analytics_module.cjs:292-297`. |
| `/api/analytics/market/group-prices` | TAK | `analytics_module.cjs:237-242`. |
| `/api/analytics/prices/inflation` | TAK | `analytics_module.cjs:263-276`. |
| `/api/analytics/prices/last-import` | TAK | `analytics_module.cjs:245-248`. |
| `/api/analytics/prices/product-history` | TAK | `analytics_module.cjs:250-261`. |
| `/api/analytics/rotation/inactive` | TAK | `analytics_module.cjs:299-303`. |
| `/api/analytics/seasonality/monthly` | TAK | `analytics_module.cjs:279-283`. |
| `/api/analytics/status` | TAK | `analytics_module.cjs:93-96`. |
| `/api/analytics/suppliers/lifecycle` | TAK | `analytics_module.cjs:133-141`. |
| `/api/analytics/suppliers/stability` | TAK | `analytics_module.cjs:110-131`. |
| `/api/analytics/suppliers/stock` | TAK | `analytics_module.cjs:143-154`. |
| `/api/atrybuty` | TAK | `atrybuty_module.cjs:103-113`. |
| `/api/atrybuty/rodzaje` | TAK | `atrybuty_module.cjs:114-152`. |
| `/api/atrybuty/wartosci` | TAK | `atrybuty_module.cjs:185-218`. |
| `/api/atrybuty/wartosci/` | TAK | Szablon `/:id`: `atrybuty_module.cjs:219-252`. |
| `/api/attribute-kinds` | **NIE** | **0 definicji backendu**; wadliwy klucz bundla. [fe.js:9965-10155; api_be_uniq.txt:1-95] |
| `/api/attributes` | **NIE** | **0 definicji backendu**; wadliwy klucz bundla. [fe.js:9965-10155; api_be_uniq.txt:1-95] |
| `/api/config` | TAK | `be.cjs:48728-48737` (GET/POST). |
| `/api/dostawcy/` | TAK | Dynamiczne podtrasy dostawcy: `be.cjs:48216-48279`. |
| `/api/history` | TAK | `be.cjs:48681-48686`. |
| `/api/history/meta` | TAK | `be.cjs:48324-48340`. |
| `/api/history/paged` | TAK | `be.cjs:48341-48380`. |
| `/api/login` | TAK | `be.cjs:48156-48174`. |
| `/api/logout` | TAK | `be.cjs:48175-48190`. |
| `/api/markups` | TAK | `be.cjs:48681-48687`. |
| `/api/markups/` | TAK | Szablon `/:id`: `be.cjs:48688-48703`. |
| `/api/overrides` | TAK | `be.cjs:48634-48663`. |
| `/api/overrides/` | TAK | Szablon `/:id`: `be.cjs:48664-48675`. |
| `/api/password/change` | TAK | `be.cjs:48191-48215`. |
| `/api/products` | TAK | `be.cjs:48280-48303`. |
| `/api/products/` | TAK | Szablon `/:id`: `be.cjs:48396-48476`. |
| `/api/products/clear` | TAK | `be.cjs:48304-48323`. |
| `/api/promotions` | TAK | `be.cjs:48704-48710`. |
| `/api/promotions/` | TAK | Szablon `/:id`: `be.cjs:48711-48723`. |
| `/api/spedycja` | TAK | `be.cjs:48724-48727`. |
| `/api/staging` | TAK | `be.cjs:48477-48523`. |
| `/api/staging/` | TAK | Szablon `/:id`: `pagination_module.cjs:94-131` oraz operacje `be.cjs:48570-48633`. |
| `/api/staging/accept` | TAK | `be.cjs:48524-48549`. |
| `/api/staging/import` | TAK | `be.cjs:48491-48523`. |
| `/api/staging/paged` | TAK | `pagination_module.cjs:16-90`. |
| `/api/staging/reject` | TAK | `be.cjs:48550-48569`. |
| `/api/suppliers` | TAK | `be.cjs:48216-48226`. |

## Skrypty injection

### 1. `pending-injection.js` — przejęcie Atrybutów

- Skrypt deklaruje pełne przejęcie ekranu Atrybutów, ukrywa wcześniejsze kafle offline i buduje własne zachowanie. [pending-injection.js:1-11]
- Wyszukuje instancję React/QueryClient przez Fiber, po czym nadpisuje cache danymi z właściwego `/api/atrybuty`; dodatkowo deduplikuje wpisy. [pending-injection.js:1190-1276]
- Wprowadza własne obserwatory DOM i mechanizmy ponownego podpinania po zmianach widoku. [pending-injection.js:1293-1344,1470-1486]
- Używa także sprawdzenia wykorzystania wartości atrybutu i modułu pending; endpointy pending są zdefiniowane w backendzie. [pending-injection.js:1390-1414; pending_module.cjs:218-386]
- **Co ma wejść natywnie:** komponenty CRUD rodzajów/wartości, lista pending i użycie wartości, jednolity Query key `/api/atrybuty`, mutacje i invalidacje. Nie wolno używać Fiber, `MutationObserver` ani okresowego przejmowania UI jako podstawowego mechanizmu. [pending-injection.js:1190-1276,1293-1344]

### 2. `selly-injection.js` — dodatkowy panel Selly

- Skrypt jest dołączany po bundlu, wstrzykuje własny punkt wejścia/nawigację i reaguje na DOM oraz hash. [index.html:15-19; selly-injection.js:1-26,247-268]
- Operuje na bazie `/panel/api/selly` i nakłada własny panel na istniejącą aplikację. [selly-injection.js:304-345,785-808]
- Backend rejestruje router Selly jako rozszerzenie. [extensions.cjs:381-396; selly/routes.cjs:1-89]
- **Co ma wejść natywnie:** trasa Wouter `/selly`, pozycja w `l2`, komponenty i mutacje Selly w React/TanStack Query. Nie należy utrzymywać overlayu, intervali ani detekcji hash jako routera. [fe.js:16287-16327,28644-28677; selly-injection.js:1-26,247-268]

### 3. `freq-injection.js` — częstotliwość importu dostawcy

- Skrypt dodaje kontrolkę do istniejącej konfiguracji dostawcy, odczytuje dane i wysyła zmianę częstotliwości minutowej przez PATCH. [freq-injection.js:1-15,74-115]
- Wstrzyknięcie działa poza kontrolowanym drzewem komponentów React. [freq-injection.js:1-15]
- **Co ma wejść natywnie:** pole `czestotliwoscMinuty` w edycji dostawcy, bezpośrednia autoryzowana mutacja, invalidacja `suppliers` i obsługa błędów. Dokładny kształt odpowiedzi PATCH jest **NIEZNANY** w zakresie injection. [freq-injection.js:74-115]

## Wniosek implementacyjny

Nowy frontend powinien zachować rzeczywiste API backendu, a funkcje trzech injection włączyć do natywnych tras i komponentów. Nie należy odtwarzać dwóch niedziałających ścieżek atrybutów ani mechanizmów manipulujących DOM/cache poza Reactem. [fe.js:9965-10265; pending-injection.js:1-11,1190-1276; index.html:17-19]
