/**
 * Zachowanie odczytu stagingu — szczegóły, których fixtures nie zamrażają.
 *
 * GATE (`staging.gate.test.ts`) dowodzi KSZTAŁTU odpowiedzi. Tutaj sprawdzamy REGUŁY:
 * dwa warianty odpowiedzi `/api/staging`, klamry na `limit`/`pageSize`, filtry i
 * tokenizację wyszukiwania, sortowanie oraz kody błędów — wszystko wg oryginału
 * (backend-index.cjs:48488-48501, pagination_module.cjs:16-127).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stagingItems } from "../src/db/schema.js";
import { MAX_LIMIT, MAX_PAGE_SIZE } from "../src/routes/staging.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

/** Ile pozycji sieć testowa wstawia — więcej niż domyślny `pageSize`, żeby paginacja miała co ciąć. */
const LICZBA_POZYCJI = 120;

function pozycjaTestowa(i: number) {
  const dostawca = i % 2 === 0 ? "MO1" : "MO2";
  return {
    id: 1000 + i,
    typZmiany: i % 3 === 0 ? "nowa" : "zmiana_kluczowa",
    kod: `${dostawca}_${i}`,
    nazwa: i === 7 ? "460/70R24 CEAT Loadpro" : `Opona testowa ${i}`,
    dostawca,
    magazyn: "—",
    stanStary: null,
    stanNowy: i,
    cenaZakupuStara: null,
    cenaZakupuNowa: 100 + i,
    cenaSprzedazyNowa: null,
    zmianaPct: null,
    ostrzezenie: null,
    powod: "Nowa pozycja w cenniku",
    snapshotJson: JSON.stringify({ kod: `${dostawca}_${i}` }),
    eanRaw: `590000000${String(i).padStart(4, "0")}`,
    eanIsValid: 1,
    eanSourceStatus: "ok",
    eanCandidates: null,
    magazynRaw: null,
    edytowanePola: null,
    utworzono: "2026-08-20T10:00:00.000Z",
    zatwierdzilUzytkownikId: null,
    zatwierdzonoData: null,
  };
}

