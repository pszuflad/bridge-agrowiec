/**
 * Panel kolejki „Do akceptacji” — port `renderPendingPanel()` i `handlePendingAction()`
 * (`mirror/frontend/assets/pending-injection.js:892-1088`).
 *
 * ⚠ BEZ PAGINACJI I WIRTUALIZACJI, jak oryginał (plan.md D6). `GET /api/atrybuty/pending`
 * nie ma ani limitu, ani stronicowania — nagranie produkcji to 498 pozycji, a backend liczy
 * dla każdej Levenshteina wobec CAŁEGO słownika danego rodzaju. Jeśli ekran wolno się ładuje,
 * przyczyna jest po stronie backendu, nie tutaj. Filtr rodzaju, szukajka i licznik
 * „Wyświetlono X z Y” działają po stronie klienta — też jak oryginał.
 *
 * TRZY WARIANTY AKCEPTACJI RÓŻNIĄ SIĘ SKUTKAMI, nie kształtem odpowiedzi:
 *  - `Akceptuj` — wartość ląduje w słowniku, `products` NIETKNIĘTE;
 *  - `Edytuj` (`akceptuj-z-edycja`) — masowy `UPDATE products` ORAZ wartość do słownika;
 *  - chip aliasu (`akceptuj-jako-alias`) — masowy `UPDATE products`, do słownika NIC nie wchodzi;
 *    nie ma tabeli aliasów, więc samo mapowanie nigdzie nie zostaje;
 *  - `Odrzuć` — wpis do `atrybuty_wartosci_odrzucone`, kolejne skany pomijają wartość.
 *
 * ⚠ OSTRZEŻENIE O SKALI ZMIANY (odstępstwo D7, dodanie informacji): dwie akcje przepisują pole
 * w CAŁYM katalogu, a backend NIE loguje ich do audytu — `registerPending` nie dostaje funkcji
 * audytu w ogóle (`pending_module.cjs:199`, `docs/rebuild-backlog.md` #39, ⬜ do decyzji).
 * Po fakcie nie da się ustalić, kto i co przepisał, więc dialog pokazuje liczbę produktów
 * PRZED zatwierdzeniem, a toast — `produktow_zaktualizowano` z odpowiedzi.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { DialogTekstu } from "@/components/DialogTekstu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  akceptuj,
  akceptujJakoAlias,
  akceptujZEdycja,
  komunikatBledu,
  odrzuc,
  pobierzUzycie,
  wyczyscPending,
  type OdpowiedzUzycia,
  type PozycjaPending,
  type WynikAkcjiPending,
} from "./api";

const WSZYSTKIE = "all";

/** Ostrzeżenie dopisywane do obu pytań o wyczyszczenie — 1:1 z oryginałem (`:929`, `:1004`). */
const OSTRZEZENIE_CZYSZCZENIA =
  "UWAGA: to nie jest trwałe odrzucenie — jeśli te same wartości pojawią się w kolejnym imporcie, wrócą tutaj do ponownej akceptacji.";

/** Liczba produktów, które realnie dostanie masowy UPDATE — patrz nota D7 w nagłówku pliku. */
function OstrzezenieOSkali({ pozycja }: { pozycja: PozycjaPending }) {
  const { data } = useQuery<OdpowiedzUzycia>({
    queryKey: ["/api/atrybuty/uzycie", pozycja.rodzaj, pozycja.wartosc],
    queryFn: () => pobierzUzycie(pozycja.rodzaj, pozycja.wartosc),
  });
  // Do czasu odpowiedzi pokazujemy licznik ze skanu kolejki — jest zawsze pod ręką.
  const ile = data?.count ?? pozycja.ile_wystapien;

  return (
    <div
      className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      data-testid="ostrzezenie-skala-zmiany"
    >
      Zmiana przepisze pole <b className="text-foreground">{pozycja.rodzaj}</b> w{" "}
      <b className="text-foreground">{ile}</b> produktach katalogu. Operacji nie da się cofnąć
      ani odtworzyć z dziennika — akcje kolejki nie trafiają do audytu.
    </div>
  );
}

