/**
 * Zakładka „Dostawcy" — port karty `ZT()` (`deminified/frontend-index.js:25661-25806`)
 * i sekcji `Wn value="dostawcy"` (`:26339-26352`), POSZERZONY o edycję pól.
 *
 * Co jest portem 1:1: układ karty, `data-testid="supplier-config-<KOD>"`,
 * `data-testid="button-sync-<KOD>"`, odznaki (format pliku, sposób dostarczania,
 * „co X min", status), link do URL-a, licznik produktów, akcja „Synchronizuj" oraz
 * — od I14/14c — przycisk „Wgraj plik" dla dostawców `upload` i `mail`
 * (`:25756-25802`, potwierdzony w ŻYWYM bundlu, nie tylko w deminifikacie z 13.08).
 *
 * Co dochodzi: EDYCJA. Oryginalna karta częstotliwość tylko wyświetla — nie ma w niej
 * żadnej ścieżki zapisu i właśnie dlatego powstał `mirror/frontend/assets/freq-injection.js`,
 * dogrywający przycisk „Zmień" do DOM-u obok bundla React. Wchłaniamy go tutaj: presety,
 * etykiety, REGUŁA ODSŁANIANIA pola minut i zakotwiczenie w karcie są jego, znika warstwa
 * manipulacji DOM-em i mapa `kod → id`, bo w Reakcie mamy cały rekord dostawcy pod ręką.
 *
 * Trzy świadome odstępstwa od produkcji, wszystkie zatwierdzone w 14c i opisane w miejscu,
 * w którym występują: treść toasta uploadu (produkcja pokazuje „undefined"), wartość
 * początkowa selectu częstotliwości przy braku harmonogramu, reset pola wyboru pliku.
 *
 * ⚠ `liczbaProduktow` z `GET /api/dostawcy` jest liczona W LOCIE z tabeli `products`
 * (backend `repos/suppliers.ts`), więc PO imporcie zostaje zerowa do czasu zatwierdzenia
 * stagingu. Podpis pod nią mówi wprost „w katalogu" — świeżość importu widać po
 * „ostatnia próba", nie po tej liczbie.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { BAZA_API, naglowki } from "@/lib/api";
import {
  formatujCzestotliwosc,
  formatujZnacznik,
  PRESETY_CZESTOTLIWOSCI,
  synchronizujTeraz,
  zapiszDostawce,
  type DostawcaKonfiguracji,
  type PatchDostawcy,
  type WynikSynchronizacji,
} from "./dostawcy";

const SPOSOBY_DOSTARCZANIA = ["url", "mail", "upload"] as const;
const STATUSY = ["aktywny", "wstrzymany", "blad"] as const;

const ETYKIETY_STATUSU: Record<string, string> = {
  aktywny: "aktywny",
  blad: "błąd",
  wstrzymany: "wstrzymany",
};

/** Odznaka statusu — warianty 1:1 z oryginałem (`:25696-25706`). */
function OdznakaStatusu({ status }: { status: string }) {
  if (status === "aktywny") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">
        {ETYKIETY_STATUSU.aktywny}
      </Badge>
    );
  }
  if (status === "blad") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        {ETYKIETY_STATUSU.blad}
      </Badge>
    );
  }
  if (status === "wstrzymany") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        {ETYKIETY_STATUSU.wstrzymany}
      </Badge>
    );
  }
  return null;
}

/** Wspólne klasy dla natywnego `<select>` — ten sam wygląd co `Input`. */
const KLASY_SELECT =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Odpowiedź `POST /api/dostawcy/{kod}/upload` — tyle pól, ile karta realnie czyta.
 * Kształt z `rebuild/backend/src/routes/suppliers.ts` (`{ok, nazwaPliku, liczbaProduktow,
 * ...statystyki, podglad}`), zgodny z oryginałem (`mirror/backend/index.cjs`, wynik `tk()`).
 */
type WynikUploaduKarty = {
  ok: boolean;
  nazwaPliku: string;
  liczbaProduktow: number;
  nowe: number;
  zmienione: number;
};

