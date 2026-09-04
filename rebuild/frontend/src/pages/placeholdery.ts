/**
 * Trasy-placeholdery wraz z przypisaniem do iteracji, która je wypełni.
 * Iteracja 2 zdjęła stąd `/katalog`, sesja 3e — `/staging`, sesja 3f-1 — `/konfiguracja`,
 * Iteracja 5 — `/historia`, sesja 4b — `/narzuty`, Iteracja 6 — `/alerty`, Iteracja 9 —
 * `/waga-gabarytowa`, blok 10a — `/analityka`, blok 10f — `/` (Pulpit, ostatni placeholder
 * Iteracji 10), a sesja 7b — `/atrybuty`; każda z nich ma własny komponent wpięty bezpośrednio
 * w `App.tsx`, więc zdejmowanie placeholderów samo w sobie nie zmienia liczby tras routera.
 *
 * Został JEDEN placeholder: `/moje-konto` (Iteracja 12).
 *
 * Tytuły pokrywają się z etykietami sidebara (`components/nawigacja.ts`),
 * opisy pochodzą z celów iteracji w `docs/rebuild-roadmap.md` §5.
 *
 * Razem z `/login` daje to 13 tras routera. Oryginał ma ich 12
 * (`deminified/frontend-index.js:28644-28677`) — różnicę robi `/selly`, dołożona
 * w sesji 8b. W produkcji Selly NIE BYŁO trasą Reacta: wstrzykiwany
 * `mirror/frontend/assets/selly-injection.js` trzymał adres na `#/` i overlayował
 * `<main>`, a stan „jesteśmy w Selly" siedział w `sessionStorage.sellyViewActive`.
 * Odbudowa zamienia to na zwykłą trasę Wouter (odstępstwo O1,
 * `docs/tickets/30-FEATURE-selly-panel-frontend/plan.md`), więc 13 jest liczbą poprawną,
 * a nie rozjazdem do naprawienia.
 */
export type OpisPlaceholdera = {
  path: string;
  tytul: string;
  opis: string;
  iteracja: string;
};

export const PLACEHOLDERY: OpisPlaceholdera[] = [
  {
    path: "/moje-konto",
    tytul: "Moje konto",
    opis: "Dane konta i zmiana hasła.",
    iteracja: "Iteracji 12",
  },
];
