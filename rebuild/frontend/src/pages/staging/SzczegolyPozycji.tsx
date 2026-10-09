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
import { Link } from "wouter";

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
  zachowajKarte,
  zapiszPozycje,
  type PozycjaStaginguSzczegol,
} from "./dane";
import { komunikatBledu } from "./polityka";

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

/** Pozycja katalogu, do której prowadzi link ze szczegółów (kod + opis do pokazania). */
type PozycjaKatalogu = { kod: string; opis: string };

/**
 * Karty katalogu, które dotyczą tej pozycji stagingu (NOWE, 2026-10-01 — nie port):
 *  • karta o kodzie pozycji — gdy produkt już jest w katalogu (typ inny niż `nowa`) i kod nie jest
 *    zastępczy (`…_AUTO_…` nadaje importer pozycji, której oznaczenie zajmuje inna opona),
 *  • kandydaci z `_candidates` — karty, z którymi importer nie umiał jej jednoznacznie połączyć.
 */
function pozycjeKatalogu(
  pozycja: { kod: string; typZmiany: string; nazwa: string },
  snapshot: Record<string, unknown> | null,
): PozycjaKatalogu[] {
  const wynik = new Map<string, PozycjaKatalogu>();
  if (pozycja.typZmiany !== "nowa" && !pozycja.kod.includes("_AUTO_")) {
    wynik.set(pozycja.kod, { kod: pozycja.kod, opis: pozycja.nazwa });
  }
  const kandydaci = Array.isArray(snapshot?._candidates) ? snapshot._candidates : [];
  for (const k of kandydaci as Array<{ kod?: unknown; nazwa?: unknown }>) {
    if (typeof k?.kod !== "string" || wynik.has(k.kod)) continue;
    wynik.set(k.kod, { kod: k.kod, opis: typeof k.nazwa === "string" ? k.nazwa : "" });
  }
  return [...wynik.values()];
}