/**
 * Upload pliku z KARTY dostawcy — port `:25756-25802` (potwierdzony w ŻYWYM bundlu
 * `mirror/frontend/assets/index-PRICEFMT1783512500.js`, nie tylko w deminifikacie z 13.08).
 *
 * ⚠ To ŚWIADOMIE osobna, samodzielna implementacja — nie współdzieli kodu z dialogiem zakładki
 * „Wgrywanie ręczne" (`wgrywanie.ts`), bo tamten plik należy do innej, równolegle idącej karty
 * i sięgnięcie do niego złamałoby rozłączność. Duplikacja jest tu tańsza niż sprzężenie.
 *
 * `naglowki(false)`, nie `true`: `Content-Type` musi ustawić przeglądarka, razem z `boundary` —
 * dopisanie `application/json` rozwaliłoby multipart.
 */
async function wgrajPlikDostawcy(kod: string, plik: File): Promise<WynikUploaduKarty> {
  const dane = new FormData();
  dane.append("plik", plik);

  const odpowiedz = await fetch(`${BAZA_API}/api/dostawcy/${encodeURIComponent(kod)}/upload`, {
    method: "POST",
    body: dane,
    headers: naglowki(false),
    credentials: "include",
  });

  const cialo = (await odpowiedz.json().catch(() => ({}))) as Partial<WynikUploaduKarty> & {
    error?: string;
  };

  // Powód porażki siedzi w ciele (`error`) — bez tego Ania zobaczyłaby samo „500" zamiast
  // informacji, na czym parser się wywrócił. Oryginał robi to samo (`o.error || "Błąd uploadu"`).
  if (!odpowiedz.ok) {
    throw new Error(cialo?.error || "Błąd uploadu");
  }
  return cialo as WynikUploaduKarty;
}

type StanEdycji = {
  url: string;
  czestotliwosc: string;
  sposobDostarczania: string;
  status: string;
  /**
   * Czy select częstotliwości stoi na „Inna wartość (minuty)…". Pole liczbowe jest widoczne
   * DOKŁADNIE wtedy, gdy to jest `true` — patrz komentarz przy selekcie.
   */
  inna: boolean;
};

/** Czy wartość jest jednym z presetów — decyduje, czy select pokaże preset, czy „Inna wartość". */
function jestPresetem(minuty: number | null): boolean {
  return minuty !== null && PRESETY_CZESTOTLIWOSCI.some((m) => m === minuty);
}

function stanZDostawcy(d: DostawcaKonfiguracji): StanEdycji {
  return {
    url: d.url ?? "",
    czestotliwosc: d.czestotliwoscMinuty == null ? "" : String(d.czestotliwoscMinuty),
    sposobDostarczania: d.sposobDostarczania,
    status: d.status,
    // Preset → select pokazuje ten preset, pole minut schowane. Wartość spoza presetów ORAZ brak
    // harmonogramu → „Inna wartość" z widocznym polem (to drugie jest odstępstwem, patrz select).
    inna: !jestPresetem(d.czestotliwoscMinuty),
  };
}

