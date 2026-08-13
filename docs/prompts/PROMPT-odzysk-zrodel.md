# Prompt do Perplexity — odzysk źródeł Bridge

> Skopiuj wszystko poniżej linii i wklej do Perplexity (do tego samego konta /
> Space, w którym powstawał Bridge). Jeśli masz dostęp do trybu z komputerem
> i do VPS-a — użyj go, bo większość pytań wymaga sprawdzenia plików.

---

Pracowałeś ze mną nad projektem **Bridge dla Agrowca** (panel.agritires.eu,
backend Node/Express/SQLite pod `/home/admin/private_apps/bridge/`, frontend
React+Vite). Robiliśmy to razem od czerwca do lipca 2026.

Zrobiłem audyt tego, co mam lokalnie, i wyszło, że **nie mam kodu źródłowego ani
backendu, ani frontendu** — mam wyłącznie zminifikowane bundle bez source map:

- `index.cjs` — bundle esbuild, 1,48 MB, zminifikowany (i **cztery różne
  warianty** tego pliku o różnych sumach MD5)
- `assets/index-*.js` — bundle Vite, 542 KB, pełna minifikacja, zero nazw
- brak `.map`, brak `src/`, brak `vite.config`, brak `tsconfig`, brak repo Git

Chcę odbudować oba projekty tak, żeby dało się je normalnie rozwijać. **Zanim
zacznę przepisywać od zera, muszę wyczerpać wszystkie ścieżki odzyskania źródeł.**

Potrzebuję konkretnych, sprawdzonych odpowiedzi — **nie przypuszczeń**. Przy
każdym punkcie podaj dowód: wynik polecenia, ścieżkę pliku, link do Space albo
jednoznaczne „sprawdziłem, nie ma".

---

## A. Źródła frontendu — najwyższy priorytet

To jest dla mnie najważniejsze. Bez źródeł frontendu muszę napisać cały panel od
nowa (11 widoków), więc każda znaleziona rzecz to realne tygodnie pracy.

1. Czy gdziekolwiek istnieje drzewo źródeł klienta: `client/src/`, `src/`,
   pliki `.tsx`, `vite.config.ts`, `tsconfig.json`, `components.json` (shadcn),
   `tailwind.config.*`, główny `package.json` ze skryptem `build`?
2. Sprawdź na VPS, łącznie z miejscami roboczymi i tymczasowymi:

```bash
find / -xdev \( -name node_modules -o -name .cache -o -name .npm \) -prune -o \
  \( -name 'vite.config.*' -o -name 'tsconfig*.json' -o -name 'components.json' \
     -o -name 'tailwind.config.*' -o -name 'drizzle.config.*' \
     -o -name '*.tsx' -o -name 'schema.ts' -o -name 'storage.ts' \) -print 2>/dev/null

find / -xdev -name '*.map' 2>/dev/null
find /home /root /tmp /opt /var /srv -maxdepth 6 -type d \
  \( -name src -o -name client -o -name shared -o -name server \) 2>/dev/null
find / -xdev -type d -name '.git' 2>/dev/null
ls -la /home/admin/private_apps/ /home/admin/ /root/ /tmp/ 2>/dev/null
```

3. Czy w `/home/admin/private_apps/bridge/backups/` albo innym katalogu backupów
   jest cokolwiek poza kopiami `data.db`?
4. W jednej z naszych sesji był wątek o **edycjach bundla w `/tmp`** — czy
   z tamtych prac zostały jakieś pliki robocze?

## B. Źródła backendu

5. Czy istnieje `server/`, `shared/schema.ts`, `drizzle.config.ts` albo inny
   plik z **deklaracją schematu Drizzle**? Odtworzyłem schemat z bazy
   produkcyjnej (26 tabel, `products` ma 71 kolumn), ale wolałbym oryginał.
6. Mam cztery różne warianty `index.cjs`:

| Plik | Rozmiar | Data |
|---|---|---|
| `backend/index.cjs` | 1 483 626 B | 2026-07-21 |
| `backend/index.cjs.before_v6` | 1 448 951 B | 2026-06-10 |
| `backend/index.cjs.v6_routesorder_bad` | 1 449 110 B | 2026-06-10 |
| `frontend/dist/index.cjs` | 1 447 803 B | 2026-06-01 |

**Który jest kanoniczny i czym się różnią?** Który odpowiada aktualnej produkcji?

7. Jakim **poleceniem budowany był projekt** (`npm run build`? esbuild + vite?)
   i jak wyglądał układ katalogów w oryginale (`client/`, `server/`, `shared/`)?

## C. Gdzie ten projekt powstał

8. Układ `dist/index.cjs` + `dist/public/`, stos React + wouter + Radix/shadcn +
   Drizzle + Vite oraz brak `.gitignore` wyglądają na projekt generowany na
   **Replit**. Czy Bridge powstał na Replicie? Jeśli tak — **na jakim koncie
   i pod jaką nazwą projektu**? Czy repl nadal istnieje?
9. W sesji `4e85993b` przenosiłeś „current Bridge production code snapshot into
   Space". **Który to Space i co dokładnie tam trafiło?** Czy są tam pliki
   źródłowe, czy tylko ten sam zminifikowany bundle?
10. W sesji `9dccf618` był wątek o **repozytorium GitHub** dla Bridge. Czy takie
    repo powstało? Jeśli tak — jaki jest adres i czy zawiera źródła, czy bundle?
