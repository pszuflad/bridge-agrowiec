/**
 * Widok `/katalog` — odtworzenie `AT()` z oryginału
 * (`deminified/frontend-index.js:23191-23830`).
 *
 * ⚠ KLUCZOWA DECYZJA ARCHITEKTONICZNA (plan.md D2), świadomie odtworzona 1:1:
 * ten ekran pobiera CAŁĄ tabelę produktów jednym żądaniem `["/api/products"]` — bez
 * `limit`, bez `offset` — i robi u siebie wszystko: filtry, szukajkę, sortowanie,
 * paginację i wirtualizację. Backend `GET /api/products` nie obsługuje żadnego z tych
 * parametrów (poza `dostawca`), więc paginacja serwerowa byłaby ZMIANĄ zachowania,
 * nie usprawnieniem. Koszt transportu (zmierzone 10,0 MB JSON dla 7 405 produktów ze
 * snapshotu produkcji) zdejmuje kompresja włączona po stronie backendu
 * (`rebuild/backend/src/app.ts`) — po gzipie 0,84 MB, czyli 12× mniej.
 *
 * **Zapis dowieziony w sesji 12c** (`37-FEATURE-katalog-edycja-produktu`): menu „Akcje"
 * w wierszu (Edytuj / Historia `disabled` / Wstrzymaj-Aktywuj / Usuń) plus dialog edycji
 * (`DialogEdycjiProduktu`, port `LT()`), wołające trasy mutacji z sesji 12a. Tym samym
 * zniknęło odstępstwo D4 Iteracji 2 — modal podglądu read-only, który stał w miejscu
 * dialogu edycji. Słowniki z `GET /api/atrybuty` zaciąga widok od 7c.
 *
 * **Eksport CSV dowieziony w sesji 8b** (`30-FEATURE-selly-panel-frontend`): przycisk
 * obok konfiguratora kolumn, logika w `katalog/eksport.ts`, konfiguracja czytana
 * defensywnie z `GET /api/config`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KLUCZ_KOLUMN_KATALOGU, odczytajKV, zapiszKV } from "@/lib/magazynKV";
import { pobierzSlownik, type OdpowiedzSlownika } from "@/pages/atrybuty/api";
import { KLUCZ_KONFIGURACJI, type Konfiguracja } from "./konfiguracja/config";
import {
  listaKategorii,
  listaMarek,
  zastosujFiltry,
  type KierunekSortowania,
  type Produkt,
  type TrybStatusu,
} from "./katalog/filtrowanie";
import {
  dataDoNazwyPliku,
  KOLUMNY_SHOPER,
  odsiejDoEksportu,
  parsujKolumnyShoper,
  pobierzPlik,
  SEPARATOR_DOMYSLNY,
  zbudujCsv,
} from "./katalog/eksport";
import { usunProdukt, zapiszProdukt } from "./katalog/api";
import { DialogEdycjiProduktu } from "./katalog/DialogEdycjiProduktu";
import { KonfiguratorKolumn } from "./katalog/KonfiguratorKolumn";
import { KOLUMNY, KOLUMNY_DOMYSLNE, uzupelnijKodImportu } from "./katalog/kolumny";
import { przeciwnyStatus } from "./katalog/MenuAkcji";
import { TabelaProduktow } from "./katalog/TabelaProduktow";
import { WyborWielokrotny } from "./katalog/WyborWielokrotny";

/** Kształt pozycji z `GET /api/suppliers` (contract/fixtures/GET_suppliers.json). */
type Dostawca = {
  kod: string;
  nazwa: string;
  email: string | null;
  formatPliku: string;
  status: string;
};

/** Rozmiary strony z oryginału (frontend-index.js:23839-23870); domyślnie 25. */
const ROZMIARY_STRONY = [25, 50, 100] as const;

const OPCJE_STATUSU: { wartosc: TrybStatusu; etykieta: string }[] = [
  { wartosc: "all", etykieta: "Wszystkie" },
  { wartosc: "dostepne", etykieta: "Dostępne (stan > 0)" },
  { wartosc: "aktywny", etykieta: "Aktywny" },
  { wartosc: "wstrzymany", etykieta: "Wstrzymany" },
  { wartosc: "brak_ean", etykieta: "Brak EANu" },
];

