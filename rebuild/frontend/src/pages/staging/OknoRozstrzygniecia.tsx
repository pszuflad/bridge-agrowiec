/**
 * Okno „Rozstrzygnij" / „Sprawdź kartę" — port `staging-policy-injection.js` @ `88fa31c`,
 * funkcja `review()` (`:49-143`).
 *
 * ⭐ JEDNO OKNO, TRZY ROZŁĄCZNE GAŁĘZIE. Otwiera je ten sam przycisk, a o treści decyduje
 * odpowiedź `GET /api/staging/{id}/review`:
 *
 *  1. `absenceReview` — stara karta obok pozycji z bieżącej oferty; akcja: wybór jednej karty
 *     (`POST …/choose-absence-card`). Tytuł okna się ZMIENIA.
 *  2. `matchIssue && !duplicateSource` — wybór produktu z katalogu albo osobny wpis
 *     (`POST …/resolve`). ⚠ ODSTĘPSTWO OD ORYGINAŁU (decyzja użytkowniczki, 2026-09-30, wpis
 *     168): zapis idzie OD RAZU do katalogu (bez drugiej akceptacji w stagingu), okno tłumaczy
 *     przyczynę (`wyjasnienie`), linkuje do pozycji w katalogu i pozwala wpisać własne parametry.
 *  3. `duplicateSource` — dwa sprzeczne wiersze w jednym pliku dostawcy. ⚠ ODSTĘPSTWO OD
 *     ORYGINAŁU (decyzja użytkownika, 2026-09-29): produkcja daje tu sam podgląd, bo
 *     sprzeczność miał wyjaśnić dostawca. Tu są dwa przyciski — „Połącz w jeden produkt"
 *     i „Rozdziel na dwa osobne produkty" (`POST …/resolve-source-conflict`) — a wynik
 *     trafia od razu do katalogu, bez osobnej akceptacji.
 *
 * ⚠ GAŁĘZIE 1 i 2 SĄ ROZŁĄCZNE — ZMIERZONE, nie założone (ticket 140). Oryginał ma dla nich
 * dwa OSOBNE elementy błędu (`:113` i `:127`), co sugeruje, że mogą wystąpić razem; w danych
 * nie mogą. `_absenceReview` ustawiają wyłącznie dwie gałęzie importera
 * (`import/polityka/fabryka.ts:855` i `:902`), a obie budują snapshot od zera z PRODUKTU
 * KATALOGOWEGO (`{...p, _policyVersion, _catalogVersion, _absenceReview, _candidates}`) —
 * produkt nie niesie `_matchIssue`, bo to pole powstaje w ścieżce dopasowania wiersza
 * importu (`:485`, `:501`) i tamta kończy się własnym `dodajZgloszenie` + `continue`.
 * Dlatego port ma JEDEN stan błędu zamiast dwóch: w każdym osiągalnym przypadku renderuje
 * się dokładnie jedna gałąź, więc miejsce komunikatu jest to samo co w oryginale.
 *
 * ⚠ TEKSTY SĄ DOSŁOWNE. Cudzysłowy („…"), wielokropek `…`, wersaliki („RÓŻNY — nie łączyć",
 * „NIE zatwierdza") i interpunkcja są przeniesione znak w znak. To nie jest stylistyka —
 * Ania czyta te zdania jako instrukcję, co zrobić z konkretną oponą.
 *
 * ODSTĘPSTWA ŚWIADOME (plan.md): `<Dialog>` Radix zamiast `<dialog>`+`showModal()` (wzorzec
 * projektu), `DialogPotwierdzenia` zamiast `window.confirm()` (D5), unieważnienie zapytań
 * zamiast `location.reload()` (D3).
 *
 * ⭐ PUNKT WPIĘCIA DLA I15.11 ZAMKNIĘTY BEZ ZMIAN W TYM PLIKU (ticket 142). Karta I15.11
 * zakładała, że „podgląd starej karty" dokłada tu coś z żywego bundla. Rozłożenie diffu
 * pokazało, że nie ma czego dokładać: CAŁY diff `staging-policy-injection.js` @ `88fa31c`
 * (gałąź `absenceReview`, sekcja „Stara karta w katalogu", `choose-absence-card`, przycisk
 * „Sprawdź kartę") jest już sportowany TUTAJ przez ticket 140, a żywy bundel zmienia w sprawie
 * braków w cenniku wyłącznie CZTERY NAPISY — i żaden z nich nie jest w tym oknie.
 *
 * ⚠ `absenceEvidence` (dowody kompletności: trzy oferty, 24 h) przychodzi w odpowiedzi
 * `GET /api/staging/{id}/review` i jest typowane w `polityka.ts`, ale CELOWO nie jest tu
 * renderowane: produkcja @ `88fa31c` nie pokazuje go nigdzie w UI. Pokazanie go byłoby
 * wymyślaniem nowego zachowania, nie odtwarzaniem (decyzja użytkownika, ticket 142).
 * Dowody działają wyłącznie po stronie backendu, jako blokada akceptacji
 * („Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik.").
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  etykietaKandydata,
  komunikatBledu,
  KOD_NOWEGO_PRODUKTU,
  mozliwyWyborKandydata,
  mozliwyWyborStarejKarty,
  notatkaWyboru,
  opisOpony,
  opisStanuKandydata,
  opisStanuStarejKarty,
  POLA_WLASNE,
  rozstrzygnijDopasowanie,
  rozstrzygnijSprzecznosc,
  wybierzKarte,
  ZAPASOWY_KOMUNIKAT_DECYZJI,
  zmienioneParametry,
  type KandydatPrzegladu,
  type PrzegladZgloszenia,
  type WierszKonfliktu,
  type WlasneParametry,
} from "./polityka";

export type WlasciwosciOknaRozstrzygniecia = {
  id: number | null;
  zamknij: () => void;
  /** Wołane po udanym zapisie decyzji — odświeżenie listy (plan.md D3). */
  onZapisano: () => void | Promise<void>;
};

