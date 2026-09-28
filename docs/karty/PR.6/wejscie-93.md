# Wejście dla PR.6 od ticketu 93 (PR.4) · 2026-09-22

Dotyczy `docs/przeglad-12-widokow.md` §11 (Selly), punkt „«Wygeneruj CSV teraz» tworzy plik i pokazuje jego datę”.

- **Przyczyna zgłoszenia Ani** („po kliknięciu nadal «Brak pliku CSV»”): plik powstawał, ale
  kasował go następny deploy stagingu (`rsync --delete` na docroot, w którym leży `ex-port-files/`).
  To nie był błąd przycisku ani panelu. Naprawione w `tools/deploy-staging.sh` + `tools/publikuj-frontend.sh`.
- **Punkt jest do ponownego sprawdzenia przez Anię — pod warunkiem**, że na stagingu działa
  wydanie zawierające ticket 93 (commit z tego ticketu w `develop` i po nim co najmniej jeden deploy).
- **Instrukcja dla Ani (do wpisania w §11):** kliknij „Wygeneruj CSV teraz” i potwierdź. Pod przyciskiem
  pojawi się „✓ Wygenerowano…”, a w tabeli data „Ostatnia synchronizacja”. Wróć do panelu później
  (np. następnego dnia, po kolejnych zmianach na stagingu): **data ma zostać ta sama, a nie
  „Brak pliku CSV”**. Tę drugą część trzeba dopisać, bo pierwsza sprawdzała się już przed poprawką.
- „Plik nie został wygenerowany dzisiaj” następnego dnia to **poprawne** zachowanie na stagingu:
  staging nie ma crona o 6:00, plik jest tylko z ręcznego kliknięcia.
- Pytanie 12.6 (`docs/pytania-do-ani-2026-09-18.md`) nie jest już potrzebne do naprawy.

Źródło: `docs/tickets/93-CHORE-diagnoza-selly-csv-staging/raport.md`.
