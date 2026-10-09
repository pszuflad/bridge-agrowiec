/**
 * „Uzupełnianie zdjęć" w zakładce Katalog — ticket 203 (NOWA logika, nie port).
 *
 * Najpierw PODGLĄD (nic nie jest zapisywane): lista produktów z pustym linkiem i linkiem, który
 * proponujemy (najczęstszy w katalogu dla tej samej marki i modelu). Człowiek odznacza to, co mu
 * nie pasuje, i dopiero „Zapisz wybrane" wpisuje linki. Zapisane linki są chronione przed
 * nadpisaniem przez kolejny import (poprawka Marty po stronie backendu).
 */
import { useQueryClient } from "@tanstack/react-query";
import { Image as IkonaZdjecia } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  podgladZdjec,
  zapiszZdjecia,
  type PodgladZdjec,
} from "./katalog";

export function UzupelnianieZdjec() {
  const [podglad, ustawPodglad] = useState<PodgladZdjec | null>(null);
  const [wybrane, ustawWybrane] = useState<Set<number>>(new Set());
  const [pracuje, ustawPracuje] = useState(false);
  const { toast } = useToast();
  const klientZapytan = useQueryClient();

  async function pokazPropozycje() {
    ustawPracuje(true);
    try {
      const wynik = await podgladZdjec();
      ustawPodglad(wynik);
      ustawWybrane(new Set(wynik.propozycje.map((p) => p.id)));
    } catch (blad) {
      ustawPodglad(null);
      toast({
        title: "Błąd podglądu zdjęć",
        description: blad instanceof Error ? blad.message : String(blad),
        variant: "destructive",
      });
    } finally {
      ustawPracuje(false);
    }
  }

  async function zapisz() {
    ustawPracuje(true);
    try {
      const wynik = await zapiszZdjecia([...wybrane]);
      toast({
        title: "Zdjęcia uzupełnione",
        description:
          `Uzupełniono ${wynik.zaktualizowano} linków` +
          (wynik.pominiete ? ` (pominięto ${wynik.pominiete} — dane zmieniły się od podglądu).` : "."),
      });
      ustawPodglad(null);
      void klientZapytan.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (blad) {
      toast({
        title: "Błąd zapisu zdjęć",
        description: blad instanceof Error ? blad.message : String(blad),
        variant: "destructive",
      });
    } finally {
      ustawPracuje(false);
    }
  }

  function przelacz(id: number) {
    ustawWybrane((poprzednie) => {
      const nastepne = new Set(poprzednie);
      if (nastepne.has(id)) nastepne.delete(id);
      else nastepne.add(id);
      return nastepne;
    });
  }

  return (
    <div className="border-t pt-3" data-testid="sekcja-uzupelnianie-zdjec">
      <h3 className="text-sm font-medium mb-0.5">Uzupełnianie zdjęć</h3>
      <p className="text-xs text-muted-foreground mb-2">
        Dla produktów bez linku do zdjęcia podpowiada link najczęściej używany przez inne produkty
        tej samej marki i modelu (rozmiar nie ma znaczenia). Najpierw zobaczysz listę propozycji —
        zapisują się tylko te, które zostawisz zaznaczone. Uzupełniony link jest chroniony przed
        nadpisaniem przez kolejny import dostawcy.
      </p>
      <Button
        variant="outline"
        onClick={() => void pokazPropozycje()}
        disabled={pracuje}
        data-testid="button-podglad-zdjec"
      >
        <IkonaZdjecia className="w-4 h-4 mr-2" />
        {pracuje && !podglad ? "Szukanie…" : "Pokaż propozycje zdjęć"}
      </Button>

      {podglad ? (
        <div className="mt-3 space-y-2" data-testid="podglad-zdjec">
          <p className="text-[11px] text-muted-foreground" data-testid="podglad-zdjec-podsumowanie">
            Produktów bez linku: {podglad.wszystkichPustych}. Propozycje: {podglad.propozycje.length}.
            Pominięto: {podglad.pominietoPoprawka} z poprawką linku, {podglad.pominietoBrakDanych}{" "}
            bez marki lub modelu, {podglad.pominietoBrakDopasowania} bez pasującego produktu z
            linkiem.
          </p>
          {podglad.wszystkichPustych > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              <Link
                href="/katalog?status=brak_zdjecia"
                className="underline hover:text-foreground"
                data-testid="link-brak-zdjecia"
              >
                Zobacz w katalogu produkty bez linku do zdjęcia ({podglad.wszystkichPustych})
              </Link>{" "}
              — do uzupełnienia ręcznie.
            </p>
          ) : null}

          {podglad.propozycje.length ? (
            <>
              <div className="max-h-80 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted text-left">
                    <tr>
                      <th className="p-1.5 w-8" />
                      <th className="p-1.5">Produkt</th>
                      <th className="p-1.5">Marka / model</th>
                      <th className="p-1.5">Proponowany link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {podglad.propozycje.map((p) => (
                      <tr key={p.id} className="border-t" data-testid={`propozycja-zdjecia-${p.id}`}>
                        <td className="p-1.5">
                          <input
                            type="checkbox"
                            checked={wybrane.has(p.id)}
                            onChange={() => przelacz(p.id)}
                            aria-label={`Uzupełnij zdjęcie: ${p.kod}`}
                            data-testid={`wybor-zdjecia-${p.id}`}
                          />
                        </td>
                        <td className="p-1.5">
                          <span className="font-mono">{p.kod}</span>
                          <br />
                          <span className="text-muted-foreground">{p.nazwa}</span>
                        </td>
                        <td className="p-1.5">
                          {p.marka} / {p.model}
                        </td>
                        <td className="p-1.5 break-all">
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            {p.link}
                          </a>
                          <br />
                          <span
                            className={p.wariantow > 1 ? "text-amber-700" : "text-muted-foreground"}
                          >
                            {p.wariantow > 1
                              ? `Uwaga: ${p.wariantow} różne linki w katalogu, wybrano najczęstszy (${p.produktow} produktów)`
                              : `${p.produktow} produktów ma ten link`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                onClick={() => void zapisz()}
                disabled={pracuje || wybrane.size === 0}
                data-testid="button-zapisz-zdjecia"
              >
                {pracuje ? "Zapisywanie…" : `Zapisz wybrane (${wybrane.size})`}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
