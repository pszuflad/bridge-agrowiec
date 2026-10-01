# Wpis do spec-backend od ticketu 182 · 2026-10-01

**Sekcja:** import — bezpieczeństwo źródła (#103), `parsujPlik`/`parsujBufor`.

**Potwierdzone w 182**: `meta` (kompletność cennika z `feed_safety.converted`) jest zdejmowana z wyniku adaptera PRZED każdym
przekształceniem tablicy rekordów (`zastosujDemoWNazwie`). Bez tego silnik traktuje ofertę jako niekompletną. Szczegóły: `docs/tickets/182-BUG-meta-kompletnosci-cennika/`.
