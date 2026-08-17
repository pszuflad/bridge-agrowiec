---
id: projects/camper-rental-facebook-lead-research
item_type: wiki_page
semantic_type: project
title: Camper Rental Facebook Lead Research
description: Camper Rental Facebook Lead Research to workflow skanowania grup na Facebooku w celu znalezienia osób prywatnych oferujących kampery na wynajem, prowadzony z wymaganego profilu Andrzej Kot.
created_at: '2026-07-03T00:00:00+00:00'
updated_at: '2026-08-07T10:54:00+00:00'
language: pl
---
# Camper Rental Facebook Lead Research

Camper Rental Facebook Lead Research to workflow skanowania grup na Facebooku w celu znalezienia osób prywatnych oferujących własnego kampera na wynajem, prowadzony z wymaganego profilu Andrzej Kot[cite:1][cite:11].

## Jak to działa

Workflow przeszukuje feedy grup na Facebooku oraz nazwane grupy dotyczące kamperów w poszukiwaniu świeżych postów lub komentarzy, w których osoba prywatna oferuje własny kamper na wynajem. Post osoby szukającej kampera jest tylko miejscem do sprawdzenia odpowiedzi prywatnych właścicieli i sam nie trafia do arkusza[cite:1][cite:11].

- **Wykonanie ograniczone do profilu** — przebieg musi działać z profilu Andrzej Kot; jeśli Facebook udostępnia tylko inny aktywny profil, taki jak Columbus USA Cars, workflow zatrzymuje się przed skanowaniem czy publikacją[cite:1].
- **Cel to prywatna oferta** — celem nie jest klient szukający kampera, lecz prywatni komentujący lub autorzy postów oferujący własny camper na wynajem; posty firmowe są użyteczne tylko wtedy, gdy ich komentarze ujawniają prywatnych właścicieli kamperów[cite:1].
- **Granica świeżości** — posty są ograniczone do ostatnich 12 godzin, a wyczerpanie feedu jest oceniane na podstawie sygnałów końca feedu Facebooka, 15 kolejnych postów starszych niż 7 dni lub limitu sesji 30 minut[cite:1].
- **Trasa grup priorytetowych** — po głównym feedzie grupy workflow przegląda grupy dotyczące wynajmu kamperów, takie jak `Kampery, kampervany, przyczepy kempingowe`, `Wynajem Kamperów` i `Wynajmij kampera - Ogłoszenia`, przed zakończeniem przebiegu[cite:1].
- **Pięciokolumnowy schemat Sheets** — aktywny arkusz używa kolejno pól `data i godzina`, `treść posta`, `autor`, `osoba prywatna tak / nie` i `link do posta`; nowy wpis jest dodawany natychmiast po znalezieniu i po sprawdzeniu autora pod kątem duplikatu[cite:11].
- **Witryna jako sygnał firmy** — lead na wynajem kampera z własną witryną jest traktowany jako firma i usuwany z przechwytywania, a nie pozostawiany jako lead prywatnej oferty[cite:3].
- **Kubełek weryfikacji** — leady z profili osobistych z sprzecznymi sygnałami biznesowymi, takimi jak faktury VAT, ogłoszenia OLX czy sformułowania w liczbie mnogiej „wynajem kamperów”, pozostają jako `do weryfikacji`, a nie są automatycznie akceptowane[cite:2][cite:3][cite:4].
- **Powierzchnie zablokowanego dostępu** — jeśli konto arkusza nie ma dostępu lub grupy priorytetowe są prywatne/oczekujące, workflow odnotowuje blokadę i kontynuuje z dostępnymi grupami, zamiast czekać w nieskończoność[cite:2].
- **Natychmiastowe logowanie w Sheets** — kwalifikujące się wpisy lub wymagające weryfikacji dotyczące kamperów są zapisywane do Sheets w momencie znalezienia, a nie zbiorczo; jeśli użytkownik zauważy zidentyfikowane, ale niezapisane wpisy, workflow wraca i loguje je przed zakończeniem[cite:5].
- **Weryfikacja numeru komercyjnego** — profil osobisty, którego numery telefonów pojawiają się również w komercyjnym ogłoszeniu wynajmu kamperów, pozostaje `do weryfikacji`, a nie jest akceptowany jako prywatny właściciel[cite:5].
- **Rozszerzona trasa jedenastu grup** — obecna trasa dla kamperów obejmuje jedenaście nazwanych grup i zatrzymuje się tylko po zakończeniu trasy, limicie 30 minut lub wyraźnym przerwaniu przez użytkownika; jeden przerwany przebieg zalogował trzy leady w grupach 1–2 i pozostawił grupy 3–11 do możliwego kontynuowania[cite:6].
- **Sygnał przerwanego przebiegu** — przebieg dla kamperów może nie wystartować, gdy asystent prosi o potwierdzenie profilu Andrzej Kot, a tura sterowania przeglądarką zostaje pominięta; taki przebieg nie daje żadnego pokrycia grup i żadnych wierszy leadów[cite:7].
- **Deduplikacja po kolumnie autora** — przed dodaniem właściciela kampera, workflow sprawdza, czy autor już występuje w kolumnie C Google Sheets; przebieg z 2026-07-11 pominął Piotra Szczawińskiego, Natalię Węgrzyn i Piotra Jończyka jako duplikaty i pozostawił arkusz na poziomie 52 wpisów[cite:8].
- **Niedostępne grupy bez dołączania** — jeśli część listy priorytetowej pojawia się tylko jako grupy z przyciskiem `Dołącz`, workflow nie dołącza do nich samodzielnie; raportuje brak dostępu i zapisuje wyniki tylko z grup już dostępnych dla profilu Andrzej Kot[cite:9].
- **`Do weryfikacji` dla niejednoznacznych ofert** — niejednoznaczne oferty z profili osobowych, które mogą być prywatne albo firmowe, są zapisywane do arkusza jako `do weryfikacji`, zamiast być automatycznie akceptowane albo odrzucone[cite:9].
- **Dziesięć grup priorytetowych w aktualnej instrukcji** — aktualna trasa profilu Andrzej Kot obejmuje dziesięć grup wynajmu kamperów, zaczynając od `Wynajem Kamperów Polska 🚍` i kończąc na `WYNAJMĘ KAMPERA`; w każdej grupie workflow sortuje po nowych postach, jeśli to możliwe[cite:10].
- **Firmy i rekomendacje są wykluczone** — nazwa wypożyczalni, fanpage, witryna lub system rezerwacji, kilka pojazdów, NIP/faktura albo reklamowy ton wykluczają wpis; polecenia cudzej firmy i odpowiedzi firm również nie są zapisywane[cite:11].

## See also

- [[projects/facebook-commenting-operations]] — shared Facebook workflow

## References

[cite:1]: pplx://sessions/30e0956e-1324-4cc0-8988-41d135e492ac
[cite:2]: pplx://sessions/993d2af1-2bf1-4bd2-9cf6-7834088235a7
[cite:3]: pplx://sessions/a52b48d3-03c5-4775-b984-c302c31fbd73
[cite:4]: pplx://sessions/2a0ada4d-7951-4bb1-8d83-d71f25d790ce
[cite:5]: pplx://sessions/872af8ae-44fb-4f4a-8e2a-7d433a19109d
[cite:6]: pplx://sessions/7a85ace8-d401-4645-bc20-2f1dbd7f15a1
[cite:7]: pplx://sessions/882042f5-3500-4d3d-83cd-28d559a2ed05
[cite:8]: pplx://sessions/7a045e3e-c116-4ecd-96d8-37d043b1760e
[cite:9]: pplx://sessions/b429c22d-edce-4631-8665-5442fb5bb011
[cite:10]: pplx://sessions/539ce5c1-18cc-4c25-9e99-27290584dc40
[cite:11]: pplx://sessions/45f72e8b-466b-4606-bfdf-94527a78f40f
