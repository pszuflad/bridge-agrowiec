## 189-CHORE: ochrona `zdjecia-produktow/` przed `rsync --delete` w deployu

Zdjęcia produktów (`bkt/`, `opony/`, `store/`, ~207 MB) przeniesione z `agritires.eu/public_html/zdjecia-produktow` na vpshd86 do `public_html/bridgeone/zdjecia-produktow` (docroot produkcji). Bez tej zmiany najbliższy deploy (`tools/publikuj-frontend.sh`, `rsync --delete`) skasowałby katalog. Dodano go do chronionych katalogów w `tools/deploy-produkcja.sh` i (symetrycznie) `tools/deploy-staging.sh`. Kod aplikacji bez zmian.