function KartaDostawcy({ dostawca }: { dostawca: DostawcaKonfiguracji }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [edycja, ustawEdycje] = useState<StanEdycji | null>(null);
  const [komunikat, ustawKomunikat] = useState<{ tresc: string; blad: boolean } | null>(null);
  const polePliku = useRef<HTMLInputElement>(null);

  const odswiez = () => {
    void klient.invalidateQueries({ queryKey: ["/api/dostawcy"] });
    void klient.invalidateQueries({ queryKey: ["/api/staging"] });
  };

  const synchronizacja = useMutation<WynikSynchronizacji, Error>({
    mutationFn: () => synchronizujTeraz(dostawca.kod),
    onSuccess: (wynik) => {
      // 200 z `ok: false` to NIE jest sukces dla użytkownika — trasa sygnalizuje awarię
      // ciałem, nie kodem HTTP. Rozdzielamy to tutaj, jak oryginalna karta (`:25727`).
      ustawKomunikat(
        wynik.ok
          ? { tresc: `Pobrano ${wynik.liczbaProduktow} produktów`, blad: false }
          : { tresc: `Błąd synchronizacji: ${wynik.error}`, blad: true },
      );
      odswiez();
    },
    onError: (e) => ustawKomunikat({ tresc: e.message, blad: true }),
  });

  /**
   * Wynik uploadu idzie TOASTEM, jak w oryginale — nie linijką `komunikat`, którą ta karta
   * zawdzięcza przerobieniu synchronizacji we wcześniejszej sesji. Dwa kanały na jednej karcie
   * są przyjęte świadomie (plan.md D4): upload odtwarzamy 1:1, synchronizacji nie cofamy.
   */
  const upload = useMutation<WynikUploaduKarty, Error, File>({
    mutationFn: (plik) => wgrajPlikDostawcy(dostawca.kod, plik),
    onSuccess: (wynik) => {
      // ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D1). Oryginał składa ten opis z `o.nowych` i `o.zmian`,
      // a trasa NIGDY takich pól nie zwracała — ani oryginalna (`tk()` w `mirror/backend/index.cjs`),
      // ani nasza (`routes/suppliers.ts`). Obie oddają `nowe` i `zmienione`, więc produkcja do dziś
      // wyświetla „undefined nowych, undefined zmian". Czytamy pola, które realnie przychodzą.
      toast({
        title: "Plik wczytany",
        description: `${wynik.liczbaProduktow} produktów, ${wynik.nowe} nowych, ${wynik.zmienione} zmienionych`,
      });
      odswiez();
    },
    onError: (e) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const zapis = useMutation<DostawcaKonfiguracji, Error, PatchDostawcy>({
    mutationFn: (patch) => zapiszDostawce(dostawca.id, patch),
    onSuccess: () => {
      ustawEdycje(null);
      ustawKomunikat({ tresc: "Zapisano", blad: false });
      odswiez();
    },
    onError: (e) => ustawKomunikat({ tresc: `Błąd zapisu: ${e.message}`, blad: true }),
  });

  const zapisz = () => {
    if (!edycja) return;
    const minuty = edycja.czestotliwosc.trim();
    // Walidacja z `freq-injection.js:167-171`: pusto = „bez harmonogramu" (null),
    // ale liczba musi być dodatnia — 0 albo tekst nie mają sensu jako interwał.
    let czestotliwoscMinuty: number | null = null;
    if (minuty !== "") {
      const liczba = Number.parseInt(minuty, 10);
      if (!Number.isFinite(liczba) || liczba < 1) {
        ustawKomunikat({ tresc: "Częstotliwość musi być liczbą minut ≥ 1", blad: true });
        return;
      }
      czestotliwoscMinuty = liczba;
    }
    zapis.mutate({
      url: edycja.url.trim() === "" ? null : edycja.url.trim(),
      czestotliwoscMinuty,
      sposobDostarczania: edycja.sposobDostarczania,
      status: edycja.status,
    });
  };

  // Oryginał dzieli JEDEN stan zajętości między synchronizację i upload (`:25727`, `:25764`),
  // więc w trakcie wysyłki gasną oba przyciski.
  const zajety = synchronizacja.isPending || zapis.isPending || upload.isPending;

  return (
    <div
      className="border border-border rounded-md p-3 flex flex-col gap-2 bg-card"
      data-testid={`supplier-config-${dostawca.kod}`}
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="font-mono font-semibold w-16">{dostawca.kod}</div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{dostawca.nazwa}</div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">{dostawca.email}</div>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {dostawca.formatPliku.toUpperCase()}
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          {dostawca.sposobDostarczania}
        </Badge>
        {dostawca.czestotliwoscMinuty ? (
          <Badge
            variant="outline"
            className="font-mono text-[10px]"
            data-testid={`freq-${dostawca.kod}`}
          >
            co {formatujCzestotliwosc(dostawca.czestotliwoscMinuty)}
          </Badge>
        ) : null}
        <OdznakaStatusu status={dostawca.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-20">
        {dostawca.url ? (
          <a
            href={dostawca.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-muted-foreground font-mono truncate max-w-[300px] hover:text-foreground"
          >
            {dostawca.url}
          </a>
        ) : null}
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground" data-testid={`sync-${dostawca.kod}`}>
          ostatnia próba: {formatujZnacznik(dostawca.ostatniaSync)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {dostawca.liczbaProduktow} produktów w katalogu
        </span>
        {dostawca.sposobDostarczania === "url" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={zajety}
            onClick={() => {
              ustawKomunikat(null);
              synchronizacja.mutate();
            }}
            data-testid={`button-sync-${dostawca.kod}`}
          >
            {/*
             * „Synchronizuj", nie „Synchronizuj teraz" — etykieta zweryfikowana w ŻYWYM bundlu
             * produkcji (`mirror/frontend/assets/index-PRICEFMT1783512500.js`), nie tylko
             * w deminifikacie z 13.08. Stan ładowania zostaje tekstowy: oryginał animuje ikonę
             * zamiast zmieniać napis, ale ikon ta odbudowa nie przeniosła (wcześniejsza sesja).
             */}
            {synchronizacja.isPending ? "Synchronizuję…" : "Synchronizuj"}
          </Button>
        ) : null}
        {dostawca.sposobDostarczania === "upload" || dostawca.sposobDostarczania === "mail" ? (
          <>
            <input
              ref={polePliku}
              type="file"
              accept=".csv,.xml,.xlsx"
              className="hidden"
              data-testid={`input-file-${dostawca.kod}`}
              onChange={(e) => {
                const plik = e.target.files?.[0];
                // ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D6): oryginał NIE czyści inputa, więc wgranie
                // tego samego pliku drugi raz z rzędu nie wywołuje `onChange` i przycisk wygląda
                // na zepsuty. Czyścimy OD RAZU, także gdy wyboru nie było (anulowanie okna).
                e.target.value = "";
                if (plik) upload.mutate(plik);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={zajety}
              onClick={() => polePliku.current?.click()}
              data-testid={`button-upload-${dostawca.kod}`}
            >
              Wgraj plik
            </Button>
          </>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={zajety}
          onClick={() => {
            ustawKomunikat(null);
            ustawEdycje((biezaca) => (biezaca ? null : stanZDostawcy(dostawca)));
          }}
          data-testid={`button-edit-${dostawca.kod}`}
        >
          {edycja ? "Anuluj" : "Zmień"}
        </Button>
      </div>

      {komunikat ? (
        <p
          className={`text-[11px] ${komunikat.blad ? "text-destructive" : "text-muted-foreground"}`}
          data-testid={`komunikat-${dostawca.kod}`}
        >
          {komunikat.tresc}
        </p>
      ) : null}

      {edycja ? (
        <div
          className="grid gap-3 sm:grid-cols-2 border-t border-border pt-3 mt-1"
          data-testid={`edycja-${dostawca.kod}`}
        >
          <div className="sm:col-span-2">
            <Label htmlFor={`url-${dostawca.kod}`} className="text-xs">
              Adres cennika (URL)
            </Label>
            <Input
              id={`url-${dostawca.kod}`}
              className="font-mono text-xs mt-1"
              value={edycja.url}
              placeholder="https://…"
              onChange={(e) => ustawEdycje({ ...edycja, url: e.target.value })}
              data-testid={`input-url-${dostawca.kod}`}
            />
          </div>

          <div>
            <Label htmlFor={`freq-select-${dostawca.kod}`} className="text-xs">
              Co ile sprawdzać cennik
            </Label>
            {/*
             * Natywny `<select>` z presetami i furtką „Inna wartość", jak w
             * `freq-injection.js:124-147`. Reguła widoczności pola minut jest oryginału:
             * widoczne DOKŁADNIE wtedy, gdy select stoi na „Inna wartość"
             * (`customInput.style.display = select.value === 'custom' ? 'block' : 'none'`).
             *
             * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D5) — jedno, w wartości POCZĄTKOWEJ. Skrypt Ani
             * był osobnym popoverem patchującym WYŁĄCZNIE `czestotliwoscMinuty`, a dla dostawcy
             * bez harmonogramu nie ustawiał `select.value` wcale, więc select zostawał na
             * pierwszej opcji („5 min"). Ten formularz zapisuje CZTERY pola naraz, więc ta sama
             * wartość początkowa znaczyłaby, że zmiana samego statusu po cichu włącza dostawcy
             * odpytywanie co 5 minut. Dlatego brak harmonogramu startuje na „Inna wartość"
             * z pustym polem — i tylko dzięki temu „puste = bez harmonogramu" (`null`) jest
             * nadal osiągalne. Oryginał czyszczenia harmonogramu nie umiał w ogóle: puste pole
             * wpadało w `if (!val || val < 1) return` (`:167-171`).
             */}
            <select
              id={`freq-select-${dostawca.kod}`}
              className={`${KLASY_SELECT} mt-1`}
              value={edycja.inna ? "inna" : edycja.czestotliwosc}
              onChange={(e) => {
                if (e.target.value === "inna") {
                  // Wartość zostaje — użytkownik ją teraz doprecyzuje w odsłoniętym polu.
                  ustawEdycje({ ...edycja, inna: true });
                  return;
                }
                ustawEdycje({ ...edycja, inna: false, czestotliwosc: e.target.value });
              }}
              data-testid={`select-freq-${dostawca.kod}`}
            >
              {PRESETY_CZESTOTLIWOSCI.map((m) => (
                <option key={m} value={String(m)}>
                  {formatujCzestotliwosc(m)}
                </option>
              ))}
              <option value="inna">Inna wartość (minuty)…</option>
            </select>
            {edycja.inna ? (
              <Input
                type="number"
                min="1"
                className="font-mono text-xs mt-1"
                placeholder="Liczba minut (pusto = bez harmonogramu)"
                value={edycja.czestotliwosc}
                onChange={(e) => ustawEdycje({ ...edycja, czestotliwosc: e.target.value })}
                data-testid={`input-freq-${dostawca.kod}`}
                aria-label={`Częstotliwość w minutach — ${dostawca.kod}`}
              />
            ) : null}
          </div>

          <div>
            <Label htmlFor={`sposob-${dostawca.kod}`} className="text-xs">
              Sposób dostarczania
            </Label>
            <select
              id={`sposob-${dostawca.kod}`}
              className={`${KLASY_SELECT} mt-1`}
              value={edycja.sposobDostarczania}
              onChange={(e) => ustawEdycje({ ...edycja, sposobDostarczania: e.target.value })}
              data-testid={`select-sposob-${dostawca.kod}`}
            >
              {SPOSOBY_DOSTARCZANIA.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <Label htmlFor={`status-${dostawca.kod}`} className="text-xs mt-2 block">
              Status
            </Label>
            <select
              id={`status-${dostawca.kod}`}
              className={`${KLASY_SELECT} mt-1`}
              value={edycja.status}
              onChange={(e) => ustawEdycje({ ...edycja, status: e.target.value })}
              data-testid={`select-status-${dostawca.kod}`}
            >
              {STATUSY.map((s) => (
                <option key={s} value={s}>
                  {ETYKIETY_STATUSU[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex gap-2">
            <Button size="sm" onClick={zapisz} disabled={zapis.isPending} data-testid={`button-save-${dostawca.kod}`}>
              {zapis.isPending ? "Zapisywanie…" : "Zapisz"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => ustawEdycje(null)}>
              Anuluj
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Dostawcy() {
  // Klucz `["/api/dostawcy"]`, nie `["/api/suppliers"]`: oryginał woła na tym ekranie
  // `/api/suppliers` (`:26283`), ale OBIE trasy są w backendzie tym samym handlerem
  // z identycznymi fixtures, a zakładka „wgrywanie" z 3f-1 stoi już na `/api/dostawcy`.
  // Jeden klucz na cały ekran znaczy jedno pobranie i jedną invalidację.
  const { data: dostawcy = [], isLoading } = useQuery<DostawcaKonfiguracji[]>({
    queryKey: ["/api/dostawcy"],
  });

  return (
    <Card className="border-card-border">
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium">Dostawcy ({dostawcy.length})</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Konfiguracja każdego źródła cennika — HTTP polling, ręczny upload lub mail
          </p>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Wczytywanie…</p>
        ) : (
          <div className="space-y-2">
            {dostawcy.map((d) => (
              <KartaDostawcy key={d.id} dostawca={d} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
