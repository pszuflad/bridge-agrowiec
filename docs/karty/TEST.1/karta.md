# TEST.1 — instrukcja pełnego testu systemu dla Ani

> **Stan:** ⬜ po I15.9 (OSTATNI dokument przed cutoverem)
> **Iteracja:** poza iteracjami (przygotowanie do cutoveru) · **Wpisy backlogu:** — · **Zależy od:** I15.9, I15.5, I15.11, I15.10b
> **Ticket:** —

Założona przez koordynatora ticketem `138-DOCS-status-i15`, 2026-09-23.

## Zakres
**Jeden dokument**, którym Ania przechodzi cały system przed przełączeniem — zamiast kilkunastu kartek.
Podstawą jest `docs/przeglad-12-widokow.md` (13 ekranów, zaktualizowany kartą PR.6), rozszerzony o to,
czego przegląd nie obejmuje:
- **import i staging po zmianach z 22–23.09**: blokada niewiarygodnego cennika, wycofania po trzech
  ofertach i 24 h, auto-wstrzymania, „Rozstrzygnij", „Braki w cenniku", podgląd starej karty;
- **MO9 przez API** (jedyny dostawca z hurtowni): czy import przechodzi i czy stany wyglądają sensownie;
- **Selly**: CSV o 6:00 (pobierany przez sklep o 12:00), Tor 1 i Tor 2 — na stagingu **wyłączone**,
  więc opisz, co Ania sprawdza, a czego nie da się sprawdzić poza produkcją;
- **archiwum importów**, alerty (w tym zakładka „Katalog"), analityka z pełnymi plikami CSV (P10.5).

⚠ **Format: polecenie Ani z 2026-09-22** (`docs/karty/I15.9/wejscie-104b.md`) — na punkt: co zmieniliśmy
(jedno zdanie) → polecenie → rezultat. Bez ściany tekstu. Rozbieżności z logiką biznesową → osobna sekcja
„Do Twojej decyzji".
⚠ W raporcie podaj użytkownikowi **warunki środowiskowe**: jaka wersja ma stać na stagingu, czy baza jest
świeżą kopią produkcji i które automaty są tam włączone (import) lub wyłączone (Selly).

## Pliki (wyłączna własność)
`docs/instrukcja-pelnego-testu.md` (nowy), `docs/karty/TEST.1/karta.md`, `docs/tickets/<ID>/**`.
NIE: `docs/przeglad-12-widokow.md` (zostaje jako osobny dokument), instrukcje `instrukcja-testow-*`.

## Decyzje
—

## Dowiezione
—

## Do koordynatora
—
