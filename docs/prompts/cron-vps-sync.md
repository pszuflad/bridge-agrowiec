# Prompt do Perplexity — dodanie crona dla producenta sync (VPS)

> Wklej w Space „Budowanie mostu dla Agrowca". Perplexity ma dostęp do serwera
> i już raz dodało cron (`generate_selly_export.cjs`), więc zna działającą metodę
> na tym hoście (panel/UI/CLI crona jest tu ograniczony — użyj tej samej drogi).

---

Dodaj na serwerze **zadanie cron dla użytkownika `admin`**, dokładnie tą samą
metodą, którą wcześniej dodałeś zadanie `generate_selly_export.cjs`:

- **Harmonogram:** co godzinę, o pełnej minucie → `0 * * * *`
- **Komenda:**
  ```
  /bin/bash /home/admin/bridge-sync/tools/vps-sync.sh >> /home/admin/bridge-sync/tools/vps-sync.log 2>&1
  ```

Kontekst (do czego to służy, żeby nie było wątpliwości): skrypt `vps-sync.sh`
robi snapshot bieżącego stanu produkcji (backend + frontend) do klona repozytorium
w `/home/admin/bridge-sync`, generuje wersje diffowalne i wypycha zmiany na GitHub.
Nie modyfikuje aplikacji produkcyjnej — tylko ją czyta.

Po dodaniu:
1. Potwierdź, że zadanie pojawiło się na **liście zadań CRON w panelu**, obok
   `generate_selly_export.cjs`.
2. Podaj, jaką metodą je dodałeś (panel / API / plik), żebym wiedział na przyszłość.
3. Nie ujawniaj żadnych sekretów (haseł panelu, kluczy).