export function Katalog() {
  const { data: produkty = [], isLoading } = useQuery<Produkt[]>({
    queryKey: ["/api/products"],
  });
  const { data: dostawcy = [] } = useQuery<Dostawca[]>({ queryKey: ["/api/suppliers"] });
  // Konfiguracja czytana DEFENSYWNIE: produkcja nie ma ani `shoper.kolumny`, ani
  // `shoper.separator` (`contract/fixtures/GET_config.json`), więc brak wartości to
  // normalny stan, a nie awaria — wpadamy wtedy w fallbacki `TT` i `";"`.
  const { data: konfiguracja = {} } = useQuery<Konfiguracja>({ queryKey: KLUCZ_KONFIGURACJI });
  const { toast } = useToast();
  const klient = useQueryClient();
  /**
   * Słownik atrybutów zasila listy filtrów marek i kategorii — port `:23285-23287`
   * (sesja 7c, domknięcie degradacji D3 z I2). Klucz i `queryFn` są WSPÓLNE z widokiem
   * `/atrybuty` i z dialogiem reguł, więc CRUD słownika odświeża wszystkie trzy miejsca
   * jednym `invalidateQueries`.
   *
   * ⚠ To JEDYNE zapytanie w tym pliku z własnym `queryFn`: `pobierzSlownik` RZUCA na 401,
   * podczas gdy domyślny `queryFn` (`/api/products`, `/api/config`) oddaje wtedy `null`.
   * Różnica jest celowa — wspólny klucz musi mieć jeden loader, inaczej o zachowaniu
   * decydowałaby kolejność montowania widoków. Dla filtrów skutek jest ten sam: brak danych
   * degraduje listy do samych produktów.
   */
  const { data: slownik } = useQuery<OdpowiedzSlownika>({
    queryKey: ["/api/atrybuty"],
    queryFn: pobierzSlownik,
  });
  // `?? []` tworzyłoby nową tablicę przy każdym renderze i zabijało memoizację list niżej.
  const wartosciSlownika = useMemo(() => slownik?.wartosci ?? [], [slownik]);

  const [zakladka, setZakladka] = useState("all");
  const [fraza, setFraza] = useState("");
  const [marki, setMarki] = useState<Set<string>>(() => new Set());
  const [kategorie, setKategorie] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<TrybStatusu>("all");
  const [sortKolumna, setSortKolumna] = useState("");
  const [sortKierunek, setSortKierunek] = useState<KierunekSortowania>("asc");
  const [strona, setStrona] = useState(0);
  const [rozmiarStrony, setRozmiarStrony] = useState<number>(25);
  const [edytowany, setEdytowany] = useState<Produkt | null>(null);
  const [doUsuniecia, setDoUsuniecia] = useState<Produkt | null>(null);

  /**
   * Klucze unieważniane po KAŻDEJ mutacji produktu.
   *
   * ⚠ `["/api/products"]` to KOMPLET tego, co robi oryginał — `Og` i `jb` wołają
   * `Uo("/api/products")` i nic więcej (`frontend-index.js:9149,9152`). Świadomie NIE
   * dokładamy `["/api/alerts"]` ani `["/api/analytics"]`: `/alerty` w ogóle nie czyta
   * `/api/products` (backlog #26), więc taka invalidacja byłaby pustym żądaniem.
   *
   * ⚠ `["/api/history"]` to ODSTĘPSTWO ŚWIADOME (plan.md 12c, D2), a nie przeoczenie.
   * Oryginał odświeżał historię po edycji, ale robił to `Yb()` (`:10290`) — lokalnym
   * dziennikiem w IndexedDB nadpisującym cache przez `setQueryData`, bez żadnego API.
   * Od 12a wpis `history` pisze NAPRAWDĘ backend, w handlerze `PATCH`/`DELETE`. Portu
   * `Yb` zaniechaliśmy (drugie, konkurencyjne źródło historii — wzorzec odrzucony już
   * w I6/D3), a nasz klient ma `staleTime: Infinity`, więc bez tej invalidacji
   * `/historia` kłamałaby aż do przeładowania strony — czyli gorzej niż produkcja.
   */
  function odswiezPoMutacji(): void {
    void klient.invalidateQueries({ queryKey: ["/api/products"] });
    void klient.invalidateQueries({ queryKey: ["/api/history"] });
  }

  /** Toast po udanej edycji i po przełączeniu statusu — dosłownie z `:23899` / `:23800`. */
  function toastProduktu(tytul: string, produkt: Produkt): void {
    toast({ title: tytul, description: `${produkt.kod} — ${produkt.nazwa.slice(0, 40)}` });
  }

  const edycja = useMutation<Produkt, Error, { produkt: Produkt; zmiany: Record<string, unknown> }>(
    {
      mutationFn: ({ produkt, zmiany }) => zapiszProdukt(produkt.id, zmiany),
      onSettled: odswiezPoMutacji,
      onSuccess: (zapisany) => {
        setEdytowany(null);
        toastProduktu("Zapisano zmiany", zapisany);
      },
      onError: (e) =>
        toast({ title: "Nie udało się zapisać", description: e.message, variant: "destructive" }),
    },
  );

  const przelaczenie = useMutation<Produkt, Error, Produkt>({
    mutationFn: (produkt) => zapiszProdukt(produkt.id, { status: przeciwnyStatus(produkt.status) }),
    onSettled: odswiezPoMutacji,
    onSuccess: (zapisany, produkt) => {
      // Tytuł opisuje SKUTEK, więc czyta status docelowy, a nie ten sprzed zapisu (`:23799`).
      const docelowy = przeciwnyStatus(produkt.status);
      toastProduktu(docelowy === "wstrzymany" ? "Wstrzymano" : "Aktywowano", zapisany);
    },
    onError: (e) =>
      toast({
        title: "Nie udało się zmienić statusu",
        description: e.message,
        variant: "destructive",
      }),
  });

  const kasowanie = useMutation<void, Error, Produkt>({
    mutationFn: (produkt) => usunProdukt(produkt.id),
    onSettled: odswiezPoMutacji,
    onSuccess: (_wynik, produkt) => {
      setDoUsuniecia(null);
      // Jedyny toast bez nazwy — oryginał podaje sam kod (`:23808`), bo produktu już nie ma.
      toast({ title: "Usunięto produkt", description: produkt.kod });
    },
    onError: (e) =>
      toast({ title: "Nie udało się usunąć", description: e.message, variant: "destructive" }),
  });

  // Wybór kolumn: start z domyślnych, potem podmiana tym, co leży w IndexedDB
  // (frontend-index.js:23195-23212). `zaladowano` chroni przed nadpisaniem wyboru
  // użytkownika, gdyby odczyt z bazy dojechał później niż pierwsza zmiana.
  const [kolumnyWybrane, setKolumnyWybrane] = useState<Set<string>>(
    () => new Set(KOLUMNY_DOMYSLNE),
  );
  const [zaladowanoKolumny, setZaladowanoKolumny] = useState(false);

  useEffect(() => {
    let aktualne = true;
    void odczytajKV<string[]>(KLUCZ_KOLUMN_KATALOGU).then((zapisane) => {
      if (aktualne && Array.isArray(zapisane) && zapisane.length > 0) {
        setKolumnyWybrane(new Set(uzupelnijKodImportu(zapisane)));
      }
      if (aktualne) setZaladowanoKolumny(true);
    });
    return () => {
      aktualne = false;
    };
  }, []);

  const zmienKolumny = (nowe: Set<string>): void => {
    setKolumnyWybrane(nowe);
    if (zaladowanoKolumny) void zapiszKV(KLUCZ_KOLUMN_KATALOGU, Array.from(nowe));
  };

  // Pusty wybór = pokazujemy zestaw domyślny (frontend-index.js:23277).
  const kolumnyWidoczne = useMemo(() => {
    const klucze = kolumnyWybrane.size === 0 ? new Set(KOLUMNY_DOMYSLNE) : kolumnyWybrane;
    return KOLUMNY.filter((kolumna) => klucze.has(kolumna.key));
  }, [kolumnyWybrane]);

  const licznikiDostawcow = useMemo(() => {
    const liczniki = new Map<string, number>();
    for (const produkt of produkty) {
      liczniki.set(produkt.dostawca, (liczniki.get(produkt.dostawca) ?? 0) + 1);
    }
    return liczniki;
  }, [produkty]);

  // Sortowanie zakładek po liczbie w kodzie dostawcy: MO1, MO2, …, MO10
  // (frontend-index.js:23283) — zwykły sort tekstowy dałby MO1, MO10, MO2.
  const dostawcyPosortowani = useMemo(
    () =>
      [...dostawcy].sort(
        (a, b) =>
          (parseInt(a.kod.replace(/\D/g, ""), 10) || 0) -
          (parseInt(b.kod.replace(/\D/g, ""), 10) || 0),
      ),
    [dostawcy],
  );

  const wZakladce = useMemo(
    () => (zakladka === "all" ? produkty : produkty.filter((p) => p.dostawca === zakladka)),
    [produkty, zakladka],
  );

  const marki_ = useMemo(
    () => listaMarek(wZakladce, wartosciSlownika),
    [wZakladce, wartosciSlownika],
  );
  const kategorie_ = useMemo(
    () => listaKategorii(wZakladce, wartosciSlownika),
    [wZakladce, wartosciSlownika],
  );

  const odfiltrowane = useMemo(
    () => zastosujFiltry(wZakladce, { fraza, marki, kategorie, status, sortKolumna, sortKierunek }),
    [wZakladce, fraza, marki, kategorie, status, sortKolumna, sortKierunek],
  );

  const liczbaStron = Math.ceil(odfiltrowane.length / rozmiarStrony);
  const naStronie = odfiltrowane.slice(strona * rozmiarStrony, (strona + 1) * rozmiarStrony);

  const przelaczSortowanie = (klucz: string): void => {
    if (sortKolumna === klucz) setSortKierunek((k) => (k === "asc" ? "desc" : "asc"));
    else {
      setSortKolumna(klucz);
      setSortKierunek("asc");
    }
  };

  /**
   * Eksport CSV — port 1:1 z `frontend-index.js:23384-23422`.
   *
   * ⚠ PRIORYTET ŹRÓDŁA KOLUMN, w tej kolejności:
   *   1. wybór użytkownika z konfiguratora (`kolumnyWybrane`) — gdy NIEPUSTY,
   *   2. `shoper.kolumny` z `/api/config` — gdy wybór pusty,
   *   3. `KOLUMNY_SHOPER` (`TT`) — gdy w konfiguracji nic nie ma.
   *
   * ⚠ Separator z konfiguracji obowiązuje TYLKO w gałęzi Shoperowej. Przy wybranych
   * kolumnach jest WYMUSZONY na `";"` i konfiguracja jest ignorowana (:23404) — to nie
   * jest pomyłka oryginału, tylko jego zachowanie.
   *
   * ⚠ Ponieważ `kolumnyWybrane` startuje z 15 kolumn domyślnych, gałąź Shoperowa jest
   * osiągalna dopiero po odznaczeniu WSZYSTKICH kolumn w konfiguratorze. Szerzej:
   * nagłówek `katalog/eksport.ts`.
   *
   * ⚠ Historii NIE zapisujemy. Oryginał woła `Xb()` (:10305), ale to wyłącznie
   * optymistyczny `setQueryData(["/api/history"])`, bez żądania do serwera; odbudowa
   * świadomie nie ma tego kanału (decyzja D3 bloku 10f).
   */
  const eksportujCsv = (): void => {
    const data = dataDoNazwyPliku();
    const doEksportu = odsiejDoEksportu(wZakladce);

    if (doEksportu.length === 0) {
      toast({
        title: "Brak produktów do eksportu",
        description:
          zakladka === "all" ? "Katalog jest pusty" : `Dostawca ${zakladka} nie ma produktów`,
        variant: "destructive",
      });
      return;
    }

    const separatorKonfiguracji = konfiguracja["shoper.separator"] || SEPARATOR_DOMYSLNY;
    const kolumnyKonfiguracji = konfiguracja["shoper.kolumny"]
      ? parsujKolumnyShoper(konfiguracja["shoper.kolumny"])
      : KOLUMNY_SHOPER;

    const bezWyboru = kolumnyWybrane.size === 0;
    const kolumny = bezWyboru
      ? kolumnyKonfiguracji
      : KOLUMNY.filter((kolumna) => kolumnyWybrane.has(kolumna.key));
    const separator = bezWyboru ? separatorKonfiguracji : SEPARATOR_DOMYSLNY;

    const tresc = zbudujCsv(doEksportu, kolumny, separator);
    const kodDostawcy = zakladka === "all" ? "wszyscy" : zakladka;
    const nazwa = bezWyboru
      ? `shoper_${kodDostawcy}_${data}.csv`
      : `katalog_${kodDostawcy}_wybrane_${data}.csv`;

    pobierzPlik(nazwa, tresc);
    toast({
      title: "Eksport gotowy",
      description: bezWyboru
        ? `${doEksportu.length} produktów (format Shoper) → ${nazwa}`
        : `${doEksportu.length} produktów, ${kolumny.length} kolumn → ${nazwa}`,
    });
  };

  /** Trzy warianty etykiety — `frontend-index.js:23421`. */
  const etykietaEksportu =
    kolumnyWybrane.size === 0
      ? zakladka === "all"
        ? "Pobierz CSV (Shoper)"
        : "Pobierz CSV dla Shopera"
      : `Pobierz CSV (${kolumnyWybrane.size} kol.)`;

  const wybranyDostawca =
    zakladka === "all" ? null : (dostawcyPosortowani.find((d) => d.kod === zakladka) ?? null);
  const podtytul =
    zakladka === "all"
      ? `${produkty.length} pozycji w bazie · scal danych z ${dostawcyPosortowani.length} dostawców`
      : wybranyDostawca
        ? `${wybranyDostawca.nazwa} · ${wybranyDostawca.email || "—"} · format ${(wybranyDostawca.formatPliku || "").toUpperCase()}`
        : `Dostawca ${zakladka}`;

  return (
    <div className="p-6 max-w-full">
      <PageHeader
        title="Katalog produktów"
        subtitle={podtytul}
        actions={
          <div className="flex gap-2">
            <KonfiguratorKolumn wybrane={kolumnyWybrane} onZmiana={zmienKolumny} />
            <Button onClick={eksportujCsv} data-testid="button-export-katalog">
              <Download className="mr-2 h-4 w-4" />
              {etykietaEksportu}
            </Button>
          </div>
        }
      />

      <Tabs
        value={zakladka}
        onValueChange={(nowa) => {
          setZakladka(nowa);
          setStrona(0);
          setMarki(new Set());
          setKategorie(new Set());
        }}
        className="mb-4"
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
          <TabsTrigger
            value="all"
            data-testid="tab-supplier-all"
            className="data-[state=active]:bg-background"
          >
            <span className="font-medium">Wszyscy</span>
            <Badge variant="secondary" className="font-mono text-[10px] h-5 ml-2">
              {produkty.length}
            </Badge>
          </TabsTrigger>
          {dostawcyPosortowani.map((dostawca) => (
            <TabsTrigger
              key={dostawca.kod}
              value={dostawca.kod}
              data-testid={`tab-supplier-${dostawca.kod}`}
              className="data-[state=active]:bg-background gap-2"
              title={`${dostawca.nazwa} (${dostawca.email ?? ""})`}
            >
              <span className="font-mono font-semibold">{dostawca.kod}</span>
              <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[120px]">
                {dostawca.nazwa}
              </span>
              {dostawca.status === "blad" && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-red-500"
                  title="Błąd ostatniego importu"
                  aria-label="Błąd"
                />
              )}
              {dostawca.status === "wstrzymany" && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-500"
                  title="Wstrzymany"
                  aria-label="Wstrzymany"
                />
              )}
              <Badge variant="secondary" className="font-mono text-[10px] h-5">
                {licznikiDostawcow.get(dostawca.kod) ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="border-card-border mb-4">
        <CardContent className="p-4 flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj"
              value={fraza}
              onChange={(zdarzenie) => {
                setFraza(zdarzenie.target.value);
                setStrona(0);
              }}
              className="pl-8 font-mono text-sm"
              data-testid="input-search"
            />
          </div>

          <WyborWielokrotny
            etykieta="Marka"
            opcje={marki_}
            wybrane={marki}
            onZmiana={(nowe) => {
              setMarki(nowe);
              setStrona(0);
            }}
            tekstPusty="Wszystkie marki"
            formatujLicznik={(ile) => `${ile} marek`}
            szerokoscPrzycisku="w-40"
            testId="select-marka"
          />

          <WyborWielokrotny
            etykieta="Kategoria"
            opcje={kategorie_}
            wybrane={kategorie}
            onZmiana={(nowe) => {
              setKategorie(nowe);
              setStrona(0);
            }}
            tekstPusty="Wszystkie kategorie"
            formatujLicznik={(ile) => `${ile} kategorii`}
            szerokoscPrzycisku="w-44"
            testId="select-kategoria"
          />

          <Select
            value={status}
            onValueChange={(nowy) => {
              setStatus(nowy as TrybStatusu);
              setStrona(0);
            }}
          >
            <SelectTrigger className="w-40" data-testid="select-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {OPCJE_STATUSU.map((opcja) => (
                <SelectItem key={opcja.wartosc} value={opcja.wartosc}>
                  {opcja.etykieta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="text-xs text-muted-foreground font-mono ml-auto"
            data-testid="text-licznik"
          >
            wyświetlono {naStronie.length} / {odfiltrowane.length}
          </div>
        </CardContent>
      </Card>

      {!isLoading && wZakladce.length === 0 && zakladka !== "all" && (
        <Card className="border-card-border">
          <CardContent className="p-12 text-center">
            <div className="text-sm text-muted-foreground mb-2">
              Brak produktów od dostawcy{" "}
              <span className="font-mono font-semibold">{zakladka}</span>
            </div>
            {wybranyDostawca?.status === "wstrzymany" && (
              <div className="text-xs text-amber-600 dark:text-amber-500">
                Dostawca jest wstrzymany — nie pobiera plików cennikowych
              </div>
            )}
            {wybranyDostawca?.status === "blad" && (
              <div className="text-xs text-red-600 dark:text-red-500">
                Ostatni import zakończył się błędem — sprawdź sekcję Alerty
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(isLoading || wZakladce.length > 0 || zakladka === "all") && (
        <Card className="border-card-border">
          <CardContent className="p-0">
            <TabelaProduktow
              produkty={naStronie}
              kolumny={kolumnyWidoczne}
              onSortuj={przelaczSortowanie}
              ladowanie={isLoading}
              bylyJakiesProdukty={wZakladce.length > 0}
              onEdytuj={setEdytowany}
              onPrzelaczStatus={(produkt) => przelaczenie.mutate(produkt)}
              onUsun={setDoUsuniecia}
            />

            {liczbaStron > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">Na stronie:</span>
                  <div className="flex gap-0.5">
                    {ROZMIARY_STRONY.map((rozmiar) => (
                      <Button
                        key={rozmiar}
                        size="sm"
                        variant={rozmiarStrony === rozmiar ? "default" : "outline"}
                        className="h-7 px-2 text-[11px] font-mono"
                        onClick={() => {
                          setStrona(0);
                          setRozmiarStrony(rozmiar);
                        }}
                      >
                        {rozmiar}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant={
                        rozmiarStrony >= odfiltrowane.length && odfiltrowane.length > 0
                          ? "default"
                          : "outline"
                      }
                      className="h-7 px-2 text-[11px] font-mono"
                      onClick={() => {
                        setStrona(0);
                        setRozmiarStrony(Math.max(odfiltrowane.length, 1));
                      }}
                    >
                      Wszystkie
                    </Button>
                  </div>
                  <span
                    className="text-muted-foreground font-mono ml-3"
                    data-testid="text-paginacja"
                  >
                    Strona {strona + 1} z {liczbaStron} · {odfiltrowane.length} poz.
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={strona === 0}
                    onClick={() => setStrona((s) => s - 1)}
                    data-testid="button-prev-page"
                  >
                    Poprzednia
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={strona >= liczbaStron - 1}
                    onClick={() => setStrona((s) => s + 1)}
                    data-testid="button-next-page"
                  >
                    Następna
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DialogEdycjiProduktu
        produkt={edytowany}
        onZamknij={() => setEdytowany(null)}
        onZapisz={(produkt, zmiany) => edycja.mutate({ produkt, zmiany })}
        zapisywanie={edycja.isPending}
      />

      {/*
        ODSTĘPSTWO ŚWIADOME (plan.md 12c, D1): oryginał pyta natywnym
        `window.confirm(`Usunąć ${kod}?`)` (`:23805`). Treść przenosimy DOSŁOWNIE,
        zmienia się wyłącznie nośnik — tak jak w 7b (D2) i w narzutach (D6).
      */}
      <DialogPotwierdzenia
        otwarty={doUsuniecia !== null}
        tytul="Usunięcie produktu"
        tresc={doUsuniecia ? `Usunąć ${doUsuniecia.kod}?` : ""}
        etykietaPotwierdzenia="Usuń"
        wariantPotwierdzenia="destructive"
        zajety={kasowanie.isPending}
        onPotwierdz={() => doUsuniecia && kasowanie.mutate(doUsuniecia)}
        onZamknij={() => setDoUsuniecia(null)}
        testId="dialog-usun-produkt"
      />
    </div>
  );
}
