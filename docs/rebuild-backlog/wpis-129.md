# Backlog — wpisy ticketu 129 (`129-FEATURE-akceptacja-stagingu`) · 2026-09-23

Karta **I15.4c** (ścieżka odczytu i decyzji użytkownika w `staging_policy.cjs`). Ten plik zawiera
**jeden nowy wpis** oraz odnotowanie zmian statusu we wpisach `#99`, `#103`, `#104`, `#106`, `#107`
z `docs/rebuild-backlog.md` (tam zmieniona wyłącznie linia `Do nowej wersji?` / `Status`, zgodnie
z regułą tego katalogu).

### #129.1 · 2026-09-23 · [BACKEND] · Zatwierdzanie zbiorcze: grupowanie `kod_importu` przez `compatibility()` kosztuje 58× więcej

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (wdrożenie Staging v2 na produkcji) |
| **Kategoria** | BACKEND |
| **Pliki** | `mirror/backend/staging_policy.cjs:141-157` (`ext.assignKodImportu`) |
| **Commit** | `88fa31c` (stan zamrożony) |
| **Do nowej wersji?** | ❌ **NIE ZMIENIAMY — decyzja użytkownika 2026-09-23** (ticket 135). Port jest wierny, a produkcja ma **dokładnie ten sam koszt**, więc nie ma od czego odstępować. Wraca do rozważenia dopiero, **gdy Ania zgłosi, że panel stoi.** |
| **Status** | ✅ zmierzone, opisane, świadomie nieoptymalizowane — sprawa zamknięta do czasu zgłoszenia z produkcji |

**Opis biznesowy.** Zatwierdzenie całego stagingu z kopii produkcji (2502 pozycje po migracji 012)
zajmuje **ok. 16 minut** jednego żądania. Nie jest to problem z wpisu #107 (tamten dotyczył blokady
bazy i u nas nie występuje), tylko **osobny, niezależny koszt**, którego backlog dotąd nie opisywał.

**Szczegół techniczny (dla rebuildu).** Staging v2 nadpisuje `ext.assignKodImportu` (`:141-157`):
grupowanie `kod_importu` przechodzi z „po EAN-ie, zapasowo po `marka|rozmiar|bieznik|nazwa`" na
`compatibility()` — pełną tożsamość opony — i dopiero w jej obrębie po EAN-ie albo nazwie. Nowa
wersja woła `U.listProducts()` dla **każdej** zatwierdzanej pozycji i przepuszcza cały katalog
przez `compatibility()`.

Pomiar na kopii `db/snapshot.db` (7405 produktów, 200 pozycji, `rebuild/backend/scripts/pomiar-107.ts`):

| wariant | średnia/pozycja | mediana | p95 | najwolniejsza | 200 pozycji |
|---|---|---|---|---|---|
| bazowy (grupowanie po EAN) | 6,7 ms | 6,3 ms | 10,8 ms | 20,0 ms | 1,3 s |
| Staging v2 (`compatibility()`) | 386,0 ms | 344,1 ms | 588,8 ms | 863,7 ms | 77,2 s |

Mikropomiar rozkłada te 386 ms: `listaProduktow()` **251,7 ms** + `compatibility()` po 7405
wierszach **116,4 ms** = 368,2 ms, czyli **95 % kosztu**. Reszta (bramka, transakcja, zapis) jest
pomijalna.

**Rekomendacja (moja).** 🕒 **później, i wyłącznie jako świadome odstępstwo.** To jest kod
produkcji — port jest wierny i nie wolno go „poprawić" w ramach reguły 1:1. Jeśli 16 minut okaże
się nie do przyjęcia dla Ani, najtańszy wariant to **cache katalogu na czas jednej partii**
(`listProducts()` raz na żądanie zamiast raz na pozycję) — zbija 251,7 z 386 ms bez zmiany wyniku
grupowania. Wymaga decyzji użytkownika i wpisu jako odstępstwo, bo produkcja tak nie robi.
Powiązania: `#107` (inny problem, ta sama trasa), karta **I15.11** (panel — patrz `wejscie-129.md`).

---

## Zmiany statusów we wpisach `docs/rebuild-backlog.md` (w miejscu)

Decyzja użytkownika **D129.3** (2026-09-23): `88fa31c` traktujemy jako decyzję już podjętą —
D3 („Staging v2 przenosimy") obejmuje całość zamrożonej produkcji, a `staging_policy.cjs` już te
warstwy zawiera. Podniesione tylko tam, gdzie ticket **faktycznie** dowiózł logikę:

| Wpis | Było | Jest | Zakres dowieziony przez ticket 129 |
|---|---|---|---|
| `#99` (Staging v2) | ✅ TAK | ✅ **TAK — DOWIEZIONE** | `checkAcceptance` (7 blokad), `addStaging`/`updateStaging`, `resolveStaging`, trasy `review`/`resolve` |
| `#103` (braki w cenniku) | ⬜ do decyzji | ✅ **TAK — CZĘŚCIOWO** | tylko strona akceptacji: próg trzech dowodów nieobecności w `checkAcceptance`. **Import (`feed_safety`, blokada źródła) → I15.4b** |
| `#104` (dostępność) | ⬜ do decyzji | ✅ **TAK — CZĘŚCIOWO** | ochrona ręcznego wstrzymania w akceptacji, `suspend()`, `product_auto_suspensions` w ścieżce decyzji. **Import i `availability_sync` → I15.4b / I15.10** |
| `#106` (decyzje o nieobecnych) | ⬜ do decyzji | ✅ **TAK — DOWIEZIONE** | `closeAbsenceReview`, `chooseAbsenceCard` (obie gałęzie), `candidates_hash`, trasy `choose-absence-card` i `close-absence-review` |
| `#107` (wydajność) | ⬜ do decyzji | ❌ **NIE — nie dotyczy odbudowy** | zmierzone: problem wynikał z OSOBNEGO połączenia w `uwaga_cena_patch.cjs`; mamy jedno połączenie i kolumnę modelu, najwolniejsza pozycja 0,86 s wobec progu 5 s. Nowy, niezależny koszt → **#129.1** |

`#105` **nie tknięty** przez ten ticket — zostaje `⬜ do decyzji`.

*Pominięte (brak zadania dla rebuildu):* brak.
