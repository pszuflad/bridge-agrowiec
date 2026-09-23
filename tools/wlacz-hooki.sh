#!/usr/bin/env bash
# Włącza hooki repo (.githooks) w TYM klonie — git nie przenosi hooków przy klonowaniu.
# Uruchom raz po sklonowaniu repo: tools/wlacz-hooki.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
echo "✓ core.hooksPath = .githooks (dotyczy tego klonu i wszystkich jego worktree)"
echo "  Aktywne hooki:"; ls -1 .githooks | sed 's/^/    /'
