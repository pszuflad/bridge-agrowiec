/**
 * Historia POWYŻEJ dawnego progu 5000 wierszy `audit_log` — backlog #87, wariant (c).
 *
 * Produkcja (`deminified/backend-index.cjs:48336`, `:48358`) woła `listAudit(5e3)`, czyli tnie
 * SUROWY `audit_log` do 5000 najświeższych wierszy, ZANIM odsieje akcje spoza słownika
 * i zanim przefiltruje czy stronicuje. Po przekroczeniu progu najstarsze wpisy znikają z widoku,
 * a `total` i lista dostawców liczą się na przyciętym materiale. W snapshocie produkcji 93%
 * `audit_log` to akcje, których widok nigdy nie pokaże (sam `auto_pull` — 2869 z 3873), więc
 * właśnie one wypychają wpisy widoczne.
 *
 * ⚠ TO JEST TEST ŚWIADOMEGO ODSTĘPSTWA, NIE WYROCZNIA. Oryginał w tym reżimie gubi wpisy
 * i ten plik sprawdza, że odbudowa ich NIE gubi. `historia.wyrocznia.test.ts` pilnuje
 * reżimu poniżej progu, gdzie obie strony muszą dawać to samo co do znaku.
 *
 * Zasiew: wpisy widoczne rozrzucone w czasie, a pomiędzy nimi i NAD nimi 5200 wierszy
 * `auto_pull` — dokładnie układ, w którym dawny limit wypychał najstarsze wpisy w całości.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

/** Dawny `LIMIT_AUDYTU` — tu tylko jako punkt odniesienia dla zasiewu. */
const DAWNY_PROG = 5000;
const NIEWIDOCZNYCH = 5200;

type Strona = {
  items: {
    id: number;
    typ: string;
    dostawca: string | null;
    kodProduktu: string | null;
  }[];
  total: number;
  pages: number;
};

/** Znacznik czasu w formacie, jaki pisze `zapiszAudyt` (`toISOString`) — 24 znaki, `Z`. */
const chwila = (minuta: number): string =>
  new Date(Date.UTC(2026, 0, 1) + minuta * 60_000).toISOString();

