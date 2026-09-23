# Specyfikacja synchronizacji Selly od Ani (22.09) — weryfikacja wobec kodu

**Skąd:** Ania przysłała 2026-09-23 dokument „Specyfikacja synchronizacji Selly — nowy Bridge" (stan na 22.09),
zapowiedziany w odpowiedzi na pytanie 1.1 rundy 3. **Oryginał wrzuca do repo Paweł** jako
`docs/selly-spec-od-ani-2026-09-22.md` — ten plik jest wyłącznie weryfikacją: co się zgadza z kodem, co nie,
i czego nadal brakuje.

⚠ **Kod pozostaje źródłem prawdy** (`origin/main`, ostatni striażowany commit — patrz `docs/triage-state.txt`).
Dokument Ani opisuje ZAMIAR i kontekst biznesowy; przy rozbieżności wygrywa kod.

## 1. Co się zgadza z kodem i jest już dowiezione

| Punkt specyfikacji | Stan w odbudowie |
|---|---|
| Model wariantowy: `PUT /api/products/{pid}/variants/{vid}` zamiast bulk (bulk daje 400 dla wariantów) | ✅ I15.6 (`sync-delta.ts`) |
| Klucz `(kod_importu, dostawca)` → `(selly_product_id, selly_variant_id, feature_id_magazyn)`, stara tabela jako `selly_products_old` | ✅ I15.6, migracja `013` |
| Startowe `feature_id` magazynów (MO2=5, MO3=4, MO4=3, MO5=2, MO9=1, reszta z discovery) | ✅ I15.6 (`discovery.ts`) |
| Discovery 7 kroków, `buildProductCodeCache`, `findProductByCode/ProviderCode`, retry po 400 „istnieje produkt" | ✅ I15.6 |
| `attributes: []` wymagane przy `createVariant` | ✅ I15.6 |
| Limiter 250/60 s + retry na 429 z `Retry-After` | ✅ I15.6 (`limiter.ts`) |
| Tor 1: kandydaci (aktywne + wstrzymane z wariantem), PUT wariantu, snapshot, log | ✅ I15.6 |
| Tor 2: trzy ścieżki A/B/C, 21 cech, `provider_code` = `kod_importu`, bez `content_html`, bez VAT, bez wymiarów, `category_id` tylko przypisanie | ✅ I15.7 (`mapper-v2.ts`, `sync-full.ts`) |
| Blokada grup wielokategorii w Torze 2 (#81) | ✅ I15.7 |
| Zabezpieczenia spoza produkcji: `SELLY_TRYB`, osobne ścieżki CSV stagingu, atrapa w testach | ✅ I8 + I15.6/I15.7 |

## 2. Rozbieżności specyfikacja ↔ kod (wygrywa kod)

1. **Min interval limitera: 150 ms w specyfikacji, `Math.ceil(60000/250)` = ~240 ms w kodzie produkcji**
   (`selly/rate_limiter.cjs:12`, komentarz „v2 po korekcie z 400 na 250"). Nasz port ma 240 ms — zgodnie z kodem.
2. **CSV a produkty wstrzymane — dwa sprzeczne punkty w jednym dokumencie:** pkt 4 „eksportuje wstrzymane
   ze stanem 0" (stan z 14.09) i pkt 5 „wyklucza auto-wstrzymane" (22.09). **Stan końcowy: CSV zawiera TYLKO
   aktywne**, zapis atomowy (`generate_selly_export.cjs` na `abe5f14`). Zakres karty I15.3.
3. **`mapCategoryId(kategoria, zastosowanie, …)` z parą kategoria+zastosowanie** żyje w `selly/mapper.cjs`
   (warstwa 1, eksport CSV / `sync-product`), a NIE w Torze 2. `mapper_v2.cjs` nie ma tej funkcji —
   Tor 2 bierze `category_id` z `catMap` (kategoria główna, `selly_kategoria_norm_map`). Nasz port to odwzorowuje.
4. **Rotacja Toru 2, środa:** specyfikacja „MO5", kod `FULL_ROTATION` „MO5 + MO6". Kod wygrywa (I15.8).
5. **Dokument jest stanem na 22.09** — nie obejmuje zmian z 23.09 (backlog #105–#107: DOT/EAN `W2`, decyzje
   o nieobecnych kartach, wydajność). Dla Selly istotne pośrednio (dostępność → delta).

## 3. Fakty, których wcześniej NIE mieliśmy

1. **⭐ Plik CSV dla Selly jest chroniony `.htaccess` z białą listą IP** —
   `mirror/frontend/ex-port-files/.htaccess` (`origin/main`): `Require ip 212.91.27.191 46.170.251.129`
   (Selly/integrator + Agrowiec). **Ani `docs/cutover.md`, ani `docs/deploy-setup.md` o tym nie wspominały.**
   Przy cutoverze podmieniamy zawartość `public_html/panel` — bez zachowania tego pliku **Selly straci dostęp
   do CSV** (403), a plik może w ogóle zniknąć. Dopisane do `cutover.md` tym ticketem.
2. **Kolizje `kod_importu`** — 121 zduplikowanych kluczy `(dostawca, kod_importu)` = 259 aktywnych wierszy,
   114 grup z różnymi cenami/stanami. Skutek: wspólny wpis `selly_products` → nadpisywany snapshot → **delty
   wracają co 15 minut w pętli**. Ania nazywa to blokadą krytyczną i wskazuje `assignKodImportu`. Nowy wpis
   backlogu **#108** (do zmierzenia na świeżej kopii produkcji — Staging v2 nadpisał `assignKodImportu`,
   więc problem mógł zniknąć).
3. **Osierocony wpis `selly_sync_log`** (id 2725, `w_trakcie` od 10.09) — scheduler nie zamyka przerwanych
   cykli przy starcie. Znany problem produkcji → decyzja dla I15.8 (odtworzyć 1:1 czy naprawić).
4. **`ostatnia_sync` nie jest aktualizowana w ścieżce A** Toru 2 — to zamierzone (kolumna znakuje świeżo
   znalezione mapowania, nie audytuje aktualizacji). Nasz port ma to samo; warto wiedzieć przy diagnozie.
5. **Skala wariantów:** ~19% katalogu Selly ma więcej niż jeden wariant (874 grupy w Bridge), największa
   grupa to 5 wariantów. Liczba przydatna przy testach wydajności Toru 2.
6. **`PUT` nie usuwa historycznej cechy** — pominięcie pola albo `values: []` nie kasuje wartości w Selly;
   część pustych cech (głównie „Śnieg") może wymagać osobnej migracji **po stronie sklepu**. To robota Ani
   w Selly, nie nasza w Bridge — odnotowane, żeby nie szukać tego w kodzie.
7. **Nowe nazwy kategorii w CSV** („Opony rolnicze", „Opony leśne", „Opony przemysłowe", „Opony ciężarowe")
   oraz nagłówek `R/D` — potwierdzone w `generate_selly_export.cjs`. Zakres karty I15.3 (backlog #76).

## 4. Czego nadal brakuje — pytania do Ani

1. **Czy kolizje `kod_importu` są już rozwiązane?** Staging v2 (22.09) nadpisał `ext.assignKodImportu` własną
   regułą (grupa tylko przy zgodności marka/model/rozmiar + indeksy/DOT). Jeśli nie — to blokada dla Toru 1
   i trzeba ją rozstrzygnąć przed cutoverem (backlog #108).
2. **Puste „blokowane formy płatności"** — czy chodziło o kartę produktu **w Selly**? W bazie Bridge zmierzone
   23.09: zero pustych (backlog #101).
3. **`.htaccess` na katalogu CSV** — czy lista IP jest aktualna (212.91.27.191, 46.170.251.129) i czy po
   cutoverze ma zostać bez zmian?
4. **Stary `sync-supplier` (warstwa 1)** — po zmianie schematu nie działa i nikt go nie używa. Zostawiamy
   zepsuty 1:1 czy wyłączamy w nowym Bridge?
5. **Osierocone wpisy `w_trakcie` w logu synchronizacji** — naprawiamy przy starcie czy zostawiamy 1:1?

## 5. Wniosek

Dokument **nie zmienia zakresu kart I15.6 i I15.7** (obie zmergowane, zgodne z kodem) i **potwierdza zakres
I15.3, I15.8 i I15.10**. Realna wartość: trzy fakty operacyjne (`.htaccess`, kolizje `kod_importu`, osierocony
log) oraz kontekst decyzji, którego w kodzie nie widać — dlaczego model wariantowy, dlaczego bez `content_html`
i VAT, dlaczego lazy discovery zamiast masowego pobrania.
