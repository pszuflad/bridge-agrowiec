# Wejście dla TEST.2 od ticketu 149 (TEST.1) · 2026-09-24

## Granica zakresu, którą przyjął TEST.1 — decyzja użytkownika 2026-09-24 („ekran vs. potok")

`docs/instrukcja-pelnego-testu.md` (TEST.1) wziął to, co Ania **widzi i klika na `/staging`**:
- okno **„Rozstrzygnij"** (przy starej karcie w katalogu napis „Sprawdź kartę") — trzy rozłączne
  gałęzie: porównanie starej karty z ofertą, sprawdzenie dopasowania opony, podgląd sprzecznych
  wierszy z jednego pliku;
- okna **blokad akceptacji** — tytuł „Nie zapisano zmian", siedem możliwych komunikatów odmowy;
- filtr i odznaka **„Braki w cenniku"** / **„Brak w cenniku"** (zmiana nazwy, nie zachowania).

TEST.2 ma opisać **mechanizmy, które te decyzje WYTWARZAJĄ** — czyli potok importu:
- blokadę niewiarygodnego cennika,
- wycofania po trzech kompletnych cennikach (i 24 h),
- auto-wstrzymania.

**Czego TEST.2 może już NIE opisywać, bo jest w dokumencie 1:** wygląd i treść okna „Rozstrzygnij"/
„Sprawdź kartę", treść i tytuł okien blokad, nazewnictwo filtra/odznaki „Braki w cenniku". Jeśli
ścieżka krytyczna prowadzi Anię do kliknięcia w te ekrany, wystarczy odesłanie jednym zdaniem do
`docs/instrukcja-pelnego-testu.md`, bez powtarzania treści.

## Ostrzeżenie, które TEST.2 też musi powtórzyć — stare zgłoszenia w poczekalni

Baza stagingu to **kopia produkcji z 23.09**, więc zgłoszenia zastane w poczekalni nie mają
znacznika `_policyVersion` i akceptacja im **odmawia** — to jest poprawne zabezpieczenie, nie
usterka (decyzja D1 w `docs/karty/TEST.1/karta.md`). Jeśli scenariusz ścieżki krytycznej w TEST.2
prowadzi przez akceptację w `/staging`, powtórz to samo zalecenie co TEST.1: najpierw jeden import
(„Synchronizuj" przy dowolnym dostawcy URL), dopiero potem akceptować świeże pozycje.

**Kolejność blokad ma znaczenie — sprawdź kod, nie zgaduj z nazwy.**
`rebuild/backend/src/import/polityka/blokady.ts:34-77`, `sprawdzAkceptacje()`:
- blokada nr 2 (linia 48-53) — `typZmiany === "wycofana"` bez trzech `_absenceEvidence` →
  „Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik.";
- blokada nr 3 (linia 56-59) — brak `_policyVersion` w ogóle → „To zgłoszenie pochodzi ze starego
  importu. Odśwież cennik przed akceptacją.".

Pozycje z odznaką **„Braki w cenniku" trafiają w blokadę nr 2 (trzy potwierdzenia), ZANIM dojdzie
do blokady nr 3 (stary import)** — obie mogą dotyczyć tej samej pozycji, ale blokada nr 2 sprawdza
się wcześniej i to jej komunikat Ania zobaczy pierwszy. Kto pisze TEST.2, musi to sprawdzić w
kodzie, zanim poda Ani jeden komunikat jako jedyny dla tego typu pozycji.

## Ostrzeżenie o czasie masowej akceptacji

Backlog #129.1: „Akceptuj wszystkie" na kilku tysiącach pozycji (zmierzone: kilka tysięcy pozycji
≈ kilkanaście minut w jednym żądaniu) — panel wygląda wtedy na zawieszony, ale nie jest. TEST.1 ma
to ostrzeżenie przy poczekalni; TEST.2 przy imporcie masowym (np. testowaniu przepływu przez pełny
plik dostawcy) też na to trafi — powtórz jedno zdanie, nie odradzaj.

## Fakt środowiskowy — `SELLY_CSV_DIR`

`SELLY_CSV_DIR` na stagingu wskazuje katalog **testowy**, nie produkcyjny
(`tools/deploy-staging.sh:43`) — pułapka opisana w `docs/karty/TEST.1/wejscie-144.md` (test
odświeżania dostępności mógłby po cichu zapisać plik do produkcji) jest po stronie deployu
**zamknięta**. Możesz w TEST.2 kazać Ani wygenerować plik CSV bez tego ryzyka — trafi do katalogu
stagingu, nie produkcji.
