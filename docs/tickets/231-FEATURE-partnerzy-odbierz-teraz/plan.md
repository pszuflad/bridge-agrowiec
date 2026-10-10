# 231 — „Odbierz teraz” zamówienia z e-maila (PRT-7.3a)

> Status: Approved (użytkownik 2026-10-10: po wydaniu 230 „ruszaj z kolejnym ticketem”, pracujemy autonomicznie) · Gałąź: `claude/peaceful-gates-a8yebr`

Karta: `docs/karty/PARTNERZY/` · poziom 7 · zależy od 229 (odbiór e-mail) i 230 (panel zamówień).

## Po co
Harmonogram odbioru jest domyślnie wyłączony, a połączenie IMAP nie było sprawdzone na prawdziwym serwerze. Ręczny przycisk pozwala przetestować kanał e-mail na
środowisku testowym (skrzynka testowa, poniedziałkowe decyzje o hasłach) BEZ włączania harmonogramu — tak jak „Generuj teraz” robi to dla cenników.

## Zakres
- `POST /api/partnerzy/:id/zamowienia/odbierz` (za `requireAuth`): jeden odbiór dla partnera; odpowiedź = wynik (`polaczono`, `wiadomosci`, `nowe`, `duplikaty`, `bledy`, `powod`).
  409, gdy partner nie ma włączonego kanału e-mail / adresu skrzynki, albo odbiór już trwa; 503, gdy aplikacja nie ma wstrzykniętego odbioru (testy); audyt `partner_odbior_reczny`.
- Zamek: jeden odbiór partnera naraz (wspólny z harmonogramem — ręczny i cykliczny się nie nakładają).
- `WynikOdbioru.powod` — czytelny powód, gdy nic nie odebrano (brak hosta/hasła w `.env`, awaria połączenia).
- Panel: przycisk „Odbierz teraz” w sekcji zamówień (wyłączony z podpowiedzią, gdy kanał e-mail nie jest skonfigurowany); wynik jako komunikat, lista odświeża się.
- Instrukcja testów (`docs/instrukcja-testow-PARTNERZY.md`): krótki rozdział „odbiór zamówień z e-maila”.

## Decyzje (samodzielnie)
- Przycisk działa też dla nieaktywnego partnera (jak „Generuj teraz”) — to właśnie do testów.
- Brak konfiguracji NIE jest błędem HTTP: odpowiedź 200 z `polaczono:false` i `powod`, żeby panel pokazał, czego brakuje w `.env` (nazwa zmiennej, bez wartości).
- Trasy poza `contract/openapi.yaml` (jak reszta `/api/partnerzy*`).

## Kontrakt i fixtures
Brak (nowa trasa poza `openapi.yaml`; istniejące bez zmian).

## Testy
Backend: trasa (auth, 409, 503, wynik, powód, zamek, audyt) na atrapie skrzynki wstrzykniętej do aplikacji; moduł odbioru (zamek, `powod`). Frontend: MSW (przycisk, wynik, wyłączenie, błąd).

## Poza zakresem
Odbiór z FTP (7.2), statusy/Selly, zmiana logiki odbioru.

## Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop`
