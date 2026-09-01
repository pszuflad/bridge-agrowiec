/**
 * Trasy-placeholdery wraz z przypisaniem do iteracji, która je wypełni.
 * Iteracja 2 zdjęła stąd `/katalog`, a sesja 3e — `/staging`; oba mają własne komponenty
 * wpięte bezpośrednio w `App.tsx`, więc liczba tras routera nie zmienia się (dalej 12).
 * Tytuły pokrywają się z etykietami sidebara (`components/nawigacja.ts`),
 * opisy pochodzą z celów iteracji w `docs/rebuild-roadmap.md` §5.
 *
 * Razem z `/login` daje to 12 tras routera — tyle, ile ma oryginał
 * (`deminified/frontend-index.js:28644-28677`).
 */
export type OpisPlaceholdera = {
  path: string;
  tytul: string;
  opis: string;
  iteracja: string;
};

export const PLACEHOLDERY: OpisPlaceholdera[] = [
  {
    path: "/",
    tytul: "Pulpit",
    opis: "Kluczowe metryki i najświeższe alerty.",
    iteracja: "Iteracji 10",
  },
  {
    path: "/narzuty",
    tytul: "Narzuty i promocje",
    opis: "Reguły narzutów i promocje przeliczające cenę sprzedaży.",
    iteracja: "Iteracji 4",
  },
  {
    path: "/alerty",
    tytul: "Alerty",
    opis: "Lista alertów i zmiana ich stanu.",
    iteracja: "Iteracji 6",
  },
  {
    path: "/analityka",
    tytul: "Analityka",
    opis: "Dashboardy EAN, cen, dostawców, dostępności i rotacji.",
    iteracja: "Iteracji 10",
  },
  {
    path: "/historia",
    tytul: "Historia",
    opis: "Zmiany cen i stanów pochodzące z importów.",
    iteracja: "Iteracji 5",
  },
  {
    path: "/konfiguracja",
    tytul: "Konfiguracja",
    opis: "Ustawienia panelu, dostawcy i limity spedycji.",
    iteracja: "Iteracji 11",
  },
  {
    path: "/waga-gabarytowa",
    tytul: "Waga gabarytowa",
    opis: "Kalkulator wagi gabarytowej opony.",
    iteracja: "Iteracji 9",
  },
  {
    path: "/atrybuty",
    tytul: "Atrybuty",
    opis: "Rodzaje i wartości atrybutów oraz kolejka pozycji oczekujących.",
    iteracja: "Iteracji 7",
  },
  {
    path: "/moje-konto",
    tytul: "Moje konto",
    opis: "Dane konta i zmiana hasła.",
    iteracja: "Iteracji 12",
  },
];
