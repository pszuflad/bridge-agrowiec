#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
rm -f data_dryrun_test.db data_dryrun_test.db-shm data_dryrun_test.db-wal
echo "=== Wymuszam checkpoint WAL na oryginalnej bazie (bez zmiany danych) ==="
sqlite3 data.db "PRAGMA wal_checkpoint(FULL);"
echo "=== Sprawdzam kolumne w ORYGINALE po checkpoint ==="
sqlite3 data.db "PRAGMA table_info(products);" | grep -i zastosowanie
echo "=== Kopiuje na nowo do testu (uzywajac .backup, bezpieczne dla WAL) ==="
sqlite3 data.db ".backup data_dryrun_test.db"
echo "=== Sprawdzam kolumne w KOPII TESTOWEJ ==="
sqlite3 data_dryrun_test.db "PRAGMA table_info(products);" | grep -i zastosowanie
echo "OK - gotowe do dry run"
