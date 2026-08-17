# Design tokens — odtworzenie CSS

## Źródło i zasada

Arkusz CSS jest zminifikowany do jednej linii, dlatego wszystkie przytoczone tokeny mają odwołanie `fe.css:1`. Nie przypisano wartości, której nie ma w tym arkuszu. [fe.css:1]

## Typografia

| Token / użycie | Wartość |
|---|---|
| Sans | `Inter`, z fallbackami `ui-sans-serif`, `system-ui`, `sans-serif`. [fe.css:1] |
| Serif | `Georgia`, `Cambria`, `Times New Roman`, `serif`. [fe.css:1] |
| Mono | `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, `monospace`. [fe.css:1] |
| Import | Arkusz importuje Inter w wagach 400–700 oraz JetBrains Mono. [fe.css:1] |

## Podstawowe tokeny jasnego motywu

| Kategoria | Token CSS | Wartość HSL |
|---|---|---|
| Tło | `--background` | `210 20% 98%`. [fe.css:1] |
| Tekst | `--foreground` | `215 25% 14%`. [fe.css:1] |
| Karta | `--card` / `--card-border` | `0 0% 100%` / `215 16% 90%`. [fe.css:1] |
| Obramowanie | `--border` | `215 16% 88%`. [fe.css:1] |
| Primary | `--primary` / `--primary-foreground` | `35 70% 45%` / `0 0% 100%`. [fe.css:1] |
| Secondary | `--secondary` / `--secondary-foreground` | `215 16% 92%` / `215 25% 20%`. [fe.css:1] |
| Muted | `--muted` / `--muted-foreground` | `215 16% 94%` / `215 14% 42%`. [fe.css:1] |
| Accent | `--accent` / `--accent-foreground` | `35 60% 92%` / `35 70% 25%`. [fe.css:1] |
| Destructive | `--destructive` | `0 75% 45%`. [fe.css:1] |
| Input / ring | `--input` / `--ring` | `215 16% 84%` / `35 70% 45%`. [fe.css:1] |

## Sidebar

| Token | Wartość HSL |
|---|---|
| `--sidebar` | `215 28% 12%`. [fe.css:1] |
| `--sidebar-foreground` | `210 20% 92%`. [fe.css:1] |
| `--sidebar-border` | `215 25% 18%`. [fe.css:1] |
| `--sidebar-primary` / `--sidebar-primary-foreground` | `35 80% 55%` / `215 28% 10%`. [fe.css:1] |
| `--sidebar-accent` / `--sidebar-accent-foreground` | `215 25% 20%` / `210 20% 96%`. [fe.css:1] |

## Akcent — weryfikacja `#D97706`

- W bazowym `fe.css` akcent jest zdefiniowany przez HSL `35 70% 45%` (`--primary`) oraz `35 80% 55%` dla primary sidebara, a nie przez dosłowny literal `#D97706`. [fe.css:1]
- Dosłowny kolor `#d97706` występuje w konfiguracji koloru motywu/favicon HTML; nie jest to potwierdzony token głównego arkusza CSS. [index.html:8; fe.css:1]
- Rekonstrukcja 1:1 powinna używać tokenów HSL z CSS, a nie zastępować ich zbliżonym heksadecymalnym kolorem z briefu. [fe.css:1; fe_doc_brief.md:81-83]

## Promienie, odstępy i kontrolki

| Token | Wartość |
|---|---|
| Zaokrąglenie bazowe | `--radius: 0.5rem`. [fe.css:1] |
| Skala odstępów | `--spacing: 0.25rem`. [fe.css:1] |
| Obramowanie wejść | korzysta z tokenu `--input: 215 16% 84%`. [fe.css:1] |
| Focus | korzysta z tokenu `--ring: 35 70% 45%`. [fe.css:1] |

W arkuszu występują klasy narzędziowe Tailwind, lecz kompletna semantyczna skala komponentów (np. obowiązkowy `gap` dla każdej karty) jest **NIEZNANA** bez przypisania do konkretnego komponentu. [fe.css:1]

## Ciemny motyw

| Token | Wartość HSL w `.dark` |
|---|---|
| `--background` / `--foreground` | `215 30% 8%` / `210 20% 95%`. [fe.css:1] |
| `--card` / `--card-foreground` | `215 28% 11%` / `210 20% 95%`. [fe.css:1] |
| `--popover` / `--popover-foreground` | `215 28% 11%` / `210 20% 95%`. [fe.css:1] |
| `--primary` / foreground | `35 75% 55%` / `215 30% 8%`. [fe.css:1] |
| `--secondary` / foreground | `215 22% 17%` / `210 20% 92%`. [fe.css:1] |
| `--muted` / foreground | `215 22% 16%` / `215 16% 62%`. [fe.css:1] |
| `--accent` / foreground | `35 45% 17%` / `35 80% 65%`. [fe.css:1] |
| `--border` / `--input` | `215 22% 18%` / `215 22% 20%`. [fe.css:1] |
| `--sidebar` | `215 32% 6%`. [fe.css:1] |
| `--sidebar-primary` | `35 80% 58%`. [fe.css:1] |

Tryb ciemny jest sterowany kontrolką w dolnej części sidebara; szczegółowy mechanizm trwałego zapisu preferencji jest **NIEZNANY** w odczytanym fragmencie layoutu. [fe.js:16394-16404; fe.css:1]
