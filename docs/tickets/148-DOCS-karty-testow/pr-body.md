## Po co

Instrukcja testowa dla Ani rozpada się na **trzy dokumenty** zamiast jednego (decyzja użytkownika
2026-09-24). Ten PR zakłada karty, żeby jutrzejsze tickety mogły branchować z `develop`, który ma
już ich pliki — zgodnie z regułą 0 z `CLAUDE.md`.

| # | Karta | Dokument | Treść |
|---|---|---|---|
| 1 | TEST.1 (istniała) | `docs/instrukcja-pelnego-testu.md` | test całego systemu — ekrany i moduły |
| 2 | **TEST.2** (nowa) | `docs/instrukcja-testu-sciezki-krytycznej.md` | import → parsery → baza → CSV → porównanie ze starą wersją → Selly |
| 3 | **TEST.3** (nowa) | `docs/instrukcja-pracy-dla-ani.md` | zgłaszanie uwag przez Claude Code, obowiązkowo `/feature` |

## Zmiany

- `docs/karty/TEST.2/karta.md` — ścieżka krytyczna. Karta rozstrzyga z góry dwie pułapki:
  **metodę porównania CSV** (naiwny `diff` dwóch dzisiejszych plików mierzy rozjazd danych, nie
  generatorów — baza stagingu to kopia z 23.09) i **model pull w Selly** (po cutoverze nie przepina
  się nic, bo nowy stos pisze pod tę samą ścieżkę).
- `docs/karty/TEST.3/karta.md` — zasady pracy. Wymóg `/feature` uzasadniony tym, co bez niego
  znika (researcher, pytania przed pracą, plan do zatwierdzenia, review, docs, PR bez konfliktów).
- `docs/karty/TEST.1/wejscie-148.md` — zawężenie zakresu: ścieżka krytyczna wychodzi do TEST.2,
  TEST.1 zostaje listą kontrolną całego systemu (proporcja 80/20 z `wejscie-145.md` rozkłada się
  teraz na dwa dokumenty).
- `docs/rebuild-roadmap.md` — tabela faz I15: C, D i DEC.1 rozliczone (tickety 139–142),
  faza E to teraz I15.9 → trzy karty TEST równolegle.

Bez zmian w kodzie.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
