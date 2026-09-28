/**
 * Dialog szczegółów pozycji stagingu — podgląd różnic i edycja.
 *
 * ⚠ DLACZEGO OSOBNE ŻĄDANIE: lista (`/paged`) NIE zwraca `snapshotJson`, a bez niego nie ma
 * czego pokazać w podglądzie różnic. Pozycję dociągamy więc po id (`GET /api/staging/{id}`) —
 * to ustalenie z 3b, tutaj wchodzi w życie.
 *
 * ⭐ EDYCJA TWORZY POPRAWKĘ MARTY. `PUT /api/staging/{id}` zapisuje przy okazji
 * `manual_overrides`, więc następny import NIE przywróci wartości z pliku dostawcy. To jedyne
 * miejsce w aplikacji, które te poprawki tworzy — bez niego mechanizm z 3d-1/3d-2 nie ma
 * interfejsu.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OdznakaTypu } from "./TabelaStagingu";
import {
  POLA_EDYTOWALNE,
  zapiszPozycje,
  type PozycjaStaginguSzczegol,
} from "./dane";

export type WlasciwosciSzczegolow = {
  id: number | null;
  zamknij: () => void;
};

/** Snapshot pozycji rozbity na pary klucz–wartość; `null` gdy go nie ma albo jest zepsuty. */
function odczytajSnapshot(snapshotJson: string | null): Record<string, unknown> | null {
  if (!snapshotJson) return null;
  try {
    return JSON.parse(snapshotJson) as Record<string, unknown>;
  } catch {
    // Uszkodzony snapshot nie może wywrócić podglądu — pokażemy resztę pozycji.
    return null;
  }
}

