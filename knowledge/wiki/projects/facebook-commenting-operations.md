---
id: projects/facebook-commenting-operations
item_type: wiki_page
semantic_type: project
title: Facebook Commenting Operations
description: Facebook Commenting Operations to wielomarkowy workflow sterowania przeglądarką użytkownika do znajdowania kwalifikujących się postów w grupach na Facebooku, proponowania lub publikowania zatwierdzonych komentarzy biznesowych oraz wysyłania podsumowań po komentarzach do WhatsApp i Google Sheets...
created_at: '2026-06-11T00:00:00+00:00'
updated_at: '2026-08-06T07:51:00+00:00'
language: pl
---
# Facebook Commenting Operations

Facebook Commenting Operations to wielomarkowy workflow sterowania przeglądarką użytkownika do znajdowania kwalifikujących się postów w grupach na Facebooku, proponowania lub publikowania zatwierdzonych komentarzy biznesowych oraz wysyłania podsumowań po komentarzach do WhatsApp i Google Sheets[cite:1][cite:2][cite:3].

## Jak to działa

Workflow działa w ramach odrębnych profili marek dla BOWIT, Microauto Ziębice i Columbus Cars, przy czym każda marka używa własnych zasad kwalifikacji, numerów telefonów, czatu WhatsApp oraz zakresu produktów/pojazdów[cite:1][cite:2][cite:3].