11. Czy gdziekolwiek jest kopia projektu w Codex, innym Space, na dysku Google
    albo w archiwum ZIP?

## D. `Instrukcja_obslugi_Bridge.docx`

12. W wiki opisujesz ten plik jako **specyfikację UI** Bridge'a. **Nie mam go.**
    Gdzie jest? Prześlij go, a jeśli nie możesz — **przepisz jego treść**.
13. Jeśli plik istnieje: zamień go na specyfikację w Markdownie, gdzie dla
    każdego z 11 widoków opisane są sekcje **widok / dane / akcje / API /
    komponenty**. Widoki: `/`, `/login`, `/katalog`, `/staging`, `/narzuty`,
    `/alerty`, `/historia`, `/konfiguracja`, `/atrybuty`, `/moje-konto`,
    `/waga-gabarytowa`. (Sam zaproponowałeś taki format w sesji `9dccf618` —
    proszę, zrób to teraz.)

## E. Eksport historii sesji

14. Potrzebuję **pełnych transkryptów** naszych sesji o Bridge — zawierają kod,
    który wklejaliśmy w trakcie pracy, i uzasadnienia decyzji. Jak mogę je
    wyeksportować w całości (nie streszczenia)?
15. Oto 28 sesji zacytowanych w wiki jako źródła dla Bridge / Selly / Agrorami:

```
03b127b5-e704-4bd6-8b5b-53a6de402c7d   9ce5db47-00c0-4948-8c64-fe4cb813de08
0c08d699-112b-4d19-8c6c-5665cd38c538   9dccf618-7b25-41e3-bf0b-5e3a56a6a573
0efb554c-6e95-41af-8605-77ca80dcc897   b605555a-6ca0-46fc-a498-2469a31d059b
0f9f758c-5333-41e3-8556-6d245cfa060b   b7b532ad-dc91-4b84-828d-50e4fb361ca5
12d4afdd-feb3-4848-af89-20f8fdc9450a   bdf85296-5573-426a-9e1a-0e7d9d05a7c4
3c6bec96-3215-407a-98bb-01cbe68cf9ee   c1cbe13a-311a-4ba3-aab3-98d5c6460f91
4a63f119-a015-462d-b0ac-0cbd959d8928   d162a179-f200-4bf6-b525-d628131c4fd6
7d346558-418b-4ddb-ab2d-1f3fbb3458e8   d38f64ee-4416-45d1-85cf-7886b813cb8c
833252da-640c-4bbf-bb51-0bcea9d7109b   d8b84c0c-2187-4f67-8323-9682c1e1c7bf
92f95de1-1229-451f-8b25-d99dfd1d56d0   dd872d44-acce-4de2-afcc-f96a381ef7e5
975c279b-8574-449d-a6bb-11d2d4729730   df130657-4178-499c-b453-747f629e0305
98740ed1-15cc-4eb1-8c60-da5361a00b16   ee48724e-1407-4653-bfc8-781188e58fc9
                                       f83616b5-5c51-4c6e-8873-4ef2493323d6
                                       f99ad55a-0b84-4812-a3af-113c0e4a075d
                                       fc2830c5-1fb5-44f7-8294-1854dfef123c
                                       fe37f8b5-bc2e-46c0-a334-12f7e57f0d7d
```

Szczególnie ważne: **`9dccf618`** (architektura + brak źródeł frontendu + rola
docx), **`25b82b1e`** (audyt stacku, brak repo Git), **`4e85993b`** (snapshot
kodu do Space), **`0c08d699`** (architektura SQLite + brak źródeł frontendu).

16. Czy któraś z tych sesji zawiera **wklejone pliki źródłowe** frontendu
    (`.tsx`, `vite.config`, `tsconfig`)? Jeśli tak — wypisz które i wyciągnij
    z nich zawartość.

---

## Jak chcę dostać odpowiedź

Najpierw **tabela zbiorcza**, potem szczegóły:

| # | Czego szukam | Znalezione? | Gdzie / dowód |
|---|---|---|---|
| A | źródła frontendu (`src/`, `.tsx`, vite/ts config) | tak / nie | |
| B | źródła backendu (`server/`, `shared/schema.ts`) | tak / nie | |
| C | projekt na Replicie / w Space / na GitHubie | tak / nie | |
| D | `Instrukcja_obslugi_Bridge.docx` | tak / nie | |
| E | eksport pełnych transkryptów sesji | tak / nie | |

Zasady:

- **Nie zgaduj.** „Nie sprawdziłem" jest lepszą odpowiedzią niż „prawdopodobnie
  nie ma". Przy każdym „nie" napisz, gdzie konkretnie sprawdzałeś.
- **Nie wklejaj sekretów** — treści `.env`, `JWT_SECRET`, haseł Agrorami,
  `SELLY_CLIENT_SECRET`, kluczy SSH. Podaj tylko nazwy zmiennych i ścieżki.
- Jeśli znajdziesz źródła, **spakuj je do ZIP-a i daj mi do pobrania**; jeśli
  nie możesz — wypisz pełne drzewo katalogów i zawartość plików konfiguracyjnych.
- Jeśli źródeł nie ma **nigdzie**, powiedz to wprost i przejdź do punktu D13 —
  specyfikacja UI staje się wtedy najważniejszym produktem tej rozmowy.
