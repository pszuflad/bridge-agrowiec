---
id: projects/selly-agroopony-catalog-configuration
item_type: wiki_page
semantic_type: project
title: Selly Agroopony Catalog Configuration
description: Selly Agroopony Catalog Configuration to nurt prac przekształcający dane opon Bridge/Agroopony w kategorie, producentów i filtry widoczne dla klienta w Selly na witrynie Agroopony.
created_at: '2026-07-09T08:09:00+00:00'
updated_at: '2026-07-31T09:28:00+00:00'
language: pl
---
# Selly Agroopony Catalog Configuration

Selly Agroopony Catalog Configuration to nurt prac przekształcający dane opon Bridge/Agroopony w kategorie, producentów i filtry widoczne dla klienta w Selly na witrynie Agroopony[cite:1][cite:2].

## Jak to działa

Konfiguracja rozdziela nawigację kategorii, tożsamość producenta, filtrowalne atrybuty techniczne oraz systemowe pola produktu, dzięki czemu Selly może prezentować duży katalog opon bez duplikowania tych samych danych w wielu miejscach[cite:1][cite:2].

- **Drzewo zastosowań dla kategorii** — drzewo kategorii Selly wykorzystuje cztery główne kategorie opon z podkategoriami zastosowań, takimi jak Rolnicze, Przemysłowe, Ciężarowe i Leśne, a następnie węzły zastosowań, takie jak Ciągnik, Przyczepa, Koparka, Oś kierowana, Harwester oraz Uniwersalne/Pozostałe[cite:1].
- **Przypisanie do wielu kategorii** — produkty mogą należeć do więcej niż jednej kategorii, gdy ich zastosowanie się nakłada, więc podwójna klasyfikacja i umieszczenie związane z przyczepami rolniczymi są obsługiwane przez wielokrotne przypisania kategorii, a nie duplikaty rekordów produktów[cite:1][cite:3].
- **Producenci poza drzewem atrybutów** — marki opon są prowadzone przez natywną jednostkę producenta Selly (`/api/producers`) i `producer_id`, a nie jako węzły kategorii czy zwykłe wartości cech; duplikaty różniące się tylko wielkością liter, takie jak CEAT/Ceat, GOODTRIP/GoodTrip i NOKIAN/Nokian, zostały scalone w nazwy producentów pisane wielkimi literami[cite:1].
- **Tylko atrybuty widoczne dla klienta** — atrybuty filtrów obejmują rozmiar, rozmiar alternatywny, szerokość, profil, średnicę, bieżnik/model, indeksy obciążenia i prędkości, znaczniki konstrukcji/techniczne, wartości etykiety UE, rok DOT oraz wybrane logiczne właściwości opon[cite:1][cite:2].
- **Pola systemowe pozostają polami produktu** — cena, stan, EAN, waga i kategoria są mapowane na pola produktu/systemowe Selly, a nie tworzone jako filtry dla klienta; `Waga` pozostaje wartością produktu `weight`, a nie listą 999 wartości filtra[cite:1][cite:2].
- **Ukryty znacznik dostawcy** — `Dostawca` / MO1–MO10 jest zachowywany jako wewnętrzny, niefiltrowany atrybut Selly do logiki magazynu/źródła, a nie pokazywany klientom jako filtr sklepu[cite:1].
- **Granica API dla wartości zerowej** — API Selly odrzuca literalną wartość atrybutu `0` jako pustą, więc wartości zerowe zostały wykluczone z importów atrybutów szerokości i indeksu prędkości, gdy użytkownik zaakceptował to zachowanie[cite:1].
- **Normalizacja szumu przed importem** — Hałas został znormalizowany do formatu `XXdB`, duplikaty różniące się tylko wielkością liter zostały scalone, a zniekształcone wartości, takie jak `72dB - )`, `78dB - )))`, samodzielne `B` i samodzielne `dB`, zostały usunięte przed utworzeniem wartości filtra[cite:1][cite:2].
- **DOT jako filtr roku** — filtrowanie DOT odbywa się według roku produkcji, nie pełnego kodu tydzień-rok; listy lat rozdzielone przecinkami są rozdzielane na poszczególne lata, kody tydzień-rok są pomijane, a `nie starsza niż 3 lata` pozostaje jako wartość jawna[cite:1].
- **Dopasowanie witryny Premium 6** — Premium 6 jest zalecanym szablonem Selly, ponieważ katalog jest bogaty w parametry i zależy od widocznych kategorii, wyświetlania producenta, zwijanych specyfikacji technicznych oraz kontrolek zakupowych, które lepiej działają w zakupach opon niż układy z banerami lifestylowymi[cite:4].
- **Żywe identyfikatory kategorii z DOM witryny** — linki kategorii Selly udostępniają stabilne identyfikatory kategorii w `data-typeid` i `/slug,c{id}.html`; zebrane żywe drzewo obejmuje przykłady takie jak Rolnicze→1, Ciągnik→26, Leśne→377, Harwester→384, Ciężarowe→259 i Oś kierowana→301[cite:5].
- **Konkretne mapowanie kategorii** — Bridge powinien wysyłać najbardziej konkretny `categoryid` dla `kategoria + zastosowanie`, gdy istnieje kategoria podrzędna, z fallbackiem do głównej kategorii, gdy `zastosowanie` jest puste lub nierozpoznane[cite:5].
- **Niedopasowanie kategorii bootstrap** — starsza logika mappera szukała nazw w stylu bootstrap, takich jak `opony rolnicze`, natomiast żywe menu sklepu używa kategorii takich jak `Rolnicze` i `Leśne`; mapowanie musi korzystać z żywego drzewa Selly, a nie z generowanych technicznych placeholderów[cite:5].
- **Słownik `Zastosowanie`** — kontrolowane wartości obejmują typy maszyn/zastosowań w kategoriach Rolnicze, Przemysłowe, Ciężarowe, Leśne i Ogólne, w tym przykłady takie jak Ciągnik, Kombajn, Ładowarka, Koparka, Oś kierowana, Naczepa, Harwester, Forwarder i Uniwersalne[cite:6].
- **Kanoniczne `Zastosowanie` pod Selly** — produkcyjne wartości `zastosowanie` zostały znormalizowane do zamkniętej listy Selly zależnej od kategorii głównej; opony leśne pasujące do dwóch maszyn zapisują w jednym polu `Forwarder, harwester`, aby liczyły się do obu kategorii bez duplikowania produktu[cite:6][cite:7].
- **Bez cofania podkreślnika w kodach Bridge** — podkreślnik w wewnętrznych kodach produktów Bridge rozwiązuje kolizje między dostawcami; problem 2174 rekordów już oznaczonych jako wysłane do Selly dotyczy pomocniczego mapowania starych kodów bez podkreślnika, a nie powodu do cofania poprawki identyfikatorów[cite:5].
- **Symbole Unicode jako tekst** — Selly Integrator czyta znaki takie jak `✓` jako zwykły tekst UTF-8; jeśli symbol ma znaczyć wartość logiczną, Bridge powinien przed importem zamienić go na jednoznaczne `tak/nie`, `1/0` albo tekst cechy[cite:8].
- **Widoczność `✓` na produkcie** — niezmapowany symbol `✓` pojawi się klientowi dokładnie w polu, do którego trafi w schemacie importu, np. w opisie, cesze lub nazwie wariantu; Selly nie tłumaczy go automatycznie na `tak` ani `dostępny`[cite:8].
- **Pełny CSV jako kontrakt integratora** — Selly może pobierać dane przez HTTP/HTTP AUTH/FTP albo plik lokalny, a struktura CSV jest mapowana po stronie integratora; Bridge może więc publikować pełny eksport, o ile stabilne nazwy i format kolumn zostają utrzymane[cite:9].
- **Ograniczony endpoint eksportu** — produkcyjny eksport dla Selly jest plikiem CSV z BOM UTF-8, separatorem `;`, wartościami logicznymi w stylu `Tak`/puste oraz dostępem ograniczonym do IP integratora, generowanym cyklicznie przez cron na serwerze[cite:9].
- **Layout nie jest sterowany przez REST API** — REST API obsługuje dane katalogowe, ale nie udostępnia endpointów dla szablonów, CSS, bloków HTML ani bloga; wygląd modyfikuje się w panelu Edytora szablonów i Bloków HTML[cite:10].
- **Premium 6 jest bazą, nie projektem od zera** — zainstalowany szablon Premium 6 pozostaje fundamentem, a zmiany dotyczą tylko potrzebnych plików i sekcji po wykonaniu backupu wersji „przed”[cite:10].
- **SEO produktu ma osobne pola** — `html_title`, `html_description`, `html_keywords` i `product_rewrite` są właściwymi polami SEO produktu, natomiast `/api/products/{id}/meta` jest magazynem własnych wartości klucz–wartość; opis używa `content_html` i `content_html_short`[cite:10].
- **Front API/UCP pozostaje odrębne od Bridge** — Front API tylko do odczytu i Agentic Commerce/UCP mogą w przyszłości wystawiać katalog asystentom AI, ale bieżąca integracja Bridge korzysta ze zwykłego REST API, a UCP pozostaje niewłączone[cite:10].
- **Natywne komponenty zamiast własnego HTML** — banery kategorii strony głównej korzystają z komponentu E12 i `{#BANNER_KATEGORIE#}`, a slider marek z E06 i `{#PRODUCENCI#}`; porzucono własną sekcję `.machines-grid`, ponieważ dublowała mechanizm Selly[cite:11].
- **Kompilacja i wersjonowanie stylów** — zapis pliku SCSS nie aktualizuje sam witryny: po zmianie trzeba uruchomić `Kompiluj SCSS` i podbić `Ustaw wersję CSS w szablonach`, aby przebudować style i ominąć cache[cite:11].
- **Zatwierdzone ustalenia jako granica projektu** — `USTALENIA_agroopony.md` przechowuje zaakceptowane decyzje o topbarze, menu, sekcjach i treści; elementy niepotwierdzone, takie jak darmowa wysyłka, nie mogą być dopisywane do szablonu[cite:11].
- **Zaawansowana prezentacja cen wymaga modyfikacji szablonu** — Premium 6 nie ma panelowych przełączników dla globalnego separatora tysięcy, jednoczesnego brutto/netto, sum netto według stawek VAT ani dynamicznego netto dla promocji i wariantów; samodzielne przygotowanie obejmuje poprawne stawki VAT i ustawienia danych wejściowych, a wdrożenie frontendu powinno być wycenione łącznie przez Selly[cite:12].
- **E06 korzysta z rekordów producentów** — natywny slider pobiera marki oznaczone jako promowane i wyświetla ich wgrane logo; obecna konfiguracja obejmuje także marki spoza listy docelowej, a brak pliku logo powoduje wyświetlenie nazwy tekstowej[cite:13].
- **Styl kafelka E06 wynika z `.producer-startlogo`** — szare tło i padding pochodzą z wewnętrznego elementu logo, natomiast szerokość slajdu nadaje inline skrypt Swiper; skuteczna korekta CSS musi nadpisywać oba poziomy komponentu[cite:13].