export function SzczegolyPozycji({ id, zamknij }: WlasciwosciSzczegolow) {
  const klient = useQueryClient();
  const [zmiany, ustawZmiany] = useState<Record<string, string>>({});
  const [uzasadnienie, ustawUzasadnienie] = useState("");
  const [blad, ustawBlad] = useState<string | null>(null);

  const { data: pozycja, isLoading } = useQuery<PozycjaStaginguSzczegol | null>({
    queryKey: ["/api/staging", String(id)],
    enabled: id != null,
  });

  // Otwarcie innej pozycji zaczyna edycję od zera — inaczej wartości przeciekłyby między wierszami.
  useEffect(() => {
    ustawZmiany({});
    ustawUzasadnienie("");
    ustawBlad(null);
  }, [id]);

  const zapis = useMutation({
    mutationFn: async () => {
      if (!pozycja) return;
      const cialo: Record<string, unknown> = { ...zmiany };
      if (uzasadnienie) cialo._reason = uzasadnienie;
      await zapiszPozycje(pozycja.id, cialo);
    },
    onSuccess: async () => {
      // Oryginał unieważnia `/api/staging` (`fe.js:9124`); lista i szczegóły mają ten prefiks.
      await klient.invalidateQueries({ queryKey: ["/api/staging"] });
      zamknij();
    },
    onError: (e: Error) => ustawBlad(e.message),
  });

  const snapshot = pozycja ? odczytajSnapshot(pozycja.snapshotJson) : null;
  const jestWycofana = pozycja?.typZmiany === "wycofana";

  return (
    <Dialog open={id != null} onOpenChange={(otwarty) => !otwarty && zamknij()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-staging">
        <DialogHeader>
          <DialogTitle>
            {pozycja ? (
              <span className="flex items-center gap-2">
                <OdznakaTypu typ={pozycja.typZmiany} />
                <span className="font-mono text-sm">{pozycja.kod}</span>
              </span>
            ) : (
              "Pozycja stagingu"
            )}
          </DialogTitle>
          <DialogDescription>{pozycja?.nazwa ?? ""}</DialogDescription>
        </DialogHeader>

        {isLoading ? <p className="text-sm text-muted-foreground">Ładowanie…</p> : null}

        {pozycja ? (
          <div className="space-y-4">
            {/* Powód i ostrzeżenie w CAŁOŚCI — to na nich człowiek opiera decyzję. */}
            <section>
              <h3 className="mb-1 text-sm font-medium">Powód / co sprawdzić</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground" data-testid="szczegoly-powod">
                {pozycja.powod ?? "—"}
              </p>
              {pozycja.ostrzezenie ? (
                <p
                  className="mt-2 whitespace-pre-wrap text-sm text-amber-700"
                  data-testid="szczegoly-ostrzezenie"
                >
                  {pozycja.ostrzezenie}
                </p>
              ) : null}
            </section>

            <section>
              <h3 className="mb-1 text-sm font-medium">Podgląd różnic</h3>
              {jestWycofana ? (
                /*
                 * ⚠ Wiersz `wycofana` ma INNY kształt: `snapshotJson` jest `null`, pola `ean*`
                 * też, `cenaZakupuNowa` i `zmianaPct` są `null`, a `stanNowy` to zawsze 0.
                 * Podgląd, który zakłada obecność snapshotu, wywróciłby się właśnie tutaj.
                 */
                <p className="text-sm text-muted-foreground" data-testid="szczegoly-wycofana">
                  Pozycja wycofana — brak danych z cennika. Po akceptacji produkt zostanie
                  wstrzymany, a stan wyzerowany.
                </p>
              ) : snapshot ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" data-testid="szczegoly-snapshot">
                  {Object.entries(snapshot)
                    // `_srcConflict` pokazujemy osobno niżej — tam ma sens, tu byłby szumem.
                    .filter(([klucz]) => klucz !== "_srcConflict")
                    .map(([klucz, wartosc]) => (
                      <div key={klucz} className="contents">
                        <dt className="text-muted-foreground">{klucz}</dt>
                        <dd className="truncate" title={String(wartosc ?? "")}>
                          {wartosc == null || wartosc === "" ? "—" : String(wartosc)}
                        </dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Brak snapshotu dla tej pozycji.</p>
              )}
            </section>

            {snapshot?._srcConflict ? (
              /*
                Konflikt z ręczną poprawką: silnik ZACHOWAŁ wartość Marty i zapisał tu wartość
                z pliku. Po akceptacji wartość z pliku zostaje zapamiętana jako potwierdzona,
                więc ten sam alarm nie wróci przy następnym imporcie (3d-1 → 3d-2).
              */
              <section className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <h3 className="mb-1 text-sm font-medium text-amber-900">
                  Plik dostawcy chciał nadpisać poprawkę Marty
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 text-sm" data-testid="szczegoly-konflikt">
                  {Object.entries(snapshot._srcConflict as Record<string, unknown>).map(
                    ([pole, zPliku]) => (
                      <div key={pole} className="contents">
                        <dt className="text-amber-900">{pole} — wartość z pliku</dt>
                        <dd className="text-amber-900">{String(zPliku)}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </section>
            ) : null}

            {!jestWycofana ? (
              <section>
                <h3 className="mb-2 text-sm font-medium">
                  Edycja — zapisze się też jako poprawka Marty
                </h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Zmieniona wartość zostanie zapamiętana i kolejny import jej nie nadpisze.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {POLA_EDYTOWALNE.map(({ klucz, etykieta }) => (
                    <div key={klucz}>
                      <Label htmlFor={`pole-${klucz}`}>{etykieta}</Label>
                      <Input
                        id={`pole-${klucz}`}
                        data-testid={`input-${klucz}`}
                        value={zmiany[klucz] ?? ""}
                        placeholder={String(
                          (klucz === "cenaZakupuNowa"
                            ? pozycja.cenaZakupuNowa
                            : klucz === "magazyn"
                              ? pozycja.magazyn
                              : klucz === "nazwa"
                                ? pozycja.nazwa
                                : snapshot?.[klucz]) ?? "",
                        )}
                        onChange={(e) =>
                          ustawZmiany((poprzednie) => ({ ...poprzednie, [klucz]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Label htmlFor="pole-uzasadnienie">Uzasadnienie (trafi do poprawki)</Label>
                  <Input
                    id="pole-uzasadnienie"
                    data-testid="input-reason"
                    value={uzasadnienie}
                    onChange={(e) => ustawUzasadnienie(e.target.value)}
                  />
                </div>
              </section>
            ) : null}

            {blad ? (
              <p className="text-sm text-destructive" role="alert" data-testid="szczegoly-blad">
                Błąd zapisu: {blad}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={zamknij} data-testid="button-close-details">
            Zamknij
          </Button>
          {pozycja && !jestWycofana ? (
            <Button
              data-testid="button-save-details"
              disabled={Object.keys(zmiany).length === 0 || zapis.isPending}
              onClick={() => zapis.mutate()}
            >
              {zapis.isPending ? "Zapisywanie…" : "Zapisz"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
