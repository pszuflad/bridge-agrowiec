---
id: projects/facebook-commenting-bot-v2
item_type: wiki_page
semantic_type: project
title: Facebook Commenting Bot v2
description: Facebook Commenting Bot v2 to plan przebudowy własnego produktu subskrypcyjnego Anny Naumowicz do obsługi komentowania grup na Facebooku. Celem jest zastąpienie osobnych botów klientów wspólnym silnikiem z konfiguracją per klient oraz ogran...
created_at: '2026-08-06T07:51:00+00:00'
updated_at: '2026-08-06T07:51:00+00:00'
language: pl
---
# Facebook Commenting Bot v2

Facebook Commenting Bot v2 to plan przebudowy własnego produktu subskrypcyjnego Anny Naumowicz do obsługi komentowania grup na Facebooku. Celem jest zastąpienie osobnych botów klientów wspólnym silnikiem z konfiguracją per klient oraz ograniczenie zależności od ręcznie nadzorowanej przeglądarki[cite:1].

## Jak to działa

Projekt rozdziela procedury biznesowe, warstwę agenta i sterowanie przeglądarką. Planowany przebieg wdrożenia zaczyna się od lokalnego pilota, a dopiero później przechodzi do wspólnego środowiska i nowych kanałów[cite:1].

- **Wspólny silnik zamiast osobnych kodów klientów** — reguły marki i kwalifikacji mają być konfiguracją, a nie kopiowanym wdrożeniem. Ułatwia to utrzymanie i wdrażanie poprawek dla całej usługi[cite:1].
- **Procedury → agent → przeglądarka** — logika kwalifikacji i raportowania pozostaje oddzielona od wykonania akcji w przeglądarce. Dzięki temu zmiana narzędzia sterującego nie wymaga przepisywania zasad biznesowych[cite:1].
- **Przebudowa etapowa** — architektura zakłada najpierw pilota lokalnego, następnie migrację klientów i dopiero później funkcje takie jak dodatkowe kanały lub komentarze graficzne[cite:1].

## See also

- [[projects/facebook-commenting-operations]] — obecne procedury operacyjne

## References

[cite:1]: https://github.com/Devilian07/BOT
