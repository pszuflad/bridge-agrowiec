---
id: projects/pony-assistant-demo
item_type: wiki_page
semantic_type: project
title: PONY Assistant Demo
description: PONY Assistant Demo to demo jednostronicowe dla klienta, dotyczące wsparcia PONY/Panda EV, podzielone na polskiego asystenta kierowcy i polskiego asystenta serwisowego/mechanika.
created_at: '2026-06-17T00:00:00+00:00'
updated_at: '2026-07-25T07:46:00+00:00'
language: pl
---
# PONY Assistant Demo

PONY Assistant Demo to demo jednostronicowe dla klienta, dotyczące wsparcia PONY/Panda EV, podzielone na polskiego asystenta kierowcy i polskiego asystenta serwisowego/mechanika[cite:1].

## Jak to działa

Demo prezentuje dwa specyficzne dla roli tryby asystenta w jednej aplikacji HTML: pomoc dla kierowcy oparta na materiale w stylu instrukcji użytkownika/jazdy oraz pomoc serwisową oparta na materiale w stylu instrukcji naprawy[cite:1].

- **Podział na dwóch asystentów** — tryb kierowcy i tryb serwisowy są rozdzielone, aby instrukcje dla użytkownika końcowego nie mieszały się z diagnostyką mechanika czy procedurami naprawczymi[cite:1].
- **Szczegółowy styl odpowiedzi** — użytkownik odrzucił suche odpowiedzi tylko w formie punktów; odpowiedzi demo powinny podawać praktyczne kroki, ostrzeżenia i, gdy to istotne, odniesienia do sekcji/stron instrukcji w naturalnej polskiej prozie[cite:1].
- **Twarde parametry oparte na instrukcji** — odpowiedzi serwisowe mogą wykorzystywać AI do ustrukturyzowania wyjaśnienia, ale twarde parametry i szczegóły naprawy muszą pochodzić z instrukcji, a tematy HV wymagają jasnej sekcji bezpieczeństwa[cite:1].
- **Kierowanie na podstawie intencji i słów kluczowych** — demo wykorzystuje dopasowywanie słów kluczowych i wzorców dla naturalnych wariantów, a nie ścisłej, ustalonej listy pytań; tematy dla kierowcy obejmują kamerę cofania, ABS/EPS/TPMS, READY, ładowanie, alerty drzwi/pasa bezpieczeństwa/niskiego akumulatora/frunka/kluczyka, a tematy serwisowe obejmują BCM, HV, OBD/CAN, bezpieczniki/okablowanie, gniazdo ładowania AC, EPS oraz problemy z manetką biegów[cite:1].
- **Granica statycznego demo** — demo HTML i jego przykładowe chipy/kierowanie są demo klienckim, a nie pełnym działającym backendem RAG; modal udostępniania na stronie zapisuje zaproszonych użytkowników i ustawienia dostępu lokalnie, a nie wymusza rzeczywiste uprawnienia po stronie serwera[cite:1].
- **Granica publikacji** — publikacja PONY powinna wykorzystywać przesłany artefakt demo PONY lub dedykowany projekt aplikacji webowej; zrzuty Bridge/Agrowiec są odrębnymi projektami i nie powinny być publikowane jako źródło demo PONY[cite:1].

## References

[cite:1]: pplx://sessions/e41527d9-8823-4a52-9243-8f5a026a9b7a
