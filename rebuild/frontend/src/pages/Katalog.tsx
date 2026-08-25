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
 * Zakres Iteracji 2 to ODCZYT. Menu „Akcje" (Edytuj/Wstrzymaj/Usuń), eksport CSV do
 * Shopera oraz zaciąganie słowników z `GET /api/atrybuty` i `GET /api/config` należą
 * do późniejszych iteracji — patrz „Poza zakresem" w plan.md.
 */
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
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
import {
  listaKategorii,
  listaMarek,
  zastosujFiltry,
  type KierunekSortowania,
  type Produkt,
  type TrybStatusu,
} from "./katalog/filtrowanie";
import { KonfiguratorKolumn } from "./katalog/KonfiguratorKolumn";
import { KOLUMNY, KOLUMNY_DOMYSLNE, uzupelnijKodImportu } from "./katalog/kolumny";
import { PodgladProduktu } from "./katalog/PodgladProduktu";
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

  const [zakladka, setZakladka] = useState("all");
  const [fraza, setFraza] = useState("");
  const [marki, setMarki] = useState<Set<string>>(() => new Set());
  const [kategorie, setKategorie] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<TrybStatusu>("all");
  const [sortKolumna, setSortKolumna] = useState("");
  const [sortKierunek, setSortKierunek] = useState<KierunekSortowania>("asc");
  const [strona, setStrona] = useState(0);
  const [rozmiarStrony, setRozmiarStrony] = useState<number>(25);
  const [podglad, setPodglad] = useState<Produkt | null>(null);

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

  const marki_ = useMemo(() => listaMarek(wZakladce), [wZakladce]);
  const kategorie_ = useMemo(() => listaKategorii(wZakladce), [wZakladce]);

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
              onPodglad={setPodglad}
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

      <PodgladProduktu produkt={podglad} onZamknij={() => setPodglad(null)} />
    </div>
  );
}
