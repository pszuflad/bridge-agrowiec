---
id: projects/agrorami-api-integration
item_type: wiki_page
semantic_type: project
title: Agrorami API Integration
description: Agrorami API Integration przenosi MO9 ze starszego publicznego feedu CSV Agrorami do uwierzytelnionych danych Magento 2 GraphQL, dzięki czemu staging Bridge otrzymuje rzeczywiste ilości magazynowe i wynegocjowane dane produktowe.
created_at: '2026-07-08T00:00:00+00:00'
updated_at: '2026-07-25T07:46:00+00:00'
language: pl
---
# Agrorami API Integration

Agrorami API Integration to praca Bridge nad kanałem zasilania dostawcy, polegająca na przeniesieniu MO9 ze starszego publicznego feedu CSV Agrorami do uwierzytelnionych danych Magento 2 GraphQL Agrorami, dzięki czemu staging otrzymuje rzeczywiste ilości magazynowe i wynegocjowane dane produktowe[cite:1][cite:3].

## Jak to działa

Aktywne API produktowe Agrorami to Magento 2 GraphQL i wymaga tokenu klienta B2B generowanego przez `generateCustomerToken`; testowane pobrania produktów wykorzystują paginację keyset po identyfikatorach produktów i mogą zasilać istniejący przepływ stagingowy MO9 w Bridge[cite:1][cite:3].

- **GraphQL zamiast REST** — początkowe założenie Magento REST zostało odrzucone po tym, jak dokumentacja Agrorami i sprawdzenie endpointów wykazały, że rzeczywiste API to GraphQL na `sklep.agrorami.pl`, a nie witryna marketingowa WordPress na `agrorami.pl`[cite:1].
- **SKU jako podstawowy identyfikator** — instrukcja klienta Agrorami mówi o identyfikowaniu produktów przez `sku`, ponieważ nie każdy produkt ma EAN, a obecny integrator ma brakujące lub błędne dane SKU/nazwy[cite:1].
- **Pełne pobranie jako pierwsze** — użytkownik wybrał jedno pełne pobranie katalogu, a nie synchronizację przyrostową dla początkowej integracji, ponieważ testowane pobranie keyset jest prostsze i już odpowiada codziennemu przypadkowi użycia importu[cite:3].
- **Źródło prawdy o stanie magazynowym** — Bridge powinien używać `stock_availability.in_stock_real`, a nie `in_stock`; wartości bez sufiksu są dokładnymi ilościami, wartości z sufiksem plus są dolnymi granicami, a wartości puste oznaczają zero/brak w magazynie[cite:2][cite:3].
- **Zachowanie semantyki progu** — dla stanu z sufiksem plus, takiego jak `5+` lub `15+`, należy zapisać surową wartość i wyznaczyć numeryczne minimum, takie jak `stan_min`, ponieważ API Agrorami nie ujawnia ukrytej dokładnej ilości powyżej progu[cite:2].
- **Feed CSV jest niewystarczający** — stary publiczny CSV Agrorami zawierał niskie wartości `magazyn`, które nie zgadzały się z `in_stock_real`, więc naprawa starego parsera CSV nie mogła odzyskać rzeczywistego stanu; produkcyjny MO9 teraz wywołuje moduł API, a nie korzysta z publicznego CSV jako źródła stanu[cite:3][cite:4].
- **Status modułu testowego** — `_mo9_agrorami_api_TEST.cjs` pobrał 1113 produktów z API, odfiltrował produkty quad/kosiarka, wygenerował 990 rekordów gotowych dla Bridge i został poprawiony, tak aby produkty BKT mapowały producenta jako `BKT`, a nie identyfikator producenta Magento `15`[cite:3].
- **Ograniczenie wspólnego parsera rozmiaru** — około 519 z 990 rekordów z API nie miało sparsowanego rozmiaru, ponieważ wspólna ekstrakcja `common.cjs` nie rozpoznaje przemysłowych formatów rozmiaru typu `x/X`, takich jak `8,25x20`; rozszerzenie tego wspólnego parsera wymaga testów regresyjnych we wszystkich parserach dostawców[cite:3].
- **Brak synchronizacji z Selly** — po tym, jak stan MO9 zaczął prawidłowo docierać do Bridge z API, MO9 wciąż nie miał mapowań `selly_products`, więc produkty i stan wymagały synchronizacji dostawcy, takiej jak `/api/selly/sync-supplier`, zanim Selly odzwierciedliłoby 580 rekordów MO9[cite:4].
- **SKU jako kod handlowy, Magento ID jako tożsamość** — parser MO9 używa `sku` Agrorami jako wyświetlanego kodu dostawcy, ale zachowuje Magento ID jako stabilną techniczną tożsamość produktu, aby synchronizacja nie oznaczała istniejących pozycji jako wycofanych ani nie tworzyła duplikatów[cite:4].
- **Formaty przemysłowe BKT** — parser MO9 zachowuje pełne rozmiary z ukośnikiem i `x`, takie jak `550/45x22,5`, oraz pełny wariant prędkości `A8/B`; synchronizacja produkcyjna po poprawce potwierdziła 0 błędów w tych klasach danych[cite:4].
- **Porównanie BKT-only wymaga wariantu** — pytanie o bieżnik dostępny „tylko w BKT” nie powinno być rozstrzygane po samej nazwie bieżnika, bo AT 108 i AGRIMAX RT 765 pojawiają się również w kontekście Agrorami; porównanie wymaga marki, modelu, rozmiaru, indeksu nośności i indeksu prędkości[cite:5].

## See also

- [[projects/bridge-agrowiec]] — import target

## References

[cite:1]: pplx://sessions/d162a179-f200-4bf6-b525-d628131c4fd6
[cite:2]: pplx://sessions/b605555a-6ca0-46fc-a498-2469a31d059b
[cite:3]: pplx://sessions/0f9f758c-5333-41e3-8556-6d245cfa060b
[cite:4]: pplx://sessions/12d4afdd-feb3-4848-af89-20f8fdc9450a
[cite:5]: pplx://sessions/d38f64ee-4416-45d1-85cf-7886b813cb8c