## Granice danych źródłowych

- **Niepełne filtry źródłowe** — pliki źródłowe dla Sezon, HF, LS, Lód, Reinforced, ExtraLoad, CutResistance, HeatResistance i StubbleResistance były puste lub niepełne, więc ich grupy Selly pozostają strukturalnymi placeholderami do czasu istnienia czystych wartości[cite:1][cite:2].
- **Bramka weryfikacji operacji masowych** — operacja na kategorii/produkcie zbiegła się z zniknięciem katalogu i kategorii z widoku sklepu/panelu administracyjnego, więc dalsze masowe mapowanie jest uzależnione od weryfikacji stanu, a nie traktowane jako rutynowa kontynuacja[cite:1][cite:4].

## See also

- [[projects/bridge-agrowiec]] — źródło danych produktowych
- [[projects/selly-tire-search-ux]] — model wyszukiwania w sklepie

## References

[cite:1]: pplx://sessions/df130657-4178-499c-b453-747f629e0305
[cite:2]: pplx://sessions/bdf85296-5573-426a-9e1a-0e7d9d05a7c4
[cite:3]: pplx://sessions/fe37f8b5-bc2e-46c0-a334-12f7e57f0d7d
[cite:4]: pplx://sessions/03b127b5-e704-4bd6-8b5b-53a6de402c7d
[cite:5]: pplx://sessions/d8b84c0c-2187-4f67-8323-9682c1e1c7bf
[cite:6]: pplx://sessions/12d4afdd-feb3-4848-af89-20f8fdc9450a
[cite:7]: pplx://sessions/b7b532ad-dc91-4b84-828d-50e4fb361ca5
[cite:8]: pplx://sessions/98740ed1-15cc-4eb1-8c60-da5361a00b16
[cite:9]: pplx://sessions/fc2830c5-1fb5-44f7-8294-1854dfef123c
[cite:10]: pplx://sessions/685eb28d-31e4-40ee-bc90-c33654f77dd5
[cite:11]: pplx://sessions/08e70c89-2064-4f8f-887a-ad83bc623b07
[cite:12]: pplx://sessions/e920a1ff-4688-4220-ae19-5383818be4b4
[cite:13]: pplx://sessions/5b58cf79-20b5-4420-b75b-2f5d11e93c89