- **Bezpieczeństwo profilu jako priorytet** — sesje zaczynają się od weryfikacji aktywnego profilu na Facebooku i zatrzymują się, jeśli istnieje ryzyko publikacji z niewłaściwego profilu[cite:1][cite:2].
- **Kontrola świeżości i duplikatów** — sesje BOWIT i Microauto sprawdzają wiek posta, wcześniejsze komentarze marki oraz kontekst Google Sheets/autor-słowo kluczowe przed skomentowaniem[cite:1][cite:2].
- **Zatwierdzenie użytkownika domyślnie** — gotowe komentarze są prezentowane do zatwierdzenia przed publikacją, a użytkownik często ręcznie potwierdza publikację, zanim poprosi o podsumowania WhatsApp[cite:1][cite:2][cite:3][cite:5][cite:6][cite:7].
- **WhatsApp jako dziennik operacyjny** — po publikacji, każdy komentarz jest przekształcany w ustrukturyzowaną wiadomość WhatsApp z krótkim podsumowaniem posta, pełnym komentarzem i linkiem[cite:1][cite:2][cite:3][cite:10][cite:11].
- **Raportowane są tylko opublikowane komentarze** — przygotowane komentarze oczekujące na zatwierdzenie, pominięte leady i duplikaty pozostają poza końcowym raportem WhatsApp/Sheets, chyba że użytkownik potwierdzi, że zostały faktycznie opublikowane[cite:10][cite:11].
- **Sformułowania komentarza dopasowane do niepewności** — gdy dostępność lub dopasowanie jest niepewne, komentarz powinien obiecywać sprawdzenie lub dopasowanie, a nie dokładną dostępność[cite:1][cite:4].
- **Zakres marki ważniejszy niż ogólne przechwytywanie leadów** — gdy post dotyka zabronionej kategorii, niewspieranego modelu, zduplikowanego autora/tematu lub budżetu poza zakresem, workflow pomija go, nawet jeśli istnieje bliski kąt sprzedażowy[cite:5][cite:6][cite:8].
- **Konkretny stan magazynowy ważniejszy niż ogólne usługi** — dla leadów Columbus opartych na stanie magazynowym, komentarze najpierw wymieniają rzeczywiste samochody lub produkty na stanie, a dopiero potem dodają CTA[cite:7][cite:9].
- **Bezpośredni przebieg grup po skanowaniu feedu** — jeśli feed grupy Columbus nie ma kwalifikujących się leadów, workflow może przejść bezpośrednio do głównych grup; przebieg z 2026-06-14 znalazł lead na kamerę przednią do Wranglera tylko po przeskanowaniu kluczowych grup poza feedem[cite:12].
- **Odrębne raportowanie operacyjne dla każdej marki** — sesje Columbus raportują do `Komentarze Columbus`, a sesje BOWIT do `Komentarze Bowit`, przy czym każdy opublikowany komentarz jest mapowany na własną wiadomość WhatsApp i wiersz Google Sheets[cite:13][cite:14].
- **Przechwytywanie permalinku przed raportowaniem** — dokładne linki do postów na Facebooku powinny być przechwytywane w momencie komentowania, aby wpisy WhatsApp i Google Sheets nie sprowadzały się do ogólnych adresów URL czy placeholderów[cite:15][cite:16].
- **Nadpisanie użytkownika ograniczone zasadami marki** — użytkownik może poprosić o kontynuowanie wyszukiwania po limicie sesji, ale kwalifikacja marki wciąż wygrywa; w przypadku Columbus leady z silnikami poniżej 5.0 zostały pominięte po korekcie[cite:15].
- **Kompletność przebiegu przez grupy** — po skanowaniu feedu, workflow powinien wprost przejść przez priorytetowe grupy marki w ustalonym porządku; użytkownik poprawił przebieg Columbus, który podsumował wynik, zanim przejrzano wszystkie grupy[cite:17].
- **Wpisy w arkuszu odzwierciedlają istniejące wiersze** — przy logowaniu wyników BOWIT, opublikowany komentarz jest dodawany jako normalny wiersz w istniejącym schemacie, a nie jako odrębny blok podsumowania sesji[cite:18].
- **Grupowanie ze względu na limity sterowania przeglądarką** — praca sterowania przeglądarką Comet jest lepiej organizowana jako mniejsza liczba dłuższych sesji opartych na trasach, a nie wiele rozdrobnionych promptów, ponieważ praktyczne limity wydają się bardziej związane z liczbą żądań/zadań/akcji niż z ciągłą długością sesji[cite:19].
- **Weryfikacja sklepu przed pewnością** — dla leadów na części Columbus i BOWIT, twierdzenie o kategorii na stanie jest bezpieczne tylko po sprawdzeniu sklepu lub instrukcji; dokładne obiecania wariantu pozostają w języku „sprawdzimy/dobiorę”, gdy dopasowanie jest niepewne[cite:20][cite:21].
- **Ryzyko kompresji kontekstu** — długie przebiegi grup sterowania przeglądarką mogą stracić aktualną trasę po kompresji konwersacji, więc aktywna marka, porządek grup i obecna grupa powinny być przypomniane przed dalszym długim skanowaniem[cite:22].
- **Timer sesji jako warunek zatrzymania** — gdy instrukcja marki ustala limit przebiegu 30 minut, asystent powinien zamknąć lub zapytać o zamknięcie przebiegu w tym limicie, nawet jeśli opublikowano mniej niż trzy komentarze[cite:23][cite:24].
- **Fallback limitu sterowania przeglądarką** — jeśli limity zadań sterowania przeglądarką aktywują się po opublikowaniu komentarza, pozostała prośba powinna być odpowiedziana jako czysty tekst, gdy użytkownik prosi o wyłączenie sterowania przeglądarką, zwłaszcza dla podsumowań WhatsApp/Sheets[cite:25][cite:26].
- **Bezpieczne celowanie sterowania przeglądarką** — gdy proszony o wpisanie przygotowanego komentarza przez sterowanie przeglądarką, workflow powinien zatrzymać się, jeśli właściwy post i widoczne pole komentarza nie są rozpoznawalne, a nie ryzykować zapisanie pod niewłaściwym postem na Facebooku[cite:27].
- **Ręczna naprawa raportowania** — jeśli nagłówek Sheets zostanie przypadkowo nadpisany podczas przebiegu logowania sterowania przeglądarką, przywróć nagłówek i kontynuuj bez zmiany istniejących wierszy komentarzy[cite:28].
- **Sygnał wyczerpania feedu** — przebieg może się zakończyć, gdy feed zapętli się do początkowego posta po pełnym skanowaniu, przy czym raportowane są tylko faktycznie opublikowane komentarze, a pominięte kategorie są podsumowane dla użytkownika[cite:29].
- **Raportowanie zero komentarzy** — gdy pełny przebieg feed-plus-grupy nie daje żadnych opublikowanych komentarzy, workflow nie wysyła wiadomości WhatsApp i nie zapisuje wierszy Google Sheets, ponieważ raportowanie jest ograniczone do faktycznie opublikowanych komentarzy[cite:30][cite:31].
- **Zero komentarzy po pominiętym kandydacie** — jeśli użytkownik każe pominąć przygotowany komentarz, a dalszy przebieg nie publikuje nic przed limitem czasu, sesja kończy się bez WhatsApp i bez Google Sheets, nawet gdy kandydat został opisany w podsumowaniu[cite:59].
- **Granica potwierdzenia w Sheets** — po tym, jak przebieg Columbus wysyła podsumowania WhatsApp, utworzenie wiersza w Google Sheets wciąż wymaga wyraźnego potwierdzenia, zanim asystent edytuje zewnętrzny arkusz[cite:32].
- **Weryfikacja wariantu przed dokładnymi twierdzeniami** — kompletne silniki, części nadwozia zależne od koloru, samodzielne końcówki wydechu i podobne leady zależne od wariantu wymagają weryfikacji sklepu lub stanu magazynowego przed publicznym językiem dostępności[cite:33][cite:34][cite:35].
- **Limit czasowy ważniejszy niż niewykorzystane sloty komentarzy** — sesja, która osiąga limit marki 30 minut, powinna zostać zamknięta lub zapytana o zamknięcie, nawet gdy kwota trzech komentarzy nie została osiągnięta[cite:35].
- **Bezwzględne zatrzymanie przy złym profilu** — jeśli workflow określa dokładny profil na Facebooku, a ten profil jest niedostępny, przebieg zatrzymuje się przed skanowaniem lub publikacją, a nie kontynuuje z bliskiego profilu marki[cite:36].
- **Istniejący schemat arkusza wygrywa** — gdy Google Sheet marki używa innego porządku kolumn niż szablon promptu, krok logowania powinien dodawać wpisy do istniejącej struktury żywego arkusza, a nie wymuszać schemat szablonu[cite:37].
- **Sekwencja wierszy tylko dla opublikowanych** — przebiegi Columbus mogą kontynuować po jednym opublikowanym komentarzu, ale każda potwierdzona publikacja otrzymuje własny wiersz i wiadomość WhatsApp, przed przejściem asystenta do kolejnych grup[cite:38][cite:39].
- **Schemat przechwytywania leadów nadpisuje schemat promptu** — gdy użytkownik poprawia arkusz leadów do mniejszej liczby pól, przyszłe logowanie powinno kierować się poprawionymi żywymi kolumnami, a nie szerszym blokiem instrukcji[cite:40].
- **Ponowna próba niezapisanych wpisów arkusza** — jeśli zapis do Google Sheets nie utrzymuje się podczas logowania przez sterowanie przeglądarką, zapisz ponownie do widocznych komórek siatki i zgłoś końcowe numery wierszy[cite:41].
- **Przegląd pojedynczy dla Microauto** — kandydujące posty Microauto powinny być prezentowane pojedynczo przed skomentowaniem, ponieważ użytkownik poprawił przepływ wsadowy i następnie zatwierdzał lub odrzucał kandydatów indywidualnie[cite:42].
- **Śledzenie kandydata przed zatwierdzeniem** — jeśli kandydujący post BOWIT zostanie utracony przed zatwierdzeniem/publikacją, sesja może się zakończyć bez raportu; niepublikowane wersje robocze nie są wpisywane do WhatsApp czy Sheets[cite:43].
- **Niedopasowanie specyfikacji ważniejsze niż dostępność magazynowa** — pozycja na stanie wciąż się nie kwalifikuje, jeśli nie spełnia podanej specyfikacji kupującego, jak w przypadku kompresorów OFD Columbus, które nie były zasilane z gniazda zapalniczki[cite:44].
- **Naprawa zajętych wierszy** — jeśli przebieg Sheets przez sterowanie przeglądarką zaczyna zapisywać w zajętych wierszach, natychmiast wycofaj, sprawdź, czy dane wcześniejsze zostały przywrócone, i dodaj wiersze opublikowanych komentarzy na końcu żywego arkusza[cite:45].
- **Przechwytywanie permalinku przed zamknięciem** — publikacja Microauto może wciąż zostać zaraportowana bez dokładnego permalinku, ale brakujący bezpośredni link do posta staje się zaległością do uzupełnienia; przechwytuj permalink przed zamknięciem karty, kiedy to możliwe[cite:46].
- **Odzyskanie po naciskach na sterowanie przeglądarką** — jeśli asystent początkowo mówi, że nie może kontrolować przeglądarki, użytkownik może powtórzyć `użyj sterowania przeglądarką`; udane sesje wtedy kontynuują poprzez wbudowane sterowanie przeglądarką i wciąż wymagają zatwierdzenia dla każdego komentarza przed publikacją[cite:47][cite:48].
- **Żywy schemat ważniejszy niż schemat promptu** — żywy arkusz Microauto może używać zwartej struktury czterokolumnowej, więc szczegóły zachowujące duplikaty, takie jak autor, powinny być dopasowane do istniejącego kształtu wiersza, a nie dodawane jako nowe kolumny bez zatwierdzenia użytkownika[cite:48].
- **Granica korekty po publikacji** — jeśli przerwanie sterowania przeglądarką powoduje opublikowanie komentarza przed zastosowaniem żądanej przez użytkownika korekty sformułowania, workflow powinien traktować edycję komentarza na Facebooku i aktualizację Sheets/WhatsApp jako odrębny krok potwierdzenia[cite:49].
- **Pomijanie budżetu na granicy wymaga decyzji użytkownika** — posty Microauto ograniczone dokładnie do 10 000 zł są niejednoznaczne względem zasady `poniżej 10 000 zł`; przebieg z 2026-07-11 pominął taki post tylko po wyraźnej decyzji użytkownika[cite:50].
- **Deduplikacja leadów na kampery po autorze** — logowanie leadów na kampery teraz sprawdza istniejącą kolumnę autora w Google Sheets przed dodaniem leadu prywatnej oferty, więc powtórni właściciele znalezieni w kolejnych grupach są pomijani, a nie logowani ponownie[cite:51].
- **Dokładny wariant w komentarzu Columbus** — jeśli sklep potwierdza kategorię produktu, ale nie żądany wariant, komentarz publiczny powinien nazwać dostępne warianty i brak żądanego wariantu, jak przy owiewce RAM V gen dostępnej w przyciemnianej/czarnej wersji, bez chromu[cite:52].
- **Pomijanie pojazdów poza realnym zakresem Columbus** — leady na RAM 3500/F-350 `bliźniak` nie powinny przechodzić jako ogólny import, gdy użytkownik potwierdza, że Columbus nie ma takich egzemplarzy w ofercie[cite:52].
- **Używane części BOWIT jako sprawdzenie dostępności** — dla używanych i wnętrzowych części mikrosamochodowych, takich jak wiatrak dmuchawy z nagrzewnicy, komentarze BOWIT powinny używać języka `sprawdzimy aktualną dostępność w używanych`, a nie obiecywać konkretny stan[cite:53].
- **BOWIT bez dokładnego linku przy braku wariantu** — gdy partsmicrocar.pl nie ma online konkretnego silniczka lub mechanizmu szyby do Ligiera Xtoo, komentarz powinien wrócić do języka `sprawdzimy czy akurat ... jest dostępny` i nie wklejać linku do niepasującej części[cite:54].
- **Columbus pomija kategorię bez stanu** — jeśli użytkownik potwierdzi, że Columbus nie ma danej kategorii, takiej jak wydechy RAM, lead jest pomijany; przy kategoriach dostępnych, takich jak bed racki RAM gen 5, najpierw sprawdzaj sklep, a dopiero potem publikuj twierdzenie o dostępności[cite:55].
- **BOWIT: link bez ceny tylko po świadomym nadpisaniu** — gdy sklep potwierdza dokładną część, użytkownik może nadpisać grupową zasadę bez linków i kazać wkleić bezpośredni link; publiczny komentarz nadal nie powinien zawierać ceny, jeśli użytkownik ją wykluczy[cite:56].
- **Columbus: pojedyncze elementy kontra komplety** — jeśli klient szuka pojedynczego elementu, a Columbus sprzedaje tylko komplet, lead należy pominąć zamiast sugerować sprawdzenie pojedynczej sztuki[cite:57].
- **Camper: obserwacja bez dołączania do grup** — workflow kamperowy nie dołącza do nowych grup w trakcie przebiegu; grupy widoczne tylko jako `Dołącz` są raportowane jako niedostępne, a skanowanie kontynuuje się na grupach już dostępnych dla profilu[cite:58].
- **Microauto bez zbiorczego WhatsApp** — po sesji Microauto każdy opublikowany komentarz jest raportowany jako osobna wiadomość WhatsApp, a sesje bez publikacji nie wysyłają wiadomości do czatu[cite:60].

