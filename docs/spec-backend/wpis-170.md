# Wpis 170 — importer: karta założona przez system dla tego wiersza to dopasowanie, nie pytanie

> Ticket 170 (2026-10-01). **Odstępstwo od produkcji — decyzja użytkowniczki.** Dotyczy
> `import/polityka/fabryka.ts` (krok 7 „zgodne cechy pod innym kodem") i
> `tolerancja-dopasowania.ts::kartaWlasnejPartii`.

**Objaw.** Opona Linglong 26.5R25 LXL MASTER (`LLPR250M65002LXL0`) wracała do stagingu jako „Podobna
opona jest już w katalogu, ale ma inny kod lub EAN", z kandydatem „DOT 2025, EAN …0210 (inny EAN)”,
choć dokładnie ta pozycja była wcześniej zaakceptowana. Sztuczne EAN-y (999…) tylko się przy tym
wyświetlały — nie były przyczyną.

**Przyczyna (odtworzona na prawdziwym pliku MO5 i kodzie importera).**
1. Kod z pliku zajmuje karta DOT 2025, a wiersz ma DOT 2026 → importer słusznie robi z niego OSOBNĄ
   partię z kodem zastępczym `MO5_AUTO_…`. To działa jak w produkcji i pierwszy import kończy się
   zwykłą pozycją `nowa`.
2. Po akceptacji istnieje karta `MO5_AUTO_…` (DOT 2026). Przy KOLEJNYM imporcie ten sam wiersz nie
   rozpoznaje własnej karty: zapamiętane dopasowanie powstaje tylko przy rozstrzygnięciu ręcznym
   (`_resolution`), a kod dostawcy jest współdzielony z kartą DOT 2025 (więc niejednoznaczny). Krok 7
   znajduje kartę o zgodnych cechach i pyta; końcowy blok dodatkowo podmienia kandydata na kartę
   z kodem z pliku (inna partia).

**Co jest.** Gdy zgodna po cechach jest JEDNA karta, ma kod `…_AUTO_…` i ten sam kod dostawcy co
wiersz, importer ją dopasowuje (bez pytania). EAN nie przeszkadza, jeśli wiersz go nie ma, jest taki
sam albo karta ma wygenerowany EAN (para w `ean_pary`) — prawdziwy EAN z cennika go zastąpi.
INNY prawdziwy EAN na karcie albo inny kod dostawcy → pytanie zostaje.

**Nie ruszone.** Zapamiętywanie dopasowania przy akceptacji zwykłej pozycji `nowa` (osobna decyzja —
szersza zmiana). Zgłoszenia już leżące w stagingu znikną po ponownym wczytaniu cennika.
