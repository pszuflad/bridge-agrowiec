---
id: projects/selly-tire-search-ux
item_type: wiki_page
semantic_type: project
title: Selly Tire Search UX
description: Selly Tire Search UX to prace projektowe nad wyszukiwaniem/filtrami w witrynie Agrowiec, wykorzystujące OponyExpress.pl jako punkt odniesienia dla zależnego wyszukiwania opon, filtrów listy, prezentacji dostępności oraz układu strony produktu w sklepie opon Selly.
created_at: '2026-07-04T00:00:00+00:00'
updated_at: '2026-07-31T09:28:00+00:00'
language: pl
---
# Selly Tire Search UX

Selly Tire Search UX to prace projektowe nad wyszukiwaniem/filtrami w witrynie Agrowiec, wykorzystujące OponyExpress.pl jako punkt odniesienia dla zależnego wyszukiwania opon, filtrów listy, prezentacji dostępności oraz układu strony produktu w sklepie opon Selly[cite:1][cite:2].

## Jak to działa

Docelowe doświadczenie wyszukiwania łączy szybkie parsowanie rozmiaru, techniczne filtry oparte na kategorii, wyszukiwanie po dopasowaniu do pojazdu oraz filtrowanie na stronie wyników, zamiast jednej płaskiej listy producent/kategoria[cite:1][cite:2].

- **Zweryfikowany w przeglądarce punkt odniesienia przed specyfikacją** — użytkownik odrzucił spekulatywną analizę strony i zażądał rzeczywistej weryfikacji sterowaniem przeglądarką na OponyExpress.pl, zanim zachowanie zostało przekształcone w wymagania Selly[cite:1][cite:2].
- **Dwa sposoby wejścia** — przepływ referencyjny ma szybkie wyszukiwanie po rozmiarze oraz dwie centralne zakładki: wyszukiwanie opon po rozmiarze i wyszukiwanie opon po pojeździe[cite:2].
- **Zwarte i rozdzielone parsowanie rozmiaru** — szybkie wyszukiwanie przyjmuje rozdzielony tekst rozmiaru, taki jak `205/55r16`, oraz zwarty tekst numeryczny, taki jak `2055516`, więc odpowiednik Agrowiec potrzebuje parsera, który rozdziela szerokość/profil/średnicę z obu form[cite:2].
- **Kategoria kontroluje widoczne filtry** — ścieżka wyszukiwania po rozmiarze zaczyna się od kategorii produktu; opony osobowe udostępniają sezon, natomiast opony rolnicze skrywają sezon, a niektóre szerokości rolnicze mogą skrywać profil, gdy nie istnieją kombinacje profilu[cite:2].
- **Ścieżka dopasowania do pojazdu jest kaskadowa** — zakładka pojazdu wymaga Marki, Modelu, Roku produkcji, Generacji i Silnika, gdzie każdy wyższy poziom wyboru zasila kolejne pole[cite:2].
- **Listy niosą stan aktywnych filtrów** — strony wyników pokazują chipy aktywnych filtrów, kontrolę resetowania wszystkich, boczne filtry zawężone do dostępnych kombinacji, przełączniki dostępności, kontrolki rozmiaru strony, sortowanie oraz klasyczną paginację[cite:2].
- **Dostępność jest stopniowana** — karty listy i produktu rozróżniają statusy takie jak `DOSTĘPNE` i `MAŁO`, a nie traktują stanu tylko jako tak/nie[cite:2].
- **Karty produktu prezentują pola techniczne i handlowe razem** — karty listy pokazują obraz, indeks katalogowy, dostępność, parametry opony, cenę brutto/netto, ilość, dodanie do koszyka, porównanie oraz akcje zapisu[cite:2].
- **Logistyka PDP jest wyraźna** — strona szczegółów produktu zawiera koszt dostawy, parametry techniczne, cenę brutto/netto, ilość, dodanie do koszyka, kontrolki zapisu/porównania oraz zakładki opisu, cech i etykiety UE[cite:2].
- **Priorytet implementacji Selly** — elementy niezbędne to zależne filtry kategoria/rozmiar/producent, szybkie parsowanie rozmiaru, chipy aktywnych filtrów, prezentacja list z priorytetem dostępności oraz pola techniczne mapowane z danych produktowych Bridge[cite:1][cite:2].
- **Kierunek uruchomienia Premium 6** — zalecanym kierunkiem szablonu Selly jest Premium 6, ponieważ jego menu kategorii, koszyk/panel boczny, kontrolki zakupowe na stronie produktu, zwijane specyfikacje oraz wyświetlanie producenta lepiej odpowiadają technicznemu katalogowi opon niż szablony o charakterze lifestylowym[cite:1].
- **Skromny zestaw form dostawy** — witryna powinna zacząć od dostawy kurierem, odbioru osobistego oraz dostawy przez partnera serwisowego; płatność za pobraniem jest skonfigurowana jako metoda płatności przypisana do formy dostawy, a nie duplikat metody wysyłki[cite:1][cite:3].
- **Import podstawowy a atrybuty filtrów** — pierwszy import Selly bez wariantów może wczytywać produkty, stan, EAN, cenę, VAT, producenta i kategorię, ale marka/model/rozmiar jako pola filtrowalne wymagają schematu opartego na wariantach/opcjach, takiego jak `Import cechy warianty`[cite:3][cite:4].
- **System wizualny Agroopony** — makiety sklepu używają czerni `#000000`, żółci `#ffc709`, jasnego tła i ikon opon; żółty jest akcentem CTA, promocji, aktywnych filtrów i paginacji[cite:5].
- **Bezpieczna granica edycji szablonu** — HTML, klasy CSS, wrappery i kolejność sekcji można przebudowywać, ale makra `{#...#}`, warunki `{$if ...$}`, bloki `<!-- block:... -->`, nazwy pól formularzy i akcje silnika muszą pozostać zachowane[cite:5].
- **Normalizacja dopiero przy wysłaniu formularza** — skrypt wyszukiwarki obsługuje formaty radialne, diagonalne i ATV, ale nie modyfikuje pola podczas pisania; rezygnacja z `MutationObserver` usuwa dublowanie handlerów, a oznaczenie `R` ma pierwszeństwo w rozstrzyganiu formatu[cite:6].
- **Natywne `{#QUERY#}` odtwarza poprzednie wyszukanie** — wartość pola po przeładowaniu pochodzi z mechanizmu Selly, więc jej czyszczenie jest osobną decyzją UI, a nie częścią parsera rozmiaru; gotowy kod normalizatora pozostaje zapisany do późniejszego wdrożenia[cite:6].

## See also

- [[projects/bridge-agrowiec]] — product data source
- [[projects/selly-agroopony-catalog-configuration]] — category/filter setup

## References

[cite:1]: pplx://sessions/3c6bec96-3215-407a-98bb-01cbe68cf9ee
[cite:2]: pplx://sessions/9ce5db47-00c0-4948-8c64-fe4cb813de08
[cite:3]: pplx://sessions/833252da-640c-4bbf-bb51-0bcea9d7109b
[cite:4]: pplx://sessions/dd872d44-acce-4de2-afcc-f96a381ef7e5
[cite:5]: pplx://sessions/e9f305c1-c988-4334-ae23-5b761ac3cf24
[cite:6]: pplx://sessions/5b58cf79-20b5-4420-b75b-2f5d11e93c89
