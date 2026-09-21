# Wejście dla P10.3 od ticketu 87 (koordynator, decyzje) · 2026-09-21

**Zakres P10.3 rozstrzygnięty — karta przestaje być „⏸ zakres do decyzji", jest gotowa do startu
po P10.1.** Decyzje użytkownika z 2026-09-21, wszystkie zgodnie z rekomendacją; pełna treść
w backlogu **#91** (boks „⭐ ZAKRES").

| # | Decyzja |
|---|---|
| 1 | **Plik CSV powstaje w przeglądarce** z wierszy, które tabela karty ma po filtrach (globalnych i lokalnych). Trasa `export/:view` na serwerze zostaje bez zmian i przestaje być wołana przez przyciski. |
| 2 | **Marża: plik = przekrój tabeli** (grupy), bez drugiego przycisku „per produkt". |
| 3 | **Plik ma wszystkie wiersze po filtrach** — limit 300 dotyczy tylko rysowania tabeli. |

**Fakty z kodu, na których stoi decyzja (sprawdzone 2026-09-21 na `develop`):**
- `rebuild/frontend/src/pages/analityka/eksport.tsx` — `PrzyciskCsv` robi nawigację
  `window.location.href` (autoryzacja cookie'em), bez query stringu; komentarz „EKSPORT NIE NIESIE
  FILTRÓW … i tak ma zostać" przestaje być prawdą i trzeba go przepisać.
- `FiltryGlobalne.tsx` — pasek filtrów to odstępstwo O-10a-2 (produkcja go nie ma).
- `filtrowanie.ts` — filtry stosowane KLIENTEM nad pobranymi wierszami; sekcja stosuje tylko
  wymiary, które niosą jej wiersze (`wymiaryNieobslugiwane`). Plik ma stosować dokładnie to samo.
- `TabelaAnalityki.tsx` — `LIMIT_WIERSZY = 300`, `dane.slice(0, 300)`.
- `SekcjaRotacji.tsx` — „Bez ruchu dni" idzie do `?days` (jedyny filtr serwerowy); plik bierze
  wiersze już po tym filtrze.
- `SekcjaMarze.tsx` — dziś `export/margins` oddaje wiersze PER PRODUKT, inne niż tabela.

**Zależność:** po P10.1 — ona zmienia dane i widok kart „Dostępności" (#32), do których P10.3
dokłada eksport. P10.3 NIE rusza już pliku tras (`routes/analytics.ts`) — zdanie w roadmapie
„P10.3 rusza ten sam plik tras co P10.1" jest po tej decyzji nieaktualne (do poprawy przez
koordynatora).
