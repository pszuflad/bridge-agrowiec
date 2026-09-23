# 144-DOCS — lista „do zrobienia przed testami I15" dla koordynatora

## Summary

Ticket wyłącznie dokumentacyjny, **zero zmian w `rebuild/` i `contract/`**. Na polecenie
użytkownika (2026-09-24) zbiera w jednym miejscu to, co ticket 139 (karta I15.10b, montaż modułu
dostępności) zostawił otwarte, tak żeby wypłynęło dokładnie wtedy, gdy wszystkie karty I15 będą
zrobione i zaczniemy podchodzić do testów.

Powód osobnego ticketu: PR #153 (ticket 139) był już zmergowany, więc nie dało się tego dołożyć
do niego.

## Changes

- **Nowy** `docs/karty/I15.9/wejscie-144.md` — pełna lista czterech pozycji do rozliczenia przy
  domknięciu I15 (decyzja `#139.2`, konfiguracja `SELLY_TRYB`/`SELLY_CSV_DIR`, trzy nieaktualne
  zdania w cudzych plikach, znany brak pokrycia testowego).
- **Nowy** `docs/karty/TEST.1/wejscie-144.md` — to samo przełożone na ryzyko przy pisaniu
  instrukcji testów: przy `SELLY_TRYB=wylaczony` odświeżanie dostępności jest niewidocznie
  wyłączone, więc Ania zgłosi usterkę, której nie ma.

Nie dotknięte: `docs/rebuild-roadmap.md` (CLAUDE.md reguła 0), `docs/rebuild-backlog.md`,
cudze `karta.md`, cudze pliki `wpis-*.md`, kod.

## Dlaczego akurat te dwa miejsca

Użytkownik określił moment („jak wszystkie karty I15 zostaną zrobione i będziemy podchodzić do
testów"), nie plik. Ten moment czytają dokładnie dwie karty: **I15.9** (faza 6, ostatnia karta
I15, domknięcie) i **TEST.1** (ostatni dokument przed cutoverem, instrukcje testów). Wpis
`#139.2` jest dodatkowo wyłapywany mechanicznie przez `tools/stan-backlogu.sh --do-decyzji`,
więc decyzja nie zginie nawet wtedy, gdy nikt nie otworzy kart.

## Test results

Nie dotyczy — ticket nie rusza kodu. Bramki `rebuild/backend/` nieuruchamiane, bo nie ma czego
sprawdzać (zmiana obejmuje wyłącznie `docs/`).

## Breaking changes

Brak.

## Follow-up

Same pozycje z listy — patrz `docs/karty/I15.9/wejscie-144.md`. Żadna nie jest blokerem
domknięcia I15.
