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
import { produktyPonizejKosztu, type PozycjaPonizejKosztu } from "./ceny";
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
const dzisiaj = (): string => new Date().toISOString().slice(0, 10);
const zaMiesiac = (): string => new Date(Date.now() + DOMYSLNY_OKRES_MS).toISOString().slice(0, 10);

/**
 * Domyślna wartość pola „Wartość narzutu / Rabat" — 15% dla narzutu, 10% dla promocji
 * (`frontend-index.js:24219`). NIE zero: pusta reguła z zerowym narzutem zbiłaby ceny
 * do gołego zakupu z VAT-em.
 */
const DOMYSLNA_WARTOSC = { narzut: 15, promocja: 10 } as const;

/** Nowa reguła startuje z JEDNYM pustym warunkiem typu `kategoria` (`:24216-24218`). */
const PIERWSZY_WARUNEK: Warunek = { typ: "kategoria", wartosc: "" };

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
  const [warunki, ustawWarunki] = useState<Warunek[]>([PIERWSZY_WARUNEK]);
  const [wartosc, ustawWartosc] = useState(String(DOMYSLNA_WARTOSC[trybInicjalny]));
  const [start, ustawStart] = useState(dzisiaj);
  const [koniec, ustawKoniec] = useState(zaMiesiac);
  /**
   * ⚠ PRIORYTET NIE MA POLA W FORMULARZU — w oryginale ten input stoi pod `display:none`
   * (`:24468-24472`), więc użytkownik go nie zmienia. Trzymamy go w stanie WYŁĄCZNIE po to,
   * żeby przy edycji odesłać wartość, którą reguła już ma (`:24216`, `priorytet: C`).
   * Bez tego zapis zbijałby każdy priorytet do 50 i po cichu zmieniał, KTÓRA reguła wygrywa.
   */
  const [priorytet, ustawPriorytet] = useState(50);
  const [doPotwierdzenia, ustawDoPotwierdzenia] = useState<PozycjaPonizejKosztu[] | null>(null);

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
      ustawPriorytet(edytowanyNarzut.priorytet ?? 50);
      return;
    }
    if (edytowanaPromocja) {
      const w = odczytajWarunki(edytowanaPromocja.warunki);
      ustawTryb("promocja");
      ustawNazwe(edytowanaPromocja.nazwa);
      ustawWarunki(w);
      ustawGlobalna(w.length === 0);
      ustawWartosc(String(edytowanaPromocja.rabatPct));
      ustawPriorytet(edytowanaPromocja.priorytet ?? 50);
      ustawStart(naDate(edytowanaPromocja.start) || dzisiaj());
      ustawKoniec(naDate(edytowanaPromocja.koniec) || zaMiesiac());
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
      const listaWarunkow = globalna ? [] : warunki.filter((w) => w.wartosc.trim());
      const serializowane = zapiszWarunki(listaWarunkow);
      const liczba = Number(wartosc);

      if (tryb === "promocja") {
        const startIso = new Date(start).toISOString();
        const koniecIso = new Date(koniec).toISOString();
        /**
         * ⚠ `zasieg` dla reguły globalnej to napis „globalny", NIE pusty (`:24613`).
         * Różnica jest znacząca: `promocjaPasuje` odrzuca promocję z PUSTYM `zasieg`,
         * więc pusty napis dałby promocję, która nie obniża niczego.
         */
        const zasieg = globalna
          ? "globalny"
          : listaWarunkow.map((w) => `${w.typ}:${w.wartosc}`).join(" + ");

        if (edytowanaPromocja) {
          // PATCH wysyła SIEDEM pól — bez `status` (`Eb()`, `:9369-9390`). Status promocji
          // ustala serwer przy tworzeniu, a etykietę na liście liczymy z dat (plan.md D5).
          const wynik = await zapiszPromocje(edytowanaPromocja.id, {
            nazwa,
            warunki: serializowane,
            zasieg,
            rabatPct: liczba,
            priorytet,
            start: startIso,
            koniec: koniecIso,
          });
          // 200 z PUSTYM ciałem znaczy „nie ma takiej promocji" — patrz `api.ts`.
          if (wynik === null) throw new Error("Promocja nie istnieje — mogła zostać usunięta.");
          return wynik;
        }

        // POST dokłada `status` wyliczony z dat — `Cb()` (`:9324`).
        return await dodajPromocje({
          nazwa,
          warunki: serializowane,
          zasieg,
          rabatPct: liczba,
          priorytet,
          start: startIso,
          koniec: koniecIso,
          status: statusZDat(startIso, koniecIso),
        });
      }

      // `typ`/`zakres` z PIERWSZEGO warunku; przy globalnej — „globalny"/"" (`:24623-24624`).
      // Fallback typu to „marka", nie „globalny" — dosłownie jak oryginał.
      const pierwszy = listaWarunkow[0];
      const typ = globalna ? "globalny" : (pierwszy?.typ ?? "marka");
      const zakres = globalna ? "" : (pierwszy?.wartosc ?? "");

      if (edytowanyNarzut) {
        // PATCH wysyła SZEŚĆ pól — bez `jednostka` i `status` (`Ag()` woła `{...t}`, `:9267`).
        // Pominięcie `status` jest istotne: przełącznik w tabeli nie może zostać cofnięty
        // przez zapis z formularza, który o statusie nic nie wie.
        return await zapiszNarzut(edytowanyNarzut.id, {
          nazwa,
          warunki: serializowane,
          typ,
          zakres,
          wartosc: liczba,
          priorytet,
        });
      }

      return await dodajNarzut({
        nazwa,
        warunki: serializowane,
        typ,
        zakres,
        wartosc: liczba,
        priorytet,
        jednostka: "procent",
        status: STATUS_NARZUTU_AKTYWNY,
      });
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

  /**
   * Produkty, które po tej promocji zjadą pod cenę zakupu — liczone NA ŻYWO, przy każdej
   * zmianie formularza. Oryginał pokazuje z tego czerwony pasek pod polem wartości
   * (`:24473-24513`) i NIEZALEŻNIE pyta o potwierdzenie przy zapisie (`:24563-24597`),
   * tą samą metodą. Zachowujemy oba.
   */
  const ponizejKosztu =
    tryb === "promocja"
      ? produktyPonizejKosztu(
          katalog,
          globalna ? [] : warunki.filter((w) => w.wartosc.trim()),
          globalna,
          Number(wartosc),
        )
      : [];

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

    // Kontrola „poniżej kosztu" przy ZAPISIE — port `:24563-24597`. U nas własnym dialogiem
    // zamiast `window.confirm` (plan.md D6): tamten blokuje wątek i nie da się go przetestować.
    if (tryb === "promocja" && ponizejKosztu.length > 0) {
      ustawDoPotwierdzenia(ponizejKosztu);
      return;
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
            // Nowa reguła: jeden pusty warunek, „globalna" ODZNACZONA (`:24221`).
            ustawWarunki([PIERWSZY_WARUNEK]);
            ustawGlobalna(false);
            ustawWartosc(String(DOMYSLNA_WARTOSC[trybInicjalny]));
            ustawPriorytet(50);
            ustawStart(dzisiaj());
            ustawKoniec(zaMiesiac());
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

            {/*
              Czerwony pasek NA ŻYWO — port `:24473-24513`. Osobny od potwierdzenia przy
              zapisie i celowo: pokazuje skutek JUŻ przy wpisywaniu rabatu, zanim ktokolwiek
              kliknie „Zapisz". Liczony tą samą metodą co potwierdzenie.
            */}
            {tryb === "promocja" && ponizejKosztu.length > 0 ? (
              <div
                className="p-2 rounded border border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs"
                data-testid="ostrzezenie-ponizej-kosztu"
              >
                <div className="font-semibold">
                  ⚠ UWAGA: {ponizejKosztu.length} produkt(ów) będzie miało cenę sprzedaży
                  PONIŻEJ ceny zakupu
                </div>
              </div>
            ) : null}

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
            {/* Format wiersza i próg „pierwszych dziesięć" 1:1 z oryginałem (`:24596`). */}
            <ul className="max-h-48 overflow-y-auto text-xs font-mono space-y-0.5">
              {doPotwierdzenia?.slice(0, 10).map((p) => (
                <li key={String(p.produkt.kod)}>
                  • {String(p.produkt.marka ?? "")} {String(p.produkt.kod ?? "")} — zakup{" "}
                  {Number(p.produkt.cenaZakupu).toFixed(2)} zł, po rabacie{" "}
                  {p.poRabacie.toFixed(2)} zł
                </li>
              ))}
            </ul>
            {doPotwierdzenia && doPotwierdzenia.length > 10 ? (
              <p className="text-xs text-muted-foreground">
                …i {doPotwierdzenia.length - 10} więcej.
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
