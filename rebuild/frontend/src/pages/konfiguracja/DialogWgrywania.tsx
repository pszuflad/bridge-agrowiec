/**
 * Dialog wgrywania plików — port `Cd()` (`deminified/frontend-index.js:18850-19180`).
 *
 * Jeden komponent obsługuje oba wejścia zakładki „Wgrywanie ręczne", dokładnie jak oryginał:
 *  - `multi` — wgrywanie zbiorcze z auto-detekcją dostawcy (`:26157`),
 *  - `dostawcaKod` — wgrywanie pojedyncze z wymuszonym dostawcą z kafla (`:26190`).
 *
 * ⚠ WARIANT „Importuj do katalogu" NIE ISTNIEJE W PRAKTYCE — nie portujemy go. Oryginał ma
 * propsy `prostoDoKatalogu` i `buttonLabel` (`:18853-18855`), które przełączają etykietę akcji
 * na „Importuj do katalogu" (`:19171`), ale `Cd` jest w CAŁYM bundlu wołane dokładnie dwa razy
 * (`:26157`, `:26190`) i żadne z wywołań tych propsów nie przekazuje. `prostoDoKatalogu`
 * domyślnie `false`, więc etykieta zawsze brzmi „Importuj do staging", a trzeci argument
 * `sP(e,t,n)` nie jest w ciele funkcji nawet czytany (`:18821`). To martwa gałąź.
 *
 * ⚠ PODGLĄD POZYCJI NIE JEST W DIALOGU. Oryginał pokazuje tu tabelę 8 pozycji / 12 kolumn
 * zbudowaną z parsowania pliku W PRZEGLĄDARCE (`oP()`, `:18815`). Odbudowa świadomie nie parsuje
 * w przeglądarce (decyzja 3f-1, uzasadnienie w `detekcja.ts`), więc podgląd — 5 rekordów
 * z ODPOWIEDZI backendu — może powstać dopiero po imporcie i renderuje go `Wgrywanie.tsx`
 * pod kaflami (decyzja 14a/D4). Dialog zachowuje się przy tym 1:1: po sukcesie zamyka się
 * i czyści listę (`i(!1)`, `w()`, `:19154-19155`).
 */
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { przeanalizujPlik, wymusDostawce, type AnalizaPliku } from "./detekcja";
import { wgrajPlik, type WynikUploadu } from "./wgrywanie";

/**
 * Dostawca w zakresie potrzebnym zakładce — kafel bierze `kod`, `nazwa`, `email`, select `kod`
 * i `nazwa`. Typ trzymamy tutaj, a nie w `typy.ts`, bo `typy.ts` jest współdzielony z kartami
 * 14b/14c i ta karta go nie posiada.
 */
export type Dostawca = {
  kod: string;
  nazwa: string;
  email: string | null;
};

/** Wynik importu jednego pliku — dialog oddaje go rodzicowi, który renderuje podgląd (D4). */
export type WynikPliku = {
  nazwaPliku: string;
  wynik: WynikUploadu;
};

type PozycjaPliku = {
  id: string;
  analiza: AnalizaPliku;
};

const ETYKIETY_PEWNOSCI: Record<string, string> = {
  wysoka: "wysoka pewność",
  srednia: "średnia pewność",
  brak: "nie rozpoznano",
  wymuszona: "wybrane ręcznie",
};

function formatujRozmiar(bajty: number): string {
  if (bajty < 1024) return `${bajty} B`;
  if (bajty < 1024 * 1024) return `${Math.round(bajty / 1024)} KB`;
  return `${(bajty / (1024 * 1024)).toFixed(1)} MB`;
}

