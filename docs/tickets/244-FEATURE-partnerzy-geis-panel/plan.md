# 244 — PARTNERZY: tabele GEIS w panelu (import z Excela, podgląd, edycja)

Decyzja użytkowniczki 2026-10-12: koszt przesyłki wg stawki GEIS (waga) z podglądem i edycją parametrów w panelu.
Zakres: import arkusza Excel (`geis-xlsx.ts`, arkusz na kraj, kolumna „1” = cały kraj; opłaty paliwowej z arkusza NIE importujemy), trasy `GET/PUT /api/partnerzy/geis[/:kraj]` i `POST /api/partnerzy/geis/import` (multer, 5 MB), sekcja „Tabele transportowe GEIS” w widoku Partnerzy (podgląd, edycja współczynnika/pakowania/maks. wymiarów/stawek, import), kalkulator: myto i pakowanie kraju z panelu dochodzą też do ścieżki GEIS.
Dane GEIS NIE trafiają do repo (publiczne) — wgrywa je użytkowniczka z pliku w panelu.
Uwaga o danych: w arkuszu Austria próg 300 kg ma stawkę 1254 (sąsiednie: 250→107, 350→142) — prawdopodobna literówka; do sprawdzenia przez użytkowniczkę.