export function SzczegolyPozycji({ id, zamknij }: WlasciwosciSzczegolow) {
  const klient = useQueryClient();
  const [zmiany, ustawZmiany] = useState<Record<string, string>>({});
  const [uzasadnienie, ustawUzasadnienie] = useState("");
  const [blad, ustawBlad] = useState<string | null>(null);

  const {
    data: pozycja,
    isLoading,
    error: bladPobrania,
  } = useQuery<PozycjaStaginguSzczegol | null>({
    queryKey: ["/api/staging", String(id)],
    enabled: id != null,
  });

  // Ticket 202 (NOWA logika): podpowiedź linku do zdjęcia (marka+model) dla pozycji bez linku.
  const { data: podpowiedzZdjecia } = useQuery<{
    propozycja: { link: string; produktow: number; wariantow: number } | null;
  } | null>({
    queryKey: ["/api/staging", String(id), "propozycja-zdjecia"],
    enabled: id != null && !!pozycja && pozycja.typZmiany !== "wycofana",
  });
  const propozycjaZdjecia = podpowiedzZdjecia?.propozycja ?? null;

  // NOWE (2026-10-02): pozycji nie udało się pobrać — najczęściej 404, bo każdy import (także
  // automatyczny) zastępuje zgłoszenia NOWYMI, więc wiersz na liście trzyma numer, którego już nie
  // ma. Wcześniej okno zostawało puste (sam tytuł „Pozycja stagingu” i „Zamknij”). Odświeżamy listę
  // (bez szczegółów tej pozycji, żeby nie wołać jej w kółko), żeby po zamknięciu była aktualna.
  const brakPozycji = id != null && !isLoading && !pozycja;
  useEffect(() => {
    if (!brakPozycji) return;
    void klient.invalidateQueries({
      queryKey: ["/api/staging"],
      predicate: (q) => !(q.queryKey[0] === "/api/staging" && q.queryKey[1] === String(id)),
    });
  }, [brakPozycji, id, klient]);

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
    onError: async (e: Error) => {
      // NOWE (2026-10-01): 404 = pozycji nie ma już pod tym numerem. Każdy import (także
      // automatyczny, co godzinę i po restarcie serwera) zastępuje zgłoszenia NOWYMI, więc okno
      // otwarte przed importem trzyma numer, którego już nie ma. Surowe „404: {error…}" nic nie mówiło.
      if (/^404\b/.test(e.message)) {
        ustawBlad(
          "Ta pozycja została zastąpiona nowym importem cennika, więc jej numer już nie istnieje. " +
            "Lista została odświeżona — zamknij okno, otwórz pozycję ponownie i wpisz zmiany jeszcze raz.",
        );
        await klient.invalidateQueries({ queryKey: ["/api/staging"] });
        return;
      }
      ustawBlad(e.message);
    },
  });

  // NOWE (2026-10-05): „Odrzuć” = zostaw kartę bez zmian i zapamiętaj to jak poprawkę Marty.
  const odrzucenie = useMutation({
    mutationFn: async () => {
      if (!pozycja) return;
      await zachowajKarte(pozycja.id);
    },
    onSuccess: async () => {
      // Poprawki Marty widać na karcie produktu (`/api/overrides`), a zgłoszenie znika z listy.
      await Promise.all([
        klient.invalidateQueries({ queryKey: ["/api/staging"] }),
        klient.invalidateQueries({ queryKey: ["/api/overrides"] }),
      ]);
      zamknij();
    },
    onError: async (e: Error) => {
      ustawBlad(komunikatBledu(e, "Nie udało się odrzucić zmiany. Odśwież staging i spróbuj ponownie."));
      if (/^404\b/.test(e.message)) await klient.invalidateQueries({ queryKey: ["/api/staging"] });
    },
  });

  const snapshot = pozycja ? odczytajSnapshot(pozycja.snapshotJson) : null;
  const jestWycofana = pozycja?.typZmiany === "wycofana";
  // „Odrzuć” ma sens tylko dla zmiany ISTNIEJĄCEJ karty — inne typy odrzuca się na liście.
  const mozeOdrzucic = pozycja?.typZmiany === "zmiana_kluczowa";
  const zajety = zapis.isPending || odrzucenie.isPending;

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

        {brakPozycji ? (
          <p className="text-sm text-destructive" role="alert" data-testid="szczegoly-brak">
            {bladPobrania && !/^404\b/.test(bladPobrania.message)
              ? `Nie udało się wczytać pozycji: ${bladPobrania.message}`
              : "Ta pozycja została zastąpiona nowym importem cennika, więc jej numer już nie istnieje. " +
                "Lista została odświeżona — zamknij okno i otwórz pozycję ponownie."}
          </p>
        ) : null}

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

            {!jestWycofana && pozycjeKatalogu(pozycja, snapshot).length ? (
              <section data-testid="szczegoly-katalog">
                <h3 className="mb-1 text-sm font-medium">Pozycja w katalogu</h3>
                <ul className="space-y-1 text-sm">
                  {pozycjeKatalogu(pozycja, snapshot).map((p) => (
                    <li key={p.kod}>
                      <Link
                        href={`/katalog?szukaj=${encodeURIComponent(p.kod)}`}
                        onClick={zamknij}
                        className="text-primary underline"
                        data-testid={`szczegoly-link-katalog-${p.kod}`}
                      >
                        Zobacz w katalogu: {p.kod}
                      </Link>
                      {p.opis ? <span className="text-muted-foreground"> — {p.opis}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

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

            {!jestWycofana && propozycjaZdjecia && zmiany.linkZdjecia === undefined ? (
              /*
                Ticket 202: pozycja nie ma linku do zdjęcia. Jeśli go nie wpiszesz, akceptacja
                uzupełni go tym linkiem (i zapisze jak poprawkę Marty); „Użyj" wstawia go do pola
                edycji, gdzie można go jeszcze poprawić.
              */
              <section
                className="rounded-md border border-sky-300 bg-sky-50 p-3"
                data-testid="szczegoly-propozycja-zdjecia"
              >
                <h3 className="mb-1 text-sm font-medium text-sky-900">Podpowiedź: link do zdjęcia</h3>
                <p className="break-all text-sm text-sky-900">{propozycjaZdjecia.link}</p>
                <p className="mt-1 text-xs text-sky-900">
                  {propozycjaZdjecia.wariantow > 1
                    ? `Najczęstszy z ${propozycjaZdjecia.wariantow} różnych linków tej marki i modelu w katalogu (${propozycjaZdjecia.produktow} produktów). `
                    : `Ma go ${propozycjaZdjecia.produktow} produktów tej marki i modelu w katalogu. `}
                  Bez zmian akceptacja wpisze ten link; możesz go poprawić w polu „Link do zdjęcia" niżej.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  data-testid="button-uzyj-propozycji-zdjecia"
                  onClick={() =>
                    ustawZmiany((poprzednie) => ({ ...poprzednie, linkZdjecia: propozycjaZdjecia.link }))
                  }
                >
                  Wstaw do edycji
                </Button>
              </section>
            ) : null}

            {!jestWycofana ? (
              <section>
                <h3 className="mb-2 text-sm font-medium">
                  Edycja — zapisze się też jako poprawka Marty
                </h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Zmieniona wartość zostanie zapamiętana i kolejny import jej nie nadpisze.
                  {mozeOdrzucic
                    ? " „Odrzuć” zostawia kartę bez zmian i zapisuje to tak samo, jak poprawkę Marty — z obecnymi wartościami karty."
                    : ""}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {POLA_EDYTOWALNE.map(({ klucz, etykieta }) => {
                    /*
                      NOWE (2026-10-01, nie port): pole niesie AKTUALNĄ wartość, a nie pusty tekst
                      z szarym placeholderem — wyglądało na zablokowane i nikt nie wiedział, że da
                      się je edytować. Do `zmiany` trafia tylko to, co różni się od aktualnej wartości.
                    */
                    const biezaca = String(
                      (klucz === "cenaZakupuNowa"
                        ? pozycja.cenaZakupuNowa
                        : klucz === "magazyn"
                          ? pozycja.magazyn
                          : klucz === "nazwa"
                            ? pozycja.nazwa
                            : snapshot?.[klucz]) ?? "",
                    );
                    return (
                      <div key={klucz}>
                        <Label htmlFor={`pole-${klucz}`}>{etykieta}</Label>
                        <Input
                          id={`pole-${klucz}`}
                          data-testid={`input-${klucz}`}
                          value={zmiany[klucz] ?? biezaca}
                          onChange={(e) =>
                            ustawZmiany((poprzednie) => {
                              const { [klucz]: _stara, ...reszta } = poprzednie;
                              return e.target.value === biezaca
                                ? reszta
                                : { ...reszta, [klucz]: e.target.value };
                            })
                          }
                        />
                      </div>
                    );
                  })}
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
          {pozycja && mozeOdrzucic ? (
            <Button
              variant="outline"
              data-testid="button-reject-details"
              disabled={zajety}
              title="Karta w katalogu zostaje bez zmian, a decyzja zapisuje się jak poprawka Marty"
              onClick={() => odrzucenie.mutate()}
            >
              {odrzucenie.isPending ? "Odrzucanie…" : "Odrzuć"}
            </Button>
          ) : null}
          {pozycja && !jestWycofana ? (
            <Button
              data-testid="button-save-details"
              // NOWE (2026-10-02): „Zapisz” jest aktywny zawsze, także bez zmian — wtedy wysyła pusty
              // zapis (backend przelicza status EAN i nie zakłada poprawek) i zamyka okno.
              disabled={zajety}
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