describe("Historia powyżej dawnego progu 5000 wierszy audytu (backlog #87)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const wstaw = srodowisko.sqlite.prepare(
      `INSERT INTO audit_log (uzytkownik_imie, akcja, encja_typ, encja_id, szczegoly_json, kiedy)
       VALUES (@kto, @akcja, @encjaTyp, @encjaId, @szczegoly, @kiedy)`,
    );
    const widoczny = (
      minuta: number,
      akcja: string,
      encjaTyp: string,
      encjaId: string,
      szczegoly: unknown,
    ) =>
      wstaw.run({
        kto: "Test",
        akcja,
        encjaTyp,
        encjaId,
        szczegoly: JSON.stringify(szczegoly),
        kiedy: chwila(minuta),
      });

    srodowisko.sqlite.transaction(() => {
      // Dwa NAJSTARSZE wpisy widoczne — to je dawny limit wypychał jako pierwsze.
      widoczny(0, "upload_pliku", "dostawca", "STARY1", {
        nazwaPliku: "najstarszy-cennik.csv",
        liczbaProduktow: 7,
      });
      widoczny(1, "edycja_produktu", "produkt", "KOD_NAJSTARSZY", {
        zmiany: ["cenaZakupu"],
      });

      // Szum spoza słownika, przetykany co dziesiąty wiersz wpisem widocznym.
      for (let i = 0; i < NIEWIDOCZNYCH; i++) {
        wstaw.run({
          kto: null,
          akcja: "auto_pull",
          encjaTyp: "dostawca",
          encjaId: "SZUM",
          szczegoly: null,
          kiedy: chwila(10 + i),
        });
        if (i % 520 === 0) {
          // Pół minuty po szumie — zasiew bez remisów czasowych, kolejność jednoznaczna.
          widoczny(10 + i + 0.5, "upload_pliku", "dostawca", "MO1", {
            liczbaProduktow: i,
          });
        }
      }
    })();

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const pobierz = async <T>(sciezka: string): Promise<T> => {
    const odp = await request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);
    expect(odp.status).toBe(200);
    return odp.body as T;
  };

  it("zasiew naprawdę przekracza dawny próg, a widocznych jest kilkanaście", () => {
    const { n } = srodowisko.sqlite.prepare("SELECT COUNT(*) AS n FROM audit_log").get() as {
      n: number;
    };
    expect(n).toBeGreaterThan(DAWNY_PROG);
  });

  it("`total` liczy WSZYSTKIE pasujące zdarzenia, nie tylko te z ostatnich 5000 wierszy", async () => {
    const strona = await pobierz<Strona>("/api/history/paged");
    // 2 najstarsze + 10 przetkanych (i = 0, 520, …, 4680).
    expect(strona.total).toBe(12);
    expect(strona.items).toHaveLength(12);
  });

  it("najstarszy wpis jest osiągalny — stoi na końcu ostatniej strony", async () => {
    const strona = await pobierz<Strona>("/api/history/paged?limit=5&page=3");
    expect(strona.pages).toBe(3);
    expect(strona.items.map((w) => w.kodProduktu ?? w.dostawca)).toEqual([
      "KOD_NAJSTARSZY",
      "STARY1",
    ]);
  });

  it("filtr `typ` i `dostawca` sięgają najstarszych wpisów", async () => {
    const edycje = await pobierz<Strona>("/api/history/paged?typ=edycja");
    expect(edycje.total).toBe(1);
    expect(edycje.items[0]?.kodProduktu).toBe("KOD_NAJSTARSZY");

    const stary = await pobierz<Strona>("/api/history/paged?dostawca=STARY1");
    expect(stary.total).toBe(1);
  });

  it("fraza sięga najstarszych wpisów — także po polu WYLICZANYM („Plik: …”)", async () => {
    const poPliku = await pobierz<Strona>("/api/history/paged?search=Plik:%20najstarszy");
    expect(poPliku.total).toBe(1);
    expect(poPliku.items[0]?.dostawca).toBe("STARY1");
  });

  it("`/meta` wymienia dostawcę, który występuje tylko w najstarszym wpisie", async () => {
    const meta = await pobierz<{ dostawcy: string[] }>("/api/history/meta");
    expect(meta.dostawcy).toEqual(["MO1", "STARY1"]);
  });
});

/**
 * Remis czasowy — dziś nieobecny w danych produkcji (3873 wiersze, 0 remisów), ale możliwy:
 * `toISOString()` ma rozdzielczość milisekundy. Oryginał przy równym `kiedy` ma kolejność
 * nieokreśloną; odbudowa rozstrzyga `id DESC` (plan.md D4), żeby sąsiednie strony nie
 * dzieliły wpisu i żadnego nie gubiły.
 */
describe("Historia — remis `kiedy` rozstrzyga `id DESC`", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const wstaw = srodowisko.sqlite.prepare(
      `INSERT INTO audit_log (akcja, encja_typ, encja_id, szczegoly_json, kiedy)
       VALUES ('edycja_produktu', 'produkt', @kod, '{"zmiany":["dot"]}', @kiedy)`,
    );
    srodowisko.sqlite.transaction(() => {
      for (let i = 1; i <= 6; i++) wstaw.run({ kod: `KOD_${i}`, kiedy: chwila(0) });
    })();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  it("wpisy o tym samym `kiedy` wychodzą od najwyższego `id`, a strony są rozłączne i pełne", async () => {
    const strony: Strona[] = [];
    for (const page of [1, 2, 3]) {
      const odp = await request(srodowisko.app)
        .get(`/api/history/paged?limit=2&page=${page}`)
        .set("Authorization", `Bearer ${token}`);
      strony.push(odp.body as Strona);
    }
    const kody = strony.flatMap((s) => s.items.map((w) => w.kodProduktu));
    expect(kody).toEqual(["KOD_6", "KOD_5", "KOD_4", "KOD_3", "KOD_2", "KOD_1"]);
  });
});
