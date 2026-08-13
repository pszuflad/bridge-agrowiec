# Prompt do Perplexity — stałe prowadzenie changelogu zmian (przez przeglądarkę)

> Wklej w Space „Budowanie mostu dla Agrowca". Cel: od teraz KAŻDA zmiana
> w aplikacji jest zapisywana do jednego pliku, który my synchronizujemy.

---

Od tej pory chcę, żebyś **przy każdej zmianie wprowadzanej w projekcie Bridge dla
Agrowca** — niezależnie od tego, kto ją zlecił — dopisywał wpis do pliku
`CHANGELOG.md` w katalogu backendu na serwerze
(`/home/admin/private_apps/bridge/CHANGELOG.md`).

Wpis dodawaj **na górze pliku** (najnowsze pierwsze), w formacie:

```
## 2026-08-13 14:30
- obszar: frontend | backend | baza danych
- pliki: <zmienione pliki, np. index-XXXX.js, extensions.cjs, ALTER TABLE products>
- zmiana: <co konkretnie zmieniono>
- powód: <po co, na czyją prośbę, jaki problem rozwiązuje>
```

Zasady:
- **Każda** zmiana: edycja bundla frontendu, edycja modułu backendu, `ALTER TABLE`
  lub inna zmiana schematu, nowy endpoint, zmiana parsera, nowy skrypt migracyjny.
- Jeśli robisz kopię `.bak` przed zmianą (jak dotychczas) — w changelogu podaj
  nazwę kopii, żeby dało się ją powiązać z wpisem.
- Zmiany schematu bazy opisuj precyzyjnie: nazwa tabeli/kolumny, typ, czy dane
  były migrowane.
- Nie wpisuj żadnych sekretów.
- Jeśli w jednej sesji robisz wiele zmian — jeden wpis zbiorczy z listą jest OK,
  ale musi wymieniać wszystkie pliki i wszystkie zmiany schematu.

Potwierdź, że od teraz będziesz to robił automatycznie, i pokaż pierwszy wpis
dla ostatniej zmiany, którą wykonałeś.
