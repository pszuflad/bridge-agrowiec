# Session cd39f335 (2026-07-20 12:23 UTC) — 1 turns

**Session UUID:** cd39f335-23ee-4683-b08b-8708c2c7d854

1. [2026-07-20 12:23 UTC] [line 9] Scalanie produktów w Bridge

---

## Turn 1 — 2026-07-20 12:23 UTC
### Query
Scalanie produktów w Bridge

### Answer
Scalanie produktów w Bridge opiera się na kanonicznych wartościach atrybutów, mechanizmie pending oraz aliasach; kluczowe jest poprawne działanie panelu „Atrybuty” i „Pending” po ostatniej poprawce aliasów.

Scalanie produktów nie odbywa się bezpośrednio „po CSV”, tylko przez warstwę atrybutów i katalog products.
Każdy produkt ma zestaw pól (m.in. rozmiar, marka, model, indeksy itp.), a scalanie sprowadza się do ujednolicenia tych pól wokół jednej wartości kanonicznej i wskazania aliasów (różnych zapisów tej samej rzeczy).

Mechanizm pending dla atrybutów (widok „Atrybuty” → lista pending) zbiera nowe, niesprawdzone wartości z importów, które trzeba zaakceptować, odrzucić lub zamapować jako alias.
Po akceptacji lub zamapowaniu aliasów aktualne, kanoniczne wartości trafiają do cache atrybutów i są używane przy łączeniu / filtrowaniu produktów oraz przy modalu „Produkty używające atrybutu”.

W aktualnym pliku produkcyjnym panelu (home/admin/domains/agritires.eu/public_html/panel/assets/pending-injection.js) widok „Pending” działa w oparciu o:
endpoint api/atrybuty/pending (GET/DELETE) – pobieranie i czyszczenie listy pending,  
akcje per pozycja: akceptuj, odrzuć, akceptuj z edycją, akceptuj jako alias.

Błąd 400 „Brak kanonicznaWartosc” przy scalaniu bieżników aliasami został już naprawiony poprzez zmianę body POST: z aliasDla: alias na kanonicznaWartosć: alias dla endpointu POST panelapi/atrybuty/pending/:id/akceptuj-jako-alias.
Po tej poprawce kliknięcie w chip aliasu w pending otwiera confirm „Zmapować X jako alias dla Y?” i wysyła prawidłowy JSON, dzięki czemu backend przyjmuje aliasy i przestaje zwracać błąd 400.

Dla wsparcia scalania jest wstrzyknięty modal „Produkty używające atrybutu”, który wywołuje:
GET api/atrybuty/uzycie?rodzaj=...&wartosc=... – zwraca listę produktów i licznik count.
W modalu widać dostawcę, kod, nazwę, markę, rozmiar, stan oraz link do katalogu z prefiltracją po kodzie (sessionStorage.setItem("katalog.prefilter", kod)).

To narzędzie jest kluczowe przy scalaniu: pozwala zobaczyć, które produkty „stracą” lub „odzyskają” spójność po zmianie wartości atrybutu (np. bieżnika) albo po dodaniu aliasu.

Ze względu na to, że bundle React (TanStack Query) trzyma własny cache api/attributes, do scalania potrzebne było nadpisywanie tego cache świeżymi danymi z backendu:
funkcja fixAttributesCache() pobiera api/atrybuty, deduplikuje wartości per (rodzaj, wartość) i wstawia je do QueryClient.
Dodatkowo MutationObserver usuwa duplikaty wpisów w dropdownach (Radix Select) po textContent, dzięki czemu operacje scalania przy wyborze rodzaju/wartości nie gubią się w zduplikowanych opcjach.

Bez tych dwóch warstw (naprawa aliasów + dedupe cache/dropdownów) scalanie produktów byłoby mylące – użytkownik widziałby stare, zduplikowane wartości i aliasy, które backend już dawno skorygował.

Scalanie produktów jest powiązane z buforem stagingitems, gdzie lądują zmiany z CSV przed zatwierdzeniem.
Przy zalegających setkach tysięcy pendingów (opisane w raporcie wydajności) konieczne jest operacyjne czyszczenie staging oraz uporządkowanie procesu zatwierdzania, bo w przeciwnym razie panel scalania (Pending Atrybutów, Staging) stanie się niewydolny.

Do bezpiecznej pracy ze scalaniem produktów zalecane są też indeksy na stagingitems (typZmiany, zatwierdzonoData, dostawca) oraz na products (dostawca, marka, kategoria, rozmiar), aby zapytania używane przez modal „Produkty używające atrybutu” nie robiły pełnych skanów przy większej skali.

Czy chcesz, żebym krok po kroku rozpisał konkretną procedurę scalania bieżników/produktów w panelu (co dokładnie klikać i w jakiej kolejności), czy bardziej interesuje Cię warstwa techniczna – np. jak dodać nowe reguły scalania po stronie backendu?

---
