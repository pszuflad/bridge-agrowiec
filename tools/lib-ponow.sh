#!/usr/bin/env bash
# Wspólna logika ponawiania dla tools/sync-z-develop.sh i tools/push-i-pr.sh.
# Nie uruchamiaj tego pliku — jest do `source`.
#
# Powód istnienia: repo ma kilkadziesiąt worktree kart na JEDNYM katalogu .git. Równoległe
# `git fetch` / `git push` biją się o te same pliki blokad (`.git/index.lock`,
# `refs/remotes/origin/*.lock`, `packed-refs.lock`) i jedna ze stron dostaje błąd. To jest
# przejściowe — wystarczy odczekać i powtórzyć. Ale NIE każdy błąd jest przejściowy, więc
# ponawiamy tylko to, co ma sens (patrz `ponow_klasyfikuj`).

PONOW_PROBY="${PONOW_PROBY:-5}"
# Przerwy w sekundach między próbami (rosnąco); ostatnia wartość powtarza się, gdy prób jest więcej.
# PONOW_PRZERWY podaje się jako łańcuch ("5 15 40"), bo zmiennej z env nie da się wczytać do tablicy
# o tej samej nazwie — stąd osobna tablica wewnętrzna.
read -r -a _PONOW_PRZERWY <<< "${PONOW_PRZERWY:-5 15 40 90 180}"

PONOW_WYJSCIE=""   # połączone stdout+stderr ostatniej próby
PONOW_POWOD=""     # klasyfikacja ostatniego błędu

# ponow_klasyfikuj <tekst-błędu> → auth | nieaktualna | blokada | sieć | inne
ponow_klasyfikuj() {
  local t="$1"
  if grep -qEi 'could not read Username|Authentication failed|terminal prompts disabled|Permission denied \(publickey\)|gh auth login|token in keyring is invalid|HTTP 401|Bad credentials|SAML enforcement' <<< "$t"; then
    echo auth; return
  fi
  if grep -qEi 'non-fast-forward|fetch first|Updates were rejected|\[rejected\]' <<< "$t"; then
    echo nieaktualna; return
  fi
  if grep -qEi 'index\.lock|unable to create .*\.lock|cannot lock ref|packed-refs\.lock|ref lock|Unable to lock|another git process' <<< "$t"; then
    echo blokada; return
  fi
  if grep -qEi 'rate limit|HTTP (429|50[0-9])|was submitted too quickly|Connection (reset|refused|timed out)|Could not resolve host|RPC failed|remote end hung up|early EOF|Operation timed out|TLS connection|temporarily unavailable|502 Bad Gateway|503 Service' <<< "$t"; then
    echo sieć; return
  fi
  echo inne
}

# ponow <polecenie...> — uruchamia, a przy błędzie przejściowym (blokada/sieć) czeka i powtarza.
# Zwraca kod ostatniej próby. Wynik polecenia jest w $PONOW_WYJSCIE (i na stdout), powód w $PONOW_POWOD.
ponow() {
  local proba=1 kod przerwa
  while :; do
    PONOW_WYJSCIE="$("$@" 2>&1)"; kod=$?
    [[ -n "$PONOW_WYJSCIE" ]] && printf '%s\n' "$PONOW_WYJSCIE"
    (( kod == 0 )) && { PONOW_POWOD=""; return 0; }

    PONOW_POWOD=$(ponow_klasyfikuj "$PONOW_WYJSCIE")
    case "$PONOW_POWOD" in
      blokada|sieć) : ;;                       # ma sens czekać
      *) return "$kod" ;;                      # auth / nieaktualna / inne — natychmiast do wołającego
    esac

    if (( proba >= PONOW_PROBY )); then
      echo "✗ Nadal blokada po $PONOW_PROBY próbach — dalej nie ponawiam."
      ponow_diagnoza_blokady
      return "$kod"
    fi

    przerwa="${_PONOW_PRZERWY[$((proba-1))]:-${_PONOW_PRZERWY[-1]}}"
    echo "⏳ Próba $proba/$PONOW_PROBY nieudana ($PONOW_POWOD) — czekam ${przerwa}s i powtarzam: $*"
    sleep "$przerwa"
    (( proba++ ))
  done
}

# Pokazuje, czy blokada jest ŚWIEŻA (ktoś równolegle pracuje) czy ZWIETRZAŁA (po zabitym procesie).
ponow_diagnoza_blokady() {
  local kat stare
  kat=$(git rev-parse --git-common-dir 2>/dev/null) || return 0
  stare=$(find "$kat" -maxdepth 3 -name '*.lock' -mmin +10 2>/dev/null)
  if [[ -n "$stare" ]]; then
    echo "   Pliki blokad starsze niż 10 min (prawdopodobnie po przerwanym procesie git):"
    printf '     %s\n' $stare
    echo "   Sprawdź, czy nic nie działa (\`ps aux | grep -c '[g]it '\`) i dopiero wtedy usuń je ręcznie."
  else
    echo "   Brak zwietrzałych blokad — najpewniej inna karta realnie pracuje na tym .git. Spróbuj za chwilę."
  fi
}
