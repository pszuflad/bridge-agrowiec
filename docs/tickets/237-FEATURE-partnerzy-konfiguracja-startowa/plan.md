# 237 — PARTNERZY: konfiguracja startowa jako krok wdrożenia

Źródło: `docs/karty/PARTNERZY/wejscie-odpowiedzi-2026-10-12.md` (odp. 9, 15, 16, 22, 2). Zgodnie z CLAUDE.md („Poprawki danych … przez wdrożenie") — krok `2026-10-12-partnerzy-konfiguracja-startowa` w `kroki/rejestr.ts`, logika w `partnerzy/konfiguracja-startowa.ts`.

Co robi (tylko UZUPEŁNIA brakujące, nie nadpisuje): nazwa pliku (`adtyres_agrowiec`, `tyreworld_agrowiec`); magazyny = wszystkie z katalogu oprócz MO6/MO7/MO8; kraje (Adtyres 13, TyreWorld FR DE NL BE AT IT) z narzutem 0 % i stałą przesyłką 15 EUR; kolumny jak w obecnych plikach (CatNumber = `EAN-dostawca`; `MfrCode` pominięta — źródło nieznane); aktywacja obu partnerów.

Bezpieczeństwo: narzut 0 % = brak publikacji (blokada z ticketu 235), więc aktywacja nie wypuszcza cen zakupu, a scheduler i tak jest domyślnie wyłączony. Użytkowniczka ustawia narzuty w panelu.

Poza zakresem: harmonogram 60 min i wysyłka na FTP, import zamówień z FTP, Selly.
