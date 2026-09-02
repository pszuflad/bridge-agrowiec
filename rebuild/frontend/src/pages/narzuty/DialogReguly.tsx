/**
 * Dialog dodawania i edycji reguły — port `el()` (`deminified/frontend-index.js:24129-24659`).
 *
 * JEDEN dialog obsługuje OBA zasoby: przełącznik u góry wybiera „Narzut (stała marża)" albo
 * „Promocja (czasowy rabat)", a od tego zależą etykiety, pola dat i adres zapisu. Tak jest
 * w oryginale i tak zostaje — rozdzielenie na dwa komponenty rozjechałoby builder warunków,
 * który jest wspólny.
 *
 * Kształt ciała żądania odtworzony z `Nb()` (`:9200-9214`) i `Cb()` (`:9316+`): `typ`/`zakres`
 * biorą się z PIERWSZEGO warunku, gdy nie podano ich wprost, a `zasieg` promocji z warunków
 * sklejonych „typ:wartosc" plusami. Wysyłamy WYŁĄCZNIE pola z list edytowalnych backendu
 * (`api.ts`) — reszta zostałaby po cichu zignorowana przy zapisie.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import {
  dodajNarzut,
  dodajPromocje,
  zapiszNarzut,
  zapiszPromocje,
  type Narzut,
  type Promocja,
} from "./api";
import { produktyPonizejKosztu } from "./ceny";
import { statusZDat, STATUS_NARZUTU_AKTYWNY } from "./status";
import {
  TYPY_WARUNKU,
  TYPY_ZE_SLOWNIKA,
  odczytajWarunki,
  placeholderWartosci,
  zapiszWarunki,
  type Warunek,
} from "./warunki";

export type TrybReguly = "narzut" | "promocja";

export type WlasciwosciDialogu = {
  trybInicjalny: TrybReguly;
  edytowanyNarzut?: Narzut;
  edytowanaPromocja?: Promocja;
  onClose?: () => void;
};

/** 30 dni w milisekundach — domyślny koniec promocji z `Cb()` (`2592e6`, `:9317`). */
const DOMYSLNY_OKRES_MS = 2_592_000_000;

const naDate = (iso: string): string => (iso ? iso.slice(0, 10) : "");