/** Karta z nagłówkiem i listą linii — `card()` z oryginału (`:53-56`). */
function KartaPorownania({
  tytul,
  linie,
  wybor,
  testId,
}: {
  tytul: string;
  linie: string[];
  /** Wiersz wyboru (radio) doklejany NAD nagłówkiem — `choice()` robi `box.prepend(l)` (`:77`). */
  wybor?: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="my-3 rounded-lg border bg-muted/30 p-3" data-testid={testId}>
      {wybor}
      <strong className="mb-1.5 block">{tytul}</strong>
      {linie.map((linia, indeks) => (
        // Linie to stałe pozycje szablonu (kod+nazwa, EAN/DOT, stan…) — indeks jest tu
        // stabilnym kluczem, bo ich liczba i kolejność nie zmieniają się w trakcie życia okna.
        <p key={indeks} className="my-1 break-words text-sm">
          {linia}
        </p>
      ))}
    </section>
  );
}

/** Wiersz wyboru „Zostaw tę kartę" — `choice()` z oryginału (`:71-78`). */
function WyborKarty({
  kod,
  zaznaczony,
  dostepny,
  onWybierz,
}: {
  kod: string;
  zaznaczony: boolean;
  dostepny: boolean;
  onWybierz: () => void;
}) {
  return (
    <label className="mb-1.5 flex items-center gap-2.5">
      <input
        type="radio"
        name="bs-absence-choice"
        value={kod}
        checked={zaznaczony}
        disabled={!dostepny}
        onChange={onWybierz}
        data-testid={`radio-karta-${kod}`}
      />
      <span className="font-semibold">Zostaw tę kartę</span>
    </label>
  );
}

/** Trzy linie opisu jednego ze sprzecznych wierszy pliku — `:137-139` w oryginale. */
function linieWierszaKonfliktu(wiersz: WierszKonfliktu): string[] {
  return [
    `Kod w pliku: ${wiersz.kod || "brak"}`,
    `EAN: ${wiersz.EAN || "brak"} · DOT: ${wiersz.DOT || "brak"}`,
    `Cena zakupu: ${wiersz["cena zakupu"] ?? "brak"} · Stan: ${wiersz.stan ?? "brak"}`,
  ];
}

/** Wartość pola wiersza konfliktu do zestawienia „było → jest"; brak = „brak". */
function wartoscPola(wiersz: WierszKonfliktu, etykieta: string): string {
  const v = wiersz[etykieta];
  return v == null || v === "" ? "brak" : String(v);
}

/** Pięć linii opisu kandydata — `:87-92` w oryginale. */
function linieKandydata(c: KandydatPrzegladu): string[] {
  return [
    `${c.kod} · ${c.nazwa ?? ""}`,
    `EAN ${c.ean || "brak"} · DOT w ofercie: ${c.dot || "brak"}`,
    `DOT w karcie katalogowej: ${c.catalogDot || "brak"}`,
    `EAN: ${c.sameEan ? "taki sam" : "inny niż na starej karcie"}; ` +
      `DOT: ${c.sameDot ? "zgodny" : "RÓŻNY — nie łączyć"}`,
    opisStanuKandydata(c.status),
  ];
}

