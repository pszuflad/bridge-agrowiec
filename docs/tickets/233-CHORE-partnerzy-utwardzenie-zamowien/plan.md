# 233 — utwardzenie obsługi zamówień partnerów po review 229–232

> Status: Approved (użytkownik 2026-10-10: „rób kolejny ticket bez Marty”, pracujemy autonomicznie) · Gałąź: `claude/peaceful-gates-a8yebr`

Karta: `docs/karty/PARTNERZY/` · poziom 7. Nie dodaje funkcji i nie czeka na żadną decyzję: zbiera i wdraża sensowne pozycje NICE-TO-HAVE z review ticketów 229–232 (zapisane w ich `review.md`)
oraz synchronizuje dokumentację karty. Każda pozycja poniżej to realny błąd lub ryzyko, nie kosmetyka.

## Zakres
**Poprawność odbioru (backend)**
1. `czyXml` łapał każdy typ MIME zawierający „xml”, w tym `application/vnd.openxmlformats-…` (pliki `.xlsx`/`.docx`) → błędny „XML” w error_log. Zawężenie do `text/xml`, `application/xml`, `+xml` (bez `vnd.openxmlformats`) lub rozszerzenia `.xml`.
2. Kodowanie załącznika: `toString("utf-8")` ignorował deklarowane `encoding="ISO-8859-2"` / `windows-1250` (polskie litery od partnera!) i BOM UTF-16. Nowy `dekodujXml(Buffer)`: BOM → deklaracja `encoding` → UTF-8; nieznane kodowanie = czytelny błąd pliku, nie zniekształcony tekst.
3. IMAP: `secure: port === 993` zostawiał oportunistyczny STARTTLS na innych portach — serwer bez STARTTLS = hasło jawnie. Dla portów innych niż 993 wymuszamy `doSTARTTLS: true`.
4. Zamek odbioru identyfikowany tokenem (`Symbol`), nie `Date.now()` (dwa przejęcia w tej samej milisekundzie).

**Walidacja i panel**
5. `POST …/waliduj` dla zamówienia w późniejszym statusie: dziś 200 z `bledy:0` (mylące); teraz 409 z komunikatem. Szczegóły zamówienia dostają pole `mozeWalidowac` z backendu — front przestaje powielać listę statusów.
6. Panel: `title` na wyłączonym przycisku „Odbierz teraz”; `aria-controls` przy rozwijaniu, `overflow-x-auto` wokół tabeli pozycji, `scope="col"`; przycięcie długiego opisu błędu w toaście; pusty stan listy mówi, czy kanał e-mail jest włączony.

**Dokumentacja**
7. `karta.md` (Stan, Dowiezione) i `podzial-na-tickety.md` (mapowanie PRT → numery ticketów 226–233) odświeżone do stanu faktycznego; `wpis-233.md`.

## Decyzje (samodzielnie)
- Nic z tego nie zmienia kontraktu ani zachowania dla poprawnych plików UTF-8; zmiany dotyczą przypadków brzegowych (inne kodowanie, nie-XML w załączniku, wspólny port).
- `doSTARTTLS: true` może odrzucić skrzynkę, która dziś działałaby bez szyfrowania na porcie ≠ 993 — to zamierzone (hasło nie może iść jawnie); opisane w `wpis-233.md` i w instrukcji testów.

## Kontrakt i fixtures
Brak (trasy poza `openapi.yaml`; zmiana kodu odpowiedzi 409 i nowego pola `mozeWalidowac` dotyczy nowego modułu).

## Testy
Backend: dekodowanie (UTF-8, BOM UTF-8/UTF-16, ISO-8859-2, windows-1250, nieznane), `czyXml` (xlsx/docx odrzucone), 409 dla późniejszego statusu, token zamka, konfiguracja IMAP (STARTTLS). Frontend: `title`, brak duplikatu statusów, pusty stan, przycięty toast.

## Poza zakresem
Cena/tolerancja, numer katalogowy, FTP, Selly.

## Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop`
