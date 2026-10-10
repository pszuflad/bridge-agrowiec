# 233-CHORE-partnerzy-utwardzenie-zamowien — Code review

> Reviewed: 2026-10-10
> Branch: claude/peaceful-gates-a8yebr
> Diff: 13 plików kodu/testów + 5 plików docs (bez merge'a `origin/main`), 1 commit ticketu (337550b)

Sprawdzone lokalnie (pojedyncze pliki, Node 22.22): backend `partnerzy.{dekoduj-xml,poczta-imap,odbior-email,zamowienia-trasy}` 47/47 zielone; frontend `partnerzy.zamowienia.test.tsx` 19/19 zielone. Pełne bramki nie były uruchamiane (biegną osobno).

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `docs/karty/PARTNERZY/podzial-na-tickety.md` — plik NIE jest w diffie, a plan.md (pkt 7), raport.md (Changes) i wpis-233 deklarują jego odświeżenie („mapowanie PRT → numery ticketów 226–233”).
  - Reason: mapowanie na linii 5 kończy się na PRT-9.2+9.3 = 227; tickety 228–233 (PRT-7.x: odbiór e-mail, panel, walidacja, utwardzenie) nie mają przypisania. Raport mówi o zmianie, której nie ma; pozycja planu niewykonana.
  - Suggestion: dopisać mapowanie PRT-7.x → 229–233 (ew. 228) albo usunąć obietnicę z plan.md/raport.md.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:119` — `onError` mutacji „Sprawdź ponownie” tylko pokazuje toast; po nowym 409 (zamówienie przeszło w późniejszy status w innej sesji/oknie) lista i szczegóły nie są odświeżane, więc przycisk (`mozeWalidowac` w cache) zostaje i każde kliknięcie daje kolejne 409.
  - Reason: wprowadzenie 409 bez obsługi po stronie panelu; `mozeWalidowac` z backendu jest tylko tak świeże, jak cache React Query.
  - Suggestion: w `onError` wywołać to samo `invalidateQueries` co w `onSuccess`; dodać test (waliduj → 409 → ponowny fetch szczegółów).
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:58` — `title` na wyłączonym `Button`: komponent ma `disabled:pointer-events-none` (`components/ui/button.tsx:12`), więc dymek `title` nie pojawi się na hoverze (ani na dotyku). Test sprawdza tylko atrybut, nie efekt.
  - Reason: element zmiany „a11y/podpowiedź” faktycznie nie działa dla myszy; tekst jest co prawda powtórzony w `<p data-testid="text-zamowienia-kanal">` poniżej, więc użytkownik nie traci informacji.
  - Suggestion: opakować przycisk w `<span title=…>` (span przyjmie hover) albo uznać akapit za jedyną podpowiedź i usunąć `title`.
- [ ] `rebuild/backend/src/partnerzy/dekoduj-xml.ts:23` — UTF-16 BEZ BOM z deklaracją (`<\0?\0x\0m\0l…`) nie jest wykrywany: regex działa na widoku latin1 bajtów, więc deklaracja nie pasuje, wybierane jest UTF-8, `fatal` nie rzuca (NUL-e są poprawnym UTF-8) i do parsera idzie tekst z NUL-ami → niejasny błąd parsera zamiast „kodowanie UTF-16 bez BOM”. Brak testu dla tego przypadku (a plan 233 zapowiada „BOM UTF-8/UTF-16” — BOM jest, wariant bez BOM nie).
  - Reason: luka w deklarowanym utwardzeniu kodowania; skutek to tylko mylący komunikat (zamówienie i tak nie jest zapisane), więc nie BLOCKER.
  - Suggestion: wykryć wzorzec `3C 00 3F 00` / `00 3C 00 3F` → utf-16le/be, albo jawnie odrzucić plik z NUL-ami czytelnym komunikatem; dopisać test.
- [ ] `rebuild/backend/test/partnerzy.dekoduj-xml.test.ts` / `partnerzy.odbior-email.test.ts` — `czyXml` jest eksportowane, ale nie ma jego bezpośrednich testów tabelarycznych (tylko pośredni xlsx i `text/xml` bez rozszerzenia). Regex ma nieoczywiste przypadki (`application/xml; charset=…`, `…+xml`, `image/svg+xml`, wielkość liter, `application/octet-stream` z `.XML`).
  - Reason: nowa nietrywialna logika bez testu na granicach; raport.md w „Test results” nie podaje wyników (tylko „zob. PR”), DoD w plan.md niezaznaczone.
  - Suggestion: kilka asercji tabelarycznych + uzupełnić „Test results” po zielonych bramkach.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/partnerzy/dekoduj-xml.ts:23-24` — kodowanie z nagłówka MIME (`Content-Type: …; charset=iso-8859-2`) jest ignorowane; plik bez deklaracji `encoding` idzie jako UTF-8 (`fatal` da przynajmniej czytelny błąd). Rozważyć użycie `charset` z `ZalacznikPoczty.typ` jako fallbacku przed UTF-8.
- [ ] `rebuild/backend/src/partnerzy/dekoduj-xml.ts:30-32` — `new TextDecoder(etykieta)` rzuca także, gdy Node zbudowano bez pełnego ICU (wtedy `windows-1250`/`iso-8859-2` nie działają); komunikat „Nieobsługiwane kodowanie” byłby wtedy mylący. Zweryfikowano: w Node 22.22 (ICU 77.1, full) `windows-1250`, `iso-8859-2`, aliasy `latin2`/`cp1250`, `utf-16le/be` działają; `utf-7`, `replacement`, `x-user-defined` → czytelny błąd. Produkcja ma `engines >=20` — wystarczy jedno zdanie w `wpis-233.md`, że wymagana jest standardowa kompilacja Node (full-icu).
- [ ] `rebuild/backend/src/partnerzy/dekoduj-xml.ts` — deklaracja jest tylko wektorem wyboru dekodera, nie wykonywaniem czegokolwiek: etykieta przechodzi whitelistę znaków `[A-Za-z0-9._:-]` i regex działa na 200 bajtach (brak ReDoS), a nieznane etykiety kończą błędem; dalej DOCTYPE/ENTITY nadal odrzuca `zamowienie-xml.ts:89`. Brak uwag bezpieczeństwa. Drobiazg: etykiety egzotyczne (np. `iso-2022-jp`, `gb18030`) są akceptowane — nieszkodliwe, ale można zawęzić do UTF-8/UTF-16/ISO-8859-2/windows-1250/ISO-8859-1.
- [ ] `rebuild/backend/src/partnerzy/dekoduj-xml.ts` — konflikt BOM vs deklaracja (np. BOM UTF-8 + `encoding="ISO-8859-2"`, deklaracja `UTF-16` w pliku UTF-8) rozstrzygany po cichu na rzecz BOM / deklaracji; deklaracja `UTF-16` w pliku 8-bitowym daje śmieci zamiast błędu kodowania (potem i tak pada parser). Warto jednym testem utrwalić zachowanie. Zachowanie pozytywne: `fatal` zamienia dawny cichy U+FFFD w błąd pliku — to zmiana dla uszkodzonego UTF-8, opisana w wpis-233 tylko pośrednio.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:83,126` — `aria-controls` wskazuje na id, które istnieje dopiero po załadowaniu szczegółów (przy „Ładowanie…”/błędzie i w stanie zwiniętym elementu nie ma). Dopuszczalne wzorcem disclosure, ale wygodniej dać id na kontenerze renderowanym od razu po rozwinięciu.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:143-158` — nowy `<div className="overflow-x-auto">` nie ma wcięcia w JSX (tabela w środku wcięta jak wcześniej); kosmetyka formatera.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:18` — `przytnij` tnie po jednostkach UTF-16 (może rozciąć parę zastępczą); przy polskich znakach bez wpływu.
- [ ] `docs/karty/PARTNERZY/karta.md` — nagłówek „Stan” mówi „na `main`”, a niżej tabela nadal brzmi „wszystko na `develop`, PR-y #323–#342; nic nie jest jeszcze…” — dwa różne stany w jednym pliku; po merge'u ticketu warto ujednolicić.

## Plan compliance

### Done ✓
- Pkt 1 `czyXml`: zawężony regex MIME + `.xml` (regex `^(text|application)\/([\w.-]+\+)?xml\s*(;|$)` poprawnie odrzuca `vnd.openxmlformats-…`, przyjmuje `application/xml; charset=…` i `…+xml`; false-negative tylko dla egzotycznych `application/x-xml` oraz `octet-stream` bez rozszerzenia — akceptowalne).
- Pkt 2 `dekodujXml`: BOM → deklaracja (200 B) → UTF-8, `fatal`, czytelne `BladZamowienia`; BOM jest zdejmowany przez TextDecoder, parser nadal działa na czystym tekście. Test integracyjny ISO-8859-2 z „ł” w odbiorze e-mail.
- Pkt 3 IMAP: `doSTARTTLS: true` dla portu ≠ 993 przy `secure:false` — zweryfikowano w `node_modules/imapflow/dist/cjs/imap-flow.js:1327-1350` (imapflow 2.0.6): `_failSTARTTLS` rzuca „Server does not support STARTTLS” przy `doSTARTTLS === true`; kombinacja `secure:true` + `doSTARTTLS:true` rzuca „Misconfiguration”, dlatego warunkowe rozszerzenie opcji dla 993 jest poprawne. Test sprawdza opcje przez mock (bez realnego serwera — uczciwie opisane jako nieprzetestowane).
- Pkt 4 token zamka (`Symbol` + `od`): logika zwalniania i przeterminowania bez regresji; testy zamka przechodzą.
- Pkt 5: 409 w trasie `waliduj` + `mozeWalidowac` z jednego źródła (`czyPodlegaWalidacji`); kolejność 404 → 409 poprawna; wyścig sprawdzenie/akcja nieszkodliwy (`zwaliduj` w transakcji ponownie sprawdza status). Brak cyklu importów (`partnerzy-zamowienia` → `walidacja-zamowienia` nie importuje repo).
- Pkt 6 (z zastrzeżeniami): `aria-controls`, `overflow-x-auto`, `scope="col"`, przycięcie toastu, pusty stan z informacją o kanale.
- Pkt 7 częściowo: `wpis-233.md`, `karta.md`, `instrukcja-testow-PARTNERZY.md` zgodne z kodem (opisy STARTTLS, kodowania, 409, `mozeWalidowac` odpowiadają implementacji).

### Missing or deviating ✗
- `podzial-na-tickety.md` — brak zmiany mimo deklaracji w planie/raporcie/wpis-233 (patrz SHOULD-FIX).
- `raport.md` — „Test results” bez wyników („zob. PR”); „Deviations: Brak” nie uwzględnia tego pominięcia.

### Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop` — niezaznaczone w plan.md; pojedyncze pliki testowe zielone (47 + 19), pełne bramki poza zakresem tego przeglądu.
- [x] Zakres kodu z pkt 1–6 planu zaimplementowany; kontrakt/fixtures bez zmian (trasy poza `openapi.yaml`, zgodnie z planem — nowe pole `mozeWalidowac` i kod 409 w nowym module).

## Parallel-test concerns

None — all tests parallelizable (mock `imapflow`, baza tymczasowa z `stworzSrodowiskoTestowe`, zamki odbioru resetowane `_zresetujZamkiOdbioru`).

## Overall assessment

Zmiany są małe, trafne i dobrze przetestowane; kierunek poprawny, a weryfikacja `doSTARTTLS` w imapflow 2.0.6 i działania `windows-1250`/`iso-8859-2` w Node 22 wypadła pozytywnie. Główne uwagi: niewykonana pozycja dokumentacyjna (`podzial-na-tickety.md`), panel nie odświeża się po nowym 409, `title` na wyłączonym przycisku nie działa na hoverze oraz luka UTF-16 bez BOM. Brak blockerów.