export function DialogReguly({
  trybInicjalny,
  edytowanyNarzut,
  edytowanaPromocja,
  onClose,
}: WlasciwosciDialogu) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const edycja = edytowanyNarzut ?? edytowanaPromocja;

  const [otwarty, ustawOtwarty] = useState(Boolean(edycja));
  const [tryb, ustawTryb] = useState<TrybReguly>(trybInicjalny);
  const [nazwa, ustawNazwe] = useState("");
  const [globalna, ustawGlobalna] = useState(true);
  const [warunki, ustawWarunki] = useState<Warunek[]>([]);
  const [wartosc, ustawWartosc] = useState("0");
  const [start, ustawStart] = useState("");
  const [koniec, ustawKoniec] = useState("");
  const [doPotwierdzenia, ustawDoPotwierdzenia] = useState<
    { produkt: Produkt; cenaSprzedazy: number }[] | null
  >(null);

  const { data: produkty } = useQuery<Produkt[]>({ queryKey: ["/api/products"] });
  const katalog = produkty ?? [];

  // Wypełnienie formularza przy edycji; przy dodawaniu — wartości domyślne z `Cb()`.
  useEffect(() => {
    if (!otwarty) return;
    if (edytowanyNarzut) {
      const w = odczytajWarunki(edytowanyNarzut.warunki);
      ustawTryb("narzut");
      ustawNazwe(edytowanyNarzut.nazwa ?? "");
      ustawWarunki(w);
      ustawGlobalna(w.length === 0);
      ustawWartosc(String(edytowanyNarzut.wartosc));
      return;
    }
    if (edytowanaPromocja) {
      const w = odczytajWarunki(edytowanaPromocja.warunki);
      ustawTryb("promocja");
      ustawNazwe(edytowanaPromocja.nazwa);
      ustawWarunki(w);
      ustawGlobalna(w.length === 0);
      ustawWartosc(String(edytowanaPromocja.rabatPct));
      ustawStart(naDate(edytowanaPromocja.start));
      ustawKoniec(naDate(edytowanaPromocja.koniec));
    }
  }, [otwarty, edytowanyNarzut, edytowanaPromocja]);

  const zamknij = () => {
    ustawOtwarty(false);
    ustawDoPotwierdzenia(null);
    onClose?.();
  };

  const odswiez = () => {
    void klient.invalidateQueries({ queryKey: ["/api/markups"] });
    void klient.invalidateQueries({ queryKey: ["/api/promotions"] });
    // Mutacja reguły przelicza ceny CAŁEGO katalogu po stronie serwera (4a).
    void klient.invalidateQueries({ queryKey: ["/api/products"] });
  };

  /** Wartości słownikowe do selectów — zbierane z katalogu, jak w oryginale (`:24247`). */
  const slownik = (pole: "dostawca" | "kategoria" | "marka"): string[] =>
    [...new Set(katalog.map((p) => String(p[pole] ?? "")).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pl"),
    );

  const zapis = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const listaWarunkow = globalna ? [] : warunki;
      const serializowane = zapiszWarunki(listaWarunkow);
      const liczba = Number(wartosc);

      if (tryb === "promocja") {
        const teraz = new Date().toISOString();
        const startIso = start ? new Date(start).toISOString() : teraz;
        const koniecIso = koniec
          ? new Date(koniec).toISOString()
          : new Date(Date.now() + DOMYSLNY_OKRES_MS).toISOString();

        const cialo = {
          nazwa,
          rabatPct: liczba,
          // `zasieg` z warunków sklejonych plusami — `Cb()` (`:9322`).
          zasieg: listaWarunkow.map((w) => `${w.typ}:${w.wartosc}`).join(" + "),
          warunki: serializowane,
          priorytet: 50,
          start: startIso,
          koniec: koniecIso,
          status: edytowanaPromocja?.status ?? statusZDat(startIso, koniecIso),
        };
        if (edytowanaPromocja) {
          const wynik = await zapiszPromocje(edytowanaPromocja.id, cialo);
          // 200 z PUSTYM ciałem znaczy „nie ma takiej promocji" — patrz `api.ts`.
          if (wynik === null) throw new Error("Promocja nie istnieje — mogła zostać usunięta.");
          return wynik;
        }
        return await dodajPromocje(cialo);
      }

      // `typ`/`zakres` z PIERWSZEGO warunku — `Nb()` (`:9204-9207`).
      const pierwszy = listaWarunkow[0];
      const cialo = {
        typ: pierwszy?.typ ?? "globalny",
        zakres: pierwszy?.wartosc ?? "",
        warunki: serializowane,
        nazwa,
        wartosc: liczba,
        jednostka: "procent",
        priorytet: 50,
        status: edytowanyNarzut?.status ?? STATUS_NARZUTU_AKTYWNY,
      };
      if (edytowanyNarzut) return await zapiszNarzut(edytowanyNarzut.id, cialo);
      return await dodajNarzut(cialo);
    },
    onSuccess: () => {
      odswiez();
      const dodawanie = !edycja;
      toast({
        title:
          tryb === "promocja"
            ? dodawanie
              ? "Promocja dodana"
              : "Promocja zaktualizowana"
            : dodawanie
              ? "Reguła dodana"
              : "Reguła zaktualizowana",
      });
      zamknij();
    },
    onError: (e) => toast({ title: "Nie udało się zapisać", description: e.message, variant: "destructive" }),
  });

  /** Walidacje 1:1 z oryginałem (`:24549`, `:24553`, `:24559`). */
  function sprawdzIZapisz() {
    const liczba = Number(wartosc);
    if (!globalna && warunki.filter((w) => w.wartosc.trim()).length === 0) {
      toast({ title: "Brak warunków", description: "Dodaj warunek albo zaznacz regułę globalną.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(liczba) || liczba < 0) {
      toast({ title: "Nieprawidłowa wartość", description: "Podaj liczbę nieujemną.", variant: "destructive" });
      return;
    }
    if (tryb === "promocja" && start && koniec && new Date(koniec) < new Date(start)) {
      toast({ title: "Niepoprawne daty", description: "Koniec nie może być przed startem.", variant: "destructive" });
      return;
    }

    // Kontrola „poniżej kosztu" — port `:24598`. U nas własnym dialogiem zamiast
    // `window.confirm` (plan.md D6): tamten blokuje wątek i nie da się go przetestować.
    if (tryb === "promocja" && katalog.length > 0) {
      const podglad: Promocja = {
        id: edytowanaPromocja?.id ?? -1,
        nazwa,
        rabatPct: liczba,
        zasieg: (globalna ? [] : warunki).map((w) => `${w.typ}:${w.wartosc}`).join(" + "),
        warunki: zapiszWarunki(globalna ? [] : warunki),
        priorytet: 50,
        start: start || new Date().toISOString(),
        koniec: koniec || new Date(Date.now() + DOMYSLNY_OKRES_MS).toISOString(),
        status: "aktywna",
        zmienilUzytkownikId: null,
        zmienionoData: null,
      };
      const ponizej = produktyPonizejKosztu(katalog, [], [podglad]) as {
        produkt: Produkt;
        cenaSprzedazy: number;
      }[];
      if (ponizej.length > 0) {
        ustawDoPotwierdzenia(ponizej);
        return;
      }
    }

    zapis.mutate();
  }

  const etykietaWartosci = tryb === "promocja" ? "Rabat (%)" : "Wartość narzutu (%)";

  return (
    <>
      {edycja ? null : (
        <Button
          size="sm"
          onClick={() => {
            ustawTryb(trybInicjalny);
            ustawNazwe("");
            ustawWarunki([]);
            ustawGlobalna(true);
            ustawWartosc("0");
            ustawStart("");
            ustawKoniec("");
            ustawOtwarty(true);
          }}
          data-testid={trybInicjalny === "promocja" ? "button-add-promotion" : "button-add-markup"}
        >
          <Plus className="w-4 h-4 mr-1" />
          {trybInicjalny === "promocja" ? "Dodaj promocję" : "Dodaj regułę"}
        </Button>
      )}

      <Dialog open={otwarty} onOpenChange={(o) => (o ? ustawOtwarty(true) : zamknij())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {edycja ? "Edytuj regułę" : "Nowa reguła cenowa"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Przełącznik trybu — przy edycji zablokowany: zasób jest już wybrany. */}
            <div className="space-y-1.5">
              <Label>Typ reguły</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={tryb === "narzut" ? "default" : "outline"}
                  size="sm"
                  disabled={Boolean(edycja)}
                  onClick={() => ustawTryb("narzut")}
                  data-testid="button-tryb-narzut"
                >
                  Narzut (stała marża)
                </Button>
                <Button
                  type="button"
                  variant={tryb === "promocja" ? "default" : "outline"}
                  size="sm"
                  disabled={Boolean(edycja)}
                  onClick={() => ustawTryb("promocja")}
                  data-testid="button-tryb-promocja"
                >
                  Promocja (czasowy rabat)
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nazwa-reguly">Nazwa</Label>
              <Input
                id="nazwa-reguly"
                value={nazwa}
                onChange={(e) => ustawNazwe(e.target.value)}
                placeholder="np. Premia za Alliance rolnicze"
                data-testid="input-markup-name"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="globalny"
                type="checkbox"
                checked={globalna}
                onChange={(e) => ustawGlobalna(e.target.checked)}
                data-testid="checkbox-globalny"
              />
              <Label htmlFor="globalny">Reguła globalna (wszystkie produkty, bez warunków)</Label>
            </div>

            {globalna ? null : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Warunki (łączone operatorem AND)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => ustawWarunki((w) => [...w, { typ: "dostawca", wartosc: "" }])}
                    data-testid="button-add-warunek"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj warunek
                  </Button>
                </div>

                {warunki.map((warunek, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select
                      value={warunek.typ}
                      onValueChange={(v) =>
                        ustawWarunki((lista) =>
                          lista.map((w, j) => (j === i ? { typ: v, wartosc: "" } : w)),
                        )
                      }
                    >
                      <SelectTrigger className="w-[220px]" data-testid={`select-warunek-typ-${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPY_WARUNKU.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {TYPY_ZE_SLOWNIKA.includes(warunek.typ) ? (
                      <Select
                        value={warunek.wartosc}
                        onValueChange={(v) =>
                          ustawWarunki((lista) =>
                            lista.map((w, j) => (j === i ? { ...w, wartosc: v } : w)),
                          )
                        }
                      >
                        <SelectTrigger className="flex-1" data-testid={`select-warunek-wartosc-${i}`}>
                          <SelectValue placeholder={`— wybierz ${warunek.typ === "kategoria" ? "kategorię" : warunek.typ === "dostawca" ? "dostawcę" : "markę"} —`} />
                        </SelectTrigger>
                        <SelectContent>
                          {slownik(warunek.typ as "dostawca" | "kategoria" | "marka").map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="flex-1"
                        value={warunek.wartosc}
                        placeholder={placeholderWartosci(warunek.typ)}
                        onChange={(e) =>
                          ustawWarunki((lista) =>
                            lista.map((w, j) => (j === i ? { ...w, wartosc: e.target.value } : w)),
                          )
                        }
                        data-testid={`input-warunek-wartosc-${i}`}
                      />
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => ustawWarunki((lista) => lista.filter((_, j) => j !== i))}
                      data-testid={`button-remove-warunek-${i}`}
                      title="Usuń warunek"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="wartosc-reguly">{etykietaWartosci}</Label>
              <Input
                id="wartosc-reguly"
                type="number"
                value={wartosc}
                onChange={(e) => ustawWartosc(e.target.value)}
                data-testid="input-markup-value"
              />
            </div>

            {tryb === "promocja" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-start">Data startu</Label>
                    <Input
                      id="promo-start"
                      type="date"
                      value={start}
                      onChange={(e) => ustawStart(e.target.value)}
                      data-testid="input-promo-start"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-koniec">Data końca</Label>
                    <Input
                      id="promo-koniec"
                      type="date"
                      value={koniec}
                      onChange={(e) => ustawKoniec(e.target.value)}
                      data-testid="input-promo-koniec"
                    />
                  </div>
                </div>
                {/*
                  ODSTĘPSTWO ŚWIADOME (plan.md D4): oryginał nie ostrzega. Silnik cen NIE CZYTA
                  tych dat (backlog #19) — decyduje wyłącznie `status`. Bez tej noty łatwo
                  wyłączyć promocję datą i nie zauważyć, że dalej obniża ceny.
                */}
                <p className="text-[11px] text-muted-foreground" data-testid="nota-daty-promocji">
                  Daty są informacyjne i sterują wyłącznie etykietą na liście. O tym, czy
                  promocja obniża ceny, decyduje status „aktywna" — upływ daty sam jej nie wyłącza.
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={zamknij}>
              Anuluj
            </Button>
            <Button
              type="button"
              onClick={sprawdzIZapisz}
              disabled={zapis.isPending}
              data-testid="button-save-markup"
            >
              {zapis.isPending
                ? "Zapisywanie…"
                : tryb === "promocja"
                  ? "Zapisz promocję"
                  : "Zapisz regułę"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kontrola „poniżej kosztu" — treść i sens 1:1 z `window.confirm` oryginału (`:24598`). */}
      <Dialog
        open={doPotwierdzenia !== null}
        onOpenChange={(o) => (o ? null : ustawDoPotwierdzenia(null))}
      >
        <DialogContent data-testid="dialog-ponizej-kosztu">
          <DialogHeader>
            <DialogTitle>Uwaga: sprzedaż poniżej ceny zakupu</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              {doPotwierdzenia?.length} produkt(ów) będzie miało cenę sprzedaży PONIŻEJ ceny
              zakupu:
            </p>
            <ul className="max-h-48 overflow-y-auto text-xs font-mono space-y-0.5">
              {doPotwierdzenia?.slice(0, 20).map((p) => (
                <li key={p.produkt.kod}>
                  {p.produkt.kod} — zakup {p.produkt.cenaZakupu as number}, sprzedaż{" "}
                  {p.cenaSprzedazy}
                </li>
              ))}
            </ul>
            {doPotwierdzenia && doPotwierdzenia.length > 20 ? (
              <p className="text-xs text-muted-foreground">
                …i {doPotwierdzenia.length - 20} więcej.
              </p>
            ) : null}
            <p>Czy na pewno chcesz zapisać tę promocję?</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => ustawDoPotwierdzenia(null)}
              data-testid="button-anuluj-ponizej-kosztu"
            >
              Anuluj
            </Button>
            <Button
              type="button"
              onClick={() => {
                ustawDoPotwierdzenia(null);
                zapis.mutate();
              }}
              data-testid="button-potwierdz-ponizej-kosztu"
            >
              Zapisz mimo to
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
