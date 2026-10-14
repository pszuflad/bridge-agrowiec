# Wpis 267 — odbiór plików: filtr wieku i harmonogram

`odbierzZamowieniaZPlikow` ignoruje (jako `pominiete`) pliki XML młodsze niż 30 s albo starsze niż 30 dni od mtime. Krok `2026-10-14-partnerzy-odbior-plikow-wlaczony` ustawia w `.env` `PARTNERZY_ODBIOR_PLIKOW=true` i `PARTNERZY_ODBIOR_PLIKOW_MINUTY=10`.
