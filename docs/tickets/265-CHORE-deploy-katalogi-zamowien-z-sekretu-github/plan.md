# 265 — wdrożenie przekazuje mapowanie katalogów zamówień z sekretu GitHub

Prośba użytkowniczki 2026-10-14: „wstaw tę zmienną” (`PARTNERZY_KATALOGI_ZAMOWIEN`), żeby krok trackingu (257) przestał się odkładać. Dziennik wdrożeń pokazał, że w `.env` produkcji tej zmiennej nie ma.
Ścieżek katalogów serwera plików partnerów nie znam i — zgodnie z wcześniejszą decyzją użytkowniczki — nie wpisuję ich do repozytorium (publiczne) ani do logu (nazwy katalogów to część zabezpieczenia). Dlatego ten sam mechanizm co hasło SMTP (ticket 264): sekret GitHub `PARTNERZY_KATALOGI_ZAMOWIEN` (wartość `Nazwa=/ścieżka;Nazwa2=/ścieżka2`, dokładnie jak w `.env`) idzie przez workflow na **drugą linię stdin** skryptu wdrożenia, który zapisuje go w `.env` (cytowane `printf %q`, średniki bezpieczne) i wymusza wdrożenie przy zmianie. Log mówi tylko, że klucz zapisano — bez wartości.
- `tools/przyjmij-sekret.sh`: wspólna funkcja `zapisz_wartosc_w_env`; protokół stdin: linia 1 = `SMTP_HASLO`, linia 2 = `PARTNERZY_KATALOGI_ZAMOWIEN`; puste linie = nic.
- `deploy-produkcja.yml`: `printf '%s\n%s\n' "$SMTP_MAIL_INFO_PASSWORD" "$PARTNERZY_KATALOGI_ZAMOWIEN" | ssh …`, sekret przez `env:` (maskowany).
- Test w prawdziwym bashu: mapowanie ze średnikami, niezależność od hasła, brak zmian przy tym samym, zamiana starego, brak wycieku ścieżek poza `source`.
Po zapisie krok `2026-10-13-partnerzy-katalogi-trackingu` (257) sam wyprowadzi `PARTNERZY_KATALOGI_TRACKINGU` z istniejących katalogów (wynik w logu bez ścieżek). Odbiór zamówień z plików (`PARTNERZY_ODBIOR_PLIKOW`) pozostaje osobną flagą — ta zmiana jej nie włącza.
⚠ Zmiana ścieżki produkcyjnej: działa od DRUGIEGO wdrożenia po merge'u (skrypt aktualizuje się w trakcie). Wymaga od użytkowniczki dodania sekretu `PARTNERZY_KATALOGI_ZAMOWIEN` w GitHubie.