export function DialogWgrywania({
  trigger,
  dostawcy,
  dostawcaKod,
  multi = false,
  onZaimportowano,
}: {
  trigger: ReactNode;
  /** Lista do selecta — przychodzi propsem, żeby N+1 instancji dialogu nie zakładało N+1 subskrypcji. */
  dostawcy: Dostawca[];
  /** Wymusza dostawcę na każdym wczytanym pliku — kafel „Wgrywanie pojedyncze" (`:26190`). */
  dostawcaKod?: string;
  /** Wgrywanie zbiorcze z auto-detekcją (`:26157`). */
  multi?: boolean;
  onZaimportowano: (wyniki: WynikPliku[]) => void;
}) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [otwarty, ustawOtwarty] = useState(false);
  const [pliki, ustawPliki] = useState<PozycjaPliku[]>([]);
  const [parsowanie, ustawParsowanie] = useState(false);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [przeciaganie, ustawPrzeciaganie] = useState(false);
  const wejscie = useRef<HTMLInputElement>(null);
  /** Licznik zamiast `Date.now()` — dwa pliki o tej samej nazwie i rozmiarze muszą mieć różne id. */
  const licznikId = useRef(0);

  /** `w()` z oryginału (`:18859`) — czyści listę i zdejmuje flagi, bez zamykania dialogu. */
  const wyczysc = () => {
    ustawPliki([]);
    ustawParsowanie(false);
    ustawWysylanie(false);
    if (wejscie.current) wejscie.current.value = "";
  };

  /** `v()` z oryginału (`:18862-18877`). */
  const dodajPliki = async (wybrane: FileList | File[] | null) => {
    if (!wybrane) return;
    const lista = Array.from(wybrane);
    if (lista.length === 0) return;

    ustawParsowanie(true);
    const nowe: PozycjaPliku[] = [];
    for (const plik of lista) {
      try {
        const analiza = await przeanalizujPlik(plik);
        nowe.push({
          id: `${plik.name}-${plik.size}-${++licznikId.current}`,
          // Wymuszenie nadpisuje wynik auto-detekcji, dokładnie jak `:18868`
          // (`pewnosc: "wymuszona"`, `powod: "Wymuszone z UI (KOD)"`).
          analiza: dostawcaKod ? wymusDostawce(analiza, dostawcaKod) : analiza,
        });
      } catch (e) {
        // `:18871-18876` — plik nie trafia na listę, pozostałe wczytują się normalnie.
        toast({
          title: `Błąd pliku ${plik.name}`,
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      }
    }
    ustawPliki((poprzednie) => [...poprzednie, ...nowe]);
    ustawParsowanie(false);
  };

  const zmienDostawce = (id: string, kod: string) => {
    ustawPliki((poprzednie) =>
      poprzednie.map((p) => (p.id === id ? { ...p, analiza: wymusDostawce(p.analiza, kod) } : p)),
    );
  };

  const usun = (id: string) => {
    ustawPliki((poprzednie) => poprzednie.filter((p) => p.id !== id));
  };

  /** Te same unieważnienia co `sP()` (`:18838-18842`) — po KAŻDYM udanym pliku, nie na końcu. */
  const uniewaznijCache = () => {
    void klient.invalidateQueries({ queryKey: ["/api/staging"] });
    void klient.invalidateQueries({ queryKey: ["/api/products"] });
    // `/api/dostawcy` to nazwa tej samej listy, którą oryginał zna jako `/api/suppliers`.
    void klient.invalidateQueries({ queryKey: ["/api/dostawcy"] });
    void klient.invalidateQueries({ queryKey: ["/api/suppliers"] });
  };

  /** Pętla importu — `:19130-19160`, odtworzona co do kolejności i warunków. */
  const importuj = async () => {
    ustawWysylanie(true);
    // Poza `try`, bo przy błędzie (D7) oddajemy rodzicowi to, co zdążyło się udać — inaczej
    // pod kaflami zostałby wynik POPRZEDNIEGO importu i czytał się jako wynik tej próby.
    const wyniki: WynikPliku[] = [];
    try {
      let pozycjeWPlikach = 0;
      let pominietePliki = 0;
      const sumy = {
        nowe: 0,
        zmienione: 0,
        wycofane: 0,
        bezZmian: 0,
        odrzuconeNieOpony: 0,
        // Oryginał to sumuje, ale NIGDY nie wyświetla (`:19141` vs `:19148`). Odtwarzamy
        // zachowanie — nie „poprawiać" tego przez dopisanie członu do opisu.
        odrzuconeBrakDanych: 0,
        doStagingu: 0,
      };

      // Sekwencyjnie, jak oryginał: `sP` rzuca przy pierwszym błędzie, więc pętla się urywa
      // i pliki po nim nie idą (decyzja 14a/D7 — zachowanie 1:1).
      for (const pozycja of pliki) {
        const kod = pozycja.analiza.detekcja.kod;
        if (!kod) {
          pominietePliki++;
          continue;
        }
        const wynik = await wgrajPlik(kod, pozycja.analiza.plik);
        pozycjeWPlikach += wynik.liczbaProduktow;
        sumy.nowe += wynik.nowe;
        sumy.zmienione += wynik.zmienione;
        sumy.wycofane += wynik.wycofane;
        sumy.bezZmian += wynik.bezZmian;
        sumy.odrzuconeNieOpony += wynik.odrzuconeNieOpony;
        sumy.odrzuconeBrakDanych += wynik.odrzuconeBrakDanych;
        sumy.doStagingu += wynik.doStagingu;
        wyniki.push({ nazwaPliku: pozycja.analiza.nazwaPliku, wynik });
        // Po każdym pliku, jak `sP()` — pozycje już zapisane mają być widoczne w stagingu
        // i katalogu nawet wtedy, gdy następny plik wywali import (D7).
        uniewaznijCache();
      }

      // Opis skleja TYLKO niezerowe człony, w tej kolejności, separatorem „ • " (`:19142-19151`).
      // „Pozycji w plikach" idzie zawsze, bez warunku.
      const czlony: string[] = [`Pozycji w plikach: ${pozycjeWPlikach}`];
      if (sumy.doStagingu > 0) czlony.push(`Do akceptacji w stagingu: ${sumy.doStagingu}`);
      if (sumy.nowe > 0) czlony.push(`Nowe: ${sumy.nowe}`);
      if (sumy.zmienione > 0) czlony.push(`Zmienione: ${sumy.zmienione}`);
      // ⚠ „Braki w cenniku", nie „Wycofane" — łatka #103 przemianowała ten człon w ŻYWYM
      // bundlu (`index-PRICEFMT1783512500.js` @ `88fa31c`). Klucz `sumy.wycofane` zostaje
      // bez zmian: zmieniła się wyłącznie etykieta widoczna dla użytkownika (ticket 142).
      if (sumy.wycofane > 0) czlony.push(`Braki w cenniku: ${sumy.wycofane}`);
      if (sumy.bezZmian > 0) czlony.push(`Bez zmian: ${sumy.bezZmian}`);
      if (sumy.odrzuconeNieOpony > 0)
        czlony.push(`Odrzucone (nie opony): ${sumy.odrzuconeNieOpony}`);
      if (pominietePliki > 0) czlony.push(`Pominięte pliki: ${pominietePliki}`);

      toast({
        title:
          sumy.doStagingu > 0
            ? `${sumy.doStagingu} pozycji czeka na akceptację`
            : "Import zakończony",
        description: czlony.join(" • "),
      });

      onZaimportowano(wyniki);
      ustawOtwarty(false);
      wyczysc();
    } catch (e) {
      // `:19156-19159` — dialog ZOSTAJE otwarty, lista NIE jest czyszczona.
      toast({
        title: "Błąd importu",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      // Wyniki plików sprzed błędu (albo pusta lista, jeśli padł pierwszy) — sekcja pod kaflami
      // ma pokazywać TĘ próbę, nie poprzednią.
      onZaimportowano(wyniki);
    } finally {
      ustawWysylanie(false);
    }
  };

  const nicDoImportu = pliki.every((p) => !p.analiza.detekcja.kod);

  return (
    <Dialog
      open={otwarty}
      onOpenChange={(stan) => {
        ustawOtwarty(stan);
        if (!stan) wyczysc();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {multi
              ? "Wgraj wiele plików — auto-detekcja dostawcy"
              : `Wczytaj plik cennika${dostawcaKod ? ` — ${dostawcaKod}` : ""}`}
          </DialogTitle>
          {/* ⚠ ODSTĘPSTWO ŚWIADOME w obu opisach. Oryginał (`:18959-18960`) mówi „plików CSV"
              i „Bridge sparsuje CSV, rozpozna dostawcę i pokaże podgląd przed importem do
              staging.". Słowo „CSV" wypada, bo odbudowa przyjmuje też XLSX (D6), a obietnica
              podglądu PRZED importem — bo odbudowa nie parsuje w przeglądarce (D2) i podgląd
              powstaje z odpowiedzi backendu już po imporcie (D4). */}
          <DialogDescription>
            {multi
              ? "Wybierz dowolną liczbę plików. Bridge sam rozpozna dostawcę i sparsuje rozmiary opon."
              : "Bridge sparsuje plik, zaimportuje pozycje do stagingu i pokaże podgląd po imporcie."}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={wejscie}
          type="file"
          multiple
          // ⚠ ODSTĘPSTWO ŚWIADOME (14a/D6): oryginał ma `accept=".csv,text/csv"` i odrzuca XLSX
          // w przeglądarce (`:18793`). Odbudowa XLSX przyjmuje, bo MO8 i MO10 na nim jeżdżą —
          // patrz `detekcja.ts`.
          accept=".csv,.txt,.xlsx,.xls"
          data-testid="input-pliki"
          aria-label="Pliki cennika"
          className="sr-only"
          onChange={(e) => {
            // Kopia PRZED zerowaniem: `input.files` to żywa referencja, którą reset opróżnia.
            const wybrane = Array.from(e.target.files ?? []);
            // Reset `value` po odczytaniu: to JEDEN trwały węzeł (oryginał renderuje dwa osobne
            // inputy, `:18921` i `:18959`), więc bez tego ponowny wybór TEGO SAMEGO pliku —
            // np. po poprawieniu go na dysku i „Dodaj kolejny plik" — nie dałby zdarzenia.
            e.target.value = "";
            void dodajPliki(wybrane);
          }}
        />

        {pliki.length === 0 ? (
          <div
            className={cn(
              "border border-dashed rounded-md p-8 text-center space-y-2",
              // Podświetlenie w trakcie przeciągania — `:18900-18907`.
              przeciaganie ? "border-primary bg-accent" : "border-border",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              ustawPrzeciaganie(true);
            }}
            onDragLeave={() => ustawPrzeciaganie(false)}
            onDrop={(e) => {
              e.preventDefault();
              ustawPrzeciaganie(false);
              void dodajPliki(e.dataTransfer.files);
            }}
          >
            <p className="text-sm">Przeciągnij {multi ? "pliki" : "plik"} tutaj</p>
            {/* ⚠ ODSTĘPSTWO ŚWIADOME (14a/D6): oryginał pisze „CSV (separator ; lub ,) — do 10 MB
                każdy" (`:18893`). Odbudowa przyjmuje CSV i XLSX do 50 MB, więc tekst oryginału
                kłamałby o dwóch rzeczach naraz. */}
            <p className="text-xs text-muted-foreground">
              CSV i XLSX (separator ; lub ,) — do 50 MB każdy
            </p>
            <Button
              variant="outline"
              disabled={parsowanie}
              onClick={() => wejscie.current?.click()}
              data-testid="button-wybierz-pliki"
            >
              {parsowanie
                ? "Parsowanie…"
                : multi
                  ? "Wybierz pliki z dysku"
                  : "Wybierz plik z dysku"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Wczytane pliki ({pliki.length})</h4>
              <Button
                variant="outline"
                size="sm"
                disabled={parsowanie || wysylanie}
                onClick={() => wejscie.current?.click()}
                data-testid="button-dodaj-kolejny"
              >
                Dodaj kolejny plik
              </Button>
            </div>

            <div className="space-y-2">
              {pliki.map((pozycja) => (
                <PozycjaListy
                  key={pozycja.id}
                  analiza={pozycja.analiza}
                  dostawcy={dostawcy}
                  zablokowane={wysylanie}
                  onZmienDostawce={(kod) => zmienDostawce(pozycja.id, kod)}
                  onUsun={() => usun(pozycja.id)}
                />
              ))}
            </div>
          </div>
        )}

        {pliki.length > 0 && (
          <DialogFooter>
            {/* „Wyczyść" czyści listę, ale NIE zamyka dialogu (`:19124-19128`). */}
            <Button variant="outline" onClick={wyczysc} disabled={wysylanie}>
              <X className="w-4 h-4 mr-2" />
              Wyczyść
            </Button>
            {/* ⚠ BEZ LICZNIKA W ETYKIECIE. Wcześniejsza odbudowa miała tu „Wgraj (N)", gdzie N
                liczyło pozycje JESZCZE niewysłane — po udanym imporcie spadało do zera i czytało
                się jako „wgrało zero". Oryginał licznika nie ma, a przycisk wyłącza wyłącznie
                warunkiem „żaden plik nie ma rozpoznanego dostawcy" (`:19161`, `:19171`). */}
            <Button
              onClick={() => void importuj()}
              disabled={wysylanie || nicDoImportu}
              data-testid="button-importuj"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importuj do staging
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PozycjaListy({
  analiza,
  dostawcy,
  zablokowane,
  onZmienDostawce,
  onUsun,
}: {
  analiza: AnalizaPliku;
  dostawcy: Dostawca[];
  zablokowane: boolean;
  onZmienDostawce: (kod: string) => void;
  onUsun: () => void;
}) {
  const { detekcja } = analiza;

  return (
    <div
      className="border border-border rounded-md p-3 bg-card space-y-2"
      data-testid={`pozycja-${analiza.nazwaPliku}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-sm font-medium">{analiza.nazwaPliku}</span>
        <span className="text-xs text-muted-foreground">{formatujRozmiar(analiza.rozmiar)}</span>
        {analiza.arkusz && <span className="text-xs text-muted-foreground">arkusz XLSX</span>}
        {analiza.liczbaWierszy !== null && (
          <span className="text-xs text-muted-foreground">{analiza.liczbaWierszy} wierszy</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground" data-testid="powod-detekcji">
        {detekcja.kod ? `${detekcja.kod} · ${ETYKIETY_PEWNOSCI[detekcja.pewnosc]}` : "Nie rozpoznano"}{" "}
        · {detekcja.powod}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {/* ⚠ ODSTĘPSTWO ISTNIEJĄCE (3f-1): oryginał ma tu zahardkodowaną listę MO1…MO10
            (`:19017`), łącznie z wycofanym MO6. Odbudowa bierze realną listę z API. */}
        <Select value={detekcja.kod} onValueChange={onZmienDostawce} disabled={zablokowane}>
          <SelectTrigger className="w-56" aria-label={`Dostawca dla ${analiza.nazwaPliku}`}>
            <SelectValue placeholder="— wybierz —" />
          </SelectTrigger>
          <SelectContent>
            {dostawcy.map((d) => (
              <SelectItem key={d.kod} value={d.kod}>
                {d.kod} — {d.nazwa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={onUsun} disabled={zablokowane}>
          Usuń
        </Button>
      </div>
    </div>
  );
}
