# 17-DOCS-instrukcja-testow-i4 — raport

## Podsumowanie

Instrukcja testów manualnych Iteracji 4 (narzuty i promocje) dla Ani, w konwencji
`docs/instrukcja-testow-I3.md`: jedenaście scenariuszy „co zrobić → czego oczekiwać",
dziesięć fałszywych alarmów, lista kontrolna i zasady zgłaszania. Przy pisaniu wyszedł jeden
defekt produkcji, którego wcześniej nikt nie znalazł — opisany w backlogu jako #25.

## Zmiany
- **Nowy:** `docs/instrukcja-testow-I4.md` (375 linii).
- `docs/rebuild-backlog.md` — nowy wpis **#25**.
- `docs/instrukcja-testow-I3.md` — wiersz o narzutach linkuje do instrukcji I4.
- `rebuild/frontend/src/pages/katalog/kolumny.ts` — **sprostowany mylący komentarz** przy
  kolumnie „Promocja": twierdził, że wartość „liczą reguły cenowe z Iteracji 4" i że komórka
  renderuje „—" tylko „do tego czasu". Iteracja 4 jest zamknięta, a komórka renderuje „—"
  ZAWSZE, bo kolumna jest martwa (backlog #22). Komentarz wprowadzałby następną sesję w błąd.
  Zmiana wyłącznie w komentarzu — zero zmian w zachowaniu, bramki czyste.

## ⭐ Znalezisko: promocja „globalna" nie obniża żadnych cen (backlog #25)

Zweryfikowane **pomiarem**, nie lekturą — uruchomieniem `promocjaPasuje` (port `Tb` 1:1):

| Produkt | promocja z `zasieg: "globalny"`, `warunki: "[]"` |
|---|---|
| marka `BKT`, kategoria `Rolnicze` | **`false`** — promocja NIE działa |
| marka `null`, kategoria `null` | `true` |

Checkbox „Reguła globalna" wysyła przy promocji `zasieg: "globalny"`
(`deminified/frontend-index.js:24613`), a dopasowanie przy pustych `warunki` sprawdza, czy
`zasieg` **zawiera** markę albo kategorię produktu (`Tb`, `:9473-9479`). Napis „globalny" nie
zawiera „bkt" ani „rolnicze", więc promocja nie pasuje do niczego poza pozycjami z pustą marką
lub kategorią.

**Sedno:** ostrzeżenie „poniżej kosztu" liczy dopasowanie INNYM kodem (`_matchProd`, backlog
#24), gdzie globalna obejmuje wszystkie produkty. Ania zobaczy więc czerwony pasek o tysiącach
produktów, potwierdzi zapis — i nie zmieni się ani jedna cena. Dwa mechanizmy w tym samym oknie
odpowiadają na to samo pytanie przeciwnie.

Dla narzutów problemu nie ma („globalna" wysyła `typ: "globalny"`, który `narzutPasuje` uznaje
bezwarunkowo). Defekt dotyczy wyłącznie promocji, jest w produkcji i został odtworzony 1:1.
Obejście dla Ani (zawsze ustawiać promocji warunek) opisane w instrukcji §3.7 i §4 pkt 4.

## Co instrukcja pokrywa

Jedenaście scenariuszy, w tym pięć oznaczonych ⭐: symulator jako sprawdzian zgodności
z katalogiem, reguła szczegółowa bijąca globalną, ostrzeżenie przed sprzedażą poniżej kosztu,
wygasła promocja nadal obniżająca ceny, oraz **reguła nadpisująca cenę wpisaną ręcznie
w stagingu** — czyli domknięcie luki z Iteracji 3.

Sekcja „fałszywych alarmów" ma dziesięć pozycji; wszystkie to zachowania odtworzone 1:1,
z których każde wygląda jak usterka: martwa kolumna „Promocja", marża pokazująca procent
narzutu, długi zapis (przeliczanie całego katalogu), promocja globalna z punktu wyżej,
etykieta „zakończona" przy działającej promocji, brak pola priorytetu, brak potwierdzenia
przy usuwaniu.

## Weryfikacja

Każdą liczbę i etykietę sprawdziłem w kodzie, nie z pamięci: teksty przycisków i komunikatów,
nagłówki kolumn katalogu (`cena_sprzedazy`, `marza_pct` — surowe nazwy z bazy), treść znacznika
rozbieżności, próg 50 trafień w symulatorze. Przykład liczbowy w §3.1 (zakup 5562,40 → cena
7252) zgadza się z `contract/fixtures/GET_products.json`.

Bramki frontendu po zmianie komentarza: `lint`, `typecheck` czyste, **278 testów** zielonych.

## Follow-up
1. **#25 — promocja „globalna"** ⬜ do decyzji. Naprawa jest jednolinijkowa, ale zmienia
   zachowanie produkcji: uśpione promocje globalne zaczęłyby nagle obniżać ceny całego
   katalogu. Wymaga sprawdzenia produkcyjnej bazy przed decyzją.
2. **Iteracja 5 (Historia) nie ma instrukcji testów** — dowieziona równolegle ticketem
   `15-FEATURE-historia-zmian`, a `docs/` ma tylko instrukcje I3 i I4. Poza zakresem tego
   ticketa; do rozstrzygnięcia, czy powstaje osobny dokument.
3. `docs/instrukcja-testow-I3.md:395` — wiersz „Widok Historia | Iteracja 5" nadal twierdzi,
   że widoku nie ma. Nietknięte, bo to zakres instrukcji I3, nie I4.
