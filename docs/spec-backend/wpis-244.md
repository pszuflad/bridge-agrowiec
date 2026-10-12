# Wpis 244 — tabele GEIS w panelu

`GET /api/partnerzy/geis` → `{kraje:[{kraj, wspGabarytowy, kosztPakowania, maks, stawki:[[prog,stawka]]}]}`; `PUT /api/partnerzy/geis/:kraj` zastępuje tabelę kraju (walidacja jak `importujTabeleGeis`); `POST /api/partnerzy/geis/import` (multipart, pole `plik`, .xlsx) parsuje arkusze po polskich nazwach krajów. Koszt przesyłki (GEIS) = stawka × (1 + paliwo %) + pakowanie z tabeli + myto i pakowanie kraju partnera. Stała „Przesyłka bazowa EUR” kraju nadal NADPISUJE tabelę.