export function OknoRozstrzygniecia({ id, zamknij, onZapisano }: WlasciwosciOknaRozstrzygniecia) {
  /** Kod karty wskazanej w gałęzi „stara karta" (`selectedCard` w oryginale). */
  const [wybranaKarta, ustawWybranaKarte] = useState<string | null>(null);
  /** Wybór w gałęzi dopasowania: kod kandydata albo `__new__` (`choice` w oryginale). */
  const [wybraneDopasowanie, ustawWybraneDopasowanie] = useState<string | null>(null);
  /** Własne parametry wpisane w oknie (NOWE, 2026-09-30); `null` = sekcja zwinięta, bez zmian. */
  const [wlasne, ustawWlasne] = useState<WlasneParametry | null>(null);
  const [blad, ustawBlad] = useState<string | null>(null);
  const [doPotwierdzenia, ustawDoPotwierdzenia] = useState<string | null>(null);

  const {
    data: przeglad,
    isLoading,
    error,
  } = useQuery<PrzegladZgloszenia | null>({
    // `queryKey.join("/")` daje `/api/staging/<id>/review` — konwencja z `lib/queryClient.ts`.
    queryKey: ["/api/staging", String(id), "review"],
    enabled: id != null,
  });

  // Otwarcie innego zgłoszenia zaczyna od zera — inaczej wybór przeciekłby między wierszami.
  useEffect(() => {
    ustawWybranaKarte(null);
    ustawWybraneDopasowanie(null);
    ustawWlasne(null);
    ustawBlad(null);
    ustawDoPotwierdzenia(null);
  }, [id]);

  const zapis = useMutation({
    mutationFn: async (wykonaj: () => Promise<unknown>) => wykonaj(),
    onSuccess: async () => {
      // ODSTĘPSTWO ŚWIADOME (D3): oryginał robi `location.reload()` (`:118`, `:133`).
      // Skutek dla użytkownika ten sam — świeża lista z nowym `id` zgłoszenia — ale bez
      // gubienia filtra, strony i szukajki.
      ustawBlad(null);
      zamknij();
      await onZapisano();
    },
    // Oryginał pokazuje błąd W TYM SAMYM oknie (`<p class="bs-error">`), a nie osobnym
    // oknem „Nie zapisano zmian" — tamto jest wyłącznie dla `POST /api/staging/accept`.
    onError: (e: unknown) => ustawBlad(komunikatBledu(e, ZAPASOWY_KOMUNIKAT_DECYZJI)),
  });

  const zgodni = (przeglad?.candidates ?? []).filter((c) => c.selectable);
  const pokazWyborKarty = !!przeglad?.absenceReview;
  const pokazDopasowanie = !!przeglad?.matchIssue && !przeglad?.duplicateSource;

  /**
   * Kandydat, którego `catalogVersion` leci w ciele żądania — `:112` w oryginale.
   * Gdy wskazano STARĄ kartę, odciskiem jest jedyny zgodny kandydat.
   */
  const kandydatDoWersji = przeglad?.candidates.find((c) => c.kod === wybranaKarta)
    ?? (zgodni.length === 1 ? zgodni[0] : undefined);

  const tytul = pokazWyborKarty
    ? "Porównaj starą kartę z obecną ofertą"
    : "Sprawdź dopasowanie opony";

  /**
   * Oryginał przerywa BEZ komunikatu, gdy nie ma czym wypełnić `candidateVersion`
   * (`if(!candidate)return;`, `:113`) — odtwarzamy to samo milczące wyjście.
   */
  const poprosOPotwierdzenie = (): void => {
    if (!wybranaKarta || !kandydatDoWersji) return;
    ustawDoPotwierdzenia(wybranaKarta);
  };

  return (
    <>
      <Dialog open={id != null} onOpenChange={(otwarty) => !otwarty && zamknij()}>
        <DialogContent
          className="max-h-[85vh] max-w-2xl overflow-y-auto"
          data-testid="dialog-rozstrzygniecie"
        >
          <DialogHeader>
            <DialogTitle data-testid="tytul-rozstrzygniecia">{tytul}</DialogTitle>
            {/* Radix wymaga opisu dla czytników ekranu; treść niesie sam korpus okna. */}
            <DialogDescription className="sr-only">
              Materiał do ręcznego rozstrzygnięcia zgłoszenia stagingu.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? <p className="my-2.5">Wczytywanie…</p> : null}

          {/*
            Błąd wczytania: oryginał podmienia „Wczytywanie…" na treść błędu i zostawia
            samotny „Zamknij" (`:142`). Odtwarzamy skutek — komunikat zamiast zawartości.
          */}
          {error ? (
            <p className="my-2.5 text-destructive" role="alert" data-testid="blad-wczytania">
              {komunikatBledu(error, ZAPASOWY_KOMUNIKAT_DECYZJI)}
            </p>
          ) : null}

          {przeglad ? (
            <div>
              {pokazWyborKarty ? (
                <>
                  <p className="my-2.5">
                    Wybierz jedną kartę tylko wtedy, gdy DOT w obu kartach i w aktualnej ofercie
                    jest taki sam. Druga karta zostanie wstrzymana. Opony z różnym DOT pozostają
                    osobnymi produktami.
                  </p>

                  <KartaPorownania
                    tytul="Stara karta w katalogu"
                    testId="karta-stara"
                    wybor={
                      <WyborKarty
                        kod={przeglad.kod}
                        zaznaczony={wybranaKarta === przeglad.kod}
                        dostepny={mozliwyWyborStarejKarty(zgodni)}
                        onWybierz={() => ustawWybranaKarte(przeglad.kod)}
                      />
                    }
                    linie={[
                      `${przeglad.kod} · ${przeglad.nazwa}`,
                      opisOpony(przeglad.incoming),
                      opisStanuStarejKarty(przeglad.incoming.status),
                    ]}
                  />

                  {przeglad.candidates.map((c) => (
                    <KartaPorownania
                      key={c.kod}
                      tytul="Pozycja w obecnej ofercie"
                      testId={`karta-kandydat-${c.kod}`}
                      wybor={
                        <WyborKarty
                          kod={c.kod}
                          zaznaczony={wybranaKarta === c.kod}
                          dostepny={mozliwyWyborKandydata(c)}
                          onWybierz={() => ustawWybranaKarte(c.kod)}
                        />
                      }
                      linie={linieKandydata(c)}
                    />
                  ))}

                  <p
                    className="my-2.5 border-l-[3px] border-amber-600 bg-amber-500/10 px-3 py-2"
                    data-testid="notatka-wyboru"
                  >
                    {notatkaWyboru(zgodni)}
                  </p>
                </>
              ) : (
                <>
                  <p className="my-2.5">{przeglad.nazwa}</p>
                  <p className="my-2.5">Pozycja z oferty: {opisOpony(przeglad.incoming)}</p>
                  {/*
                    NOWE (2026-09-30, nie port): zdania dla człowieka liczone przez serwer
                    (`wyjasnienie`) — co jest nie tak i jaką nazwę proponuje import. Gdy ich
                    nie ma (stare zgłoszenie, sprzeczne wiersze), zostaje hasło z importera
                    (`matchIssue` albo `powod`) — UI go nie przepisuje.
                  */}
                  {!przeglad.duplicateSource && przeglad.wyjasnienie?.length ? (
                    <div
                      className="my-2.5 space-y-1 border-l-[3px] border-amber-600 bg-amber-500/10 px-3 py-2 text-sm"
                      data-testid="wyjasnienie"
                    >
                      <strong className="block">Dlaczego to zgłoszenie czeka na decyzję:</strong>
                      {przeglad.wyjasnienie.map((linia) => (
                        <p key={linia} className="break-words">
                          {linia}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="my-2.5" data-testid="opis-sprawy">
                      {przeglad.matchIssue || przeglad.powod}
                    </p>
                  )}
                </>
              )}

              {pokazDopasowanie ? (
                <>
                  <p className="my-2.5">
                    Wybierz produkt z katalogu lub utwórz osobny produkt. „Zapisz w katalogu” zapisuje
                    wybór od razu w katalogu — nie trzeba go potem osobno akceptować w stagingu. Jeśli
                    dane z oferty są błędne (np. zła kolejność w nazwie), wpisz własne wartości
                    poniżej: do katalogu trafią Twoje.
                  </p>
                  <div>
                    {przeglad.candidates.map((c) => (
                      <div
                        key={c.kod}
                        className="my-2.5 rounded-lg border p-3"
                        data-testid={`kandydat-${c.kod}`}
                      >
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <input
                            type="radio"
                            name="bs-target"
                            className="mt-1.5 shrink-0"
                            value={c.kod}
                            checked={wybraneDopasowanie === c.kod}
                            onChange={() => ustawWybraneDopasowanie(c.kod)}
                            data-testid={`radio-dopasowanie-${c.kod}`}
                          />
                          <span className="break-words">{etykietaKandydata(c)}</span>
                        </label>
                        {c.produktId != null ? (
                          <Link
                            href={`/katalog?szukaj=${encodeURIComponent(c.kod)}`}
                            onClick={zamknij}
                            className="ml-6 mt-1 inline-block text-sm text-primary underline"
                            data-testid={`link-katalog-${c.kod}`}
                          >
                            Zobacz tę pozycję w katalogu
                          </Link>
                        ) : null}
                      </div>
                    ))}
                    <label className="my-2.5 flex cursor-pointer items-start gap-2.5 rounded-lg border p-3">
                      <input
                        type="radio"
                        name="bs-target"
                        className="mt-1.5 shrink-0"
                        value={KOD_NOWEGO_PRODUKTU}
                        checked={wybraneDopasowanie === KOD_NOWEGO_PRODUKTU}
                        onChange={() => ustawWybraneDopasowanie(KOD_NOWEGO_PRODUKTU)}
                        data-testid="radio-dopasowanie-nowy"
                      />
                      <span>To osobna opona. Przygotuj ją jako nowy produkt.</span>
                    </label>
                  </div>

                  {/*
                    NOWE (2026-09-30, nie port): własne parametry. Gdy zapis z oferty jest
                    błędny, nie da się go ani zaakceptować, ani dodać jako osobny produkt —
                    wpisane tu wartości trafiają do katalogu zamiast tych z oferty (i zapisują
                    się jako trwałe poprawki, żeby kolejny import ich nie cofnął).
                  */}
                  {wlasne == null ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="my-2"
                      onClick={() => ustawWlasne({ ...(przeglad.propozycja ?? {}) })}
                      data-testid="button-wlasne-parametry"
                    >
                      Popraw dane z oferty (nazwa, rozmiar, EAN…)
                    </Button>
                  ) : (
                    <fieldset
                      className="my-3 space-y-2 rounded-lg border p-3"
                      data-testid="wlasne-parametry"
                    >
                      <legend className="px-1 text-sm font-semibold">
                        Własne parametry — do katalogu trafią w tej postaci
                      </legend>
                      {POLA_WLASNE.map(([pole, etykieta]) => (
                        <label key={pole} className="flex items-center gap-2.5 text-sm">
                          <span className="w-20 shrink-0">{etykieta}</span>
                          <Input
                            value={wlasne[pole] ?? ""}
                            onChange={(e) => ustawWlasne({ ...wlasne, [pole]: e.target.value })}
                            data-testid={`pole-wlasne-${pole}`}
                          />
                        </label>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => ustawWlasne(null)}
                        data-testid="button-wlasne-anuluj"
                      >
                        Wróć do danych z oferty
                      </Button>
                    </fieldset>
                  )}
                  {przeglad.eanIssue ? (
                    <p className="my-2.5 text-destructive" data-testid="ostrzezenie-ean">
                      EAN z oferty jest błędny — wpisz poprawny w polu EAN (Popraw dane z oferty),
                      inaczej zapis zostanie zatrzymany.
                    </p>
                  ) : null}
                </>
              ) : null}

              {przeglad.duplicateSource ? (
                <>
                  <p className="my-2.5">
                    W bieżącym pliku są dwa wiersze przypisane do jednej karty, ale ich dane się
                    różnią. To NIE oznacza automatycznie, że EAN jest inny.
                  </p>
                  {przeglad.sourceConflict ? (
                    <>
                      <div
                        className="my-2.5 border-l-[3px] border-amber-600 bg-amber-500/10 px-3 py-2"
                        data-testid="roznice-wierszy"
                      >
                        <strong className="block">Niezgodne dane (pierwszy → drugi wiersz):</strong>
                        {przeglad.sourceConflict.different.length ? (
                          <ul className="mt-1 space-y-0.5">
                            {przeglad.sourceConflict.different.map((etykieta) => (
                              <li key={etykieta} data-testid="roznica-pola">
                                {etykieta.charAt(0).toUpperCase() + etykieta.slice(1)}:{" "}
                                <span className="font-semibold">
                                  {wartoscPola(przeglad.sourceConflict!.earlier, etykieta)} →{" "}
                                  {wartoscPola(przeglad.sourceConflict!.later, etykieta)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1">Dane zapisane w pliku.</p>
                        )}
                      </div>
                      <KartaPorownania
                        tytul="Pierwszy wiersz"
                        testId="karta-wiersz-pierwszy"
                        linie={linieWierszaKonfliktu(przeglad.sourceConflict.earlier)}
                      />
                      <KartaPorownania
                        tytul="Drugi wiersz"
                        testId="karta-wiersz-drugi"
                        linie={linieWierszaKonfliktu(przeglad.sourceConflict.later)}
                      />
                    </>
                  ) : (
                    <p className="my-2.5" data-testid="brak-porownania-wierszy">
                      To starsze zgłoszenie nie zawiera porównania wierszy. Wczytaj ponownie
                      aktualny cennik, aby zobaczyć dokładne różnice.
                    </p>
                  )}
                  <p className="my-2.5">
                    <strong>Połącz</strong> — to jedna opona: powstanie jeden produkt z danymi z
                    drugiego wiersza. <strong>Rozdziel</strong> — to dwie opony: każdy wiersz
                    dostanie osobny produkt (kod z pliku). Produkt trafia od razu do katalogu.
                  </p>
                </>
              ) : null}

              {blad ? (
                <p className="my-2.5 text-destructive" role="alert" data-testid="blad-decyzji">
                  {blad}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Stopka: „Zamknij" zawsze pierwszy, przyciski zapisu po nim (`:96`, `:110`, `:128`). */}
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <Button
              variant="outline"
              onClick={zamknij}
              disabled={zapis.isPending}
              data-testid="button-zamknij-rozstrzygniecie"
            >
              Zamknij
            </Button>

            {przeglad && pokazWyborKarty ? (
              <Button
                disabled={!wybranaKarta || zapis.isPending}
                onClick={poprosOPotwierdzenie}
                data-testid="button-zapisz-wybor-karty"
              >
                Zapisz wybór w katalogu
              </Button>
            ) : null}

            {przeglad && przeglad.duplicateSource && przeglad.sourceConflict ? (
              <>
                <Button
                  variant="outline"
                  disabled={zapis.isPending}
                  onClick={() => zapis.mutate(() => rozstrzygnijSprzecznosc(przeglad.id, "split"))}
                  data-testid="button-rozdziel-wiersze"
                >
                  Rozdziel na dwa osobne produkty
                </Button>
                <Button
                  disabled={zapis.isPending}
                  onClick={() => zapis.mutate(() => rozstrzygnijSprzecznosc(przeglad.id, "merge"))}
                  data-testid="button-polacz-wiersze"
                >
                  Połącz w jeden produkt
                </Button>
              </>
            ) : null}

            {przeglad && pokazDopasowanie ? (
              <Button
                disabled={!wybraneDopasowanie || zapis.isPending}
                onClick={() =>
                  zapis.mutate(() =>
                    rozstrzygnijDopasowanie(
                      przeglad.id,
                      wybraneDopasowanie as string,
                      wlasne ? zmienioneParametry(wlasne, przeglad.propozycja) : {},
                    ),
                  )
                }
                data-testid="button-zapisz-wybor"
              >
                Zapisz w katalogu
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/*
        ODSTĘPSTWO ŚWIADOME (D5): oryginał pyta natywnym `window.confirm()` (`:111`).
        Treść pytania DOSŁOWNIE, nośnik jak w całej odbudowie (precedens D2 z 7b, D5 z 12e).
      */}
      <DialogPotwierdzenia
        otwarty={doPotwierdzenia != null}
        tytul="Zapisz wybór w katalogu"
        tresc={`Zostawić w katalogu kartę ${doPotwierdzenia ?? ""}? Druga karta zostanie wstrzymana, a jej stan wyzerowany.`}
        etykietaPotwierdzenia="Zapisz wybór w katalogu"
        zajety={zapis.isPending}
        onPotwierdz={() => {
          const kod = doPotwierdzenia;
          ustawDoPotwierdzenia(null);
          if (przeglad && kod) {
            zapis.mutate(() =>
              wybierzKarte(przeglad.id, kod, kandydatDoWersji?.catalogVersion ?? null),
            );
          }
        }}
        onZamknij={() => ustawDoPotwierdzenia(null)}
        testId="dialog-potwierdz-wybor-karty"
      />
    </>
  );
}
