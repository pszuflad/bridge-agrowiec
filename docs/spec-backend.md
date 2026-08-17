# Specyfikacja backendu Bridge — ZWERYFIKOWANA

Werdykt weryfikacji dokumentacji, którą Perplexity wygenerowało dla backendu
(`docs/incoming/backend-perplexity/backend_doc/`), skonfrontowanej niezależnie
z naszym kodem (`deminified/backend-index.cjs`, `mirror/backend/*.cjs`,
`db/schema.sql`, `db/snapshot.db` — ten sam rdzeń, MD5 `b745bf95…`).

> **Werdykt: dokumentacja Perplexity jest RZETELNA i przyjęta jako referencja.**
> W przeciwieństwie do dokumentacji frontendu (która miała zmyślone endpointy),
> ta cytuje `plik:linia` przy każdej tezie, oznacza `NIEZNANE`, nie ujawnia
> sekretów i **sama raportuje rozbieżności z moim audytem**. Spot-checki na naszym
> kodzie potwierdziły kluczowe twierdzenia. Szczegóły są w 7 plikach źródłowych;
> ten dokument to warstwa weryfikacji + korekty do propagacji.

**Kanoniczna referencja (przyjęta):**
`docs/incoming/backend-perplexity/backend_doc/` — `00_PODSUMOWANIE`, `01_ENDPOINTY`,
`02_SCHEMAT_BAZY`, `03_IMPORT_tk`, `04_WARSTWA_DANYCH`, `05_PARSERY_MODULY`,
`06_KONFIGURACJA`, `schema.sql`.

---

## 1. Rozbieżności z moim audytem — 3 KOREKTY

Weryfikacja zmusza mnie do poprawienia trzech rzeczy z `audit-2026-07-22.md`
i `audit-delta.md`:

| Pozycja | Mój audyt | Stan faktyczny (zweryfikowany) |
|---|---|---|
| **Selly routes** | „niepodpięte, `selly/routes.cjs` nigdy niewywoływane" | ❌ **BŁĄD** — są rejestrowane warunkowo: `extensions.cjs:395-396` `registerSellyRoutes(app, {db, requireAuth: we})`. Potwierdzone w naszym `mirror/`. |
| **PM2** | „nie działa / nie ma w PATH" | ❌ nieaktualne — proces `bridge-backend` online (fork, PID 1385800), demon 5.4.2. Binarka po prostu nie jest w interaktywnym PATH. |
| **Duplikat tras `/api/atrybuty` w rdzeniu** | „istnieją równolegle w rdzeniu i module" | ❌ nieaktualne — 6 tras usunięto z rdzenia (06.08); Atrybuty rejestruje wyłącznie Extensions. |

## 2. ⚠ ELEWOWANE ustalenie: auth jest CZĘŚCIOWY (bezpieczeństwo)

Moja delta pisała „auth naprawione" — **za optymistycznie**. Naprawa z 06.08 objęła
tylko katalog (`/api/products`, `/api/dostawcy`, `/api/suppliers`, `/api/users`).
Weryfikacja na naszym `deminified`: **32 z 49 tras rdzenia ma `we`, 17 nie ma.**

**Publiczne (bez logowania) endpointy danych — do naprawy:**
```
GET  /api/history            GET  /api/history/meta      GET  /api/history/paged
GET  /api/audit-log          GET  /api/config            GET  /api/overrides
GET  /api/staging            GET  /api/markups           GET  /api/promotions
GET  /api/alerts             GET  /api/spedycja
GET  /api/export/shoper      GET  /api/export-shoper     ← pełny katalog CSV bez auth!
POST /api/waga-gabarytowa/oblicz
```
Najgroźniejsze: **`/api/export/shoper`** (każdy pobierze cały katalog),
**`/api/audit-log`** i **`/api/history`** (log działań i zmian), **`/api/config`**.

Dodatkowo subtelność z podwójnej rejestracji: `/api/history/meta` i
`/api/history/paged` są **publiczne**, bo żywy handler to ten z rdzenia (bez `we`),
przesłaniający wersję modułową (która auth by miała). Kolejność rejestracji ma
skutek bezpieczeństwa.

## 3. Potwierdzone z lipca (Perplexity niezależnie zgadza się ze mną)

