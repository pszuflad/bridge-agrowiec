# Wejście dla TEST.1 od ticketu 148 (koordynator) · 2026-09-24 — PODZIAŁ NA TRZY DOKUMENTY

**Decyzja użytkownika 2026-09-24.** Zamiast jednego dokumentu Ania dostaje trzy, wydawane w tej
kolejności:

| # | Karta | Dokument | Treść |
|---|---|---|---|
| 1 | **TEST.1** (ta karta) | `docs/instrukcja-pelnego-testu.md` | test **całego systemu** — wszystkie ekrany i moduły |
| 2 | **TEST.2** | `docs/instrukcja-testu-sciezki-krytycznej.md` | ścieżka krytyczna: import → parsery → baza → CSV → Selly |
| 3 | **TEST.3** | `docs/instrukcja-pracy-dla-ani.md` | zasady zgłaszania uwag przez Claude Code, obowiązkowo `/feature` |

## Co to zmienia w zakresie TEST.1

**Ścieżka krytyczna wychodzi z tej karty do TEST.2** — import, parsery, zapis do bazy, eksport CSV,
porównanie ze starą wersją i sprawa adresu feedu w Selly należą teraz do TEST.2. TEST.1 **odsyła**
do tamtego dokumentu jednym zdaniem na początku („ścieżkę główną przechodzisz osobno, dokumentem 2")
i **nie powtarza** jej scenariuszy.

Priorytety z `wejscie-145.md` zostają w mocy, ale rozkładają się teraz na dwa dokumenty: 80% uwagi
(ścieżka główna) to TEST.2, 20% (panel, alerty, atrybuty, analityka, waga gabarytowa, archiwum,
konto) to TEST.1. Dzięki temu TEST.1 może być tym, czym miało być — **listą kontrolną całego
systemu**: wejdź, sprawdź, że działa i wygląda sensownie, z odesłaniem do
`docs/przeglad-12-widokow.md` zamiast przepisywania go.

## Kolejność wydania

Dokumenty powstają równolegle (trzy niezależne karty, rozłączne pliki), ale **Ania zaczyna testy
od dokumentu 2**. Jeśli ścieżka krytyczna nie przechodzi, reszta testów i tak nie ma znaczenia dla
decyzji o cutoverze.