## See also

- [[entities/centrum-motoryzacyjne-bowit]] — microcar parts profile
- [[entities/microauto-ziebice]] — microcar vehicle profile
- [[entities/columbus-cars]] — US vehicles profile
- [[projects/camper-rental-facebook-lead-research]] — camper profile workflow
- [[projects/facebook-commenting-bot-v2]] — docelowy wspólny silnik

## References

[cite:1]: pplx://sessions/2af8a8e3-0f08-4b6d-8772-bae9426cc1d1
[cite:2]: pplx://sessions/b4864529-e89f-4e5d-812a-7f8f652acb09
[cite:3]: pplx://sessions/feae542c-d437-4753-b093-b37f8680b330
[cite:4]: pplx://sessions/a1828570-e67b-40f2-82c7-bf80c36bd79f
[cite:5]: pplx://sessions/a7fc2b1e-0ae8-46ec-8af5-7025a4adf183
[cite:6]: pplx://sessions/72287236-f142-4612-9984-eef3cca5bf4b
[cite:7]: pplx://sessions/254812f1-d6b4-4908-a90a-e202915e5e13
[cite:8]: pplx://sessions/6a69bfd1-99f2-45b4-987e-fc6fdd4607ec
[cite:9]: pplx://sessions/8efb5cd3-dca2-4769-a28f-634afdad37a4
[cite:10]: pplx://sessions/078cf929-2ed2-4ed4-9622-1486de1c77fd
[cite:11]: pplx://sessions/cdffe53c-5890-4a9c-bb64-0ed6e8aeda72
[cite:12]: pplx://sessions/0249b984-a6e6-4cb9-8912-7fb9cb7bf2d8
[cite:13]: pplx://sessions/7ffcca88-63dc-44be-ac04-b74dd6dd20f0
[cite:14]: pplx://sessions/14ca7674-6112-43c0-8acb-dd77c0de9a30
[cite:15]: pplx://sessions/8995b931-00e3-4dfb-b674-ea53a9956932
[cite:16]: pplx://sessions/125d9db7-9ae3-4c3a-8f56-4769eadf21a8
[cite:17]: pplx://sessions/2100cc8a-f196-431e-b299-e70ced56f5fe
[cite:18]: pplx://sessions/7a85fc62-f571-4dba-88da-7583b457cf18
[cite:19]: pplx://sessions/17a5e090-6239-48af-903d-870284b5b55b
[cite:20]: pplx://sessions/945e0f41-83d7-4ee8-a059-68ae1176e766
[cite:21]: pplx://sessions/97dd18b9-0b67-4c03-8c4a-1c541324280a
[cite:22]: pplx://sessions/fc2b3e19-4fa7-4840-8086-35ec8b0a9765
[cite:23]: pplx://sessions/fd2de767-89bc-4dcc-b2db-e9c9abf11aaf
[cite:24]: pplx://sessions/1f56e965-173d-4442-8b69-058b4bc903b3
[cite:25]: pplx://sessions/df750005-dd55-4c00-8cb4-0c56c2eb45ae
[cite:26]: pplx://sessions/838042cf-7337-476a-b505-957791eee979
[cite:27]: pplx://sessions/9e4937f9-4fcf-477a-8537-b56dc46da80b
[cite:28]: pplx://sessions/a6990a4d-4dfd-4e3b-a3b9-338d5a440806
[cite:29]: pplx://sessions/afe39438-8cbd-4224-aac2-11386b814d6b
[cite:30]: pplx://sessions/02e831e7-d206-46f4-bedd-700c902c4823
[cite:31]: pplx://sessions/5e367c60-873a-4077-8748-a59e3394320e
[cite:32]: pplx://sessions/fcd98e99-d3ce-4785-ace1-8ad370fddecb
[cite:33]: pplx://sessions/5360ec45-a997-4ed6-a768-ec5be876528a
[cite:34]: pplx://sessions/1800f118-afb6-47b0-b7f0-fbc3d5e8f9c4
[cite:35]: pplx://sessions/8238c7bc-ba88-459a-b64a-d787236baa20
[cite:36]: pplx://sessions/30e0956e-1324-4cc0-8988-41d135e492ac
[cite:37]: pplx://sessions/172dc858-e517-45de-b6ed-9d8b83ed6cf3
[cite:38]: pplx://sessions/e61f1b18-6f35-438c-8816-741f831da190
[cite:39]: pplx://sessions/0ef8450f-534d-4ce4-b194-f4e7dc8b9fc2
[cite:40]: pplx://sessions/a52b48d3-03c5-4775-b984-c302c31fbd73
[cite:41]: pplx://sessions/36b5d5b9-b65c-496b-964f-d114d3a5059e
[cite:42]: pplx://sessions/165503ec-addd-4161-96e7-11118d01abfe
[cite:43]: pplx://sessions/6287cb8c-1e96-4633-bfb1-804ffac8a350
[cite:44]: pplx://sessions/4df52787-4f7e-4e20-aeed-a3fb83c50fa4
[cite:45]: pplx://sessions/1fb44cd3-1ca1-42b6-ac02-445d5a1c0097
[cite:46]: pplx://sessions/e7eb2f3d-ce25-42dc-a987-1421eae3fe26
[cite:47]: pplx://sessions/b6c40450-d64a-4012-a625-85e975ef9885
[cite:48]: pplx://sessions/4978cc0b-6044-4faa-ac84-ab0a28b2917b
[cite:49]: pplx://sessions/452060a0-35c6-4906-be45-861aaeb20f6f
[cite:50]: pplx://sessions/d683e4e5-1d7c-4b6e-9244-12ef5bab2570
[cite:51]: pplx://sessions/7a045e3e-c116-4ecd-96d8-37d043b1760e
[cite:52]: pplx://sessions/34238ea4-c2dc-4690-814e-93ad496e2ca5
[cite:53]: pplx://sessions/105897df-c99f-4adb-8ad7-7789bbbfc592
[cite:54]: pplx://sessions/142c97f0-4b68-44c9-84a2-440f470cc6bf
[cite:55]: pplx://sessions/62031899-5cc0-4ef1-be0d-12e402a34a4b
[cite:56]: pplx://sessions/d6d1460f-bc82-43eb-8a6c-f3e7ce991865
[cite:57]: pplx://sessions/02a0fc98-109f-4168-a10a-aa2a0e4bf362
[cite:58]: pplx://sessions/b429c22d-edce-4631-8665-5442fb5bb011
[cite:59]: pplx://sessions/c177b07c-ff78-4915-b4c8-f5ab3ca0dcb2
[cite:60]: pplx://sessions/dd824400-6ca7-45c0-8f2e-e5a1b3b79b8b