describe("odczyt stagingu — reguły z oryginału", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    srodowisko.db
      .insert(stagingItems)
      .values(Array.from({ length: LICZBA_POZYCJI }, (_, i) => pozycjaTestowa(i)))
      .run();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  describe("GET /api/staging — dwa kształty odpowiedzi", () => {
    it("bez `limit` zwraca GOŁĄ TABLICĘ wszystkich pozycji", async () => {
      const odp = await zAuth("/api/staging");

      expect(Array.isArray(odp.body)).toBe(true);
      expect(odp.body).toHaveLength(LICZBA_POZYCJI);
    });

    it("z `limit` zwraca kopertę { items, total, limit, offset }", async () => {
      const odp = await zAuth("/api/staging?limit=5&offset=10");
      const ciało = odp.body as { items: unknown[]; total: number; limit: number; offset: number };

      expect(Object.keys(ciało).sort()).toEqual(["items", "limit", "offset", "total"]);
      expect(ciało.items).toHaveLength(5);
      expect(ciało.total).toBe(LICZBA_POZYCJI);
      expect(ciało.limit).toBe(5);
      expect(ciało.offset).toBe(10);
    });

    /** 1:1 z `Math.min(parseInt(...) || 200, 2e3)` — NaN i 0 dają 200, a nie błąd. */
    it("niepoprawny `limit` daje 200, a nie błąd", async () => {
      for (const wartosc of ["abc", "0"]) {
        const odp = await zAuth(`/api/staging?limit=${wartosc}`);
        expect((odp.body as { limit: number }).limit, `limit=${wartosc}`).toBe(200);
      }
    });

    it("`limit` jest przycinany do 2000", async () => {
      const odp = await zAuth("/api/staging?limit=99999");
      expect((odp.body as { limit: number }).limit).toBe(MAX_LIMIT);
    });

    it("niepoprawny `offset` daje 0", async () => {
      const odp = await zAuth("/api/staging?limit=5&offset=abc");
      expect((odp.body as { offset: number }).offset).toBe(0);
    });

    /** Brak `ORDER BY` w oryginale — kolejność `rowid`, czyli rosnąco po id. */
    it("nie sortuje — zwraca w kolejności wstawiania", async () => {
      const odp = await zAuth("/api/staging?limit=3");
      const ids = (odp.body as { items: { id: number }[] }).items.map((p) => p.id);
      expect(ids).toEqual([1000, 1001, 1002]);
    });
  });

  describe("GET /api/staging/paged", () => {
    it("domyślnie strona 1 po 50 pozycji, z policzonymi `pages`", async () => {
      const odp = await zAuth("/api/staging/paged");
      const ciało = odp.body as { items: unknown[]; total: number; page: number; pageSize: number; pages: number };

      expect(ciało.page).toBe(1);
      expect(ciało.pageSize).toBe(50);
      expect(ciało.items).toHaveLength(50);
      expect(ciało.total).toBe(LICZBA_POZYCJI);
      expect(ciało.pages).toBe(Math.ceil(LICZBA_POZYCJI / 50));
    });

    /** Odwrotnie niż `/api/staging` — tu najnowsze na górze. */
    it("sortuje malejąco po id", async () => {
      const odp = await zAuth("/api/staging/paged?pageSize=3");
      const ids = (odp.body as { items: { id: number }[] }).items.map((p) => p.id);
      expect(ids).toEqual([1119, 1118, 1117]);
    });

    it("`pageSize` jest klamrowany do przedziału 1–200", async () => {
      const duzy = await zAuth("/api/staging/paged?pageSize=9999");
      expect((duzy.body as { pageSize: number }).pageSize).toBe(MAX_PAGE_SIZE);

      const ujemny = await zAuth("/api/staging/paged?pageSize=-5");
      expect((ujemny.body as { pageSize: number }).pageSize).toBe(1);
    });

    /**
     * Pułapka kolejności operacji w oryginale (pagination_module.cjs:19): `||` działa na
     * STRINGU z query, zanim wejdzie `parseInt`. Niepusty string `"0"` jest prawdziwościowy,
     * więc fallback do `'50'` się NIE uruchamia — parsuje się `0`, a `Math.max(1, 0)` podnosi
     * je do `1`. Napisanie `parseInt(...) || 50` dałoby tu `50`, czyli zupełnie inną stronę
     * wyników. Ten test istnieje właśnie po to, żeby taka „drobna” przeróbka nie przeszła.
     */
    it("`pageSize=0` daje 1, a nie wartość domyślną", async () => {
      const odp = await zAuth("/api/staging/paged?pageSize=0");
      const ciało = odp.body as { pageSize: number; items: unknown[] };

      expect(ciało.pageSize).toBe(1);
      expect(ciało.items).toHaveLength(1);
    });

    it("pusty `pageSize` wpada w wartość domyślną", async () => {
      const odp = await zAuth("/api/staging/paged?pageSize=");
      expect((odp.body as { pageSize: number }).pageSize).toBe(50);
    });

    /**
     * Konsekwencja tej samej wierności, co wyżej: `parseInt("abc")` daje `NaN`,
     * a `Math.max(1, NaN)` to nadal `NaN`. SQLite traktuje związany `NaN` jak `NULL`,
     * a `LIMIT NULL` znaczy „bez limitu" — więc oryginał zwraca WSZYSTKIE wiersze,
     * a `pageSize`/`pages` serializują się w JSON-ie jako `null`.
     *
     * To zastane zachowanie, nie nasza pomyłka. Utrwalamy je, żeby 3c/3e wiedziały,
     * czego się spodziewać, i żeby ewentualna decyzja o naprawie była świadoma.
     */
    it("nieparsowalny `pageSize` daje null i zdejmuje limit — jak w oryginale", async () => {
      const odp = await zAuth("/api/staging/paged?pageSize=abc");
      const ciało = odp.body as { pageSize: number | null; pages: number | null; items: unknown[] };

      expect(odp.status).toBe(200);
      expect(ciało.pageSize).toBeNull();
      expect(ciało.pages).toBeNull();
      expect(ciało.items).toHaveLength(LICZBA_POZYCJI);
    });

    it("nieparsowalny `page` daje null, a offset schodzi do zera", async () => {
      const odp = await zAuth("/api/staging/paged?page=abc");
      const ciało = odp.body as { page: number | null; items: { id: number }[] };

      expect(odp.status).toBe(200);
      expect(ciało.page).toBeNull();
      // OFFSET NULL = 0, więc dostajemy pierwszą stronę mimo śmieciowego `page`.
      expect(ciało.items[0]?.id).toBe(1119);
    });

    it("akceptuje `limit` jako alias `pageSize`", async () => {
      const odp = await zAuth("/api/staging/paged?limit=7");
      expect((odp.body as { pageSize: number }).pageSize).toBe(7);
    });

    it("`page` poniżej 1 jest podnoszony do 1", async () => {
      const odp = await zAuth("/api/staging/paged?page=-3");
      expect((odp.body as { page: number }).page).toBe(1);
    });

    it("filtruje po `typZmiany`, a wartość `all` znaczy „bez filtra”", async () => {
      const nowe = await zAuth("/api/staging/paged?typZmiany=nowa&pageSize=200");
      const ciałoNowe = nowe.body as { items: { typZmiany: string }[]; total: number };
      expect(ciałoNowe.total).toBeGreaterThan(0);
      expect(ciałoNowe.total).toBeLessThan(LICZBA_POZYCJI);
      for (const p of ciałoNowe.items) expect(p.typZmiany).toBe("nowa");

      const wszystkie = await zAuth("/api/staging/paged?typZmiany=all");
      expect((wszystkie.body as { total: number }).total).toBe(LICZBA_POZYCJI);
    });

    it("filtruje po `dostawca`", async () => {
      const odp = await zAuth("/api/staging/paged?dostawca=MO1&pageSize=200");
      const ciało = odp.body as { items: { dostawca: string }[]; total: number };
      expect(ciało.total).toBe(LICZBA_POZYCJI / 2);
      for (const p of ciało.items) expect(p.dostawca).toBe("MO1");
    });

    it("`total` jest liczony PO filtrze, nie z całej tabeli", async () => {
      const odp = await zAuth("/api/staging/paged?dostawca=MO1&pageSize=5");
      const ciało = odp.body as { items: unknown[]; total: number };
      expect(ciało.items).toHaveLength(5);
      expect(ciało.total).toBe(LICZBA_POZYCJI / 2);
    });

    /**
     * Tokenizacja: każdy token musi wystąpić w którejś z czterech kolumn (AND między
     * tokenami, OR wewnątrz), niezależnie od kolejności słów — komentarz Ani wprost
     * podaje ten przykład (pagination_module.cjs:34-37).
     */
    it("`search` wymaga WSZYSTKICH tokenów, niezależnie od kolejności", async () => {
      const trafienie = await zAuth("/api/staging/paged?search=ceat%2024");
      const ciało = trafienie.body as { items: { nazwa: string }[]; total: number };
      expect(ciało.total).toBe(1);
      expect(ciało.items[0]?.nazwa).toBe("460/70R24 CEAT Loadpro");

      const odwrotnie = await zAuth("/api/staging/paged?search=24%20ceat");
      expect((odwrotnie.body as { total: number }).total).toBe(1);

      const jedenPasujeDrugiNie = await zAuth("/api/staging/paged?search=ceat%20michelin");
      expect((jedenPasujeDrugiNie.body as { total: number }).total).toBe(0);
    });

    it("`search` przeszukuje też kod, dostawcę i ean_raw", async () => {
      const poEan = await zAuth("/api/staging/paged?search=5900000000007");
      expect((poEan.body as { total: number }).total).toBe(1);

      const poDostawcy = await zAuth("/api/staging/paged?search=MO1&pageSize=200");
      expect((poDostawcy.body as { total: number }).total).toBe(LICZBA_POZYCJI / 2);
    });

    /**
     * Oryginał wstawia token do wzorca LIKE bez escape'owania (pagination_module.cjs:40),
     * więc `_` i `%` z zapytania użytkownika działają jak wieloznaczniki. Odtwarzamy to
     * zachowanie, nie naprawiamy go — a test utrwala, że to świadome, nie przeoczenie.
     *
     * `MO2_7` trafia więc nie tylko w `MO2_7`, ale i w `MO2_71`…`MO2_79`, bo `_`
     * dopasowuje dowolny pojedynczy znak.
     */
    it("`_` i `%` z zapytania działają jak wieloznaczniki LIKE — jak w oryginale", async () => {
      const podkreslnik = await zAuth("/api/staging/paged?search=MO2_7&pageSize=200");
      const kody = (podkreslnik.body as { items: { kod: string }[] }).items.map((p) => p.kod);
      expect(kody.sort()).toEqual(
        ["MO2_7", "MO2_71", "MO2_73", "MO2_75", "MO2_77", "MO2_79"].sort(),
      );

      const procent = await zAuth("/api/staging/paged?search=%25&pageSize=200");
      expect((procent.body as { total: number }).total).toBe(LICZBA_POZYCJI);
    });

    it("pusty `search` nie filtruje", async () => {
      const odp = await zAuth("/api/staging/paged?search=%20%20");
      expect((odp.body as { total: number }).total).toBe(LICZBA_POZYCJI);
    });
  });

  describe("GET /api/staging/{id}", () => {
    it("zwraca pozycję po id", async () => {
      const odp = await zAuth("/api/staging/1005");
      expect(odp.status).toBe(200);
      expect((odp.body as { id: number }).id).toBe(1005);
    });

    it("400 przy id, które nie jest liczbą", async () => {
      const odp = await zAuth("/api/staging/abc");
      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Nieprawidłowy id");
    });

    it("404, gdy pozycji nie ma", async () => {
      const odp = await zAuth("/api/staging/999999");
      expect(odp.status).toBe(404);
      expect((odp.body as { error: string }).error).toBe("Nie znaleziono pozycji stagingu");
    });

    /** Trasa `/paged` musi być zarejestrowana wcześniej, inaczej wpadłaby tutaj jako `:id`. */
    it("`/paged` nie jest łapane jako id", async () => {
      const odp = await zAuth("/api/staging/paged");
      expect(odp.status).toBe(200);
      expect(odp.body).toHaveProperty("pages");
    });
  });
});
