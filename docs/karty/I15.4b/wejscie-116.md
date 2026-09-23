# Wejście dla I15.4 od ticketu 116 (koordynator) · 2026-09-23 — `assignKodImportu` zachowuje stary klucz

Przy porcie nadpisanego `ext.assignKodImportu` ze Staging v2 (#99) zachowaj **dosłownie** pierwszą gałąź:
istniejący sześciocyfrowy `kod_importu` produktu jest ZACHOWYWANY i nowa reguła grupowania go nie rusza
(`if (retained && /^\d{6}$/.test(retained)) { product.kodImportu = String(retained); return; }`).

⚠ To jest powód, dla którego kolizje `kod_importu` przeżyły Staging v2 — **80 grup / 174 produkty na kopii
produkcji z 23.09** (backlog #108). Nie „popraw" tego przy porcie: zmiana tej gałęzi przepisałaby klucze
grupowania całego katalogu, a to znaczy inne produkty i warianty w Selly. Rozstrzygnięcie kolizji to osobna
decyzja Ani (wariant (a) w #108), a doraźny zawór bezpieczeństwa robi karta I15.10 w Torze 1.
