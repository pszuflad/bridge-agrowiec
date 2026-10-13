# Agrorami: bezpieczna podmiana danych produkcji

MO9 pobiera token Magento automatycznie z `AGRORAMI_EMAIL` i `AGRORAMI_PASSWORD`.
Zmiana hasła konta wymaga aktualizacji środowiska backendu, nie ręcznego utrwalania tokenu.
Mechanizm jest dostępny w [akcji Agrorami](https://github.com/pszuflad/bridge-agrowiec/actions/workflows/agrorami-konfiguracja.yml).

## Konfiguracja

- W [GitHub Secrets](https://github.com/pszuflad/bridge-agrowiec/settings/secrets/actions) dodaj `AGRORAMI_PASSWORD`.
- Uruchom akcję z `main`. Konto docelowe jest jawnie ograniczone do `info@agroopony.eu`.
- Wykorzystuje istniejące `PROD_SSH_*`; sekret przekazywany jest jako JSON na stdin szyfrowanego SSH.
- Producent JSON usuwa wyłącznie końcowe CR/LF dodane przy kopiowaniu sekretu.
  Spacje i inne znaki hasła pozostają bez zmian; złamanie linii wewnątrz jest nadal odrzucane.
- Walidator serwera usuwa także puste linie przed hasłem i podaje osobny,
  bezpieczny komunikat dla wielowierszowej wartości, bez wypisywania jej treści.
- Forced command w `deploy-produkcja.sh` rozpoznaje wyłącznie `bridge-konfiguruj-agrorami`.
  Pozostałe polecenia nadal uruchamiają dotychczasowy deploy; nie jest to dowolna powłoka.
- Przed pierwszym użyciem nowy dispatcher i helper muszą znaleźć się w produkcyjnym checkoutcie `repo/`.

## Przebieg i zabezpieczenia

Helper `tools/agrorami-konfiguracja.cjs` wykonuje jeden test `generateCustomerToken`
pod `https://hurtownia.agrorami.pl/graphql` z nagłówkiem `Store: pl`.
Odrzucenie logowania lub błąd sieci kończy operację przed zmianą plików i restartem.
Nie drukuje odpowiedzi API, tokenów ani środowiska PM2.

Po poprawnym logowaniu:

- zachowuje pozostałe ustawienia `.env`, usuwa duplikaty dwóch kluczy Agrorami,
  zapisuje poprawnie cytowane wartości i atomowo podmienia plik;
- tworzy kopię `.env.bak_agrorami_<czas>` z uprawnieniami `0600`;
- wpisuje zmianę bez sekretów do rzeczywistego `bridgeone/_app/CHANGELOG.md`
  (dawny `/home/admin/private_apps/bridge` nie jest obecnym serwerem produkcji);
- restartuje tylko `bridge-backend-prod` z `--update-env` i zapisuje stan PM2,
  żeby nowe dane obowiązywały także po restarcie VPS; przy błędzie restartu
  przywraca poprzedni `.env` i ponawia restart ze starą konfiguracją;
- uruchamia jedną ręczną synchronizację MO9 z istniejącym kontem Anny
  przez lokalny interfejs API; tworzy wewnętrzny token o ważności 15 minut,
  którego nie wypisuje;
- sprawdza aktywny status dostawcy, aktualny `ostatnia_sync` i nowo zapisany
  `agrorami-api.csv` w folderze wskazanym przez `suppliers.url`.

Nie wykonuje buildu, migracji, kroków wdrożenia ani operacji na training.
Synchronizacja MO9 używa zwykłych zabezpieczeń importu; istniejące harmonogramy
Selly nie są zatrzymywane ani rekonfigurowane. Przy nieudanej synchronizacji po
poprawnym logowaniu nowe dane pozostają na serwerze, lecz akcja kończy się błędem.
Nie wolno raportować takiego wyniku jako przywróconej synchronizacji.

GitHub Actions używa tej samej grupy współbieżności co wdrożenie produkcji,
żeby obie operacje nie działały równolegle.

## Testy

`node --test tools/agrorami-konfiguracja.test.cjs`: walidacja wejścia,
zachowanie innych kluczy, usuwanie duplikatów, cytowanie znaków specjalnych,
poprawny nagłówek Store i brak sekretów w błędach.
