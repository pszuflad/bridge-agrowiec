# Wejście dla P10.4 od ticketu 98 (P10.3) · 2026-09-22

**Fakt.** Karta P10.3 (ticket 98) przepisała wszystkie 10 przycisków „CSV” w `/analityka`: plik
CSV powstaje teraz w PRZEGLĄDARCE z wierszy i kolumn, które tabela karty ma po filtrach —
globalnych (pasek sześciu filtrów) i lokalnych (np. „Bez ruchu dni” w Rotacji) — bez limitu 300
(limit dotyczy tylko rysowania tabeli). Marża: plik = przekrój tabeli (grupy dostawca/kategoria/
marka), nie lista per produkt. Żaden przycisk nie woła już `GET /api/analytics/export/{view}` —
trasa zostaje w backendzie i kontrakcie bez zmian, ale bez konsumenta we froncie. Dowód:
`docs/tickets/98-FEATURE-eksport-csv-z-tabeli/raport.md`, `rebuild/frontend/src/pages/analityka/csv.ts`,
`eksport.tsx`.

Format pliku (decyzje użytkownika 2026-09-22, `docs/karty/P10.3/karta.md` „Decyzje”):
- nagłówek = etykiety kolumn tabeli (np. „Śr. marża”), nie klucze pól, w kolejności tabeli;
- liczby dziesiętne z przecinkiem, bez separatora tysięcy (`12,5`, `1234,567`) — odstępstwo od
  formatu serwera (tam kropka);
- do komórki idzie surowa wartość pola `key`, nie tekst z ekranu — Dostępność to `87,5` bez `%`;
  brak wartości → pusta komórka, nie „—”;
- EAN-y i kody zostają zwykłym tekstem;
- reszta jak wcześniej: BOM, `;`, `\n`, cudzysłowy przy `;`/`"`/`\n`/`\r`, nazwa `<view>.csv`;
- pusta tabela po filtrach → plik z samym nagłówkiem (przycisk aktywny); przycisk nieaktywny
  tylko podczas wczytywania karty.

**Co to obala w `docs/instrukcja-testow-I10.md`.** Cały punkt „eksport ≠ tabela” przestaje być
prawdą — dokładnie odwrotnie, plik teraz JEST tabelą po filtrach:
- `:42` — punkt 4 sedna: „**Eksport CSV to NIE jest to samo, co widać w tabeli** — i tak ma być.
  Szczegóły niżej.”;
- `:335-350` — cała sekcja **6.4** „⭐ Plik CSV NIE zawiera tego, co widzisz w tabeli” (nagłówek +
  wstęp + trzy punkty: „Eksport nie zna Twoich filtrów”, „CSV z karty „Marża” ma inne kolumny niż
  tabela”, „CSV z karty „Rotacja” ignoruje pole „Bez ruchu dni”” + zdanie o karcie 1.1);
- `:383` — w sekcji 6.9: „Zawęź filtry albo pobierz CSV — **eksport nie ma limitu 300** (ma
  własne, znacznie wyższe)” — zdanie o „własnym, wyższym limicie” sugeruje serwerowy limit
  (dawniej 5000/bez limitu, ale zawsze CAŁY katalog); dziś eksport nie ma ŻADNEGO limitu, bo to
  te same wiersze co tabela po filtrach (może ich być mniej niż 300, jeśli filtr zawęził tabelę);
- `:454` — punkt w sekcji 8 „Czego jeszcze NIE MA — świadomie”: „**Trybu „zapisz to, co widzę” w
  eksporcie** — patrz sekcja 6.4” — to jest teraz dokładnie to, co jest, nie czego brakuje.

**Co P10.4 ma z tym zrobić** (format „Zgłosiłaś → Jest teraz → Sprawdź”, zgłoszenie Ani leżące
u źródła #91: „można dorobić filtry [do eksportu]”):
- Zgłosiłaś: eksport CSV nie respektuje Twoich filtrów i pokazuje inne dane/kolumny niż tabela.
- Jest teraz: plik CSV = dokładnie to, co widać w tabeli karty po Twoich filtrach (globalnych i
  lokalnych), bez limitu 300 wierszy.
- Sprawdź:
  - zaznacz dostawcę w pasku filtrów, kliknij CSV przy dowolnej karcie, która filtr stosuje →
    plik ma tylko wiersze tego dostawcy (nie wszystkich);
  - karta **Marża**: kliknij CSV → plik ma te same grupy (dostawca/kategoria/marka) i te same
    kolumny, co tabela — nie listę produktów;
  - karta **Rotacja**: ustaw „Bez ruchu dni” na inną wartość, kliknij CSV → plik się zmienia
    razem z tabelą, nie pokazuje całego aktywnego katalogu;
  - zawęź filtry tak, żeby tabela pokazała mniej niż wszystkie wiersze (stopka „Pokazano 300 z
    N…” znika albo liczba N się zmniejsza) → plik ma dokładnie tyle wierszy, ile tabela POWINNA
    mieć po filtrach (nawet gdy to więcej niż 300 — tabela tnie na 300, plik nie);
  - otwórz plik w Excelu: nagłówki kolumn brzmią jak nagłówki tabeli (nie angielskie/techniczne
    nazwy pól), liczby z przecinkiem otwierają się jako liczby (nie tekst), puste komórki zamiast
    „—”, **Dostępność jako liczba bez znaku %**.