- **CORS odbija dowolny `Origin` + `Allow-Credentials: true`** — ryzyko CSRF (`be.cjs:48926`).
- **≥4 niezależne uchwyty `better-sqlite3`** do jednej bazy (rdzeń `Qi`, Extensions
  `_bridgeDb`, Atrybuty, Pending); WAL, więc działa, ale wielu writerów = ryzyko blokad.
- **Handler błędów przed modułami** — nie łapie błędów tras modułowych; moduły ratują
  się lokalnym `try/catch`.
- **Podwójna rejestracja** analytics (×2) i pagination — druga warstwa martwa.
- **`JWT_SECRET` z zahardkodowanym fallbackiem** (Perplexity nie cytuje wartości — słusznie).
- **Dryf schematu** potwierdzony: tabele `atrybuty_wartosci_pending`,
  `atrybuty_wartosci_odrzucone`, `selly_kategoria_norm_map`,
  `selly_zastosowanie_category_map`; kolumny `products.kod_importu`, `products.zastosowanie`.

## 4. Kontrakt — liczby (zweryfikowane)

| Element | Wartość | Weryfikacja |
|---|---|---|
| Endpointy rdzenia | **49** rejestracji | zgodne z naszym `deminified` |
| Endpointy modułowe | 66 def. (64 żywe po deduplikacji) | Atrybuty 11, Analytics 27, Pending, Paginacja 4, Selly |
| Unikalne pary metoda+ścieżka | ~113 | 49 + 66 − 2 przesłonięte |
| Metody `U.*` | **50 zdefiniowanych** / 47 używanych | Perplexity liczy definicje (`04_WARSTWA_DANYCH`), ja użycia — obie liczby poprawne |
| Tabele | 27 (z `sqlite_sequence`) / 26 użytkowych | bez zmian od lipca |
| `products` | 72 kolumny, 7 405 wierszy | +`nieobecnosc_pod_rzad` vs lipiec |
| Uchwyty SQLite | ≥4 | patrz §3 |

## 5. Silnik importu `tk()` — najcenniejszy zasób

`03_IMPORT_tk.md` zawiera **realny diagram decyzyjny** wyprowadzony z kodu (z cytatami
linii) — to bezpośrednie wejście do odbudowy (Faza 4, kierunek A). Kluczowe reguły
potwierdzone:
- dopasowanie po kodzie → po EAN → kod zastępczy `Lq()` tylko dla opony;
- `Gq()` = `manual_overrides`: przy konflikcie **zachowuje wartość Marty**, zapisuje do `snapshotJson`;
- `Zc()` = klasyfikator „czy opona";
- auto-zatwierdzenie **tylko** zmian cena/marża/stan/magazyn → wpis do `historia_cen`;
- wycofanie po **3 kolejnych** nieobecnościach (`WYCOFANIE_PROG_IMPORTOW=3` ↔ kolumna `nieobecnosc_pod_rzad`);
- EAN auto-zmieniany tylko dla długości 8/12/13/14 i nie kończący się pięcioma zerami;
- `kod_importu` nadaje `bridge_ext.assignKodImportu` (nie sama `tk`), grupując po EAN
  lub marka+rozmiar+bieznik+nazwa.

`04_WARSTWA_DANYCH.md` daje **50 metod `U.*` z dokładnymi wyrażeniami Drizzle** i mapą
zmangowanych zmiennych (`he`=products, `He`=staging, `Bt`=markups, `hn`=promotions,
`Yt`=overrides, `Ki`=alerts, `Wa`=history, `Ot`=suppliers, `dt`=users, `Za`=audit_log,
`gn`=spedycja, `Jt`=config) — zgodna z moją lipcową rekonstrukcją.

## 6. Korekty do propagacji

Do naniesienia w pozostałych dokumentach przy okazji:
- `audit-delta.md`: **Selly JEST podpięte** (nie „niepodpięte"); **auth CZĘŚCIOWY**
  (nie „naprawione") — dopisać listę ~13 publicznych GET-ów.
- Nowa pozycja bezpieczeństwa priorytet 1: **domknąć auth na wszystkich trasach
  danych**, zwłaszcza `/api/export/shoper`, `/api/audit-log`, `/api/history`, `/api/config`.

---

*Weryfikacja Krok 2.1 (Faza 2) — 2026-08-17. Konfrontacja tez Perplexity z naszym
kodem, nie z pamięcią. Dokumentacja Perplexity przyjęta jako kanoniczna referencja
backendu; ten plik to warstwa weryfikacji i korekt.*
