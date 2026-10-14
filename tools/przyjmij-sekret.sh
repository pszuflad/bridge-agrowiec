#!/bin/bash
# Ticket 264: sekret przekazany przez GitHub Actions na STDIN skryptu wdrożenia (nie w argumentach i nie w zmiennej środowiskowej SSH — nie trafia do listy procesów ani do logów).
# Wołane z tools/deploy-produkcja.sh zaraz po wczytaniu `.env`. Źródłowane (`.`), nie uruchamiane — ustawia SMTP_HASLO i FORCE w skrypcie wdrożenia.
#
# Zasady:
#   • stdin to terminal (ktoś uruchomił skrypt ręcznie) albo pusty/zamknięty (brak sekretu w GitHubie) → nic nie robi;
#   • hasło identyczne z tym w `.env` → nic nie robi (deploy nie jest wymuszany);
#   • inne → zapisuje w `.env` jako `SMTP_HASLO=…` (cytowane przez printf %q, więc `source` czyta je poprawnie), ZACHOWUJE pozostałe linie,
#     eksportuje SMTP_HASLO i ustawia FORCE=1 — serwer musi się wtedy przebudować/zrestartować, żeby backend wczytał nowe hasło, także gdy commit się nie zmienił.
# Wartość hasła nigdy nie jest wypisywana (ani do logu, ani na ekran).
przyjmij_sekret_smtp() {
  local plik_env="$1" haslo="" biezace="" tmp
  [ -t 0 ] && return 0
  IFS= read -r -t 5 haslo || true
  [ -n "$haslo" ] || return 0
  if [ -f "$plik_env" ]; then
    biezace="$( ( set +u; . "$plik_env" >/dev/null 2>&1; printf '%s' "${SMTP_HASLO:-}" ) )"
  fi
  [ "$biezace" = "$haslo" ] && return 0
  tmp="$(umask 077; mktemp "$plik_env.XXXXXX")"
  {
    if [ -f "$plik_env" ]; then grep -v -E '^[[:space:]]*(export[[:space:]]+)?SMTP_HASLO=' "$plik_env" || true; fi
    printf 'SMTP_HASLO=%q\n' "$haslo"
  } > "$tmp"
  mv "$tmp" "$plik_env"
  export SMTP_HASLO="$haslo"
  FORCE=1
  export FORCE
  echo "$(date '+%F %T')  SMTP_HASLO zapisane w .env (przekazane z GitHub Actions) — wymuszam wdrożenie, żeby backend je wczytał"
  return 0
}
