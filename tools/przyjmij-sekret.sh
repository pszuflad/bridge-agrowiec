#!/bin/bash
# Ticket 264/265: wartości przekazane przez GitHub Actions na STDIN skryptu wdrożenia (nie w argumentach i nie w zmiennej środowiskowej SSH — nie trafiają
# do listy procesów ani do logów). Wołane z tools/deploy-produkcja.sh zaraz po wczytaniu `.env`. Źródłowane (`.`), nie uruchamiane — ustawia zmienne i FORCE
# w skrypcie wdrożenia.
#
# Protokół stdin (kolejność linii jest stała):
#   linia 1 — hasło SMTP                          → SMTP_HASLO                       (ticket 264)
#   linia 2 — mapowanie katalogów zamówień partnerów → PARTNERZY_KATALOGI_ZAMOWIEN   (ticket 265; ścieżki serwera plików NIE są w repozytorium)
#   linia 3 — mapowanie katalogów publikacji cenników → PARTNERZY_KATALOGI_PUBLIKACJI (ticket 271; katalogi, do których Bridge zapisuje pliki dla partnerów)
# Puste linie i brak linii = nic nie robi (brak sekretu w GitHubie). Linii dodatkowych na końcu nie dokładamy bez zmiany tego protokołu.
#
# Zasady dla każdej wartości:
#   • stdin to terminal (ktoś uruchomił skrypt ręcznie) → nic nie robi;
#   • wartość identyczna z tą w `.env` → nic nie robi (deploy nie jest wymuszany);
#   • inna → zapisuje w `.env` jako `KLUCZ=…` (cytowane przez printf %q, więc `source` czyta ją poprawnie — także ze średnikami), ZACHOWUJE pozostałe linie,
#     eksportuje zmienną i ustawia FORCE=1 — serwer musi się wtedy przebudować/zrestartować, żeby backend wczytał nową wartość, także gdy commit się nie zmienił.
# Wartości nigdy nie są wypisywane (ani do logu, ani na ekran) — log mówi tylko, który KLUCZ zapisano.

# zapisz_wartosc_w_env <plik .env> <KLUCZ> <wartość>: zwraca 0 zawsze; ustawia FORCE=1 i eksportuje KLUCZ, gdy wartość się zmieniła.
zapisz_wartosc_w_env() {
  local plik_env="$1" klucz="$2" wartosc="$3" biezace="" tmp
  [ -n "$wartosc" ] || return 0
  if [ -f "$plik_env" ]; then
    biezace="$( ( set +u; . "$plik_env" >/dev/null 2>&1; eval "printf '%s' \"\${$klucz:-}\"" ) )"
  fi
  [ "$biezace" = "$wartosc" ] && return 0
  tmp="$(umask 077; mktemp "$plik_env.XXXXXX")"
  {
    if [ -f "$plik_env" ]; then grep -v -E "^[[:space:]]*(export[[:space:]]+)?${klucz}=" "$plik_env" || true; fi
    printf '%s=%q\n' "$klucz" "$wartosc"
  } > "$tmp"
  mv "$tmp" "$plik_env"
  export "$klucz=$wartosc"
  FORCE=1
  export FORCE
  echo "$(date '+%F %T')  ${klucz} zapisane w .env (przekazane z GitHub Actions) — wymuszam wdrożenie, żeby backend je wczytał"
  return 0
}

przyjmij_sekret_smtp() {
  local plik_env="$1" haslo="" katalogi="" publikacja=""
  [ -t 0 ] && return 0
  IFS= read -r -t 5 haslo || true
  IFS= read -r -t 5 katalogi || true
  IFS= read -r -t 5 publikacja || true
  zapisz_wartosc_w_env "$plik_env" SMTP_HASLO "$haslo"
  zapisz_wartosc_w_env "$plik_env" PARTNERZY_KATALOGI_ZAMOWIEN "$katalogi"
  zapisz_wartosc_w_env "$plik_env" PARTNERZY_KATALOGI_PUBLIKACJI "$publikacja"
  return 0
}