export function PanelPending({
  pozycje,
  blad,
  ladowanie,
  onPodglad,
}: {
  pozycje: PozycjaPending[];
  blad: string | null;
  ladowanie: boolean;
  onPodglad: (rodzaj: string, wartosc: string) => void;
}) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [filtr, ustawFiltr] = useState<string>(WSZYSTKIE);
  const [szukaj, ustawSzukaj] = useState("");
  const [edytowana, ustawEdytowana] = useState<PozycjaPending | null>(null);
  const [odrzucana, ustawOdrzucana] = useState<PozycjaPending | null>(null);
  const [alias, ustawAlias] = useState<{ pozycja: PozycjaPending; kanoniczna: string } | null>(null);
  const [czyszczenie, ustawCzyszczenie] = useState<"wszystkie" | "rodzaj" | null>(null);

  /**
   * Akcja kolejki zmienia i kolejkę, i słownik (akceptacja dopisuje wartość), a dwa warianty
   * dodatkowo przepisują produkty — stąd trzy unieważnienia.
   */
  const odswiez = () => {
    void klient.invalidateQueries({ queryKey: ["/api/atrybuty/pending"] });
    void klient.invalidateQueries({ queryKey: ["/api/atrybuty"] });
    void klient.invalidateQueries({ queryKey: ["/api/products"] });
  };

  const zglosBlad = (e: unknown) =>
    toast({ title: `Błąd: ${komunikatBledu(e)}`, variant: "destructive" });

  /** Toast akcji masowej dostaje liczbę przepisanych produktów (D7). */
  const opisZmiany = (wynik: WynikAkcjiPending) =>
    wynik.produktow_zaktualizowano != null
      ? { description: `Zaktualizowano produktów: ${wynik.produktow_zaktualizowano}` }
      : {};

  const akceptacja = useMutation<WynikAkcjiPending, Error, PozycjaPending>({
    mutationFn: (pozycja) => akceptuj(pozycja.id),
    onSuccess: (_wynik, pozycja) => {
      odswiez();
      toast({ title: `Zaakceptowano: ${pozycja.wartosc}` });
    },
    onError: zglosBlad,
  });

  const akceptacjaZEdycja = useMutation<
    WynikAkcjiPending,
    Error,
    { pozycja: PozycjaPending; nowa: string }
  >({
    mutationFn: ({ pozycja, nowa }) => akceptujZEdycja(pozycja.id, nowa),
    onSuccess: (wynik, { nowa }) => {
      odswiez();
      ustawEdytowana(null);
      toast({ title: `Zapisano: ${nowa}`, ...opisZmiany(wynik) });
    },
    onError: zglosBlad,
  });

  const akceptacjaAliasu = useMutation<
    WynikAkcjiPending,
    Error,
    { pozycja: PozycjaPending; kanoniczna: string }
  >({
    mutationFn: ({ pozycja, kanoniczna }) => akceptujJakoAlias(pozycja.id, kanoniczna),
    onSuccess: (wynik, { pozycja, kanoniczna }) => {
      odswiez();
      ustawAlias(null);
      toast({ title: `Alias: ${pozycja.wartosc} → ${kanoniczna}`, ...opisZmiany(wynik) });
    },
    onError: (e) => {
      ustawAlias(null);
      zglosBlad(e);
    },
  });

  const odrzucenie = useMutation<
    WynikAkcjiPending,
    Error,
    { pozycja: PozycjaPending; powod: string }
  >({
    mutationFn: ({ pozycja, powod }) => odrzuc(pozycja.id, powod),
    onSuccess: (_wynik, { pozycja }) => {
      odswiez();
      ustawOdrzucana(null);
      toast({ title: `Odrzucono: ${pozycja.wartosc}` });
    },
    onError: zglosBlad,
  });

  const czyszczenieKolejki = useMutation<{ usunieto: number }, Error, string | undefined>({
    mutationFn: (rodzaj) => wyczyscPending(rodzaj),
    onSuccess: (wynik, rodzaj) => {
      odswiez();
      ustawCzyszczenie(null);
      // Po wyczyszczeniu rodzaju oryginał wraca filtrem na „Wszystkie” (`:1011`).
      if (rodzaj) ustawFiltr(WSZYSTKIE);
      toast({
        title: rodzaj
          ? `Wyczyszczono ${wynik.usunieto} pozycji pending (${rodzaj})`
          : `Wyczyszczono ${wynik.usunieto} pozycji pending`,
      });
    },
    onError: (e) => {
      ustawCzyszczenie(null);
      zglosBlad(e);
    },
  });

  const rodzaje = [...new Set(pozycje.map((p) => p.rodzaj))].sort();
  const ileWRodzaju = (rodzaj: string) => pozycje.filter((p) => p.rodzaj === rodzaj).length;

  const widoczne = pozycje.filter((pozycja) => {
    if (filtr !== WSZYSTKIE && pozycja.rodzaj !== filtr) return false;
    if (szukaj && !(pozycja.wartosc || "").toLowerCase().includes(szukaj.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (blad) {
    return (
      <div className="p-8 text-center text-sm text-destructive" data-testid="text-blad-pending">
        Błąd: {blad}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <label htmlFor="filtr-pending" className="text-xs text-muted-foreground">
          Rodzaj:
        </label>
        {/*
         * Zwykły `<select>`, nie Radix — filtr ma tu tyle pozycji, ile rodzajów w kolejce,
         * i musi pokazywać liczniki w etykiecie; oryginał też używa natywnego selecta.
         */}
        <select
          id="filtr-pending"
          value={filtr}
          onChange={(zdarzenie) => ustawFiltr(zdarzenie.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          data-testid="select-filtr-pending"
        >
          <option value={WSZYSTKIE}>Wszystkie ({pozycje.length})</option>
          {rodzaje.map((rodzaj) => (
            <option key={rodzaj} value={rodzaj}>
              {rodzaj} ({ileWRodzaju(rodzaj)})
            </option>
          ))}
        </select>

        <Input
          value={szukaj}
          onChange={(zdarzenie) => ustawSzukaj(zdarzenie.target.value)}
          placeholder="Szukaj wartości..."
          className="w-56"
          data-testid="input-szukaj-pending"
        />

        <div className="text-xs text-muted-foreground" data-testid="text-licznik-pending">
          Wyświetlono: <span className="font-semibold text-primary">{widoczne.length}</span> z{" "}
          {pozycje.length}
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filtr === WSZYSTKIE || czyszczenieKolejki.isPending}
            title={
              filtr === WSZYSTKIE ? "Wybierz konkretny rodzaj z filtra powyżej" : undefined
            }
            onClick={() => ustawCzyszczenie("rodzaj")}
            data-testid="button-wyczysc-rodzaj"
          >
            Wyczyść pending: {filtr === WSZYSTKIE ? "—" : filtr}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pozycje.length === 0 || czyszczenieKolejki.isPending}
            onClick={() => ustawCzyszczenie("wszystkie")}
            data-testid="button-wyczysc-wszystkie"
          >
            Wyczyść wszystkie pending ({pozycje.length})
          </Button>
        </div>
      </div>

      {ladowanie ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
      ) : widoczne.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground" data-testid="text-pusta-kolejka">
          Brak wartości do akceptacji
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Rodzaj</th>
                <th className="px-4 py-2 font-medium">Wartość</th>
                <th className="px-4 py-2 font-medium">Wystąpień</th>
                <th className="px-4 py-2 font-medium">Sugerowane aliasy</th>
                <th className="px-4 py-2 font-medium text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {widoczne.map((pozycja) => (
                <tr
                  key={pozycja.id}
                  className="border-t border-border hover:bg-muted/30"
                  data-testid={`wiersz-pending-${pozycja.id}`}
                >
                  <td className="px-4 py-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{pozycja.rodzaj}</span>
                  </td>
                  <td className="px-4 py-2 font-medium">{pozycja.wartosc}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => onPodglad(pozycja.rodzaj, pozycja.wartosc)}
                      title="Pokaż produkty w katalogu"
                      className="rounded bg-muted px-2 py-0.5 text-xs tabular-nums hover:bg-muted/70"
                      data-testid={`button-wystapienia-${pozycja.id}`}
                    >
                      {pozycja.ile_wystapien || 0}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    {pozycja.sugerowane_aliasy.length === 0 ? (
                      <span className="text-xs text-muted-foreground">brak podobnych</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {pozycja.sugerowane_aliasy.map((sugestia) => (
                          <button
                            key={sugestia.wartosc}
                            type="button"
                            onClick={() =>
                              ustawAlias({ pozycja, kanoniczna: sugestia.wartosc })
                            }
                            className="rounded border border-border px-2 py-0.5 text-xs hover:border-primary hover:bg-muted"
                            data-testid={`chip-alias-${pozycja.id}-${sugestia.wartosc}`}
                          >
                            {sugestia.wartosc} ({sugestia.podobienstwo}%)
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => akceptacja.mutate(pozycja)}
                        disabled={akceptacja.isPending}
                        data-testid={`button-akceptuj-${pozycja.id}`}
                      >
                        Akceptuj
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => ustawEdytowana(pozycja)}
                        data-testid={`button-edytuj-pending-${pozycja.id}`}
                      >
                        Edytuj
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => ustawOdrzucana(pozycja)}
                        data-testid={`button-odrzuc-${pozycja.id}`}
                      >
                        Odrzuć
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Akceptacja z edycją — masowy UPDATE products, stąd ostrzeżenie o skali (D7). */}
      <DialogTekstu
        otwarty={edytowana !== null}
        tytul="Akceptuj z edycją"
        etykieta={edytowana ? `Edytuj wartość dla rodzaju "${edytowana.rodzaj}":` : ""}
        opis={
          edytowana
            ? `Wartość trafi do słownika, a wszystkie produkty z „${edytowana.wartosc}” zostaną przepisane na nową.`
            : undefined
        }
        wartoscPoczatkowa={edytowana?.wartosc ?? ""}
        etykietaZapisu="Zapisz"
        zajety={akceptacjaZEdycja.isPending}
        onZatwierdz={(tekst) => {
          // Oryginał nie wysyła żądania przy pustej i przy niezmienionej wartości (`:1074`).
          if (!edytowana || tekst === edytowana.wartosc) {
            ustawEdytowana(null);
            return;
          }
          akceptacjaZEdycja.mutate({ pozycja: edytowana, nowa: tekst });
        }}
        onZamknij={() => ustawEdytowana(null)}
        testId="dialog-akceptuj-z-edycja"
      >
        {edytowana && <OstrzezenieOSkali pozycja={edytowana} />}
      </DialogTekstu>

      {/* Powód odrzucenia jest OPCJONALNY — oryginał robi `prompt(...) || ""` (`:1067`). */}
      <DialogTekstu
        otwarty={odrzucana !== null}
        tytul="Odrzuć wartość"
        etykieta="Powód odrzucenia (opcjonalnie):"
        opis={
          odrzucana
            ? `Wartość „${odrzucana.wartosc}” trafi na listę odrzuconych i kolejne skany będą ją pomijać.`
            : undefined
        }
        etykietaZapisu="Odrzuć"
        wymagana={false}
        zajety={odrzucenie.isPending}
        onZatwierdz={(powod) => {
          if (odrzucana) odrzucenie.mutate({ pozycja: odrzucana, powod });
        }}
        onZamknij={() => ustawOdrzucana(null)}
        testId="dialog-odrzuc-pending"
      />

      {/* Alias — też masowy UPDATE products, a do słownika NIC nie wchodzi. */}
      <DialogPotwierdzenia
        otwarty={alias !== null}
        tytul="Akceptuj jako alias"
        tresc={
          alias ? `Zmapować "${alias.pozycja.wartosc}" jako alias dla "${alias.kanoniczna}"?` : ""
        }
        etykietaPotwierdzenia="Zmapuj"
        zajety={akceptacjaAliasu.isPending}
        onPotwierdz={() => alias && akceptacjaAliasu.mutate(alias)}
        onZamknij={() => ustawAlias(null)}
        testId="dialog-akceptuj-alias"
      >
        {alias && (
          <>
            <OstrzezenieOSkali pozycja={alias.pozycja} />
            <p className="text-xs text-muted-foreground">
              Do słownika nie trafi nic — mapowanie nie jest nigdzie zapisywane, zmieniają się
              wyłącznie produkty.
            </p>
          </>
        )}
      </DialogPotwierdzenia>

      <DialogPotwierdzenia
        otwarty={czyszczenie !== null}
        tytul="Wyczyść kolejkę"
        tresc={
          czyszczenie === "rodzaj"
            ? `Wyczyścić ${ileWRodzaju(filtr)} pozycji pending dla rodzaju "${filtr}"?\n\n${OSTRZEZENIE_CZYSZCZENIA}`
            : `Wyczyścić WSZYSTKIE ${pozycje.length} pozycji z listy pending?\n\n${OSTRZEZENIE_CZYSZCZENIA}`
        }
        etykietaPotwierdzenia="Wyczyść"
        wariantPotwierdzenia="destructive"
        zajety={czyszczenieKolejki.isPending}
        onPotwierdz={() =>
          czyszczenieKolejki.mutate(czyszczenie === "rodzaj" ? filtr : undefined)
        }
        onZamknij={() => ustawCzyszczenie(null)}
        testId="dialog-wyczysc-pending"
      />
    </>
  );
}
